const crypto = require('crypto');
const db = require('../config/database');
const config = require('../config');
const logger = require('../utils/logger');

// ─── Google Ads lead form webhook ───────────────────────────────────────────
// Free, no API approval needed. In Google Ads → lead form asset → "Lead delivery"
// → Webhook integration, paste our URL + key. Google POSTs JSON per lead:
//   { lead_id, google_key, is_test, campaign_id, adgroup_id, creative_id, form_id, gcl_id,
//     user_column_data: [{ column_id: 'FULL_NAME', column_name: 'Full Name', string_value }] }
// Docs: https://developers.google.com/google-ads/webhook/docs/implementation

const COLUMN_MAP = {
  FULL_NAME: 'name', FIRST_NAME: 'first_name', LAST_NAME: 'last_name',
  EMAIL: 'email', WORK_EMAIL: 'email', PHONE_NUMBER: 'phone', WORK_PHONE: 'phone',
  CITY: 'city',
};

async function getOrCreate(workspaceId) {
  const r = await db.query("SELECT * FROM integrations WHERE workspace_id = $1 AND type = 'google_ads'", [workspaceId]);
  if (r.rows[0]) return r.rows[0];
  const credentials = { webhookId: crypto.randomBytes(12).toString('hex'), key: crypto.randomBytes(18).toString('base64url') };
  const ins = await db.query(
    `INSERT INTO integrations (workspace_id, type, is_connected, credentials, config)
     VALUES ($1, 'google_ads', false, $2, '{}') ON CONFLICT (workspace_id, type) DO UPDATE SET updated_at = NOW() RETURNING *`,
    [workspaceId, JSON.stringify(credentials)]
  );
  return ins.rows[0];
}

function view(row) {
  const c = typeof row.credentials === 'string' ? JSON.parse(row.credentials) : row.credentials;
  const cfg = typeof row.config === 'string' ? JSON.parse(row.config || '{}') : (row.config || {});
  return {
    webhook_url: `${config.apiUrl}/api/integrations/google-ads/${c.webhookId}`,
    key: c.key,
    is_connected: !!row.is_connected,
    last_lead_at: cfg.last_lead_at || null,
    last_test_at: cfg.last_test_at || null,
    leads_received: cfg.leads_received || 0,
  };
}

/** GET /api/integrations/google-ads/setup */
exports.getSetup = async (req, res, next) => {
  try { res.json(view(await getOrCreate(req.workspaceId))); } catch (err) { next(err); }
};

/** POST /api/integrations/google-ads/rotate-key */
exports.rotateKey = async (req, res, next) => {
  try {
    const row = await getOrCreate(req.workspaceId);
    const c = typeof row.credentials === 'string' ? JSON.parse(row.credentials) : row.credentials;
    c.key = crypto.randomBytes(18).toString('base64url');
    const r = await db.query('UPDATE integrations SET credentials = $1, updated_at = NOW() WHERE id = $2 RETURNING *', [JSON.stringify(c), row.id]);
    res.json(view(r.rows[0]));
  } catch (err) { next(err); }
};

function mapLead(body) {
  const lead = { custom_fields: [] };
  for (const col of Array.isArray(body.user_column_data) ? body.user_column_data : []) {
    const value = col.string_value ?? col.stringValue;
    if (value === undefined || value === null || value === '') continue;
    const field = COLUMN_MAP[String(col.column_id || col.columnId || '').toUpperCase()];
    if (field && !lead[field]) lead[field] = String(value);
    else lead.custom_fields.push({ name: col.column_name || col.column_id || 'Answer', value: String(value) });
  }
  const meta = [
    ['Google lead ID', body.lead_id], ['Google campaign', body.campaign_id], ['Google ad group', body.adgroup_id],
    ['Google form', body.form_id], ['Google click ID', body.gcl_id],
  ];
  for (const [name, value] of meta) if (value) lead.custom_fields.push({ name, value: String(value) });
  return lead;
}

/** POST /api/integrations/google-ads/:webhookId (public, called by Google) */
exports.webhook = async (req, res) => {
  try {
    const r = await db.query(
      "SELECT * FROM integrations WHERE type = 'google_ads' AND credentials->>'webhookId' = $1",
      [String(req.params.webhookId || '')]
    );
    const row = r.rows[0];
    if (!row) return res.status(404).json({ error: 'Unknown webhook' });
    const c = typeof row.credentials === 'string' ? JSON.parse(row.credentials) : row.credentials;
    const body = req.body || {};
    const key = String(body.google_key || '');
    if (!key || key.length !== String(c.key).length || !crypto.timingSafeEqual(Buffer.from(key), Buffer.from(String(c.key)))) {
      logger.warn('Google Ads webhook rejected: wrong key');
      return res.status(401).json({ error: 'Invalid key' });
    }

    // Google retries until it gets a 200: the same lead_id must not create two leads.
    if (body.lead_id && !body.is_test) {
      const seen = await db.query(
        `SELECT 1 FROM leads WHERE workspace_id = $1 AND custom_fields @> $2::jsonb LIMIT 1`,
        [row.workspace_id, JSON.stringify([{ name: 'Google lead ID', value: String(body.lead_id) }])]
      );
      if (seen.rows.length) return res.status(200).json({ ok: true, duplicate: true });
    }

    const parsed = mapLead(body);
    if (body.is_test) parsed.tags = ['google-ads-test'];
    const { createLead } = require('./leadPipeline');
    const result = await createLead(row.workspace_id, { ...parsed, lead_source: 'google_ads' }, {
      source: 'google_ads', duplicateMode: 'workspace',
      activityText: body.is_test ? 'Test lead sent from Google Ads' : 'Lead captured from a Google Ads lead form',
    });

    const cfg = typeof row.config === 'string' ? JSON.parse(row.config || '{}') : (row.config || {});
    if (body.is_test) cfg.last_test_at = new Date().toISOString();
    else { cfg.last_lead_at = new Date().toISOString(); cfg.leads_received = (cfg.leads_received || 0) + 1; }
    await db.query('UPDATE integrations SET is_connected = true, config = $1, updated_at = NOW() WHERE id = $2', [JSON.stringify(cfg), row.id]);

    res.status(200).json({ ok: true, lead_id: result.lead?.id || null, status: result.status });
  } catch (err) {
    logger.error('Google Ads webhook error:', err.message);
    res.status(500).json({ error: 'Could not save lead' }); // non-200 makes Google retry
  }
};

exports.mapLead = mapLead;
