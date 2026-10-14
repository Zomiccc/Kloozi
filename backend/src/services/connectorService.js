const crypto = require('crypto');
const db = require('../config/database');
const config = require('../config');
const logger = require('../utils/logger');

/* ═══════════════════════════════════════════════════════════════
   CONNECTORS — lead ads delivered through Zapier / Make (or any tool
   that can POST). These tools already hold LinkedIn / Meta / TikTok
   approval, so Flazyn only needs to understand what they send:
   flat keys in any naming style ("First Name", "email_address"),
   Facebook-style field_data [{name, values}], or answer lists
   [{question, answer}]. Leads are tagged with the right source,
   repeat deliveries are ignored, and connection status is tracked.
   ═══════════════════════════════════════════════════════════════ */

const SOURCES = {
  linkedin: { label: 'LinkedIn', idField: 'LinkedIn lead ID', campaignField: 'LinkedIn campaign' },
  facebook: { label: 'Facebook', idField: 'Facebook lead ID', campaignField: 'Facebook campaign' },
  instagram: { label: 'Instagram', idField: 'Facebook lead ID', campaignField: 'Facebook campaign', leadSource: 'facebook' },
  tiktok: { label: 'TikTok', idField: 'TikTok lead ID', campaignField: 'TikTok campaign' },
  other: { label: 'Other', idField: 'External lead ID', campaignField: 'Campaign', leadSource: 'zapier' },
};

const norm = (k) => String(k || '').toLowerCase().replace(/[^a-z0-9]/g, '');

// normalised key → target
const ALIASES = {
  first_name: ['firstname', 'first', 'givenname', 'fname'],
  last_name: ['lastname', 'last', 'surname', 'familyname', 'lname'],
  name: ['name', 'fullname', 'contactname', 'yourname', 'leadname'],
  email: ['email', 'emailaddress', 'workemail', 'businessemail', 'personalemail', 'youremail', 'mail'],
  phone: ['phone', 'phonenumber', 'mobile', 'mobilenumber', 'mobilephone', 'cell', 'cellphone', 'whatsapp', 'whatsappnumber', 'contactnumber', 'telephone', 'tel', 'workphone', 'yourphone'],
  city: ['city', 'location', 'suburb', 'town', 'citytown'],
  budget: ['budget', 'yourbudget', 'pricerange', 'budgetrange'],
  notes: ['notes', 'message', 'comments', 'comment', 'enquiry', 'inquiry', 'question', 'details', 'additionalinfo'],
  company: ['company', 'companyname', 'organisation', 'organization', 'business', 'businessname'],
  job_title: ['jobtitle', 'title', 'position', 'role', 'designation'],
  external_id: ['leadid', 'id', 'responseid', 'leadgenid', 'submissionid', 'formresponseid', 'leadgenformresponseid', 'entryid'],
  campaign: ['campaign', 'campaignname', 'adcampaign', 'campaigngroupname'],
  ad_name: ['adname', 'ad', 'creativename', 'adtitle', 'adgroupname', 'adsetname'],
  form_name: ['formname', 'form', 'leadformname', 'formtitle'],
  is_test: ['test', 'istest', 'istestlead', 'testlead', 'isorganictest'],
  platform: ['platform'],
};
const LOOKUP = Object.fromEntries(Object.entries(ALIASES).flatMap(([t, keys]) => keys.map((k) => [k, t])));
const SKIP_KEYS = new Set(['token', 'source', 'createdtime', 'createdat', 'submittedat', 'pageid', 'formid', 'adid', 'adsetid', 'campaignid', 'advertiserid', 'accountid']);

/** Flatten whatever the tool sent into [label, value] pairs. */
function pairsFrom(body) {
  const pairs = [];
  const push = (k, v) => {
    if (v === null || v === undefined || v === '') return;
    if (Array.isArray(v)) { if (v.every((x) => typeof x !== 'object')) pairs.push([k, v.join(', ')]); return; }
    if (typeof v === 'object') return;
    pairs.push([k, String(v).trim()]);
  };
  for (const [k, v] of Object.entries(body || {})) {
    if ((k === 'field_data' || k === 'fieldData') && Array.isArray(v)) {
      for (const f of v) push(f.name, Array.isArray(f.values) ? f.values.join(', ') : f.value);
    } else if ((k === 'answers' || k === 'questions' || k === 'form_answers') && Array.isArray(v)) {
      for (const a of v) push(a.question || a.name || a.label, a.answer ?? a.value ?? a.response);
    } else if (k === 'fields' && v && typeof v === 'object' && !Array.isArray(v)) {
      for (const [fk, fv] of Object.entries(v)) push(fk, fv);
    } else push(k, v);
  }
  return pairs;
}

function mapPayload(body, sourceKey) {
  const src = SOURCES[sourceKey] || SOURCES.other;
  const out = { custom_fields: [] };
  let externalId = null;
  let isTest = false;
  for (const [label, value] of pairsFrom(body)) {
    const key = norm(label);
    if (SKIP_KEYS.has(key)) continue;
    const target = LOOKUP[key]
      || (/^(first)/.test(key) && key.includes('name') ? 'first_name' : null)
      || (/^(last|sur)/.test(key) && key.includes('name') ? 'last_name' : null)
      || (/phone|mobile|whatsapp/.test(key) ? 'phone' : null)
      || (/email/.test(key) ? 'email' : null)
      || (/budget|pricerange|howmuch/.test(key) ? 'budget' : null)
      || (/suburb|city|town|wherearey?oulocated|location/.test(key) ? 'city' : null);
    switch (target) {
      case 'first_name': case 'last_name': case 'email': case 'phone': case 'city': case 'name':
        if (!out[target]) out[target] = value; else out.custom_fields.push({ name: label, value });
        break;
      case 'budget': {
        out.custom_fields.push({ name: label, value });
        const n = parseFloat(value.replace(/[^\d.]/g, ''));
        if (Number.isFinite(n) && n > 0 && !out.budget) out.budget = /k\b/i.test(value) ? n * 1000 : n;
        break;
      }
      case 'notes': out.notes = out.notes ? `${out.notes}\n${value}` : value; break;
      case 'company': out.custom_fields.push({ name: 'Company', value }); break;
      case 'job_title': out.custom_fields.push({ name: 'Job title', value }); break;
      case 'external_id': if (!externalId) externalId = value; break;
      case 'campaign': out.custom_fields.push({ name: src.campaignField, value }); break;
      case 'ad_name': out.custom_fields.push({ name: `${src.label} ad`, value }); break;
      case 'form_name': out.custom_fields.push({ name: `${src.label} form`, value }); break;
      case 'is_test': isTest = /^(1|true|yes)$/i.test(value); break;
      case 'platform': out.custom_fields.push({ name: 'Platform', value }); break;
      default: out.custom_fields.push({ name: label, value });
    }
  }
  if (externalId) out.custom_fields.unshift({ name: src.idField, value: externalId });
  return { lead: out, externalId, isTest };
}

async function workspaceByToken(token) {
  if (!token || String(token).length < 16) return null;
  const r = await db.query('SELECT id, name FROM workspaces WHERE account_token = $1', [String(token)]);
  return r.rows[0] || null;
}

async function ensureToken(workspaceId) {
  const r = await db.query('SELECT account_token FROM workspaces WHERE id = $1', [workspaceId]);
  let token = r.rows[0]?.account_token;
  if (!token) {
    token = crypto.randomBytes(16).toString('hex');
    await db.query('UPDATE workspaces SET account_token = $1 WHERE id = $2', [token, workspaceId]);
  }
  return token;
}

const connectorType = (source) => `${source}_connector`;

async function status(workspaceId, source) {
  const r = await db.query('SELECT is_connected, config FROM integrations WHERE workspace_id = $1 AND type = $2', [workspaceId, connectorType(source)]);
  const cfg = r.rows[0]?.config ? (typeof r.rows[0].config === 'string' ? JSON.parse(r.rows[0].config) : r.rows[0].config) : {};
  return {
    is_connected: !!r.rows[0]?.is_connected,
    leads_received: cfg.leads_received || 0,
    last_lead_at: cfg.last_lead_at || null,
    last_test_at: cfg.last_test_at || null,
    last_lead_name: cfg.last_lead_name || null,
  };
}

async function recordDelivery(workspaceId, source, { isTest, name }) {
  const now = new Date().toISOString();
  const r = await db.query('SELECT id, config FROM integrations WHERE workspace_id = $1 AND type = $2', [workspaceId, connectorType(source)]);
  const cfg = r.rows[0]?.config ? (typeof r.rows[0].config === 'string' ? JSON.parse(r.rows[0].config) : r.rows[0].config) : {};
  if (isTest) cfg.last_test_at = now;
  else { cfg.last_lead_at = now; cfg.leads_received = (cfg.leads_received || 0) + 1; }
  cfg.last_lead_name = name || cfg.last_lead_name || null;
  await db.query(
    `INSERT INTO integrations (workspace_id, type, is_connected, credentials, config) VALUES ($1, $2, true, '{}', $3)
     ON CONFLICT (workspace_id, type) DO UPDATE SET is_connected = true, config = EXCLUDED.config, updated_at = NOW()`,
    [workspaceId, connectorType(source), JSON.stringify(cfg)]
  );
  if (!isTest) {
    const { markConnectedOnLead } = require('../routes/connections');
    await markConnectedOnLead(workspaceId, source).catch((err) => logger.error(`Connection status update failed: ${err.message}`));
  }
}

/** POST /api/integrations/connect/:token/:source (public; Zapier/Make call this). */
exports.receive = async (req, res) => {
  try {
    const source = String(req.params.source || 'other').toLowerCase();
    if (!SOURCES[source]) return res.status(404).json({ error: `Unknown source "${source}". Use linkedin, facebook, instagram, tiktok or other.` });
    const ws = await workspaceByToken(req.params.token);
    if (!ws) return res.status(401).json({ error: 'Invalid connection link. Copy it again from Flazyn.' });
    const body = Array.isArray(req.body) ? req.body[0] || {} : (req.body || {});
    const { lead, externalId, isTest } = mapPayload(body, source);
    if (!lead.name && !lead.first_name && !lead.phone && !lead.email) {
      return res.status(400).json({ error: 'No name, phone or email found in this lead. Map at least one of them in Zapier/Make.' });
    }
    const src = SOURCES[source];
    if (externalId && !isTest) {
      const seen = await db.query(
        'SELECT id FROM leads WHERE workspace_id = $1 AND custom_fields @> $2::jsonb LIMIT 1',
        [ws.id, JSON.stringify([{ name: src.idField, value: String(externalId) }])]
      );
      if (seen.rows[0]) return res.json({ success: true, duplicate: true, leadId: seen.rows[0].id, message: 'Already received' });
    }
    if (isTest) lead.tags = [`${source}-test`];
    const { createLead } = require('./leadPipeline');
    const result = await createLead(ws.id, { ...lead, lead_source: src.leadSource || source }, {
      source: src.leadSource || source, duplicateMode: 'workspace',
      activityText: isTest ? `Test lead from ${src.label} (via connector)` : `Lead captured from ${src.label} (via Zapier/Make)`,
    });
    const name = lead.name || [lead.first_name, lead.last_name].filter(Boolean).join(' ');
    await recordDelivery(ws.id, source, { isTest, name });
    res.json({ success: true, leadId: result.lead?.id || null, status: result.status });
  } catch (err) {
    logger.error(`Connector error: ${err.message}`);
    res.status(500).json({ error: 'Could not save the lead. Zapier/Make will retry.' });
  }
};

/** GET /api/integrations/connect/:token/ping (public; used by the Flazyn Zapier app to test the connection). */
exports.ping = async (req, res) => {
  const ws = await workspaceByToken(req.params.token);
  if (!ws) return res.status(401).json({ error: 'Invalid connection key' });
  res.json({ ok: true, workspace: ws.name });
};

/** GET /api/integrations/connectors/:source (auth) → link + status. */
exports.setup = async (req, res, next) => {
  try {
    const source = String(req.params.source).toLowerCase();
    if (!SOURCES[source]) return res.status(404).json({ error: 'Unknown source' });
    const token = await ensureToken(req.workspaceId);
    res.json({
      source, label: SOURCES[source].label,
      webhook_url: `${config.apiUrl}/api/integrations/connect/${token}/${source}`,
      connection_key: token,
      public_url_ok: !/localhost|127\.0\.0\.1/.test(config.apiUrl),
      ...(await status(req.workspaceId, source)),
    });
  } catch (err) { next(err); }
};

/** Push a sample lead through the same path as Make/Zapier would. */
async function sendTestFor(workspaceId, source) {
  const token = await ensureToken(workspaceId);
  const fake = {
    'First Name': 'Test', 'Last Name': `${SOURCES[source].label} Lead`, 'Email Address': `test.${source}.${Date.now()}@example.com`,
    'Phone Number': '+61 400 000 000', 'Campaign Name': 'Flazyn connection test', 'Lead ID': `test-${Date.now()}`, is_test: 'true',
  };
  const out = { statusCode: 200, body: null, status(c) { this.statusCode = c; return this; }, json(b) { this.body = b; return this; } };
  await exports.receive({ params: { token, source }, body: fake }, out);
  if (out.statusCode >= 300) { const e = new Error(out.body?.error || 'Test failed'); e.status = out.statusCode; throw e; }
  return { ...out.body, ...(await status(workspaceId, source)) };
}

/** POST /api/integrations/connectors/:source/test (auth). */
exports.sendTest = async (req, res, next) => {
  try {
    const source = String(req.params.source).toLowerCase();
    if (!SOURCES[source]) return res.status(404).json({ error: 'Unknown source' });
    res.json(await sendTestFor(req.workspaceId, source));
  } catch (err) { if (err.status) return res.status(err.status).json({ error: err.message }); next(err); }
};

exports.mapPayload = mapPayload;
exports.ensureToken = ensureToken;
exports.sendTestFor = sendTestFor;
exports.status = status;
exports.SOURCES = SOURCES;
