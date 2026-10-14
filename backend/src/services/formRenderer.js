// ─── Lead-form page renderer ────────────────────────────────────────────────
// Turns a template (built-in, imported or hand-written HTML) plus a form's
// settings into a public page. Rules:
//  • every value inserted into a placeholder is HTML-escaped
//  • every <form> on the page posts to Flazyn — users can bring their own markup
//    (any input names work; first_name/name/phone/email/city/budget are mapped,
//    everything else becomes a custom field)
//  • pages are served with a CSP sandbox (no same-origin), so custom HTML can
//    never read the app's storage or call the API as a logged-in user

const DEFAULT_TEMPLATE = 'form-ledger';

function esc(v) {
  return String(v ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function safeColor(c, fallback = '#16150F') {
  return /^#[0-9a-f]{3,8}$/i.test(String(c || '')) ? c : fallback;
}

function safeUrl(u) {
  return /^https:\/\//i.test(String(u || '')) ? String(u) : '';
}

function fieldsMarkup(fields) {
  const list = Array.isArray(fields) && fields.length ? fields : [
    { name: 'name', label: 'Full name', type: 'text', required: true },
    { name: 'phone', label: 'Phone', type: 'tel', required: true },
    { name: 'email', label: 'Email', type: 'email' },
  ];
  return list.map((f) => {
    const name = String(f.name || f.label || 'field').toLowerCase().replace(/[^a-z0-9_]+/g, '_');
    const label = esc(f.label || f.name);
    const req = f.required ? ' required' : '';
    const star = f.required ? ' <span class="fz-req">*</span>' : '';
    const id = `fz_${name}`;
    let control;
    if (f.type === 'textarea') control = `<textarea id="${id}" name="${name}"${req}></textarea>`;
    else if (f.type === 'select' && Array.isArray(f.options)) {
      control = `<select id="${id}" name="${name}"${req}><option value="">Select…</option>${f.options.map((o) => `<option>${esc(o)}</option>`).join('')}</select>`;
    } else {
      const type = ['text', 'tel', 'email', 'number', 'date'].includes(f.type) ? f.type : (name.includes('phone') ? 'tel' : name.includes('email') ? 'email' : 'text');
      control = `<input id="${id}" type="${type}" name="${name}" placeholder="${label}"${req}>`;
    }
    const wide = f.type === 'textarea' ? ' fz-wide' : '';
    return `<div class="fz-field${wide}"><label for="${id}">${label}${star}</label>${control}</div>`;
  }).join('\n');
}

/**
 * @param {object} p - { template (html string), page (lead_form_pages row), action, hidden }
 */
function renderFormPage({ template, page, action, hidden = {} }) {
  const branding = typeof page.branding === 'string' ? JSON.parse(page.branding || '{}') : (page.branding || {});
  const fields = typeof page.fields === 'string' ? JSON.parse(page.fields || '[]') : (page.fields || []);
  const brand = safeColor(branding.primary_color, '#16150F');
  const logoUrl = safeUrl(branding.logo_url);
  const values = {
    title: esc(page.title || page.name || 'Get in touch'),
    description: esc(page.description || ''),
    submit: esc(branding.submit_label || 'Send'),
    company: esc(branding.company_name || ''),
    brand_color: brand,
    logo: logoUrl ? `<img src="${esc(logoUrl)}" alt="${esc(branding.company_name || 'Logo')}">` : '',
    hero_image: esc(safeUrl(branding.hero_image) || 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=1400&q=70'),
    thank_you: esc(page.thank_you_message || 'Thank you!'),
    action: esc(action),
    fields: fieldsMarkup(fields),
  };

  let html = String(template || '');
  // Placeholders: {{name}} — unknown ones are left untouched for the page author to notice.
  html = html.replace(/\{\{\s*(title|description|submit|company|brand_color|logo|hero_image|thank_you|action|fields)\s*\}\}/g, (_, k) => values[k]);

  const hiddenInputs = Object.entries(hidden)
    .filter(([, v]) => v)
    .map(([k, v]) => `<input type="hidden" name="${esc(k)}" value="${esc(v)}">`).join('');

  // Point every form at Flazyn (keeping any existing attributes except action/method).
  html = html.replace(/<form\b([^>]*)>/gi, (m, attrs) => {
    const clean = attrs.replace(/\s(action|method|target)\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '');
    return `<form${clean} method="POST" action="${values.action}" accept-charset="utf-8">${hiddenInputs}`;
  });
  // No form in a custom page? Append a standard one so the page is never a dead end.
  if (!/<form\b/i.test(html)) {
    const block = `<form method="POST" action="${values.action}" style="max-width:480px;margin:32px auto;padding:0 16px;font-family:system-ui,sans-serif">${hiddenInputs}${values.fields}<button type="submit">${values.submit}</button></form>`;
    html = /<\/body>/i.test(html) ? html.replace(/<\/body>/i, `${block}</body>`) : html + block;
  }
  return html;
}

function thankYouPage(page) {
  const branding = typeof page.branding === 'string' ? JSON.parse(page.branding || '{}') : (page.branding || {});
  const brand = safeColor(branding.primary_color, '#16150F');
  const redirect = safeUrl(page.redirect_url);
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
${redirect ? `<meta http-equiv="refresh" content="2;url=${esc(redirect)}">` : ''}<title>Thank you</title>
<style>body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;font-family:system-ui,sans-serif;background:#F3F1EC;color:#16150F;padding:24px}
.c{text-align:center;max-width:420px}.m{width:56px;height:56px;border-radius:14px;background:${brand};color:#fff;display:flex;align-items:center;justify-content:center;margin:0 auto 18px;font-size:28px}
h1{font-family:Georgia,serif;font-weight:400;font-size:34px;margin:0 0 8px}p{color:#5F5B50;line-height:1.5;margin:0}</style></head>
<body><div class="c"><div class="m">✓</div><h1>${esc(page.thank_you_message || 'Thank you!')}</h1><p>We've received your details and will be in touch shortly.</p></div></body></html>`;
}

// Opaque-origin sandbox: forms and scripts work, the app's origin is unreachable.
const SANDBOX_CSP = "sandbox allow-forms allow-scripts allow-popups allow-top-navigation-by-user-activation; form-action 'self' https:; base-uri 'none'";

module.exports = { renderFormPage, thankYouPage, fieldsMarkup, esc, SANDBOX_CSP, DEFAULT_TEMPLATE };
