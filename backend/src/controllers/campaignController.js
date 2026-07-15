const db = require('../config/database');
const logger = require('../utils/logger');
const { enqueueJob } = require('../queues');
const { logActivity } = require('../utils/activityLog');

exports.getCampaigns = async (req, res, next) => {
  try {
    const result = await db.query(
      `SELECT c.*, u.first_name as creator_first_name, u.last_name as creator_last_name
       FROM campaigns c LEFT JOIN users u ON c.created_by = u.id
       WHERE c.workspace_id = $1 ORDER BY c.created_at DESC`,
      [req.workspaceId]
    );
    res.json({ campaigns: result.rows });
  } catch (err) { next(err); }
};

exports.getCampaign = async (req, res, next) => {
  try {
    const result = await db.query(
      `SELECT c.*, u.first_name as creator_first_name, u.last_name as creator_last_name
       FROM campaigns c LEFT JOIN users u ON c.created_by = u.id
       WHERE c.id = $1 AND c.workspace_id = $2`,
      [req.params.id, req.workspaceId]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Campaign not found' });

    const recipients = await db.query(
      `SELECT cr.*, l.first_name, l.last_name, l.email, l.phone
       FROM campaign_recipients cr JOIN leads l ON cr.lead_id = l.id
       WHERE cr.campaign_id = $1 ORDER BY cr.created_at DESC LIMIT 100`,
      [req.params.id]
    );

    res.json({ campaign: result.rows[0], recipients: recipients.rows });
  } catch (err) { next(err); }
};

exports.createCampaign = async (req, res, next) => {
  try {
    const { name, type, channel, template_id, subject, body, filter_config, scheduled_at, ab_test_enabled, ab_variant_b_template_id, ab_split_percentage } = req.body;

    let recipientCount = 0;
    let leadIds = [];

    let conditions = ['workspace_id = $1'];
    let params = [req.workspaceId];
    let paramIdx = 2;

    if (req.user.role === 'sales_agent') {
      conditions.push(`assigned_to = $${paramIdx++}`);
      params.push(req.user.id);
    }

    if (filter_config) {
      if (filter_config.stage) { conditions.push(`stage = $${paramIdx++}`); params.push(filter_config.stage); }
      if (filter_config.source) { conditions.push(`lead_source = $${paramIdx++}`); params.push(filter_config.source); }
      if (filter_config.tags && filter_config.tags.length > 0) {
        conditions.push(`tags && $${paramIdx++}`);
        params.push(filter_config.tags);
      }
      if (filter_config.city) { conditions.push(`city ILIKE $${paramIdx++}`); params.push(`%${filter_config.city}%`); }
    }

    if (channel === 'email') {
      conditions.push(`is_unsubscribed = false`);
      conditions.push(`email IS NOT NULL`);
    } else if (channel === 'whatsapp' || channel === 'sms') {
      conditions.push(`phone IS NOT NULL`);
    }

    const leadsResult = await db.query(`SELECT id FROM leads WHERE ${conditions.join(' AND ')}`, params);
    leadIds = leadsResult.rows.map(r => r.id);
    recipientCount = leadIds.length;

    const result = await db.query(
      `INSERT INTO campaigns (workspace_id, name, type, channel, template_id, subject, body, recipients_count, status, scheduled_at, created_by, filter_config, ab_test_enabled, ab_variant_b_template_id, ab_split_percentage)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15) RETURNING *`,
      [req.workspaceId, name, type || 'bulk', channel, template_id, subject, body, recipientCount,
       scheduled_at ? 'scheduled' : 'draft', scheduled_at, req.user.id, JSON.stringify(filter_config || {}),
       ab_test_enabled || false, ab_variant_b_template_id, ab_split_percentage || 50]
    );

    const campaignId = result.rows[0].id;

    for (let i = 0; i < leadIds.length; i++) {
      const variant = ab_test_enabled ? (i < leadIds.length * (ab_split_percentage / 100) ? 'a' : 'b') : 'a';
      await db.query(
        'INSERT INTO campaign_recipients (campaign_id, lead_id, workspace_id, variant) VALUES ($1, $2, $3, $4)',
        [campaignId, leadIds[i], req.workspaceId, variant]
      );
    }

    if (!scheduled_at) {
      res.json({ message: 'Campaign created as draft. Send it to start.', campaign: result.rows[0] });
    } else {
      await enqueueJob('campaign-sender', { campaignId, workspaceId: req.workspaceId, scheduledAt: scheduled_at });
      res.json({ message: 'Campaign scheduled successfully', campaign: result.rows[0] });
    }
  } catch (err) { next(err); }
};

exports.sendCampaign = async (req, res, next) => {
  try {
    const { id } = req.params;
    const campaignResult = await db.query('SELECT * FROM campaigns WHERE id = $1 AND workspace_id = $2', [id, req.workspaceId]);
    if (campaignResult.rows.length === 0) return res.status(404).json({ error: 'Campaign not found' });

    await db.query('UPDATE campaigns SET status = $1, started_at = NOW() WHERE id = $2', ['sending', id]);
    await enqueueJob('campaign-sender', { campaignId: id, workspaceId: req.workspaceId });

    res.json({ message: 'Campaign sending started' });
  } catch (err) { next(err); }
};

exports.scheduleCampaign = async (req, res, next) => {
  try {
    const { scheduled_at } = req.body;
    await db.query(
      'UPDATE campaigns SET status = $1, scheduled_at = $2 WHERE id = $3 AND workspace_id = $4',
      ['scheduled', scheduled_at, req.params.id, req.workspaceId]
    );
    await enqueueJob('campaign-sender', { campaignId: req.params.id, workspaceId: req.workspaceId, scheduledAt: scheduled_at });
    res.json({ message: 'Campaign scheduled successfully' });
  } catch (err) { next(err); }
};

exports.cancelCampaign = async (req, res, next) => {
  try {
    await db.query(
      'UPDATE campaigns SET status = $1 WHERE id = $2 AND workspace_id = $3 AND status IN ($4, $5)',
      ['cancelled', req.params.id, req.workspaceId, 'scheduled', 'sending']
    );
    res.json({ message: 'Campaign cancelled' });
  } catch (err) { next(err); }
};

exports.getCampaignStats = async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await db.query('SELECT * FROM campaigns WHERE id = $1 AND workspace_id = $2', [id, req.workspaceId]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Campaign not found' });

    const c = result.rows[0];
    const total = c.recipients_count || 1;
    res.json({
      recipientsCount: c.recipients_count,
      sentCount: c.sent_count,
      deliveredCount: c.delivered_count,
      openedCount: c.opened_count,
      clickedCount: c.clicked_count,
      repliedCount: c.replied_count,
      failedCount: c.failed_count,
      deliveryRate: ((c.delivered_count / total) * 100).toFixed(1),
      openRate: ((c.opened_count / total) * 100).toFixed(1),
      clickRate: ((c.clicked_count / total) * 100).toFixed(1),
      replyRate: ((c.replied_count / total) * 100).toFixed(1),
    });
  } catch (err) { next(err); }
};
