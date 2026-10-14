const db = require('../config/database');
const logger = require('../utils/logger');
const { sendPushNotification } = require('../utils/notifications');

// ─── Follow-up reminders ────────────────────────────────────────────────────
// Every minute: remind the owner when a follow-up is due, and once more if it
// is still open 24 h later. Respects each user's notification preferences
// (Settings → Notifications: "Follow-up Due" / "Follow-up Overdue").

const TYPE_LABEL = { call: 'Call', whatsapp: 'WhatsApp', email: 'Email', meeting: 'Meeting', sms: 'SMS', visit: 'Site visit' };

function wantsNotification(prefs, key) {
  const p = typeof prefs === 'string' ? (() => { try { return JSON.parse(prefs); } catch { return {}; } })() : (prefs || {});
  return p[key] !== false;
}

/** Keep leads.follow_up_date/type pointing at the lead's earliest open follow-up. */
async function syncLeadFollowUp(leadId) {
  const next = await db.query(
    `SELECT due_date, type FROM follow_ups WHERE lead_id = $1 AND status = 'pending' ORDER BY due_date ASC LIMIT 1`,
    [leadId]
  );
  await db.query(
    'UPDATE leads SET follow_up_date = $1, follow_up_type = $2, updated_at = NOW() WHERE id = $3',
    [next.rows[0]?.due_date || null, next.rows[0]?.type || null, leadId]
  );
}

async function processFollowUpReminders() {
  // 1. Due now
  const due = await db.query(
    `SELECT f.*, l.first_name, l.last_name, l.assigned_to, u.notification_preferences
     FROM follow_ups f
     JOIN leads l ON l.id = f.lead_id
     LEFT JOIN users u ON u.id = COALESCE(f.user_id, l.assigned_to)
     WHERE f.status = 'pending' AND f.reminded_at IS NULL AND f.due_date <= NOW()
     ORDER BY f.due_date ASC LIMIT 200`
  );
  for (const f of due.rows) {
    // Claim atomically so two ticks never double-notify.
    const claimed = await db.query('UPDATE follow_ups SET reminded_at = NOW() WHERE id = $1 AND reminded_at IS NULL RETURNING id', [f.id]);
    if (!claimed.rows.length) continue;
    const owner = f.user_id || f.assigned_to;
    if (!owner || !wantsNotification(f.notification_preferences, 'follow_up_due')) continue;
    const name = [f.first_name, f.last_name].filter(Boolean).join(' ') || 'a lead';
    await sendPushNotification(owner, `${TYPE_LABEL[f.type] || 'Follow up with'} ${name} now`, f.title || f.notes || 'Your follow-up is due.', {
      type: 'follow_up_due', leadId: f.lead_id, followUpId: f.id,
    });
  }

  // 2. Still open a day later
  const overdue = await db.query(
    `SELECT f.*, l.first_name, l.last_name, l.assigned_to, u.notification_preferences
     FROM follow_ups f
     JOIN leads l ON l.id = f.lead_id
     LEFT JOIN users u ON u.id = COALESCE(f.user_id, l.assigned_to)
     WHERE f.status = 'pending' AND f.overdue_notified_at IS NULL AND f.due_date <= NOW() - INTERVAL '24 hours'
     ORDER BY f.due_date ASC LIMIT 200`
  );
  for (const f of overdue.rows) {
    const claimed = await db.query('UPDATE follow_ups SET overdue_notified_at = NOW() WHERE id = $1 AND overdue_notified_at IS NULL RETURNING id', [f.id]);
    if (!claimed.rows.length) continue;
    const owner = f.user_id || f.assigned_to;
    if (!owner || !wantsNotification(f.notification_preferences, 'follow_up_overdue')) continue;
    const name = [f.first_name, f.last_name].filter(Boolean).join(' ') || 'a lead';
    await sendPushNotification(owner, `Overdue: follow-up with ${name}`, 'This follow-up is more than a day late.', {
      type: 'follow_up_overdue', leadId: f.lead_id, followUpId: f.id,
    });
  }
  return { due: due.rows.length, overdue: overdue.rows.length };
}

module.exports = { processFollowUpReminders, syncLeadFollowUp, TYPE_LABEL };
