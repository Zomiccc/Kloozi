const axios = require('axios');
const db = require('../config/database');
const config = require('../config');
const logger = require('../utils/logger');
const { logActivity } = require('../utils/activityLog');
const { sendPushNotification } = require('../utils/notifications');
const { updateLeadScore } = require('../utils/activityLog');

// ─── Facebook Lead Ads ───

exports.facebookCallback = async (req, res, next) => {
  try {
    const { code, state } = req.query;
    const workspaceId = state;
    if (!code || !workspaceId) return res.status(400).send('Missing code or state');

    // Exchange code for access token
    const tokenResp = await axios.get('https://graph.facebook.com/v18.0/oauth/access_token', {
      params: {
        client_id: config.facebook.appId,
        client_secret: config.facebook.appSecret,
        redirect_uri: `${config.apiUrl}/api/integrations/oauth/facebook/callback`,
        code,
      },
    });

    const accessToken = tokenResp.data.access_token;
    if (!accessToken) return res.status(400).send('Failed to get access token');

    // Get user pages
    const pagesResp = await axios.get('https://graph.facebook.com/v18.0/me/accounts', {
      params: { access_token: accessToken, fields: 'id,name,access_token,category' },
    });

    const pages = pagesResp.data.data || [];

    // Store integration
    await db.query(
      `INSERT INTO integrations (workspace_id, type, is_connected, credentials, config)
       VALUES ($1, 'facebook', true, $2, $3)
       ON CONFLICT (workspace_id, type) DO UPDATE SET is_connected = true, credentials = $2, config = $3, updated_at = NOW()`,
      [workspaceId, JSON.stringify({ accessToken, pages: pages.map(p => ({ id: p.id, name: p.name, accessToken: p.access_token })) }), JSON.stringify({})]
    );

    // Subscribe pages for leadgen webhook
    for (const page of pages) {
      try {
        await axios.post(`https://graph.facebook.com/v18.0/${page.id}/subscribed_apps`, {
          subscribed_fields: 'leadgen',
        }, { params: { access_token: page.access_token } });
      } catch (e) {
        logger.error(`FB subscribe page ${page.id}: ${e.message}`);
      }
    }

    res.redirect(`${config.webUrl}/integrations/facebook?connected=true`);
  } catch (err) {
    logger.error('Facebook OAuth callback error:', err.message);
    res.redirect(`${config.webUrl}/integrations/facebook?error=oauth_failed`);
  }
};

exports.facebookWebhook = async (req, res, next) => {
  try {
    const { object, entry } = req.body;
    if (object !== 'page') return res.sendStatus(404);

    for (const pageEntry of entry || []) {
      const pageId = pageEntry.id;
      for (const change of pageEntry.changes || []) {
        if (change.field !== 'leadgen') continue;
        const leadgenId = change.value.leadgen_id;
        if (!leadgenId) continue;

        // Find workspace by page ID
        const intRes = await db.query(
          `SELECT * FROM integrations WHERE type = 'facebook' AND is_connected = true`
        );
        let workspaceId = null;
        let pageAccessToken = null;
        for (const integ of intRes.rows) {
          const creds = integ.credentials || {};
          const pages = creds.pages || [];
          const match = pages.find(p => p.id === pageId);
          if (match) {
            workspaceId = integ.workspace_id;
            pageAccessToken = match.accessToken;
            break;
          }
        }
        if (!workspaceId) continue;

        // Fetch lead data
        const leadResp = await axios.get(`https://graph.facebook.com/v18.0/${leadgenId}`, {
          params: { access_token: pageAccessToken },
        });
        const leadData = leadResp.data;
        const fieldData = leadData.field_data || [];

        const parsed = {};
        for (const f of fieldData) {
          const name = f.name.toLowerCase();
          const val = (f.values || [])[0] || '';
          if (name.includes('first_name') || name === 'first name') parsed.first_name = val;
          else if (name.includes('last_name') || name === 'last name') parsed.last_name = val;
          else if (name.includes('full_name') || name === 'full name' || name === 'name') parsed.name = val;
          else if (name.includes('phone') || name.includes('mobile')) parsed.phone = val;
          else if (name.includes('email')) parsed.email = val;
          else if (name.includes('city')) parsed.city = val;
          else if (name.includes('zip') || name.includes('postal')) parsed.city = parsed.city || val;
          else parsed[name] = val;
        }
        if (!parsed.first_name && parsed.name) {
          const parts = parsed.name.trim().split(/\s+/);
          parsed.first_name = parts[0];
          parsed.last_name = parts.slice(1).join(' ');
        }

        await createLeadFromIntegration(workspaceId, parsed, 'facebook');
      }
    }

    res.sendStatus(200);
  } catch (err) {
    logger.error('Facebook webhook error:', err.message);
    res.sendStatus(200);
  }
};

exports.facebookWebhookVerify = (req, res) => {
  const { 'hub.mode': mode, 'hub.verify_token': token, 'hub.challenge': challenge } = req.query;
  if (mode === 'subscribe' && token === config.facebook.verifyToken) {
    res.send(challenge);
  } else {
    res.sendStatus(403);
  }
};

// ─── TikTok Lead Gen ───

exports.tiktokCallback = async (req, res, next) => {
  try {
    const { code, state } = req.query;
    const workspaceId = state;
    if (!code || !workspaceId) return res.status(400).send('Missing code or state');

    const tokenResp = await axios.post('https://business-api.tiktok.com/open_api/v1.3/oauth2/access_token/', {
      client_key: config.tiktok.appId,
      client_secret: config.tiktok.appSecret,
      grant_type: 'authorization_code',
      auth_code: code,
    });

    const accessToken = tokenResp.data?.data?.access_token;
    if (!accessToken) return res.status(400).send('Failed to get TikTok access token');

    await db.query(
      `INSERT INTO integrations (workspace_id, type, is_connected, credentials, config)
       VALUES ($1, 'tiktok', true, $2, $3)
       ON CONFLICT (workspace_id, type) DO UPDATE SET is_connected = true, credentials = $2, config = $3, updated_at = NOW()`,
      [workspaceId, JSON.stringify({ accessToken }), JSON.stringify({})]
    );

    res.redirect(`${config.webUrl}/integrations/tiktok?connected=true`);
  } catch (err) {
    logger.error('TikTok OAuth callback error:', err.message);
    res.redirect(`${config.webUrl}/integrations/tiktok?error=oauth_failed`);
  }
};

exports.tiktokWebhook = async (req, res, next) => {
  try {
    const { event, lead_data } = req.body;
    if (event !== 'lead') return res.sendStatus(200);

    // Find workspace by TikTok integration
    const intRes = await db.query(`SELECT workspace_id, credentials FROM integrations WHERE type = 'tiktok' AND is_connected = true`);
    if (intRes.rows.length === 0) return res.sendStatus(200);

    for (const integ of intRes.rows) {
      const parsed = {
        first_name: lead_data?.first_name || lead_data?.name || '',
        last_name: lead_data?.last_name || '',
        phone: lead_data?.phone_number || lead_data?.phone || '',
        email: lead_data?.email || '',
        city: lead_data?.city || '',
      };
      if (parsed.first_name || parsed.phone || parsed.email) {
        await createLeadFromIntegration(integ.workspace_id, parsed, 'tiktok');
      }
    }
    res.sendStatus(200);
  } catch (err) {
    logger.error('TikTok webhook error:', err.message);
    res.sendStatus(200);
  }
};

// ─── LinkedIn Lead Gen ───

exports.linkedinCallback = async (req, res, next) => {
  try {
    const { code, state } = req.query;
    const workspaceId = state;
    if (!code || !workspaceId) return res.status(400).send('Missing code or state');

    const tokenResp = await axios.post('https://www.linkedin.com/oauth/v2/accessToken', new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: `${config.apiUrl}/api/integrations/oauth/linkedin/callback`,
      client_id: config.linkedin.clientId,
      client_secret: config.linkedin.clientSecret,
    }), { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });

    const accessToken = tokenResp.data.access_token;
    if (!accessToken) return res.status(400).send('Failed to get LinkedIn access token');

    await db.query(
      `INSERT INTO integrations (workspace_id, type, is_connected, credentials, config)
       VALUES ($1, 'linkedin', true, $2, $3)
       ON CONFLICT (workspace_id, type) DO UPDATE SET is_connected = true, credentials = $2, config = $3, updated_at = NOW()`,
      [workspaceId, JSON.stringify({ accessToken }), JSON.stringify({})]
    );

    res.redirect(`${config.webUrl}/integrations/linkedin?connected=true`);
  } catch (err) {
    logger.error('LinkedIn OAuth callback error:', err.message);
    res.redirect(`${config.webUrl}/integrations/linkedin?error=oauth_failed`);
  }
};

exports.linkedinWebhook = async (req, res, next) => {
  try {
    const { leadData } = req.body;
    const intRes = await db.query(`SELECT workspace_id FROM integrations WHERE type = 'linkedin' AND is_connected = true`);
    if (intRes.rows.length === 0) return res.sendStatus(200);

    const parsed = {
      first_name: leadData?.firstName || leadData?.first_name || '',
      last_name: leadData?.lastName || leadData?.last_name || '',
      phone: leadData?.phone || '',
      email: leadData?.email || '',
      city: leadData?.city || '',
      company: leadData?.company || '',
    };
    if (parsed.first_name || parsed.phone || parsed.email) {
      await createLeadFromIntegration(intRes.rows[0].workspace_id, parsed, 'linkedin');
    }
    res.sendStatus(200);
  } catch (err) {
    logger.error('LinkedIn webhook error:', err.message);
    res.sendStatus(200);
  }
};

// ─── Shared helper ───

async function createLeadFromIntegration(workspaceId, parsed, source) {
  const stageResult = await db.query('SELECT id FROM lead_stages WHERE workspace_id = $1 AND is_default = true LIMIT 1', [workspaceId]);
  const agentsResult = await db.query(
    `SELECT u.id FROM users u WHERE u.workspace_id = $1 AND u.role = $2 AND u.status = $3
     ORDER BY (SELECT COUNT(*) FROM leads WHERE assigned_to = u.id) ASC LIMIT 1`,
    [workspaceId, 'sales_agent', 'active']
  );

  const leadResult = await db.query(
    `INSERT INTO leads (workspace_id, first_name, last_name, phone, email, city, lead_source, stage, stage_id, assigned_to)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING id`,
    [workspaceId, parsed.first_name || 'Unknown', parsed.last_name || null, parsed.phone || null,
     parsed.email || null, parsed.city || null, source, 'new', stageResult.rows[0]?.id, agentsResult.rows[0]?.id || null]
  );

  const leadId = leadResult.rows[0].id;
  await logActivity(workspaceId, leadId, null, 'lead_created', `Lead captured from ${source}`);
  await updateLeadScore(leadId);

  if (agentsResult.rows[0]?.id) {
    await sendPushNotification(agentsResult.rows[0].id, `New ${source} Lead`, `New lead: ${parsed.first_name || 'Unknown'}`, { type: 'new_lead', leadId, source });
  }

  // Fire outgoing webhooks
  await fireOutgoingWebhooks(workspaceId, 'lead.created', { leadId, ...parsed });

  return leadId;
}

// ─── Outgoing Webhooks ───

async function fireOutgoingWebhooks(workspaceId, event, data) {
  try {
    const whRes = await db.query('SELECT * FROM outgoing_webhooks WHERE workspace_id = $1 AND is_active = true', [workspaceId]);
    for (const wh of whRes.rows) {
      const events = wh.events || [];
      if (events.length > 0 && !events.includes(event) && !events.includes('*')) continue;
      const payload = { event, timestamp: new Date().toISOString(), data };
      try {
        const response = await axios.post(wh.url, payload, { timeout: 10000 });
        await db.query('INSERT INTO outgoing_webhook_logs (webhook_id, event, payload, response_code, status) VALUES ($1,$2,$3,$4,$5)',
          [wh.id, event, JSON.stringify(payload), response.status, 'success']);
      } catch (err) {
        await db.query('INSERT INTO outgoing_webhook_logs (webhook_id, event, payload, response_code, status, error_message) VALUES ($1,$2,$3,$4,$5,$6)',
          [wh.id, event, JSON.stringify(payload), err.response?.status || 0, 'failed', err.message]);
      }
    }
  } catch (err) {
    logger.error('Fire outgoing webhooks error:', err.message);
  }
}

exports.fireOutgoingWebhooks = fireOutgoingWebhooks;
exports.createLeadFromIntegration = createLeadFromIntegration;
