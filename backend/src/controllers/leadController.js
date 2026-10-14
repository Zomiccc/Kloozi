const db = require('../config/database');
const logger = require('../utils/logger');
const { logActivity, addTimelineEntry, updateLeadScore } = require('../utils/activityLog');
const { sendPushNotification, notifyManagers } = require('../utils/notifications');
const { cacheGet, cacheSet, cacheDel, cacheDelPattern } = require('../config/redis');
const { parse } = require('csv-parse');
const { stringify } = require('csv-stringify');
const crypto = require('crypto');
const { createLead: createLeadInPipeline, onLeadUpdated, normalizeTags } = require('../services/leadPipeline');

exports.createLead = async (req, res, next) => {
  try {
    const wsId = req.workspaceId;
    const result = await createLeadInPipeline(wsId, req.body, {
      actorId: req.user.id,
      source: req.body.lead_source || 'manual',
      duplicateMode: req.body.auto_merge === true ? 'merge' : (req.body.allow_duplicate === true ? 'allow' : 'reject'),
      activityText: `Lead created: ${req.body.first_name || req.body.name || ''} ${req.body.last_name || ''}`.trim(),
    });

    if (result.status === 'duplicate') {
      const d = result.duplicate;
      return res.status(409).json({
        error: 'Potential duplicate lead found',
        duplicate: { id: d.id, first_name: d.first_name, last_name: d.last_name, phone: d.phone, email: d.email },
      });
    }
    if (result.status === 'merged') {
      return res.json({ message: 'Lead auto-merged with existing duplicate', lead: result.lead, merged: true });
    }
    res.status(201).json({ message: 'Lead created successfully', lead: result.lead });
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
      conditions.push(`l.tags ? $${paramIdx++}`);
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
    // "Follow-ups" tab: an open follow-up that is due now or earlier
    if (req.query.follow_up_due === 'true') {
      conditions.push(`EXISTS (SELECT 1 FROM follow_ups f WHERE f.lead_id = l.id AND f.status = 'pending' AND f.due_date <= NOW())`);
    }
    // "Engaged" tab: opened a document, visited the website or replied in the last 7 days
    if (req.query.recently_viewed === 'true') {
      conditions.push(`(EXISTS (SELECT 1 FROM engagement_sessions s WHERE s.lead_id = l.id AND s.last_seen_at > NOW() - INTERVAL '7 days')
        OR EXISTS (SELECT 1 FROM whatsapp_messages m WHERE m.lead_id = l.id AND m.direction = 'inbound' AND m.created_at > NOW() - INTERVAL '7 days'))`);
    }

    let orderBy = 'l.created_at DESC';
    if (req.query.follow_up_due === 'true') orderBy = 'l.follow_up_date ASC NULLS LAST';
    if (req.query.recently_viewed === 'true') orderBy = 'l.score DESC, l.last_activity_at DESC';
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
             s.name as stage_name, s.color as stage_color,
             EXISTS (SELECT 1 FROM update_requests ur WHERE ur.lead_id = l.id AND ur.resolved_at IS NULL) AS update_requested
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
          params.push(JSON.stringify(normalizeTags(updates[field])));
        } else if (field === 'stage') {
          params.push(String(updates[field]).toLowerCase());
        } else {
          params.push(updates[field]);
        }
      }
    }

    if (setClauses.length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }

    if (updates.stage !== undefined) {
      const stageRow = await db.query(
        'SELECT id FROM lead_stages WHERE workspace_id = $1 AND LOWER(name) = LOWER($2) LIMIT 1',
        [wsId, String(updates.stage)]
      );
      if (stageRow.rows[0]) {
        setClauses.push(`stage_id = $${paramIdx++}`);
        params.push(stageRow.rows[0].id);
      }
    }

    const before = await db.query('SELECT * FROM leads WHERE workspace_id = $1 AND id = $2', [wsId, id]);
    if (before.rows.length === 0) {
      return res.status(404).json({ error: 'Lead not found' });
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

    const stageChanged = updates.stage !== undefined
      && String(before.rows[0].stage || '').toLowerCase() !== String(updates.stage).toLowerCase();
    if (stageChanged) {
      const newStage = String(updates.stage).toLowerCase();
      await logActivity(wsId, id, req.user.id, 'stage_change', `Stage changed to ${newStage}`, { old_stage: before.rows[0].stage, new_stage: newStage });
      if (newStage === 'won') {
        await notifyManagers(wsId, 'lead_won', 'Deal Won!', `A lead has been moved to Won`, { type: 'lead_won', leadId: id });
      } else if (newStage === 'lost') {
        await notifyManagers(wsId, 'lead_lost', 'Deal Lost', `A lead has been moved to Lost`, { type: 'lead_lost', leadId: id });
      }
    } else {
      await logActivity(wsId, id, req.user.id, 'lead_updated', 'Lead details updated');
    }

    // A follow-up date set straight on the lead becomes a real follow-up (with a reminder).
    if (updates.follow_up_date && String(updates.follow_up_date) !== String(before.rows[0].follow_up_date || '')) {
      const due = new Date(updates.follow_up_date);
      if (!Number.isNaN(due.getTime())) {
        const exists = await db.query("SELECT 1 FROM follow_ups WHERE lead_id = $1 AND status = 'pending' AND due_date = $2", [id, due]);
        if (!exists.rows.length) {
          await db.query(
            `INSERT INTO follow_ups (workspace_id, lead_id, user_id, type, notes, due_date, status) VALUES ($1,$2,$3,$4,$5,$6,'pending')`,
            [wsId, id, result.rows[0].assigned_to || req.user.id, updates.follow_up_type || 'call', updates.follow_up_notes || null, due]
          );
        }
      }
    }

    await updateLeadScore(id);
    await cacheDelPattern(`leads:${wsId}:*`);
    await onLeadUpdated(wsId, before.rows[0], result.rows[0], { actorId: req.user.id });

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

        const created = await createLeadInPipeline(wsId, { ...leadData, lead_source: leadData.lead_source || 'import' }, {
          actorId: req.user.id, source: 'import', duplicateMode: 'workspace', notify: false,
          activityText: 'Lead imported from CSV',
        });
        if (created.status === 'skipped') {
          failedRows.push({ row: i + 2, reason: 'Duplicate lead (skipped by duplicate settings)', data: row });
          continue;
        }
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
        query = `UPDATE leads SET stage = LOWER($${lead_ids.length + 2}),
                   stage_id = COALESCE((SELECT id FROM lead_stages WHERE workspace_id = $1 AND LOWER(name) = LOWER($${lead_ids.length + 2}) LIMIT 1), stage_id),
                   updated_at = NOW()
                 WHERE workspace_id = $1 AND id IN (${placeholders})`;
        params.push(value);
        message = 'Leads stage updated successfully';
        break;
      case 'add_tag':
        query = `UPDATE leads SET tags = (
                   SELECT COALESCE(jsonb_agg(DISTINCT t), '[]'::jsonb)
                   FROM jsonb_array_elements_text(COALESCE(tags, '[]'::jsonb) || jsonb_build_array($${lead_ids.length + 2}::text)) AS t
                 ), updated_at = NOW() WHERE workspace_id = $1 AND id IN (${placeholders})`;
        params.push(String(value || '').trim());
        message = 'Tag added to leads successfully';
        break;
      case 'delete':
        query = `DELETE FROM leads WHERE workspace_id = $1 AND id IN (${placeholders})`;
        message = 'Leads deleted successfully';
        break;
      case 'start_sequence': {
        const { startSequence } = require('./whatsappSequenceController');
        let started = 0;
        const reasons = {};
        for (const leadId of lead_ids) {
          const r = await startSequence(wsId, value, leadId, req.user.id);
          if (r.started) started++; else reasons[r.reason] = (reasons[r.reason] || 0) + 1;
        }
        const skipped = Object.entries(reasons).map(([r, n]) => `${n} skipped: ${r}`).join('; ');
        return res.json({ message: `Sequence started for ${started} lead${started === 1 ? '' : 's'}${skipped ? ` (${skipped})` : ''}`, count: started });
      }
      default:
        return res.status(400).json({ error: 'Invalid bulk action' });
    }

    const before = action === 'delete' ? { rows: [] } : await db.query(
      `SELECT * FROM leads WHERE workspace_id = $1 AND id IN (${placeholders})`, [wsId, ...lead_ids]
    );
    await db.query(query, params);
    await cacheDelPattern(`leads:${wsId}:*`);

    if (action !== 'delete') {
      const after = await db.query(`SELECT * FROM leads WHERE workspace_id = $1 AND id IN (${placeholders})`, [wsId, ...lead_ids]);
      const beforeById = Object.fromEntries(before.rows.map((l) => [l.id, l]));
      for (const lead of after.rows) {
        const prev = beforeById[lead.id];
        if (action === 'change_stage' && prev && String(prev.stage || '') !== String(lead.stage || '')) {
          await logActivity(wsId, lead.id, req.user.id, 'stage_change', `Stage changed to ${lead.stage}`, { old_stage: prev.stage, new_stage: lead.stage });
        } else {
          await logActivity(wsId, lead.id, req.user.id, 'bulk_action', `Bulk action: ${action}`);
        }
        await onLeadUpdated(wsId, prev, lead, { actorId: req.user.id });
      }
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

exports.importPhonebook = async (req, res, next) => {
  try {
    const wsId = req.workspaceId;
    const { contacts } = req.body;

    if (!contacts || !Array.isArray(contacts) || contacts.length === 0) {
      return res.status(400).json({ error: 'Contacts array required' });
    }

    let successCount = 0;
    let duplicateCount = 0;
    let failedCount = 0;

    for (const contact of contacts) {
      try {
        if (!contact.phone && !contact.name) {
          failedCount++;
          continue;
        }

        const nameParts = (contact.name || '').trim().split(' ');
        const firstName = contact.first_name || nameParts[0] || 'Unknown';
        const lastName = contact.last_name || nameParts.slice(1).join(' ') || '';

        const created = await createLeadInPipeline(wsId, {
          first_name: firstName, last_name: lastName, phone: contact.phone, email: contact.email,
          city: contact.city, notes: contact.notes, lead_source: 'phonebook',
        }, {
          actorId: req.user.id, source: 'phonebook', duplicateMode: 'skip', notify: false,
          activityText: 'Lead imported from phonebook',
        });
        if (created.status !== 'created') {
          duplicateCount++;
          continue;
        }
        successCount++;
      } catch (err) {
        failedCount++;
      }
    }

    await cacheDelPattern(`leads:${wsId}:*`);
    res.json({ message: 'Phonebook import completed', successCount, duplicateCount, failedCount });
  } catch (err) {
    next(err);
  }
};

exports.mergeLeads = async (req, res, next) => {
  try {
    const wsId = req.workspaceId;
    const { primary_id, secondary_id } = req.body;

    if (!primary_id || !secondary_id || primary_id === secondary_id) {
      return res.status(400).json({ error: 'Valid primary_id and secondary_id required' });
    }

    const primaryResult = await db.query('SELECT * FROM leads WHERE id = $1 AND workspace_id = $2', [primary_id, wsId]);
    const secondaryResult = await db.query('SELECT * FROM leads WHERE id = $1 AND workspace_id = $2', [secondary_id, wsId]);

    if (primaryResult.rows.length === 0 || secondaryResult.rows.length === 0) {
      return res.status(404).json({ error: 'One or both leads not found' });
    }

    const primary = primaryResult.rows[0];
    const secondary = secondaryResult.rows[0];

    const updateFields = [];
    const updateParams = [];
    let idx = 1;

    if (!primary.first_name && secondary.first_name) { updateFields.push(`first_name = $${idx++}`); updateParams.push(secondary.first_name); }
    if (!primary.last_name && secondary.last_name) { updateFields.push(`last_name = $${idx++}`); updateParams.push(secondary.last_name); }
    if (!primary.email && secondary.email) { updateFields.push(`email = $${idx++}`); updateParams.push(secondary.email); }
    if (!primary.city && secondary.city) { updateFields.push(`city = $${idx++}`); updateParams.push(secondary.city); }
    if (!primary.budget && secondary.budget) { updateFields.push(`budget = $${idx++}`); updateParams.push(secondary.budget); }
    if (secondary.notes) { updateFields.push(`notes = COALESCE(notes || ' | ', '') || $${idx++}`); updateParams.push(secondary.notes); }

    const primaryTags = Array.isArray(primary.tags) ? primary.tags : (typeof primary.tags === 'string' ? JSON.parse(primary.tags || '[]') : []);
    const secondaryTags = Array.isArray(secondary.tags) ? secondary.tags : (typeof secondary.tags === 'string' ? JSON.parse(secondary.tags || '[]') : []);
    const mergedTags = [...new Set([...primaryTags, ...secondaryTags])];
    if (mergedTags.length > 0) { updateFields.push(`tags = $${idx++}`); updateParams.push(JSON.stringify(mergedTags)); }

    const primaryCustomFields = Array.isArray(primary.custom_fields) ? primary.custom_fields : (typeof primary.custom_fields === 'string' ? JSON.parse(primary.custom_fields || '[]') : []);
    const secondaryCustomFields = Array.isArray(secondary.custom_fields) ? secondary.custom_fields : (typeof secondary.custom_fields === 'string' ? JSON.parse(secondary.custom_fields || '[]') : []);
    const mergedCustomFields = [...primaryCustomFields, ...secondaryCustomFields];
    if (mergedCustomFields.length > 0) { updateFields.push(`custom_fields = $${idx++}`); updateParams.push(JSON.stringify(mergedCustomFields)); }

    if (updateFields.length > 0) {
      updateFields.push(`updated_at = NOW()`);
      updateParams.push(primary_id, wsId);
      await db.query(`UPDATE leads SET ${updateFields.join(', ')} WHERE id = $${idx++} AND workspace_id = $${idx++}`, updateParams);
    }

    await db.query('UPDATE lead_activities SET lead_id = $1 WHERE lead_id = $2 AND workspace_id = $3', [primary_id, secondary_id, wsId]);
    await db.query('UPDATE calls SET lead_id = $1 WHERE lead_id = $2 AND workspace_id = $3', [primary_id, secondary_id, wsId]);
    await db.query('UPDATE emails SET lead_id = $1 WHERE lead_id = $2 AND workspace_id = $3', [primary_id, secondary_id, wsId]);
    await db.query('UPDATE whatsapp_messages SET lead_id = $1 WHERE lead_id = $2 AND workspace_id = $3', [primary_id, secondary_id, wsId]);
    await db.query('UPDATE sms_messages SET lead_id = $1 WHERE lead_id = $2 AND workspace_id = $3', [primary_id, secondary_id, wsId]);
    await db.query('UPDATE follow_ups SET lead_id = $1 WHERE lead_id = $2 AND workspace_id = $3', [primary_id, secondary_id, wsId]);

    await db.query('DELETE FROM leads WHERE id = $1 AND workspace_id = $2', [secondary_id, wsId]);

    await logActivity(wsId, primary_id, req.user.id, 'lead_merged', `Merged lead ${secondary.first_name} ${secondary.last_name} into this lead`, { merged_lead_id: secondary_id });
    await updateLeadScore(primary_id);
    await cacheDelPattern(`leads:${wsId}:*`);

    const mergedResult = await db.query('SELECT * FROM leads WHERE id = $1 AND workspace_id = $2', [primary_id, wsId]);
    res.json({ message: 'Leads merged successfully', lead: mergedResult.rows[0] });
  } catch (err) {
    next(err);
  }
};

exports.addTimelineEntry = async (req, res, next) => {
  try {
    const wsId = req.workspaceId;
    const { id } = req.params;
    const { type, description, attachments, latitude, longitude } = req.body;

    if (!type || !description) {
      return res.status(400).json({ error: 'Type and description required' });
    }

    const leadResult = await db.query('SELECT id FROM leads WHERE id = $1 AND workspace_id = $2', [id, wsId]);
    if (leadResult.rows.length === 0) {
      return res.status(404).json({ error: 'Lead not found' });
    }

    await addTimelineEntry(wsId, id, req.user.id, type, description, attachments || [], latitude || null, longitude || null);
    await updateLeadScore(id);
    await cacheDelPattern(`leads:${wsId}:*`);

    res.status(201).json({ message: 'Timeline entry added' });
  } catch (err) {
    next(err);
  }
};
