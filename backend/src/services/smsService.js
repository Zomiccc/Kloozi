const twilio = require('twilio');
const config = require('../config');
const db = require('../config/database');
const logger = require('../utils/logger');

let client = null;

if (config.twilio.accountSid && config.twilio.authToken) {
  client = twilio(config.twilio.accountSid, config.twilio.authToken);
}

async function sendSMS({ to, body }) {
  try {
    if (!client) {
      logger.warn('Twilio not configured, skipping SMS');
      return { success: false, error: 'SMS not configured' };
    }

    const message = await client.messages.create({
      body,
      from: config.twilio.phoneNumber,
      to,
    });

    return { success: true, messageId: message.sid, status: message.status };
  } catch (err) {
    logger.error('Twilio SMS error:', err.message);
    return { success: false, error: err.message };
  }
}

async function sendSMSToLead({ workspaceId, leadId, userId, message, templateId }) {
  try {
    const leadResult = await db.query('SELECT * FROM leads WHERE id = $1 AND workspace_id = $2', [leadId, workspaceId]);
    if (leadResult.rows.length === 0) {
      return { success: false, error: 'Lead not found' };
    }

    const lead = leadResult.rows[0];
    if (!lead.phone) {
      return { success: false, error: 'Lead has no phone number' };
    }

    let messageText = message;

    if (templateId) {
      const tplResult = await db.query('SELECT * FROM sms_templates WHERE id = $1 AND workspace_id = $2', [templateId, workspaceId]);
      if (tplResult.rows.length > 0) {
        const { replaceVariables } = require('../utils/variables');
        const leadData = {
          first_name: lead.first_name,
          last_name: lead.last_name,
          phone: lead.phone,
          email: lead.email,
          city: lead.city,
          budget: lead.budget,
          lead_source: lead.lead_source,
        };
        messageText = replaceVariables(tplResult.rows[0].content, leadData);
      }
    }

    const result = await sendSMS({ to: lead.phone, body: messageText });

    const msgInsert = await db.query(
      `INSERT INTO sms_messages (workspace_id, lead_id, user_id, direction, message_text, status, twilio_message_id, sent_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW()) RETURNING id`,
      [workspaceId, leadId, userId, 'outbound', messageText,
       result.success ? 'sent' : 'failed', result.messageId || null]
    );

    if (result.success) {
      await db.query(
        `INSERT INTO lead_activities (workspace_id, lead_id, user_id, type, description, metadata)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [workspaceId, leadId, userId, 'sms_sent', `SMS sent`, JSON.stringify({ message_id: msgInsert.rows[0].id })]
      );
    }

    return { success: result.success, messageId: msgInsert.rows[0].id, error: result.error };
  } catch (err) {
    logger.error('SMS to lead error:', err.message);
    return { success: false, error: err.message };
  }
}

async function handleSMSWebhook(payload) {
  try {
    const fromPhone = payload.From;
    const text = payload.Body;

    const leadResult = await db.query(
      `SELECT l.id, l.workspace_id FROM leads l WHERE REPLACE(REPLACE(l.phone, '+', ''), ' ', '') LIKE $1`,
      [`%${fromPhone}%`]
    );

    if (leadResult.rows.length > 0) {
      const lead = leadResult.rows[0];
      await db.query(
        `INSERT INTO sms_messages (workspace_id, lead_id, direction, message_text, status, sent_at)
         VALUES ($1, $2, $3, $4, $5, NOW())`,
        [lead.workspace_id, lead.id, 'inbound', text, 'delivered']
      );

      await db.query(
        `INSERT INTO lead_activities (workspace_id, lead_id, type, description, metadata)
         VALUES ($1, $2, $3, $4, $5)`,
        [lead.workspace_id, lead.id, 'sms_received', `SMS received: ${text}`, JSON.stringify({ from: fromPhone })]
      );

      const { sendPushNotification } = require('../utils/notifications');
      const assigneeResult = await db.query('SELECT assigned_to FROM leads WHERE id = $1', [lead.id]);
      if (assigneeResult.rows[0]?.assigned_to) {
        await sendPushNotification(assigneeResult.rows[0].assigned_to, 'SMS Reply', `New SMS from a lead`, {
          type: 'sms_reply', leadId: lead.id
        });
      }
    }

    return { success: true };
  } catch (err) {
    logger.error('SMS webhook error:', err.message);
    return { success: false, error: err.message };
  }
}

module.exports = { sendSMS, sendSMSToLead, handleSMSWebhook };
