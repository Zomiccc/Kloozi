const config = require('../config');
const axios = require('axios');
const db = require('../config/database');
const logger = require('../utils/logger');

async function sendWhatsAppMessage({ to, message, templateName, mediaUrl, media_type }) {
  try {
    if (!config.whatsapp.phoneNumberId || !config.whatsapp.accessToken) {
      logger.warn('WhatsApp not configured, skipping send');
      return { success: false, error: 'WhatsApp not configured' };
    }

    const phoneNumber = to.replace(/\D/g, '');
    const url = `${config.whatsapp.apiUrl}/${config.whatsapp.phoneNumberId}/messages`;

    const body = {
      messaging_product: 'whatsapp',
      to: phoneNumber,
      type: 'text',
      text: { body: message },
    };

    if (mediaUrl && media_type) {
      body.type = media_type;
      body[media_type] = { link: mediaUrl };
    }

    if (templateName) {
      body.type = 'template';
      body.template = { name: templateName, language: { code: 'en' } };
    }

    const response = await axios.post(url, body, {
      headers: {
        Authorization: `Bearer ${config.whatsapp.accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    return { success: true, messageId: response.data.messages?.[0]?.id };
  } catch (err) {
    logger.error('WhatsApp send error:', err.response?.data || err.message);
    return { success: false, error: err.message };
  }
}

async function sendWhatsAppToLead({ workspaceId, leadId, userId, message, templateId, mediaUrl, mediaType }) {
  try {
    const leadResult = await db.query('SELECT * FROM leads WHERE id = $1 AND workspace_id = $2', [leadId, workspaceId]);
    if (leadResult.rows.length === 0) {
      return { success: false, error: 'Lead not found' };
    }

    const lead = leadResult.rows[0];
    if (!lead.phone) {
      return { success: false, error: 'Lead has no phone number' };
    }

    let templateName = null;
    let messageText = message;

    if (templateId) {
      const tplResult = await db.query('SELECT * FROM whatsapp_templates WHERE id = $1 AND workspace_id = $2', [templateId, workspaceId]);
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
        templateName = tplResult.rows[0].name;
      }
    }

    const result = await sendWhatsAppMessage({
      to: lead.phone,
      message: messageText,
      templateName,
      mediaUrl,
      media_type: mediaType,
    });

    const msgInsert = await db.query(
      `INSERT INTO whatsapp_messages (workspace_id, lead_id, user_id, direction, message_text, template_name, media_url, media_type, status, wa_message_id, sent_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW()) RETURNING id`,
      [workspaceId, leadId, userId, 'outbound', messageText, templateName, mediaUrl, mediaType,
       result.success ? 'sent' : 'failed', result.messageId || null]
    );

    if (result.success) {
      await db.query(
        `INSERT INTO lead_activities (workspace_id, lead_id, user_id, type, description, metadata)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [workspaceId, leadId, userId, 'whatsapp_sent', `WhatsApp message sent`, JSON.stringify({ message_id: msgInsert.rows[0].id })]
      );
    }

    return { success: result.success, messageId: msgInsert.rows[0].id, error: result.error };
  } catch (err) {
    logger.error('WhatsApp to lead error:', err.message);
    return { success: false, error: err.message };
  }
}

async function handleWhatsAppWebhook(payload) {
  try {
    if (payload.object) {
      const entry = payload.entry?.[0];
      const changes = entry?.changes?.[0];
      const messages = changes?.value?.messages;

      if (messages && messages.length > 0) {
        const msg = messages[0];
        const fromPhone = msg.from;
        const text = msg.text?.body || '';

        const leadResult = await db.query(
          `SELECT l.id, l.workspace_id FROM leads l WHERE REPLACE(REPLACE(l.phone, '+', ''), ' ', '') LIKE $1`,
          [`%${fromPhone}%`]
        );

        if (leadResult.rows.length > 0) {
          const lead = leadResult.rows[0];
          await db.query(
            `INSERT INTO whatsapp_messages (workspace_id, lead_id, direction, message_text, status, wa_message_id, sent_at)
             VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
            [lead.workspace_id, lead.id, 'inbound', text, 'delivered', msg.id]
          );

          await db.query(
            `INSERT INTO lead_activities (workspace_id, lead_id, type, description, metadata)
             VALUES ($1, $2, $3, $4, $5)`,
            [lead.workspace_id, lead.id, 'whatsapp_received', `WhatsApp message received: ${text}`, JSON.stringify({ from: fromPhone })]
          );

          const { sendPushNotification } = require('../utils/notifications');
          const assigneeResult = await db.query('SELECT assigned_to FROM leads WHERE id = $1', [lead.id]);
          if (assigneeResult.rows[0]?.assigned_to) {
            await sendPushNotification(assigneeResult.rows[0].assigned_to, 'WhatsApp Reply', `New WhatsApp message from a lead`, {
              type: 'whatsapp_reply', leadId: lead.id
            });
          }
        }
      }
    }
    return { success: true };
  } catch (err) {
    logger.error('WhatsApp webhook error:', err.message);
    return { success: false, error: err.message };
  }
}

module.exports = { sendWhatsAppMessage, sendWhatsAppToLead, handleWhatsAppWebhook };
