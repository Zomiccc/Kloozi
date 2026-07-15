const db = require('../config/database');
const { sendWhatsAppToLead, handleWhatsAppWebhook } = require('../services/whatsappService');
const { enqueueJob } = require('../queues');

exports.getTemplates = async (req, res, next) => {
  try {
    const result = await db.query('SELECT * FROM whatsapp_templates WHERE workspace_id = $1 ORDER BY created_at DESC', [req.workspaceId]);
    res.json({ templates: result.rows });
  } catch (err) { next(err); }
};

exports.createTemplate = async (req, res, next) => {
  try {
    const { name, category, content } = req.body;
    const { extractVariables } = require('../utils/variables');
    const variables = extractVariables(content);
    const result = await db.query(
      'INSERT INTO whatsapp_templates (workspace_id, name, category, content, variables) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [req.workspaceId, name, category || 'intro', content, JSON.stringify(variables)]
    );
    res.status(201).json({ template: result.rows[0] });
  } catch (err) { next(err); }
};

exports.sendMessage = async (req, res, next) => {
  try {
    const { lead_id, message, template_id, media_url, media_type } = req.body;
    const result = await sendWhatsAppToLead({
      workspaceId: req.workspaceId, leadId: lead_id, userId: req.user.id,
      message, templateId: template_id, mediaUrl: media_url, mediaType: media_type,
    });
    if (!result.success) return res.status(400).json({ error: result.error || 'Failed to send WhatsApp message' });
    res.json({ message: 'WhatsApp message sent', messageId: result.messageId });
  } catch (err) { next(err); }
};

exports.getInbox = async (req, res, next) => {
  try {
    const { lead_id } = req.query;
    let query, params;
    if (lead_id) {
      query = 'SELECT * FROM whatsapp_messages WHERE workspace_id = $1 AND lead_id = $2 ORDER BY created_at ASC';
      params = [req.workspaceId, lead_id];
    } else {
      if (req.user.role === 'sales_agent') {
        query = `SELECT wm.* FROM whatsapp_messages wm JOIN leads l ON wm.lead_id = l.id WHERE wm.workspace_id = $1 AND l.assigned_to = $2 ORDER BY wm.created_at DESC LIMIT 100`;
        params = [req.workspaceId, req.user.id];
      } else {
        query = 'SELECT * FROM whatsapp_messages WHERE workspace_id = $1 ORDER BY created_at DESC LIMIT 100';
        params = [req.workspaceId];
      }
    }
    const result = await db.query(query, params);
    res.json({ messages: result.rows });
  } catch (err) { next(err); }
};

exports.getConversations = async (req, res, next) => {
  try {
    let query, params;
    if (req.user.role === 'sales_agent') {
      query = `SELECT l.id, l.first_name, l.last_name, l.phone,
                  (SELECT message_text FROM whatsapp_messages WHERE lead_id = l.id ORDER BY created_at DESC LIMIT 1) as last_message,
                  (SELECT created_at FROM whatsapp_messages WHERE lead_id = l.id ORDER BY created_at DESC LIMIT 1) as last_message_time,
                  (SELECT COUNT(*) FROM whatsapp_messages WHERE lead_id = l.id AND direction = 'inbound' AND status != 'read') as unread_count
               FROM leads l WHERE l.workspace_id = $1 AND l.assigned_to = $2 AND EXISTS (SELECT 1 FROM whatsapp_messages WHERE lead_id = l.id)
               ORDER BY last_message_time DESC NULLS LAST`;
      params = [req.workspaceId, req.user.id];
    } else {
      query = `SELECT l.id, l.first_name, l.last_name, l.phone, u.first_name as agent_first_name, u.last_name as agent_last_name,
                  (SELECT message_text FROM whatsapp_messages WHERE lead_id = l.id ORDER BY created_at DESC LIMIT 1) as last_message,
                  (SELECT created_at FROM whatsapp_messages WHERE lead_id = l.id ORDER BY created_at DESC LIMIT 1) as last_message_time,
                  (SELECT COUNT(*) FROM whatsapp_messages WHERE lead_id = l.id AND direction = 'inbound' AND status != 'read') as unread_count
               FROM leads l LEFT JOIN users u ON l.assigned_to = u.id
               WHERE l.workspace_id = $1 AND EXISTS (SELECT 1 FROM whatsapp_messages WHERE lead_id = l.id)
               ORDER BY last_message_time DESC NULLS LAST`;
      params = [req.workspaceId];
    }
    const result = await db.query(query, params);
    res.json({ conversations: result.rows });
  } catch (err) { next(err); }
};

exports.webhook = async (req, res, next) => {
  try {
    if (req.query['hub.verify_token'] === require('../config').whatsapp.verifyToken) {
      return res.send(req.query['hub.challenge']);
    }
    await handleWhatsAppWebhook(req.body);
    res.json({ success: true });
  } catch (err) { next(err); }
};

exports.bulkSend = async (req, res, next) => {
  try {
    const { lead_ids, template_id, message } = req.body;
    await enqueueJob('whatsapp-bulk-send', { workspaceId: req.workspaceId, userId: req.user.id, leadIds: lead_ids, templateId: template_id, message });
    res.json({ message: 'WhatsApp bulk send queued', count: lead_ids.length });
  } catch (err) { next(err); }
};

exports.getAutoResponder = async (req, res, next) => {
  try {
    const result = await db.query('SELECT * FROM whatsapp_auto_responder WHERE workspace_id = $1', [req.workspaceId]);
    res.json({ settings: result.rows[0] || null });
  } catch (err) { next(err); }
};

exports.updateAutoResponder = async (req, res, next) => {
  try {
    const { is_enabled, message_template, trigger_type } = req.body;
    const existing = await db.query('SELECT id FROM whatsapp_auto_responder WHERE workspace_id = $1', [req.workspaceId]);
    if (existing.rows.length > 0) {
      const result = await db.query(
        `UPDATE whatsapp_auto_responder SET is_enabled = $1, message_template = $2, trigger_type = $3, updated_at = NOW() WHERE workspace_id = $4 RETURNING *`,
        [is_enabled, message_template, trigger_type || 'new_lead', req.workspaceId]
      );
      res.json({ settings: result.rows[0] });
    } else {
      const result = await db.query(
        `INSERT INTO whatsapp_auto_responder (workspace_id, is_enabled, message_template, trigger_type) VALUES ($1, $2, $3, $4) RETURNING *`,
        [req.workspaceId, is_enabled, message_template, trigger_type || 'new_lead']
      );
      res.status(201).json({ settings: result.rows[0] });
    }
  } catch (err) { next(err); }
};

exports.getWhatsAppSequences = async (req, res, next) => {
  try {
    const result = await db.query(
      `SELECT s.*, COUNT(ss.id) as step_count,
              (SELECT COUNT(*) FROM whatsapp_sequence_enrollments e WHERE e.sequence_id = s.id AND e.status = 'active') as active_enrollments
       FROM whatsapp_sequences s LEFT JOIN whatsapp_sequence_steps ss ON s.id = ss.sequence_id
       WHERE s.workspace_id = $1 GROUP BY s.id ORDER BY s.created_at DESC`,
      [req.workspaceId]
    );
    res.json({ sequences: result.rows });
  } catch (err) { next(err); }
};

exports.createWhatsAppSequence = async (req, res, next) => {
  try {
    const { name, description, steps } = req.body;
    const seqResult = await db.query(
      'INSERT INTO whatsapp_sequences (workspace_id, name, description, created_by) VALUES ($1, $2, $3, $4) RETURNING *',
      [req.workspaceId, name, description, req.user.id]
    );
    const seqId = seqResult.rows[0].id;

    if (steps && steps.length > 0) {
      for (let i = 0; i < steps.length; i++) {
        const step = steps[i];
        await db.query(
          `INSERT INTO whatsapp_sequence_steps (sequence_id, step_number, template_id, message, delay_hours, trigger_type)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [seqId, i + 1, step.template_id || null, step.message || null, step.delay_hours || 0, step.trigger_type || 'immediate']
        );
      }
    }
    res.status(201).json({ sequence: seqResult.rows[0] });
  } catch (err) { next(err); }
};

exports.enrollWhatsAppSequence = async (req, res, next) => {
  try {
    const { sequence_id, lead_ids } = req.body;
    for (const leadId of lead_ids) {
      await db.query(
        `INSERT INTO whatsapp_sequence_enrollments (sequence_id, lead_id, workspace_id, current_step, status, enrolled_at)
         VALUES ($1, $2, $3, 1, 'active', NOW())
         ON CONFLICT (sequence_id, lead_id) DO UPDATE SET status = 'active', current_step = 1`,
        [sequence_id, leadId, req.workspaceId]
      );
    }
    res.json({ message: 'Leads enrolled in WhatsApp sequence', count: lead_ids.length });
  } catch (err) { next(err); }
};

exports.getChatMonitoring = async (req, res, next) => {
  try {
    const { agent_id, date_from, date_to } = req.query;
    let conditions = ['wm.workspace_id = $1'];
    let params = [req.workspaceId];
    let paramIdx = 2;

    if (agent_id) {
      conditions.push(`l.assigned_to = $${paramIdx++}`);
      params.push(agent_id);
    }
    if (date_from) {
      conditions.push(`wm.sent_at >= $${paramIdx++}`);
      params.push(date_from);
    }
    if (date_to) {
      conditions.push(`wm.sent_at <= $${paramIdx++}`);
      params.push(date_to);
    }

    const conversations = await db.query(
      `SELECT l.id as lead_id, l.first_name, l.last_name, l.phone, u.first_name as agent_first_name, u.last_name as agent_last_name, u.id as agent_id,
              COUNT(CASE WHEN wm.direction = 'outbound' THEN 1 END) as outbound_count,
              COUNT(CASE WHEN wm.direction = 'inbound' THEN 1 END) as inbound_count,
              MAX(wm.sent_at) as last_message_time
       FROM whatsapp_messages wm
       JOIN leads l ON wm.lead_id = l.id
       LEFT JOIN users u ON l.assigned_to = u.id
       WHERE ${conditions.join(' AND ')}
       GROUP BY l.id, l.first_name, l.last_name, l.phone, u.first_name, u.last_name, u.id
       ORDER BY last_message_time DESC LIMIT 200`,
      params
    );

    const agentStats = await db.query(
      `SELECT u.id, u.first_name, u.last_name,
              COUNT(DISTINCT wm.lead_id) as unique_leads_contacted,
              COUNT(CASE WHEN wm.direction = 'outbound' THEN 1 END) as outbound_messages,
              COUNT(CASE WHEN wm.direction = 'inbound' THEN 1 END) as inbound_messages,
              COUNT(CASE WHEN wm.direction = 'outbound' AND wm.sent_at > NOW() - INTERVAL '24 hours' THEN 1 END) as messages_today
       FROM users u LEFT JOIN whatsapp_messages wm ON u.id = wm.user_id AND wm.workspace_id = $1
       WHERE u.workspace_id = $1 AND u.role = 'sales_agent'
       GROUP BY u.id, u.first_name, u.last_name ORDER BY outbound_messages DESC`,
      [req.workspaceId]
    );

    res.json({ conversations: conversations.rows, agentStats: agentStats.rows });
  } catch (err) { next(err); }
};

exports.getConversationDetail = async (req, res, next) => {
  try {
    const { lead_id } = req.params;
    const leadResult = await db.query(
      `SELECT l.*, u.first_name as agent_first_name, u.last_name as agent_last_name FROM leads l LEFT JOIN users u ON l.assigned_to = u.id WHERE l.id = $1 AND l.workspace_id = $2`,
      [lead_id, req.workspaceId]
    );
    if (leadResult.rows.length === 0) return res.status(404).json({ error: 'Lead not found' });

    const messages = await db.query(
      `SELECT wm.*, u.first_name as sender_first_name, u.last_name as sender_last_name
       FROM whatsapp_messages wm LEFT JOIN users u ON wm.user_id = u.id
       WHERE wm.lead_id = $1 AND wm.workspace_id = $2 ORDER BY wm.sent_at ASC`,
      [lead_id, req.workspaceId]
    );

    res.json({ lead: leadResult.rows[0], messages: messages.rows });
  } catch (err) { next(err); }
};
