const logger = require('../utils/logger');

logger.info('Using in-memory job queue (BullMQ/Redis not available)');

async function enqueueJob(queueName, data, options = {}) {
  try {
    logger.info(`Job enqueued: ${queueName}`);

    setImmediate(async () => {
      try {
        const db = require('../config/database');

        if (queueName === 'email') {
          const { sendTrackedEmail } = require('../services/emailService');
          await sendTrackedEmail(data);
        } else if (queueName === 'whatsapp') {
          const { sendWhatsAppToLead } = require('../services/whatsappService');
          await sendWhatsAppToLead(data);
        } else if (queueName === 'sms') {
          const { sendSMSToLead } = require('../services/smsService');
          await sendSMSToLead(data);
        } else if (queueName === 'notification') {
          const { sendPushNotification } = require('../utils/notifications');
          await sendPushNotification(data.userId, data.title, data.body, data.data);
        } else if (queueName === 'campaign') {
          const { campaignId, workspaceId } = data;
          const campaignResult = db.query('SELECT * FROM campaigns WHERE id = ? AND workspace_id = ?', [campaignId, workspaceId]);
          if (campaignResult.rows.length === 0) return;
          const campaign = campaignResult.rows[0];
          const recipients = db.query(
            'SELECT cr.*, l.email, l.phone FROM campaign_recipients cr JOIN leads l ON cr.lead_id = l.id WHERE cr.campaign_id = ? AND cr.status = ?',
            [campaignId, 'pending']
          );
          for (const recipient of recipients.rows) {
            try {
              if (campaign.channel === 'email') {
                const { sendTrackedEmail } = require('../services/emailService');
                const result = await sendTrackedEmail({
                  workspaceId, leadId: recipient.lead_id, userId: campaign.created_by,
                  templateId: campaign.template_id, campaignId, overrideSubject: campaign.subject, overrideBody: campaign.body,
                });
                if (result.success) {
                  db.query("UPDATE campaign_recipients SET status = 'sent', sent_at = datetime('now') WHERE id = ?", [recipient.id]);
                  db.query('UPDATE campaigns SET sent_count = sent_count + 1 WHERE id = ?', [campaignId]);
                }
              }
              await new Promise(resolve => setTimeout(resolve, 100));
            } catch (err) {
              logger.error(`Campaign recipient error: ${err.message}`);
            }
          }
          db.query("UPDATE campaigns SET status = 'completed', completed_at = datetime('now') WHERE id = ?", [campaignId]);
        }
      } catch (err) {
        logger.error(`Job execution error (${queueName}):`, err.message);
      }
    });

    return { id: Date.now().toString() };
  } catch (err) {
    logger.error('Enqueue error:', err.message);
    throw err;
  }
}

module.exports = { queues: {}, enqueueJob, connection: null };
