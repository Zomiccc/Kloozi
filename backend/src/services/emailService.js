const sgMail = require('@sendgrid/mail');
const config = require('../config');
const db = require('../config/database');
const logger = require('../utils/logger');
const crypto = require('crypto');

sgMail.setApiKey(config.sendgrid.apiKey);

async function sendEmail({ to, subject, text, html, fromEmail, fromName, replyTo, attachments, customArgs }) {
  try {
    const msg = {
      to,
      from: { email: fromEmail || config.sendgrid.fromEmail, name: fromName || config.sendgrid.fromName },
      subject,
      text,
      html,
      replyTo: replyTo || config.sendgrid.fromEmail,
    };

    if (attachments && attachments.length > 0) {
      msg.attachments = attachments;
    }

    if (customArgs) {
      msg.customArgs = customArgs;
    }

    const response = await sgMail.send(msg);
    logger.info(`Email sent to ${to}: ${response[0].statusCode}`);
    return { success: true, messageId: response[0].headers['x-message-id'] || response[0].body?.message_id };
  } catch (err) {
    logger.error('SendGrid error:', err.message);
    return { success: false, error: err.message };
  }
}

async function sendTrackedEmail({ workspaceId, leadId, userId, templateId, campaignId, sequenceId, overrideSubject, overrideBody, fromEmail, fromName }) {
  try {
    const leadResult = await db.query(
      `SELECT l.*, u.first_name as agent_first_name, u.last_name as agent_last_name, u.phone as agent_phone, u.email as agent_email,
              w.name as company_name
       FROM leads l
       LEFT JOIN users u ON l.assigned_to = u.id
       LEFT JOIN workspaces w ON l.workspace_id = w.id
       WHERE l.id = $1`,
      [leadId]
    );

    if (leadResult.rows.length === 0) {
      return { success: false, error: 'Lead not found' };
    }

    const lead = leadResult.rows[0];

    if (lead.is_unsubscribed) {
      return { success: false, error: 'Lead has unsubscribed' };
    }

    let template = null;
    if (templateId) {
      const tplResult = await db.query('SELECT * FROM email_templates WHERE id = $1', [templateId]);
      if (tplResult.rows.length === 0) {
        return { success: false, error: 'Template not found' };
      }
      template = tplResult.rows[0];
    }

    const { replaceVariables } = require('../utils/variables');
    const leadData = {
      first_name: lead.first_name,
      last_name: lead.last_name,
      phone: lead.phone,
      email: lead.email,
      city: lead.city,
      budget: lead.budget,
      lead_source: lead.lead_source,
      agent_name: lead.agent_first_name ? `${lead.agent_first_name} ${lead.agent_last_name}` : '',
      agent_phone: lead.agent_phone,
      agent_email: lead.agent_email,
      company_name: lead.company_name,
      custom_fields: lead.custom_fields || [],
    };

    const subject = overrideSubject || (template ? replaceVariables(template.subject, leadData) : 'No Subject');
    const body = overrideBody || (template ? replaceVariables(template.body, leadData) : '');

    const trackingPixelId = crypto.randomUUID();
    const trackingUrl = `${config.apiUrl}/api/email/track/open/${trackingPixelId}`;
    const unsubscribeUrl = `${config.apiUrl}/api/email/unsubscribe/${trackingPixelId}`;

    const trackedHtml = body + `
      <img src="${trackingUrl}" width="1" height="1" style="display:none;" alt="" />
      <div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid #eee; font-size: 12px; color: #999;">
        <p>You received this email because you showed interest in our services.</p>
        <p><a href="${unsubscribeUrl}">Unsubscribe</a></p>
      </div>
    `;

    const emailResult = await sendEmail({
      to: lead.email,
      subject,
      html: trackedHtml,
      text: subject,
      fromEmail,
      fromName,
      customArgs: { tracking_id: trackingPixelId, lead_id: leadId, workspace_id: workspaceId },
    });

    const emailInsertResult = await db.query(
      `INSERT INTO emails (workspace_id, lead_id, user_id, template_id, campaign_id, sequence_id, subject, body, from_email, from_name, status, tracking_pixel_id, sendgrid_message_id, sent_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW()) RETURNING id`,
      [workspaceId, leadId, userId, templateId, campaignId, sequenceId, subject, body,
       fromEmail || config.sendgrid.fromEmail, fromName || config.sendgrid.fromName,
       emailResult.success ? 'sent' : 'failed', trackingPixelId, emailResult.messageId || null]
    );

    if (emailResult.success) {
      await db.query(
        `INSERT INTO lead_activities (workspace_id, lead_id, user_id, type, description, metadata)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [workspaceId, leadId, userId, 'email_sent', `Email sent: ${subject}`, JSON.stringify({ email_id: emailInsertResult.rows[0].id })]
      );
    }

    return { success: emailResult.success, emailId: emailInsertResult.rows[0].id, error: emailResult.error };
  } catch (err) {
    logger.error('Tracked email error:', err.message);
    return { success: false, error: err.message };
  }
}

async function handleEmailEvent(eventData) {
  try {
    const { tracking_id, event, timestamp } = eventData;

    if (!tracking_id) return;

    const emailResult = await db.query('SELECT * FROM emails WHERE tracking_pixel_id = $1', [tracking_id]);
    if (emailResult.rows.length === 0) return;

    const email = emailResult.rows[0];

    switch (event) {
      case 'delivered':
        await db.query('UPDATE emails SET status = $1 WHERE id = $2', ['delivered', email.id]);
        break;
      case 'open':
        await db.query(
          'UPDATE emails SET status = $1, opened_at = COALESCE(opened_at, NOW()), open_count = open_count + 1 WHERE id = $2',
          ['opened', email.id]
        );
        if (email.campaign_id) {
          await db.query('UPDATE campaigns SET opened_count = opened_count + 1 WHERE id = $1', [email.campaign_id]);
        }
        if (email.lead_id) {
          const { sendPushNotification } = require('../utils/notifications');
          if (email.user_id) {
            await sendPushNotification(email.user_id, 'Email Opened', `Your email "${email.subject}" was opened`, {
              type: 'email_opened', leadId: email.lead_id, emailId: email.id
            });
          }
        }
        break;
      case 'click':
        await db.query(
          'UPDATE emails SET clicked_at = COALESCE(clicked_at, NOW()), click_count = click_count + 1 WHERE id = $2',
          ['clicked', email.id]
        );
        if (email.campaign_id) {
          await db.query('UPDATE campaigns SET clicked_count = clicked_count + 1 WHERE id = $1', [email.campaign_id]);
        }
        break;
      case 'bounce':
        await db.query('UPDATE emails SET status = $1, bounced_at = NOW(), error_message = $2 WHERE id = $3',
          ['bounced', eventData.reason || 'Bounced', email.id]);
        if (email.lead_id) {
          await db.query('UPDATE leads SET is_unsubscribed = true WHERE id = $1', [email.lead_id]);
        }
        break;
      case 'unsubscribe':
        if (email.lead_id) {
          await db.query('UPDATE leads SET is_unsubscribed = true WHERE id = $1', [email.lead_id]);
        }
        break;
    }
  } catch (err) {
    logger.error('Email event handler error:', err.message);
  }
}

module.exports = { sendEmail, sendTrackedEmail, handleEmailEvent };
