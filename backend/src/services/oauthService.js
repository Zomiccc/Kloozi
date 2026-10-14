const crypto = require('crypto');
const axios = require('axios');
const jwt = require('jsonwebtoken');
const db = require('../config/database');
const config = require('../config');
const logger = require('../utils/logger');
const { createLead, fireOutgoingWebhooks } = require('./leadPipeline');

const GRAPH = () => `https://graph.facebook.com/${config.facebook.graphVersion}`;

// ─── OAuth state ───
// The state parameter is a short-lived signed token, not a bare workspace id,
// so nobody can attach their ad account to someone else's workspace.

function signOAuthState(workspaceId, provider) {
  return jwt.sign({ ws: workspaceId, p: provider }, config.jwt.secret, { expiresIn: '20m' });
}

function readOAuthState(state, provider) {
  try {
    const decoded = jwt.verify(String(state || ''), config.jwt.secret);
    return decoded.p === provider ? decoded.ws : null;
  } catch {
    return null;
  }
}

function hmacHex(secret, data) {
  return crypto.createHmac('sha256', secret).update(data).digest('hex');
}

function safeEqual(a, b) {
  const x = Buffer.from(String(a || ''));
  const y = Buffer.from(String(b || ''));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

/** Split platform form answers into known lead fields + custom fields. */
function mapFormAnswers(pairs) {
  const lead = { custom_fields: [] };
  for (const { name: rawName, value } of pairs) {
    if (value === undefined || value === null || value === '') continue;
    const name = String(rawName || '').toLowerCase().replace(/\s+/g, '_');
    const v = String(value);
    if (/(^|_)first_?name$/.test(name)) lead.first_name = v;
    else if (/(^|_)last_?name$/.test(name)) lead.last_name = v;
    else if (/^(full_?name|name)$/.test(name)) lead.name = v;
    else if (/phone|mobile|whatsapp/.test(name)) lead.phone = v;
    else if (/e-?mail/.test(name)) lead.email = v;
    else if (/^city$|_city$|^location$/.test(name)) lead.city = v;
    else if (/budget/.test(name) && !isNaN(parseFloat(v.replace(/[^\d.]/g, '')))) {
      lead.budget = parseFloat(v.replace(/[^\d.]/g, ''));
      lead.custom_fields.push({ name: rawName, value: v });
    } else lead.custom_fields.push({ name: rawName, value: v });
  }
  return lead;
}

async function saveIntegration(workspaceId, type, credentials, cfg = {}) {
  await db.query(
    `INSERT INTO integrations (workspace_id, type, is_connected, credentials, config)
     VALUES ($1, $2, true, $3, $4)
     ON CONFLICT (workspace_id, type) DO UPDATE SET is_connected = true, credentials = $3, config = $4, updated_at = NOW()`,
    [workspaceId, type, JSON.stringify(credentials), JSON.stringify(cfg)]
  );
}

exports.getOAuthState = (req, res) => {
  const provider = String(req.query.provider || '');
  if (!['facebook', 'tiktok', 'linkedin'].includes(provider)) return res.status(400).json({ error: 'Unknown provider' });
  res.json({ state: signOAuthState(req.workspaceId, provider) });
};

// ─── Facebook Lead Ads ───

exports.FACEBOOK_SCOPES = [
  'pages_show_list', 'pages_read_engagement', 'pages_manage_metadata', 'pages_manage_ads', 'leads_retrieval', 'ads_management',
];

exports.facebookCallback = async (req, res) => {
  const back = `${config.webUrl}/app/automations/facebook`;
  try {
    const { code, state } = req.query;
    const workspaceId = readOAuthState(state, 'facebook');
    if (!code || !workspaceId) return res.redirect(`${back}?error=invalid_state`);
    const redirectUri = `${config.apiUrl}/api/integrations/oauth/facebook/callback`;

    const shortLived = await axios.get(`${GRAPH()}/oauth/access_token`, {
      params: { client_id: config.facebook.appId, client_secret: config.facebook.appSecret, redirect_uri: redirectUri, code },
    });
    // Page tokens fetched with a long-lived user token never expire; with the
    // short-lived one they die after ~1 hour and lead fetching stops silently.
    const longLived = await axios.get(`${GRAPH()}/oauth/access_token`, {
      params: {
        grant_type: 'fb_exchange_token', client_id: config.facebook.appId,
        client_secret: config.facebook.appSecret, fb_exchange_token: shortLived.data.access_token,
      },
    });
    const userToken = longLived.data.access_token || shortLived.data.access_token;

    const pagesResp = await axios.get(`${GRAPH()}/me/accounts`, {
      params: { access_token: userToken, fields: 'id,name,access_token,category,tasks', limit: 100 },
    });
    const pages = pagesResp.data.data || [];

    const subscribed = [];
    for (const page of pages) {
      try {
        await axios.post(`${GRAPH()}/${page.id}/subscribed_apps`, null, {
          params: { subscribed_fields: 'leadgen', access_token: page.access_token },
        });
        subscribed.push(page.id);
      } catch (e) {
        logger.error(`FB subscribe page ${page.id}: ${e.response?.data?.error?.message || e.message}`);
      }
    }

    await saveIntegration(workspaceId, 'facebook', {
      accessToken: userToken,
      pages: pages.map((p) => ({ id: p.id, name: p.name, accessToken: p.access_token, subscribed: subscribed.includes(p.id) })),
    });
    res.redirect(`${back}?connected=true`);
  } catch (err) {
    logger.error('Facebook OAuth callback error:', err.response?.data?.error?.message || err.message);
    res.redirect(`${back}?error=oauth_failed`);
  }
};

exports.facebookWebhookVerify = (req, res) => {
  const { 'hub.mode': mode, 'hub.verify_token': token, 'hub.challenge': challenge } = req.query;
  if (mode === 'subscribe' && token === config.facebook.verifyToken) return res.send(challenge);
  res.sendStatus(403);
};

exports.facebookWebhook = async (req, res) => {
  if (config.facebook.appSecret) {
    const expected = `sha256=${hmacHex(config.facebook.appSecret, req.rawBody || Buffer.from(''))}`;
    if (!safeEqual(req.get('x-hub-signature-256'), expected)) {
      logger.warn('Facebook webhook rejected: bad signature');
      return res.sendStatus(403);
    }
  }
  res.sendStatus(200); // acknowledge fast; Meta retries slow endpoints

  try {
    const { object, entry } = req.body || {};
    if (object !== 'page') return;
    for (const pageEntry of entry || []) {
      for (const change of pageEntry.changes || []) {
        if (change.field !== 'leadgen' || !change.value?.leadgen_id) continue;
        const pageId = String(change.value.page_id || pageEntry.id);
        const integ = await db.query(
          `SELECT workspace_id, credentials FROM integrations
           WHERE type = 'facebook' AND is_connected = true AND credentials->'pages' @> $1::jsonb`,
          [JSON.stringify([{ id: pageId }])]
        );
        if (integ.rows.length === 0) {
          logger.warn(`Facebook lead for unconnected page ${pageId} ignored`);
          continue;
        }
        for (const row of integ.rows) {
          const page = (row.credentials.pages || []).find((p) => p.id === pageId);
          try {
            const leadResp = await axios.get(`${GRAPH()}/${change.value.leadgen_id}`, {
              params: { access_token: page.accessToken, fields: 'field_data,created_time,ad_id,adgroup_id,form_id,campaign_id,platform,is_organic' },
            });
            const l = leadResp.data;
            const mapped = mapFormAnswers((l.field_data || []).map((f) => ({ name: f.name, value: (f.values || []).join(', ') })));
            mapped.custom_fields.push(
              ...[['Facebook lead ID', l.id || change.value.leadgen_id], ['Facebook form', l.form_id], ['Facebook ad', l.ad_id], ['Facebook campaign', l.campaign_id], ['Platform', l.platform]]
                .filter(([, v]) => v).map(([name, value]) => ({ name, value: String(value) }))
            );
            await createLeadFromIntegration(row.workspace_id, mapped, 'facebook');
          } catch (e) {
            logger.error(`Facebook lead fetch ${change.value.leadgen_id} failed: ${e.response?.data?.error?.message || e.message}`);
          }
        }
      }
    }
  } catch (err) {
    logger.error('Facebook webhook error:', err.message);
  }
};

// ─── TikTok Lead Generation ───

exports.tiktokCallback = async (req, res) => {
  const back = `${config.webUrl}/app/automations/tiktok`;
  try {
    const { auth_code, code, state } = req.query;
    const workspaceId = readOAuthState(state, 'tiktok');
    if (!(auth_code || code) || !workspaceId) return res.redirect(`${back}?error=invalid_state`);

    const tokenResp = await axios.post('https://business-api.tiktok.com/open_api/v1.3/oauth2/access_token/', {
      app_id: config.tiktok.appId, secret: config.tiktok.appSecret, auth_code: auth_code || code,
    });
    const data = tokenResp.data?.data || {};
    if (!data.access_token) {
      logger.error('TikTok token exchange failed:', JSON.stringify(tokenResp.data));
      return res.redirect(`${back}?error=oauth_failed`);
    }
    await saveIntegration(workspaceId, 'tiktok', {
      accessToken: data.access_token, advertiserIds: (data.advertiser_ids || []).map(String),
    });
    res.redirect(`${back}?connected=true`);
  } catch (err) {
    logger.error('TikTok OAuth callback error:', err.response?.data?.message || err.message);
    res.redirect(`${back}?error=oauth_failed`);
  }
};

exports.tiktokWebhook = async (req, res) => {
  res.sendStatus(200);
  try {
    const body = req.body || {};
    const leadData = body.lead_data || body.data || body.content || {};
    const advertiserId = String(body.advertiser_id || leadData.advertiser_id || '');
    if (!advertiserId) {
      logger.warn('TikTok webhook without advertiser_id ignored');
      return;
    }
    // Route only to the workspace that authorised this advertiser — never broadcast.
    const integ = await db.query(
      `SELECT workspace_id FROM integrations
       WHERE type = 'tiktok' AND is_connected = true AND credentials->'advertiserIds' @> $1::jsonb`,
      [JSON.stringify([advertiserId])]
    );
    if (integ.rows.length === 0) {
      logger.warn(`TikTok lead for unknown advertiser ${advertiserId} ignored`);
      return;
    }
    const pairs = Array.isArray(leadData.fields)
      ? leadData.fields.map((f) => ({ name: f.name || f.field_name, value: f.value }))
      : Object.entries(leadData).filter(([, v]) => typeof v !== 'object').map(([name, value]) => ({ name, value }));
    const mapped = mapFormAnswers(pairs);
    if (!mapped.first_name && !mapped.name && !mapped.phone && !mapped.email) return;
    await createLeadFromIntegration(integ.rows[0].workspace_id, mapped, 'tiktok');
  } catch (err) {
    logger.error('TikTok webhook error:', err.message);
  }
};

// ─── LinkedIn Lead Sync ───

exports.LINKEDIN_SCOPES = ['r_marketing_leadgen_automation', 'r_ads', 'r_organization_admin'];

function linkedinHeaders(token) {
  return {
    Authorization: `Bearer ${token}`,
    'LinkedIn-Version': config.linkedin.apiVersion,
    'X-Restli-Protocol-Version': '2.0.0',
  };
}

exports.linkedinCallback = async (req, res) => {
  const back = `${config.webUrl}/app/automations/linkedin`;
  try {
    const { code, state } = req.query;
    const workspaceId = readOAuthState(state, 'linkedin');
    if (!code || !workspaceId) return res.redirect(`${back}?error=invalid_state`);

    const tokenResp = await axios.post('https://www.linkedin.com/oauth/v2/accessToken', new URLSearchParams({
      grant_type: 'authorization_code', code,
      redirect_uri: `${config.apiUrl}/api/integrations/oauth/linkedin/callback`,
      client_id: config.linkedin.clientId, client_secret: config.linkedin.clientSecret,
    }), { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });
    const token = tokenResp.data.access_token;
    if (!token) return res.redirect(`${back}?error=oauth_failed`);

    // Ad accounts this member can read leads from; each gets a lead notification subscription.
    const accounts = await axios.get('https://api.linkedin.com/rest/adAccountUsers?q=authenticatedUser', { headers: linkedinHeaders(token) })
      .then((r) => (r.data.elements || []).map((e) => e.account).filter(Boolean))
      .catch((e) => { logger.error('LinkedIn ad accounts:', e.response?.data?.message || e.message); return []; });

    const webhook = `${config.apiUrl}/api/integrations/webhook/linkedin`;
    for (const account of accounts) {
      await axios.post('https://api.linkedin.com/rest/leadNotifications',
        { webhook, owner: { sponsoredAccount: account }, leadType: 'SPONSORED' },
        { headers: { ...linkedinHeaders(token), 'Content-Type': 'application/json' } })
        .catch((e) => logger.error(`LinkedIn subscribe ${account}:`, e.response?.data?.message || e.message));
    }

    await saveIntegration(workspaceId, 'linkedin', {
      accessToken: token, refreshToken: tokenResp.data.refresh_token || null,
      expiresAt: Date.now() + (tokenResp.data.expires_in || 0) * 1000, accounts,
    });
    res.redirect(`${back}?connected=true`);
  } catch (err) {
    logger.error('LinkedIn OAuth callback error:', err.response?.data?.message || err.message);
    res.redirect(`${back}?error=oauth_failed`);
  }
};

/** LinkedIn webhook validation: GET ?challengeCode=… → HMAC-SHA256(challengeCode, clientSecret). */
exports.linkedinWebhookVerify = (req, res) => {
  const challengeCode = req.query.challengeCode;
  if (!challengeCode || !config.linkedin.clientSecret) return res.sendStatus(400);
  res.json({ challengeCode, challengeResponse: hmacHex(config.linkedin.clientSecret, challengeCode) });
};

exports.linkedinWebhook = async (req, res) => {
  if (config.linkedin.clientSecret) {
    const expected = `hmacsha256=${hmacHex(config.linkedin.clientSecret, req.rawBody || Buffer.from(''))}`;
    if (!safeEqual(req.get('x-li-signature'), expected)) {
      logger.warn('LinkedIn webhook rejected: bad signature');
      return res.sendStatus(403);
    }
  }
  res.sendStatus(200);

  try {
    const body = req.body || {};
    const owner = body.owner?.sponsoredAccount || body.owner?.organization;
    const responseUrn = body.leadGenFormResponse || body.leadFormResponse;
    if (!owner || !responseUrn) return;
    const integ = await db.query(
      `SELECT workspace_id, credentials FROM integrations
       WHERE type = 'linkedin' AND is_connected = true AND credentials->'accounts' @> $1::jsonb`,
      [JSON.stringify([owner])]
    );
    if (integ.rows.length === 0) {
      logger.warn(`LinkedIn lead for unconnected owner ${owner} ignored`);
      return;
    }
    const { workspace_id: workspaceId, credentials } = integ.rows[0];
    const headers = linkedinHeaders(credentials.accessToken);
    const responseId = String(responseUrn).split(':').pop();
    const lead = (await axios.get(`https://api.linkedin.com/rest/leadFormResponses/${encodeURIComponent(responseId)}`, { headers })).data;

    // Question ids → field names come from the (versioned) form definition.
    const formUrn = lead.versionedLeadGenFormUrn || '';
    const formId = (formUrn.match(/leadGenForm:(\d+)/) || [])[1];
    const questions = {};
    if (formId) {
      const form = await axios.get(`https://api.linkedin.com/rest/leadForms/${formId}`, { headers }).then((r) => r.data).catch(() => null);
      for (const q of form?.content?.questions || []) {
        questions[q.questionId] = q.predefinedField || q.name || q.question?.localized?.en_US || `Question ${q.questionId}`;
      }
    }
    const pairs = (lead.formResponse?.answers || []).map((a) => ({
      name: (questions[a.questionId] || `Question ${a.questionId}`).replace(/^PHONE_NUMBER$/, 'phone').replace(/^EMAIL$/, 'email')
        .replace(/^FIRST_NAME$/, 'first_name').replace(/^LAST_NAME$/, 'last_name').replace(/^CITY$/, 'city'),
      value: a.answerDetails?.textQuestionAnswer?.answer ?? (a.answerDetails?.multipleChoiceAnswer?.options || []).join(', '),
    }));
    const mapped = mapFormAnswers(pairs);
    const campaign = lead.leadMetadataInfo?.sponsoredLeadMetadataInfo?.campaign?.name;
    if (campaign) mapped.custom_fields.push({ name: 'LinkedIn campaign', value: campaign });
    await createLeadFromIntegration(workspaceId, mapped, 'linkedin');
  } catch (err) {
    logger.error('LinkedIn webhook error:', err.response?.data?.message || err.message);
  }
};

// ─── Shared helper ───

async function createLeadFromIntegration(workspaceId, parsed, source) {
  const result = await createLead(workspaceId, { ...parsed, lead_source: source }, {
    source, duplicateMode: 'workspace', activityText: `Lead captured from ${source}`,
  });
  if (result.status === 'skipped') return null;
  return result.lead.id;
}

exports.fireOutgoingWebhooks = fireOutgoingWebhooks;
exports.createLeadFromIntegration = createLeadFromIntegration;
