const crypto = require('crypto');
const db = require('../config/database');
const config = require('../config');
const { replaceVariables } = require('../utils/variables');
const { renderFormPage } = require('../services/formRenderer');

// ─── Template library ───
// kinds: form | email | whatsapp | sms        formats: html | text
// System templates (workspace_id NULL) are read-only; "Duplicate" makes an editable copy.

const KINDS = ['form', 'email', 'whatsapp', 'sms'];
const MAX_SIZE = 400 * 1024;

const SAMPLE_LEAD = {
  first_name: 'Sara', last_name: 'Khan', phone: '+92 300 1234567', email: 'sara@example.com', city: 'Lahore',
  agent_name: 'Ali', agent_phone: '923001234567', company_name: 'Your Company', brochure_link: 'https://example.com/brochure',
};

const SAMPLE_FORM = {
  name: 'Preview', title: 'Find your next home', description: 'Tell us what you are looking for and an advisor will call you within minutes.',
  fields: [
    { name: 'name', label: 'Full name', type: 'text', required: true },
    { name: 'phone', label: 'Phone', type: 'tel', required: true },
    { name: 'budget', label: 'Budget', type: 'select', options: ['Under 1 crore', '1–3 crore', '3 crore+'] },
    { name: 'message', label: 'Anything else?', type: 'textarea' },
  ],
  branding: { primary_color: '#2F6B3A', company_name: 'Your Company', submit_label: 'Request a callback' },
};

function present(t) {
  return {
    id: t.id, kind: t.kind, name: t.name, description: t.description, category: t.category, format: t.format,
    preview_color: t.preview_color, is_system: t.is_system, source: t.source, updated_at: t.updated_at,
    content: t.content, editable: !t.is_system,
  };
}

function detectKind(content, filename = '') {
  const s = String(content || '');
  if (/\.(txt)$/i.test(filename) || !/<[a-z!]/i.test(s)) return s.length <= 320 ? 'sms' : 'whatsapp';
  if (/<form\b|\{\{\s*fields\s*\}\}/i.test(s)) return 'form';
  return 'email';
}

function previewHtml(t) {
  if (t.kind === 'form') {
    return renderFormPage({ template: t.content, page: SAMPLE_FORM, action: '#preview' });
  }
  if (t.kind === 'email') return replaceVariables(t.content, SAMPLE_LEAD);
  const text = replaceVariables(t.content, SAMPLE_LEAD).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/\n/g, '<br>');
  const bubble = t.kind === 'whatsapp'
    ? 'background:#DCF8C6;border-radius:10px 10px 2px 10px;'
    : 'background:#E9E9EB;border-radius:16px 16px 4px 16px;';
  return `<!DOCTYPE html><html><body style="margin:0;padding:24px;background:${t.kind === 'whatsapp' ? '#ECE5DD' : '#fff'};font-family:system-ui,sans-serif;">
<div style="max-width:320px;margin-left:auto;${bubble}padding:10px 12px;font-size:14.5px;line-height:1.45;color:#111;box-shadow:0 1px 1px rgba(0,0,0,.1)">${text}</div></body></html>`;
}

async function getTemplate(req, id) {
  const r = await db.query('SELECT * FROM templates WHERE id = $1 AND (workspace_id = $2 OR is_system = true)', [id, req.workspaceId]);
  return r.rows[0] || null;
}

exports.list = async (req, res, next) => {
  try {
    const params = [req.workspaceId];
    let where = '(workspace_id = $1 OR is_system = true)';
    if (KINDS.includes(req.query.kind)) { params.push(req.query.kind); where += ` AND kind = $${params.length}`; }
    const r = await db.query(`SELECT * FROM templates WHERE ${where} ORDER BY is_system ASC, updated_at DESC`, params);
    res.json({ templates: r.rows.map(present) });
  } catch (err) { next(err); }
};

exports.get = async (req, res, next) => {
  try {
    const t = await getTemplate(req, req.params.id);
    if (!t) return res.status(404).json({ error: 'Template not found' });
    res.json({ template: present(t) });
  } catch (err) { next(err); }
};

exports.preview = async (req, res, next) => {
  try {
    const t = await getTemplate(req, req.params.id);
    if (!t) return res.status(404).json({ error: 'Template not found' });
    res.json({ html: previewHtml(t) });
  } catch (err) { next(err); }
};

/** Live preview for unsaved content (custom editor). */
exports.previewDraft = async (req, res, next) => {
  try {
    const { kind, content } = req.body || {};
    if (!KINDS.includes(kind)) return res.status(400).json({ error: 'Unknown template type' });
    res.json({ html: previewHtml({ kind, content: String(content || '').slice(0, MAX_SIZE) }) });
  } catch (err) { next(err); }
};

function validate({ kind, name, content }) {
  if (!KINDS.includes(kind)) return 'Choose a template type';
  if (!String(name || '').trim()) return 'Give the template a name';
  if (!String(content || '').trim()) return 'Template content is empty';
  if (String(content).length > MAX_SIZE) return 'Template is too large (max 400 KB)';
  return null;
}

exports.create = async (req, res, next) => {
  try {
    const { kind, name, description, category, content, preview_color } = req.body || {};
    const error = validate({ kind, name, content });
    if (error) return res.status(400).json({ error });
    const format = kind === 'form' || kind === 'email' ? 'html' : 'text';
    const r = await db.query(
      `INSERT INTO templates (workspace_id, kind, name, description, category, format, content, preview_color, source, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [req.workspaceId, kind, name.trim(), description || '', category || 'Custom', format, content, preview_color || null,
       req.body.source === 'imported' ? 'imported' : 'custom', req.user.id]
    );
    res.status(201).json({ template: present(r.rows[0]) });
  } catch (err) { next(err); }
};

exports.update = async (req, res, next) => {
  try {
    const { name, description, category, content, preview_color } = req.body || {};
    if (content !== undefined && String(content).length > MAX_SIZE) return res.status(400).json({ error: 'Template is too large (max 400 KB)' });
    const r = await db.query(
      `UPDATE templates SET name = COALESCE($1, name), description = COALESCE($2, description), category = COALESCE($3, category),
         content = COALESCE($4, content), preview_color = COALESCE($5, preview_color), updated_at = NOW()
       WHERE id = $6 AND workspace_id = $7 AND is_system = false RETURNING *`,
      [name ?? null, description ?? null, category ?? null, content ?? null, preview_color ?? null, req.params.id, req.workspaceId]
    );
    if (!r.rows[0]) return res.status(404).json({ error: 'Template not found or not editable' });
    res.json({ template: present(r.rows[0]) });
  } catch (err) { next(err); }
};

exports.remove = async (req, res, next) => {
  try {
    const r = await db.query('DELETE FROM templates WHERE id = $1 AND workspace_id = $2 AND is_system = false RETURNING id', [req.params.id, req.workspaceId]);
    if (!r.rows[0]) return res.status(404).json({ error: 'Template not found or not deletable' });
    res.json({ message: 'Template deleted' });
  } catch (err) { next(err); }
};

exports.duplicate = async (req, res, next) => {
  try {
    const t = await getTemplate(req, req.params.id);
    if (!t) return res.status(404).json({ error: 'Template not found' });
    const r = await db.query(
      `INSERT INTO templates (workspace_id, kind, name, description, category, format, content, preview_color, source, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'custom',$9) RETURNING *`,
      [req.workspaceId, t.kind, `${t.name} (copy)`, t.description, t.category, t.format, t.content, t.preview_color, req.user.id]
    );
    res.status(201).json({ template: present(r.rows[0]) });
  } catch (err) { next(err); }
};

/**
 * Import: a Flazyn export (.json), an HTML file (form or email) or a text file
 * (WhatsApp/SMS). Body: { content, filename?, kind?, name? }
 */
exports.importTemplate = async (req, res, next) => {
  try {
    let { content, filename = '', kind, name } = req.body || {};
    content = String(content || '');
    if (!content.trim()) return res.status(400).json({ error: 'The file is empty' });
    if (content.length > MAX_SIZE) return res.status(400).json({ error: 'File is too large (max 400 KB)' });

    if (/\.json$/i.test(filename) || /^\s*\{[\s\S]*"flazyn_template"/.test(content)) {
      let parsed;
      try { parsed = JSON.parse(content); } catch { return res.status(400).json({ error: 'That JSON file could not be read' }); }
      const t = parsed.flazyn_template || parsed;
      kind = KINDS.includes(t.kind) ? t.kind : kind;
      name = name || t.name;
      content = t.content;
      req.body.description = t.description;
      req.body.category = t.category;
    }
    kind = KINDS.includes(kind) ? kind : detectKind(content, filename);
    name = (name || filename.replace(/\.[a-z0-9]+$/i, '') || 'Imported template').slice(0, 120);
    req.body = { ...req.body, kind, name, content, source: 'imported' };
    return exports.create(req, res, next);
  } catch (err) { next(err); }
};

exports.exportTemplate = async (req, res, next) => {
  try {
    const t = await getTemplate(req, req.params.id);
    if (!t) return res.status(404).json({ error: 'Template not found' });
    const payload = { flazyn_template: { version: 1, kind: t.kind, name: t.name, description: t.description, category: t.category, content: t.content } };
    res.set('Content-Disposition', `attachment; filename="${t.name.replace(/[^a-z0-9-_ ]/gi, '').trim() || 'template'}.flazyn.json"`);
    res.json(payload);
  } catch (err) { next(err); }
};

/** Put a template to work: creates the real object and tells the UI where to go. */
exports.use = async (req, res, next) => {
  try {
    const t = await getTemplate(req, req.params.id);
    if (!t) return res.status(404).json({ error: 'Template not found' });
    const ws = req.workspaceId;

    if (t.kind === 'email') {
      const subject = (t.content.match(/<title>([^<]*)<\/title>/i) || [])[1] || t.name;
      const r = await db.query(
        `INSERT INTO marketing_emails (workspace_id, name, subject, design, html, created_by) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
        [ws, t.name, subject.replace(/\{\{[^}]+\}\}/g, '').trim() || t.name, JSON.stringify([{ id: `h${Date.now()}`, type: 'html', html: t.content }]), t.content, req.user.id]
      );
      return res.status(201).json({ message: 'Email created from template', redirect: `/app/marketing/emails/${r.rows[0].id}` });
    }
    if (t.kind === 'whatsapp') {
      await db.query('INSERT INTO whatsapp_templates (workspace_id, name, category, content) VALUES ($1,$2,$3,$4)', [ws, t.name, (t.category || 'general').toLowerCase(), t.content]);
      return res.status(201).json({ message: 'Added to your WhatsApp quick replies', redirect: '/app/whatsapp-campaigns' });
    }
    if (t.kind === 'sms') {
      await db.query('INSERT INTO sms_templates (workspace_id, name, content) VALUES ($1,$2,$3)', [ws, t.name, t.content]);
      return res.status(201).json({ message: 'Added to your SMS templates', redirect: '/app/sms-campaigns' });
    }
    // form → a ready-to-share lead form page using this design
    const formKey = crypto.randomBytes(8).toString('hex');
    const r = await db.query(
      `INSERT INTO lead_form_pages (workspace_id, name, form_key, title, description, fields, branding, template_id, thank_you_message)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id, form_key`,
      [ws, `${t.name} form`, formKey, SAMPLE_FORM.title, SAMPLE_FORM.description,
       JSON.stringify(SAMPLE_FORM.fields.slice(0, 3)), JSON.stringify({ primary_color: '#16150F', submit_label: 'Send' }), t.id,
       'Thank you! We will contact you shortly.']
    );
    return res.status(201).json({
      message: 'Form page created — edit the questions and share the link',
      redirect: '/app/automations/lead-forms',
      url: `${config.apiUrl}/api/automations/lead-form/${r.rows[0].form_key}`,
    });
  } catch (err) { next(err); }
};
