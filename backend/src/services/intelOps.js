const db = require('../config/database');
const logger = require('../utils/logger');
const intel = require('./intelligence');
const { logActivity } = require('../utils/activityLog');
const { sendPushNotification, notifyManagers } = require('../utils/notifications');

/* ═══════════════════════════════════════════════════════════════
   INTELLIGENCE OPERATIONS — things that run across many leads:
   smart routing, ad spend → revenue, reactivation radar, ghost
   warnings, pre-call briefs, won-deal feedback, sentiment board.
   ═══════════════════════════════════════════════════════════════ */

const SELLER_ROLES = ['sales_agent', 'sales_manager', 'admin', 'super_admin'];
const band = (b) => { const n = Number(b) || 0; return n <= 0 ? 'unknown' : n < 10000 ? 'small' : n < 100000 ? 'medium' : n < 1000000 ? 'large' : 'xl'; };
const rate = (w, c) => (w + 1) / (c + 2);

// ── 8. Smart lead routing ──────────────────────────────────────────────────

async function agentStats(workspaceId) {
  const agents = await db.query(
    `SELECT id, first_name, last_name, role FROM users WHERE workspace_id = $1 AND status = 'active' AND role = 'sales_agent'`, [workspaceId]);
  const pool = agents.rows.length ? agents.rows : (await db.query(
    `SELECT id, first_name, last_name, role FROM users WHERE workspace_id = $1 AND status = 'active' AND role = ANY($2)`, [workspaceId, SELLER_ROLES])).rows;
  const leads = await db.query(
    `SELECT assigned_to, lead_source, budget, stage FROM leads WHERE workspace_id = $1 AND assigned_to = ANY($2::uuid[])`,
    [workspaceId, pool.map((a) => a.id)]);
  return pool.map((a) => {
    const mine = leads.rows.filter((l) => l.assigned_to === a.id);
    const closed = mine.filter((l) => ['won', 'lost'].includes(l.stage));
    const bySource = {};
    for (const l of closed) {
      const k = l.lead_source || 'unknown';
      bySource[k] = bySource[k] || { won: 0, closed: 0 };
      bySource[k].closed += 1;
      if (l.stage === 'won') bySource[k].won += 1;
    }
    return {
      id: a.id, name: [a.first_name, a.last_name].filter(Boolean).join(' '), role: a.role,
      open: mine.filter((l) => !['won', 'lost'].includes(l.stage)).length,
      won: closed.filter((l) => l.stage === 'won').length, closed: closed.length,
      win_rate: closed.length ? Math.round((closed.filter((l) => l.stage === 'won').length / closed.length) * 100) : null,
      by_source: bySource, _closed: closed,
    };
  });
}

async function pickBestFitAgent(workspaceId, lead) {
  const stats = await agentStats(workspaceId);
  if (!stats.length) return { userId: null };
  if (stats.reduce((a, s) => a + s.closed, 0) < 5) {
    const least = [...stats].sort((a, b) => a.open - b.open)[0];
    return { userId: least.id, reason: 'Not enough closed deals yet to compare agents, so the least busy agent was picked' };
  }
  const avgOpen = stats.reduce((a, s) => a + s.open, 0) / stats.length;
  const scored = stats.map((s) => {
    const src = s._closed.filter((l) => l.lead_source === lead.lead_source);
    const bnd = s._closed.filter((l) => band(l.budget) === band(lead.budget));
    const r = 0.5 * rate(src.filter((l) => l.stage === 'won').length, src.length)
      + 0.2 * rate(bnd.filter((l) => l.stage === 'won').length, bnd.length)
      + 0.3 * rate(s.won, s.closed)
      - 0.08 * (s.open / (avgOpen + 1));
    return { s, r, srcWon: src.filter((l) => l.stage === 'won').length, srcClosed: src.length };
  }).sort((a, b) => b.r - a.r);
  const top = scored[0];
  const reason = top.srcClosed >= 2
    ? `${top.s.name} has won ${top.srcWon} of ${top.srcClosed} ${String(lead.lead_source || '').replace(/_/g, ' ')} leads`
    : `${top.s.name} has the best overall win rate (${top.s.win_rate ?? 0}%)`;
  return { userId: top.s.id, reason, score: Math.round(top.r * 100) / 100 };
}

// ── 5. Ad spend quality loop ───────────────────────────────────────────────

async function adQuality(workspaceId, { months = 3 } = {}) {
  const from = new Date();
  from.setMonth(from.getMonth() - (months - 1), 1);
  from.setHours(0, 0, 0, 0);
  const leads = await db.query(
    `SELECT COALESCE(l.lead_source, 'unknown') AS source,
            COALESCE((SELECT f->>'value' FROM jsonb_array_elements(CASE WHEN jsonb_typeof(l.custom_fields) = 'array' THEN l.custom_fields ELSE '[]'::jsonb END) f
                      WHERE f->>'name' IN ('Facebook campaign','Google campaign','TikTok campaign','LinkedIn campaign','Campaign','utm_campaign') LIMIT 1), '') AS campaign,
            COUNT(*)::int AS leads,
            COUNT(*) FILTER (WHERE l.stage = 'won')::int AS won,
            COUNT(*) FILTER (WHERE l.stage IN ('interested','negotiating','qualified','proposal','won'))::int AS qualified,
            COALESCE(SUM(COALESCE(l.deal_value, l.budget)) FILTER (WHERE l.stage = 'won'), 0)::float AS revenue
     FROM leads l WHERE l.workspace_id = $1 AND l.created_at >= $2
     GROUP BY 1, 2`, [workspaceId, from]);
  const spend = await db.query(
    'SELECT source, campaign, SUM(amount)::float AS spend FROM ad_spend WHERE workspace_id = $1 AND month >= $2 GROUP BY 1, 2', [workspaceId, from]);
  const key = (s, c) => `${s}::${c || ''}`;
  const rows = {};
  for (const r of leads.rows) rows[key(r.source, r.campaign)] = { ...r, spend: 0 };
  for (const s of spend.rows) {
    const k = key(s.source, s.campaign);
    rows[k] = rows[k] || { source: s.source, campaign: s.campaign, leads: 0, won: 0, qualified: 0, revenue: 0 };
    rows[k].spend = (rows[k].spend || 0) + Number(s.spend);
  }
  const list = Object.values(rows).map((r) => ({
    ...r,
    cost_per_lead: r.spend && r.leads ? Math.round(r.spend / r.leads) : null,
    cost_per_win: r.spend && r.won ? Math.round(r.spend / r.won) : null,
    roas: r.spend ? Math.round((r.revenue / r.spend) * 100) / 100 : null,
    close_rate: r.leads ? Math.round((r.won / r.leads) * 100) : 0,
  })).sort((a, b) => (b.revenue - a.revenue) || (b.leads - a.leads));
  const paid = list.filter((r) => r.spend > 0);
  const tips = [];
  if (paid.length >= 2) {
    const byRoas = [...paid].sort((a, b) => (b.roas || 0) - (a.roas || 0));
    const best = byRoas[0];
    const worst = byRoas[byRoas.length - 1];
    if ((best.roas || 0) > (worst.roas || 0)) {
      tips.push(`Move budget from ${label(worst)} (returns ${worst.roas || 0}× spend) to ${label(best)} (returns ${best.roas}× spend).`);
    }
  }
  for (const r of paid) {
    if (r.leads >= 10 && r.won === 0) tips.push(`${label(r)} brought ${r.leads} leads but no sales. Check targeting or the follow-up on these leads.`);
    if (r.cost_per_lead && r.won && r.roas >= 3) tips.push(`${label(r)} is a winner: every $1 spent returned $${r.roas}.`);
  }
  if (!paid.length) tips.push('Add what you spend on each campaign to see which ads make money, not just leads.');
  const totals = list.reduce((a, r) => ({ leads: a.leads + r.leads, won: a.won + r.won, revenue: a.revenue + r.revenue, spend: a.spend + (r.spend || 0) }), { leads: 0, won: 0, revenue: 0, spend: 0 });
  return { from: from.toISOString().slice(0, 10), rows: list, totals: { ...totals, roas: totals.spend ? Math.round((totals.revenue / totals.spend) * 100) / 100 : null }, tips };
}
function label(r) { return `${String(r.source).replace(/_/g, ' ')}${r.campaign ? ` "${r.campaign}"` : ''}`; }

// ── 7. Dead lead reactivation radar ────────────────────────────────────────

async function runReactivationRadar() {
  const lost = await db.query(
    `SELECT l.id, l.workspace_id FROM leads l
     WHERE l.stage = 'lost' AND l.updated_at > NOW() - INTERVAL '365 days'
       AND (EXISTS (SELECT 1 FROM whatsapp_messages m WHERE m.lead_id = l.id AND m.direction = 'inbound' AND m.created_at > l.updated_at - INTERVAL '1 day')
         OR EXISTS (SELECT 1 FROM emails e WHERE e.lead_id = l.id AND (e.opened_at > l.updated_at OR e.clicked_at > l.updated_at))
         OR EXISTS (SELECT 1 FROM engagement_sessions s WHERE s.lead_id = l.id AND s.last_seen_at > l.updated_at))
     LIMIT 300`);
  let flagged = 0;
  for (const row of lost.rows) {
    try {
      const ctx = await intel.loadContext(row.workspace_id, row.id);
      const sig = ctx && await intel.reactivationSignal(ctx);
      if (!sig) continue;
      const prev = intel.parseJson(ctx.lead.metadata, {}).reactivation;
      if (prev && prev.signals?.join('|') === sig.signals.join('|')) continue;
      await db.query(`UPDATE leads SET metadata = jsonb_set(COALESCE(metadata,'{}'::jsonb), '{reactivation}', $1::jsonb) WHERE id = $2`,
        [JSON.stringify({ ...sig, flagged_at: new Date().toISOString() }), row.id]);
      const name = intel.leadName(ctx.lead);
      await logActivity(row.workspace_id, row.id, null, 'reactivation_flag', `${name} is showing interest again: ${sig.signals[0]}`, sig);
      const title = `Worth another try: ${name}`;
      if (ctx.lead.assigned_to) await sendPushNotification(ctx.lead.assigned_to, title, sig.signals[0], { type: 'reactivation', leadId: row.id });
      else await notifyManagers(row.workspace_id, 'reactivation', title, sig.signals[0], { leadId: row.id });
      flagged += 1;
    } catch (err) { logger.error('Radar error:', err.message); }
  }
  return { checked: lost.rows.length, flagged };
}

// ── 10. Ghost predictor ────────────────────────────────────────────────────

async function runGhostWatch() {
  const cands = await db.query(
    `SELECT l.id, l.workspace_id, l.metadata FROM leads l
     WHERE l.stage IN ('contacted','interested','negotiating','qualified','proposal')
       AND (SELECT COUNT(*) FROM whatsapp_messages m WHERE m.lead_id = l.id AND m.direction = 'inbound') >= 2
       AND EXISTS (SELECT 1 FROM whatsapp_messages m WHERE m.lead_id = l.id AND m.created_at > NOW() - INTERVAL '10 days')
     LIMIT 300`);
  let warned = 0;
  for (const row of cands.rows) {
    try {
      const meta = intel.parseJson(row.metadata, {});
      if (meta.ghost_alert_at && Date.now() - new Date(meta.ghost_alert_at) < 48 * 3600000) continue;
      const ctx = await intel.loadContext(row.workspace_id, row.id);
      const g = intel.ghostRisk(ctx);
      if (g.level !== 'high' || g.hours_to_cold === null || g.hours_to_cold > 48) continue;
      await db.query(`UPDATE leads SET metadata = jsonb_set(COALESCE(metadata,'{}'::jsonb), '{ghost_alert_at}', to_jsonb($1::text)) WHERE id = $2`, [new Date().toISOString(), row.id]);
      const name = intel.leadName(ctx.lead);
      const body = `${g.reasons[0]}. Likely to go cold in about ${g.hours_to_cold}h. A quick call now usually saves it.`;
      await logActivity(row.workspace_id, row.id, null, 'ghost_warning', `Ghost warning: ${g.reasons.join('; ')}`, g);
      if (ctx.lead.assigned_to) await sendPushNotification(ctx.lead.assigned_to, `${name} is going quiet`, body, { type: 'ghost_warning', leadId: row.id });
      warned += 1;
    } catch (err) { logger.error('Ghost watch error:', err.message); }
  }
  return { checked: cands.rows.length, warned };
}

// ── 9. Pre-call meeting briefs ─────────────────────────────────────────────

async function runMeetingBriefs() {
  const due = await db.query(
    `SELECT f.id, f.workspace_id, f.lead_id, f.user_id, f.type, f.due_date, l.assigned_to
     FROM follow_ups f JOIN leads l ON l.id = f.lead_id
     WHERE f.status = 'pending' AND f.brief_sent_at IS NULL AND f.type IN ('call','meeting','visit')
       AND f.due_date BETWEEN NOW() AND NOW() + INTERVAL '60 minutes' LIMIT 50`);
  const { meetingBrief } = require('./aiFeatures');
  let sent = 0;
  for (const f of due.rows) {
    const claim = await db.query('UPDATE follow_ups SET brief_sent_at = NOW() WHERE id = $1 AND brief_sent_at IS NULL RETURNING id', [f.id]);
    if (!claim.rows.length) continue;
    try {
      const brief = await meetingBrief(f.workspace_id, f.lead_id);
      if (!brief) continue;
      await db.query('UPDATE follow_ups SET brief = $1 WHERE id = $2', [JSON.stringify(brief), f.id]);
      await db.query(
        `INSERT INTO deal_predictions (workspace_id, lead_id, lead_source, predicted, brief) SELECT $1, $2, lead_source, $3, $4 FROM leads WHERE id = $2
         ON CONFLICT (lead_id) DO UPDATE SET brief = EXCLUDED.brief, predicted = COALESCE(EXCLUDED.predicted, deal_predictions.predicted) WHERE deal_predictions.closed_at IS NULL`,
        [f.workspace_id, f.lead_id, brief.predicted_value || null, JSON.stringify({ likely_objection: brief.likely_objection, summary: brief.summary })]);
      const to = f.user_id || f.assigned_to;
      if (to) await sendPushNotification(to, `Brief for your ${f.type} at ${new Date(f.due_date).toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit' })}`,
        `${brief.summary} Likely objection: ${brief.likely_objection}.`, { type: 'meeting_brief', leadId: f.lead_id, followUpId: f.id });
      sent += 1;
    } catch (err) { logger.error('Brief error:', err.message); }
  }
  return { sent };
}

// ── 20. Won/lost feedback ──────────────────────────────────────────────────

async function onStageOutcome(workspaceId, lead) {
  const stage = String(lead.stage || '').toLowerCase();
  if (stage === 'won') {
    const actual = Number(lead.deal_value) || Number(lead.budget) || null;
    const p = (await db.query('SELECT * FROM deal_predictions WHERE lead_id = $1', [lead.id])).rows[0];
    if (!actual || !p?.predicted) return;
    await db.query('UPDATE deal_predictions SET actual = $1, closed_at = NOW() WHERE lead_id = $2', [actual, lead.id]);
    const diff = Math.round(((actual - Number(p.predicted)) / Number(p.predicted)) * 100);
    const brief = intel.parseJson(p.brief, null);
    await logActivity(workspaceId, lead.id, null, 'prediction_feedback',
      `Closed at ${actual.toLocaleString()} vs predicted ${Number(p.predicted).toLocaleString()} (${diff >= 0 ? '+' : ''}${diff}%). Future predictions for ${lead.lead_source || 'this source'} will adjust.`,
      { predicted: Number(p.predicted), actual, diff_pct: diff, brief_objection: brief?.likely_objection || null });
  } else if (stage === 'lost') {
    const { autopsy } = require('./aiFeatures');
    autopsy(workspaceId, lead.id).catch((err) => logger.error('Autopsy error:', err.message));
  }
}

// ── 16/17. Inbound message hooks + sentiment board ─────────────────────────

async function onInboundMessage(workspaceId, lead, text) {
  try {
    const ws = (await db.query('SELECT settings FROM workspaces WHERE id = $1', [workspaceId])).rows[0];
    const ctxLite = { messages: [{ direction: 'inbound', text, at: new Date() }], settings: intel.parseJson(ws?.settings, {}) };
    const hits = intel.competitorMentions(ctxLite);
    if (hits.length) {
      const name = intel.leadName(lead);
      await logActivity(workspaceId, lead.id, null, 'competitor_mentioned', `${name} mentioned ${hits[0].competitor}: "${text.slice(0, 120)}"`, { competitor: hits[0].competitor });
      const body = `Suggested reply: ${intel.COUNTERS.competitor}`;
      if (lead.assigned_to) await sendPushNotification(lead.assigned_to, `${name} mentioned ${hits[0].competitor}`, body, { type: 'competitor', leadId: lead.id });
    }
    const s = intel.sentimentOf(text);
    await db.query(
      `UPDATE leads SET metadata = jsonb_set(COALESCE(metadata,'{}'::jsonb), '{last_sentiment}', $1::jsonb) WHERE id = $2`,
      [JSON.stringify({ score: s, label: s > 0.3 ? 'positive' : s < -0.3 ? 'negative' : 'neutral', at: new Date().toISOString() }), lead.id]);
  } catch (err) { logger.error('Inbound intel error:', err.message); }
}

async function sentimentBoard(workspaceId, { userId = null } = {}) {
  const r = await db.query(
    `SELECT l.id, l.first_name, l.last_name, l.stage, l.assigned_to, u.first_name AS agent,
            json_agg(json_build_object('text', m.message_text, 'at', m.created_at) ORDER BY m.created_at) AS msgs,
            MAX(m.created_at) AS last_at
     FROM leads l JOIN whatsapp_messages m ON m.lead_id = l.id AND m.direction = 'inbound' AND m.created_at > NOW() - INTERVAL '14 days'
     LEFT JOIN users u ON u.id = l.assigned_to
     WHERE l.workspace_id = $1 AND ($2::uuid IS NULL OR l.assigned_to = $2)
     GROUP BY l.id, u.first_name ORDER BY MAX(m.created_at) DESC LIMIT 200`, [workspaceId, userId]);
  return r.rows.map((row) => {
    const ctx = { messages: (row.msgs || []).filter((m) => m.text).map((m) => ({ direction: 'inbound', text: m.text, at: new Date(m.at) })) };
    const s = intel.conversationSentiment(ctx);
    return { id: row.id, name: intel.leadName(row), stage: row.stage, agent: row.agent, last_at: row.last_at, ...s };
  }).sort((a, b) => a.score - b.score);
}

// ── Lists for the Insights page ────────────────────────────────────────────

async function riskBoard(workspaceId, { userId = null } = {}) {
  const leads = await db.query(
    `SELECT id FROM leads WHERE workspace_id = $1 AND stage IN ('contacted','interested','negotiating','qualified','proposal')
       AND ($2::uuid IS NULL OR assigned_to = $2) ORDER BY updated_at DESC LIMIT 120`, [workspaceId, userId]);
  const out = [];
  for (const { id } of leads.rows) {
    const ctx = await intel.loadContext(workspaceId, id);
    if (!ctx) continue;
    const s = intel.conversationSentiment(ctx);
    const g = intel.ghostRisk(ctx);
    const risk = intel.dealRisk(ctx, s, g);
    if (risk.score >= 25 || g.level === 'high') {
      out.push({ id, name: intel.leadName(ctx.lead), stage: ctx.lead.stage, budget: ctx.lead.budget, risk, ghost: g, agent: ctx.lead.agent_first_name });
    }
  }
  return out.sort((a, b) => b.risk.score - a.risk.score);
}

async function reactivationList(workspaceId) {
  const r = await db.query(
    `SELECT id, first_name, last_name, phone, metadata->'reactivation' AS reactivation FROM leads
     WHERE workspace_id = $1 AND stage = 'lost' AND metadata ? 'reactivation' ORDER BY (metadata->'reactivation'->>'flagged_at') DESC LIMIT 100`, [workspaceId]);
  return r.rows.map((x) => ({ id: x.id, name: intel.leadName(x), phone: x.phone, ...intel.parseJson(x.reactivation, {}) }));
}

async function predictionAccuracy(workspaceId) {
  const r = await db.query(
    `SELECT p.lead_source, p.predicted::float, p.actual::float, p.closed_at, l.first_name, l.last_name
     FROM deal_predictions p JOIN leads l ON l.id = p.lead_id
     WHERE p.workspace_id = $1 AND p.actual IS NOT NULL ORDER BY p.closed_at DESC LIMIT 100`, [workspaceId]);
  const errs = r.rows.map((x) => Math.abs(x.actual - x.predicted) / Math.max(1, x.actual));
  const cal = await intel.calibration(workspaceId, null);
  return {
    closed_with_prediction: r.rows.length,
    avg_error_pct: errs.length ? Math.round((errs.reduce((a, b) => a + b, 0) / errs.length) * 100) : null,
    calibration_factor: cal.factor, recent: r.rows.slice(0, 10).map((x) => ({ ...x, name: intel.leadName(x) })),
  };
}

module.exports = {
  pickBestFitAgent, agentStats, adQuality, runReactivationRadar, runGhostWatch, runMeetingBriefs,
  onStageOutcome, onInboundMessage, sentimentBoard, riskBoard, reactivationList, predictionAccuracy, band,
};
