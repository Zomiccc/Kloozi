const db = require('../config/database');
const logger = require('../utils/logger');
const { enqueueJob } = require('../queues');
const { logActivity } = require('../utils/activityLog');
const { getSegmentMemberIds } = require('../services/segmentService');

exports.getCampaigns = async (req, res, next) => {
  try {
    const result = await db.query(
      `SELECT c.*, u.first_name as creator_first_name, u.last_name as creator_last_name,
              s.name as segment_name
       FROM campaigns c
       LEFT JOIN users u ON c.created_by = u.id
       LEFT JOIN segments s ON s.id = c.segment_id
       WHERE c.workspace_id = $1 ORDER BY c.created_at DESC`,
      [req.workspaceId]
    );
    res.json({ campaigns: result.rows });
  } catch (err) { next(err); }
};

exports.getCampaign = async (req, res, next) => {
  try {
    const result = await db.query(
      `SELECT c.*, u.first_name as creator_first_name, u.last_name as creator_last_name,
              s.name as segment_name
       FROM campaigns c
       LEFT JOIN users u ON c.created_by = u.id
       LEFT JOIN segments s ON s.id = c.segment_id
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

/**
 * Audience resolution — first non-empty wins:
 *   1. lead_ids     (manual selection)
 *   2. segment_id   (dynamic segment evaluated now; snapshot frozen into recipients)
 *   3. filter_config (legacy quick filters)
 * Workspace scoping always applies; sales agents are additionally scoped to
 * their own assigned leads.
 */
async function resolveAudience(wsId, req, { lead_ids, segment_id, filter_config }, channel) {
  let candidates = [];

  if (Array.isArray(lead_ids) && lead_ids.length > 0) {
    const r = await db.query(
      `SELECT id, email, phone, is_unsubscribed FROM leads
       WHERE workspace_id = $1 AND id = ANY($2::uuid[])`,
      [wsId, lead_ids]
    );
    candidates = r.rows;
  } else if (segment_id) {
    const memberIds = await getSegmentMemberIds(wsId, segment_id);
    if (memberIds.length > 0) {
      const r = await db.query(
        `SELECT id, email, phone, is_unsubscribed FROM leads
         WHERE workspace_id = $1 AND id = ANY($2::uuid[])`,
        [wsId, memberIds]
      );
      candidates = r.rows;
    }
  } else if (filter_config && typeof filter_config === 'object') {
    // Filters narrow "all leads"; an empty filter means everyone.
    const conditions = ['workspace_id = $1'];
    const params = [wsId];
    let paramIdx = 2;
    const stages = [...(Array.isArray(filter_config.stages) ? filter_config.stages : []), filter_config.stage]
      .map((x) => String(x || '').trim().toLowerCase()).filter(Boolean);
    if (stages.length) { conditions.push(`LOWER(stage) = ANY($${paramIdx++}::text[])`); params.push(stages); }
    if (filter_config.source) { conditions.push(`lead_source = $${paramIdx++}`); params.push(filter_config.source); }
    if (filter_config.city) { conditions.push(`city ILIKE $${paramIdx++}`); params.push(`%${filter_config.city}%`); }
    const tags = (Array.isArray(filter_config.tags) ? filter_config.tags : []).map((t) => String(t).trim()).filter(Boolean);
    if (tags.length > 0) {
      conditions.push(`tags ?| $${paramIdx++}::text[]`);
      params.push(tags);
    }
    const r = await db.query(`SELECT id, email, phone, is_unsubscribed FROM leads WHERE ${conditions.join(' AND ')}`, params);
    candidates = r.rows;
  }

  // Agent-level row scoping (matches existing campaign behavior)
  if (req.user.role === 'sales_agent') {
    const scoped = new Set(
      (await db.query('SELECT id FROM leads WHERE workspace_id = $1 AND assigned_to = $2',
        [wsId, req.user.id])).rows.map((r) => r.id)
    );
    candidates = candidates.filter((c) => scoped.has(c.id));
  }

  // Channel deliverability filters
  if (channel === 'email') {
    candidates = candidates.filter((c) => c.email && !c.is_unsubscribed);
  } else if (channel === 'whatsapp' || channel === 'sms') {
    candidates = candidates.filter((c) => c.phone);
  }

  // Dedup
  const seen = new Set();
  return candidates.filter((c) => !seen.has(c.id) && seen.add(c.id)).map((c) => c.id);
}

/** Accept the field names every campaign screen uses (email builder, WhatsApp wizard, SMS modal). */
async function normalizeCampaignInput(req) {
  const b = req.body || {};
  const out = {
    name: b.name, type: b.type, channel: b.channel,
    subject: b.subject || null,
    body: b.body || b.message || null,
    marketing_email_id: b.marketing_email_id || null,
    segment_id: b.segment_id || null,
    lead_ids: b.lead_ids,
    filter_config: b.filter_config,
    scheduled_at: b.scheduled_at || b.schedule || null,
    file_id: b.file_id || null,
    ab_test_enabled: b.ab_test_enabled, ab_split_percentage: b.ab_split_percentage,
  };
  const rf = b.recipient_filter;
  if (!out.filter_config && rf) {
    out.filter_config = rf.type === 'stage' ? { stages: rf.stages || [] }
      : rf.type === 'tag' ? { tags: rf.tags || [] }
        : {};
  }
  if (!out.body && b.template_id && ['whatsapp', 'sms'].includes(out.channel)) {
    const table = out.channel === 'whatsapp' ? 'whatsapp_templates' : 'sms_templates';
    const t = await db.query(`SELECT content FROM ${table} WHERE id = $1 AND workspace_id = $2`, [b.template_id, req.workspaceId]);
    out.body = t.rows[0]?.content || null;
  }
  return out;
}

exports.previewAudience = async (req, res, next) => {
  try {
    const input = await normalizeCampaignInput(req);
    const ids = await resolveAudience(req.workspaceId, req, input, input.channel);
    res.json({ count: ids.length });
  } catch (err) { next(err); }
};

exports.createCampaign = async (req, res, next) => {
  try {
    const {
      name, type, channel, subject, body, marketing_email_id,
      segment_id, lead_ids, filter_config,
      scheduled_at, ab_test_enabled, ab_split_percentage, file_id,
    } = await normalizeCampaignInput(req);

    if (!name || !String(name).trim()) return res.status(400).json({ error: 'Name is required' });
    if (!['email', 'whatsapp', 'sms'].includes(channel)) return res.status(400).json({ error: 'Invalid channel' });
    if (channel === 'email' && !marketing_email_id && !String(body || '').trim()) {
      return res.status(400).json({ error: 'Pick an email design or write a message' });
    }
    if (channel !== 'email' && !String(body || '').trim()) {
      return res.status(400).json({ error: 'Write a message or pick a template' });
    }
    if (scheduled_at && Number.isNaN(new Date(scheduled_at).getTime())) {
      return res.status(400).json({ error: 'Invalid schedule time' });
    }

    const audienceIds = await resolveAudience(req.workspaceId, req, { lead_ids, segment_id, filter_config }, channel);
    if (audienceIds.length === 0) {
      return res.status(400).json({ error: channel === 'email' ? 'No leads with an email address match this audience' : 'No leads with a phone number match this audience' });
    }

    const result = await db.query(
      `INSERT INTO campaigns
         (workspace_id, name, type, channel, subject, body, marketing_email_id, segment_id,
          recipients_count, status, scheduled_at, created_by, filter_config,
          ab_test_enabled, ab_split_percentage, file_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13::jsonb,$14,$15,$16)
       RETURNING *`,
      [req.workspaceId, name.trim(), type || 'bulk', channel, subject || null, body || null,
       marketing_email_id || null, segment_id || null, audienceIds.length,
       scheduled_at ? 'scheduled' : 'draft', scheduled_at || null, req.user.id,
       JSON.stringify(filter_config || {}), ab_test_enabled || false, ab_split_percentage || 50, file_id || null]
    );

    const campaignId = result.rows[0].id;

    for (let i = 0; i < audienceIds.length; i++) {
      const variant = ab_test_enabled ? (i < audienceIds.length * ((ab_split_percentage || 50) / 100) ? 'a' : 'b') : 'a';
      await db.query(
        'INSERT INTO campaign_recipients (campaign_id, lead_id, workspace_id, variant) VALUES ($1,$2,$3,$4)',
        [campaignId, audienceIds[i], req.workspaceId, variant]
      );
    }

    if (!scheduled_at) {
      res.json({ message: 'Campaign created as draft. Send it to start.', campaign: result.rows[0] });
    } else {
      res.json({ message: 'Campaign scheduled successfully', campaign: result.rows[0] });
      // The 30s campaign scheduler picks it up when due — no phantom job names.
    }
  } catch (err) { next(err); }
};

exports.sendCampaign = async (req, res, next) => {
  try {
    const { id } = req.params;
    const campaignResult = await db.query(
      'SELECT * FROM campaigns WHERE id = $1 AND workspace_id = $2', [id, req.workspaceId]
    );
    if (campaignResult.rows.length === 0) return res.status(404).json({ error: 'Campaign not found' });
    const campaign = campaignResult.rows[0];
    if (!['draft', 'scheduled', 'completed', 'cancelled'].includes(campaign.status)) {
      return res.status(400).json({ error: `Campaign is already ${campaign.status}` });
    }

    // Re-sending retries recipients that failed last time; already-sent ones are never messaged twice.
    await db.query("UPDATE campaign_recipients SET status = 'pending', error_message = NULL WHERE campaign_id = $1 AND status = 'failed'", [id]);
    await db.query('UPDATE campaigns SET failed_count = 0 WHERE id = $1', [id]);
    await db.query("UPDATE campaigns SET status = 'sending', started_at = NOW(), completed_at = NULL WHERE id = $1", [id]);
    enqueueJob('campaign', { campaignId: id, workspaceId: req.workspaceId });

    res.json({ message: 'Campaign sending started' });
  } catch (err) { next(err); }
};

exports.scheduleCampaign = async (req, res, next) => {
  try {
    const { scheduled_at } = req.body;
    if (!scheduled_at || Number.isNaN(new Date(scheduled_at).getTime())) return res.status(400).json({ error: 'A valid scheduled_at is required' });
    await db.query(
      "UPDATE campaigns SET status = 'scheduled', scheduled_at = $2, completed_at = NULL WHERE id = $1 AND workspace_id = $3",
      [req.params.id, scheduled_at, req.workspaceId]
    );
    res.json({ message: 'Campaign scheduled successfully' });
  } catch (err) { next(err); }
};

exports.cancelCampaign = async (req, res, next) => {
  try {
    await db.query(
      "UPDATE campaigns SET status = 'cancelled' WHERE id = $1 AND workspace_id = $2 AND status IN ('scheduled','sending')",
      [req.params.id, req.workspaceId]
    );
    res.json({ message: 'Campaign cancelled' });
  } catch (err) { next(err); }
};

exports.getCampaignStats = async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await db.query(
      'SELECT * FROM campaigns WHERE id = $1 AND workspace_id = $2', [id, req.workspaceId]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Campaign not found' });

    const c = result.rows[0];

    // Real per-recipient numbers from the send log — never trust counters alone.
    const emailStats = await db.query(
      `SELECT COUNT(*)::int AS total,
              COUNT(*) FILTER (WHERE status <> 'failed')::int AS sent,
              COUNT(*) FILTER (WHERE status = 'failed')::int AS failed,
              COUNT(*) FILTER (WHERE opened_at IS NOT NULL)::int AS opened,
              COUNT(*) FILTER (WHERE clicked_at IS NOT NULL)::int AS clicked
       FROM emails WHERE campaign_id = $1 AND source = 'campaign'`,
      [id]
    );
    const e = emailStats.rows[0];

    const convRes = await db.query(
      `SELECT COUNT(*)::int AS converted, COALESCE(SUM(l.budget), 0) AS attributed_value
       FROM campaign_recipients cr
       JOIN leads l ON l.id = cr.lead_id
       LEFT JOIN lead_stages s ON s.id = l.stage_id
       WHERE cr.campaign_id = $1 AND (s.is_won = TRUE OR LOWER(l.stage) = 'won')`,
      [id]
    );

    const total = Math.max(1, c.recipients_count || 0);
    res.json({
      recipientsCount: c.recipients_count,
      sentCount: e.sent,
      deliveredCount: c.delivered_count,
      openedCount: e.opened,
      clickedCount: e.clicked,
      repliedCount: c.replied_count,
      failedCount: e.failed,
      deliveryRate: (((e.sent - e.failed) / total) * 100).toFixed(1),
      openRate: ((e.opened / total) * 100).toFixed(1),
      clickRate: ((e.clicked / total) * 100).toFixed(1),
      replyRate: ((c.replied_count / total) * 100).toFixed(1),
      convertedCount: convRes.rows[0].converted,
      attributedValue: Number(convRes.rows[0].attributed_value),
      valueBasis: 'lead_budget',
    });
  } catch (err) { next(err); }
};
