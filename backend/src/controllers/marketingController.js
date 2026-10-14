const db = require('../config/database');
const logger = require('../utils/logger');
const { compileConditions, evaluateSegment } = require('../services/segmentService');
const { manualEnroll, parseGraph } = require('../services/flowEngine');
const { handleEmailEvent } = require('../services/emailService');
const { logActivity } = require('../utils/activityLog');

// ═══════════════════════════════ SEGMENTS ═══════════════════════════════

exports.getSegments = async (req, res, next) => {
  try {
    const result = await db.query(
      `SELECT s.*, u.first_name || ' ' || u.last_name AS creator_name
       FROM segments s LEFT JOIN users u ON s.created_by = u.id
       WHERE s.workspace_id = $1 ORDER BY s.created_at DESC`,
      [req.workspaceId]
    );
    const segments = [];
    for (const seg of result.rows) {
      let live_count = null;
      try {
        const { whereSql, params } = compileConditions(seg.conditions, seg.match_type, 2);
        const c = await db.query(
          `SELECT COUNT(*)::int AS count FROM leads l WHERE l.workspace_id = $1 ${whereSql ? 'AND ' : ''}${whereSql}`,
          [req.workspaceId, ...params]
        );
        live_count = c.rows[0].count;
      } catch (e) {
        live_count = null; // invalid condition set — surface as unknown, never fake
      }
      segments.push({ ...seg, live_count });
    }
    res.json({ segments });
  } catch (err) { next(err); }
};

exports.getSegment = async (req, res, next) => {
  try {
    const r = await db.query(
      'SELECT * FROM segments WHERE id = $1 AND workspace_id = $2',
      [req.params.id, req.workspaceId]
    );
    if (r.rows.length === 0) return res.status(404).json({ error: 'Segment not found' });

    const { count, leads } = await evaluateSegment(req.workspaceId, r.rows[0], { limit: 50 });
    res.json({
      segment: r.rows[0],
      count,
      sample: leads.map((l) => ({
        id: l.id, first_name: l.first_name, last_name: l.last_name,
        email: l.email, stage: l.stage, lead_source: l.lead_source,
      })),
    });
  } catch (err) { next(err); }
};

function validateSegmentBody(body) {
  if (!body.name || !String(body.name).trim()) return 'Name is required';
  if (body.conditions !== undefined && !Array.isArray(body.conditions)) return 'Conditions must be an array';
  if (body.match_type && !['all', 'any'].includes(body.match_type)) return "match_type must be 'all' or 'any'";
  return null;
}

exports.createSegment = async (req, res, next) => {
  try {
    const invalid = validateSegmentBody(req.body);
    if (invalid) return res.status(400).json({ error: invalid });
    const { name, description, match_type, conditions } = req.body;
    const r = await db.query(
      `INSERT INTO segments (workspace_id, name, description, match_type, conditions, created_by)
       VALUES ($1,$2,$3,$4,$5::jsonb,$6) RETURNING *`,
      [req.workspaceId, name.trim(), description || null, match_type || 'all',
       JSON.stringify(conditions || []), req.user.id]
    );
    res.json({ segment: r.rows[0] });
  } catch (err) { next(err); }
};

exports.updateSegment = async (req, res, next) => {
  try {
    const invalid = validateSegmentBody(req.body);
    if (invalid) return res.status(400).json({ error: invalid });
    const { name, description, match_type, conditions } = req.body;
    const r = await db.query(
      `UPDATE segments SET name = $3, description = $4, match_type = $5,
              conditions = $6::jsonb, updated_at = NOW()
       WHERE id = $1 AND workspace_id = $2 RETURNING *`,
      [req.params.id, req.workspaceId, name.trim(), description || null,
       match_type || 'all', JSON.stringify(conditions || [])]
    );
    if (r.rows.length === 0) return res.status(404).json({ error: 'Segment not found' });
    res.json({ segment: r.rows[0] });
  } catch (err) { next(err); }
};

exports.deleteSegment = async (req, res, next) => {
  try {
    const r = await db.query(
      'DELETE FROM segments WHERE id = $1 AND workspace_id = $2 RETURNING id',
      [req.params.id, req.workspaceId]
    );
    if (r.rows.length === 0) return res.status(404).json({ error: 'Segment not found' });
    res.json({ message: 'Segment deleted' });
  } catch (err) { next(err); }
};

/** Evaluate unsaved conditions — powers the live counter in the builder UI. */
exports.previewSegment = async (req, res, next) => {
  try {
    const { match_type, conditions } = req.body;
    const { count, leads } = await evaluateSegment(req.workspaceId,
      { match_type: match_type || 'all', conditions: conditions || [] }, { limit: 20 });
    res.json({
      count,
      sample: leads.map((l) => ({
        id: l.id, first_name: l.first_name, last_name: l.last_name,
        email: l.email, stage: l.stage, lead_source: l.lead_source,
      })),
    });
  } catch (err) { next(err); }
};

exports.getSegmentMembers = async (req, res, next) => {
  try {
    const limit = Math.min(500, Number(req.query.limit) || 100);
    const offset = Number(req.query.offset) || 0;
    const segRes = await db.query(
      'SELECT * FROM segments WHERE id = $1 AND workspace_id = $2',
      [req.params.id, req.workspaceId]
    );
    if (segRes.rows.length === 0) return res.status(404).json({ error: 'Segment not found' });
    const { count, leads } = await evaluateSegment(req.workspaceId, segRes.rows[0], { limit, offset });
    res.json({ count, members: leads });
  } catch (err) { next(err); }
};

// ═══════════════════════════════ FLOWS ═══════════════════════════════

async function flowWithCounts(wsId, flowRow) {
  const c = await db.query(
    `SELECT
       COUNT(*)::int AS entered,
       COUNT(*) FILTER (WHERE status = 'active')::int AS active,
       COUNT(*) FILTER (WHERE status = 'completed')::int AS completed,
       COUNT(*) FILTER (WHERE status = 'exited')::int AS exited
     FROM flow_enrollments WHERE flow_id = $1`,
    [flowRow.id]
  );
  return { ...flowRow, stats: c.rows[0] };
}

exports.getFlows = async (req, res, next) => {
  try {
    const r = await db.query(
      `SELECT f.*, u.first_name || ' ' || u.last_name AS creator_name
       FROM flows f LEFT JOIN users u ON f.created_by = u.id
       WHERE f.workspace_id = $1 ORDER BY f.updated_at DESC`,
      [req.workspaceId]
    );
    const flows = [];
    for (const flow of r.rows) flows.push(await flowWithCounts(req.workspaceId, flow));
    res.json({ flows });
  } catch (err) { next(err); }
};

exports.getFlow = async (req, res, next) => {
  try {
    const r = await db.query(
      'SELECT * FROM flows WHERE id = $1 AND workspace_id = $2',
      [req.params.id, req.workspaceId]
    );
    if (r.rows.length === 0) return res.status(404).json({ error: 'Flow not found' });
    res.json({ flow: await flowWithCounts(req.workspaceId, r.rows[0]) });
  } catch (err) { next(err); }
};

function validateTrigger(type, cfg) {
  switch (type) {
    case 'lead_created':
    case 'manual':
      return null;
    case 'stage_entered':
      return cfg?.stage ? null : 'stage is required';
    case 'segment_entered':
      return cfg?.segment_id ? null : 'segment_id is required';
    case 'tagged_with':
      return cfg?.tag ? null : 'tag is required';
    case 'days_inactive':
      return cfg?.days !== undefined ? null : 'days is required';
    case 'source_is':
      return cfg?.source ? null : 'source is required';
    default:
      return 'Unknown trigger type';
  }
}

exports.createFlow = async (req, res, next) => {
  try {
    const { name, description, trigger_type, trigger_config, graph } = req.body;
    if (!name || !String(name).trim()) return res.status(400).json({ error: 'Name is required' });
    const trigErr = validateTrigger(trigger_type || 'manual', trigger_config);
    if (trigErr) return res.status(400).json({ error: trigErr });

    const g = graph || { nodes: [], edges: [] };
    const r = await db.query(
      `INSERT INTO flows (workspace_id, name, description, trigger_type, trigger_config, graph, created_by)
       VALUES ($1,$2,$3,$4,$5::jsonb,$6::jsonb,$7) RETURNING *`,
      [req.workspaceId, name.trim(), description || null, trigger_type || 'manual',
       JSON.stringify(trigger_config || {}), JSON.stringify(g), req.user.id]
    );
    res.json({ flow: r.rows[0] });
  } catch (err) { next(err); }
};

exports.updateFlow = async (req, res, next) => {
  try {
    const existing = await db.query(
      'SELECT * FROM flows WHERE id = $1 AND workspace_id = $2',
      [req.params.id, req.workspaceId]
    );
    if (existing.rows.length === 0) return res.status(404).json({ error: 'Flow not found' });

    const { name, description, trigger_type, trigger_config, graph } = req.body;
    const flow = existing.rows[0];
    const nextTriggerType = trigger_type ?? flow.trigger_type;
    const nextTriggerConfig = trigger_config ?? flow.trigger_config;
    if (trigger_type !== undefined || trigger_config !== undefined) {
      const trigErr = validateTrigger(nextTriggerType, nextTriggerConfig);
      if (trigErr) return res.status(400).json({ error: trigErr });
    }

    const r = await db.query(
      `UPDATE flows SET
         name = COALESCE($3, name),
         description = COALESCE($4, description),
         trigger_type = $5,
         trigger_config = $6::jsonb,
         graph = COALESCE($7::jsonb, graph),
         updated_at = NOW()
       WHERE id = $1 AND workspace_id = $2 RETURNING *`,
      [req.params.id, req.workspaceId,
       name?.trim() || null, description !== undefined ? description : null,
       nextTriggerType, JSON.stringify(nextTriggerConfig || {}),
       graph ? JSON.stringify(graph) : null]
    );
    res.json({ flow: r.rows[0] });
  } catch (err) { next(err); }
};

exports.setFlowStatus = async (req, res, next) => {
  try {
    const { status } = req.body;
    if (!['draft', 'live', 'paused'].includes(status)) {
      return res.status(400).json({ error: "status must be draft | live | paused" });
    }
    const existing = await db.query(
      'SELECT * FROM flows WHERE id = $1 AND workspace_id = $2',
      [req.params.id, req.workspaceId]
    );
    if (existing.rows.length === 0) return res.status(404).json({ error: 'Flow not found' });

    if (status === 'live') {
      const graph = parseGraph(existing.rows[0]);
      if (!graph.nodes.some((n) => n.type !== 'trigger')) {
        return res.status(400).json({ error: 'Add at least one step before going live' });
      }
      const tErr = validateTrigger(existing.rows[0].trigger_type || 'manual', existing.rows[0].trigger_config);
      if (tErr) return res.status(400).json({ error: `Trigger incomplete: ${tErr}` });
    }

    // Compute live_since in JS — a param used as both varchar and in CASE
    // makes Postgres refuse to deduce its type ("inconsistent types").
    const prev = existing.rows[0].live_since;
    const liveSince = status === 'live' ? (prev || new Date()) : prev;

    const r = await db.query(
      `UPDATE flows SET status = $3, live_since = $4, updated_at = NOW()
       WHERE id = $1 AND workspace_id = $2 RETURNING *`,
      [req.params.id, req.workspaceId, status, liveSince]
    );
    res.json({ flow: r.rows[0] });
  } catch (err) { next(err); }
};

exports.deleteFlow = async (req, res, next) => {
  try {
    const r = await db.query(
      'DELETE FROM flows WHERE id = $1 AND workspace_id = $2 RETURNING id',
      [req.params.id, req.workspaceId]
    );
    if (r.rows.length === 0) return res.status(404).json({ error: 'Flow not found' });
    res.json({ message: 'Flow deleted' });
  } catch (err) { next(err); }
};

exports.enrollInFlow = async (req, res, next) => {
  try {
    const { lead_ids } = req.body;
    const result = await manualEnroll(req.workspaceId, req.params.id, lead_ids);
    if (result.error) return res.status(400).json(result);
    res.json({ enrolled: result.enrolled });
  } catch (err) { next(err); }
};

exports.getFlowEnrollments = async (req, res, next) => {
  try {
    const limit = Math.min(200, Number(req.query.limit) || 100);
    const r = await db.query(
      `SELECT fe.*, l.first_name, l.last_name, l.email, l.stage AS current_stage
       FROM flow_enrollments fe
       JOIN leads l ON l.id = fe.lead_id
       WHERE fe.flow_id = $1 AND fe.workspace_id = $2
       ORDER BY fe.entered_at DESC LIMIT ${limit}`,
      [req.params.id, req.workspaceId]
    );
    res.json({ enrollments: r.rows });
  } catch (err) { next(err); }
};

exports.getFlowAnalytics = async (req, res, next) => {
  try {
    const flowId = req.params.id;
    const wsId = req.workspaceId;
    const flow = await db.query(
      'SELECT id, name FROM flows WHERE id = $1 AND workspace_id = $2',
      [flowId, wsId]
    );
    if (flow.rows.length === 0) return res.status(404).json({ error: 'Flow not found' });

    const totals = await db.query(
      `SELECT
         COUNT(*)::int AS entered,
         COUNT(*) FILTER (WHERE status = 'active')::int AS active,
         COUNT(*) FILTER (WHERE status = 'completed')::int AS completed,
         COUNT(*) FILTER (WHERE status = 'exited')::int AS exited
       FROM flow_enrollments WHERE flow_id = $1`,
      [flowId]
    );

    const exits = await db.query(
      `SELECT exit_reason, COUNT(*)::int AS count FROM flow_enrollments
       WHERE flow_id = $1 AND status = 'exited' GROUP BY exit_reason ORDER BY count DESC`,
      [flowId]
    );

    const steps = await db.query(
      `SELECT node_key, action_type, status, COUNT(*)::int AS count
       FROM flow_action_log WHERE flow_id = $1 AND node_key NOT IN ('__entry__')
       GROUP BY node_key, action_type, status ORDER BY node_key`,
      [flowId]
    );

    const emailStats = await db.query(
      `SELECT COUNT(*)::int AS sent,
              COUNT(opened_at)::int AS opened,
              COUNT(clicked_at)::int AS clicked
       FROM emails WHERE flow_id = $1 AND source = 'flow'`,
      [flowId]
    );

    // Conversion = enrolled leads that reached a Won state.
    // Attributed value = those leads' budget figures (the only deal-value data
    // stored anywhere in this codebase) — reported honestly as budget, not revenue.
    const conversions = await db.query(
      `SELECT COUNT(*)::int AS won_leads, COALESCE(SUM(l.budget), 0) AS attributed_value
       FROM flow_enrollments fe
       JOIN leads l ON l.id = fe.lead_id
       LEFT JOIN lead_stages s ON s.id = l.stage_id
       WHERE fe.flow_id = $1 AND (s.is_won = TRUE OR LOWER(l.stage) = 'won')`,
      [flowId]
    );

    res.json({
      flow: flow.rows[0],
      totals: totals.rows[0],
      exits: exits.rows,
      steps: steps.rows,
      emails: emailStats.rows[0],
      conversion: {
        ...conversions.rows[0],
        value_basis: 'lead_budget',
        note: 'Attributed value sums the budget of enrolled leads currently in Won. Deal/revenue amounts are not tracked elsewhere in this product.',
      },
    });
  } catch (err) { next(err); }
};

// ═══════════════════════ BUILDER EMAIL DOCUMENTS ═══════════════════════

exports.getEmails = async (req, res, next) => {
  try {
    const r = await db.query(
      `SELECT me.id, me.name, me.subject, me.html, me.created_at, me.updated_at,
              u.first_name || ' ' || u.last_name AS creator_name
       FROM marketing_emails me LEFT JOIN users u ON me.created_by = u.id
       WHERE me.workspace_id = $1 ORDER BY me.updated_at DESC`,
      [req.workspaceId]
    );
    res.json({ emails: r.rows });
  } catch (err) { next(err); }
};

exports.getEmail = async (req, res, next) => {
  try {
    const r = await db.query(
      'SELECT * FROM marketing_emails WHERE id = $1 AND workspace_id = $2',
      [req.params.id, req.workspaceId]
    );
    if (r.rows.length === 0) return res.status(404).json({ error: 'Email not found' });
    res.json({ email: r.rows[0] });
  } catch (err) { next(err); }
};

exports.createEmail = async (req, res, next) => {
  try {
    const { name, subject, design, html } = req.body;
    if (!name || !String(name).trim()) return res.status(400).json({ error: 'Name is required' });
    const r = await db.query(
      `INSERT INTO marketing_emails (workspace_id, name, subject, design, html, created_by)
       VALUES ($1,$2,$3,$4::jsonb,$5,$6) RETURNING *`,
      [req.workspaceId, name.trim(), subject || '', JSON.stringify(design || []),
       html || '', req.user.id]
    );
    res.json({ email: r.rows[0] });
  } catch (err) { next(err); }
};

exports.updateEmail = async (req, res, next) => {
  try {
    const { name, subject, design, html } = req.body;
    const r = await db.query(
      `UPDATE marketing_emails SET
         name = COALESCE($3, name),
         subject = COALESCE($4, subject),
         design = COALESCE($5::jsonb, design),
         html = COALESCE($6, html),
         updated_at = NOW()
       WHERE id = $1 AND workspace_id = $2 RETURNING *`,
      [req.params.id, req.workspaceId,
       name?.trim() || null, subject ?? null,
       design ? JSON.stringify(design) : null, html ?? null]
    );
    if (r.rows.length === 0) return res.status(404).json({ error: 'Email not found' });
    res.json({ email: r.rows[0] });
  } catch (err) { next(err); }
};

exports.deleteEmail = async (req, res, next) => {
  try {
    const r = await db.query(
      'DELETE FROM marketing_emails WHERE id = $1 AND workspace_id = $2 RETURNING id',
      [req.params.id, req.workspaceId]
    );
    if (r.rows.length === 0) return res.status(404).json({ error: 'Email not found' });
    res.json({ message: 'Email deleted' });
  } catch (err) { next(err); }
};

// ═════════════════ MARKETING OVERVIEW ANALYTICS ═════════════════

exports.getOverview = async (req, res, next) => {
  try {
    const wsId = req.workspaceId;

    const flows = await db.query(
      `SELECT COUNT(*)::int AS total,
              COUNT(*) FILTER (WHERE status = 'live')::int AS live
       FROM flows WHERE workspace_id = $1`, [wsId]);

    const enrollments = await db.query(
      `SELECT COUNT(*)::int AS entered,
              COUNT(*) FILTER (WHERE status = 'active')::int AS active,
              COUNT(*) FILTER (WHERE status = 'completed')::int AS completed,
              COUNT(*) FILTER (WHERE status = 'exited')::int AS exited
       FROM flow_enrollments WHERE workspace_id = $1`, [wsId]);

    const campaigns = await db.query(
      `SELECT COUNT(*)::int AS total,
              COUNT(*) FILTER (WHERE status = 'sending')::int AS sending,
              COUNT(*) FILTER (WHERE status = 'scheduled')::int AS scheduled
       FROM campaigns WHERE workspace_id = $1 AND channel = 'email'`, [wsId]);

    const emailStats = await db.query(
      `SELECT COUNT(*)::int AS sent,
              COUNT(*) FILTER (WHERE opened_at IS NOT NULL)::int AS opened,
              COUNT(*) FILTER (WHERE clicked_at IS NOT NULL)::int AS clicked
       FROM emails WHERE workspace_id = $1 AND source IN ('campaign','flow','direct')`, [wsId]);

    const segmentsCount = await db.query(
      'SELECT COUNT(*)::int AS total FROM segments WHERE workspace_id = $1', [wsId]);

    res.json({
      flows: flows.rows[0],
      enrollments: enrollments.rows[0],
      campaigns: campaigns.rows[0],
      emails: emailStats.rows[0],
      segments: segmentsCount.rows[0],
    });
  } catch (err) { next(err); }
};

// ═══════════════ PUBLIC TRACKING ENDPOINTS (no auth) ═══════════════

const PIXEL_GIF = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');

/** GET /api/marketing/track/open/:trackingId */
exports.trackOpen = async (req, res) => {
  try {
    await handleEmailEvent({ tracking_id: req.params.trackingId, event: 'open' });
  } catch (err) {
    logger.error('trackOpen error:', err.message);
  }
  res.writeHead(200, {
    'Content-Type': 'image/gif',
    'Content-Length': PIXEL_GIF.length,
    'Cache-Control': 'no-store, no-cache, must-revalidate, private',
  });
  res.end(PIXEL_GIF);
};

/** GET /api/marketing/track/click/:trackingId?url=<destination> */
exports.trackClick = async (req, res) => {
  const target = String(req.query.url || '');
  try {
    const parsed = new URL(target);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') throw new Error('bad protocol');
    await handleEmailEvent({ tracking_id: req.params.trackingId, event: 'click' }).catch(() => {});
    res.redirect(302, target);
  } catch (err) {
    res.status(400).send('Invalid link');
  }
};

function unsubscribePage(title, text, action) {
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex"><title>${title}</title></head>
<body style="margin:0;font-family:-apple-system,'Segoe UI',Arial,sans-serif;background:#F3F1EC;display:flex;align-items:center;justify-content:center;min-height:100vh;">
<div style="max-width:420px;padding:40px;text-align:center;">
<h1 style="font-size:22px;color:#16150F;margin:0 0 12px;">${title}</h1>
<p style="font-size:15px;color:#6b6560;line-height:1.6;">${text}</p>
${action ? `<form method="POST" action="${action}"><button type="submit" style="margin-top:16px;padding:12px 22px;border:0;border-radius:8px;background:#16150F;color:#fff;font-size:15px;cursor:pointer;">Unsubscribe</button></form>` : ''}
</div></body></html>`;
}

async function unsubscribeByTracking(trackingId) {
  const r = await db.query('SELECT lead_id, workspace_id FROM emails WHERE tracking_pixel_id = $1', [trackingId]);
  const row = r.rows[0];
  if (!row?.lead_id) return false;
  const upd = await db.query('UPDATE leads SET is_unsubscribed = true, updated_at = NOW() WHERE id = $1 AND COALESCE(is_unsubscribed, false) = false RETURNING id', [row.lead_id]);
  if (upd.rows.length) {
    await logActivity(row.workspace_id, row.lead_id, null, 'unsubscribed', 'Unsubscribed from marketing emails', { tracking_id: trackingId }).catch(() => {});
  }
  return true;
}

/**
 * GET /api/marketing/unsubscribe/:trackingId: confirmation page. Link scanners in
 * corporate inboxes open every URL, so a plain GET must never unsubscribe anyone.
 */
exports.unsubscribe = async (req, res) => {
  const id = encodeURIComponent(req.params.trackingId);
  res.status(200).type('html').send(unsubscribePage(
    'Unsubscribe from these emails?',
    'You will stop receiving marketing emails from us. You can still reply or contact us at any time.',
    `/api/marketing/unsubscribe/${id}`
  ));
};

/** POST /api/marketing/unsubscribe/:trackingId: the button above, and mail-client one-click (RFC 8058). */
exports.unsubscribeConfirm = async (req, res) => {
  try {
    await unsubscribeByTracking(req.params.trackingId);
  } catch (err) {
    logger.error('unsubscribe error:', err.message);
  }
  res.status(200).type('html').send(unsubscribePage("You're unsubscribed", "You won't receive any more marketing emails. We're sorry to see you go."));
};

/**
 * POST /api/marketing/webhooks/sendgrid
 * Receives SendGrid Event Webhook payloads (array of events).
 * NOTE: signature verification requires configuring SendGrid's signed-webhook
 * ECDSA public key — flagged in delivery notes. Events are matched by the
 * custom_args.tracking_id we stamp onto every tracked send.
 */
exports.sendgridWebhook = async (req, res) => {
  try {
    const events = Array.isArray(req.body) ? req.body : [req.body];
    for (const ev of events) {
      const trackingId = ev.tracking_id || ev.custom_args?.tracking_id;
      if (!trackingId) continue;
      await handleEmailEvent({
        tracking_id: trackingId,
        event: ev.event,
        timestamp: ev.timestamp,
        reason: ev.reason,
      });
    }
  } catch (err) {
    logger.error('SendGrid webhook error:', err.message);
  }
  res.status(204).end();
};
