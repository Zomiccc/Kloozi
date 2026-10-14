const db = require('../config/database');
const crypto = require('crypto');
const logger = require('../utils/logger');
const { logActivity } = require('../utils/activityLog');
const { cacheDelPattern } = require('../config/redis');
const { createLead, ruleMatches, ruleActions, ruleConditions } = require('../services/leadPipeline');

// ─── Lead Automation Rules ───
// Rules run on every new lead (see services/leadPipeline.js). API shape:
//   { name, trigger_source, conditions: [{field, operator, value}], actions: [{type, value}], is_active, priority }

function presentRule(rule) {
  return {
    ...rule,
    trigger_source: rule.trigger_source || 'any',
    conditions: ruleConditions(rule),
    actions: ruleActions(rule),
    is_active: rule.is_enabled !== false,
  };
}

function cleanList(list, key) {
  return (Array.isArray(list) ? list : []).filter((x) => x && x[key]);
}

exports.getAutomationRules = async (req, res, next) => {
  try {
    const result = await db.query('SELECT * FROM lead_automation_rules WHERE workspace_id = $1 ORDER BY priority ASC, created_at ASC', [req.workspaceId]);
    res.json({ rules: result.rows.map(presentRule) });
  } catch (err) { next(err); }
};

exports.createAutomationRule = async (req, res, next) => {
  try {
    const { name, trigger_source, conditions, actions, is_active, priority } = req.body;
    if (!name) return res.status(400).json({ error: 'Rule name is required' });
    const cleanActions = cleanList(actions, 'type');
    if (cleanActions.length === 0) return res.status(400).json({ error: 'Add at least one action' });
    const result = await db.query(
      `INSERT INTO lead_automation_rules
         (workspace_id, name, trigger_type, trigger_source, trigger_config, conditions, action_type, action_config, actions, is_enabled, priority)
       VALUES ($1,$2,'new_lead',$3,'{}'::jsonb,$4,$5,'{}'::jsonb,$6,$7,$8) RETURNING *`,
      [req.workspaceId, name, trigger_source || 'any', JSON.stringify(cleanList(conditions, 'field')),
       cleanActions[0].type, JSON.stringify(cleanActions), is_active !== false, Number(priority) || 0]
    );
    res.status(201).json({ rule: presentRule(result.rows[0]) });
  } catch (err) { next(err); }
};

exports.updateAutomationRule = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, trigger_source, conditions, actions, is_active, priority } = req.body;
    const cleanActions = actions !== undefined ? cleanList(actions, 'type') : null;
    const result = await db.query(
      `UPDATE lead_automation_rules SET
         name = COALESCE($1, name),
         trigger_source = COALESCE($2, trigger_source),
         conditions = COALESCE($3, conditions),
         actions = COALESCE($4, actions),
         action_type = COALESCE($5, action_type),
         is_enabled = COALESCE($6, is_enabled),
         priority = COALESCE($7, priority),
         updated_at = NOW()
       WHERE id = $8 AND workspace_id = $9 RETURNING *`,
      [name ?? null, trigger_source ?? null,
       conditions !== undefined ? JSON.stringify(cleanList(conditions, 'field')) : null,
       cleanActions ? JSON.stringify(cleanActions) : null, cleanActions?.[0]?.type ?? null,
       typeof is_active === 'boolean' ? is_active : null,
       priority !== undefined ? Number(priority) || 0 : null, id, req.workspaceId]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Rule not found' });
    res.json({ rule: presentRule(result.rows[0]) });
  } catch (err) { next(err); }
};

exports.deleteAutomationRule = async (req, res, next) => {
  try {
    await db.query('DELETE FROM lead_automation_rules WHERE id=$1 AND workspace_id=$2', [req.params.id, req.workspaceId]);
    res.json({ message: 'Rule deleted' });
  } catch (err) { next(err); }
};

exports.testAutomationRule = async (req, res, next) => {
  try {
    const ruleRes = await db.query('SELECT * FROM lead_automation_rules WHERE id=$1 AND workspace_id=$2', [req.params.id, req.workspaceId]);
    if (ruleRes.rows.length === 0) return res.status(404).json({ error: 'Rule not found' });
    const rule = ruleRes.rows[0];
    const sample = req.body.sample_lead || {};
    const matched = ruleMatches(rule, sample);
    res.json({
      matched,
      actions: matched ? ruleActions(rule) : [],
      message: matched ? 'Rule would trigger for this lead' : 'Rule would NOT trigger for this lead',
    });
  } catch (err) { next(err); }
};

// ─── Lead Distribution ───
// { type: 'round_robin' | 'all', config: { recipients: [{ type: 'team_member'|'email'|'whatsapp', value }] } }

exports.getDistributionConfig = async (req, res, next) => {
  try {
    const result = await db.query('SELECT * FROM lead_distribution_config WHERE workspace_id=$1 ORDER BY created_at ASC', [req.workspaceId]);
    res.json({ configs: result.rows });
  } catch (err) { next(err); }
};

exports.updateDistributionConfig = async (req, res, next) => {
  try {
    const { id, name, type, config, is_active } = req.body;
    const recipients = cleanList(config?.recipients, 'value').map((r) => ({ type: r.type, value: String(r.value).trim() }));
    if (recipients.length === 0) return res.status(400).json({ error: 'Add at least one recipient' });
    const strategy = type === 'all' ? 'all' : 'round_robin';
    if (id) {
      const result = await db.query(
        `UPDATE lead_distribution_config
         SET type = $1, name = COALESCE($2, name), config = jsonb_set(COALESCE(config,'{}'::jsonb), '{recipients}', $3::jsonb),
             is_active = COALESCE($4, is_active), updated_at = NOW()
         WHERE id = $5 AND workspace_id = $6 RETURNING *`,
        [strategy, name ?? null, JSON.stringify(recipients), typeof is_active === 'boolean' ? is_active : null, id, req.workspaceId]
      );
      if (result.rows.length === 0) return res.status(404).json({ error: 'Distribution not found' });
      return res.json({ config: result.rows[0] });
    }
    const result = await db.query(
      'INSERT INTO lead_distribution_config (workspace_id, name, type, config, is_active) VALUES ($1,$2,$3,$4,$5) RETURNING *',
      [req.workspaceId, name || null, strategy, JSON.stringify({ recipients }), is_active !== false]
    );
    res.status(201).json({ config: result.rows[0] });
  } catch (err) { next(err); }
};

exports.toggleDistributionConfig = async (req, res, next) => {
  try {
    const result = await db.query(
      'UPDATE lead_distribution_config SET is_active = NOT COALESCE(is_active, true), updated_at = NOW() WHERE id = $1 AND workspace_id = $2 RETURNING *',
      [req.params.id, req.workspaceId]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Distribution not found' });
    res.json({ config: result.rows[0] });
  } catch (err) { next(err); }
};

exports.deleteDistributionConfig = async (req, res, next) => {
  try {
    await db.query('DELETE FROM lead_distribution_config WHERE id = $1 AND workspace_id = $2', [req.params.id, req.workspaceId]);
    res.json({ message: 'Distribution deleted' });
  } catch (err) { next(err); }
};

// ─── WhatsApp Chat Assistant Rules ───

exports.getChatAssistantRules = async (req, res, next) => {
  try {
    const result = await db.query('SELECT * FROM whatsapp_chat_assistant_rules WHERE workspace_id=$1 ORDER BY priority ASC', [req.workspaceId]);
    res.json({ rules: result.rows });
  } catch (err) { next(err); }
};

exports.createChatAssistantRule = async (req, res, next) => {
  try {
    const { name, trigger_condition, trigger_value, action_type, action_value, is_active, priority } = req.body;
    if (!name || !action_type) return res.status(400).json({ error: 'Name and action are required' });
    if (trigger_condition === 'contains' && !String(trigger_value || '').trim()) {
      return res.status(400).json({ error: 'Enter the keyword to look for' });
    }
    const result = await db.query(
      `INSERT INTO whatsapp_chat_assistant_rules
         (workspace_id, name, trigger_condition, trigger_value, trigger_keywords, action_type, action_value, response_message, is_active, is_enabled, priority)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$9,$10) RETURNING *`,
      [req.workspaceId, name, trigger_condition || 'contains', trigger_value || null,
       JSON.stringify(String(trigger_value || '').split(',').map((k) => k.trim()).filter(Boolean)),
       action_type, action_value || null, action_type === 'send_template' ? action_value || null : null,
       is_active !== false, Number(priority) || 0]
    );
    res.status(201).json({ rule: result.rows[0] });
  } catch (err) { next(err); }
};

exports.toggleChatAssistantRule = async (req, res, next) => {
  try {
    const result = await db.query(
      `UPDATE whatsapp_chat_assistant_rules SET is_active = NOT COALESCE(is_active, true),
         is_enabled = NOT COALESCE(is_active, true), updated_at = NOW()
       WHERE id = $1 AND workspace_id = $2 RETURNING *`,
      [req.params.id, req.workspaceId]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Rule not found' });
    res.json({ rule: result.rows[0] });
  } catch (err) { next(err); }
};

exports.deleteChatAssistantRule = async (req, res, next) => {
  try {
    await db.query('DELETE FROM whatsapp_chat_assistant_rules WHERE id=$1 AND workspace_id=$2', [req.params.id, req.workspaceId]);
    res.json({ message: 'Rule deleted' });
  } catch (err) { next(err); }
};

// ─── Outgoing Webhooks ───

exports.getOutgoingWebhooks = async (req, res, next) => {
  try {
    const result = await db.query('SELECT * FROM outgoing_webhooks WHERE workspace_id=$1 ORDER BY created_at DESC', [req.workspaceId]);
    res.json({ webhooks: result.rows });
  } catch (err) { next(err); }
};

exports.createOutgoingWebhook = async (req, res, next) => {
  try {
    const { name, url, events, trigger_event, headers, is_active } = req.body;
    if (!name || !url) return res.status(400).json({ error: 'Name and URL are required' });
    if (!/^https?:\/\//i.test(url)) return res.status(400).json({ error: 'URL must start with http:// or https://' });
    const eventList = Array.isArray(events) && events.length ? events : [trigger_event || 'new_lead'];
    const result = await db.query(
      `INSERT INTO outgoing_webhooks (workspace_id, name, url, trigger_event, events, headers, is_enabled, is_active)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$7) RETURNING *`,
      [req.workspaceId, name, url, eventList[0], JSON.stringify(eventList), JSON.stringify(headers || {}), is_active !== false]
    );
    res.status(201).json({ webhook: result.rows[0] });
  } catch (err) { next(err); }
};

exports.deleteOutgoingWebhook = async (req, res, next) => {
  try {
    await db.query('DELETE FROM outgoing_webhooks WHERE id=$1 AND workspace_id=$2', [req.params.id, req.workspaceId]);
    res.json({ message: 'Webhook deleted' });
  } catch (err) { next(err); }
};

exports.testOutgoingWebhook = async (req, res, next) => {
  try {
    const whRes = await db.query('SELECT * FROM outgoing_webhooks WHERE id=$1 AND workspace_id=$2', [req.params.id, req.workspaceId]);
    if (whRes.rows.length === 0) return res.status(404).json({ error: 'Webhook not found' });
    const wh = whRes.rows[0];
    const axios = require('axios');
    const payload = { event: 'test', timestamp: new Date().toISOString(), workspace_id: req.workspaceId, data: { message: 'Test event from Flazyn' } };
    let ok = true;
    let status = 0;
    let errorMessage = null;
    try {
      const response = await axios.post(wh.url, payload, { timeout: 10000, headers: { 'X-Flazyn-Event': 'test' } });
      status = response.status;
    } catch (err) {
      ok = false;
      status = err.response?.status || 0;
      errorMessage = err.message;
    }
    await db.query(
      `INSERT INTO outgoing_webhook_logs (webhook_id, workspace_id, event, event_type, payload, request_body, response_code, response_status, status, success, error_message)
       VALUES ($1,$2,'test','test',$3,$3,$4,$4,$5,$6,$7)`,
      [wh.id, req.workspaceId, JSON.stringify(payload), status, ok ? 'success' : 'failed', ok, errorMessage]
    );
    res.json(ok ? { success: true, statusCode: status } : { success: false, statusCode: status, error: errorMessage });
  } catch (err) { next(err); }
};

exports.getWebhookLogs = async (req, res, next) => {
  try {
    const result = await db.query('SELECT wl.*, w.name as webhook_name FROM outgoing_webhook_logs wl JOIN outgoing_webhooks w ON wl.webhook_id=w.id WHERE w.workspace_id=$1 ORDER BY wl.created_at DESC LIMIT 100', [req.workspaceId]);
    res.json({ logs: result.rows });
  } catch (err) { next(err); }
};

// ─── Lead Form Pages ───

exports.getLeadFormPages = async (req, res, next) => {
  try {
    const result = await db.query('SELECT * FROM lead_form_pages WHERE workspace_id=$1 ORDER BY created_at DESC', [req.workspaceId]);
    res.json({ pages: result.rows });
  } catch (err) { next(err); }
};

exports.createLeadFormPage = async (req, res, next) => {
  try {
    const { name, title, description, fields, branding, assigned_to, redirect_url, thank_you_message, template_id } = req.body;
    const formKey = crypto.randomBytes(8).toString('hex');
    const result = await db.query(
      `INSERT INTO lead_form_pages (workspace_id, name, form_key, title, description, fields, branding, assigned_to, redirect_url, thank_you_message, template_id) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
      [req.workspaceId, name, formKey, title || name, description, JSON.stringify(fields || []), JSON.stringify(branding || {}), assigned_to || null, redirect_url, thank_you_message || 'Thank you! We will contact you soon.', template_id || null]
    );
    res.status(201).json({ page: result.rows[0] });
  } catch (err) { next(err); }
};

exports.updateLeadFormPage = async (req, res, next) => {
  try {
    const { name, title, description, fields, branding, assigned_to, redirect_url, thank_you_message, is_active, template_id } = req.body;
    const result = await db.query(
      `UPDATE lead_form_pages SET name=COALESCE($1,name), title=COALESCE($2,title), description=COALESCE($3,description), fields=COALESCE($4,fields), branding=COALESCE($5,branding), assigned_to=COALESCE($6,assigned_to), redirect_url=COALESCE($7,redirect_url), thank_you_message=COALESCE($8,thank_you_message), is_active=COALESCE($9,is_active),
         template_id=CASE WHEN $12::boolean THEN $13::uuid ELSE template_id END
       WHERE id=$10 AND workspace_id=$11 RETURNING *`,
      [name, title, description, fields ? JSON.stringify(fields) : null, branding ? JSON.stringify(branding) : null, assigned_to || null, redirect_url, thank_you_message, is_active, req.params.id, req.workspaceId,
       template_id !== undefined, template_id || null]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json({ page: result.rows[0] });
  } catch (err) { next(err); }
};

exports.deleteLeadFormPage = async (req, res, next) => {
  try {
    await db.query('DELETE FROM lead_form_pages WHERE id=$1 AND workspace_id=$2', [req.params.id, req.workspaceId]);
    res.json({ message: 'Deleted' });
  } catch (err) { next(err); }
};

exports.serveLeadFormPage = async (req, res, next) => {
  try {
    const { renderFormPage, SANDBOX_CSP, DEFAULT_TEMPLATE } = require('../services/formRenderer');
    const result = await db.query('SELECT * FROM lead_form_pages WHERE form_key=$1 AND is_active=true', [req.params.formKey]);
    if (result.rows.length === 0) return res.status(404).type('html').send('<html><body style="font-family:system-ui;padding:40px">Form not found</body></html>');
    const page = result.rows[0];
    const tpl = await db.query(
      `SELECT content FROM templates WHERE (id = $1 AND (workspace_id = $2 OR is_system = true)) OR slug = $3
       ORDER BY (id = $1) DESC LIMIT 1`,
      [page.template_id || '00000000-0000-0000-0000-000000000000', page.workspace_id, DEFAULT_TEMPLATE]
    );
    const config = require('../config');
    const html = renderFormPage({
      template: tpl.rows[0]?.content,
      page,
      action: `${config.apiUrl}/api/automations/lead-form/${page.form_key}`,
      // carry the website visitor id (from the tracking script) so prior browsing joins the new lead
      hidden: { _fz_vid: String(req.query.fz_vid || '').slice(0, 64) },
    });
    res.set('Content-Security-Policy', SANDBOX_CSP);
    res.set('X-Frame-Options', 'SAMEORIGIN');
    res.type('html').send(html);
  } catch (err) { next(err); }
};

exports.handleLeadFormSubmission = async (req, res, next) => {
  try {
    const pageRes = await db.query('SELECT * FROM lead_form_pages WHERE form_key=$1 AND is_active=true', [req.params.formKey]);
    if (pageRes.rows.length === 0) return res.status(404).json({ error: 'Form not found' });
    const page = pageRes.rows[0];
    const d = req.body || {};
    const visitorId = String(d._fz_vid || '').slice(0, 64);
    const known = ['first_name', 'last_name', 'name', 'full_name', 'phone', 'mobile', 'email', 'city', 'budget', 'message', 'notes', '_fz_vid'];
    const customFields = Object.entries(d)
      .filter(([k, v]) => !known.includes(k) && !k.startsWith('_') && v !== null && v !== undefined && typeof v !== 'object' && String(v).trim() !== '')
      .map(([name, value]) => ({ name, value: String(value).slice(0, 1000) }));

    const result = await createLead(page.workspace_id, {
      first_name: d.first_name, last_name: d.last_name, name: d.name || d.full_name, phone: d.phone || d.mobile, email: d.email,
      city: d.city, budget: d.budget, notes: d.message || d.notes || `Form: ${page.name}`,
      custom_fields: customFields, assigned_to: page.assigned_to || undefined, lead_source: 'lead_form',
    }, { source: 'lead_form', duplicateMode: 'workspace', activityText: `Lead from form: ${page.name}` });

    const leadId = result.lead?.id || result.duplicate?.id || null;
    if (leadId && visitorId) {
      const { linkVisitorToLead } = require('../services/interestService');
      await linkVisitorToLead(page.workspace_id, visitorId, leadId).catch(() => {});
    }

    // Native <form> posts (templates, custom HTML) get a page back; fetch/JSON callers get JSON.
    if (req.is('application/x-www-form-urlencoded') || req.is('multipart/form-data')) {
      const { thankYouPage, SANDBOX_CSP } = require('../services/formRenderer');
      res.set('Content-Security-Policy', SANDBOX_CSP);
      return res.status(200).type('html').send(thankYouPage(page));
    }
    res.status(201).json({ success: true, leadId });
  } catch (err) {
    logger.error('Lead form submission error:', err.message);
    next(err);
  }
};

// ─── Meta CAPI ───

exports.getMetaCAPIConfig = async (req, res, next) => {
  try {
    const result = await db.query('SELECT * FROM meta_capi_config WHERE workspace_id=$1', [req.workspaceId]);
    const dbConfig = result.rows[0] || null;
    
    // Check if configured via environment variables
    const envConfigured = !!(process.env.META_PIXEL_ID && process.env.META_CONVERSIONS_ACCESS_TOKEN);
    
    res.json({ 
      config: dbConfig,
      is_configured: envConfigured || (dbConfig && dbConfig.pixel_id && dbConfig.access_token),
      env_configured: envConfigured
    });
  } catch (err) { next(err); }
};

exports.updateMetaCAPIConfig = async (req, res, next) => {
  try {
    const { pixel_id, access_token, is_active } = req.body;
    const existing = await db.query('SELECT id FROM meta_capi_config WHERE workspace_id=$1', [req.workspaceId]);
    if (existing.rows.length > 0) {
      const result = await db.query('UPDATE meta_capi_config SET pixel_id=COALESCE($1,pixel_id), access_token=COALESCE($2,access_token), is_active=COALESCE($3,is_active) WHERE workspace_id=$4 RETURNING *', [pixel_id, access_token, is_active, req.workspaceId]);
      res.json({ config: result.rows[0] });
    } else {
      const result = await db.query('INSERT INTO meta_capi_config (workspace_id, pixel_id, access_token, is_active) VALUES ($1,$2,$3,$4) RETURNING *', [req.workspaceId, pixel_id, access_token, is_active !== false]);
      res.status(201).json({ config: result.rows[0] });
    }
  } catch (err) { next(err); }
};

exports.markLeadQualified = async (req, res, next) => {
  try {
    const leadRes = await db.query('SELECT * FROM leads WHERE id=$1 AND workspace_id=$2', [req.params.id, req.workspaceId]);
    if (leadRes.rows.length === 0) return res.status(404).json({ error: 'Lead not found' });
    const lead = leadRes.rows[0];
    await logActivity(req.workspaceId, lead.id, req.user.id, 'lead_qualified', 'Lead marked as qualified');
    const { sendLeadEvent } = require('../services/metaCapiService');
    const capi = await sendLeadEvent(req.workspaceId, lead, 'QualifiedLead', req.user.id);
    const { updateLeadScore } = require('../utils/activityLog');
    await updateLeadScore(lead.id).catch(() => {});
    await cacheDelPattern(`leads:${req.workspaceId}:*`);
    const note = {
      sent: 'Lead marked as qualified and sent to Meta',
      dry_run: 'Lead marked as qualified (test mode: Meta not contacted)',
      not_configured: 'Lead marked as qualified. Connect Meta CAPI to send it to Meta',
      failed: `Lead marked as qualified, but Meta rejected the event: ${capi.error}`,
    }[capi.status];
    res.json({ message: note, capi });
  } catch (err) { next(err); }
};

// ─── Account Token ───

exports.getAccountToken = async (req, res, next) => {
  try {
    const wsRes = await db.query('SELECT id, account_token FROM workspaces WHERE id=$1', [req.workspaceId]);
    let token = wsRes.rows[0]?.account_token;
    if (!token) {
      token = crypto.randomBytes(16).toString('hex');
      await db.query('UPDATE workspaces SET account_token=$1 WHERE id=$2', [token, req.workspaceId]);
    }
    res.json({ account_token: token });
  } catch (err) { next(err); }
};

exports.regenerateAccountToken = async (req, res, next) => {
  try {
    const token = crypto.randomBytes(16).toString('hex');
    await db.query('UPDATE workspaces SET account_token=$1 WHERE id=$2', [token, req.workspaceId]);
    res.json({ account_token: token });
  } catch (err) { next(err); }
};

// ─── Duplicate Lead Report ───

exports.getDuplicateReport = async (req, res, next) => {
  try {
    const result = await db.query(
      `SELECT a.id as lead_a_id, a.first_name as lead_a_name, a.phone as lead_a_phone, a.email as lead_a_email, a.created_at as lead_a_created,
              b.id as lead_b_id, b.first_name as lead_b_name, b.phone as lead_b_phone, b.email as lead_b_email, b.created_at as lead_b_created
       FROM leads a JOIN leads b ON a.id < b.id AND a.workspace_id = b.workspace_id
       AND (REPLACE(REPLACE(a.phone,'+',''),' ','') = REPLACE(REPLACE(b.phone,'+',''),' ','') AND a.phone IS NOT NULL AND a.phone != ''
            OR (a.email = b.email AND a.email IS NOT NULL AND a.email != ''))
       WHERE a.workspace_id = $1 ORDER BY a.created_at DESC LIMIT 100`,
      [req.workspaceId]
    );
    res.json({ duplicates: result.rows });
  } catch (err) { next(err); }
};

// ─── WhatsApp Contact Import ───

exports.getWhatsAppContactImport = async (req, res, next) => {
  try {
    // Get unique phone numbers from WhatsApp messages that don't have matching leads
    const result = await db.query(
      `SELECT DISTINCT wm.phone, 
              (SELECT message_text FROM whatsapp_messages WHERE phone = wm.phone ORDER BY created_at ASC LIMIT 1) as first_message,
              (SELECT COUNT(*) FROM whatsapp_messages WHERE phone = wm.phone) as message_count
       FROM whatsapp_messages wm
       WHERE wm.workspace_id = $1
       AND wm.phone IS NOT NULL
       AND wm.phone != ''
       AND NOT EXISTS (
         SELECT 1 FROM leads l 
         WHERE l.workspace_id = $1 
         AND REPLACE(REPLACE(l.phone,'+',''),' ','') = REPLACE(REPLACE(wm.phone,'+',''),' ','')
       )
       ORDER BY message_count DESC LIMIT 100`,
      [req.workspaceId]
    );
    res.json({ contacts: result.rows });
  } catch (err) { next(err); }
};

exports.importWhatsAppContacts = async (req, res, next) => {
  try {
    const { phone_numbers } = req.body;
    if (!Array.isArray(phone_numbers) || phone_numbers.length === 0) {
      return res.status(400).json({ error: 'phone_numbers array required' });
    }

    const imported = [];
    const errors = [];
    for (const phone of phone_numbers) {
      try {
        const first = await db.query(
          `SELECT message_text FROM whatsapp_messages WHERE workspace_id = $1 AND phone = $2 AND direction = 'inbound'
           ORDER BY created_at ASC LIMIT 1`,
          [req.workspaceId, phone]
        );
        const result = await createLead(req.workspaceId, {
          phone, lead_source: 'whatsapp_import',
          notes: first.rows[0]?.message_text ? `First WhatsApp message: "${first.rows[0].message_text}"` : null,
        }, { actorId: req.user.id, source: 'whatsapp_import', duplicateMode: 'skip', activityText: 'Lead imported from WhatsApp contacts' });
        if (result.status !== 'created') {
          errors.push({ phone, error: 'Lead already exists' });
          continue;
        }
        await db.query(
          'UPDATE whatsapp_messages SET lead_id = $1 WHERE workspace_id = $2 AND phone = $3 AND lead_id IS NULL',
          [result.lead.id, req.workspaceId, phone]
        );
        imported.push({ phone, leadId: result.lead.id });
      } catch (err) {
        errors.push({ phone, error: err.message });
      }
    }

    res.json({ imported, errors, total: imported.length });
  } catch (err) { next(err); }
};

// ─── WhatsApp AI Agent Config ───

exports.getWhatsAppAIAgentConfig = async (req, res, next) => {
  try {
    const result = await db.query('SELECT * FROM whatsapp_ai_agent_config WHERE workspace_id = $1', [req.workspaceId]);
    res.json({ config: result.rows[0] || { is_enabled: false, extract_fields: ['name', 'budget', 'interest', 'product'], auto_reply: true } });
  } catch (err) { next(err); }
};

exports.updateWhatsAppAIAgentConfig = async (req, res, next) => {
  try {
    const { is_enabled, extract_fields, system_prompt, auto_reply } = req.body;
    const existing = await db.query('SELECT id FROM whatsapp_ai_agent_config WHERE workspace_id = $1', [req.workspaceId]);
    
    if (existing.rows.length > 0) {
      const result = await db.query(
        `UPDATE whatsapp_ai_agent_config 
         SET is_enabled = COALESCE($1, is_enabled), 
             extract_fields = COALESCE($2, extract_fields), 
             system_prompt = COALESCE($3, system_prompt), 
             auto_reply = COALESCE($4, auto_reply),
             updated_at = NOW() 
         WHERE workspace_id = $5 RETURNING *`,
        [is_enabled, extract_fields ? JSON.stringify(extract_fields) : null, system_prompt, auto_reply, req.workspaceId]
      );
      res.json({ config: result.rows[0] });
    } else {
      const result = await db.query(
        `INSERT INTO whatsapp_ai_agent_config (workspace_id, is_enabled, extract_fields, system_prompt, auto_reply)
         VALUES ($1, $2, $3, $4, $5) RETURNING *`,
        [req.workspaceId, is_enabled !== false, JSON.stringify(extract_fields || ['name', 'budget', 'interest', 'product']), system_prompt, auto_reply !== false]
      );
      res.status(201).json({ config: result.rows[0] });
    }
  } catch (err) { next(err); }
};

// ─── WhatsApp Auto Create Config ───

exports.getWhatsAppAutoCreateConfig = async (req, res, next) => {
  try {
    const result = await db.query('SELECT * FROM whatsapp_auto_create_config WHERE workspace_id = $1', [req.workspaceId]);
    res.json({ config: result.rows[0] || { is_enabled: false, default_stage: 'new' } });
  } catch (err) { next(err); }
};

exports.updateWhatsAppAutoCreateConfig = async (req, res, next) => {
  try {
    const { is_enabled, auto_assign_to, default_stage } = req.body;
    const existing = await db.query('SELECT id FROM whatsapp_auto_create_config WHERE workspace_id = $1', [req.workspaceId]);
    
    if (existing.rows.length > 0) {
      const result = await db.query(
        `UPDATE whatsapp_auto_create_config 
         SET is_enabled = COALESCE($1, is_enabled), 
             auto_assign_to = COALESCE($2, auto_assign_to), 
             default_stage = COALESCE($3, default_stage),
             updated_at = NOW() 
         WHERE workspace_id = $4 RETURNING *`,
        [is_enabled, auto_assign_to, default_stage, req.workspaceId]
      );
      res.json({ config: result.rows[0] });
    } else {
      const result = await db.query(
        `INSERT INTO whatsapp_auto_create_config (workspace_id, is_enabled, auto_assign_to, default_stage)
         VALUES ($1, $2, $3, $4) RETURNING *`,
        [req.workspaceId, is_enabled !== false, auto_assign_to, default_stage || 'new']
      );
      res.status(201).json({ config: result.rows[0] });
    }
  } catch (err) { next(err); }
};

// ─── WhatsApp Chat Monitoring ───

exports.getWhatsAppChatMonitoring = async (req, res, next) => {
  try {
    // Manager-only access
    if (req.user.role !== 'admin' && req.user.role !== 'owner') {
      return res.status(403).json({ error: 'Manager access required' });
    }

    const result = await db.query(
      `SELECT DISTINCT ON (wm.phone) 
              wm.phone,
              l.id as lead_id,
              l.first_name,
              l.last_name,
              u.first_name as agent_first_name,
              u.last_name as agent_last_name,
              (SELECT message_text FROM whatsapp_messages WHERE phone = wm.phone ORDER BY created_at DESC LIMIT 1) as last_message,
              (SELECT created_at FROM whatsapp_messages WHERE phone = wm.phone ORDER BY created_at DESC LIMIT 1) as last_message_time,
              (SELECT COUNT(*) FROM whatsapp_messages WHERE phone = wm.phone AND direction = 'inbound' AND status != 'read') as unread_count
       FROM whatsapp_messages wm
       LEFT JOIN leads l ON REPLACE(REPLACE(l.phone,'+',''),' ','') = REPLACE(REPLACE(wm.phone,'+',''),' ','') AND l.workspace_id = wm.workspace_id
       LEFT JOIN users u ON l.assigned_to = u.id
       WHERE wm.workspace_id = $1
       ORDER BY last_message_time DESC NULLS LAST LIMIT 100`,
      [req.workspaceId]
    );
    res.json({ conversations: result.rows });
  } catch (err) { next(err); }
};

module.exports = exports;
