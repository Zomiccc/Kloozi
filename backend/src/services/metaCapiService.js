const crypto = require('crypto');
const axios = require('axios');
const db = require('../config/database');
const config = require('../config');
const logger = require('../utils/logger');
const { logActivity } = require('../utils/activityLog');

// ─── Meta Conversions API (CRM events) ──────────────────────────────────────
// Tells Meta which leads turned out well so Lead Ads optimise for quality:
//   "Mark qualified" → QualifiedLead,  stage becomes won → ConvertedLead.
// Uses the workspace's own Pixel/Dataset + token (Automations → Meta CAPI),
// falling back to META_PIXEL_ID / META_CONVERSIONS_ACCESS_TOKEN.

const sha256 = (s) => crypto.createHash('sha256').update(String(s)).digest('hex');

function normEmail(email) {
  const e = String(email || '').trim().toLowerCase();
  return /\S+@\S+\.\S+/.test(e) ? e : null;
}

/** E.164 digits without "+"; local Australian numbers (04xx…) get the 61 country code. */
function normPhone(phone) {
  let d = String(phone || '').replace(/\D/g, '');
  if (!d) return null;
  if (d.startsWith('00')) d = d.slice(2);
  if (d.length === 10 && d.startsWith('0')) d = `${process.env.DEFAULT_COUNTRY_CODE || '61'}${d.slice(1)}`;
  return d.length >= 8 ? d : null;
}

function customField(lead, name) {
  const list = Array.isArray(lead.custom_fields) ? lead.custom_fields : [];
  const hit = list.find((f) => String(f?.name || '').toLowerCase() === name.toLowerCase());
  return hit?.value ? String(hit.value) : null;
}

async function credentialsFor(workspaceId) {
  if (await require('../utils/demo').isDemoWorkspace(workspaceId)) return null; // demos never report to Meta
  const r = await db.query('SELECT pixel_id, access_token, COALESCE(is_active, is_enabled, false) AS on FROM meta_capi_config WHERE workspace_id = $1', [workspaceId]);
  const row = r.rows[0];
  if (row?.on && row.pixel_id && row.access_token) return { pixelId: row.pixel_id, accessToken: row.access_token, from: 'workspace' };
  if (process.env.META_PIXEL_ID && process.env.META_CONVERSIONS_ACCESS_TOKEN) {
    return { pixelId: process.env.META_PIXEL_ID, accessToken: process.env.META_CONVERSIONS_ACCESS_TOKEN, from: 'env' };
  }
  return null;
}

function buildEvent(lead, eventName) {
  const userData = {};
  const em = normEmail(lead.email);
  const ph = normPhone(lead.phone);
  if (em) userData.em = [sha256(em)];
  if (ph) userData.ph = [sha256(ph)];
  if (lead.first_name) userData.fn = [sha256(String(lead.first_name).trim().toLowerCase())];
  if (lead.last_name) userData.ln = [sha256(String(lead.last_name).trim().toLowerCase())];
  if (lead.city) userData.ct = [sha256(String(lead.city).trim().toLowerCase().replace(/\s+/g, ''))];
  userData.external_id = [sha256(lead.id)];
  const metaLeadId = customField(lead, 'Facebook lead ID');
  if (metaLeadId && /^\d+$/.test(metaLeadId)) userData.lead_id = Number(metaLeadId);
  return {
    event_name: eventName,
    event_time: Math.floor(Date.now() / 1000),
    action_source: 'system_generated',
    event_id: `${lead.id}:${eventName}`, // dedupes repeats on Meta's side
    user_data: userData,
    custom_data: { event_source: 'crm', lead_event_source: 'Flazyn', stage: lead.stage || undefined },
  };
}

/**
 * Send one CRM event for a lead. Never throws.
 * Returns { status: 'sent' | 'dry_run' | 'not_configured' | 'failed', error? }.
 */
async function sendLeadEvent(workspaceId, lead, eventName, actorId = null) {
  try {
    const creds = await credentialsFor(workspaceId);
    if (!creds) return { status: 'not_configured' };
    const event = buildEvent(lead, eventName);
    let result;
    if (process.env.MESSAGING_DRY_RUN === 'true') {
      logger.info(`[dry-run] Meta CAPI ${eventName} for lead ${lead.id}`);
      result = { status: 'dry_run' };
    } else {
      const body = { data: [event] };
      if (process.env.META_CAPI_TEST_EVENT_CODE) body.test_event_code = process.env.META_CAPI_TEST_EVENT_CODE;
      const resp = await axios.post(
        `https://graph.facebook.com/${config.facebook?.graphVersion || 'v25.0'}/${creds.pixelId}/events`,
        body,
        { params: { access_token: creds.accessToken }, timeout: 15000 }
      );
      result = { status: 'sent', events_received: resp.data?.events_received };
    }
    await logActivity(workspaceId, lead.id, actorId, 'meta_capi', `Meta notified: ${eventName}`, { event: eventName, ...result });
    return result;
  } catch (err) {
    const error = err.response?.data?.error?.message || err.message;
    logger.error(`Meta CAPI ${eventName} failed: ${error}`);
    await logActivity(workspaceId, lead.id, actorId, 'meta_capi', `Meta event ${eventName} failed: ${error}`, { event: eventName, status: 'failed' }).catch(() => {});
    return { status: 'failed', error };
  }
}

module.exports = { sendLeadEvent, buildEvent, normPhone, normEmail };
