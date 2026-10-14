const db = require('../config/database');
const logger = require('../utils/logger');
const { sendPushNotification } = require('../utils/notifications');
const { logActivity } = require('../utils/activityLog');

/* ═══════════════════════════════════════════════════════════════
   REQUEST AN UPDATE — a manager taps "Request an update" on a lead,
   the assigned member is notified and the lead shows an
   "Update requested" banner until that member logs real work
   (call, note, message, stage change, follow-up …). The database
   trigger in migration 020 closes the request; the job below tells
   the requester and reminds members who leave it hanging.
   Workspaces can also have Flazyn request updates automatically on
   assigned leads nobody has touched for N days.
   ═══════════════════════════════════════════════════════════════ */

const REMIND_AFTER_HOURS = 4;
const DEFAULT_AUTO_DAYS = 3;

const fullName = (r, prefix = '') =>
  [r[`${prefix}first_name`], r[`${prefix}last_name`]].filter(Boolean).join(' ').trim();

class RequestError extends Error {
  constructor(message, status = 400) { super(message); this.status = status; }
}

async function openFor(leadId, workspaceId = null) {
  const r = await db.query(
    `SELECT ur.*, l.assigned_to AS current_assignee, rq.first_name AS rq_first_name, rq.last_name AS rq_last_name,
            asg.first_name AS asg_first_name, asg.last_name AS asg_last_name
       FROM update_requests ur
       JOIN leads l ON l.id = ur.lead_id
       LEFT JOIN users rq ON rq.id = ur.requested_by
       LEFT JOIN users asg ON asg.id = COALESCE(l.assigned_to, ur.assigned_to)
      WHERE ur.lead_id = $1 AND ur.resolved_at IS NULL AND ($2::uuid IS NULL OR ur.workspace_id = $2)`, [leadId, workspaceId]);
  const row = r.rows[0];
  if (!row) return null;
  return {
    id: row.id, note: row.note, auto: row.auto, created_at: row.created_at, reminded_at: row.reminded_at,
    requested_by: row.requested_by, requested_by_name: row.auto ? 'Flazyn' : (fullName(row, 'rq_') || 'A teammate'),
    // The request follows the lead: if it was reassigned, the new owner owes the update.
    assigned_to: row.current_assignee || row.assigned_to, assigned_to_name: fullName(row, 'asg_') || null,
  };
}

async function notifyAssignee(row, leadName, requesterName, note, reminder = false) {
  const title = reminder ? `Still waiting: update on ${leadName}` : `Update requested: ${leadName}`;
  const body = row.auto
    ? `No calls, notes or messages on ${leadName} for a few days. Add a quick update.`
    : `${requesterName} asked for an update${note ? `: “${note}”` : '.'}`;
  await sendPushNotification(row.assigned_to, title, body, { type: 'update_requested', leadId: row.lead_id, lead_id: row.lead_id, request_id: row.id });
}

/** Manager action. Returns the open request (existing one if already open). */
async function requestUpdate({ workspaceId, leadId, user, note }) {
  const lead = (await db.query(
    'SELECT id, first_name, last_name, assigned_to FROM leads WHERE id = $1 AND workspace_id = $2', [leadId, workspaceId])).rows[0];
  if (!lead) throw new RequestError('Lead not found', 404);
  if (!lead.assigned_to) throw new RequestError('Assign this lead to someone first');
  if (lead.assigned_to === user.id) throw new RequestError('This lead is assigned to you');

  const cleanNote = String(note || '').trim().slice(0, 500) || null;
  const existing = await openFor(leadId);
  if (existing) return { request: existing, already: true };

  const row = (await db.query(
    `INSERT INTO update_requests (workspace_id, lead_id, requested_by, assigned_to, note)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [workspaceId, leadId, user.id, lead.assigned_to, cleanNote])).rows[0];

  const requesterName = [user.first_name || user.firstName, user.last_name || user.lastName].filter(Boolean).join(' ') || 'Your manager';
  const leadName = fullName(lead) || 'a lead';
  await logActivity(workspaceId, leadId, user.id, 'update_requested',
    `${requesterName} requested an update${cleanNote ? `: “${cleanNote}”` : ''}`, { request_id: row.id });
  await notifyAssignee(row, leadName, requesterName, cleanNote);
  return { request: await openFor(leadId), already: false };
}

/** Requester (or a manager) withdraws the request without an update. */
async function clearRequest({ workspaceId, leadId, user }) {
  const r = await db.query(
    `UPDATE update_requests SET resolved_at = NOW(), resolved_by = $3, resolved_type = 'cleared', resolved_notified_at = NOW()
      WHERE lead_id = $1 AND workspace_id = $2 AND resolved_at IS NULL RETURNING id`,
    [leadId, workspaceId, user.id]);
  if (r.rows[0]) await logActivity(workspaceId, leadId, user.id, 'update_request_cleared', 'Update request cleared', { request_id: r.rows[0].id });
  return r.rows.length > 0;
}

/** Lead ids with an open request, for list/board badges. */
async function openLeadIds(workspaceId) {
  const r = await db.query('SELECT lead_id FROM update_requests WHERE workspace_id = $1 AND resolved_at IS NULL', [workspaceId]);
  return r.rows.map((x) => x.lead_id);
}

// ── Scheduled work (every minute; the auto-request scan runs hourly) ──

async function notifyResolved() {
  const r = await db.query(
    `UPDATE update_requests ur SET resolved_notified_at = NOW()
      WHERE ur.resolved_at IS NOT NULL AND ur.resolved_notified_at IS NULL
      RETURNING ur.*`);
  for (const row of r.rows) {
    if (!row.requested_by || row.auto) continue;
    const info = (await db.query(
      `SELECT l.first_name, l.last_name, u.first_name AS u_first_name, u.last_name AS u_last_name
         FROM leads l LEFT JOIN users u ON u.id = $2 WHERE l.id = $1`, [row.lead_id, row.resolved_by])).rows[0];
    if (!info) continue;
    const who = fullName(info, 'u_') || 'Your teammate';
    const what = String(row.resolved_type || 'update').replace(/_/g, ' ');
    await sendPushNotification(row.requested_by, `${fullName(info) || 'Lead'} was updated`,
      `${who} added an update (${what})${row.resolved_note ? `: ${row.resolved_note.slice(0, 120)}` : ''}`,
      { type: 'update_received', leadId: row.lead_id, lead_id: row.lead_id, request_id: row.id });
  }
}

async function remindStale() {
  const r = await db.query(
    `UPDATE update_requests ur SET reminded_at = NOW(), assigned_to = COALESCE(l.assigned_to, ur.assigned_to)
       FROM leads l
      WHERE l.id = ur.lead_id AND ur.resolved_at IS NULL AND ur.reminded_at IS NULL AND ur.created_at < NOW() - ($1 || ' hours')::interval
      RETURNING ur.*, l.first_name, l.last_name`, [String(REMIND_AFTER_HOURS)]);
  for (const row of r.rows) {
    if (!row.assigned_to) continue;
    await notifyAssignee(row, fullName(row) || 'a lead', null, row.note, true);
  }
}

/**
 * Hassan's rule: if the assigned member hasn't called, messaged, noted or
 * moved a lead for N days, Flazyn asks for an update by itself.
 * settings.auto_update_request_days: number of days, 0 = off (default 3).
 */
async function autoRequestStale() {
  const workspaces = await db.query(
    `SELECT id, COALESCE(NULLIF(settings->>'auto_update_request_days', '')::int, $1) AS days
       FROM workspaces WHERE COALESCE(settings->>'demo', 'false') <> 'true'`, [DEFAULT_AUTO_DAYS]);
  let created = 0;
  for (const ws of workspaces.rows) {
    if (!ws.days || ws.days <= 0) continue;
    const stale = await db.query(
      `SELECT l.id, l.assigned_to, l.first_name, l.last_name FROM leads l
        WHERE l.workspace_id = $1 AND l.assigned_to IS NOT NULL
          AND LOWER(COALESCE(l.stage, '')) NOT IN ('won', 'lost')
          AND l.created_at < NOW() - ($2 || ' days')::interval
          AND NOT EXISTS (SELECT 1 FROM update_requests ur WHERE ur.lead_id = l.id
                            AND (ur.resolved_at IS NULL OR ur.created_at > NOW() - ($2 || ' days')::interval))
          AND NOT EXISTS (SELECT 1 FROM lead_activities a WHERE a.lead_id = l.id AND a.user_id IS NOT NULL
                            AND a.type NOT IN ('lead_assigned','lead_transfer','lead_distributed','bulk_action','lead_merged','update_requested','update_request_cleared')
                            AND a.created_at > NOW() - ($2 || ' days')::interval)
        ORDER BY l.created_at ASC LIMIT 25`, [ws.id, String(ws.days)]);
    for (const lead of stale.rows) {
      const row = (await db.query(
        `INSERT INTO update_requests (workspace_id, lead_id, assigned_to, auto, note)
         VALUES ($1, $2, $3, true, $4) ON CONFLICT DO NOTHING RETURNING *`,
        [ws.id, lead.id, lead.assigned_to, `No activity for ${ws.days} days`])).rows[0];
      if (!row) continue;
      created += 1;
      await logActivity(ws.id, lead.id, null, 'update_requested', `Flazyn requested an update: no activity for ${ws.days} days`, { request_id: row.id, auto: true });
      await notifyAssignee(row, fullName(lead) || 'a lead', null, null);
    }
  }
  return created;
}

let lastAutoScan = 0;
async function processUpdateRequests() {
  try { await notifyResolved(); } catch (err) { logger.error(`Update requests (resolved): ${err.message}`); }
  try { await remindStale(); } catch (err) { logger.error(`Update requests (remind): ${err.message}`); }
  if (Date.now() - lastAutoScan > 60 * 60000) {
    lastAutoScan = Date.now();
    try {
      const n = await autoRequestStale();
      if (n) logger.info(`Auto-requested ${n} lead update(s)`);
    } catch (err) { logger.error(`Update requests (auto): ${err.message}`); }
  }
}

module.exports = {
  RequestError, requestUpdate, clearRequest, openFor, openLeadIds,
  processUpdateRequests, notifyResolved, remindStale, autoRequestStale, DEFAULT_AUTO_DAYS,
};
