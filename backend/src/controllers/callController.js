const db = require('../config/database');
const { logActivity } = require('../utils/activityLog');
const crypto = require('crypto');

exports.logCall = async (req, res, next) => {
  try {
    const { lead_id, phone_number, outcome, notes, duration_seconds, follow_up_scheduled, latitude, longitude, attachments } = req.body;
    const result = await db.query(
      `INSERT INTO calls (workspace_id, lead_id, user_id, phone_number, outcome, notes, duration_seconds, follow_up_scheduled)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [req.workspaceId, lead_id, req.user.id, phone_number, outcome, notes, duration_seconds || 0, follow_up_scheduled]
    );

    const activityMetadata = { outcome, duration: duration_seconds };
    if (latitude && longitude) {
      activityMetadata.latitude = latitude;
      activityMetadata.longitude = longitude;
    }
    if (attachments && Array.isArray(attachments) && attachments.length > 0) {
      activityMetadata.attachments = attachments;
    }
    await logActivity(req.workspaceId, lead_id, req.user.id, 'call', `Call logged: ${outcome}`, activityMetadata);

    if (follow_up_scheduled) {
      await db.query(
        `INSERT INTO follow_ups (workspace_id, lead_id, user_id, type, due_date, status)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [req.workspaceId, lead_id, req.user.id, 'call', follow_up_scheduled, 'pending']
      );
    }

    res.status(201).json({ call: result.rows[0] });
  } catch (err) { next(err); }
};

exports.getCalls = async (req, res, next) => {
  try {
    const { lead_id, agent_id, outcome, date_from, date_to } = req.query;
    let conditions = ['c.workspace_id = $1'];
    let params = [req.workspaceId];
    let paramIdx = 2;

    if (req.user.role === 'sales_agent') {
      conditions.push(`c.user_id = $${paramIdx++}`);
      params.push(req.user.id);
    }
    if (lead_id) { conditions.push(`c.lead_id = $${paramIdx++}`); params.push(lead_id); }
    if (agent_id) { conditions.push(`c.user_id = $${paramIdx++}`); params.push(agent_id); }
    if (outcome) { conditions.push(`c.outcome = $${paramIdx++}`); params.push(outcome); }
    if (date_from) { conditions.push(`c.created_at >= $${paramIdx++}`); params.push(date_from); }
    if (date_to) { conditions.push(`c.created_at <= $${paramIdx++}`); params.push(date_to); }

    const result = await db.query(
      `SELECT c.*, l.first_name as lead_first_name, l.last_name as lead_last_name, l.phone as lead_phone,
              u.first_name as agent_first_name, u.last_name as agent_last_name
       FROM calls c LEFT JOIN leads l ON c.lead_id = l.id LEFT JOIN users u ON c.user_id = u.id
       WHERE ${conditions.join(' AND ')} ORDER BY c.created_at DESC LIMIT 200`,
      params
    );
    res.json({ calls: result.rows });
  } catch (err) { next(err); }
};

exports.getCallList = async (req, res, next) => {
  try {
    let conditions = ['workspace_id = $1 AND phone IS NOT NULL'];
    let params = [req.workspaceId];
    if (req.user.role === 'sales_agent') {
      conditions.push('assigned_to = $2');
      params.push(req.user.id);
    }
    const result = await db.query(
      `SELECT id, first_name, last_name, phone, stage, city, score FROM leads WHERE ${conditions.join(' AND ')} ORDER BY follow_up_date ASC NULLS LAST, score DESC LIMIT 100`,
      params
    );
    res.json({ callList: result.rows });
  } catch (err) { next(err); }
};

exports.startBulkCall = async (req, res, next) => {
  try {
    const { lead_ids } = req.body;
    if (!lead_ids || lead_ids.length === 0) {
      return res.status(400).json({ error: 'No leads selected for bulk calling' });
    }

    let conditions = ['workspace_id = $1 AND phone IS NOT NULL AND id IN ('];
    let params = [req.workspaceId];
    const placeholders = lead_ids.map((_, i) => `$${i + 2}`).join(',');
    conditions[0] += placeholders + ')';
    params.push(...lead_ids);

    if (req.user.role === 'sales_agent') {
      conditions.push('assigned_to = $' + (params.length + 1));
      params.push(req.user.id);
    }

    const result = await db.query(
      `SELECT id, first_name, last_name, phone, stage, city, score, notes FROM leads WHERE ${conditions.join(' AND ')} ORDER BY follow_up_date ASC NULLS LAST, score DESC`,
      params
    );

    if (result.rows.length === 0) {
      return res.json({ message: 'No callable leads found', session: null });
    }

    const sessionId = crypto.randomUUID();
    res.json({
      session: {
        id: sessionId,
        total: result.rows.length,
        currentIndex: 0,
        leads: result.rows,
      },
    });
  } catch (err) { next(err); }
};

exports.logBulkCall = async (req, res, next) => {
  try {
    const { lead_id, phone_number, outcome, notes, duration_seconds, latitude, longitude, attachments } = req.body;

    const result = await db.query(
      `INSERT INTO calls (workspace_id, lead_id, user_id, phone_number, outcome, notes, duration_seconds)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [req.workspaceId, lead_id, req.user.id, phone_number, outcome, notes, duration_seconds || 0]
    );

    const activityMetadata = { outcome, duration: duration_seconds, bulk_call: true };
    if (latitude && longitude) {
      activityMetadata.latitude = latitude;
      activityMetadata.longitude = longitude;
    }
    if (attachments && Array.isArray(attachments) && attachments.length > 0) {
      activityMetadata.attachments = attachments;
    }
    await logActivity(req.workspaceId, lead_id, req.user.id, 'call', `Bulk call: ${outcome}`, activityMetadata);

    res.status(201).json({ call: result.rows[0] });
  } catch (err) { next(err); }
};
