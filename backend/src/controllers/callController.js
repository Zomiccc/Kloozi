const db = require('../config/database');
const { logActivity } = require('../utils/activityLog');

exports.logCall = async (req, res, next) => {
  try {
    const { lead_id, phone_number, outcome, notes, duration_seconds, follow_up_scheduled } = req.body;
    const result = await db.query(
      `INSERT INTO calls (workspace_id, lead_id, user_id, phone_number, outcome, notes, duration_seconds, follow_up_scheduled)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [req.workspaceId, lead_id, req.user.id, phone_number, outcome, notes, duration_seconds || 0, follow_up_scheduled]
    );

    await logActivity(req.workspaceId, lead_id, req.user.id, 'call', `Call logged: ${outcome}`, { outcome, duration: duration_seconds });

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
