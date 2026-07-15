const db = require('../config/database');
const { sendPushNotification } = require('../utils/notifications');
const { logActivity } = require('../utils/activityLog');

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
    const result = await db.query(
      `INSERT INTO follow_ups (workspace_id, lead_id, user_id, type, title, notes, due_date, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [req.workspaceId, lead_id, req.user.id, type, title, notes, due_date, 'pending']
    );
    await db.query('UPDATE leads SET follow_up_date = $1, follow_up_type = $2 WHERE id = $3', [due_date, type, lead_id]);
    await logActivity(req.workspaceId, lead_id, req.user.id, 'follow_up_set', `Follow-up scheduled: ${type} on ${due_date}`);
    res.status(201).json({ followUp: result.rows[0] });
  } catch (err) { next(err); }
};

exports.completeFollowUp = async (req, res, next) => {
  try {
    const { id } = req.params;
    await db.query('UPDATE follow_ups SET status = $1, completed_at = NOW() WHERE id = $2 AND workspace_id = $3', ['completed', id, req.workspaceId]);
    res.json({ message: 'Follow-up marked as completed' });
  } catch (err) { next(err); }
};

exports.snoozeFollowUp = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { snooze_until } = req.body;
    await db.query('UPDATE follow_ups SET snoozed_until = $1, due_date = $1 WHERE id = $2 AND workspace_id = $3', [snooze_until, id, req.workspaceId]);
    res.json({ message: 'Follow-up snoozed' });
  } catch (err) { next(err); }
};

exports.deleteFollowUp = async (req, res, next) => {
  try {
    await db.query('DELETE FROM follow_ups WHERE id = $1 AND workspace_id = $2', [req.params.id, req.workspaceId]);
    res.json({ message: 'Follow-up deleted' });
  } catch (err) { next(err); }
};
