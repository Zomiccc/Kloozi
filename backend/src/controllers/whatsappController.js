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
