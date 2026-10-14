const db = require('../config/database');
const config = require('../config');
const interest = require('../services/interestService');

// GET /api/leads/:id/interest
exports.getLeadInterest = async (req, res, next) => {
  try {
    const data = await interest.refreshLeadInterest(req.params.id, req.workspaceId);
    if (!data) return res.status(404).json({ error: 'Lead not found' });
    const lead = (await db.query('SELECT metadata FROM leads WHERE id = $1', [req.params.id])).rows[0];
    res.json({ interest: data, brief: lead?.metadata?.ai_brief || null, ai_enabled: !!process.env.OPENAI_API_KEY });
  } catch (err) { next(err); }
};

// POST /api/leads/:id/interest/brief  { force?: boolean }
exports.getBrief = async (req, res, next) => {
  try {
    const brief = await interest.generateBrief(req.workspaceId, req.params.id, { force: req.body?.force === true });
    if (!brief) return res.status(404).json({ error: 'Lead not found' });
    const { interest: data, ...rest } = brief;
    res.json({ brief: rest, interest: data, ai_enabled: !!process.env.OPENAI_API_KEY });
  } catch (err) { next(err); }
};

// GET /api/leads/:id/tracked-link?url=…  → a link that identifies this lead on your website
exports.trackedLink = async (req, res, next) => {
  try {
    const lead = (await db.query('SELECT id FROM leads WHERE id = $1 AND workspace_id = $2', [req.params.id, req.workspaceId])).rows[0];
    if (!lead) return res.status(404).json({ error: 'Lead not found' });
    const ws = (await db.query('SELECT settings FROM workspaces WHERE id = $1', [req.workspaceId])).rows[0];
    const settings = typeof ws.settings === 'string' ? JSON.parse(ws.settings) : (ws.settings || {});
    const base = String(req.query.url || settings.website_url || '');
    if (!/^https?:\/\//i.test(base)) return res.status(400).json({ error: 'Set your website URL in Automations → Website tracking first' });
    const u = new URL(base);
    u.searchParams.set('fz', interest.leadLinkToken(lead.id));
    res.json({ url: u.toString() });
  } catch (err) { next(err); }
};

// GET /api/analytics/interest-board
exports.board = async (req, res, next) => {
  try {
    const ws = req.workspaceId;
    const [live, hottest, recent, totals] = await Promise.all([
      db.query(
        `SELECT DISTINCT ON (s.lead_id) s.lead_id, s.channel, s.total_seconds, s.last_seen_at, s.started_at,
                l.first_name, l.last_name, l.phone, l.score,
                (SELECT COALESCE(v.title, v.object_key) FROM engagement_views v WHERE v.session_id = s.id ORDER BY v.last_at DESC LIMIT 1) AS looking_at,
                (SELECT v.page_number FROM engagement_views v WHERE v.session_id = s.id ORDER BY v.last_at DESC LIMIT 1) AS page
         FROM engagement_sessions s JOIN leads l ON l.id = s.lead_id
         WHERE s.workspace_id = $1 AND s.last_seen_at > NOW() - INTERVAL '3 minutes'
         ORDER BY s.lead_id, s.last_seen_at DESC`, [ws]),
      db.query(
        `SELECT id, first_name, last_name, phone, stage, score, lead_source, assigned_to,
                metadata->'interest'->>'temperature' AS temperature, metadata->'interest'->>'last_engaged_at' AS last_engaged_at,
                metadata->'ai_brief'->>'next_action' AS next_action
         FROM leads WHERE workspace_id = $1 AND score > 0 AND stage NOT IN ('won','lost')
         ORDER BY score DESC, last_activity_at DESC NULLS LAST LIMIT 25`, [ws]),
      db.query(
        `SELECT s.id, s.channel, s.total_seconds, s.started_at, s.last_seen_at, s.lead_id, l.first_name, l.last_name,
                (SELECT COALESCE(v.title, v.object_key) FROM engagement_views v WHERE v.session_id = s.id ORDER BY v.seconds DESC LIMIT 1) AS top_view
         FROM engagement_sessions s LEFT JOIN leads l ON l.id = s.lead_id
         WHERE s.workspace_id = $1 AND s.total_seconds > 0
         ORDER BY s.last_seen_at DESC LIMIT 30`, [ws]),
      db.query(
        `SELECT COUNT(*) FILTER (WHERE channel = 'web') AS web_sessions,
                COUNT(*) FILTER (WHERE channel = 'document') AS doc_sessions,
                COALESCE(SUM(total_seconds) FILTER (WHERE channel = 'document'), 0) AS doc_seconds,
                COUNT(DISTINCT lead_id) AS engaged_leads
         FROM engagement_sessions WHERE workspace_id = $1 AND started_at > NOW() - INTERVAL '7 days'`, [ws]),
    ]);
    const ws2 = (await db.query('SELECT tracking_key FROM workspaces WHERE id = $1', [ws])).rows[0];
    res.json({
      live: live.rows, hottest: hottest.rows, recent: recent.rows, totals: totals.rows[0],
      tracking_installed: (await db.query("SELECT 1 FROM engagement_sessions WHERE workspace_id = $1 AND channel = 'web' LIMIT 1", [ws])).rows.length > 0,
      snippet: `<script src="${config.apiUrl}/api/track/t.js?k=${ws2?.tracking_key}" async></script>`,
      ai_enabled: !!process.env.OPENAI_API_KEY,
    });
  } catch (err) { next(err); }
};
