const db = require('../config/database');
const crypto = require('crypto');
const { logActivity } = require('../utils/activityLog');
const { sendPushNotification } = require('../utils/notifications');
const { updateLeadScore } = require('../utils/activityLog');

exports.getIntegrations = async (req, res, next) => {
  try {
    const result = await db.query('SELECT * FROM integrations WHERE workspace_id = $1 ORDER BY type', [req.workspaceId]);
    res.json({ integrations: result.rows });
  } catch (err) { next(err); }
};

exports.connectIntegration = async (req, res, next) => {
  try {
    const { type, credentials, config, field_mapping } = req.body;
    const result = await db.query(
      `INSERT INTO integrations (workspace_id, type, is_connected, credentials, config, field_mapping)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (workspace_id, type) DO UPDATE SET is_connected = true, credentials = $4, config = $5, field_mapping = $6, updated_at = NOW()
       RETURNING *`,
      [req.workspaceId, type, true, JSON.stringify(credentials || {}), JSON.stringify(config || {}), JSON.stringify(field_mapping || {})]
    );
    res.json({ integration: result.rows[0] });
  } catch (err) { next(err); }
};

exports.disconnectIntegration = async (req, res, next) => {
  try {
    await db.query('UPDATE integrations SET is_connected = false WHERE id = $1 AND workspace_id = $2', [req.params.id, req.workspaceId]);
    res.json({ message: 'Integration disconnected' });
  } catch (err) { next(err); }
};

exports.getWebhooks = async (req, res, next) => {
  try {
    const result = await db.query('SELECT * FROM webhook_endpoints WHERE workspace_id = $1 ORDER BY created_at DESC', [req.workspaceId]);
    res.json({ webhooks: result.rows });
  } catch (err) { next(err); }
};

exports.createWebhook = async (req, res, next) => {
  try {
    const { type, field_mapping } = req.body;
    const secret = crypto.randomBytes(32).toString('hex');
    const endpointUrl = `${require('../config').apiUrl}/api/integrations/webhook/${req.workspaceId}/${type}/${secret}`;
    const result = await db.query(
      'INSERT INTO webhook_endpoints (workspace_id, type, endpoint_url, secret, field_mapping) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [req.workspaceId, type, endpointUrl, secret, JSON.stringify(field_mapping || {})]
    );
    res.status(201).json({ webhook: result.rows[0] });
  } catch (err) { next(err); }
};

exports.handleWebhook = async (req, res, next) => {
  try {
    const { workspaceId, type, secret } = req.params;
    const webhookResult = await db.query('SELECT * FROM webhook_endpoints WHERE workspace_id = $1 AND type = $2 AND secret = $3 AND is_active = true', [workspaceId, type, secret]);
    if (webhookResult.rows.length === 0) {
      return res.status(404).json({ error: 'Webhook not found' });
    }

    const webhook = webhookResult.rows[0];
    const data = req.body;
    const fieldMapping = webhook.field_mapping || {};

    const leadData = {};
    for (const [sourceField, targetField] of Object.entries(fieldMapping)) {
      if (data[sourceField] !== undefined) {
        leadData[targetField] = data[sourceField];
      }
    }

    if (!leadData.first_name && data.name) leadData.first_name = data.name;
    if (!leadData.phone && data.phone) leadData.phone = data.phone;
    if (!leadData.email && data.email) leadData.email = data.email;
    leadData.lead_source = type;

    const stageResult = await db.query('SELECT id FROM lead_stages WHERE workspace_id = $1 AND is_default = true LIMIT 1', [workspaceId]);
    const agentsResult = await db.query(
      `SELECT u.id FROM users u WHERE u.workspace_id = $1 AND u.role = $2 AND u.status = $3
       ORDER BY (SELECT COUNT(*) FROM leads WHERE assigned_to = u.id) ASC LIMIT 1`,
      [workspaceId, 'sales_agent', 'active']
    );

    const leadResult = await db.query(
      `INSERT INTO leads (workspace_id, first_name, last_name, phone, email, city, lead_source, stage, stage_id, assigned_to, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING id`,
      [workspaceId, leadData.first_name, leadData.last_name, leadData.phone, leadData.email, leadData.city,
       type, 'new', stageResult.rows[0]?.id, agentsResult.rows[0]?.id, req.user?.id || null]
    );

    const leadId = leadResult.rows[0].id;
    await logActivity(workspaceId, leadId, null, 'lead_created', `Lead captured from ${type}`);
    await updateLeadScore(leadId);

    if (agentsResult.rows[0]?.id) {
      await sendPushNotification(agentsResult.rows[0].id, `New ${type} Lead`, `New lead: ${leadData.first_name || 'Unknown'}`, { type: 'new_lead', leadId, source: type });
    }

    res.json({ success: true, leadId });
  } catch (err) { next(err); }
};

exports.getEmbedForms = async (req, res, next) => {
  try {
    const result = await db.query('SELECT * FROM embed_forms WHERE workspace_id = $1 ORDER BY created_at DESC', [req.workspaceId]);
    res.json({ forms: result.rows });
  } catch (err) { next(err); }
};

exports.createEmbedForm = async (req, res, next) => {
  try {
    const { name, fields, redirect_url } = req.body;
    const formKey = crypto.randomBytes(8).toString('hex');
    const result = await db.query(
      'INSERT INTO embed_forms (workspace_id, name, form_key, fields, redirect_url) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [req.workspaceId, name, form_key = formKey, JSON.stringify(fields || []), redirect_url]
    );
    res.status(201).json({ form: result.rows[0] });
  } catch (err) { next(err); }
};

exports.handleEmbedForm = async (req, res, next) => {
  try {
    const { formKey } = req.params;
    const formResult = await db.query('SELECT * FROM embed_forms WHERE form_key = $1 AND is_active = true', [formKey]);
    if (formResult.rows.length === 0) {
      return res.status(404).json({ error: 'Form not found' });
    }

    const form = formResult.rows[0];
    const data = req.body;

    const stageResult = await db.query('SELECT id FROM lead_stages WHERE workspace_id = $1 AND is_default = true LIMIT 1', [form.workspace_id]);
    const agentsResult = await db.query(
      `SELECT u.id FROM users u WHERE u.workspace_id = $1 AND u.role = $2 AND u.status = $3
       ORDER BY (SELECT COUNT(*) FROM leads WHERE assigned_to = u.id) ASC LIMIT 1`,
      [form.workspace_id, 'sales_agent', 'active']
    );

    const leadResult = await db.query(
      `INSERT INTO leads (workspace_id, first_name, last_name, phone, email, city, lead_source, stage, stage_id, assigned_to)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING id`,
      [form.workspace_id, data.first_name || data.name, data.last_name, data.phone, data.email, data.city,
       'website', 'new', stageResult.rows[0]?.id, agentsResult.rows[0]?.id]
    );

    const leadId = leadResult.rows[0].id;
    await logActivity(form.workspace_id, leadId, null, 'lead_created', 'Lead from website embed form');
    await updateLeadScore(leadId);

    if (agentsResult.rows[0]?.id) {
      await sendPushNotification(agentsResult.rows[0].id, 'New Website Lead', `New lead: ${data.first_name || data.name || 'Unknown'}`, { type: 'new_lead', leadId, source: 'website' });
    }

    if (form.redirect_url) {
      res.redirect(form.redirect_url);
    } else {
      res.json({ success: true, message: 'Thank you! We will contact you soon.' });
    }
  } catch (err) { next(err); }
};

exports.getEmbedCode = async (req, res, next) => {
  try {
    const result = await db.query('SELECT * FROM embed_forms WHERE id = $1 AND workspace_id = $2', [req.params.id, req.workspaceId]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Form not found' });
    const form = result.rows[0];
    const apiUrl = require('../config').apiUrl;
    const embedCode = `<iframe src="${apiUrl}/api/integrations/embed/${form.form_key}" width="100%" height="500" frameborder="0"></iframe>`;
    res.json({ embedCode, formUrl: `${apiUrl}/api/integrations/embed/${form.form_key}` });
  } catch (err) { next(err); }
};
