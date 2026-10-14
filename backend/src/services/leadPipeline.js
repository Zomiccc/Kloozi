const axios = require('axios');
const db = require('../config/database');
const logger = require('../utils/logger');
const { logActivity, updateLeadScore } = require('../utils/activityLog');
const { sendPushNotification, notifyManagers } = require('../utils/notifications');
const { emitToWorkspace } = require('../utils/realtime');
const { cacheDelPattern } = require('../config/redis');
const config = require('../config');

// ─── Lead pipeline ──────────────────────────────────────────────────────────
// Every lead source (manual, CSV, phonebook, Facebook/TikTok/LinkedIn, embed
// forms, lead-form pages, Zapier/WordPress/Google Forms tokens, WhatsApp
// inbound, email parsing) creates leads through createLead(). New leads then
// run the same automation chain, in order:
//   1. Automation rules (priority order) — assign / tag / stage / distribute
//   2. Lead distribution (round-robin or broadcast relay to recipients)
//   3. Fallback assignment — territory → assignment strategy → creator
//   4. Assignee notification
//   5. Outgoing webhooks
// Lead updates run onLeadUpdated() for stage/assignment side effects.

const EVENT_ALIASES = {
  new_lead: ['new_lead', 'lead.created'],
  stage_changed: ['stage_changed', 'lead.stage_changed'],
  lead_updated: ['lead_updated', 'lead.updated'],
  deal_won: ['deal_won', 'lead.won'],
  deal_lost: ['deal_lost', 'lead.lost'],
  follow_up_completed: ['follow_up_completed', 'follow_up.completed'],
};

// ── Small helpers ──

function parseJson(value, fallback) {
  if (value === null || value === undefined) return fallback;
  if (typeof value !== 'string') return value;
  try { return JSON.parse(value); } catch { return fallback; }
}

function normalizeTags(tags) {
  const list = Array.isArray(tags) ? tags : (typeof tags === 'string' && tags ? tags.split(',') : []);
  return [...new Set(list.map((t) => String(t).trim()).filter(Boolean))];
}

function digitsOnly(phone) {
  return String(phone || '').replace(/\D/g, '');
}

function leadName(lead) {
  return [lead.first_name, lead.last_name].filter(Boolean).join(' ') || 'Unknown';
}

function sourceMatches(ruleSource, leadSource) {
  if (!ruleSource || ruleSource === 'any') return true;
  const a = String(ruleSource).toLowerCase();
  const b = String(leadSource || '').toLowerCase();
  return b === a || b.startsWith(`${a}_`) || b.startsWith(a);
}

async function getWorkspaceSettings(workspaceId) {
  const r = await db.query('SELECT settings FROM workspaces WHERE id = $1', [workspaceId]);
  return parseJson(r.rows[0]?.settings, {}) || {};
}

async function resolveStage(workspaceId, stageName) {
  if (stageName) {
    const r = await db.query(
      'SELECT id, name FROM lead_stages WHERE workspace_id = $1 AND LOWER(name) = LOWER($2) LIMIT 1',
      [workspaceId, String(stageName)]
    );
    if (r.rows[0]) return { id: r.rows[0].id, name: r.rows[0].name.toLowerCase() };
    return { id: null, name: String(stageName).toLowerCase() };
  }
  const r = await db.query(
    'SELECT id, name FROM lead_stages WHERE workspace_id = $1 AND is_default = true LIMIT 1',
    [workspaceId]
  );
  return { id: r.rows[0]?.id || null, name: (r.rows[0]?.name || 'new').toLowerCase() };
}

/** Resolve a user in the workspace from an id, email, or display name. */
async function resolveUser(workspaceId, ref) {
  if (!ref) return null;
  const value = String(ref).trim();
  const r = await db.query(
    `SELECT id, first_name, last_name, email FROM users
     WHERE workspace_id = $1 AND status = 'active'
       AND (id::text = $2 OR LOWER(email) = LOWER($2)
            OR LOWER(TRIM(COALESCE(first_name,'') || ' ' || COALESCE(last_name,''))) = LOWER($2)
            OR LOWER(first_name) = LOWER($2))
     LIMIT 1`,
    [workspaceId, value]
  );
  return r.rows[0] || null;
}

async function getLead(workspaceId, leadId) {
  const r = await db.query('SELECT * FROM leads WHERE id = $1 AND workspace_id = $2', [leadId, workspaceId]);
  return r.rows[0] || null;
}

// ── Agent selection ──

const AGENT_ROLES = ['sales_agent'];

/** Next agent in rotation: the active agent who was assigned a lead least recently. */
async function pickRoundRobinAgent(workspaceId) {
  const r = await db.query(
    `SELECT u.id FROM users u
     WHERE u.workspace_id = $1 AND u.status = 'active' AND u.role = ANY($2)
     ORDER BY (SELECT MAX(l.created_at) FROM leads l WHERE l.assigned_to = u.id) ASC NULLS FIRST, u.created_at ASC
     LIMIT 1`,
    [workspaceId, AGENT_ROLES]
  );
  return r.rows[0]?.id || null;
}

/** Agent with the fewest open (not won/lost) leads. */
async function pickLeastLoadedAgent(workspaceId) {
  const r = await db.query(
    `SELECT u.id FROM users u
     WHERE u.workspace_id = $1 AND u.status = 'active' AND u.role = ANY($2)
     ORDER BY (SELECT COUNT(*) FROM leads l WHERE l.assigned_to = u.id AND l.stage NOT IN ('won','lost')) ASC,
              u.created_at ASC
     LIMIT 1`,
    [workspaceId, AGENT_ROLES]
  );
  return r.rows[0]?.id || null;
}

async function pickTerritoryAgent(workspaceId, city) {
  if (!city) return null;
  const r = await db.query(
    `SELECT t.user_id FROM territories t JOIN users u ON u.id = t.user_id
     WHERE t.workspace_id = $1 AND LOWER(TRIM(t.city)) = LOWER(TRIM($2)) AND u.status = 'active'
     ORDER BY (SELECT MAX(l.created_at) FROM leads l WHERE l.assigned_to = u.id) ASC NULLS FIRST
     LIMIT 1`,
    [workspaceId, city]
  );
  return r.rows[0]?.user_id || null;
}

async function pickDefaultAgent(workspaceId, lead) {
  const territory = await pickTerritoryAgent(workspaceId, lead.city);
  if (territory) return territory;
  const strategy = await db.query(
    'SELECT type FROM lead_assignment_rules WHERE workspace_id = $1 AND COALESCE(is_active, true) LIMIT 1',
    [workspaceId]
  );
  const type = strategy.rows[0]?.type;
  let agent = null;
  if (type === 'best_fit') {
    const { pickBestFitAgent } = require('./intelOps');
    const pick = await pickBestFitAgent(workspaceId, lead);
    agent = pick.userId;
    if (agent && lead.id) lead._routingReason = pick.reason;
  } else {
    agent = type === 'round_robin' ? await pickRoundRobinAgent(workspaceId) : await pickLeastLoadedAgent(workspaceId);
  }
  if (agent) return agent;
  // No sales agents yet (solo owner, small team): the workspace owner gets the lead.
  const owner = await db.query(
    `SELECT id FROM users WHERE workspace_id = $1 AND status = 'active' AND role IN ('super_admin','admin','sales_manager')
     ORDER BY CASE role WHEN 'super_admin' THEN 0 WHEN 'admin' THEN 1 ELSE 2 END, created_at ASC LIMIT 1`,
    [workspaceId]
  );
  return owner.rows[0]?.id || null;
}

// ── Mutations used by rules / distribution ──

async function assignLead(workspaceId, lead, userId, reason, actorId = null) {
  if (!userId || lead.assigned_to === userId) return lead;
  const r = await db.query(
    'UPDATE leads SET assigned_to = $1, updated_at = NOW() WHERE id = $2 AND workspace_id = $3 RETURNING *',
    [userId, lead.id, workspaceId]
  );
  await logActivity(workspaceId, lead.id, actorId, 'lead_assigned', `Lead assigned (${reason})`, { assigned_to: userId, reason });
  return r.rows[0] || lead;
}

async function addTag(workspaceId, lead, tag) {
  const clean = normalizeTags([tag]);
  if (clean.length === 0) return lead;
  const r = await db.query(
    `UPDATE leads SET tags = (
       SELECT COALESCE(jsonb_agg(DISTINCT t), '[]'::jsonb)
       FROM jsonb_array_elements_text(COALESCE(tags, '[]'::jsonb) || $1::jsonb) AS t
     ), updated_at = NOW()
     WHERE id = $2 AND workspace_id = $3 RETURNING *`,
    [JSON.stringify(clean), lead.id, workspaceId]
  );
  return r.rows[0] || lead;
}

async function changeStage(workspaceId, lead, stageName, actorId = null, reason = 'automation') {
  const stage = await resolveStage(workspaceId, stageName);
  if (!stage.name || stage.name === String(lead.stage || '').toLowerCase()) return lead;
  const r = await db.query(
    'UPDATE leads SET stage = $1, stage_id = COALESCE($2, stage_id), updated_at = NOW() WHERE id = $3 AND workspace_id = $4 RETURNING *',
    [stage.name, stage.id, lead.id, workspaceId]
  );
  await logActivity(workspaceId, lead.id, actorId, 'stage_change', `Stage changed to ${stage.name} (${reason})`, {
    old_stage: lead.stage, new_stage: stage.name, reason,
  });
  return r.rows[0] || lead;
}

// ── Outgoing webhooks ──

async function fireOutgoingWebhooks(workspaceId, event, data) {
  try {
    const accepted = EVENT_ALIASES[event] || [event];
    const hooks = await db.query(
      'SELECT * FROM outgoing_webhooks WHERE workspace_id = $1 AND COALESCE(is_active, is_enabled, true) = true',
      [workspaceId]
    );
    for (const wh of hooks.rows) {
      let events = parseJson(wh.events, []);
      if (!Array.isArray(events) || events.length === 0) events = wh.trigger_event ? [wh.trigger_event] : [];
      if (events.length > 0 && !events.includes('*') && !events.some((e) => accepted.includes(e))) continue;

      const payload = { event, timestamp: new Date().toISOString(), workspace_id: workspaceId, data };
      const headers = { 'Content-Type': 'application/json', 'X-Flazyn-Event': event, ...parseJson(wh.headers, {}) };
      let status = 0;
      let errorMessage = null;
      let responseBody = null;
      try {
        const response = await axios.post(wh.url, payload, { timeout: 10000, headers });
        status = response.status;
        responseBody = typeof response.data === 'string' ? response.data.slice(0, 2000) : JSON.stringify(response.data || '').slice(0, 2000);
      } catch (err) {
        status = err.response?.status || 0;
        errorMessage = err.message;
      }
      const ok = !errorMessage;
      await db.query(
        `INSERT INTO outgoing_webhook_logs
           (webhook_id, workspace_id, event, event_type, payload, request_body, response_code, response_status,
            response_body, status, success, error_message)
         VALUES ($1,$2,$3,$3,$4,$4,$5,$5,$6,$7,$8,$9)`,
        [wh.id, workspaceId, event, JSON.stringify(payload), status, responseBody, ok ? 'success' : 'failed', ok, errorMessage]
      ).catch((e) => logger.error('Webhook log error:', e.message));
    }
  } catch (err) {
    logger.error('Fire outgoing webhooks error:', err.message);
  }
}

function webhookLeadPayload(lead) {
  return {
    id: lead.id, leadId: lead.id,
    first_name: lead.first_name, last_name: lead.last_name, phone: lead.phone, email: lead.email,
    city: lead.city, budget: lead.budget, lead_source: lead.lead_source, stage: lead.stage,
    tags: parseJson(lead.tags, []), notes: lead.notes, assigned_to: lead.assigned_to,
    created_at: lead.created_at, updated_at: lead.updated_at,
  };
}

/** Fire-and-forget so slow receivers never hold up the request that created the lead. */
function queueWebhooks(workspaceId, event, lead) {
  setImmediate(() => fireOutgoingWebhooks(workspaceId, event, webhookLeadPayload(lead)));
}

// ── Lead distribution (relay new leads to recipients) ──

function leadSummaryText(lead) {
  const lines = [
    `New lead: ${leadName(lead)}`,
    lead.phone && `Phone: ${lead.phone}`,
    lead.email && `Email: ${lead.email}`,
    lead.city && `City: ${lead.city}`,
    lead.budget && `Budget: ${lead.budget}`,
    lead.lead_source && `Source: ${lead.lead_source}`,
    lead.notes && `Notes: ${String(lead.notes).slice(0, 300)}`,
    `Open: ${config.webUrl || 'http://localhost:3000'}/app/leads/${lead.id}`,
  ];
  return lines.filter(Boolean).join('\n');
}

async function deliverToRecipient(workspaceId, lead, recipient) {
  const value = String(recipient.value || '').trim();
  if (!value) return { ok: false, error: 'empty recipient' };
  const text = leadSummaryText(lead);

  if (recipient.type === 'team_member') {
    const user = await resolveUser(workspaceId, value);
    if (!user) return { ok: false, error: `team member not found: ${value}` };
    let updated = lead;
    if (!lead.assigned_to) updated = await assignLead(workspaceId, lead, user.id, 'distribution');
    await sendPushNotification(user.id, 'New lead for you', `${leadName(lead)}${lead.lead_source ? ` · ${lead.lead_source}` : ''}`, {
      type: 'new_lead', leadId: lead.id,
    });
    return { ok: true, lead: updated };
  }
  if (recipient.type === 'email') {
    const { sendEmail } = require('./emailService');
    const html = `<div style="font-family:Arial,sans-serif;font-size:14px;line-height:1.6">${text
      .split('\n').map((l) => l.replace(/&/g, '&amp;').replace(/</g, '&lt;')).join('<br>')}</div>`;
    const r = await sendEmail({ to: value, subject: `New lead: ${leadName(lead)}`, text, html, workspaceId: lead.workspace_id });
    return { ok: r.success, error: r.error };
  }
  if (recipient.type === 'whatsapp') {
    const { sendWhatsAppMessage } = require('./whatsappService');
    const r = await sendWhatsAppMessage({ to: value, message: text, workspaceId: lead.workspace_id });
    return { ok: r.success, error: r.error };
  }
  return { ok: false, error: `unknown recipient type ${recipient.type}` };
}

async function runDistribution(workspaceId, lead, { only = null } = {}) {
  const configs = await db.query(
    'SELECT * FROM lead_distribution_config WHERE workspace_id = $1 AND COALESCE(is_active, true) = true ORDER BY created_at ASC',
    [workspaceId]
  );
  let current = lead;
  let ran = false;
  for (const cfg of configs.rows) {
    if (only && cfg.id !== only) continue;
    const recipients = (parseJson(cfg.config, {})?.recipients || []).filter((r) => r && r.value);
    if (recipients.length === 0) continue;

    let targets = recipients;
    if (cfg.type === 'round_robin') {
      // Atomic pointer bump so concurrent leads never get the same slot.
      const bump = await db.query(
        `UPDATE lead_distribution_config
         SET config = jsonb_set(COALESCE(config, '{}'::jsonb), '{rr_index}',
                                to_jsonb(COALESCE((config->>'rr_index')::int, -1) + 1)),
             updated_at = NOW()
         WHERE id = $1 RETURNING (config->>'rr_index')::int AS idx`,
        [cfg.id]
      );
      targets = [recipients[(bump.rows[0]?.idx || 0) % recipients.length]];
    }

    const results = [];
    for (const recipient of targets) {
      try {
        const r = await deliverToRecipient(workspaceId, current, recipient);
        if (r.lead) current = r.lead;
        results.push({ type: recipient.type, value: recipient.value, ok: r.ok, error: r.error || undefined });
      } catch (err) {
        results.push({ type: recipient.type, value: recipient.value, ok: false, error: err.message });
      }
    }
    ran = true;
    await logActivity(workspaceId, lead.id, null, 'lead_distributed',
      `Lead distributed (${cfg.type === 'round_robin' ? 'round robin' : 'all recipients'})`, { distribution_id: cfg.id, results });
  }
  return { lead: current, ran };
}

// ── Automation rules ──

function ruleConditions(rule) {
  const c = parseJson(rule.conditions, null);
  if (Array.isArray(c) && c.length) return c;
  const legacy = parseJson(rule.trigger_config, {});
  return Array.isArray(legacy?.conditions) ? legacy.conditions : [];
}

function ruleActions(rule) {
  const a = parseJson(rule.actions, null);
  if (Array.isArray(a) && a.length) return a;
  const cfg = parseJson(rule.action_config, {}) || {};
  if (Array.isArray(cfg.actions) && cfg.actions.length) return cfg.actions;
  return rule.action_type ? [{ type: rule.action_type, value: cfg.value ?? cfg.user_id ?? cfg.tag ?? cfg.stage ?? '' }] : [];
}

function ruleSource(rule) {
  return rule.trigger_source || parseJson(rule.trigger_config, {})?.source || (rule.trigger_type !== 'new_lead' ? rule.trigger_type : 'any') || 'any';
}

function conditionMatches(cond, lead) {
  if (!cond || !cond.field) return true;
  const raw = cond.field === 'source' ? lead.lead_source : lead[cond.field];
  const actual = raw === null || raw === undefined ? '' : String(raw);
  const expected = cond.value === null || cond.value === undefined ? '' : String(cond.value);
  switch (cond.operator) {
    case 'equals': return actual.toLowerCase() === expected.toLowerCase();
    case 'not_equals': return actual.toLowerCase() !== expected.toLowerCase();
    case 'contains': return actual.toLowerCase().includes(expected.toLowerCase());
    case 'not_contains': return !actual.toLowerCase().includes(expected.toLowerCase());
    case 'greater_than': return actual !== '' && parseFloat(actual) > parseFloat(expected);
    case 'less_than': return actual !== '' && parseFloat(actual) < parseFloat(expected);
    case 'is_empty': return actual.trim() === '';
    case 'is_not_empty': return actual.trim() !== '';
    default: return false;
  }
}

function ruleMatches(rule, lead) {
  if (!sourceMatches(ruleSource(rule), lead.lead_source)) return false;
  // Rows with a blank value are unfinished UI rows — ignore them.
  const conditions = ruleConditions(rule).filter((c) => c && c.field && (c.value !== '' || /empty/.test(c.operator || '')));
  return conditions.every((c) => conditionMatches(c, lead));
}

async function applyRuleAction(workspaceId, lead, action, state) {
  const value = action.value;
  switch (action.type) {
    case 'assign_agent': {
      const user = await resolveUser(workspaceId, value);
      if (!user) return { lead, note: `agent not found: ${value}` };
      return { lead: await assignLead(workspaceId, lead, user.id, 'automation rule') };
    }
    case 'assign_best_fit': {
      const { pickBestFitAgent } = require('./intelOps');
      const pick = await pickBestFitAgent(workspaceId, lead);
      if (!pick.userId) return { lead, note: 'no agents' };
      return { lead: await assignLead(workspaceId, lead, pick.userId, `best fit: ${pick.reason}`) };
    }
    case 'assign_round_robin': {
      const agent = await pickRoundRobinAgent(workspaceId);
      return { lead: agent ? await assignLead(workspaceId, lead, agent, 'round robin rule') : lead };
    }
    case 'add_tag':
      return { lead: await addTag(workspaceId, lead, value) };
    case 'change_stage':
      return { lead: await changeStage(workspaceId, lead, value, null, 'automation rule') };
    case 'send_to_distribution': {
      const r = await runDistribution(workspaceId, lead, { only: value || null });
      state.distributed = state.distributed || r.ran;
      return { lead: r.lead };
    }
    case 'notify_managers':
    case 'notification': // legacy rules created before actions existed
      await notifyManagers(workspaceId, 'automation', value || 'New lead matched a rule', leadName(lead), { type: 'new_lead', leadId: lead.id });
      return { lead };
    case 'start_sequence': {
      const { startSequence } = require('../controllers/whatsappSequenceController');
      const r = await startSequence(workspaceId, value, lead.id);
      return { lead, note: r.started ? undefined : r.reason };
    }
    case 'send_whatsapp': {
      if (!lead.phone || !value) return { lead, note: 'no phone or message' };
      const { sendWhatsAppToLead } = require('./whatsappService');
      await sendWhatsAppToLead({ workspaceId, leadId: lead.id, userId: null, message: value });
      return { lead };
    }
    default:
      return { lead, note: `unknown action ${action.type}` };
  }
}

async function runAutomationRules(workspaceId, lead, state) {
  const rules = await db.query(
    'SELECT * FROM lead_automation_rules WHERE workspace_id = $1 AND COALESCE(is_enabled, true) = true ORDER BY priority ASC, created_at ASC',
    [workspaceId]
  );
  let current = lead;
  for (const rule of rules.rows) {
    if (!ruleMatches(rule, current)) continue;
    const applied = [];
    for (const action of ruleActions(rule)) {
      if (!action || !action.type) continue;
      try {
        const r = await applyRuleAction(workspaceId, current, action, state);
        current = r.lead || current;
        applied.push({ type: action.type, value: action.value, note: r.note });
      } catch (err) {
        applied.push({ type: action.type, value: action.value, error: err.message });
        logger.error(`Automation rule "${rule.name}" action ${action.type} failed:`, err.message);
      }
    }
    await logActivity(workspaceId, lead.id, null, 'automation_rule', `Automation rule applied: ${rule.name}`, { rule_id: rule.id, actions: applied });
  }
  return current;
}

// ── Public: new lead / updated lead ──

async function runNewLeadAutomations(workspaceId, lead, { actorId = null, notify = true } = {}) {
  let current = lead;
  const state = { distributed: false };

  try {
    current = await runAutomationRules(workspaceId, current, state);
  } catch (err) {
    logger.error('Automation rules error:', err.message);
  }

  if (!state.distributed) {
    try {
      current = (await runDistribution(workspaceId, current)).lead;
    } catch (err) {
      logger.error('Lead distribution error:', err.message);
    }
  }

  if (!current.assigned_to) {
    const probe = { ...current };
    const agent = (await pickDefaultAgent(workspaceId, probe)) || actorId;
    if (agent) current = await assignLead(workspaceId, current, agent, probe._routingReason ? `smart routing: ${probe._routingReason}` : 'auto-assignment', actorId);
  }

  if (notify && current.assigned_to && current.assigned_to !== actorId) {
    await sendPushNotification(current.assigned_to, 'New lead assigned', `${leadName(current)}${current.lead_source ? ` · ${current.lead_source}` : ''}`, {
      type: 'new_lead', leadId: current.id, source: current.lead_source,
    });
  }

  emitToWorkspace(workspaceId, 'lead:created', { leadId: current.id });
  queueWebhooks(workspaceId, 'new_lead', current);
  return current;
}

/**
 * Create a lead from any source.
 * opts.duplicateMode: 'workspace' (use workspace settings) | 'reject' | 'merge' | 'skip' | 'allow'
 * Returns { status: 'created' | 'merged' | 'duplicate' | 'skipped', lead, duplicate }
 */
async function createLead(workspaceId, input, opts = {}) {
  const {
    actorId = null, source, duplicateMode = 'workspace', notify = true,
    runAutomations = true, activityText,
  } = opts;

  const data = {
    first_name: input.first_name ? String(input.first_name).trim() : null,
    last_name: input.last_name ? String(input.last_name).trim() : null,
    phone: input.phone ? String(input.phone).trim() : null,
    email: input.email ? String(input.email).trim().toLowerCase() : null,
    city: input.city ? String(input.city).trim() : null,
    budget: input.budget !== undefined && input.budget !== null && input.budget !== '' && !isNaN(parseFloat(input.budget))
      ? parseFloat(input.budget) : null,
    lead_source: input.lead_source || source || 'manual',
    notes: input.notes || null,
    custom_fields: input.custom_fields || [],
    tags: normalizeTags(input.tags),
  };
  if (!data.first_name && input.name) {
    const parts = String(input.name).trim().split(/\s+/);
    data.first_name = parts[0];
    data.last_name = data.last_name || parts.slice(1).join(' ') || null;
  }
  if (!data.first_name) data.first_name = data.phone || data.email ? 'Unknown' : null;

  // Duplicate handling
  let mode = duplicateMode;
  let matchPhone = true;
  let matchEmail = true;
  if (mode === 'workspace') {
    const settings = await getWorkspaceSettings(workspaceId);
    mode = { warn: 'skip', auto_merge: 'merge' }[settings.duplicate_mode] || 'allow';
    matchPhone = settings.duplicate_match_phone !== false;
    matchEmail = settings.duplicate_match_email !== false;
  }
  if (mode !== 'allow' && (data.phone || data.email)) {
    const clauses = [];
    const params = [workspaceId];
    const phoneDigits = digitsOnly(data.phone);
    if (matchPhone && phoneDigits.length >= 7) {
      params.push(phoneDigits);
      clauses.push(`REGEXP_REPLACE(COALESCE(phone,''), '\\D', '', 'g') = $${params.length}`);
    }
    if (matchEmail && data.email) {
      params.push(data.email);
      clauses.push(`LOWER(email) = $${params.length}`);
    }
    if (clauses.length) {
      const dup = await db.query(
        `SELECT * FROM leads WHERE workspace_id = $1 AND (${clauses.join(' OR ')}) ORDER BY created_at ASC LIMIT 1`,
        params
      );
      const existing = dup.rows[0];
      if (existing) {
        if (mode === 'reject') return { status: 'duplicate', duplicate: existing };
        if (mode === 'skip') {
          logger.info(`Duplicate lead skipped (${data.lead_source}) for workspace ${workspaceId}`);
          return { status: 'skipped', duplicate: existing };
        }
        const merged = await mergeIntoExisting(workspaceId, existing, data, actorId);
        return { status: 'merged', lead: merged };
      }
    }
  }

  const stage = await resolveStage(workspaceId, input.stage);
  let assignedTo = null;
  if (input.assigned_to) {
    const user = await resolveUser(workspaceId, input.assigned_to);
    assignedTo = user?.id || null;
  }

  const result = await db.query(
    `INSERT INTO leads (workspace_id, first_name, last_name, phone, email, city, budget, lead_source, notes,
                        custom_fields, tags, stage, stage_id, assigned_to, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) RETURNING *`,
    [workspaceId, data.first_name, data.last_name, data.phone, data.email, data.city, data.budget, data.lead_source,
     data.notes, JSON.stringify(data.custom_fields), JSON.stringify(data.tags), stage.name, stage.id, assignedTo, actorId]
  );
  let lead = result.rows[0];
  await logActivity(workspaceId, lead.id, actorId, 'lead_created', activityText || `Lead captured from ${data.lead_source}`, { source: data.lead_source });

  if (runAutomations) {
    try {
      lead = await runNewLeadAutomations(workspaceId, lead, { actorId, notify });
    } catch (err) {
      logger.error('New lead automation error:', err.message);
    }
  }

  await updateLeadScore(lead.id);
  await cacheDelPattern(`leads:${workspaceId}:*`);
  return { status: 'created', lead: (await getLead(workspaceId, lead.id)) || lead };
}

async function mergeIntoExisting(workspaceId, existing, data, actorId) {
  const sets = [];
  const params = [];
  const fill = (field) => {
    if (data[field] !== null && data[field] !== undefined && data[field] !== '' && !existing[field]) {
      params.push(data[field]);
      sets.push(`${field} = $${params.length}`);
    }
  };
  ['first_name', 'last_name', 'email', 'phone', 'city', 'budget'].forEach(fill);
  if (data.notes) {
    params.push(data.notes);
    sets.push(`notes = CASE WHEN notes IS NULL OR notes = '' THEN $${params.length} ELSE notes || ' | ' || $${params.length} END`);
  }
  if (data.tags && data.tags.length) {
    params.push(JSON.stringify(data.tags));
    sets.push(`tags = (SELECT COALESCE(jsonb_agg(DISTINCT t), '[]'::jsonb)
                       FROM jsonb_array_elements_text(COALESCE(tags,'[]'::jsonb) || $${params.length}::jsonb) AS t)`);
  }
  sets.push('last_activity_at = NOW()', 'updated_at = NOW()');
  params.push(existing.id, workspaceId);
  const r = await db.query(
    `UPDATE leads SET ${sets.join(', ')} WHERE id = $${params.length - 1} AND workspace_id = $${params.length} RETURNING *`,
    params
  );
  await logActivity(workspaceId, existing.id, actorId, 'lead_merged',
    `Duplicate submission merged (source: ${data.lead_source || 'unknown'})`, { merged_source: data.lead_source });
  await updateLeadScore(existing.id);
  await cacheDelPattern(`leads:${workspaceId}:*`);
  if (existing.assigned_to) {
    await sendPushNotification(existing.assigned_to, 'Lead enquired again', `${leadName(existing)} submitted again via ${data.lead_source || 'a form'}`, {
      type: 'lead_resubmitted', leadId: existing.id,
    });
  }
  return r.rows[0] || existing;
}

/** Side effects after a lead is edited (manual edit, bulk action, flow step). */
async function onLeadUpdated(workspaceId, before, after, { actorId = null } = {}) {
  try {
    if (!before || !after) return;
    const stageChanged = String(before.stage || '').toLowerCase() !== String(after.stage || '').toLowerCase();
    if (stageChanged) {
      queueWebhooks(workspaceId, 'stage_changed', after);
      const stage = await db.query(
        'SELECT is_won, is_lost FROM lead_stages WHERE workspace_id = $1 AND (id = $2 OR LOWER(name) = LOWER($3)) LIMIT 1',
        [workspaceId, after.stage_id, after.stage || '']
      );
      const won = stage.rows[0]?.is_won || String(after.stage).toLowerCase() === 'won';
      const lost = stage.rows[0]?.is_lost || String(after.stage).toLowerCase() === 'lost';
      if (won) queueWebhooks(workspaceId, 'deal_won', after);
      if (won || lost) {
        const { onStageOutcome } = require('./intelOps');
        setImmediate(() => onStageOutcome(workspaceId, { ...after, stage: won ? 'won' : 'lost' }).catch(() => {}));
      }
      // Tell Meta which ad leads converted (only leads that came from Meta ads).
      if (won && /facebook|instagram|meta/i.test(String(after.lead_source || ''))) {
        const { sendLeadEvent } = require('./metaCapiService');
        setImmediate(() => sendLeadEvent(workspaceId, after, 'ConvertedLead', actorId));
      }
      if (lost) queueWebhooks(workspaceId, 'deal_lost', after);
    }
    if (after.assigned_to && after.assigned_to !== before.assigned_to && after.assigned_to !== actorId) {
      await sendPushNotification(after.assigned_to, 'Lead assigned to you', leadName(after), { type: 'lead_assigned', leadId: after.id });
    }
    queueWebhooks(workspaceId, 'lead_updated', after);
    emitToWorkspace(workspaceId, 'lead:updated', { leadId: after.id });
  } catch (err) {
    logger.error('Lead update hook error:', err.message);
  }
}

module.exports = {
  createLead,
  runNewLeadAutomations,
  onLeadUpdated,
  fireOutgoingWebhooks,
  runDistribution,
  ruleMatches,
  ruleActions,
  ruleConditions,
  normalizeTags,
  addTag,
  changeStage,
  assignLead,
  resolveUser,
  getLead,
  parseJson,
};
