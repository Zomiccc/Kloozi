const db = require('../config/database');
const logger = require('../utils/logger');
const { sendTrackedEmail } = require('./emailService');
const { sendWhatsAppToLead } = require('./whatsappService');
const { sendSMSToLead } = require('./smsService');
const { sendPushNotification } = require('../utils/notifications');
const { logActivity } = require('../utils/activityLog');
const { replaceVariables } = require('../utils/variables');
const { getSegmentMemberIds } = require('./segmentService');

// ─── Flow engine ────────────────────────────────────────────────────────────
// A flow stores a node graph as JSONB:
//   graph: { nodes: [{ key, type, x, y, config }], edges: [{ from, to, label }] }
// Node types: send_email | wait | condition | add_tag | change_stage |
//             notify_agent | whatsapp | sms | exit  ('trigger' nodes are visual-only —
//             the canonical trigger lives on flow.trigger_type/trigger_config)
// Edges carry a label; 'condition' nodes branch on labels 'yes' / 'no'.
// Every executed step is written to flow_action_log (per-step analytics).

const MAX_STEPS_PER_TICK = 10;
const MAX_SEND_ATTEMPTS = 3;

// ── Graph helpers ──

function parseGraph(flow) {
  let g = flow.graph;
  if (typeof g === 'string') {
    try { g = JSON.parse(g); } catch { g = null; }
  }
  if (!g || typeof g !== 'object') g = {};
  const nodes = Array.isArray(g.nodes) ? g.nodes.filter((n) => n && n.key && n.type) : [];
  const edges = Array.isArray(g.edges) ? g.edges.filter((e) => e && e.from && e.to) : [];
  return { nodes, edges };
}

function resolveEntryNode(graph) {
  const actionNodes = graph.nodes.filter((n) => n.type !== 'trigger');
  if (actionNodes.length === 0) return null;
  const targets = new Set(graph.edges.map((e) => e.to));
  return actionNodes.find((n) => !targets.has(n.key))?.key || actionNodes[0].key;
}

function nextTarget(graph, fromKey, preferredLabel) {
  const outs = graph.edges.filter((e) => e.from === fromKey);
  if (outs.length === 0) return null;
  const labeled = preferredLabel ? outs.find((e) => (e.label || '').toLowerCase() === preferredLabel) : null;
  const plain = outs.find((e) => !e.label || e.label === 'next');
  return (labeled || plain || outs[0]).to;
}

// ── Logging ──

async function logAction(enrollment, nodeKey, actionType, status, detail = {}) {
  try {
    await db.query(
      `INSERT INTO flow_action_log (workspace_id, enrollment_id, flow_id, lead_id, node_key, action_type, status, detail)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [enrollment.workspace_id, enrollment.id, enrollment.flow_id, enrollment.lead_id,
       nodeKey, actionType, status, JSON.stringify(detail)]
    );
  } catch (err) {
    logger.error('flow_action_log error:', err.message);
  }
}

// ── Enrollment lifecycle ──

async function exitEnrollment(enrollment, reason) {
  await db.query(
    "UPDATE flow_enrollments SET status = 'exited', exit_reason = $2, completed_at = NOW() WHERE id = $1",
    [enrollment.id, reason]
  );
}

async function completeEnrollment(enrollment) {
  await db.query(
    "UPDATE flow_enrollments SET status = 'completed', completed_at = NOW(), current_node_key = NULL WHERE id = $1",
    [enrollment.id]
  );
}

async function setNodeAndSchedule(enrollmentId, nodeKey, whenOrNull) {
  await db.query(
    'UPDATE flow_enrollments SET current_node_key = $2, next_action_at = $3 WHERE id = $1',
    [enrollmentId, nodeKey, whenOrNull]
  );
}

/** Enroll specific leads into a flow (used by triggers and manual enrollment). */
async function enrollLeads(workspaceId, flow, leadIds, entryNodeKey) {
  if (!leadIds.length) return 0;
  const res = await db.query(
    `INSERT INTO flow_enrollments (workspace_id, flow_id, lead_id, status, current_node_key, entered_at, next_action_at)
     SELECT $1, $2, x, 'active', $4, NOW(), NOW()
     FROM UNNEST($3::uuid[]) AS x
     ON CONFLICT (flow_id, lead_id) DO NOTHING
     RETURNING lead_id`,
    [workspaceId, flow.id, leadIds, entryNodeKey]
  );
  const enrolled = res.rows.length;
  if (enrolled > 0) {
    await logAction({ workspace_id: workspaceId, id: null, flow_id: flow.id }, '__entry__', 'entered', 'success',
      { count: enrolled });
    // Timeline entry per newly-enrolled lead
    for (const row of res.rows.slice(0, 50)) {
      await logActivity(workspaceId, row.lead_id, flow.created_by, 'flow_enrolled',
        `Entered flow "${flow.name}"`, { flow_id: flow.id }).catch(() => {});
    }
  }
  return enrolled;
}

// ── Trigger evaluation ──

async function candidateIdsForTrigger(flow, wsId) {
  const cfg = flow.trigger_config || {};
  const since = flow.live_since || new Date(0);
  switch (flow.trigger_type) {
    case 'lead_created': {
      const r = await db.query(
        'SELECT id FROM leads WHERE workspace_id = $1 AND created_at > $2',
        [wsId, since]
      );
      return r.rows.map((x) => x.id);
    }
    case 'stage_entered': {
      if (!cfg.stage) return [];
      const r = await db.query(
        `SELECT DISTINCT a.lead_id FROM lead_activities a
         JOIN leads l ON l.id = a.lead_id
         WHERE l.workspace_id = $1 AND a.type = 'stage_change'
           AND a.created_at > $2 AND LOWER(a.metadata->>'new_stage') = LOWER($3)`,
        [wsId, since, String(cfg.stage)]
      );
      return r.rows.map((x) => x.lead_id);
    }
    case 'segment_entered': {
      if (!cfg.segment_id) return [];
      return getSegmentMemberIds(wsId, cfg.segment_id);
    }
    case 'tagged_with': {
      if (!cfg.tag) return [];
      const r = await db.query(
        'SELECT id FROM leads WHERE workspace_id = $1 AND tags @> $2::jsonb',
        [wsId, JSON.stringify([cfg.tag])]
      );
      return r.rows.map((x) => x.id);
    }
    case 'days_inactive': {
      const days = Math.max(0, Number(cfg.days ?? 7));
      const r = await db.query(
        `SELECT id FROM leads
         WHERE workspace_id = $1
           AND COALESCE(last_activity_at, updated_at, created_at) < NOW() - ($2 || ' days')::interval`,
        [wsId, String(days)]
      );
      return r.rows.map((x) => x.id);
    }
    case 'source_is': {
      if (!cfg.source) return [];
      const r = await db.query(
        'SELECT id FROM leads WHERE workspace_id = $1 AND lead_source = $2',
        [wsId, cfg.source]
      );
      return r.rows.map((x) => x.id);
    }
    default:
      return []; // 'manual' and unknown types are driven via the API only
  }
}

async function processTriggers(flow) {
  const wsId = flow.workspace_id;
  const graph = parseGraph(flow);
  const entry = resolveEntryNode(graph);
  if (!entry) return;

  const candidates = await candidateIdsForTrigger(flow, wsId);
  if (candidates.length > 0) {
    const n = await enrollLeads(wsId, flow, candidates, entry);
    if (n > 0) logger.info(`Flow "${flow.name}": enrolled ${n} lead(s) via ${flow.trigger_type}`);
  }
}

// ── Condition evaluation ──

async function evaluateCondition(config, lead, wsId, flowId) {
  switch ((config.condition_type || '').toLowerCase()) {
    case 'email_opened':
    case 'email_clicked':
    case 'email_replied': {
      // Most recent email this lead received *from this flow*
      const r = await db.query(
        'SELECT opened_at, clicked_at, replied_at FROM emails WHERE lead_id = $1 AND flow_id = $2 ORDER BY sent_at DESC LIMIT 1',
        [lead.id, flowId]
      );
      if (r.rows.length === 0) return false;
      const e = r.rows[0];
      if (config.condition_type === 'email_opened') return !!e.opened_at;
      if (config.condition_type === 'email_clicked') return !!e.clicked_at;
      return !!e.replied_at;
    }
    case 'email_replied_recently': {
      const r = await db.query(
        `SELECT 1 FROM lead_activities
         WHERE lead_id = $1 AND workspace_id = $2 AND type = 'email_replied'
           AND created_at >= NOW() - INTERVAL '30 days' LIMIT 1`,
        [lead.id, wsId]
      );
      return r.rows.length > 0;
    }
    case 'stage_is':
      return String(lead.stage || '').toLowerCase() === String(config.stage || '').toLowerCase();
    case 'score_above':
      return Number(lead.score || 0) > Number(config.score || 0);
    case 'segment_member': {
      if (!config.segment_id) return false;
      const ids = await getSegmentMemberIds(wsId, config.segment_id);
      return ids.includes(lead.id);
    }
    default:
      logger.warn(`Unknown condition type: ${config.condition_type}`);
      return false;
  }
}

// ── Node execution ──

async function buildLeadData(lead) {
  const { loadLeadVariables } = require('../utils/leadVariables');
  return (await loadLeadVariables(lead.workspace_id, lead.id)) || {
    first_name: lead.first_name, last_name: lead.last_name, phone: lead.phone, email: lead.email,
    city: lead.city, budget: lead.budget, lead_source: lead.lead_source,
  };
}

/**
 * Execute the enrollment's current node.
 * Returns 'continue' (advance immediately), 'scheduled' (wait node armed),
 * or 'stopped' (exit / failure / completion).
 */
async function executeCurrentNode(enrollment, flow, graph, lead) {
  const wsId = enrollment.workspace_id;
  const node = graph.nodes.find((n) => n.key === enrollment.current_node_key);

  if (!node) {
    await completeEnrollment(enrollment);
    return 'stopped';
  }

  const config = node.config || {};

  switch (node.type) {
    case 'exit': {
      await logAction(enrollment, node.key, 'exit', 'success', {});
      await completeEnrollment(enrollment);
      return 'stopped';
    }

    case 'wait': {
      const value = Math.max(1, Number(config.duration ?? 1));
      const unitMinutes = config.unit === 'days' ? 1440 : config.unit === 'hours' ? 60 : 1;
      const minutes = value * unitMinutes;
      const target = nextTarget(graph, node.key);
      if (!target) {
        await logAction(enrollment, node.key, 'wait', 'skipped', { reason: 'no_next_node' });
        await completeEnrollment(enrollment);
        return 'stopped';
      }
      await setNodeAndSchedule(enrollment.id, target,
        new Date(Date.now() + minutes * 60000));
      await logAction(enrollment, node.key, 'wait', 'waiting', { minutes });
      return 'scheduled';
    }

    case 'send_email': {
      const userId = lead.assigned_to || flow.created_by;
      const payload = {
        workspaceId: wsId,
        leadId: lead.id,
        userId,
        campaignId: null,
        flowId: flow.id,
        nodeId: node.key,
        source: 'flow',
        overrideSubject: config.subject || undefined,
        overrideBody: config.body_html || undefined,
        marketingEmailId: config.marketing_email_id || undefined,
      };
      const result = await sendTrackedEmail(payload);
      if (result.success) {
        await logAction(enrollment, node.key, 'send_email', 'success', { email_id: result.emailId });
        const target = nextTarget(graph, node.key);
        if (!target) { await completeEnrollment(enrollment); return 'stopped'; }
        await setNodeAndSchedule(enrollment.id, target, new Date());
        return 'continue';
      }
      // Failure: allow a couple of retries across ticks before giving up
      const attempts = await db.query(
        `SELECT COUNT(*)::int AS c FROM flow_action_log
         WHERE enrollment_id = $1 AND node_key = $2 AND action_type = 'send_email' AND status = 'failed'`,
        [enrollment.id, node.key]
      );
      if (attempts.rows[0].c >= MAX_SEND_ATTEMPTS - 1) {
        await logAction(enrollment, node.key, 'send_email', 'failed', { error: result.error, final: true });
        await exitEnrollment(enrollment, 'send_failed');
        return 'stopped';
      }
      await logAction(enrollment, node.key, 'send_email', 'failed', { error: result.error, will_retry: true });
      return 'stopped';
    }

    case 'condition': {
      const result = await evaluateCondition(config, lead, wsId, flow.id);
      const target = nextTarget(graph, node.key, result ? 'yes' : 'no')
        || nextTarget(graph, node.key);
      await logAction(enrollment, node.key, 'condition', 'branch', { condition: config.condition_type, result });
      if (!target) { await completeEnrollment(enrollment); return 'stopped'; }
      await setNodeAndSchedule(enrollment.id, target, new Date());
      return 'continue';
    }

    case 'add_tag': {
      const tag = String(config.tag || '').trim();
      if (!tag) {
        await logAction(enrollment, node.key, 'add_tag', 'skipped', { reason: 'empty_tag' });
        const t1 = nextTarget(graph, node.key);
        if (!t1) { await completeEnrollment(enrollment); return 'stopped'; }
        await setNodeAndSchedule(enrollment.id, t1, new Date());
        return 'continue';
      }
      await db.query(
        `UPDATE leads SET tags = CASE WHEN tags @> $2::jsonb THEN tags ELSE tags || $2::jsonb END,
           updated_at = NOW() WHERE id = $1 AND workspace_id = $3`,
        [lead.id, JSON.stringify([tag]), wsId]
      );
      await db.query(
        `INSERT INTO lead_tags (workspace_id, name) VALUES ($1, $2)
         ON CONFLICT (workspace_id, name) DO NOTHING`,
        [wsId, tag]
      ).catch(() => {});
      await logActivity(wsId, lead.id, lead.assigned_to || flow.created_by, 'tag_added',
        `Flow "${flow.name}" added tag "${tag}"`, { flow_id: flow.id }).catch(() => {});
      await logAction(enrollment, node.key, 'add_tag', 'success', { tag });
      const t2 = nextTarget(graph, node.key);
      if (!t2) { await completeEnrollment(enrollment); return 'stopped'; }
      await setNodeAndSchedule(enrollment.id, t2, new Date());
      return 'continue';
    }

    case 'change_stage': {
      const stageName = String(config.stage || '').trim();
      if (!stageName) {
        await logAction(enrollment, node.key, 'change_stage', 'skipped', { reason: 'empty_stage' });
        const s0 = nextTarget(graph, node.key);
        if (!s0) { await completeEnrollment(enrollment); return 'stopped'; }
        await setNodeAndSchedule(enrollment.id, s0, new Date());
        return 'continue';
      }
      const stageRow = await db.query(
        'SELECT id FROM lead_stages WHERE workspace_id = $1 AND LOWER(name) = LOWER($2) LIMIT 1',
        [wsId, stageName]
      );
      await db.query(
        `UPDATE leads SET stage = $2,
           stage_id = COALESCE($3::uuid, stage_id), updated_at = NOW()
         WHERE id = $1 AND workspace_id = $4`,
        [lead.id, stageName.toLowerCase(), stageRow.rows[0]?.id || null, wsId]
      );
      await logActivity(wsId, lead.id, lead.assigned_to || flow.created_by, 'stage_change',
        `Stage changed to ${stageName.toLowerCase()} by flow "${flow.name}"`, { new_stage: stageName.toLowerCase() }).catch(() => {});
      const previous = { ...lead };
      lead.stage = stageName.toLowerCase();
      if (stageRow.rows[0]?.id) lead.stage_id = stageRow.rows[0].id;
      require('./leadPipeline').onLeadUpdated(wsId, previous, { ...lead }).catch(() => {});
      await logAction(enrollment, node.key, 'change_stage', 'success', { stage: lead.stage });
      const s1 = nextTarget(graph, node.key);
      if (!s1) { await completeEnrollment(enrollment); return 'stopped'; }
      await setNodeAndSchedule(enrollment.id, s1, new Date());
      return 'continue';
    }

    case 'notify_agent': {
      const recipient = lead.assigned_to || flow.created_by;
      if (recipient) {
        await sendPushNotification(
          recipient,
          `Flow: ${flow.name}`,
          replaceVariables(config.message || `Automation reached you about {{First_Name}}.`, await buildLeadData(lead)),
          { type: 'flow_notification', flowId: flow.id, leadId: lead.id, nodeKey: node.key }
        ).catch(() => {});
      }
      await logAction(enrollment, node.key, 'notify_agent', 'success', { recipient });
      const n1 = nextTarget(graph, node.key);
      if (!n1) { await completeEnrollment(enrollment); return 'stopped'; }
      await setNodeAndSchedule(enrollment.id, n1, new Date());
      return 'continue';
    }

    case 'whatsapp':
    case 'sms': {
      const message = replaceVariables(config.message || '', await buildLeadData(lead));
      if (!message.trim()) {
        await logAction(enrollment, node.key, node.type, 'skipped', { reason: 'empty_message' });
        const w0 = nextTarget(graph, node.key);
        if (!w0) { await completeEnrollment(enrollment); return 'stopped'; }
        await setNodeAndSchedule(enrollment.id, w0, new Date());
        return 'continue';
      }
      const userId = lead.assigned_to || flow.created_by;
      const sender = node.type === 'whatsapp' ? sendWhatsAppToLead : sendSMSToLead;
      const result = await sender({ workspaceId: wsId, leadId: lead.id, userId, message });
      if (result.success) {
        await logAction(enrollment, node.key, node.type, 'success', { message_id: result.messageId });
        const w1 = nextTarget(graph, node.key);
        if (!w1) { await completeEnrollment(enrollment); return 'stopped'; }
        await setNodeAndSchedule(enrollment.id, w1, new Date());
        return 'continue';
      }
      await logAction(enrollment, node.key, node.type, 'failed', { error: result.error, final: true });
      await exitEnrollment(enrollment, `${node.type}_failed`);
      return 'stopped';
    }

    default: {
      await logAction(enrollment, node.key, node.type, 'failed', { error: 'unknown_node_type' });
      await completeEnrollment(enrollment);
      return 'stopped';
    }
  }
}

// ── Main tick ──

async function advanceDueEnrollments() {
  const due = await db.query(
    `SELECT fe.*, f.name AS flow_name, f.graph AS flow_graph, f.trigger_type AS flow_trigger,
            f.trigger_config AS flow_trigger_config, f.created_by AS flow_created_by
     FROM flow_enrollments fe
     JOIN flows f ON f.id = fe.flow_id
     WHERE fe.status = 'active' AND f.status = 'live'
       AND (fe.next_action_at IS NULL OR fe.next_action_at <= NOW())
     ORDER BY fe.next_action_at ASC NULLS FIRST
     LIMIT 200`
  );

  for (const enrollment of due.rows) {
    try {
      // Claim the step so a second worker (or an overlapping tick) can't run it too.
      // If the step crashes, it is retried once the claim lapses (5 min).
      const claim = await db.query(
        `UPDATE flow_enrollments SET next_action_at = NOW() + INTERVAL '5 minutes'
         WHERE id = $1 AND status = 'active' AND (next_action_at IS NULL OR next_action_at <= NOW())
         RETURNING id`,
        [enrollment.id]
      );
      if (!claim.rows.length) continue;
      const flow = {
        id: enrollment.flow_id,
        workspace_id: enrollment.workspace_id,
        name: enrollment.flow_name,
        graph: enrollment.flow_graph,
        trigger_type: enrollment.flow_trigger,
        trigger_config: enrollment.flow_trigger_config,
        created_by: enrollment.flow_created_by,
      };

      const leadRes = await db.query(
        `SELECT l.*, s.is_won, s.is_lost
         FROM leads l LEFT JOIN lead_stages s ON s.id = l.stage_id
         WHERE l.id = $1 AND l.workspace_id = $2`,
        [enrollment.lead_id, enrollment.workspace_id]
      );
      if (leadRes.rows.length === 0) {
        await exitEnrollment(enrollment, 'lead_deleted');
        continue;
      }
      const lead = leadRes.rows[0];

      // Global exit gates — checked before every step
      if (lead.is_unsubscribed) {
        await logAction(enrollment, enrollment.current_node_key, 'exit_check', 'skipped', { reason: 'unsubscribed' });
        await exitEnrollment(enrollment, 'unsubscribed');
        continue;
      }
      // A flow that is *about* won/lost leads (trigger "stage entered: Won") must keep running.
      const triggerCfg = typeof flow.trigger_config === 'string' ? (() => { try { return JSON.parse(flow.trigger_config); } catch { return {}; } })() : (flow.trigger_config || {});
      const stageFlow = flow.trigger_type === 'stage_entered'
        && String(triggerCfg.stage || '').toLowerCase() === String(lead.stage || '').toLowerCase();
      if (!stageFlow && (lead.is_won === true || String(lead.stage).toLowerCase() === 'won')) {
        await logAction(enrollment, enrollment.current_node_key, 'exit_check', 'skipped', { reason: 'lead_won' });
        await exitEnrollment(enrollment, 'lead_won');
        continue;
      }
      if (!stageFlow && (lead.is_lost === true || String(lead.stage).toLowerCase() === 'lost')) {
        await logAction(enrollment, enrollment.current_node_key, 'exit_check', 'skipped', { reason: 'lead_lost' });
        await exitEnrollment(enrollment, 'lead_lost');
        continue;
      }

      const graph = parseGraph(flow);

      // Chain steps within one tick until something schedules or stops
      let current = enrollment;
      for (let i = 0; i < MAX_STEPS_PER_TICK; i++) {
        const outcome = await executeCurrentNode(current, flow, graph, lead);
        if (outcome !== 'continue') break;
        // Reload the pointer for the next chained step
        const fresh = await db.query('SELECT * FROM flow_enrollments WHERE id = $1', [enrollment.id]);
        if (fresh.rows.length === 0 || fresh.rows[0].status !== 'active') break;
        current = fresh.rows[0];
        if (current.next_action_at && current.next_action_at > new Date()) break;
      }
    } catch (err) {
      logger.error(`Flow advance error (enrollment ${enrollment.id}):`, err.message);
    }
  }
  return due.rows.length;
}

let ticking = false;

async function runFlowTick() {
  if (ticking) return;
  ticking = true;
  try {
    const liveFlows = await db.query("SELECT * FROM flows WHERE status = 'live'");
    for (const flow of liveFlows.rows) {
      try {
        await processTriggers(flow);
      } catch (err) {
        logger.error(`Flow trigger error (${flow.name}):`, err.message);
      }
    }
    await advanceDueEnrollments();
  } catch (err) {
    logger.error('Flow tick error:', err.message);
  } finally {
    ticking = false;
  }
}

// ── Manual enrollment (API-driven) ──

async function manualEnroll(workspaceId, flowId, leadIds) {
  const flowRes = await db.query(
    'SELECT * FROM flows WHERE id = $1 AND workspace_id = $2',
    [flowId, workspaceId]
  );
  if (flowRes.rows.length === 0) return { error: 'Flow not found' };
  const flow = flowRes.rows[0];
  const entry = resolveEntryNode(parseGraph(flow));
  if (!entry) return { error: 'Flow has no steps' };
  const valid = (Array.isArray(leadIds) ? leadIds : []).filter(Boolean);
  if (valid.length === 0) return { error: 'No leads provided' };
  const enrolled = await enrollLeads(workspaceId, flow, valid, entry);
  return { enrolled };
}

module.exports = { runFlowTick, manualEnroll, parseGraph, resolveEntryNode };
