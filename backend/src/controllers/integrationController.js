const db = require('../config/database');
const crypto = require('crypto');
const axios = require('axios');
const logger = require('../utils/logger');
const { createLead } = require('../services/leadPipeline');

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
    // Wipe stored tokens — the privacy policy promises they are deleted on disconnect.
    await db.query("UPDATE integrations SET is_connected = false, credentials = '{}'::jsonb, updated_at = NOW() WHERE id = $1 AND workspace_id = $2", [req.params.id, req.workspaceId]);
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

    const result = await createLead(workspaceId, leadData, { source: type, duplicateMode: 'workspace' });
    if (result.status === 'skipped') {
      return res.json({ success: false, message: 'Duplicate lead detected and skipped' });
    }
    res.json({ success: true, leadId: result.lead.id, merged: result.status === 'merged' });
  } catch (err) { next(err); }
};

// Token-based webhook — used by WordPress plugin, Google Forms add-on, etc.
exports.handleTokenWebhook = async (req, res, next) => {
  try {
    const token = req.params.token;
    const type = req.params.type || 'webhook';

    // Look up workspace by account_token
    const wsResult = await db.query('SELECT id FROM workspaces WHERE account_token = $1', [token]);
    if (wsResult.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid account token' });
    }

    const workspaceId = wsResult.rows[0].id;
    const data = req.body || {};

    // Build lead data from common field names
    const leadData = {
      first_name: data.first_name || data.firstName || '',
      last_name: data.last_name || data.lastName || '',
      phone: data.phone || data.phone_number || data.phoneNumber || data.mobile || '',
      email: data.email || data.email_address || data.emailAddress || '',
      city: data.city || data.location || '',
      budget: data.budget || data.price || null,
      notes: data.notes || data.message || data.comments || data.note || '',
      lead_source: data.source || type,
    };

    // Also check custom field mapping if provided
    if (data.fields && typeof data.fields === 'object') {
      for (const [key, val] of Object.entries(data.fields)) {
        if (!leadData[key] && val) leadData[key] = val;
      }
    }

    if (!leadData.first_name && !data.name && !leadData.phone && !leadData.email) {
      return res.status(400).json({ error: 'At least one of name, phone, or email is required' });
    }

    // Split full name into first/last if only name provided
    if (!leadData.first_name && data.name) {
      const parts = data.name.trim().split(/\s+/);
      leadData.first_name = parts[0] || '';
      leadData.last_name = parts.slice(1).join(' ') || '';
    }

    const extra = { ...data };
    ['first_name', 'last_name', 'name', 'firstName', 'lastName', 'phone', 'phone_number', 'phoneNumber', 'mobile',
     'email', 'email_address', 'emailAddress', 'city', 'location', 'budget', 'price', 'notes', 'message', 'comments',
     'note', 'source', 'fields'].forEach((k) => delete extra[k]);
    const customFields = Object.entries(extra)
      .filter(([, v]) => v !== null && v !== undefined && typeof v !== 'object')
      .map(([name, value]) => ({ name, value: String(value) }));

    const result = await createLead(workspaceId, { ...leadData, custom_fields: customFields }, {
      source: leadData.lead_source, duplicateMode: 'workspace',
    });
    if (result.status === 'skipped') {
      return res.json({ success: false, message: 'Duplicate lead detected and skipped' });
    }
    if (result.status === 'merged') {
      return res.json({ success: true, leadId: result.lead.id, merged: true, message: 'Lead auto-merged with existing duplicate' });
    }
    res.json({ success: true, leadId: result.lead.id, message: 'Lead created successfully' });
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
    const { name, fields, redirect_url, facebook_pixel_id, google_tag_manager_id, custom_tracking_html } = req.body;
    const formKey = crypto.randomBytes(8).toString('hex');
    const result = await db.query(
      'INSERT INTO embed_forms (workspace_id, name, form_key, fields, redirect_url, facebook_pixel_id, google_tag_manager_id, custom_tracking_html) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *',
      [req.workspaceId, name, formKey, JSON.stringify(fields || []), redirect_url, facebook_pixel_id || null, google_tag_manager_id || null, custom_tracking_html || null]
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

    await createLead(form.workspace_id, {
      first_name: data.first_name, name: data.name, last_name: data.last_name, phone: data.phone,
      email: data.email, city: data.city, budget: data.budget, notes: data.message || data.notes,
      lead_source: 'website',
    }, { source: 'website', duplicateMode: 'workspace', activityText: `Lead from website form: ${form.name}` });

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

exports.serveEmbedForm = async (req, res, next) => {
  try {
    const { formKey } = req.params;
    const formResult = await db.query('SELECT * FROM embed_forms WHERE form_key = $1 AND is_active = true', [formKey]);
    if (formResult.rows.length === 0) {
      return res.status(404).send('<html><body><h2>Form not found</h2></body></html>');
    }
    const form = formResult.rows[0];
    const apiUrl = require('../config').apiUrl;

    let trackingHead = '';
    let trackingBody = '';

    if (form.facebook_pixel_id) {
      trackingHead += `<script>
        !function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?
        n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;
        n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;
        t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,
        document,'script','https://connect.facebook.net/en_US/fbevents.js');
        fbq('init', '${form.facebook_pixel_id}');
        fbq('track', 'PageView');
      </script>
      <noscript><img height="1" width="1" style="display:none"
        src="https://www.facebook.com/tr?id=${form.facebook_pixel_id}&ev=PageView&noscript=1"/></noscript>`;
    }

    if (form.google_tag_manager_id) {
      trackingHead += `<script>(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
        new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
        j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
        'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
        })(window,document,'script','dataLayer','${form.google_tag_manager_id}');</script>`;
      trackingBody += `<noscript><iframe src="https://www.googletagmanager.com/ns.html?id=${form.google_tag_manager_id}"
        height="0" width="0" style="display:none;visibility:hidden"></iframe></noscript>`;
    }

    if (form.custom_tracking_html) {
      trackingHead += form.custom_tracking_html;
    }

    const fieldsHtml = (form.fields || []).map(f => {
      const label = f.label || f.name;
      const type = f.type || 'text';
      const required = f.required ? 'required' : '';
      const placeholder = f.placeholder || label;
      if (type === 'textarea') {
        return `<div class="form-field"><label>${label}${f.required ? ' *' : ''}</label><textarea name="${f.name}" ${required} placeholder="${placeholder}" rows="3"></textarea></div>`;
      }
      if (type === 'select' && f.options) {
        return `<div class="form-field"><label>${label}${f.required ? ' *' : ''}</label><select name="${f.name}" ${required}><option value="">Select...</option>${f.options.map(o => `<option value="${o}">${o}</option>`).join('')}</select></div>`;
      }
      return `<div class="form-field"><label>${label}${f.required ? ' *' : ''}</label><input type="${type}" name="${f.name}" ${required} placeholder="${placeholder}"></div>`;
    }).join('');

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>${form.name}</title>
    ${trackingHead}
    <style>
      *{margin:0;padding:0;box-sizing:border-box}
      body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f8fafc;padding:20px}
      .form-container{max-width:500px;margin:0 auto;background:#fff;border-radius:12px;padding:30px;box-shadow:0 2px 10px rgba(0,0,0,0.08)}
      .form-title{font-size:22px;font-weight:600;color:#0f172a;margin-bottom:20px}
      .form-field{margin-bottom:16px}
      .form-field label{display:block;font-size:14px;font-weight:500;color:#374151;margin-bottom:6px}
      .form-field input,.form-field textarea,.form-field select{width:100%;padding:10px 12px;border:1px solid #d1d5db;border-radius:8px;font-size:15px;outline:none;transition:border-color 0.2s}
      .form-field input:focus,.form-field textarea:focus,.form-field select:focus{border-color:#2563eb}
      .submit-btn{width:100%;background:#2563eb;color:#fff;border:none;padding:14px;border-radius:8px;font-size:16px;font-weight:600;cursor:pointer;margin-top:8px}
      .submit-btn:hover{background:#1d4ed8}
      .success-msg{text-align:center;color:#059669;font-size:16px;padding:20px}
    </style></head><body>
    ${trackingBody}
    <div class="form-container">
      <h2 class="form-title">${form.name}</h2>
      <form id="leadForm" action="${apiUrl}/api/integrations/embed/${form.form_key}" method="POST">
        ${fieldsHtml}
        <button type="submit" class="submit-btn">Submit</button>
      </form>
    </div>
    <script>
      document.getElementById('leadForm').addEventListener('submit', function(e) {
        e.preventDefault();
        var formData = new FormData(this);
        var data = {};
        formData.forEach(function(v, k) { data[k] = v; });
        fetch(this.action, {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify(data)
        }).then(function(res) { return res.json(); }).then(function(d) {
          ${form.facebook_pixel_id ? `fbq('track', 'Lead');` : ''}
          ${form.google_tag_manager_id ? `dataLayer.push({'event': 'lead_submit'});` : ''}
          document.querySelector('.form-container').innerHTML = '<div class="success-msg">Thank you! We will contact you soon.</div>';
        }).catch(function() {
          document.querySelector('.form-container').innerHTML = '<div class="success-msg">Thank you! We will contact you soon.</div>';
        });
      });
    </script>
    </body></html>`;

    res.set('Content-Type', 'text/html');
    res.send(html);
  } catch (err) { next(err); }
};

exports.parseLeadFromEmail = async (req, res, next) => {
  try {
    const { email_subject, email_body, email_from } = req.body;

    if (!email_body) {
      return res.status(400).json({ error: 'Email body required' });
    }

    const config = require('../config');
    const logger = require('../utils/logger');

    let parsedData = null;

    if (config.openai.apiKey) {
      try {
        const OpenAI = require('openai');
        const openai = new OpenAI({ apiKey: config.openai.apiKey });
        const completion = await openai.chat.completions.create({
          model: 'gpt-4o',
          messages: [
            { role: 'system', content: 'You are a lead parsing assistant. Extract lead information from email content. Return JSON with fields: first_name, last_name, phone, email, city, budget, notes, lead_source. Only include fields you can find. Return {} if no lead info found.' },
            { role: 'user', content: `Subject: ${email_subject || ''}\nFrom: ${email_from || ''}\nBody: ${email_body}` },
          ],
          temperature: 0.3,
        });
        parsedData = JSON.parse(completion.choices[0].message.content);
      } catch (err) {
        logger.error('AI lead parsing error:', err.message);
      }
    }

    if (!parsedData) {
      const phoneMatch = email_body.match(/(\+?\d[\d\s\-()]{8,}\d)/);
      const emailMatch = email_body.match(/[\w.+-]+@[\w-]+\.[\w.-]+/);
      const nameMatch = email_subject?.match(/(?:Lead|Contact|Inquiry)[:\s]+([A-Za-z\s]+)/);

      parsedData = {};
      if (phoneMatch) parsedData.phone = phoneMatch[1].trim();
      if (emailMatch) parsedData.email = emailMatch[0];
      if (nameMatch) {
        const parts = nameMatch[1].trim().split(' ');
        parsedData.first_name = parts[0];
        parsedData.last_name = parts.slice(1).join(' ');
      }
      parsedData.notes = email_body.substring(0, 500);
      parsedData.lead_source = 'email_parse';
    }

    if (Object.keys(parsedData).length === 0) {
      return res.json({ parsed: false, message: 'No lead information found in email' });
    }

    if (req.body.auto_create && (parsedData.phone || parsedData.email)) {
      const result = await createLead(req.workspaceId, { ...parsedData, lead_source: parsedData.lead_source || 'email_parse' }, {
        actorId: req.user.id, source: 'email_parse', duplicateMode: 'workspace', activityText: 'Lead parsed from email',
      });
      return res.json({ parsed: true, lead: result.lead || result.duplicate, status: result.status, extractedData: parsedData });
    }

    res.json({ parsed: true, extractedData: parsedData });
  } catch (err) { next(err); }
};
