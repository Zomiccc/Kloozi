const logger = require('../utils/logger');

logger.info('Using in-memory job queue (BullMQ/Redis not available)');

// WhatsApp sequence processing interval
let sequenceInterval = null;
let flowTickInterval = null;
let campaignSchedulerInterval = null;
let chatAssistantInterval = null;
let accountPurgeInterval = null;
let followUpInterval = null;
let intelIntervals = [];

async function enqueueJob(queueName, data, options = {}) {
  try {
    logger.info(`Job enqueued: ${queueName}`);

    setImmediate(async () => {
      try {
        const db = require('../config/database');

        if (queueName === 'whatsapp') {
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
            "SELECT cr.* FROM campaign_recipients cr WHERE cr.campaign_id = $1 AND cr.status = 'pending' ORDER BY cr.created_at ASC",
            [campaignId]
          );
          let sent = 0;
          let failed = 0;
          for (let i = 0; i < recipients.rows.length; i++) {
            const recipient = recipients.rows[i];
            // Claim the recipient so an overlapping job can never message them twice.
            const claimed = await db.query("UPDATE campaign_recipients SET status = 'sending' WHERE id = $1 AND status = 'pending' RETURNING id", [recipient.id]);
            if (!claimed.rows.length) continue;
            // Respect "Cancel" while the campaign is going out.
            if (i % 10 === 0) {
              const st = await db.query('SELECT status FROM campaigns WHERE id = $1', [campaignId]);
              if (st.rows[0]?.status === 'cancelled') {
                await db.query("UPDATE campaign_recipients SET status = 'pending' WHERE id = $1", [recipient.id]);
                logger.info(`Campaign ${campaignId} cancelled after ${i} recipients`);
                return;
              }
            }
            let result;
            try {
              if (campaign.channel === 'email') {
                const { sendTrackedEmail } = require('../services/emailService');
                result = await sendTrackedEmail({
                  workspaceId, leadId: recipient.lead_id, userId: campaign.created_by,
                  campaignId, source: 'campaign',
                  marketingEmailId: campaign.marketing_email_id || undefined,
                  overrideSubject: campaign.marketing_email_id ? undefined : (campaign.subject || undefined),
                  overrideBody: campaign.marketing_email_id ? undefined : (campaign.body || undefined),
                });
              } else if (campaign.channel === 'whatsapp') {
                const { sendWhatsAppToLead } = require('../services/whatsappService');
                let message = campaign.body;
                if (campaign.file_id) {
                  // Each lead gets their own tracked link, so opens show up on their Interest timeline.
                  const file = (await db.query('SELECT id, name FROM content_files WHERE id = $1 AND workspace_id = $2', [campaign.file_id, workspaceId])).rows[0];
                  if (file) {
                    const trackingId = require('crypto').randomUUID();
                    await db.query('INSERT INTO content_tracking (workspace_id, file_id, lead_id, tracking_id) VALUES ($1,$2,$3,$4)', [workspaceId, file.id, recipient.lead_id, trackingId]);
                    message = `${message}\n\n${file.name}: ${require('../config').apiUrl}/api/content/track/${trackingId}`;
                  }
                }
                result = await sendWhatsAppToLead({ workspaceId, leadId: recipient.lead_id, userId: campaign.created_by, message });
              } else if (campaign.channel === 'sms') {
                const { sendSMSToLead } = require('../services/smsService');
                result = await sendSMSToLead({ workspaceId, leadId: recipient.lead_id, userId: campaign.created_by, message: campaign.body });
              } else {
                result = { success: false, error: `Unknown channel ${campaign.channel}` };
              }
            } catch (err) {
              result = { success: false, error: err.message };
            }
            if (result?.success) {
              sent++;
              await db.query("UPDATE campaign_recipients SET status = 'sent', sent_at = NOW(), error_message = NULL WHERE id = $1", [recipient.id]);
              await db.query('UPDATE campaigns SET sent_count = COALESCE(sent_count, 0) + 1 WHERE id = $1', [campaignId]);
            } else {
              failed++;
              await db.query("UPDATE campaign_recipients SET status = 'failed', error_message = $2 WHERE id = $1", [recipient.id, String(result?.error || 'unknown error').slice(0, 500)]);
              await db.query('UPDATE campaigns SET failed_count = COALESCE(failed_count, 0) + 1 WHERE id = $1', [campaignId]);
            }
            await new Promise((resolve) => setTimeout(resolve, 100));
          }
          await db.query(
            `UPDATE campaigns SET status = 'completed', completed_at = NOW(),
               sent_count = (SELECT COUNT(*) FROM campaign_recipients WHERE campaign_id = $1 AND status = 'sent'),
               failed_count = (SELECT COUNT(*) FROM campaign_recipients WHERE campaign_id = $1 AND status = 'failed')
             WHERE id = $1 AND status <> 'cancelled'`,
            [campaignId]
          );
          logger.info(`Campaign ${campaignId} finished: ${sent} sent, ${failed} failed`);
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

  // A restart mid-send leaves campaigns "sending" with recipients still pending: resume them.
  setTimeout(async () => {
    try {
      const db = require('../config/database');
      await db.query(
        `UPDATE campaign_recipients SET status = 'pending'
         WHERE status = 'sending' AND campaign_id IN (SELECT id FROM campaigns WHERE status = 'sending')`
      );
      const stuck = await db.query("SELECT id, workspace_id FROM campaigns WHERE status = 'sending'");
      for (const c of stuck.rows) {
        logger.info(`Resuming campaign ${c.id} after restart`);
        enqueueJob('campaign', { campaignId: c.id, workspaceId: c.workspace_id });
      }
    } catch (err) {
      logger.error('Campaign resume error:', err.message);
    }
  }, 5000);

  // WhatsApp sequence processing - runs every minute
  sequenceInterval = setInterval(async () => {
    try {
      const { processDueSequenceSteps } = require('../controllers/whatsappSequenceController');
      await processDueSequenceSteps();
    } catch (err) {
      logger.error('WhatsApp sequence job error:', err.message);
    }
  }, 60000); // 1 minute

  // Marketing flow engine - triggers + due steps, every minute
  flowTickInterval = setInterval(async () => {
    try {
      const { runFlowTick } = require('../services/flowEngine');
      await runFlowTick();
    } catch (err) {
      logger.error('Flow engine tick error:', err.message);
    }
  }, 60000);

  // Campaigns scheduled for a future time — picked up when due
  campaignSchedulerInterval = setInterval(async () => {
    try {
      const db = require('../config/database');
      // Claim and start in one statement so a campaign is never picked up twice.
      const due = await db.query(
        `UPDATE campaigns SET status = 'sending', started_at = NOW()
         WHERE status = 'scheduled' AND scheduled_at <= NOW()
         RETURNING id, workspace_id`
      );
      for (const c of due.rows) enqueueJob('campaign', { campaignId: c.id, workspaceId: c.workspace_id });
    } catch (err) {
      logger.error('Campaign scheduler error:', err.message);
    }
  }, 30000);

  // Chat assistant "no reply from agent in 5 minutes" rules
  chatAssistantInterval = setInterval(async () => {
    try {
      const { processNoReplyRules } = require('../services/chatAssistant');
      await processNoReplyRules();
    } catch (err) {
      logger.error('Chat assistant job error:', err.message);
    }
  }, 60000);

  // Intelligence: pre-call briefs (5 min), ghost warnings (hourly), reactivation radar (6 h)
  const intelJob = (name, fn, ms) => intelIntervals.push(setInterval(async () => {
    try { await require('../services/intelOps')[fn](); } catch (err) { logger.error(`${name} job error:`, err.message); }
  }, ms));
  intelJob('Meeting briefs', 'runMeetingBriefs', 5 * 60000);
  intelJob('Ghost watch', 'runGhostWatch', 60 * 60000);
  intelJob('Reactivation radar', 'runReactivationRadar', 6 * 60 * 60000);
  // Facebook partner access → switch the client's lead feed on automatically
  intelIntervals.push(setInterval(async () => {
    try { await require('../services/facebookPartnerService').runAutoConnect(); } catch (err) { logger.error('Facebook auto switch-on error:', err.message); }
  }, 5 * 60000));
  // Magic-link demo workspaces expire after 24 h
  intelIntervals.push(setInterval(async () => {
    try { await require('../routes/demo').purgeExpiredDemos(); } catch (err) { logger.error('Demo cleanup error:', err.message); }
  }, 60 * 60000));

  // Follow-up reminders: due now, and overdue by a day
  followUpInterval = setInterval(async () => {
    try {
      const { processFollowUpReminders } = require('../services/followUpService');
      await processFollowUpReminders();
    } catch (err) {
      logger.error('Follow-up reminder job error:', err.message);
    }
    // "Request an update": tell requesters, remind members, auto-request on idle leads
    try { await require('../services/updateRequestService').processUpdateRequests(); } catch (err) { logger.error('Update request job error:', err.message); }
  }, 60000);

  // Permanently remove accounts deleted more than 30 days ago (privacy policy promise)
  const purge = async () => {
    try {
      const { purgeDeletedAccounts } = require('../controllers/teamController');
      const n = await purgeDeletedAccounts();
      if (n > 0) logger.info(`Purged ${n} deleted account(s)`);
    } catch (err) {
      logger.error('Account purge job error:', err.message);
    }
  };
  accountPurgeInterval = setInterval(purge, 6 * 60 * 60 * 1000);
  setTimeout(purge, 30000);

  logger.info('Scheduled jobs started (WhatsApp sequences, flow engine, chat assistant, follow-up reminders: every 1 min; campaign scheduler: every 30 s; account purge: every 6 h)');
}

// Stop scheduled jobs
function stopScheduledJobs() {
  if (sequenceInterval) {
    clearInterval(sequenceInterval);
    sequenceInterval = null;
  }
  if (flowTickInterval) {
    clearInterval(flowTickInterval);
    flowTickInterval = null;
  }
  if (campaignSchedulerInterval) {
    clearInterval(campaignSchedulerInterval);
    campaignSchedulerInterval = null;
  }
  if (chatAssistantInterval) {
    clearInterval(chatAssistantInterval);
    chatAssistantInterval = null;
  }
  if (accountPurgeInterval) {
    clearInterval(accountPurgeInterval);
    accountPurgeInterval = null;
  }
  if (followUpInterval) {
    clearInterval(followUpInterval);
    followUpInterval = null;
  }
  intelIntervals.forEach(clearInterval);
  intelIntervals = [];
  logger.info('Scheduled jobs stopped');
}

module.exports = { queues: {}, enqueueJob, connection: null, startScheduledJobs, stopScheduledJobs };
