const twilio = require('twilio');
const config = require('../config');
const db = require('../config/database');
const logger = require('../utils/logger');

let client = null;

if (config.twilio.accountSid && config.twilio.authToken) {
  client = twilio(config.twilio.accountSid, config.twilio.authToken);
}


// MESSAGING_DRY_RUN=true: everything is processed and recorded exactly as normal, but
// nothing leaves the server (used for automated tests and staging).
const DRY_RUN = () => process.env.MESSAGING_DRY_RUN === 'true';

async function sendSMS({ to, body, workspaceId }) {
  try {
    if (DRY_RUN() || await require('../utils/demo').isDemoWorkspace(workspaceId)) {
      logger.info(`[dry-run] SMS to ${to}: ${String(body || '').slice(0, 80)}`);
      return { success: true, messageId: `dryrun-sms-${Date.now()}`, status: 'sent' };
    }
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
      if (tplResult.rows.length > 0) messageText = tplResult.rows[0].content;
    }
    if (messageText) {
      const { replaceVariables } = require('../utils/variables');
      const { loadLeadVariables } = require('../utils/leadVariables');
      messageText = replaceVariables(messageText, (await loadLeadVariables(workspaceId, leadId)) || {});
    }

    const result = await sendSMS({ to: lead.phone, body: messageText, workspaceId });

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
    const fromDigits = String(payload.From || '').replace(/\D/g, '');
    const text = String(payload.Body || '');
    if (!fromDigits) return { success: true, ignored: true };

    // Twilio retries on timeouts: never log the same message twice.
    if (payload.MessageSid) {
      const seen = await db.query('SELECT 1 FROM sms_messages WHERE twilio_message_id = $1 LIMIT 1', [payload.MessageSid]);
      if (seen.rows.length) return { success: true, duplicate: true };
    }

    // Match on the last 10 digits so +61 412…, 0412… and 61412… are the same person.
    // If several workspaces know the number, the one that last messaged it wins.
    const leadResult = await db.query(
      `SELECT l.id, l.workspace_id, l.assigned_to, l.first_name, l.last_name FROM leads l
       WHERE RIGHT(REGEXP_REPLACE(COALESCE(l.phone, ''), '\\D', '', 'g'), 10) = RIGHT($1, 10)
       ORDER BY (SELECT MAX(m.created_at) FROM sms_messages m WHERE m.lead_id = l.id AND m.direction = 'outbound') DESC NULLS LAST,
                l.created_at DESC
       LIMIT 1`,
      [fromDigits]
    );
    const lead = leadResult.rows[0];
    if (!lead) {
      logger.warn(`Inbound SMS from +${fromDigits} matched no lead`);
      return { success: true, unmatched: true };
    }

    await db.query(
      `INSERT INTO sms_messages (workspace_id, lead_id, direction, message_text, status, twilio_message_id, sent_at)
       VALUES ($1, $2, 'inbound', $3, 'delivered', $4, NOW())`,
      [lead.workspace_id, lead.id, text, payload.MessageSid || null]
    );
    await db.query(
      `INSERT INTO lead_activities (workspace_id, lead_id, type, description, metadata)
       VALUES ($1, $2, 'sms_received', $3, $4)`,
      [lead.workspace_id, lead.id, `SMS received: ${text}`, JSON.stringify({ from: `+${fromDigits}` })]
    );
    await db.query('UPDATE leads SET last_activity_at = NOW() WHERE id = $1', [lead.id]);

    if (lead.assigned_to) {
      const { sendPushNotification } = require('../utils/notifications');
      const name = [lead.first_name, lead.last_name].filter(Boolean).join(' ') || `+${fromDigits}`;
      await sendPushNotification(lead.assigned_to, 'SMS reply', `${name}: ${text.slice(0, 80)}`, { type: 'sms_reply', leadId: lead.id });
    }
    const { updateLeadScore } = require('../utils/activityLog');
    await updateLeadScore(lead.id).catch(() => {});
    return { success: true, leadId: lead.id };
  } catch (err) {
    logger.error('SMS webhook error:', err.message);
    return { success: false, error: err.message };
  }
}

module.exports = { sendSMS, sendSMSToLead, handleSMSWebhook };
