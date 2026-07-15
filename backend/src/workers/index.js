const { Worker } = require('bullmq');
const { connection } = require('./index');
const logger = require('../utils/logger');
const db = require('../config/database');
const { sendTrackedEmail } = require('../services/emailService');
const { sendWhatsAppToLead } = require('../services/whatsappService');
const { sendSMSToLead } = require('../services/smsService');

const emailWorker = new Worker('email', async (job) => {
  const { workspaceId, leadId, userId, templateId, campaignId, sequenceId, overrideSubject, overrideBody, fromEmail, fromName } = job.data;
  const result = await sendTrackedEmail({ workspaceId, leadId, userId, templateId, campaignId, sequenceId, overrideSubject, overrideBody, fromEmail, fromName });
  if (!result.success) throw new Error(result.error || 'Email send failed');
  return result;
}, { connection, concurrency: 10 });

const whatsappWorker = new Worker('whatsapp', async (job) => {
  const { workspaceId, leadId, userId, message, templateId, mediaUrl, mediaType } = job.data;
  const result = await sendWhatsAppToLead({ workspaceId, leadId, userId, message, templateId, mediaUrl, mediaType });
  if (!result.success) throw new Error(result.error || 'WhatsApp send failed');
  return result;
}, { connection, concurrency: 5 });

const smsWorker = new Worker('sms', async (job) => {
  const { workspaceId, leadId, userId, message, templateId } = job.data;
  const result = await sendSMSToLead({ workspaceId, leadId, userId, message, templateId });
  if (!result.success) throw new Error(result.error || 'SMS send failed');
  return result;
}, { connection, concurrency: 10 });

const campaignWorker = new Worker('campaign', async (job) => {
  const { campaignId, workspaceId } = job.data;
  logger.info(`Processing campaign: ${campaignId}`);

  const campaignResult = await db.query('SELECT * FROM campaigns WHERE id = $1 AND workspace_id = $2', [campaignId, workspaceId]);
  if (campaignResult.rows.length === 0) throw new Error('Campaign not found');
  const campaign = campaignResult.rows[0];

  const recipients = await db.query(
    'SELECT cr.*, l.email, l.phone FROM campaign_recipients cr JOIN leads l ON cr.lead_id = l.id WHERE cr.campaign_id = $1 AND cr.status = $2',
    [campaignId, 'pending']
  );

  for (const recipient of recipients.rows) {
    try {
      if (campaign.channel === 'email') {
        const templateId = campaign.ab_test_enabled && recipient.variant === 'b' ? campaign.ab_variant_b_template_id : campaign.template_id;
        const result = await sendTrackedEmail({
          workspaceId, leadId: recipient.lead_id, userId: campaign.created_by,
          templateId, campaignId, overrideSubject: campaign.subject, overrideBody: campaign.body,
        });
        if (result.success) {
          await db.query('UPDATE campaign_recipients SET status = $1, sent_at = NOW() WHERE id = $2', ['sent', recipient.id]);
          await db.query('UPDATE campaigns SET sent_count = sent_count + 1 WHERE id = $1', [campaignId]);
        } else {
          await db.query('UPDATE campaign_recipients SET status = $1, error_message = $2 WHERE id = $3', ['failed', result.error, recipient.id]);
          await db.query('UPDATE campaigns SET failed_count = failed_count + 1 WHERE id = $1', [campaignId]);
        }
      } else if (campaign.channel === 'whatsapp') {
        const result = await sendWhatsAppToLead({ workspaceId, leadId: recipient.lead_id, userId: campaign.created_by, templateId: campaign.template_id, message: campaign.body });
        if (result.success) {
          await db.query('UPDATE campaign_recipients SET status = $1, sent_at = NOW() WHERE id = $2', ['sent', recipient.id]);
          await db.query('UPDATE campaigns SET sent_count = sent_count + 1 WHERE id = $1', [campaignId]);
        } else {
          await db.query('UPDATE campaign_recipients SET status = $1, error_message = $2 WHERE id = $3', ['failed', result.error, recipient.id]);
          await db.query('UPDATE campaigns SET failed_count = failed_count + 1 WHERE id = $1', [campaignId]);
        }
      } else if (campaign.channel === 'sms') {
        const result = await sendSMSToLead({ workspaceId, leadId: recipient.lead_id, userId: campaign.created_by, templateId: campaign.template_id, message: campaign.body });
        if (result.success) {
          await db.query('UPDATE campaign_recipients SET status = $1, sent_at = NOW() WHERE id = $2', ['sent', recipient.id]);
          await db.query('UPDATE campaigns SET sent_count = sent_count + 1 WHERE id = $1', [campaignId]);
        } else {
          await db.query('UPDATE campaign_recipients SET status = $1, error_message = $2 WHERE id = $3', ['failed', result.error, recipient.id]);
          await db.query('UPDATE campaigns SET failed_count = failed_count + 1 WHERE id = $1', [campaignId]);
        }
      }

      await new Promise(resolve => setTimeout(resolve, 100));
    } catch (err) {
      logger.error(`Campaign recipient error: ${err.message}`);
      await db.query('UPDATE campaign_recipients SET status = $1, error_message = $2 WHERE id = $3', ['failed', err.message, recipient.id]);
    }
  }

  await db.query('UPDATE campaigns SET status = $1, completed_at = NOW() WHERE id = $2', ['completed', campaignId]);
  return { success: true };
}, { connection, concurrency: 3 });

const emailSequenceWorker = new Worker('email-sequence', async (job) => {
  const { sequence_id, workspace_id } = job.data;
  logger.info(`Processing email sequence: ${sequence_id}`);

  const enrollments = await db.query(
    `SELECT e.*, l.email, l.first_name FROM email_sequence_enrollments e
     JOIN leads l ON e.lead_id = l.id
     WHERE e.sequence_id = $1 AND e.status = 'active' AND e.next_step_at <= NOW()`,
    [sequence_id]
  );

  for (const enrollment of enrollments.rows) {
    const stepResult = await db.query(
      'SELECT * FROM email_sequence_steps WHERE sequence_id = $1 AND step_number = $2',
      [sequence_id, enrollment.current_step]
    );

    if (stepResult.rows.length === 0) {
      await db.query('UPDATE email_sequence_enrollments SET status = $1 WHERE id = $2', ['completed', enrollment.id]);
      continue;
    }

    const step = stepResult.rows[0];
    const result = await sendTrackedEmail({
      workspaceId: workspace_id, leadId: enrollment.lead_id, sequenceId: sequence_id, templateId: step.template_id,
    });

    if (result.success) {
      const nextStepResult = await db.query(
        'SELECT * FROM email_sequence_steps WHERE sequence_id = $1 AND step_number = $2',
        [sequence_id, enrollment.current_step + 1]
      );

      if (nextStepResult.rows.length > 0) {
        const nextStep = nextStepResult.rows[0];
        const nextStepAt = new Date(Date.now() + (nextStep.delay_hours * 60 * 60 * 1000) + (nextStep.delay_days * 24 * 60 * 60 * 1000));
        await db.query(
          'UPDATE email_sequence_enrollments SET current_step = current_step + 1, last_step_at = NOW(), next_step_at = $1 WHERE id = $2',
          [nextStepAt, enrollment.id]
        );
      } else {
        await db.query('UPDATE email_sequence_enrollments SET status = $1 WHERE id = $2', ['completed', enrollment.id]);
      }
    }
  }

  return { success: true };
}, { connection, concurrency: 2 });

const notificationWorker = new Worker('notification', async (job) => {
  const { userId, title, body, data } = job.data;
  const { sendPushNotification } = require('../utils/notifications');
  await sendPushNotification(userId, title, body, data);
  return { success: true };
}, { connection, concurrency: 5 });

const reengagementWorker = new Worker('reengagement', async (job) => {
  const { workspaceId } = job.data;
  logger.info(`Running re-engagement check for workspace: ${workspaceId}`);

  const coldLeads = await db.query(
    `SELECT l.id, l.first_name, l.email FROM leads l
     WHERE l.workspace_id = $1 AND l.is_unsubscribed = false AND l.email IS NOT NULL
     AND l.stage NOT IN ('won', 'lost')
     AND NOT EXISTS (
       SELECT 1 FROM emails e WHERE e.lead_id = l.id AND e.opened_at > NOW() - INTERVAL '30 days'
     )
     AND NOT EXISTS (
       SELECT 1 FROM reengagement_sent rs WHERE rs.lead_id = l.id AND rs.sent_at > NOW() - INTERVAL '37 days'
     )`,
    [workspaceId]
  );

  for (const lead of coldLeads.rows) {
    await sendTrackedEmail({
      workspaceId, leadId: lead.id, overrideSubject: 'Quick question',
      overrideBody: `<p>Hi ${lead.first_name || ''},</p><p>It's been a while since we last spoke. Are you still interested? Let me know if I can help.</p>`,
    });
  }

  return { sent: coldLeads.rows.length };
}, { connection, concurrency: 1 });

[emailWorker, whatsappWorker, smsWorker, campaignWorker, emailSequenceWorker, notificationWorker, reengagementWorker].forEach(worker => {
  worker.on('completed', (job) => logger.info(`Worker ${worker.name} completed job ${job.id}`));
  worker.on('failed', (job, err) => logger.error(`Worker ${worker.name} failed job ${job?.id}: ${err.message}`));
});

logger.info('All workers started');

module.exports = { emailWorker, whatsappWorker, smsWorker, campaignWorker, emailSequenceWorker, notificationWorker, reengagementWorker };
