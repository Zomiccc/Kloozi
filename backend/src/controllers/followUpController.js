const db = require('../config/database');
const { sendPushNotification } = require('../utils/notifications');
const { logActivity } = require('../utils/activityLog');
const { syncLeadFollowUp, TYPE_LABEL } = require('../services/followUpService');

exports.getFollowUps = async (req, res, next) => {
  try {
    let conditions = ['f.workspace_id = $1'];
    let params = [req.workspaceId];
    let paramIdx = 2;

    if (req.user.role === 'sales_agent') {
      conditions.push(`f.user_id = $${paramIdx++}`);
      params.push(req.user.id);
    }

    const { status, date, overdue } = req.query;
    if (status) { conditions.push(`f.status = $${paramIdx++}`); params.push(status); }
    if (date === 'today') {
      conditions.push(`f.due_date::date = CURRENT_DATE`);
    } else if (date === 'upcoming') {
      conditions.push(`f.due_date > NOW()`);
    }
    if (overdue === 'true') {
      conditions.push(`f.due_date < NOW() AND f.status = 'pending'`);
    }

    const result = await db.query(
      `SELECT f.*, l.first_name, l.last_name, l.phone, l.stage, l.score
       FROM follow_ups f JOIN leads l ON f.lead_id = l.id
       WHERE ${conditions.join(' AND ')} ORDER BY f.due_date ASC`,
      params
    );
    res.json({ followUps: result.rows });
  } catch (err) { next(err); }
};

exports.createFollowUp = async (req, res, next) => {
  try {
    const { lead_id, type, title, notes, due_date } = req.body;
    if (!lead_id || !due_date) return res.status(400).json({ error: 'Lead and due date are required' });
    const due = new Date(due_date);
    if (Number.isNaN(due.getTime())) return res.status(400).json({ error: 'Invalid due date' });
    const lead = (await db.query('SELECT id, assigned_to FROM leads WHERE id = $1 AND workspace_id = $2', [lead_id, req.workspaceId])).rows[0];
    if (!lead) return res.status(404).json({ error: 'Lead not found' });
    const kind = type || 'call';
    const result = await db.query(
      `INSERT INTO follow_ups (workspace_id, lead_id, user_id, type, title, notes, due_date, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending') RETURNING *`,
      [req.workspaceId, lead_id, lead.assigned_to || req.user.id, kind, title || null, notes || null, due]
    );
    await syncLeadFollowUp(lead_id);
    await logActivity(req.workspaceId, lead_id, req.user.id, 'follow_up_set',
      `${TYPE_LABEL[kind] || 'Follow-up'} scheduled for ${due.toLocaleString('en-AU', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' })} UTC`, { follow_up_id: result.rows[0].id });
    res.status(201).json({ followUp: result.rows[0] });
  } catch (err) { next(err); }
};


exports.completeFollowUp = async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await db.query(
      "UPDATE follow_ups SET status = 'completed', completed_at = NOW(), updated_at = NOW() WHERE id = $1 AND workspace_id = $2 RETURNING *",
      [id, req.workspaceId]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Follow-up not found' });
    const f = result.rows[0];
    await syncLeadFollowUp(f.lead_id);
    await logActivity(req.workspaceId, f.lead_id, req.user.id, 'follow_up_completed', `${TYPE_LABEL[f.type] || 'Follow-up'} completed${req.body?.outcome ? `: ${req.body.outcome}` : ''}`, { follow_up_id: f.id });
    await db.query('UPDATE leads SET last_activity_at = NOW() WHERE id = $1', [f.lead_id]);
    const { fireOutgoingWebhooks } = require('../services/leadPipeline');
    setImmediate(() => fireOutgoingWebhooks(req.workspaceId, 'follow_up_completed', f));
    res.json({ message: 'Follow-up marked as completed', followUp: f });
  } catch (err) { next(err); }
};


exports.snoozeFollowUp = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { snooze_until, minutes } = req.body || {};
    const until = snooze_until ? new Date(snooze_until) : new Date(Date.now() + (Number(minutes) || 60) * 60000);
    if (Number.isNaN(until.getTime())) return res.status(400).json({ error: 'Invalid snooze time' });
    const r = await db.query(
      `UPDATE follow_ups SET snoozed_until = $1, due_date = $1, reminded_at = NULL, overdue_notified_at = NULL, updated_at = NOW()
       WHERE id = $2 AND workspace_id = $3 AND status = 'pending' RETURNING *`,
      [until, id, req.workspaceId]
    );
    if (!r.rows[0]) return res.status(404).json({ error: 'Follow-up not found' });
    await syncLeadFollowUp(r.rows[0].lead_id);
    res.json({ message: 'Follow-up snoozed', followUp: r.rows[0] });
  } catch (err) { next(err); }
};


exports.deleteFollowUp = async (req, res, next) => {
  try {
    const r = await db.query('DELETE FROM follow_ups WHERE id = $1 AND workspace_id = $2 RETURNING lead_id', [req.params.id, req.workspaceId]);
    if (r.rows[0]) await syncLeadFollowUp(r.rows[0].lead_id);
    res.json({ message: 'Follow-up deleted' });
  } catch (err) { next(err); }
};
