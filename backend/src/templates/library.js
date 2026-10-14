// ─── Built-in template library ──────────────────────────────────────────────
// Seeded into `templates` (is_system = true) by migration 016. Workspaces can
// use them as-is, duplicate and edit them, or import/write their own.
//
// FORM templates are full HTML documents with these placeholders (all values
// are HTML-escaped by services/formRenderer.js before insertion):
//   {{title}} {{description}} {{fields}} {{submit}} {{logo}} {{brand_color}}
//   {{company}} {{action}} {{hero_image}} {{thank_you}}
// EMAIL templates are full HTML documents using lead variables such as
//   {{First_Name}} {{Agent_Name}} {{Company_Name}} {{Brochure_Link}}
// WHATSAPP / SMS templates are plain text with the same variables.

const BASE_FIELD_CSS = `
.fz-field{margin-bottom:14px}
.fz-field label{display:block;margin-bottom:6px}
.fz-field input,.fz-field select,.fz-field textarea{width:100%;font:inherit;outline:none}
.fz-field textarea{min-height:96px;resize:vertical}
.fz-req{opacity:.6}
`;

const FORMS = [
  {
    slug: 'form-ledger',
    name: 'Ledger',
    category: 'Minimal',
    description: 'Paper-and-ink, serif headline. Calm and premium — works for any business.',
    preview_color: '#F3F1EC',
    content: `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>{{title}}</title>
<link href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Instrument+Sans:wght@400;500;600&display=swap" rel="stylesheet">
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Instrument Sans',system-ui,sans-serif;background:#F3F1EC;color:#16150F;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:32px 16px;
background-image:radial-gradient(rgba(22,21,15,.04) 1px,transparent 1px);background-size:22px 22px}
.sheet{width:100%;max-width:460px;background:#FFFEFB;border:1px solid #E2DED4;border-radius:14px;padding:36px 32px}
.logo img{max-height:40px;margin-bottom:24px}
.eyebrow{font:500 10.5px/1.4 ui-monospace,monospace;letter-spacing:.09em;text-transform:uppercase;color:#9A9587;margin-bottom:10px}
h1{font-family:'Instrument Serif',Georgia,serif;font-weight:400;font-size:40px;line-height:1.02;letter-spacing:-.02em;margin-bottom:12px}
p.d{color:#5F5B50;font-size:15px;line-height:1.55;margin-bottom:26px}
${BASE_FIELD_CSS}
.fz-field label{font-size:13px;font-weight:500;color:#5F5B50}
.fz-field input,.fz-field select,.fz-field textarea{border:1px solid #CFCABD;border-radius:8px;padding:11px 12px;background:#fff;font-size:15px}
.fz-field input:focus,.fz-field select:focus,.fz-field textarea:focus{border-color:#16150F;box-shadow:0 0 0 3px {{brand_color}}55}
button{width:100%;margin-top:8px;background:#16150F;color:#FFFEFB;border:0;border-radius:8px;padding:14px;font:600 15px 'Instrument Sans',sans-serif;cursor:pointer}
button:hover{background:#2A2820}
.foot{margin-top:18px;font-size:12px;color:#9A9587;text-align:center}
</style></head><body>
<main class="sheet">
  <div class="logo">{{logo}}</div>
  <p class="eyebrow">{{company}}</p>
  <h1>{{title}}</h1>
  <p class="d">{{description}}</p>
  <form>{{fields}}<button type="submit">{{submit}}</button></form>
  <p class="foot">We reply fast — usually within minutes.</p>
</main></body></html>`,
  },
  {
    slug: 'form-split-showcase',
    name: 'Split Showcase',
    category: 'Real estate & property',
    description: 'Big image on the left, form on the right. Made for listings, projects and launches.',
    preview_color: '#1F2A24',
    content: `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>{{title}}</title>
<link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,700&family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:Inter,system-ui,sans-serif;min-height:100vh;display:grid;grid-template-columns:1.1fr 1fr;background:#fff;color:#18201B}
.hero{position:relative;background:#1F2A24 center/cover no-repeat;background-image:linear-gradient(180deg,rgba(15,22,18,.15),rgba(15,22,18,.85)),url('{{hero_image}}');color:#fff;padding:48px;display:flex;flex-direction:column;justify-content:flex-end}
.hero .logo img{position:absolute;top:40px;left:48px;max-height:42px;filter:brightness(0) invert(1)}
.hero h1{font-family:Fraunces,Georgia,serif;font-size:clamp(34px,4vw,54px);line-height:1.02;font-weight:500;max-width:520px}
.hero ul{list-style:none;margin-top:22px;display:flex;flex-wrap:wrap;gap:8px}
.hero li{border:1px solid rgba(255,255,255,.35);border-radius:999px;padding:6px 14px;font-size:13px}
.panel{padding:56px 48px;display:flex;flex-direction:column;justify-content:center;max-width:520px;width:100%;margin:0 auto}
.panel h2{font-family:Fraunces,Georgia,serif;font-weight:700;font-size:26px;margin-bottom:8px}
.panel p.d{color:#5B6660;font-size:15px;margin-bottom:26px;line-height:1.55}
${BASE_FIELD_CSS}
.fz-field label{font-size:12px;font-weight:600;letter-spacing:.04em;text-transform:uppercase;color:#5B6660}
.fz-field input,.fz-field select,.fz-field textarea{border:0;border-bottom:1.5px solid #CDD5D0;padding:10px 0;font-size:16px;background:transparent}
.fz-field input:focus,.fz-field select:focus,.fz-field textarea:focus{border-color:{{brand_color}}}
button{margin-top:14px;background:{{brand_color}};color:#fff;border:0;border-radius:999px;padding:15px 28px;font:600 15px Inter,sans-serif;cursor:pointer;align-self:flex-start}
@media(max-width:820px){body{grid-template-columns:1fr}.hero{min-height:42vh;padding:28px}.hero .logo img{top:24px;left:28px}.panel{padding:32px 24px}}
</style></head><body>
<section class="hero"><div class="logo">{{logo}}</div><h1>{{title}}</h1><ul><li>Verified listing</li><li>Instant callback</li><li>No obligation</li></ul></section>
<section class="panel"><h2>Get the details</h2><p class="d">{{description}}</p><form>{{fields}}<button type="submit">{{submit}} →</button></form></section>
</body></html>`,
  },
  {
    slug: 'form-volt-night',
    name: 'Volt Night',
    category: 'Bold',
    description: 'Dark, high-contrast and loud. For launches, events and limited-time offers.',
    preview_color: '#0E0E0C',
    content: `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>{{title}}</title>
<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;700&display=swap" rel="stylesheet">
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Space Grotesk',system-ui,sans-serif;background:#0E0E0C;color:#F4F3EE;min-height:100vh;padding:48px 20px;display:flex;justify-content:center}
.wrap{width:100%;max-width:640px}
.logo img{max-height:36px;filter:brightness(0) invert(1);margin-bottom:40px}
.tag{display:inline-block;background:{{brand_color}};color:#0E0E0C;font-weight:700;font-size:12px;letter-spacing:.08em;text-transform:uppercase;padding:6px 10px;border-radius:4px;margin-bottom:18px}
h1{font-size:clamp(40px,8vw,76px);line-height:.95;letter-spacing:-.04em;font-weight:700;margin-bottom:18px}
p.d{color:#A9A79F;font-size:17px;line-height:1.5;max-width:520px;margin-bottom:34px}
form{display:grid;grid-template-columns:1fr 1fr;gap:0 14px}
.fz-field.fz-wide,.fz-field:has(textarea){grid-column:1/-1}
${BASE_FIELD_CSS}
.fz-field label{font-size:13px;color:#A9A79F}
.fz-field input,.fz-field select,.fz-field textarea{background:#1A1A17;border:1px solid #2E2D29;border-radius:6px;padding:14px;color:#F4F3EE;font-size:16px}
.fz-field input:focus,.fz-field select:focus,.fz-field textarea:focus{border-color:{{brand_color}}}
button{grid-column:1/-1;margin-top:10px;background:{{brand_color}};color:#0E0E0C;border:0;border-radius:6px;padding:18px;font:700 17px 'Space Grotesk',sans-serif;cursor:pointer;letter-spacing:-.01em}
@media(max-width:560px){form{grid-template-columns:1fr}}
</style></head><body><main class="wrap">
<div class="logo">{{logo}}</div><span class="tag">{{company}}</span>
<h1>{{title}}</h1><p class="d">{{description}}</p>
<form>{{fields}}<button type="submit">{{submit}}</button></form>
</main></body></html>`,
  },
  {
    slug: 'form-soft-clinic',
    name: 'Soft Care',
    category: 'Health, beauty & education',
    description: 'Gentle gradients and round shapes. Reassuring for clinics, salons, schools and coaching.',
    preview_color: '#E7F0EC',
    content: `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>{{title}}</title>
<link href="https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;800&display=swap" rel="stylesheet">
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:Nunito,system-ui,sans-serif;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:32px 16px;color:#21332B;
background:radial-gradient(1200px 600px at 10% 0%,#DDEFE6 0%,transparent 60%),radial-gradient(900px 500px at 100% 100%,#F6E6DA 0%,transparent 55%),#F7F6F2}
.card{width:100%;max-width:470px;background:rgba(255,255,255,.85);backdrop-filter:blur(6px);border-radius:28px;padding:36px 30px;box-shadow:0 30px 60px -30px rgba(33,51,43,.35)}
.logo{text-align:center}.logo img{max-height:48px;margin-bottom:16px}
h1{text-align:center;font-weight:800;font-size:28px;line-height:1.15;margin-bottom:10px}
p.d{text-align:center;color:#5D6F66;margin-bottom:26px;line-height:1.55}
${BASE_FIELD_CSS}
.fz-field label{font-size:14px;font-weight:600;color:#3F5249;padding-left:6px}
.fz-field input,.fz-field select,.fz-field textarea{border:1.5px solid #DCE5E0;border-radius:16px;padding:13px 16px;background:#fff;font-size:15px}
.fz-field input:focus,.fz-field select:focus,.fz-field textarea:focus{border-color:{{brand_color}};box-shadow:0 0 0 4px {{brand_color}}22}
button{width:100%;margin-top:6px;background:{{brand_color}};color:#fff;border:0;border-radius:999px;padding:15px;font:800 16px Nunito,sans-serif;cursor:pointer;box-shadow:0 12px 24px -12px {{brand_color}}}
.trust{display:flex;justify-content:center;gap:16px;margin-top:18px;font-size:12.5px;color:#5D6F66}
</style></head><body><main class="card">
<div class="logo">{{logo}}</div><h1>{{title}}</h1><p class="d">{{description}}</p>
<form>{{fields}}<button type="submit">{{submit}}</button></form>
<div class="trust"><span>✓ Private & secure</span><span>✓ Free consultation</span></div>
</main></body></html>`,
  },
  {
    slug: 'form-one-question',
    name: 'Big Type',
    category: 'Mobile-first',
    description: 'Oversized type and full-width fields — feels like a conversation on a phone.',
    preview_color: '#FFF4D6',
    content: `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>{{title}}</title>
<link href="https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;9..40,600;9..40,800&display=swap" rel="stylesheet">
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'DM Sans',system-ui,sans-serif;background:#FFF4D6;color:#1E1A10;min-height:100vh;padding:40px 22px}
.wrap{max-width:600px;margin:0 auto}
.logo img{max-height:34px;margin-bottom:36px}
h1{font-size:clamp(34px,7vw,56px);font-weight:800;line-height:1.02;letter-spacing:-.03em;margin-bottom:14px}
p.d{font-size:18px;color:#5E553C;margin-bottom:34px;line-height:1.5}
${BASE_FIELD_CSS}
.fz-field{margin-bottom:26px}
.fz-field label{font-size:15px;font-weight:600;margin-bottom:4px}
.fz-field input,.fz-field select,.fz-field textarea{border:0;border-bottom:3px solid #1E1A10;background:transparent;padding:8px 0;font-size:26px;font-weight:600}
.fz-field input::placeholder{color:#C9BE9C}
.fz-field input:focus,.fz-field select:focus,.fz-field textarea:focus{border-color:{{brand_color}}}
button{display:inline-flex;align-items:center;gap:10px;background:#1E1A10;color:#FFF4D6;border:0;border-radius:14px;padding:18px 26px;font:800 18px 'DM Sans',sans-serif;cursor:pointer}
button::after{content:'↵';opacity:.6}
</style></head><body><main class="wrap">
<div class="logo">{{logo}}</div><h1>{{title}}</h1><p class="d">{{description}}</p>
<form>{{fields}}<button type="submit">{{submit}}</button></form>
</main></body></html>`,
  },
];

const emailShell = (accent, inner) => `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>{{Company_Name}}</title></head>
<body style="margin:0;padding:0;background:#F3F1EC;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F3F1EC;"><tr><td align="center" style="padding:28px 12px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:580px;background:#FFFEFB;border:1px solid #E2DED4;border-radius:12px;">
<tr><td style="height:6px;background:${accent};border-radius:12px 12px 0 0;font-size:0;line-height:0;">&nbsp;</td></tr>
<tr><td style="padding:34px 36px 30px;font-family:Arial,Helvetica,sans-serif;color:#16150F;font-size:15px;line-height:1.65;">${inner}</td></tr>
</table>
<p style="font-family:Arial,sans-serif;font-size:11px;color:#9A9587;margin:16px 0 0;">{{Company_Name}}</p>
</td></tr></table></body></html>`;

const btn = (label, href, bg = '#16150F', fg = '#FFFEFB') =>
  `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:22px 0;"><tr><td style="background:${bg};border-radius:8px;"><a href="${href}" style="display:inline-block;padding:13px 26px;font-family:Arial,sans-serif;font-size:15px;font-weight:bold;color:${fg};text-decoration:none;">${label}</a></td></tr></table>`;

const EMAILS = [
  {
    slug: 'email-first-reply', name: 'First reply', category: 'Speed-to-lead',
    description: 'Goes out the minute a lead arrives. Personal, short, one clear next step.',
    preview_color: '#D6F24B',
    content: emailShell('#D6F24B', `<p style="margin:0 0 16px;font-size:22px;font-family:Georgia,serif;">Hi {{First_Name}},</p>
<p style="margin:0 0 14px;">Thanks for reaching out to {{Company_Name}} — I've got your details and I'm on it.</p>
<p style="margin:0 0 14px;">To point you to the right options, what matters most to you right now: <b>price</b>, <b>location</b>, or <b>timeline</b>? Just hit reply with one word.</p>
${btn('Message me on WhatsApp', 'https://wa.me/{{Agent_Phone}}', '#16150F')}
<p style="margin:0;">{{Agent_Name}}<br><span style="color:#5F5B50;">{{Company_Name}}</span></p>`),
  },
  {
    slug: 'email-brochure', name: 'Brochure follow-up', category: 'Nurture',
    description: 'Shares a tracked brochure — you will see which pages they read and for how long.',
    preview_color: '#16150F',
    content: emailShell('#16150F', `<p style="margin:0 0 6px;font:500 11px monospace;letter-spacing:.1em;text-transform:uppercase;color:#9A9587;">For {{First_Name}}</p>
<p style="margin:0 0 16px;font-size:26px;line-height:1.15;font-family:Georgia,serif;">Everything you asked about, in one place.</p>
<p style="margin:0 0 14px;">Here's the full brochure with plans, pricing and payment options. Page 4 has the comparison most people ask about.</p>
${btn('Open the brochure', '{{Brochure_Link}}')}
<p style="margin:0;color:#5F5B50;">Questions? Reply here or call me — {{Agent_Name}}.</p>`),
  },
  {
    slug: 'email-visit-invite', name: 'Visit invitation', category: 'Conversion',
    description: 'Invites a warm lead to a site visit, demo or consultation with a clear time slot.',
    preview_color: '#2F6B3A',
    content: emailShell('#2F6B3A', `<p style="margin:0 0 16px;font-size:22px;font-family:Georgia,serif;">{{First_Name}}, let's make it real.</p>
<p style="margin:0 0 14px;">Seeing it in person answers more questions than any brochure. I've kept two slots open this week:</p>
<table role="presentation" cellpadding="0" cellspacing="0" style="margin:6px 0 4px;"><tr>
<td style="border:1px solid #E2DED4;border-radius:8px;padding:12px 16px;font-family:monospace;">Sat · 11:00</td><td style="width:10px;"></td>
<td style="border:1px solid #E2DED4;border-radius:8px;padding:12px 16px;font-family:monospace;">Sun · 16:00</td></tr></table>
${btn('Book my visit', 'https://wa.me/{{Agent_Phone}}', '#2F6B3A')}
<p style="margin:0;">See you soon,<br>{{Agent_Name}}</p>`),
  },
  {
    slug: 'email-still-interested', name: 'Still interested?', category: 'Re-engagement',
    description: 'A respectful nudge for leads that went quiet — easy to answer in one click.',
    preview_color: '#FF5A1F',
    content: emailShell('#FF5A1F', `<p style="margin:0 0 16px;font-size:22px;font-family:Georgia,serif;">Hi {{First_Name}} — quick one.</p>
<p style="margin:0 0 14px;">I don't want to fill your inbox if the timing isn't right. Which of these fits best?</p>
<p style="margin:0 0 6px;">→ <b>Yes, still looking</b> — reply "1"</p>
<p style="margin:0 0 6px;">→ <b>Later this year</b> — reply "2"</p>
<p style="margin:0 0 18px;">→ <b>Not anymore</b> — reply "3" and I'll stop here</p>
<p style="margin:0;">Thanks either way,<br>{{Agent_Name}}</p>`),
  },
];

const WHATSAPP = [
  ['wa-first-touch', 'First touch', 'Speed-to-lead', 'Hi {{First_Name}} 👋 This is {{Agent_Name}} from {{Company_Name}}. Thanks for your enquiry! Is now a good time for a quick 2-minute call?'],
  ['wa-brochure', 'Share brochure', 'Nurture', 'Hi {{First_Name}}, here is the brochure you asked for: {{Brochure_Link}}\nPage 4 has prices and payment plans. Tell me which option catches your eye 🙂'],
  ['wa-missed-call', 'Missed your call', 'Follow-up', 'Hi {{First_Name}}, I just tried calling you about your enquiry with {{Company_Name}}. When is a better time to reach you?'],
  ['wa-day-two', 'Day-2 check-in', 'Follow-up', 'Hi {{First_Name}}, did you get a chance to look at the details I sent? Happy to answer anything — even small questions.'],
  ['wa-visit-confirm', 'Visit confirmation', 'Conversion', 'Hi {{First_Name}}, confirming your visit with {{Agent_Name}} 📍 Reply YES to confirm or send a time that suits you better.'],
  ['wa-offer', 'Limited offer', 'Conversion', '{{First_Name}}, quick heads-up: we have a special offer running until Sunday. Want me to send you the details?'],
  ['wa-reengage', 'Still looking?', 'Re-engagement', 'Hi {{First_Name}}, it has been a while! Are you still looking, or should I check back later in the year?'],
  ['wa-thank-you', 'Thank you', 'After sale', 'Thank you for choosing {{Company_Name}}, {{First_Name}}! 🎉 If you ever need anything, message me here — {{Agent_Name}}.'],
];

const SMS = [
  ['sms-first-touch', 'First touch', 'Speed-to-lead', 'Hi {{First_Name}}, {{Agent_Name}} from {{Company_Name}} here. Got your enquiry — I will call you shortly.'],
  ['sms-missed', 'Missed call', 'Follow-up', 'Hi {{First_Name}}, tried calling about your enquiry. Reply with a good time to talk. - {{Agent_Name}}'],
  ['sms-reminder', 'Appointment reminder', 'Conversion', 'Reminder: your appointment with {{Company_Name}} is coming up. Reply C to confirm or R to reschedule.'],
  ['sms-reengage', 'Re-engage', 'Re-engagement', 'Hi {{First_Name}}, still interested? Reply YES and {{Agent_Name}} will get back to you today.'],
];

function systemTemplates() {
  return [
    ...FORMS.map((t) => ({ ...t, kind: 'form', format: 'html' })),
    ...EMAILS.map((t) => ({ ...t, kind: 'email', format: 'html' })),
    ...WHATSAPP.map(([slug, name, category, content]) => ({ slug, name, category, content, kind: 'whatsapp', format: 'text', description: '' })),
    ...SMS.map(([slug, name, category, content]) => ({ slug, name, category, content, kind: 'sms', format: 'text', description: '' })),
  ];
}

module.exports = { systemTemplates };
