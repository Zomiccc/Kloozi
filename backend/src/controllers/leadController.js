const db = require('../config/database');
const logger = require('../utils/logger');
const { logActivity, updateLeadScore } = require('../utils/activityLog');
const { sendPushNotification, notifyManagers } = require('../utils/notifications');
const { cacheGet, cacheSet, cacheDel, cacheDelPattern } = require('../config/redis');
const { parse } = require('csv-parse');
const { stringify } = require('csv-stringify');
const crypto = require('crypto');

exports.createLead = async (req, res, next) => {
  try {
    const wsId = req.workspaceId;
    const { first_name, last_name, phone, email, city, budget, lead_source, notes, custom_fields, tags, assigned_to } = req.body;

    if (phone || email) {
      let dupQuery = 'SELECT id, first_name, last_name, phone, email FROM leads WHERE workspace_id = $1 AND (';
      let dupParams = [wsId];
      let conditions = [];
      if (phone) {
        conditions.push(`phone = $${dupParams.length + 1}`);
        dupParams.push(phone);
      }
      if (email) {
        conditions.push(`email = $${dupParams.length + 1}`);
        dupParams.push(email);
      }
      dupQuery += conditions.join(' OR ') + ')';
      const dupResult = await db.query(dupQuery, dupParams);
      if (dupResult.rows.length > 0) {
        return res.status(409).json({
          error: 'Potential duplicate lead found',
          duplicate: dupResult.rows[0],
        });
      }
    }

    let assignedTo = assigned_to;
    if (!assignedTo) {
      const agentsResult = await db.query(
        `SELECT u.id FROM users u WHERE u.workspace_id = $1 AND u.role = $2 AND u.status = $3
         ORDER BY (SELECT COUNT(*) FROM leads WHERE assigned_to = u.id) ASC LIMIT 1`,
        [wsId, 'sales_agent', 'active']
      );
      if (agentsResult.rows.length > 0) {
        assignedTo = agentsResult.rows[0].id;
      } else {
        assignedTo = req.user.id;
      }
    }

    const stageResult = await db.query(
      'SELECT id FROM lead_stages WHERE workspace_id = $1 AND is_default = true LIMIT 1',
      [wsId]
    );
    const stageId = stageResult.rows.length > 0 ? stageResult.rows[0].id : null;

    const result = await db.query(
      `INSERT INTO leads (workspace_id, first_name, last_name, phone, email, city, budget, lead_source, notes, custom_fields, tags, stage, stage_id, assigned_to, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
       RETURNING *`,
      [wsId, first_name, last_name, phone, email, city, budget, lead_source || 'manual',
       notes, JSON.stringify(custom_fields || []), tags || [], 'new', stageId, assignedTo, req.user.id]
    );

    const lead = result.rows[0];
    await logActivity(wsId, lead.id, req.user.id, 'lead_created', `Lead created: ${first_name} ${last_name || ''}`);
    await updateLeadScore(lead.id);

    await cacheDelPattern(`leads:${wsId}:*`);

    if (assignedTo && assignedTo !== req.user.id) {
      await sendPushNotification(assignedTo, 'New Lead Assigned', `You have a new lead: ${first_name} ${last_name || ''}`, {
        type: 'new_lead', leadId: lead.id
      });
    }

    res.status(201).json({ message: 'Lead created successfully', lead });
  } catch (err) {
    next(err);
  }
};

exports.getLeads = async (req, res, next) => {
  try {
    const wsId = req.workspaceId;
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 50, 100);
    const offset = (page - 1) * limit;

    const { search, stage, source, agent, tag, city, budget_min, budget_max, sort, date_from, date_to, include_archived } = req.query;

    let conditions = ['l.workspace_id = $1'];
    let params = [wsId];
    let paramIdx = 2;

    if (req.user.role === 'sales_agent') {
      conditions.push(`l.assigned_to = $${paramIdx++}`);
      params.push(req.user.id);
    }

    if (search) {
      conditions.push(`(l.first_name ILIKE $${paramIdx} OR l.last_name ILIKE $${paramIdx} OR l.phone ILIKE $${paramIdx} OR l.email ILIKE $${paramIdx} OR l.city ILIKE $${paramIdx})`);
      params.push(`%${search}%`);
      paramIdx++;
    }

    if (stage) {
      conditions.push(`l.stage = $${paramIdx++}`);
      params.push(stage);
    }
    if (source) {
      conditions.push(`l.lead_source = $${paramIdx++}`);
      params.push(source);
    }
    if (agent) {
      conditions.push(`l.assigned_to = $${paramIdx++}`);
      params.push(agent);
    }
    if (tag) {
      conditions.push(`$${paramIdx++} = ANY(l.tags)`);
      params.push(tag);
    }
    if (city) {
      conditions.push(`l.city ILIKE $${paramIdx++}`);
      params.push(`%${city}%`);
    }
    if (budget_min) {
      conditions.push(`l.budget >= $${paramIdx++}`);
      params.push(parseFloat(budget_min));
    }
    if (budget_max) {
      conditions.push(`l.budget <= $${paramIdx++}`);
      params.push(parseFloat(budget_max));
    }
    if (date_from) {
      conditions.push(`l.created_at >= $${paramIdx++}`);
      params.push(date_from);
    }
    if (date_to) {
      conditions.push(`l.created_at <= $${paramIdx++}`);
      params.push(date_to);
    }

    let orderBy = 'l.created_at DESC';
    switch (sort) {
      case 'oldest': orderBy = 'l.created_at ASC'; break;
      case 'last_activity': orderBy = 'l.last_activity_at DESC'; break;
      case 'follow_up': orderBy = 'l.follow_up_date ASC NULLS LAST'; break;
      case 'budget_high': orderBy = 'l.budget DESC NULLS LAST'; break;
      case 'budget_low': orderBy = 'l.budget ASC NULLS LAST'; break;
      case 'score': orderBy = 'l.score DESC'; break;
    }

    const whereClause = conditions.join(' AND ');

    const countResult = await db.query(`SELECT COUNT(*) FROM leads l WHERE ${whereClause}`, params);
    const total = parseInt(countResult.rows[0].count);

    const query = `
      SELECT l.*, u.first_name as agent_first_name, u.last_name as agent_last_name,
             s.name as stage_name, s.color as stage_color
      FROM leads l
      LEFT JOIN users u ON l.assigned_to = u.id
      LEFT JOIN lead_stages s ON l.stage_id = s.id
      WHERE ${whereClause}
      ORDER BY ${orderBy}
      LIMIT $${paramIdx++} OFFSET $${paramIdx++}
    `;
    params.push(limit, offset);

    const result = await db.query(query, params);

    res.json({
      leads: result.rows,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    next(err);
  }
};

exports.getLead = async (req, res, next) => {
  try {
    const wsId = req.workspaceId;
    const { id } = req.params;

    let conditions = 'l.workspace_id = $1 AND l.id = $2';
    let params = [wsId, id];

    if (req.user.role === 'sales_agent') {
      conditions += ' AND l.assigned_to = $3';
      params.push(req.user.id);
    }

    const result = await db.query(
      `SELECT l.*, u.first_name as agent_first_name, u.last_name as agent_last_name, u.phone as agent_phone, u.email as agent_email,
              s.name as stage_name, s.color as stage_color
       FROM leads l
       LEFT JOIN users u ON l.assigned_to = u.id
       LEFT JOIN lead_stages s ON l.stage_id = s.id
       WHERE ${conditions}`,
      params
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Lead not found' });
    }

    const activities = await db.query(
      'SELECT * FROM lead_activities WHERE lead_id = $1 ORDER BY created_at DESC LIMIT 50',
      [id]
    );

    const followUps = await db.query(
      'SELECT * FROM follow_ups WHERE lead_id = $1 ORDER BY due_date DESC LIMIT 20',
      [id]
    );

    const calls = await db.query(
      'SELECT * FROM calls WHERE lead_id = $1 ORDER BY created_at DESC LIMIT 20',
      [id]
    );

    const emails = await db.query(
      'SELECT id, subject, status, sent_at, opened_at, clicked_at FROM emails WHERE lead_id = $1 ORDER BY created_at DESC LIMIT 20',
      [id]
    );

    const whatsappMsgs = await db.query(
      'SELECT id, direction, message_text, status, sent_at FROM whatsapp_messages WHERE lead_id = $1 ORDER BY created_at DESC LIMIT 20',
      [id]
    );

    const smsMsgs = await db.query(
      'SELECT id, direction, message_text, status, sent_at FROM sms_messages WHERE lead_id = $1 ORDER BY created_at DESC LIMIT 20',
      [id]
    );

    res.json({
      lead: result.rows[0],
      activities: activities.rows,
      followUps: followUps.rows,
      calls: calls.rows,
      emails: emails.rows,
      whatsappMessages: whatsappMsgs.rows,
      smsMessages: smsMsgs.rows,
    });
  } catch (err) {
    next(err);
  }
};

exports.updateLead = async (req, res, next) => {
  try {
    const wsId = req.workspaceId;
    const { id } = req.params;
    const updates = req.body;

    const allowedFields = ['first_name', 'last_name', 'phone', 'email', 'city', 'budget', 'lead_source', 'notes', 'custom_fields', 'tags', 'stage', 'assigned_to', 'follow_up_date', 'follow_up_type', 'follow_up_notes'];
    const setClauses = [];
    const params = [];
    let paramIdx = 1;

    for (const field of allowedFields) {
      if (updates[field] !== undefined) {
        setClauses.push(`${field} = $${paramIdx++}`);
        if (field === 'custom_fields') {
          params.push(JSON.stringify(updates[field]));
        } else if (field === 'tags') {
          params.push(updates[field]);
        } else {
          params.push(updates[field]);
        }
      }
    }

    if (setClauses.length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }

    setClauses.push(`updated_at = NOW()`);
    params.push(wsId, id);

    const result = await db.query(
      `UPDATE leads SET ${setClauses.join(', ')} WHERE workspace_id = $${paramIdx++} AND id = $${paramIdx++} RETURNING *`,
      params
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Lead not found' });
    }

    if (updates.stage) {
      await logActivity(wsId, id, req.user.id, 'stage_change', `Stage changed to ${updates.stage}`, { new_stage: updates.stage });
      if (updates.stage === 'won') {
        await notifyManagers(wsId, 'lead_won', 'Deal Won!', `A lead has been moved to Won`, { type: 'lead_won', leadId: id });
      } else if (updates.stage === 'lost') {
        await notifyManagers(wsId, 'lead_lost', 'Deal Lost', `A lead has been moved to Lost`, { type: 'lead_lost', leadId: id });
      }
    } else {
      await logActivity(wsId, id, req.user.id, 'lead_updated', 'Lead details updated');
    }

    await updateLeadScore(id);
    await cacheDelPattern(`leads:${wsId}:*`);

    res.json({ message: 'Lead updated successfully', lead: result.rows[0] });
  } catch (err) {
    next(err);
  }
};

exports.deleteLead = async (req, res, next) => {
  try {
    const wsId = req.workspaceId;
    const { id } = req.params;

    const result = await db.query(
      'DELETE FROM leads WHERE workspace_id = $1 AND id = $2 RETURNING id',
      [wsId, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Lead not found' });
    }

    await cacheDelPattern(`leads:${wsId}:*`);
    res.json({ message: 'Lead deleted successfully' });
  } catch (err) {
    next(err);
  }
};

exports.importLeads = async (req, res, next) => {
  try {
    const wsId = req.workspaceId;
    const { csv_data, field_mapping } = req.body;

    if (!csv_data || !field_mapping) {
      return res.status(400).json({ error: 'CSV data and field mapping required' });
    }

    const records = [];
    const parser = parse(csv_data, { columns: true, skip_empty_lines: true });

    for await (const record of parser) {
      records.push(record);
    }

    const stageResult = await db.query('SELECT id FROM lead_stages WHERE workspace_id = $1 AND is_default = true LIMIT 1', [wsId]);
    const stageId = stageResult.rows[0]?.id;

    let successCount = 0;
    let failedRows = [];

    for (let i = 0; i < records.length; i++) {
      try {
        const row = records[i];
        const leadData = {};
        for (const [csvCol, leadField] of Object.entries(field_mapping)) {
          if (leadField && row[csvCol] !== undefined) {
            leadData[leadField] = row[csvCol];
          }
        }

        if (!leadData.first_name && !leadData.phone) {
          failedRows.push({ row: i + 2, reason: 'Missing required fields (name or phone)', data: row });
          continue;
        }

        const agentsResult = await db.query(
          `SELECT u.id FROM users u WHERE u.workspace_id = $1 AND u.role = $2 AND u.status = $3
           ORDER BY (SELECT COUNT(*) FROM leads WHERE assigned_to = u.id) ASC LIMIT 1`,
          [wsId, 'sales_agent', 'active']
        );

        await db.query(
          `INSERT INTO leads (workspace_id, first_name, last_name, phone, email, city, budget, lead_source, notes, stage, stage_id, assigned_to, created_by)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
          [wsId, leadData.first_name, leadData.last_name, leadData.phone, leadData.email,
           leadData.city, leadData.budget ? parseFloat(leadData.budget) : null,
           leadData.lead_source || 'import', leadData.notes, 'new', stageId,
           agentsResult.rows[0]?.id || req.user.id, req.user.id]
        );
        successCount++;
      } catch (err) {
        failedRows.push({ row: i + 2, reason: err.message, data: records[i] });
      }
    }

    await cacheDelPattern(`leads:${wsId}:*`);

    res.json({
      message: 'Import completed',
      successCount,
      failedCount: failedRows.length,
      failedRows,
    });
  } catch (err) {
    next(err);
  }
};

exports.exportLeads = async (req, res, next) => {
  try {
    const wsId = req.workspaceId;
    const { fields, stage, source, agent, date_from, date_to } = req.body;

    let conditions = ['workspace_id = $1'];
    let params = [wsId];
    let paramIdx = 2;

    if (req.user.role === 'sales_agent') {
      conditions.push(`assigned_to = $${paramIdx++}`);
      params.push(req.user.id);
    }
    if (stage) { conditions.push(`stage = $${paramIdx++}`); params.push(stage); }
    if (source) { conditions.push(`lead_source = $${paramIdx++}`); params.push(source); }
    if (agent) { conditions.push(`assigned_to = $${paramIdx++}`); params.push(agent); }
    if (date_from) { conditions.push(`created_at >= $${paramIdx++}`); params.push(date_from); }
    if (date_to) { conditions.push(`created_at <= $${paramIdx++}`); params.push(date_to); }

    const selectFields = (fields && fields.length > 0) ? fields.join(', ') : '*';
    const result = await db.query(
      `SELECT ${selectFields} FROM leads WHERE ${conditions.join(' AND ')} ORDER BY created_at DESC`,
      params
    );

    const exportId = crypto.randomUUID();
    await db.query(
      `INSERT INTO export_history (workspace_id, user_id, type, filter_config, fields, row_count)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [wsId, req.user.id, 'leads', JSON.stringify({ stage, source, agent, date_from, date_to }), JSON.stringify(fields || []), result.rows.length]
    );

    if (result.rows.length === 0) {
      return res.json({ message: 'No leads to export', data: [] });
    }

    const csvData = [];
    stringify(result.rows, { header: true }, (err, output) => {
      if (err) {
        return res.status(500).json({ error: 'Export failed' });
      }
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=leads_export.csv');
      res.send(output);
    });
  } catch (err) {
    next(err);
  }
};

exports.bulkAction = async (req, res, next) => {
  try {
    const wsId = req.workspaceId;
    const { lead_ids, action, value } = req.body;

    if (!lead_ids || lead_ids.length === 0) {
      return res.status(400).json({ error: 'No leads selected' });
    }

    const placeholders = lead_ids.map((_, i) => `$${i + 2}`).join(',');
    let query, params = [wsId, ...lead_ids];
    let message = '';

    switch (action) {
      case 'assign':
        query = `UPDATE leads SET assigned_to = $${lead_ids.length + 2}, updated_at = NOW() WHERE workspace_id = $1 AND id IN (${placeholders})`;
        params.push(value);
        message = 'Leads assigned successfully';
        break;
      case 'change_stage':
        query = `UPDATE leads SET stage = $${lead_ids.length + 2}, updated_at = NOW() WHERE workspace_id = $1 AND id IN (${placeholders})`;
        params.push(value);
        message = 'Leads stage updated successfully';
        break;
      case 'add_tag':
        query = `UPDATE leads SET tags = tags || ARRAY[$${lead_ids.length + 2}], updated_at = NOW() WHERE workspace_id = $1 AND id IN (${placeholders})`;
        params.push(value);
        message = 'Tag added to leads successfully';
        break;
      case 'delete':
        query = `DELETE FROM leads WHERE workspace_id = $1 AND id IN (${placeholders})`;
        message = 'Leads deleted successfully';
        break;
      default:
        return res.status(400).json({ error: 'Invalid bulk action' });
    }

    await db.query(query, params);
    await cacheDelPattern(`leads:${wsId}:*`);

    for (const leadId of lead_ids) {
      await logActivity(wsId, leadId, req.user.id, 'bulk_action', `Bulk action: ${action}`);
    }

    res.json({ message, count: lead_ids.length });
  } catch (err) {
    next(err);
  }
};

exports.getStages = async (req, res, next) => {
  try {
    const result = await db.query(
      'SELECT * FROM lead_stages WHERE workspace_id = $1 ORDER BY sort_order',
      [req.workspaceId]
    );
    res.json({ stages: result.rows });
  } catch (err) {
    next(err);
  }
};

exports.updateStages = async (req, res, next) => {
  try {
    const wsId = req.workspaceId;
    const { stages } = req.body;

    await db.transaction(async (client) => {
      for (let i = 0; i < stages.length; i++) {
        const s = stages[i];
        if (s.id) {
          await client.query(
            'UPDATE lead_stages SET name = $1, color = $2, sort_order = $3, is_won = $4, is_lost = $5 WHERE id = $6 AND workspace_id = $7',
            [s.name, s.color, i, s.is_won || false, s.is_lost || false, s.id, wsId]
          );
        } else {
          await client.query(
            'INSERT INTO lead_stages (workspace_id, name, color, sort_order, is_won, is_lost) VALUES ($1, $2, $3, $4, $5, $6)',
            [wsId, s.name, s.color, i, s.is_won || false, s.is_lost || false]
          );
        }
      }
    });

    const result = await db.query('SELECT * FROM lead_stages WHERE workspace_id = $1 ORDER BY sort_order', [wsId]);
    res.json({ stages: result.rows });
  } catch (err) {
    next(err);
  }
};

exports.getTags = async (req, res, next) => {
  try {
    const result = await db.query('SELECT * FROM lead_tags WHERE workspace_id = $1 ORDER BY name', [req.workspaceId]);
    res.json({ tags: result.rows });
  } catch (err) {
    next(err);
  }
};

exports.createTag = async (req, res, next) => {
  try {
    const { name, color } = req.body;
    const result = await db.query(
      'INSERT INTO lead_tags (workspace_id, name, color) VALUES ($1, $2, $3) RETURNING *',
      [req.workspaceId, name, color || '#3b82f6']
    );
    res.status(201).json({ tag: result.rows[0] });
  } catch (err) {
    next(err);
  }
};

exports.getGroups = async (req, res, next) => {
  try {
    const result = await db.query('SELECT * FROM lead_groups WHERE workspace_id = $1 ORDER BY name', [req.workspaceId]);
    res.json({ groups: result.rows });
  } catch (err) {
    next(err);
  }
};

exports.createGroup = async (req, res, next) => {
  try {
    const { name, type, filter_config } = req.body;
    const result = await db.query(
      'INSERT INTO lead_groups (workspace_id, name, type, filter_config, created_by) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [req.workspaceId, name, type || 'static', JSON.stringify(filter_config || {}), req.user.id]
    );
    res.status(201).json({ group: result.rows[0] });
  } catch (err) {
    next(err);
  }
};

exports.getCustomFields = async (req, res, next) => {
  try {
    const result = await db.query('SELECT * FROM lead_custom_fields WHERE workspace_id = $1 ORDER BY sort_order', [req.workspaceId]);
    res.json({ fields: result.rows });
  } catch (err) {
    next(err);
  }
};

exports.createCustomField = async (req, res, next) => {
  try {
    const { name, type, options, is_required } = req.body;
    const result = await db.query(
      'INSERT INTO lead_custom_fields (workspace_id, name, type, options, is_required) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [req.workspaceId, name, type || 'text', JSON.stringify(options || []), is_required || false]
    );
    res.status(201).json({ field: result.rows[0] });
  } catch (err) {
    next(err);
  }
};

exports.getExportHistory = async (req, res, next) => {
  try {
    const result = await db.query(
      'SELECT * FROM export_history WHERE workspace_id = $1 ORDER BY created_at DESC LIMIT 20',
      [req.workspaceId]
    );
    res.json({ exports: result.rows });
  } catch (err) {
    next(err);
  }
};
