const axios = require('axios');
const crypto = require('crypto');
const db = require('../config/database');
const config = require('../config');
const logger = require('../utils/logger');

/* ═══════════════════════════════════════════════════════════════
   PER-WORKSPACE WHATSAPP CONNECTION
   Each client connects WhatsApp in a few clicks from Settings:
     • own     — Meta Embedded Signup popup: the client logs in to
                 Facebook, picks or creates their WhatsApp Business
                 account and number, done. We swap the code for a
                 business token, subscribe our app to their account
                 and register the number.
     • shared  — instantly use Flazyn's platform number (trials).
     • manual  — agencies that already have a Cloud API number paste
                 the phone number ID and a token (advanced, hidden).
   Credentials live in integrations (type 'whatsapp'); routing keys
   (whatsapp_phone_number_id, whatsapp_number) in workspace settings.
   ═══════════════════════════════════════════════════════════════ */

const GRAPH = () => config.whatsapp.apiUrl || 'https://graph.facebook.com/v21.0';

class ConnectError extends Error {
  constructor(message, status = 400) { super(message); this.status = status; }
}

const graphError = (err) => err.response?.data?.error?.message || err.message;

async function loadIntegration(workspaceId) {
  const r = await db.query("SELECT credentials, config, is_connected FROM integrations WHERE workspace_id = $1 AND type = 'whatsapp'", [workspaceId]);
  const row = r.rows[0];
  if (!row || !row.is_connected) return null;
  const creds = typeof row.credentials === 'string' ? JSON.parse(row.credentials) : (row.credentials || {});
  return creds;
}

/** Token + phone number ID used to send for this workspace. */
async function credentialsFor(workspaceId) {
  const platform = { phoneNumberId: config.whatsapp.phoneNumberId, accessToken: config.whatsapp.accessToken, mode: 'platform' };
  if (!workspaceId) return platform;
  try {
    const c = await loadIntegration(workspaceId);
    if (c && (c.mode === 'own' || c.mode === 'manual') && c.phoneNumberId && (c.accessToken || c.usePlatformToken)) {
      // Embedded Signup shares the client's account with Flazyn's business, so
      // Flazyn's permanent system-user token works and never expires.
      const accessToken = c.usePlatformToken ? config.whatsapp.accessToken : c.accessToken;
      return { phoneNumberId: c.phoneNumberId, accessToken, mode: c.mode };
    }
  } catch (err) { logger.error(`WhatsApp credentials lookup failed: ${err.message}`); }
  return platform;
}

function publicView(c) {
  if (!c) return { connected: false };
  return {
    connected: true, mode: c.mode, display_number: c.displayNumber || null, verified_name: c.verifiedName || null,
    phone_number_id: c.phoneNumberId || null, waba_id: c.wabaId || null, connected_at: c.connectedAt || null,
    quality_rating: c.qualityRating || null,
  };
}

async function status(workspaceId) {
  const c = await loadIntegration(workspaceId);
  return {
    ...publicView(c),
    // What the Connect screen can offer
    embedded: { available: !!(config.facebook.appId && process.env.WHATSAPP_EMBEDDED_CONFIG_ID), app_id: config.facebook.appId || null, config_id: process.env.WHATSAPP_EMBEDDED_CONFIG_ID || null },
    shared: { available: !!(config.whatsapp.phoneNumberId && config.whatsapp.accessToken), display_number: process.env.WHATSAPP_SHARED_DISPLAY || null },
  };
}

async function assertNotTaken(workspaceId, phoneNumberId) {
  const taken = await db.query(
    "SELECT id FROM workspaces WHERE settings->>'whatsapp_phone_number_id' = $1 AND id <> $2", [String(phoneNumberId), workspaceId]);
  if (taken.rows[0]) throw new ConnectError('This WhatsApp number is already connected to another Flazyn account', 409);
}

async function save(workspaceId, creds) {
  const full = { ...creds, connectedAt: new Date().toISOString() };
  await db.query(
    `INSERT INTO integrations (workspace_id, type, is_connected, credentials, config)
     VALUES ($1, 'whatsapp', true, $2, '{}'::jsonb)
     ON CONFLICT (workspace_id, type) DO UPDATE SET is_connected = true, credentials = $2, updated_at = NOW()`,
    [workspaceId, JSON.stringify(full)]);
  const routing = {
    whatsapp_connected: true,
    whatsapp_connection: creds.mode,
    whatsapp_number: creds.displayNumber ? `+${String(creds.displayNumber).replace(/\D/g, '')}` : null,
    whatsapp_connected_at: full.connectedAt,
  };
  if (creds.mode === 'shared') {
    await db.query(
      `UPDATE workspaces SET settings = (COALESCE(settings, '{}'::jsonb) - 'whatsapp_phone_number_id' - 'whatsapp_waba_id') || $2::jsonb, updated_at = NOW() WHERE id = $1`,
      [workspaceId, JSON.stringify(routing)]);
  } else {
    await db.query(
      'UPDATE workspaces SET settings = COALESCE(settings, \'{}\'::jsonb) || $2::jsonb, updated_at = NOW() WHERE id = $1',
      [workspaceId, JSON.stringify({ ...routing, whatsapp_phone_number_id: String(creds.phoneNumberId), whatsapp_waba_id: creds.wabaId ? String(creds.wabaId) : null })]);
  }
  return publicView(full);
}

async function phoneDetails(phoneNumberId, token) {
  const r = await axios.get(`${GRAPH()}/${phoneNumberId}`, {
    params: { fields: 'display_phone_number,verified_name,quality_rating,platform_type,status' },
    headers: { Authorization: `Bearer ${token}` },
  });
  return r.data;
}

/** Subscribe Flazyn's app to the WhatsApp account and register the number (both idempotent). */
async function activate({ wabaId, phoneNumberId, token }) {
  if (wabaId) {
    try { await axios.post(`${GRAPH()}/${wabaId}/subscribed_apps`, null, { headers: { Authorization: `Bearer ${token}` } }); }
    catch (err) { logger.warn(`WABA ${wabaId} subscribe: ${graphError(err)}`); }
  }
  const details = await phoneDetails(phoneNumberId, token);
  let pin = null;
  if (details.platform_type !== 'CLOUD_API') {
    pin = String(crypto.randomInt(100000, 999999));
    try {
      await axios.post(`${GRAPH()}/${phoneNumberId}/register`, { messaging_product: 'whatsapp', pin }, { headers: { Authorization: `Bearer ${token}` } });
    } catch (err) {
      // A number with two-step verification already set by someone else can't be re-registered with our PIN.
      throw new ConnectError(`Meta could not activate this number: ${graphError(err)}`);
    }
  }
  return { details: await phoneDetails(phoneNumberId, token).catch(() => details), pin };
}

/** Embedded Signup finish: code from FB.login + IDs from the WA_EMBEDDED_SIGNUP message. */
async function connectEmbedded(workspaceId, { code, phone_number_id: phoneNumberId, waba_id: wabaId }) {
  if (!code || !phoneNumberId) throw new ConnectError('Facebook did not return your WhatsApp number. Please try again.');
  if (!config.facebook.appId || !config.facebook.appSecret) throw new ConnectError('WhatsApp sign-up is not configured on this server', 503);
  await assertNotTaken(workspaceId, phoneNumberId);
  let token;
  try {
    const r = await axios.get(`${GRAPH()}/oauth/access_token`, {
      params: { client_id: config.facebook.appId, client_secret: config.facebook.appSecret, code },
    });
    token = r.data.access_token;
  } catch (err) {
    throw new ConnectError(`Facebook sign-in expired or was cancelled (${graphError(err)}). Please try again.`);
  }
  const { details, pin } = await activate({ wabaId, phoneNumberId, token });
  // The sign-up token lasts 60 days. Prefer Flazyn's permanent token when it can reach the number.
  let usePlatformToken = false;
  if (config.whatsapp.accessToken) {
    try { await phoneDetails(phoneNumberId, config.whatsapp.accessToken); usePlatformToken = true; }
    catch (err) { logger.warn(`WhatsApp ${phoneNumberId}: platform token can't reach it yet (${graphError(err)}), using the 60-day sign-up token`); }
  }
  return save(workspaceId, {
    mode: 'own', phoneNumberId: String(phoneNumberId), wabaId: wabaId ? String(wabaId) : null, pin, usePlatformToken,
    accessToken: usePlatformToken ? null : token, tokenExpiresAt: usePlatformToken ? null : new Date(Date.now() + 60 * 86400000).toISOString(),
    displayNumber: details.display_phone_number, verifiedName: details.verified_name, qualityRating: details.quality_rating,
  });
}

/** Advanced: an existing Cloud API number. */
async function connectManual(workspaceId, { phone_number_id: phoneNumberId, access_token: token, waba_id: wabaId }) {
  phoneNumberId = String(phoneNumberId || '').trim();
  token = String(token || '').trim();
  if (!/^\d{6,25}$/.test(phoneNumberId)) throw new ConnectError('Enter the Phone number ID (digits) from Meta → WhatsApp → API setup');
  if (token.length < 20) throw new ConnectError('Paste a permanent access token (system user token)');
  await assertNotTaken(workspaceId, phoneNumberId);
  let details;
  try { ({ details } = await activate({ wabaId: wabaId ? String(wabaId).trim() : null, phoneNumberId, token })); }
  catch (err) {
    if (err instanceof ConnectError) throw err;
    throw new ConnectError(`Meta rejected these details: ${graphError(err)}`);
  }
  return save(workspaceId, {
    mode: 'manual', phoneNumberId, wabaId: wabaId ? String(wabaId).trim() : null, accessToken: token,
    displayNumber: details.display_phone_number, verifiedName: details.verified_name, qualityRating: details.quality_rating,
  });
}

/** Instant: send and receive on Flazyn's platform number. */
async function connectShared(workspaceId) {
  if (!config.whatsapp.phoneNumberId || !config.whatsapp.accessToken) throw new ConnectError('Flazyn’s shared number is not available right now', 503);
  let details = {};
  try { details = await phoneDetails(config.whatsapp.phoneNumberId, config.whatsapp.accessToken); } catch { /* still usable */ }
  return save(workspaceId, {
    mode: 'shared', displayNumber: details.display_phone_number || process.env.WHATSAPP_SHARED_DISPLAY || null, verifiedName: details.verified_name || 'Flazyn',
  });
}

async function disconnect(workspaceId) {
  await db.query("UPDATE integrations SET is_connected = false, credentials = '{}'::jsonb, updated_at = NOW() WHERE workspace_id = $1 AND type = 'whatsapp'", [workspaceId]);
  await db.query(
    `UPDATE workspaces SET settings = COALESCE(settings, '{}'::jsonb) - 'whatsapp_phone_number_id' - 'whatsapp_waba_id' - 'whatsapp_number'
       - 'whatsapp_connected' - 'whatsapp_connection' - 'whatsapp_connected_at', updated_at = NOW() WHERE id = $1`, [workspaceId]);
}

/**
 * Inbound on the shared platform number: several workspaces share it, so
 * route by who last talked to this person, then by who has them as a lead.
 */
async function sharedNumberWorkspace(fromPhone) {
  const digits = String(fromPhone || '').replace(/\D/g, '');
  if (!digits) return null;
  const tail = digits.slice(-9);
  const shared = "w.settings->>'whatsapp_connection' = 'shared'";
  const recent = await db.query(
    `SELECT m.workspace_id FROM whatsapp_messages m JOIN workspaces w ON w.id = m.workspace_id LEFT JOIN leads l ON l.id = m.lead_id
      WHERE ${shared} AND m.direction = 'outbound' AND RIGHT(REGEXP_REPLACE(COALESCE(m.phone, l.phone, ''), '\\D', '', 'g'), 9) = $1
      ORDER BY m.created_at DESC LIMIT 1`, [tail]).catch(() => ({ rows: [] }));
  if (recent.rows[0]) return recent.rows[0].workspace_id;
  const lead = await db.query(
    `SELECT l.workspace_id FROM leads l JOIN workspaces w ON w.id = l.workspace_id
      WHERE ${shared} AND RIGHT(REGEXP_REPLACE(COALESCE(l.phone, ''), '\\D', '', 'g'), 9) = $1
      ORDER BY l.last_activity_at DESC NULLS LAST LIMIT 1`, [tail]);
  return lead.rows[0]?.workspace_id || null;
}

module.exports = {
  ConnectError, credentialsFor, status, connectEmbedded, connectManual, connectShared, disconnect, sharedNumberWorkspace,
};
