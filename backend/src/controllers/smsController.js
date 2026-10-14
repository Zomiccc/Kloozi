const db = require('../config/database');
const { sendSMSToLead, handleSMSWebhook } = require('../services/smsService');
const { enqueueJob } = require('../queues');

exports.getTemplates = async (req, res, next) => {
  try {
    const result = await db.query('SELECT * FROM sms_templates WHERE workspace_id = $1 ORDER BY created_at DESC', [req.workspaceId]);
    res.json({ templates: result.rows });
  } catch (err) { next(err); }
};

exports.createTemplate = async (req, res, next) => {
  try {
    const { name, content } = req.body;
    const { extractVariables } = require('../utils/variables');
    const variables = extractVariables(content);
    const result = await db.query(
      'INSERT INTO sms_templates (workspace_id, name, content, variables) VALUES ($1, $2, $3, $4) RETURNING *',
      [req.workspaceId, name, content, JSON.stringify(variables)]
    );
    res.status(201).json({ template: result.rows[0] });
  } catch (err) { next(err); }
};

exports.sendSMS = async (req, res, next) => {
  try {
    const { lead_id, message, template_id } = req.body;
    const result = await sendSMSToLead({ workspaceId: req.workspaceId, leadId: lead_id, userId: req.user.id, message, templateId: template_id });
    if (!result.success) return res.status(400).json({ error: result.error || 'Failed to send SMS' });
    res.json({ message: 'SMS sent', messageId: result.messageId });
  } catch (err) { next(err); }
};

exports.getInbox = async (req, res, next) => {
  try {
    const { lead_id } = req.query;
    let query, params;
    if (lead_id) {
      query = 'SELECT * FROM sms_messages WHERE workspace_id = $1 AND lead_id = $2 ORDER BY created_at ASC';
      params = [req.workspaceId, lead_id];
    } else {
      if (req.user.role === 'sales_agent') {
        query = `SELECT s.* FROM sms_messages s JOIN leads l ON s.lead_id = l.id WHERE s.workspace_id = $1 AND l.assigned_to = $2 ORDER BY s.created_at DESC LIMIT 100`;
        params = [req.workspaceId, req.user.id];
      } else {
        query = 'SELECT * FROM sms_messages WHERE workspace_id = $1 ORDER BY created_at DESC LIMIT 100';
        params = [req.workspaceId];
      }
    }
    const result = await db.query(query, params);
    res.json({ messages: result.rows });
  } catch (err) { next(err); }
};

function isFromTwilio(req) {
  const config = require('../config');
  const token = config.twilio?.authToken;
  if (!token || process.env.SMS_WEBHOOK_VERIFY === 'false') return true;
  const sig = req.get('x-twilio-signature');
  if (!sig) return false;
  const twilio = require('twilio');
  const host = req.get('x-forwarded-host') || req.get('host');
  return [`${config.apiUrl}${req.originalUrl}`, `https://${host}${req.originalUrl}`, `${req.protocol}://${host}${req.originalUrl}`]
    .some((u) => twilio.validateRequest(token, sig, u, req.body || {}));
}

exports.webhook = async (req, res, next) => {
  try {
    if (!isFromTwilio(req)) return res.status(403).send('Forbidden');
    await handleSMSWebhook(req.body);
    res.set('Content-Type', 'text/xml');
    res.send('<Response></Response>');
  } catch (err) { next(err); }
};

exports.bulkSend = async (req, res, next) => {
  try {
    const { lead_ids, template_id, message } = req.body;
    await enqueueJob('sms-bulk-send', { workspaceId: req.workspaceId, userId: req.user.id, leadIds: lead_ids, templateId: template_id, message });
    res.json({ message: 'SMS bulk send queued', count: lead_ids.length });
  } catch (err) { next(err); }
};
