const db = require('../config/database');
const crypto = require('crypto');
const logger = require('../utils/logger');
const { logActivity, updateLeadScore } = require('../utils/activityLog');
const { sendPushNotification } = require('../utils/notifications');
const { cacheDelPattern } = require('../config/redis');

// ─── Lead Automation Rules ───

exports.getAutomationRules = async (req, res, next) => {
  try {
    const result = await db.query('SELECT * FROM lead_automation_rules WHERE workspace_id = $1 ORDER BY priority ASC', [req.workspaceId]);
    res.json({ rules: result.rows });
  } catch (err) { next(err); }
};

exports.createAutomationRule = async (req, res, next) => {
  try {
    const { name, trigger_source, conditions, actions, is_active, priority } = req.body;
    const result = await db.query(
      `INSERT INTO lead_automation_rules (workspace_id, name, trigger_source, conditions, actions, is_active, priority) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [req.workspaceId, name, trigger_source || 'any', JSON.stringify(conditions || []), JSON.stringify(actions || []), is_active !== false, priority || 0]
    );
    res.status(201).json({ rule: result.rows[0] });
  } catch (err) { next(err); }
};

exports.updateAutomationRule = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, trigger_source, conditions, actions, is_active, priority } = req.body;
    const result = await db.query(
      `UPDATE lead_automation_rules SET name=COALESCE($1,name), trigger_source=COALESCE($2,trigger_source), conditions=COALESCE($3,conditions), actions=COALESCE($4,actions), is_active=COALESCE($5,is_active), priority=COALESCE($6,priority) WHERE id=$7 AND workspace_id=$8 RETURNING *`,
      [name, trigger_source, conditions ? JSON.stringify(conditions) : null, actions ? JSON.stringify(actions) : null, is_active, priority, id, req.workspaceId]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Rule not found' });
    res.json({ rule: result.rows[0] });
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
    const conditions = typeof rule.conditions === 'string' ? JSON.parse(rule.conditions) : rule.conditions;
    const sample = req.body.sample_lead || {};
    const matched = conditions.length === 0 || conditions.every(c => {
      const v = sample[c.field];
      if (c.operator === 'equals') return v === c.value;
      if (c.operator === 'contains') return String(v || '').includes(c.value);
      if (c.operator === 'greater_than') return parseFloat(v) > parseFloat(c.value);
      if (c.operator === 'less_than') return parseFloat(v) < parseFloat(c.value);
      return false;
    });
    res.json({ matched, message: matched ? 'Rule would trigger' : 'Rule would NOT trigger' });
  } catch (err) { next(err); }
};

// ─── Lead Distribution ───

exports.getDistributionConfig = async (req, res, next) => {
  try {
    const result = await db.query('SELECT * FROM lead_distribution_config WHERE workspace_id=$1', [req.workspaceId]);
    res.json({ configs: result.rows });
  } catch (err) { next(err); }
};

exports.updateDistributionConfig = async (req, res, next) => {
  try {
    const { source, mode, recipients } = req.body;
    const existing = await db.query('SELECT id FROM lead_distribution_config WHERE workspace_id=$1 AND source=$2', [req.workspaceId, source]);
    if (existing.rows.length > 0) {
      const result = await db.query('UPDATE lead_distribution_config SET mode=$1, recipients=$2 WHERE workspace_id=$3 AND source=$4 RETURNING *', [mode, JSON.stringify(recipients), req.workspaceId, source]);
      res.json({ config: result.rows[0] });
    } else {
      const result = await db.query('INSERT INTO lead_distribution_config (workspace_id, source, mode, recipients) VALUES ($1,$2,$3,$4) RETURNING *', [req.workspaceId, source, mode, JSON.stringify(recipients)]);
      res.status(201).json({ config: result.rows[0] });
    }
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
    const result = await db.query(
      `INSERT INTO whatsapp_chat_assistant_rules (workspace_id, name, trigger_condition, trigger_value, action_type, action_value, is_active, priority) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [req.workspaceId, name, trigger_condition, trigger_value, action_type, action_value, is_active !== false, priority || 0]
    );
    res.status(201).json({ rule: result.rows[0] });
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
    const { name, url, events, is_active } = req.body;
    const result = await db.query('INSERT INTO outgoing_webhooks (workspace_id, name, url, events, is_active) VALUES ($1,$2,$3,$4,$5) RETURNING *', [req.workspaceId, name, url, JSON.stringify(events || []), is_active !== false]);
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
    const payload = { event: 'test', timestamp: new Date().toISOString(), data: { message: 'Test from CRM Final' } };
    try {
      const response = await axios.post(wh.url, payload, { timeout: 10000 });
      await db.query('INSERT INTO outgoing_webhook_logs (webhook_id, event, payload, response_code, status) VALUES ($1,$2,$3,$4,$5)', [wh.id, 'test', JSON.stringify(payload), response.status, 'success']);
      res.json({ success: true, statusCode: response.status });
    } catch (err) {
      await db.query('INSERT INTO outgoing_webhook_logs (webhook_id, event, payload, response_code, status, error_message) VALUES ($1,$2,$3,$4,$5,$6)', [wh.id, 'test', JSON.stringify(payload), err.response?.status || 0, 'failed', err.message]);
      res.json({ success: false, error: err.message });
    }
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
    const { name, title, description, fields, branding, assigned_to, redirect_url, thank_you_message } = req.body;
    const formKey = crypto.randomBytes(8).toString('hex');
    const result = await db.query(
      `INSERT INTO lead_form_pages (workspace_id, name, form_key, title, description, fields, branding, assigned_to, redirect_url, thank_you_message) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [req.workspaceId, name, formKey, title || name, description, JSON.stringify(fields || []), JSON.stringify(branding || {}), assigned_to, redirect_url, thank_you_message || 'Thank you! We will contact you soon.']
    );
    res.status(201).json({ page: result.rows[0] });
  } catch (err) { next(err); }
};

exports.updateLeadFormPage = async (req, res, next) => {
  try {
    const { name, title, description, fields, branding, assigned_to, redirect_url, thank_you_message, is_active } = req.body;
    const result = await db.query(
      `UPDATE lead_form_pages SET name=COALESCE($1,name), title=COALESCE($2,title), description=COALESCE($3,description), fields=COALESCE($4,fields), branding=COALESCE($5,branding), assigned_to=COALESCE($6,assigned_to), redirect_url=COALESCE($7,redirect_url), thank_you_message=COALESCE($8,thank_you_message), is_active=COALESCE($9,is_active) WHERE id=$10 AND workspace_id=$11 RETURNING *`,
      [name, title, description, fields ? JSON.stringify(fields) : null, branding ? JSON.stringify(branding) : null, assigned_to, redirect_url, thank_you_message, is_active, req.params.id, req.workspaceId]
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
    const result = await db.query('SELECT * FROM lead_form_pages WHERE form_key=$1 AND is_active=true', [req.params.formKey]);
    if (result.rows.length === 0) return res.status(404).send('<html><body><h2>Form not found</h2></body></html>');
    const page = result.rows[0];
    const config = require('../config');
    const branding = typeof page.branding === 'string' ? JSON.parse(page.branding) : page.branding || {};
    const fields = typeof page.fields === 'string' ? JSON.parse(page.fields) : page.fields || [];

    const fieldsHtml = fields.map(f => {
      const label = f.label || f.name;
      const type = f.type || 'text';
      const req = f.required ? 'required' : '';
      if (type === 'textarea') return `<div class="f"><label>${label}${f.required?' *':''}</label><textarea name="${f.name}" ${req} rows="3"></textarea></div>`;
      if (type === 'select' && f.options) return `<div class="f"><label>${label}${f.required?' *':''}</label><select name="${f.name}" ${req}><option value="">Select...</option>${f.options.map(o=>`<option>${o}</option>`).join('')}</select></div>`;
      return `<div class="f"><label>${label}${f.required?' *':''}</label><input type="${type}" name="${f.name}" ${req} placeholder="${label}"></div>`;
    }).join('');

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${page.title}</title><style>
      *{margin:0;padding:0;box-sizing:border-box}body{font-family:sans-serif;background:${branding.bg_color||'#f8fafc'};padding:20px}
      .c{max-width:480px;margin:0 auto;background:#fff;border-radius:16px;padding:32px;box-shadow:0 4px 20px rgba(0,0,0,.08)}
      .logo{text-align:center;margin-bottom:16px}.logo img{max-height:60px}
      h2{font-size:22px;font-weight:700;color:#0f172a;margin-bottom:8px;text-align:center}
      .d{font-size:14px;color:#64748b;text-align:center;margin-bottom:24px}
      .f{margin-bottom:16px}.f label{display:block;font-size:14px;font-weight:500;color:#374151;margin-bottom:6px}
      .f input,.f textarea,.f select{width:100%;padding:10px 14px;border:1px solid #d1d5db;border-radius:8px;font-size:15px;outline:none}
      .f input:focus,.f textarea:focus,.f select:focus{border-color:${branding.primary_color||'#2563eb'}}
      .b{width:100%;background:${branding.primary_color||'#2563eb'};color:#fff;border:none;padding:14px;border-radius:8px;font-size:16px;font-weight:600;cursor:pointer;margin-top:8px}
      .s{text-align:center;color:#059669;font-size:18px;padding:30px}
    </style></head><body><div class="c">
      ${branding.logo_url?`<div class="logo"><img src="${branding.logo_url}"></div>`:''}
      <h2>${page.title}</h2>${page.description?`<p class="d">${page.description}</p>`:''}
      <form id="lf">${fieldsHtml}<button type="submit" class="b">Submit</button></form>
    </div><script>
    document.getElementById('lf').addEventListener('submit',function(e){e.preventDefault();var d={};new FormData(this).forEach(function(v,k){d[k]=v});
    fetch('${config.apiUrl}/api/automations/lead-form/${page.form_key}',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(d)})
    .then(function(){document.querySelector('.c').innerHTML='<div class="s">${page.thank_you_message||'Thank you!'}</div>';${page.redirect_url?`setTimeout(function(){window.location='${page.redirect_url}';},2000);`:''}})
    .catch(function(){document.querySelector('.c').innerHTML='<div class="s">${page.thank_you_message||'Thank you!'}</div>';});});
    </script></body></html>`;
    res.set('Content-Type', 'text/html');
    res.send(html);
  } catch (err) { next(err); }
};

exports.handleLeadFormSubmission = async (req, res, next) => {
  try {
    const pageRes = await db.query('SELECT * FROM lead_form_pages WHERE form_key=$1 AND is_active=true', [req.params.formKey]);
    if (pageRes.rows.length === 0) return res.status(404).json({ error: 'Form not found' });
    const page = pageRes.rows[0];
    const d = req.body;
    const firstName = d.first_name || d.name?.split(' ')[0] || 'Unknown';
    const lastName = d.last_name || d.name?.split(' ').slice(1).join(' ') || '';
    const agentsRes = await db.query(`SELECT u.id FROM users u WHERE u.workspace_id=$1 AND u.role='sales_agent' AND u.status='active' ORDER BY (SELECT COUNT(*) FROM leads WHERE assigned_to=u.id) ASC LIMIT 1`, [page.workspace_id]);
    const leadRes = await db.query(
      `INSERT INTO leads (workspace_id, first_name, last_name, phone, email, city, budget, lead_source, notes, stage, assigned_to, custom_fields) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
      [page.workspace_id, firstName, lastName, d.phone, d.email, d.city, d.budget, 'lead_form', d.message || d.notes || `Form: ${page.name}`, 'new', page.assigned_to || agentsRes.rows[0]?.id, JSON.stringify(d)]
    );
    const lead = leadRes.rows[0];
    await logActivity(page.workspace_id, lead.id, null, 'lead_created', `Lead from form: ${page.name}`);
    await updateLeadScore(lead.id);
    if (page.assigned_to || agentsRes.rows[0]?.id) {
      await sendPushNotification(page.assigned_to || agentsRes.rows[0].id, 'New Lead from Form', `${firstName} ${lastName}`, { type: 'new_lead', leadId: lead.id }).catch(() => {});
    }
    res.status(201).json({ success: true });
  } catch (err) { next(err); }
};

// ─── Meta CAPI ───

exports.getMetaCAPIConfig = async (req, res, next) => {
  try {
    const result = await db.query('SELECT * FROM meta_capi_config WHERE workspace_id=$1', [req.workspaceId]);
    res.json({ config: result.rows[0] || null });
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
    const capiRes = await db.query('SELECT * FROM meta_capi_config WHERE workspace_id=$1 AND is_active=true', [req.workspaceId]);
    if (capiRes.rows.length > 0) {
      const capi = capiRes.rows[0];
      const axios = require('axios');
      const sha256 = (s) => crypto.createHash('sha256').update(s || '').digest('hex');
      try {
        await axios.post(`https://graph.facebook.com/v18.0/${capi.pixel_id}/events`, {
          data: [{ event_name: 'QualifiedLead', event_time: Math.floor(Date.now()/1000), action_source: 'system_generated', user_data: { ph: [sha256(lead.phone)], em: [sha256(lead.email)] } }],
          access_token: capi.access_token,
        });
      } catch (e) { logger.error('Meta CAPI error:', e.message); }
    }
    await logActivity(req.workspaceId, req.params.id, req.user.id, 'lead_qualified', 'Lead marked as qualified');
    await cacheDelPattern(`leads:${req.workspaceId}:*`);
    res.json({ message: 'Lead marked as qualified' });
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

module.exports = exports;
