const express = require('express');
const db = require('../config/database');
const config = require('../config');
const logger = require('../utils/logger');
const { authenticate, requireAdminOrAbove } = require('../middleware/auth');
const { sendPushNotification } = require('../utils/notifications');

/* ═══════════════════════════════════════════════════════════════
   MANAGED CONNECTIONS — "Connect Facebook / LinkedIn / TikTok" while
   platform approvals are pending. The client grants Flazyn partner
   access inside their own ad platform (one screen, Flazyn's ID
   pre-filled to copy), clicks Done, and the Flazyn team switches the
   lead feed on. The request flips to Connected by itself when the
   first lead arrives (see connectorService.recordDelivery).
   ═══════════════════════════════════════════════════════════════ */

const PLATFORMS = ['facebook', 'linkedin', 'tiktok'];
const STATUSES = ['requested', 'in_progress', 'needs_client', 'connected', 'cancelled'];

function platformIds() {
  return {
    facebook: { business_id: process.env.FLAZYN_META_BUSINESS_ID || '', name: 'Flazyn (HB&YM PTY LTD)' },
    linkedin: { member_name: process.env.FLAZYN_LINKEDIN_MEMBER || 'Flazyn Connect', profile_url: process.env.FLAZYN_LINKEDIN_PROFILE_URL || '', email: process.env.PLATFORM_OPS_EMAIL || 'hello@flazyn.com' },
    tiktok: { business_center_id: process.env.FLAZYN_TIKTOK_BC_ID || '', name: 'Flazyn' },
  };
}

function isPlatformAdmin(user) {
  if (!user) return false;
  if (user.role === 'super_admin') return true;
  const list = String(process.env.PLATFORM_ADMIN_EMAILS || '').split(',').map((e) => e.trim().toLowerCase()).filter(Boolean);
  return list.includes(String(user.email || '').toLowerCase());
}
const requirePlatformAdmin = (req, res, next) => (isPlatformAdmin(req.user) ? next() : res.status(403).json({ error: 'Flazyn team only' }));

async function notifyOps(title, body, data) {
  try {
    const list = String(process.env.PLATFORM_ADMIN_EMAILS || '').split(',').map((e) => e.trim().toLowerCase()).filter(Boolean);
    const admins = await db.query(`SELECT id FROM users WHERE status = 'active' AND (role = 'super_admin' OR LOWER(email) = ANY($1))`, [list]);
    for (const a of admins.rows) await sendPushNotification(a.id, title, body, data);
    const to = process.env.PLATFORM_OPS_EMAIL;
    if (to) {
      const { sendEmail } = require('../services/emailService');
      await sendEmail({ to, subject: `[Flazyn ops] ${title}`, text: `${body}\n\nOpen: ${config.webUrl}/app/admin/connections`, html: `<p>${body}</p><p><a href="${config.webUrl}/app/admin/connections">Open Connections</a></p>` });
    }
  } catch (err) { logger.error(`Ops notify failed: ${err.message}`); }
}

async function notifyClient(reqRow, title, body) {
  const users = await db.query(
    `SELECT id FROM users WHERE workspace_id = $1 AND status = 'active' AND (id = $2 OR role IN ('admin','super_admin'))`,
    [reqRow.workspace_id, reqRow.requested_by]);
  for (const u of users.rows) await sendPushNotification(u.id, title, body, { type: 'connection_update', platform: reqRow.platform });
}

const LABEL = { facebook: 'Facebook & Instagram', linkedin: 'LinkedIn', tiktok: 'TikTok' };

/** Called by the connector when a real lead arrives: first lead = connected. */
async function markConnectedOnLead(workspaceId, source) {
  const platform = source === 'instagram' ? 'facebook' : source;
  if (!PLATFORMS.includes(platform)) return;
  const r = await db.query(
    `UPDATE connection_requests SET status = 'connected', connected_at = NOW(), updated_at = NOW()
     WHERE workspace_id = $1 AND platform = $2 AND status IN ('requested','in_progress','needs_client') RETURNING *`,
    [workspaceId, platform]);
  for (const row of r.rows) await notifyClient(row, `${LABEL[platform]} is connected ✓`, 'Your first lead just arrived. New leads will now show up in Flazyn automatically.');
}

const router = express.Router();
router.use(authenticate);

// ── Client side ──
router.get('/', async (req, res, next) => {
  try {
    const r = await db.query(
      `SELECT DISTINCT ON (platform) * FROM connection_requests WHERE workspace_id = $1 AND status <> 'cancelled'
       ORDER BY platform, created_at DESC`, [req.workspaceId]);
    res.json({ requests: r.rows, flazyn: platformIds(), is_platform_admin: isPlatformAdmin(req.user) });
  } catch (err) { next(err); }
});

router.post('/', requireAdminOrAbove, async (req, res, next) => {
  try {
    const platform = String(req.body?.platform || '').toLowerCase();
    if (!PLATFORMS.includes(platform)) return res.status(400).json({ error: 'Unknown platform' });
    const asset = String(req.body?.asset_name || '').trim().slice(0, 255);
    const open = await db.query(
      `SELECT * FROM connection_requests WHERE workspace_id = $1 AND platform = $2 AND status IN ('requested','in_progress','needs_client','connected') ORDER BY created_at DESC LIMIT 1`,
      [req.workspaceId, platform]);
    let row;
    if (open.rows[0] && open.rows[0].status !== 'connected') {
      row = (await db.query(
        `UPDATE connection_requests SET status = 'requested', asset_name = COALESCE(NULLIF($2,''), asset_name), asset_url = COALESCE(NULLIF($3,''), asset_url),
           client_note = COALESCE(NULLIF($4,''), client_note), message_to_client = NULL, updated_at = NOW() WHERE id = $1 RETURNING *`,
        [open.rows[0].id, asset, String(req.body?.asset_url || ''), String(req.body?.client_note || '')])).rows[0];
    } else {
      row = (await db.query(
        `INSERT INTO connection_requests (workspace_id, platform, asset_name, asset_url, client_note, requested_by)
         VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
        [req.workspaceId, platform, asset || null, req.body?.asset_url || null, req.body?.client_note || null, req.user.id])).rows[0];
    }
    const ws = (await db.query('SELECT name FROM workspaces WHERE id = $1', [req.workspaceId])).rows[0];
    notifyOps(`${ws?.name || 'A client'} wants ${LABEL[platform]} connected`,
      `${ws?.name || 'A client'} granted access${asset ? ` for "${asset}"` : ''}. Switch on their lead feed.`,
      { type: 'connection_request', requestId: row.id });
    // Facebook: try to switch the feed on by ourselves straight away (partner access is usually visible within seconds).
    if (platform === 'facebook') {
      setTimeout(() => require('../services/facebookPartnerService').runAutoConnect({ requestId: row.id })
        .catch((err) => logger.warn(`FB auto switch-on: ${err.message}`)), 2000);
    }
    res.status(201).json({ request: row });
  } catch (err) { next(err); }
});

router.delete('/:id', requireAdminOrAbove, async (req, res, next) => {
  try {
    await db.query(`UPDATE connection_requests SET status = 'cancelled', updated_at = NOW() WHERE id = $1 AND workspace_id = $2`, [req.params.id, req.workspaceId]);
    res.json({ ok: true });
  } catch (err) { next(err); }
});

// ── Flazyn team ──
router.get('/admin/all', requirePlatformAdmin, async (req, res, next) => {
  try {
    const status = STATUSES.includes(req.query.status) ? req.query.status : null;
    const r = await db.query(
      `SELECT c.*, w.name AS workspace_name, w.account_token, u.first_name, u.last_name, u.email AS requester_email
       FROM connection_requests c JOIN workspaces w ON w.id = c.workspace_id LEFT JOIN users u ON u.id = c.requested_by
       WHERE ($1::text IS NULL OR c.status = $1) ORDER BY
         CASE c.status WHEN 'requested' THEN 0 WHEN 'in_progress' THEN 1 WHEN 'needs_client' THEN 2 WHEN 'connected' THEN 3 ELSE 4 END, c.created_at DESC
       LIMIT 300`, [status]);
    const { ensureToken } = require('../services/connectorService');
    const rows = [];
    for (const row of r.rows) {
      const token = row.account_token || await ensureToken(row.workspace_id);
      const { account_token: _t, ...rest } = row;
      rows.push({ ...rest, lead_link: `${config.apiUrl}/api/integrations/connect/${token}/${row.platform}` });
    }
    res.json({ requests: rows, public_url_ok: !/localhost|127\.0\.0\.1/.test(config.apiUrl) });
  } catch (err) { next(err); }
});

router.put('/admin/:id', requirePlatformAdmin, async (req, res, next) => {
  try {
    const { status, ops_note, message_to_client } = req.body || {};
    if (status && !STATUSES.includes(status)) return res.status(400).json({ error: 'Unknown status' });
    const r = await db.query(
      `UPDATE connection_requests SET status = COALESCE($2, status), ops_note = COALESCE($3, ops_note),
         message_to_client = CASE WHEN $2 = 'needs_client' THEN COALESCE($4, message_to_client) WHEN $2 IS NOT NULL THEN NULL ELSE message_to_client END,
         connected_at = CASE WHEN $2 = 'connected' THEN NOW() ELSE connected_at END, updated_at = NOW()
       WHERE id = $1 RETURNING *`,
      [req.params.id, status || null, ops_note ?? null, message_to_client ?? null]);
    const row = r.rows[0];
    if (!row) return res.status(404).json({ error: 'Not found' });
    if (status === 'connected') await notifyClient(row, `${LABEL[row.platform]} is connected ✓`, 'New leads will now show up in Flazyn automatically.');
    if (status === 'needs_client') await notifyClient(row, `One quick thing for your ${LABEL[row.platform]} connection`, message_to_client || 'Please check the access you gave Flazyn.');
    res.json({ request: row });
  } catch (err) { next(err); }
});

router.post('/admin/:id/test', requirePlatformAdmin, async (req, res, next) => {
  try {
    const row = (await db.query('SELECT * FROM connection_requests WHERE id = $1', [req.params.id])).rows[0];
    if (!row) return res.status(404).json({ error: 'Not found' });
    const { sendTestFor } = require('../services/connectorService');
    res.json(await sendTestFor(row.workspace_id, row.platform));
  } catch (err) { next(err); }
});

// Facebook Pages shared with Flazyn that no client is using yet, and attaching one by hand.
router.get('/admin/facebook/pages', requirePlatformAdmin, async (req, res, next) => {
  try { res.json(await require('../services/facebookPartnerService').unclaimedPages()); }
  catch (err) { res.status(502).json({ error: err.response?.data?.error?.message || err.message }); }
});
router.post('/admin/facebook/run', requirePlatformAdmin, async (req, res, next) => {
  try { res.json(await require('../services/facebookPartnerService').runAutoConnect()); } catch (err) { next(err); }
});
router.post('/admin/:id/facebook-page', requirePlatformAdmin, async (req, res, next) => {
  try { res.json({ page: await require('../services/facebookPartnerService').attachPage(req.params.id, req.body?.page_id) }); }
  catch (err) { res.status(err.status || 502).json({ error: err.response?.data?.error?.message || err.message }); }
});

module.exports = router;
module.exports.markConnectedOnLead = markConnectedOnLead;
module.exports.isPlatformAdmin = isPlatformAdmin;
module.exports.notifyClientConnected = (row, body) => notifyClient(row, `${LABEL[row.platform]} is connected ✓`, body);
