const axios = require('axios');
const db = require('../config/database');
const config = require('../config');
const logger = require('../utils/logger');

/* ═══════════════════════════════════════════════════════════════
   AUTOMATIC FACEBOOK SWITCH-ON
   A client grants Flazyn's business partner access to their Page and
   clicks Done (routes/connections.js). Flazyn's system user can then
   see the Page under the business's client pages, so — with no one on
   the Flazyn team involved — we:
     1. find the Page that belongs to the request (name / link match),
     2. give our system user access to it,
     3. subscribe our app to the Page's lead forms (leadgen webhook),
     4. store the Page on the client's Facebook integration, so the
        existing webhook (oauthService.facebookWebhook) routes leads,
     5. mark the request connected and tell the client.
   Runs right after Done and every 5 minutes (access can take a while
   to show up). Anything it can't match stays in the ops queue.
   ═══════════════════════════════════════════════════════════════ */

const GRAPH = () => `https://graph.facebook.com/${config.facebook.graphVersion || 'v21.0'}`;
const BUSINESS_ID = () => process.env.FLAZYN_META_BUSINESS_ID || '';
const SYSTEM_USER_ID = () => process.env.FLAZYN_META_SYSTEM_USER_ID || '';
const SYSTEM_TOKEN = () => process.env.FLAZYN_META_SYSTEM_TOKEN || process.env.WHATSAPP_ACCESS_TOKEN || '';
const graphError = (err) => err.response?.data?.error?.message || err.message;

const enabled = () => !!(BUSINESS_ID() && SYSTEM_TOKEN());

const norm = (s) => String(s || '').toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, ' ').trim();

/** Pages other businesses shared with Flazyn (partner access). */
async function clientPages() {
  const pages = [];
  let url = `${GRAPH()}/${BUSINESS_ID()}/client_pages`;
  let params = { fields: 'id,name,link,username', limit: 100, access_token: SYSTEM_TOKEN() };
  for (let i = 0; i < 10 && url; i += 1) {
    const r = await axios.get(url, { params });
    pages.push(...(r.data.data || []));
    url = r.data.paging?.next || null;
    params = undefined; // the "next" link carries everything
  }
  return pages;
}

/** Page ids already feeding some workspace (never hand a Page to two clients). */
async function claimedPageIds() {
  const r = await db.query("SELECT credentials->'pages' AS pages FROM integrations WHERE type = 'facebook' AND is_connected = true");
  const ids = new Set();
  for (const row of r.rows) for (const p of row.pages || []) if (p?.id && p.subscribed !== false) ids.add(String(p.id));
  return ids;
}

/** The single Page that fits this request, or null when unsure. */
function matchPage(request, workspaceName, pages) {
  const url = String(request.asset_url || '').toLowerCase();
  if (url) {
    const byUrl = pages.filter((p) => url.includes(String(p.id)) || (p.username && url.includes(String(p.username).toLowerCase())));
    if (byUrl.length === 1) return byUrl[0];
  }
  for (const wanted of [request.asset_name, workspaceName]) {
    const w = norm(wanted).replace(/\b(demo)\b/g, '').trim();
    if (!w) continue;
    const exact = pages.filter((p) => norm(p.name) === w);
    if (exact.length === 1) return exact[0];
    const loose = pages.filter((p) => norm(p.name).includes(w) || w.includes(norm(p.name)));
    if (loose.length === 1) return loose[0];
  }
  return null;
}

/** Steps 2–4: access, leadgen subscription, store on the client's integration. */
async function switchOnPage(workspaceId, page) {
  if (SYSTEM_USER_ID()) {
    try {
      await axios.post(`${GRAPH()}/${page.id}/assigned_users`, null, {
        params: { user: SYSTEM_USER_ID(), tasks: JSON.stringify(['MANAGE', 'ADVERTISE', 'ANALYZE']), business: BUSINESS_ID(), access_token: SYSTEM_TOKEN() },
      });
    } catch (err) { logger.info(`FB partner: assign system user to page ${page.id}: ${graphError(err)}`); }
  }
  const pageResp = await axios.get(`${GRAPH()}/${page.id}`, { params: { fields: 'access_token,name', access_token: SYSTEM_TOKEN() } });
  const pageToken = pageResp.data.access_token;
  if (!pageToken) throw new Error('Flazyn can see this Page but has no access to its leads yet (the client may not have switched on “Leads” access)');
  await axios.post(`${GRAPH()}/${page.id}/subscribed_apps`, null, { params: { subscribed_fields: 'leadgen', access_token: pageToken } });

  const existing = await db.query("SELECT credentials FROM integrations WHERE workspace_id = $1 AND type = 'facebook'", [workspaceId]);
  const creds = existing.rows[0]?.credentials || {};
  const pages = (creds.pages || []).filter((p) => String(p.id) !== String(page.id));
  pages.push({ id: String(page.id), name: pageResp.data.name || page.name, accessToken: pageToken, subscribed: true, via: 'partner' });
  await db.query(
    `INSERT INTO integrations (workspace_id, type, is_connected, credentials, config)
     VALUES ($1, 'facebook', true, $2, '{}'::jsonb)
     ON CONFLICT (workspace_id, type) DO UPDATE SET is_connected = true, credentials = $2, updated_at = NOW()`,
    [workspaceId, JSON.stringify({ ...creds, pages })]);
  return { id: String(page.id), name: pageResp.data.name || page.name };
}

async function markConnected(request, page) {
  const { notifyClientConnected } = require('../routes/connections');
  const row = (await db.query(
    `UPDATE connection_requests SET status = 'connected', connected_at = NOW(), updated_at = NOW(),
       ops_note = TRIM(BOTH E'\\n' FROM COALESCE(ops_note, '') || E'\\n' || $2)
     WHERE id = $1 RETURNING *`,
    [request.id, `Switched on automatically: Page “${page.name}” (${page.id})`])).rows[0];
  if (row) await notifyClientConnected(row, `Leads from your Page “${page.name}” will now show up in Flazyn automatically.`);
}

/** Try every open Facebook request (or just one). Returns a summary. */
async function runAutoConnect({ requestId = null } = {}) {
  if (!enabled()) return { skipped: 'not configured' };
  const open = await db.query(
    `SELECT c.*, w.name AS workspace_name FROM connection_requests c JOIN workspaces w ON w.id = c.workspace_id
      WHERE c.platform = 'facebook' AND c.status IN ('requested', 'in_progress') AND ($1::uuid IS NULL OR c.id = $1)
      ORDER BY c.created_at ASC LIMIT 50`, [requestId]);
  if (!open.rows.length) return { connected: 0 };

  let pages;
  try { pages = await clientPages(); } catch (err) {
    logger.warn(`FB partner: listing client pages failed: ${graphError(err)}`);
    return { error: graphError(err) };
  }
  const claimed = await claimedPageIds();
  const free = pages.filter((p) => !claimed.has(String(p.id)));
  let connected = 0;
  for (const req of open.rows) {
    const page = matchPage(req, req.workspace_name, free);
    if (!page) continue;
    try {
      const done = await switchOnPage(req.workspace_id, page);
      claimed.add(done.id);
      free.splice(free.indexOf(page), 1);
      await markConnected(req, done);
      connected += 1;
      logger.info(`FB partner: ${req.workspace_name} switched on via Page ${done.name}`);
    } catch (err) {
      const msg = graphError(err);
      logger.warn(`FB partner: switch-on for ${req.workspace_name} failed: ${msg}`);
      await db.query(
        `UPDATE connection_requests SET status = 'in_progress', updated_at = NOW(), ops_note = LEFT($2, 1000) WHERE id = $1 AND COALESCE(ops_note, '') <> LEFT($2, 1000)`,
        [req.id, `Auto switch-on failed for Page “${page.name}”: ${msg}`]);
    }
  }
  return { connected, pages_visible: pages.length, unclaimed: free.map((p) => ({ id: p.id, name: p.name, link: p.link })) };
}

/** Ops picks the Page by hand when names don't match. */
async function attachPage(requestId, pageId) {
  const req = (await db.query('SELECT * FROM connection_requests WHERE id = $1', [requestId])).rows[0];
  if (!req) throw Object.assign(new Error('Request not found'), { status: 404 });
  const claimed = await claimedPageIds();
  if (claimed.has(String(pageId))) throw Object.assign(new Error('That Page already feeds another workspace'), { status: 409 });
  const pages = await clientPages();
  const page = pages.find((p) => String(p.id) === String(pageId));
  if (!page) throw Object.assign(new Error('Flazyn has no partner access to that Page yet'), { status: 400 });
  const done = await switchOnPage(req.workspace_id, page);
  await markConnected(req, done);
  return done;
}

async function unclaimedPages() {
  if (!enabled()) return { enabled: false, pages: [] };
  const [pages, claimed] = await Promise.all([clientPages(), claimedPageIds()]);
  return { enabled: true, pages: pages.filter((p) => !claimed.has(String(p.id))) };
}

module.exports = { enabled, runAutoConnect, attachPage, unclaimedPages, matchPage };
