const express = require('express');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const db = require('../config/database');
const config = require('../config');
const logger = require('../utils/logger');
const { authenticate } = require('../middleware/auth');
const { sendPushNotification } = require('../utils/notifications');

/* ═══════════════════════════════════════════════════════════════
   MAGIC LINK DEMO — scan a QR, get a private sandbox on your phone,
   no signup. Add your team's names, tap "Send me a test lead" and
   ~10 s later a realistic lead arrives: phone alert, auto-assigned
   to a teammate, instant WhatsApp auto-reply, then the "customer"
   replies and the AI coach suggests the next move.
   Demo workspaces never send anything (utils/demo.js) and delete
   themselves after 24 h.
   ═══════════════════════════════════════════════════════════════ */

const DEMO_HOURS = 24;
const LEAD_DELAY_MS = 9000;
const REPLY_DELAY_MS = 7000;
// ACMA-reserved fictional Australian mobile numbers: they can never reach a real person.
const FICTIONAL = ['+61491570156', '+61491570157', '+61491570158', '+61491570159', '+61491570110', '+61491570313', '+61491570737', '+61491571266', '+61491571491', '+61491571804', '+61491572549', '+61491572665', '+61491572983', '+61491573770', '+61491573087', '+61491574118', '+61491574632', '+61491575254', '+61491575789', '+61491576398', '+61491576801', '+61491577426', '+61491577644', '+61491578957', '+61491578148', '+61491578888', '+61491579212', '+61491579760', '+61491579455'];
const PEOPLE = [['Olivia', 'Nguyen'], ['Jack', 'Thompson'], ['Mia', 'Patel'], ['Noah', 'Williams'], ['Chloe', 'Martin'], ['Liam', 'Brown'], ['Ava', 'Singh'], ['Ethan', 'Wilson'], ['Zoe', 'Taylor'], ['Lucas', 'Anderson']];
const SUBURBS = ['Bondi', 'Parramatta', 'Fitzroy', 'Southbank', 'Newstead', 'Subiaco', 'Glenelg', 'Braddon', 'Manly', 'Carlton'];
const INDUSTRY = {
  real_estate: { msg: 'Hi, I saw the 3-bed listing. Is it still available and can we inspect this weekend?', reply: 'Great, thanks! What is the price range? We are pre-approved around $850k.', budget: 850000 },
  solar: { msg: 'Interested in a 6.6kW solar system with battery for our home.', reply: 'Thanks! Roughly what would it cost with the battery? Our bill is about $600 a quarter.', budget: 14000 },
  home_services: { msg: 'Need a quote to renovate our bathroom, ideally starting next month.', reply: 'Perfect. What would the price be roughly for a full bathroom? Happy to have someone visit.', budget: 25000 },
  education: { msg: 'Hi, I want details on the next intake and the course fees please.', reply: 'Thanks! Is there a payment plan for the fees? I would like to start in February.', budget: 9000 },
  other: { msg: 'Hi, I filled in your form. Can someone call me about pricing?', reply: 'Thanks for the quick reply! What does the price include?', budget: 5000 },
};
const pick = (a) => a[Math.floor(Math.random() * a.length)];

// Simple per-IP limit for creating demos.
const hits = new Map();
function rateLimited(ip) {
  const now = Date.now();
  const list = (hits.get(ip) || []).filter((t) => now - t < 3600000);
  list.push(now);
  hits.set(ip, list);
  return list.length > 15;
}

async function isDemoWs(workspaceId) {
  const r = await db.query(`SELECT settings FROM workspaces WHERE id = $1 AND settings->>'demo' = 'true'`, [workspaceId]);
  return r.rows[0] ? (typeof r.rows[0].settings === 'string' ? JSON.parse(r.rows[0].settings) : r.rows[0].settings) : null;
}

const router = express.Router();

/** POST /api/demo/start — public: creates the sandbox and signs the phone in. */
router.post('/start', async (req, res, next) => {
  try {
    if (rateLimited(req.ip)) return res.status(429).json({ error: 'Too many demos from this network. Try again in an hour.' });
    const company = String(req.body?.company || '').trim().slice(0, 80) || 'Your Company';
    const yourName = String(req.body?.your_name || '').trim().slice(0, 40) || 'You';
    const industry = INDUSTRY[req.body?.industry] ? req.body.industry : 'other';
    const members = (Array.isArray(req.body?.members) ? req.body.members : [])
      .map((m) => String(m || '').trim().slice(0, 40)).filter(Boolean).slice(0, 5);
    const ref = String(req.body?.ref || '').trim().slice(0, 60) || null;
    const id = crypto.randomBytes(5).toString('hex');
    const expires = new Date(Date.now() + DEMO_HOURS * 3600000).toISOString();

    const settings = {
      demo: true, demo_expires_at: expires, demo_ref: ref, demo_industry: industry, company_name: company,
      whatsapp_phone_number_id: `demo-${id}`,
      whatsapp_auto_responder: {
        is_enabled: true, trigger_type: 'all', delay_seconds: 0, timezone: process.env.DEFAULT_TIMEZONE || 'Australia/Sydney',
        working_days: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'], working_hours_start: '00:00', working_hours_end: '23:59',
        message_template: 'Hi {{First_Name}}, thanks for contacting {{Company_Name}}! {{Agent_Name}} will call you in the next few minutes. 🙂',
      },
    };
    const ws = (await db.query(
      `INSERT INTO workspaces (name, slug, plan, subscription_status, settings) VALUES ($1, $2, 'pro', 'active', $3) RETURNING id`,
      [company, `demo-${id}`, JSON.stringify(settings)])).rows[0].id;
    const stages = ['New', 'Contacted', 'Interested', 'Negotiating', 'Won', 'Lost'];
    for (let i = 0; i < stages.length; i += 1) {
      await db.query('INSERT INTO lead_stages (workspace_id, name, sort_order, is_default, is_won, is_lost) VALUES ($1,$2,$3,$4,$5,$6)',
        [ws, stages[i], i, i === 0, stages[i] === 'Won', stages[i] === 'Lost']);
    }
    const [first, ...rest] = yourName.split(/\s+/);
    const viewer = (await db.query(
      `INSERT INTO users (workspace_id, email, password_hash, first_name, last_name, role, status)
       VALUES ($1, $2, $3, $4, $5, 'admin', 'active') RETURNING *`,
      [ws, `viewer-${id}@demo.flazyn.test`, `demo-no-password-${crypto.randomBytes(8).toString('hex')}`, first, rest.join(' ') || null])).rows[0];
    for (const [i, m] of members.entries()) {
      const [f, ...l] = m.split(/\s+/);
      await db.query(
        `INSERT INTO users (workspace_id, email, password_hash, first_name, last_name, role, status) VALUES ($1,$2,'demo-no-login',$3,$4,'sales_agent','active')`,
        [ws, `agent${i}-${id}@demo.flazyn.test`, f, l.join(' ') || null]);
    }
    await db.query(`INSERT INTO lead_assignment_rules (workspace_id, type, rules) VALUES ($1, 'round_robin', '{}')`, [ws]);
    await db.query(
      `INSERT INTO whatsapp_chat_assistant_rules (workspace_id, name, trigger_condition, trigger_value, trigger_keywords, action_type, action_value, response_message, is_active, is_enabled, priority)
       VALUES ($1, 'Price questions', 'contains', 'price, cost, fees, how much', '["price","cost","fees","how much"]', 'add_tag', 'asked-price', NULL, true, true, 1)`, [ws]);

    const refreshToken = crypto.randomBytes(40).toString('hex');
    await db.query('INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES ($1, $2, $3)', [viewer.id, refreshToken, expires]);
    const accessToken = jwt.sign({ userId: viewer.id, workspaceId: ws, role: 'admin' }, config.jwt.secret, { expiresIn: config.jwt.expiresIn });
    logger.info(`Demo started: "${company}" (${members.length} team members)${ref ? ` ref=${ref}` : ''}`);
    res.status(201).json({
      accessToken, refreshToken, expires_at: expires,
      user: { id: viewer.id, email: viewer.email, firstName: viewer.first_name, lastName: viewer.last_name, role: 'admin', workspaceId: ws },
      team: members,
    });
  } catch (err) { next(err); }
});

/** POST /api/demo/lead — sends a realistic test lead (and the customer's reply) to this demo. */
router.post('/lead', authenticate, async (req, res, next) => {
  try {
    const settings = await isDemoWs(req.workspaceId);
    if (!settings) return res.status(403).json({ error: 'Test leads are only for demo workspaces' });
    const used = await db.query(`SELECT COUNT(*)::int c FROM leads WHERE workspace_id = $1`, [req.workspaceId]);
    if (used.rows[0].c >= 15) return res.status(429).json({ error: 'That’s plenty of test leads for one demo 🙂' });
    const ind = INDUSTRY[settings.demo_industry] || INDUSTRY.other;
    const taken = (await db.query('SELECT phone FROM leads WHERE workspace_id = $1', [req.workspaceId])).rows.map((r) => r.phone);
    const phone = FICTIONAL.find((p) => !taken.includes(p)) || pick(FICTIONAL);
    const [first, last] = pick(PEOPLE);
    const suburb = pick(SUBURBS);
    const workspaceId = req.workspaceId;
    const viewerId = req.user.id;

    setTimeout(async () => {
      try {
        const { createLead } = require('../services/leadPipeline');
        const created = await createLead(workspaceId, {
          first_name: first, last_name: last, phone, email: `${first}.${last}`.toLowerCase() + '@example.com',
          city: suburb, budget: ind.budget, notes: ind.msg, lead_source: 'facebook',
          custom_fields: [{ name: 'Facebook campaign', value: 'Spring promo' }, { name: 'Facebook form', value: 'Get a quote' }],
        }, { source: 'facebook', duplicateMode: 'skip', activityText: 'Lead captured from a Facebook lead ad (demo)' });
        const lead = created.lead;
        if (!lead) return;
        const agent = lead.assigned_to ? (await db.query('SELECT first_name FROM users WHERE id = $1', [lead.assigned_to])).rows[0] : null;
        // the "customer" opens WhatsApp: runs the real inbound pipeline (auto-reply, assistant rules, AI coach)
        const { handleWhatsAppWebhook } = require('../services/whatsappService');
        await handleWhatsAppWebhook({
          object: 'whatsapp_business_account',
          entry: [{ changes: [{ value: {
            metadata: { phone_number_id: settings.whatsapp_phone_number_id },
            contacts: [{ profile: { name: `${first} ${last}` } }],
            messages: [{ from: phone.replace(/\D/g, ''), id: `demo-${crypto.randomBytes(6).toString('hex')}`, text: { body: ind.msg } }],
          } }] }],
        });
        await sendPushNotification(viewerId, `⚡ New lead: ${first} ${last}`,
          `From your Facebook ad · ${suburb}. ${agent ? `Assigned to ${agent.first_name}. ` : ''}WhatsApp auto-reply sent in 1 second.`,
          { type: 'demo_lead', leadId: lead.id });
        setTimeout(async () => {
          try {
            await handleWhatsAppWebhook({
              object: 'whatsapp_business_account',
              entry: [{ changes: [{ value: {
                metadata: { phone_number_id: settings.whatsapp_phone_number_id },
                messages: [{ from: phone.replace(/\D/g, ''), id: `demo-${crypto.randomBytes(6).toString('hex')}`, text: { body: ind.reply } }],
              } }] }],
            });
            await sendPushNotification(viewerId, `💬 ${first} replied on WhatsApp`, ind.reply, { type: 'whatsapp_reply', leadId: lead.id });
          } catch (err) { logger.error(`Demo reply error: ${err.message}`); }
        }, REPLY_DELAY_MS);
      } catch (err) { logger.error(`Demo lead error: ${err.message}`); }
    }, LEAD_DELAY_MS);

    res.json({ eta_seconds: Math.round(LEAD_DELAY_MS / 1000), name: `${first} ${last}` });
  } catch (err) { next(err); }
});

/** GET /api/demo/me — is the signed-in workspace a demo, and when does it expire. */
router.get('/me', authenticate, async (req, res, next) => {
  try {
    const s = await isDemoWs(req.workspaceId);
    if (!s) return res.json({ demo: false });
    const team = await db.query(`SELECT first_name, last_name FROM users WHERE workspace_id = $1 AND role = 'sales_agent' ORDER BY created_at`, [req.workspaceId]);
    res.json({ demo: true, expires_at: s.demo_expires_at, company: s.company_name, team: team.rows.map((u) => [u.first_name, u.last_name].filter(Boolean).join(' ')) });
  } catch (err) { next(err); }
});

/** Hourly: remove expired demo workspaces. */
async function purgeExpiredDemos() {
  const r = await db.query(`SELECT id FROM workspaces WHERE settings->>'demo' = 'true' AND (settings->>'demo_expires_at')::timestamptz < NOW()`);
  for (const { id } of r.rows) {
    await db.query('DELETE FROM users WHERE workspace_id = $1', [id]).catch(() => {});
    await db.query('DELETE FROM workspaces WHERE id = $1', [id]);
  }
  if (r.rows.length) logger.info(`Removed ${r.rows.length} expired demo workspace(s)`);
  return r.rows.length;
}

module.exports = router;
module.exports.purgeExpiredDemos = purgeExpiredDemos;
