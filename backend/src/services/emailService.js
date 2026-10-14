const sgMail = require('@sendgrid/mail');
const config = require('../config');
const db = require('../config/database');
const logger = require('../utils/logger');
const crypto = require('crypto');
const { replaceVariables } = require('../utils/variables');

sgMail.setApiKey(config.sendgrid.apiKey);

// ─── Public tracking endpoints (served by routes/marketing.js — no auth) ───
const trackOpenUrl = (trackingId) => `${config.apiUrl}/api/marketing/track/open/${trackingId}`;
const trackClickUrl = (trackingId, url) =>
  `${config.apiUrl}/api/marketing/track/click/${trackingId}?url=${encodeURIComponent(url)}`;
const unsubscribeUrl = (trackingId) => `${config.apiUrl}/api/marketing/unsubscribe/${trackingId}`;

// Wrap every link in the HTML so clicks route through our tracker first.
function wrapLinksForTracking(html, trackingId) {
  if (!html || !trackingId) return html;
  return html.replace(/href\s*=\s*"(https?:\/\/[^"]+)"/gi, (match, url) => {
    // Don't re-wrap tracker or unsubscribe links themselves
    if (url.includes('/track/') || url.includes('/unsubscribe/')) return match;
    return `href="${trackClickUrl(trackingId, url)}"`;
  });
}

function appendTrackingFooter(html, trackingId) {
  const pixel = `<img src="${trackOpenUrl(trackingId)}" width="1" height="1" style="display:none;" alt="" />`;
  const footer = `
    <div style="margin-top:24px;padding-top:16px;border-top:1px solid #e5e5e5;font-family:Arial,sans-serif;font-size:12px;color:#999999;">
      <p>You received this email because you are in contact with us. If you'd rather not receive these emails, you can <a href="${unsubscribeUrl(trackingId)}" style="color:#999999;">unsubscribe</a>.</p>
    </div>`;
  return `${html || ''}${pixel}${footer}`;
}

// ─── Plain SendGrid transport ──────────────────────────────────────────────
// Used directly by auth (welcome / OTP / password reset), team invites and
// billing alerts. No database writes here.

// MESSAGING_DRY_RUN=true: everything is processed and recorded exactly as normal, but
// nothing leaves the server (used for automated tests and staging).
const DRY_RUN = () => process.env.MESSAGING_DRY_RUN === 'true';

/** Plain-text alternative for the HTML part (spam filters penalise HTML-only mail). */
function htmlToText(html) {
  return String(html || '')
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, '')
    .replace(/<a [^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi, '$2 ($1)')
    .replace(/<(br|\/p|\/div|\/h[1-6]|\/li|\/tr)[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#39;|&rsquo;/g, "'").replace(/&quot;/g, '"')
    .replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n')
    .trim();
}

async function sendEmail({ to, subject, text, html, fromEmail, fromName, replyTo, attachments, customArgs, headers, workspaceId }) {
  try {
    if (DRY_RUN() || await require('../utils/demo').isDemoWorkspace(workspaceId)) {
      logger.info(`[dry-run] Email to ${to}: ${subject}`);
      return { success: true, messageId: `dryrun-email-${Date.now()}` };
    }
    const msg = {
      to,
      from: { email: fromEmail || config.sendgrid.fromEmail, name: fromName || config.sendgrid.fromName },
      subject,
      text,
      html,
      replyTo: replyTo || config.sendgrid.fromEmail,
    };

    if (attachments && attachments.length > 0) msg.attachments = attachments;
    if (headers) msg.headers = headers;
    // NOTE: @sendgrid/mail expects `custom_args` (snake_case) — `customArgs`
    // is silently dropped by the library, which broke event matching before.
    if (customArgs) msg.custom_args = customArgs;

    const response = await sgMail.send(msg);
    logger.info(`Email sent to ${to}: ${response[0].statusCode}`);
    return { success: true, messageId: response[0].headers['x-message-id'] || response[0].body?.message_id };
  } catch (err) {
    logger.error('SendGrid error:', err.message);
    if (err.response && err.response.body) logger.error('SendGrid details:', JSON.stringify(err.response.body));
    return { success: false, error: err.message };
  }
}

// ─── Tracked send ──────────────────────────────────────────────────────────
// The single chokepoint for every lead-facing marketing/transactional email.
// Resolves the lead, refuses unsubscribed leads, merges {{variables}},
// injects open/click tracking + unsubscribe footer, sends via SendGrid,
// logs a row into `emails` and a 'email_sent' activity on the timeline.
//
// Content sources (first non-empty wins):
//   - overrideSubject + overrideBody  (raw strings; e.g. document sharing)
//   - marketing_email_id              (email built in the Email Builder)
async function sendTrackedEmail({
  workspaceId,
  leadId,
  userId,
  overrideSubject,
  overrideBody,
  marketingEmailId = null,
  campaignId = null,
  flowId = null,
  nodeId = null,
  source = 'direct',
  fromEmail,
  fromName,
}) {
  try {
    const leadResult = await db.query(
      `SELECT l.*, u.first_name as agent_first_name, u.last_name as agent_last_name,
              u.phone as agent_phone, u.email as agent_email, w.name as company_name
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

    if (!lead.email) {
      return { success: false, error: 'Lead has no email address' };
    }
    if (lead.is_unsubscribed) {
      return { success: false, error: 'Lead has unsubscribed' };
    }

    let subject;
    let body;

    if (overrideSubject || overrideBody) {
      subject = overrideSubject || '(no subject)';
      body = overrideBody || '';
    } else if (marketingEmailId) {
      const tplResult = await db.query(
        'SELECT * FROM marketing_emails WHERE id = $1 AND workspace_id = $2',
        [marketingEmailId, workspaceId]
      );
      if (tplResult.rows.length === 0) {
        return { success: false, error: 'Email not found' };
      }
      subject = tplResult.rows[0].subject || '';
      body = tplResult.rows[0].html || '';
    } else {
      return { success: false, error: 'No email content provided' };
    }

    // Merge variables everywhere (harmless when none present).
    const { loadLeadVariables } = require('../utils/leadVariables');
    const leadData = (await loadLeadVariables(workspaceId, leadId)) || {};
    subject = replaceVariables(subject, leadData);
    body = replaceVariables(body, leadData);

    const trackingPixelId = crypto.randomUUID();
    let finalHtml = wrapLinksForTracking(body, trackingPixelId);
    finalHtml = appendTrackingFooter(finalHtml, trackingPixelId);

    const emailResult = await sendEmail({
      workspaceId,
      to: lead.email,
      subject,
      html: finalHtml,
      text: htmlToText(finalHtml) || subject,
      fromEmail,
      fromName,
      // One-click unsubscribe (required by Gmail/Yahoo for bulk senders).
      headers: {
        'List-Unsubscribe': `<${unsubscribeUrl(trackingPixelId)}>`,
        'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
      },
      customArgs: {
        tracking_id: trackingPixelId,
        lead_id: String(leadId),
        workspace_id: String(workspaceId),
      },
    });

    const insert = await db.query(
      `INSERT INTO emails
         (workspace_id, lead_id, user_id, campaign_id, sequence_id, subject, body,
          from_email, from_name, status, tracking_pixel_id, sendgrid_message_id,
          sent_at, flow_id, node_key, source)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,NOW(),$13,$14,$15)
       RETURNING id`,
      [
        workspaceId, leadId, userId, campaignId, null, subject, body,
        fromEmail || config.sendgrid.fromEmail, fromName || config.sendgrid.fromName,
        emailResult.success ? 'sent' : 'failed', trackingPixelId, emailResult.messageId || null,
        flowId, nodeId, source,
      ]
    );
    const emailRowId = insert.rows[0].id;

    if (emailResult.success) {
      await db.query(
        `INSERT INTO lead_activities (workspace_id, lead_id, user_id, type, description, metadata)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [workspaceId, leadId, userId, 'email_sent', `Email sent: ${subject}`,
         JSON.stringify({ email_id: emailRowId, source, flow_id: flowId, campaign_id: campaignId })]
      ).catch(() => {});
    }

    return { success: emailResult.success, emailId: emailRowId, trackingId: trackingPixelId, error: emailResult.error };
  } catch (err) {
    logger.error('Tracked email error:', err.message);
    return { success: false, error: err.message };
  }
}

// ─── Event state machine (fed by the SendGrid webhook + public trackers) ───
// eventData: { tracking_id, event, timestamp, reason }
async function handleEmailEvent(eventData) {
  try {
    const { tracking_id, event } = eventData;
    if (!tracking_id || !event) return;

    const emailResult = await db.query('SELECT * FROM emails WHERE tracking_pixel_id = $1', [tracking_id]);
    if (emailResult.rows.length === 0) return;

    const email = emailResult.rows[0];

    switch (event) {
      case 'processed':
      case 'delivered':
        if (email.status === 'sent') {
          await db.query("UPDATE emails SET status = 'delivered' WHERE id = $1", [email.id]);
        }
        break;

      case 'open': {
        await db.query(
          "UPDATE emails SET status = 'opened', opened_at = COALESCE(opened_at, NOW()), open_count = open_count + 1 WHERE id = $1",
          [email.id]
        );
        if (email.campaign_id) {
          await db.query('UPDATE campaigns SET opened_count = opened_count + 1 WHERE id = $1', [email.campaign_id]).catch(() => {});
        }
        if (email.user_id) {
          const { sendPushNotification } = require('../utils/notifications');
          await sendPushNotification(email.user_id, 'Email Opened',
            `Your email "${email.subject}" was opened`,
            { type: 'email_opened', leadId: email.lead_id, emailId: email.id }).catch(() => {});
        }
        break;
      }

      case 'click': {
        await db.query(
          "UPDATE emails SET status = 'clicked', clicked_at = COALESCE(clicked_at, NOW()), click_count = click_count + 1 WHERE id = $1",
          [email.id]
        );
        if (email.campaign_id) {
          await db.query('UPDATE campaigns SET clicked_count = clicked_count + 1 WHERE id = $1', [email.campaign_id]).catch(() => {});
        }
        break;
      }

      case 'bounce':
      case 'dropped': {
        await db.query(
          "UPDATE emails SET status = 'bounced', bounced_at = COALESCE(bounced_at, NOW()), error_message = $1 WHERE id = $2",
          [eventData.reason || (event === 'bounce' ? 'Bounced' : 'Dropped'), email.id]
        );
        if (email.lead_id && event === 'bounce') {
          await db.query('UPDATE leads SET is_unsubscribed = true WHERE id = $1', [email.lead_id]);
        }
        break;
      }

      case 'spamreport':
      case 'unsubscribe':
      case 'group_unsubscribe':
        if (email.lead_id) {
          await db.query('UPDATE leads SET is_unsubscribed = true WHERE id = $1', [email.lead_id]);
        }
        break;
    }
  } catch (err) {
    logger.error('Email event handler error:', err.message);
  }
}

module.exports = {
  sendEmail,
  sendTrackedEmail,
  handleEmailEvent,
  trackOpenUrl,
  trackClickUrl,
  unsubscribeUrl,
};
