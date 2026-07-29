const logger = require('../utils/logger');

logger.info('Using in-memory job queue (BullMQ/Redis not available)');

// WhatsApp sequence processing interval
let sequenceInterval = null;

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
        } else if (queueName === 'whatsapp-bulk-send') {
          const { sendWhatsAppToLead } = require('../services/whatsappService');
          for (const leadId of data.leadIds) {
            try {
              await sendWhatsAppToLead({
                workspaceId: data.workspaceId,
                leadId,
                userId: data.userId,
                message: data.message,
                templateId: data.templateId,
              });
              await new Promise(resolve => setTimeout(resolve, 200));
            } catch (err) {
              logger.error(`Bulk WhatsApp error for lead ${leadId}:`, err.message);
            }
          }
        } else if (queueName === 'sms') {
          const { sendSMSToLead } = require('../services/smsService');
          await sendSMSToLead(data);
        } else if (queueName === 'notification') {
          const { sendPushNotification } = require('../utils/notifications');
          await sendPushNotification(data.userId, data.title, data.body, data.data);
        } else if (queueName === 'campaign') {
          const { campaignId, workspaceId } = data;
          const campaignResult = await db.query('SELECT * FROM campaigns WHERE id = $1 AND workspace_id = $2', [campaignId, workspaceId]);
          if (campaignResult.rows.length === 0) return;
          const campaign = campaignResult.rows[0];
          const recipients = await db.query(
            'SELECT cr.*, l.email, l.phone FROM campaign_recipients cr JOIN leads l ON cr.lead_id = l.id WHERE cr.campaign_id = $1 AND cr.status = $2',
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
                  await db.query("UPDATE campaign_recipients SET status = 'sent', sent_at = NOW() WHERE id = $1", [recipient.id]);
                  await db.query('UPDATE campaigns SET sent_count = sent_count + 1 WHERE id = $1', [campaignId]);
                }
              } else if (campaign.channel === 'whatsapp') {
                const { sendWhatsAppToLead } = require('../services/whatsappService');
                const result = await sendWhatsAppToLead({
                  workspaceId, leadId: recipient.lead_id, userId: campaign.created_by,
                  message: campaign.body,
                });
                if (result.success) {
                  await db.query("UPDATE campaign_recipients SET status = 'sent', sent_at = NOW() WHERE id = $1", [recipient.id]);
                  await db.query('UPDATE campaigns SET sent_count = sent_count + 1 WHERE id = $1', [campaignId]);
                }
              } else if (campaign.channel === 'sms') {
                const { sendSMSToLead } = require('../services/smsService');
                const result = await sendSMSToLead({
                  workspaceId, leadId: recipient.lead_id, userId: campaign.created_by,
                  message: campaign.body,
                });
                if (result.success) {
                  await db.query("UPDATE campaign_recipients SET status = 'sent', sent_at = NOW() WHERE id = $1", [recipient.id]);
                  await db.query('UPDATE campaigns SET sent_count = sent_count + 1 WHERE id = $1', [campaignId]);
                }
              }
              await new Promise(resolve => setTimeout(resolve, 100));
            } catch (err) {
              logger.error(`Campaign recipient error: ${err.message}`);
            }
          }
          await db.query("UPDATE campaigns SET status = 'completed', completed_at = NOW() WHERE id = $1", [campaignId]);
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

// Start scheduled jobs
function startScheduledJobs() {
  if (sequenceInterval) return; // Already started

  // WhatsApp sequence processing - runs every minute
  sequenceInterval = setInterval(async () => {
    try {
      const { processDueSequenceSteps } = require('../controllers/whatsappSequenceController');
      await processDueSequenceSteps();
    } catch (err) {
      logger.error('WhatsApp sequence job error:', err.message);
    }
  }, 60000); // 1 minute

  logger.info('Scheduled jobs started (WhatsApp sequences: every 1 minute)');
}

// Stop scheduled jobs
function stopScheduledJobs() {
  if (sequenceInterval) {
    clearInterval(sequenceInterval);
    sequenceInterval = null;
    logger.info('Scheduled jobs stopped');
  }
}

module.exports = { queues: {}, enqueueJob, connection: null, startScheduledJobs, stopScheduledJobs };
