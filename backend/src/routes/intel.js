const express = require('express');
const multer = require('multer');
const db = require('../config/database');
const { authenticate, requireManagerOrAbove, requireAdminOrAbove } = require('../middleware/auth');
const intel = require('../services/intelligence');
const feats = require('../services/aiFeatures');
const ops = require('../services/intelOps');
const ai = require('../services/ai');

// Audio for call recordings and voice notes: kept in memory, never stored as a file.
const audioUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
  fileFilter: (req, file, cb) => cb(null, /audio|video\/webm|octet-stream/.test(file.mimetype) || /\.(mp3|m4a|wav|webm|ogg|mp4|mpeg|mpga|aac|flac)$/i.test(file.originalname)),
});

const router = express.Router();
router.use(authenticate);

const isAgent = (req) => req.user.role === 'sales_agent';
const wrap = (fn) => (req, res, next) => fn(req, res).catch((err) => {
  if (/required|not found|Upload|Record|needs OPENAI|Could not/i.test(err.message)) return res.status(400).json({ error: err.message });
  next(err);
});

/** Agents may only work on their own leads. */
async function leadAllowed(req, res, leadId) {
  const r = await db.query('SELECT assigned_to FROM leads WHERE id = $1 AND workspace_id = $2', [leadId, req.workspaceId]);
  if (!r.rows[0]) { res.status(404).json({ error: 'Lead not found' }); return false; }
  if (isAgent(req) && r.rows[0].assigned_to && r.rows[0].assigned_to !== req.user.id) { res.status(403).json({ error: 'Not your lead' }); return false; }
  return true;
}

router.get('/status', (req, res) => res.json({ ai_enabled: ai.enabled() }));

// ── Per lead ──
router.get('/leads/:id', wrap(async (req, res) => {
  if (!(await leadAllowed(req, res, req.params.id))) return;
  res.json(await intel.leadInsights(req.workspaceId, req.params.id));
}));
router.post('/leads/:id/reply', wrap(async (req, res) => {
  if (!(await leadAllowed(req, res, req.params.id))) return;
  res.json(await feats.suggestReply(req.workspaceId, req.params.id, { draft: req.body?.draft || '' }));
}));
router.post('/leads/:id/autopsy', wrap(async (req, res) => {
  if (!(await leadAllowed(req, res, req.params.id))) return;
  res.json(await feats.autopsy(req.workspaceId, req.params.id));
}));
router.post('/leads/:id/brief', wrap(async (req, res) => {
  if (!(await leadAllowed(req, res, req.params.id))) return;
  res.json(await feats.meetingBrief(req.workspaceId, req.params.id));
}));
router.post('/leads/:id/voice', audioUpload.single('audio'), wrap(async (req, res) => {
  if (!(await leadAllowed(req, res, req.params.id))) return;
  res.json(await feats.voiceToCrm(req.workspaceId, req.params.id, req.user.id, { audio: req.file, text: req.body?.text }));
}));
router.post('/leads/:id/calls/analyze', audioUpload.single('audio'), wrap(async (req, res) => {
  if (!(await leadAllowed(req, res, req.params.id))) return;
  res.json(await feats.analyzeCall(req.workspaceId, {
    callId: req.body?.call_id, leadId: req.params.id, userId: req.user.id, audio: req.file,
    transcript: req.body?.transcript, duration: req.body?.duration,
  }));
}));
router.put('/leads/:id/deal-value', wrap(async (req, res) => {
  if (!(await leadAllowed(req, res, req.params.id))) return;
  const v = Number(req.body?.deal_value);
  if (!Number.isFinite(v) || v < 0) return res.status(400).json({ error: 'Enter a valid amount' });
  await db.query('UPDATE leads SET deal_value = $1, updated_at = NOW() WHERE id = $2', [v, req.params.id]);
  res.json({ deal_value: v });
}));
router.post('/copilot', wrap(async (req, res) => res.json(await feats.copilot(req.workspaceId, String(req.body?.text || '')))));

// ── Flows from plain English ──
router.post('/flows/from-text', requireManagerOrAbove, wrap(async (req, res) => {
  const text = String(req.body?.text || '').trim();
  if (text.length < 8) return res.status(400).json({ error: 'Describe what should happen, e.g. "When a Facebook lead comes in, send a WhatsApp, wait 2 days, then email them"' });
  res.status(201).json(await feats.flowFromText(req.workspaceId, req.user.id, text));
}));

// ── Boards ──
router.get('/boards', wrap(async (req, res) => {
  const userId = isAgent(req) ? req.user.id : null;
  const [risk, sentiment, reactivation, predictions] = await Promise.all([
    ops.riskBoard(req.workspaceId, { userId }), ops.sentimentBoard(req.workspaceId, { userId }),
    ops.reactivationList(req.workspaceId), ops.predictionAccuracy(req.workspaceId),
  ]);
  res.json({ risk, sentiment, reactivation, predictions, ai_enabled: ai.enabled() });
}));
router.post('/radar/run', requireManagerOrAbove, wrap(async (req, res) => res.json(await ops.runReactivationRadar())));

// ── Ad spend quality loop ──
router.get('/ads', requireManagerOrAbove, wrap(async (req, res) => {
  const months = Math.min(12, Math.max(1, Number(req.query.months) || 3));
  const spend = await db.query('SELECT * FROM ad_spend WHERE workspace_id = $1 ORDER BY month DESC, source', [req.workspaceId]);
  res.json({ ...(await ops.adQuality(req.workspaceId, { months })), spend: spend.rows });
}));
router.put('/ads/spend', requireManagerOrAbove, wrap(async (req, res) => {
  const { source, campaign = '', month, amount } = req.body || {};
  const m = /^\d{4}-\d{2}/.test(String(month || '')) ? `${String(month).slice(0, 7)}-01` : null;
  if (!source || !m || !(Number(amount) >= 0)) return res.status(400).json({ error: 'Source, month and amount are required' });
  const r = await db.query(
    `INSERT INTO ad_spend (workspace_id, source, campaign, month, amount) VALUES ($1,$2,$3,$4,$5)
     ON CONFLICT (workspace_id, source, campaign, month) DO UPDATE SET amount = EXCLUDED.amount RETURNING *`,
    [req.workspaceId, source, String(campaign).trim(), m, Number(amount)]);
  res.json({ spend: r.rows[0] });
}));
router.delete('/ads/spend/:id', requireManagerOrAbove, wrap(async (req, res) => {
  await db.query('DELETE FROM ad_spend WHERE id = $1 AND workspace_id = $2', [req.params.id, req.workspaceId]);
  res.json({ ok: true });
}));

// ── Smart routing ──
router.get('/routing', wrap(async (req, res) => {
  const rule = await db.query('SELECT type FROM lead_assignment_rules WHERE workspace_id = $1 LIMIT 1', [req.workspaceId]);
  const agents = (await ops.agentStats(req.workspaceId)).map(({ _closed, ...a }) => a);
  res.json({ strategy: rule.rows[0]?.type || 'least_loaded', agents });
}));
router.put('/routing', requireAdminOrAbove, wrap(async (req, res) => {
  const strategy = String(req.body?.strategy || '');
  if (!['best_fit', 'round_robin', 'least_loaded'].includes(strategy)) return res.status(400).json({ error: 'Unknown strategy' });
  const ex = await db.query('SELECT id FROM lead_assignment_rules WHERE workspace_id = $1', [req.workspaceId]);
  if (ex.rows.length) await db.query('UPDATE lead_assignment_rules SET type = $1 WHERE workspace_id = $2', [strategy, req.workspaceId]);
  else await db.query(`INSERT INTO lead_assignment_rules (workspace_id, type, rules) VALUES ($1, $2, '{}')`, [req.workspaceId, strategy]);
  res.json({ strategy });
}));

// ── Settings: competitors ──
router.get('/settings', wrap(async (req, res) => {
  const ws = (await db.query('SELECT settings FROM workspaces WHERE id = $1', [req.workspaceId])).rows[0];
  const s = intel.parseJson(ws?.settings, {});
  res.json({ competitors: Array.isArray(s.competitors) ? s.competitors : [] });
}));
router.put('/settings', requireManagerOrAbove, wrap(async (req, res) => {
  const list = (Array.isArray(req.body?.competitors) ? req.body.competitors : String(req.body?.competitors || '').split(','))
    .map((x) => String(x).trim()).filter(Boolean).slice(0, 50);
  await db.query(`UPDATE workspaces SET settings = jsonb_set(COALESCE(settings,'{}'::jsonb), '{competitors}', $1::jsonb) WHERE id = $2`, [JSON.stringify(list), req.workspaceId]);
  res.json({ competitors: list });
}));

module.exports = router;
