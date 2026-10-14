const crypto = require('crypto');
const axios = require('axios');
const db = require('../config/database');
const config = require('../config');
const logger = require('../utils/logger');

// ─── Interest engine ────────────────────────────────────────────────────────
// Turns real behaviour into an interest score (0–100) with the evidence behind
// it, and (when OPENAI_API_KEY is set) an AI brief: what the lead cares about,
// the next best action and a draft message. Inputs:
//   • website sessions & page dwell time      (tracking script, engagement_* tables)
//   • document reading, page by page          (tracked viewer, engagement_* tables)
//   • email opens / clicks / replies          (emails)
//   • WhatsApp replies                         (whatsapp_messages)
//   • pipeline stage
// Every point in the score is traceable to a `signal` shown in the UI.

const HIGH_INTENT = /(pric|plan|rate|cost|fee|book|appoint|schedul|visit|contact|checkout|payment|install|floor|brochure|apply|demo|quote|offer)/i;

// ── Lead link tokens: ?fz=… on links sent to a lead identifies them on the website ──
function leadLinkToken(leadId) {
  const id = String(leadId).replace(/-/g, '');
  const sig = crypto.createHmac('sha256', config.jwt.secret).update(id).digest('base64url').slice(0, 10);
  return `${id}.${sig}`;
}

function leadIdFromToken(token) {
  const [id, sig] = String(token || '').split('.');
  if (!/^[0-9a-f]{32}$/.test(id || '') || !sig) return null;
  const expected = crypto.createHmac('sha256', config.jwt.secret).update(id).digest('base64url').slice(0, 10);
  if (expected !== sig) return null;
  return `${id.slice(0, 8)}-${id.slice(8, 12)}-${id.slice(12, 16)}-${id.slice(16, 20)}-${id.slice(20)}`;
}

async function linkVisitorToLead(workspaceId, visitorId, leadId) {
  if (!visitorId || !leadId) return;
  await db.query(
    `INSERT INTO web_visitors (workspace_id, visitor_id, lead_id) VALUES ($1,$2,$3)
     ON CONFLICT (workspace_id, visitor_id) DO UPDATE SET lead_id = EXCLUDED.lead_id, last_seen_at = NOW()`,
    [workspaceId, visitorId, leadId]
  );
  // Attribute this visitor's earlier anonymous sessions to the lead.
  await db.query(
    'UPDATE engagement_sessions SET lead_id = $1 WHERE workspace_id = $2 AND visitor_id = $3 AND lead_id IS NULL',
    [leadId, workspaceId, visitorId]
  );
}

async function findLeadByContact(workspaceId, { email, phone }) {
  const digits = String(phone || '').replace(/\D/g, '');
  if (!email && digits.length < 7) return null;
  const r = await db.query(
    `SELECT id FROM leads WHERE workspace_id = $1 AND (
       ($2::text IS NOT NULL AND LOWER(email) = LOWER($2)) OR
       ($3::text IS NOT NULL AND RIGHT(REGEXP_REPLACE(COALESCE(phone,''), '\\D', '', 'g'), 10) = RIGHT($3, 10)))
     ORDER BY created_at ASC LIMIT 1`,
    [workspaceId, email || null, digits.length >= 7 ? digits : null]
  );
  return r.rows[0]?.id || null;
}

/**
 * Record a heartbeat/view. Upserts the session and the view row, adding `seconds`.
 * Returns { session, isNewSession }.
 */
async function recordView({ workspaceId, sessionId, channel, leadId = null, visitorId = null, contentTrackingId = null,
  objectKey, url = null, title = null, pageNumber = null, seconds = 0, scroll = 0, referrer = null, device = null }) {
  const secs = Math.max(0, Math.min(Number(seconds) || 0, 120)); // clamp: one beat never counts more than 2 min
  const existing = await db.query('SELECT * FROM engagement_sessions WHERE id = $1', [sessionId]);
  let isNewSession = false;
  if (!existing.rows[0]) {
    isNewSession = true;
    await db.query(
      `INSERT INTO engagement_sessions (id, workspace_id, lead_id, visitor_id, channel, content_tracking_id, referrer, landing_url, device)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT (id) DO NOTHING`,
      [sessionId, workspaceId, leadId, visitorId, channel, contentTrackingId, referrer, url, device]
    );
  } else if (existing.rows[0].workspace_id !== workspaceId) {
    return { session: null, isNewSession: false }; // session id reused across workspaces — ignore
  }
  await db.query(
    `UPDATE engagement_sessions SET last_seen_at = NOW(), total_seconds = total_seconds + $2,
       lead_id = COALESCE(lead_id, $3) WHERE id = $1`,
    [sessionId, secs, leadId]
  );
  if (objectKey) {
    await db.query(
      `INSERT INTO engagement_views (session_id, workspace_id, object_key, url, title, page_number, seconds, max_scroll)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       ON CONFLICT (session_id, object_key) DO UPDATE SET seconds = engagement_views.seconds + EXCLUDED.seconds,
         max_scroll = GREATEST(engagement_views.max_scroll, EXCLUDED.max_scroll), last_at = NOW(),
         title = COALESCE(EXCLUDED.title, engagement_views.title)`,
      [sessionId, workspaceId, String(objectKey).slice(0, 500), url ? String(url).slice(0, 1000) : null,
       title ? String(title).slice(0, 300) : null, pageNumber, secs, Math.max(0, Math.min(100, Number(scroll) || 0))]
    );
  }
  const session = (await db.query('SELECT * FROM engagement_sessions WHERE id = $1', [sessionId])).rows[0];
  if (session?.lead_id) {
    await db.query('UPDATE leads SET last_activity_at = NOW() WHERE id = $1', [session.lead_id]).catch(() => {});
  }
  return { session, isNewSession };
}

/** One alert per session: "<name> is reading your brochure right now". */
async function alertOnceForSession(session, { what }) {
  if (!session?.lead_id || session.notified) return;
  // Atomic claim — concurrent beacons for the same session must not double-alert.
  const claimed = await db.query('UPDATE engagement_sessions SET notified = true WHERE id = $1 AND notified = false RETURNING id', [session.id]);
  if (!claimed.rows.length) return;
  const lead = (await db.query('SELECT id, first_name, last_name, assigned_to, workspace_id FROM leads WHERE id = $1', [session.lead_id])).rows[0];
  if (!lead) return;
  const name = [lead.first_name, lead.last_name].filter(Boolean).join(' ') || 'A lead';
  const { logActivity } = require('../utils/activityLog');
  await logActivity(lead.workspace_id, lead.id, null, session.channel === 'document' ? 'document_opened' : 'website_visit', `${name} ${what}`, { session_id: session.id });
  const { sendPushNotification, notifyManagers } = require('../utils/notifications');
  const body = 'Good moment to reach out — they are engaged right now.';
  if (lead.assigned_to) await sendPushNotification(lead.assigned_to, `${name} ${what}`, body, { type: 'interest_live', leadId: lead.id });
  else await notifyManagers(lead.workspace_id, 'interest_live', `${name} ${what}`, body, { leadId: lead.id });
  const { emitToWorkspace } = require('../utils/realtime');
  emitToWorkspace(lead.workspace_id, 'interest:live', { leadId: lead.id, what });
}

// ── Scoring ──

function fmtSecs(s) {
  const n = Math.round(Number(s) || 0);
  if (n < 60) return `${n}s`;
  const m = Math.floor(n / 60);
  return m < 60 ? `${m}m ${String(n % 60).padStart(2, '0')}s` : `${Math.floor(m / 60)}h ${m % 60}m`;
}

async function computeInterest(workspaceId, leadId) {
  const lead = (await db.query('SELECT * FROM leads WHERE id = $1 AND workspace_id = $2', [leadId, workspaceId])).rows[0];
  if (!lead) return null;

  const [sessions, views, docs, emailStats, waStats] = await Promise.all([
    db.query(
      `SELECT id, channel, total_seconds, started_at, last_seen_at, referrer, landing_url, device, content_tracking_id
       FROM engagement_sessions WHERE lead_id = $1 ORDER BY started_at DESC LIMIT 200`, [leadId]),
    db.query(
      `SELECT v.object_key, v.url, v.title, v.page_number, v.seconds, v.max_scroll, v.last_at, s.channel, s.content_tracking_id
       FROM engagement_views v JOIN engagement_sessions s ON s.id = v.session_id WHERE s.lead_id = $1`, [leadId]),
    db.query(
      `SELECT ct.id, ct.file_id, ct.open_count, ct.first_opened_at, ct.last_opened_at, ct.page_count, cf.name, cf.mime_type
       FROM content_tracking ct LEFT JOIN content_files cf ON cf.id = ct.file_id WHERE ct.lead_id = $1`, [leadId]),
    db.query(
      `SELECT COUNT(*) FILTER (WHERE opened_at IS NOT NULL) AS opens, COUNT(*) FILTER (WHERE clicked_at IS NOT NULL) AS clicks,
              COUNT(*) FILTER (WHERE replied_at IS NOT NULL) AS replies, MAX(GREATEST(opened_at, clicked_at, replied_at)) AS last_at
       FROM emails WHERE lead_id = $1`, [leadId]).catch(() => ({ rows: [{}] })),
    db.query(
      `SELECT COUNT(*) AS inbound, MAX(created_at) AS last_at FROM whatsapp_messages WHERE lead_id = $1 AND direction = 'inbound'`, [leadId]),
  ]);

  const signals = [];
  const add = (points, label, detail, at = null) => { if (points) signals.push({ points: Math.round(points), label, detail, at }); };

  // Website
  const web = sessions.rows.filter((s) => s.channel === 'web');
  const webViews = views.rows.filter((v) => v.channel === 'web');
  const webSeconds = web.reduce((a, s) => a + (s.total_seconds || 0), 0);
  const pages = {};
  for (const v of webViews) {
    const k = v.object_key;
    pages[k] = pages[k] || { path: k, title: v.title, url: v.url, seconds: 0, views: 0, last_at: v.last_at };
    pages[k].seconds += v.seconds; pages[k].views += 1;
    if (v.last_at > pages[k].last_at) pages[k].last_at = v.last_at;
  }
  const topPages = Object.values(pages).sort((a, b) => b.seconds - a.seconds);
  if (web.length) add(Math.min(15, webSeconds / 30), 'Time on your website', `${fmtSecs(webSeconds)} across ${web.length} visit${web.length === 1 ? '' : 's'}`, web[0].last_seen_at);
  if (web.length > 1) add(Math.min(9, (web.length - 1) * 3), 'Came back', `${web.length} separate visits`, web[0].started_at);
  const intentPages = topPages.filter((p) => HIGH_INTENT.test(`${p.path} ${p.title || ''}`));
  if (intentPages.length) add(Math.min(12, intentPages.length * 6), 'Looked at buying pages', intentPages.slice(0, 3).map((p) => `${p.title || p.path} (${fmtSecs(p.seconds)})`).join(' · '), intentPages[0].last_at);

  // Documents, page by page
  const docViews = views.rows.filter((v) => v.channel === 'document');
  const documents = docs.rows.map((d) => {
    const pv = docViews.filter((v) => v.content_tracking_id === d.id);
    const byPage = {};
    for (const v of pv) {
      const n = v.page_number || 1;
      byPage[n] = (byPage[n] || 0) + v.seconds;
    }
    const seconds = Object.values(byPage).reduce((a, b) => a + b, 0);
    const pageCount = d.page_count || Math.max(0, ...Object.keys(byPage).map(Number));
    const pagesRead = Object.values(byPage).filter((s) => s >= 4).length;
    const pagesList = Array.from({ length: pageCount || 0 }, (_, i) => ({ page: i + 1, seconds: byPage[i + 1] || 0 }));
    return {
      tracking_id: d.id, file_id: d.file_id, name: d.name || 'Document', opens: d.open_count || 0, seconds,
      page_count: pageCount || null, pages_read: pagesRead,
      completion: pageCount ? Math.round((pagesRead / pageCount) * 100) : null,
      pages: pagesList, first_opened_at: d.first_opened_at, last_opened_at: d.last_opened_at,
      top_page: pagesList.slice().sort((a, b) => b.seconds - a.seconds)[0] || null,
    };
  });
  for (const doc of documents) {
    if (!doc.opens) continue;
    add(5, `Opened “${doc.name}”`, doc.opens > 1 ? `${doc.opens} times` : 'once', doc.last_opened_at);
    if (doc.seconds) add(Math.min(10, doc.seconds / 20), `Read “${doc.name}”`, `${fmtSecs(doc.seconds)}${doc.completion !== null ? ` · ${doc.pages_read}/${doc.page_count} pages (${doc.completion}%)` : ''}`, doc.last_opened_at);
    if (doc.completion) add(Math.min(15, doc.completion * 0.15), 'Read most of it', `${doc.completion}% of “${doc.name}”`, doc.last_opened_at);
    if (doc.opens > 1) add(Math.min(9, (doc.opens - 1) * 3), 'Re-opened', `came back to “${doc.name}” ${doc.opens - 1} more time${doc.opens > 2 ? 's' : ''}`, doc.last_opened_at);
    if (doc.top_page && doc.top_page.seconds >= 45) add(4, `Lingered on page ${doc.top_page.page}`, `${fmtSecs(doc.top_page.seconds)} on page ${doc.top_page.page} of “${doc.name}”`, doc.last_opened_at);
  }

  // Email + WhatsApp
  const e = emailStats.rows[0] || {};
  const opens = Number(e.opens || 0); const clicks = Number(e.clicks || 0); const replies = Number(e.replies || 0);
  if (opens) add(Math.min(6, opens * 2), 'Opened your emails', `${opens} open${opens === 1 ? '' : 's'}`, e.last_at);
  if (clicks) add(Math.min(10, clicks * 5), 'Clicked links in emails', `${clicks} click${clicks === 1 ? '' : 's'}`, e.last_at);
  if (replies) add(12, 'Replied by email', `${replies} repl${replies === 1 ? 'y' : 'ies'}`, e.last_at);
  const wa = waStats.rows[0] || {};
  const waIn = Number(wa.inbound || 0);
  if (waIn) add(Math.min(18, waIn * 6), 'Messaging you on WhatsApp', `${waIn} message${waIn === 1 ? '' : 's'} from them`, wa.last_at);

  // Stage
  const stage = String(lead.stage || '').toLowerCase();
  if (stage === 'interested') add(5, 'Marked interested', 'pipeline stage');
  if (stage === 'negotiating') add(10, 'In negotiation', 'pipeline stage');

  // Recency
  const lastEngaged = [web[0]?.last_seen_at, ...documents.map((d) => d.last_opened_at), e.last_at, wa.last_at]
    .filter(Boolean).map((d) => new Date(d).getTime()).sort((a, b) => b - a)[0] || null;
  const hoursSince = lastEngaged ? (Date.now() - lastEngaged) / 3600000 : null;
  if (hoursSince !== null) {
    if (hoursSince < 1) add(20, 'Active right now', 'engaged within the last hour', new Date(lastEngaged));
    else if (hoursSince < 24) add(14, 'Active today', `last engaged ${Math.round(hoursSince)}h ago`, new Date(lastEngaged));
    else if (hoursSince < 72) add(8, 'Active this week', `last engaged ${Math.round(hoursSince / 24)}d ago`, new Date(lastEngaged));
    else if (hoursSince < 168) add(4, 'Engaged recently', `last engaged ${Math.round(hoursSince / 24)}d ago`, new Date(lastEngaged));
  }

  let raw = signals.reduce((a, s) => a + s.points, 0);
  let decay = 1;
  if (hoursSince !== null && hoursSince > 24 * 30) decay = 0.35;
  else if (hoursSince !== null && hoursSince > 24 * 14) decay = 0.6;
  if (decay < 1) signals.push({ points: -Math.round(raw * (1 - decay)), label: 'Gone quiet', detail: `no engagement for ${Math.round(hoursSince / 24)} days`, at: null });
  const score = Math.max(0, Math.min(100, Math.round(raw * decay)));
  const temperature = score >= 70 ? 'hot' : score >= 45 ? 'warm' : score >= 20 ? 'lukewarm' : 'cold';

  return {
    lead_id: leadId,
    score,
    temperature,
    last_engaged_at: lastEngaged ? new Date(lastEngaged).toISOString() : null,
    signals: signals.sort((a, b) => b.points - a.points),
    website: {
      visits: web.length, seconds: webSeconds, pages: topPages.slice(0, 15),
      last_visit_at: web[0]?.last_seen_at || null, live: web[0] ? (Date.now() - new Date(web[0].last_seen_at).getTime()) < 120000 : false,
    },
    documents,
    email: { opens, clicks, replies },
    whatsapp: { inbound: waIn, last_at: wa.last_at || null },
    sessions: sessions.rows.slice(0, 20).map((s) => ({ id: s.id, channel: s.channel, seconds: s.total_seconds, started_at: s.started_at, last_seen_at: s.last_seen_at, device: s.device, referrer: s.referrer })),
  };
}

/** Recompute and store the score on the lead (leads.score is what lists, segments and flows read). */
async function refreshLeadInterest(leadId, workspaceId = null) {
  const ws = workspaceId || (await db.query('SELECT workspace_id FROM leads WHERE id = $1', [leadId])).rows[0]?.workspace_id;
  if (!ws) return null;
  const interest = await computeInterest(ws, leadId);
  if (!interest) return null;
  await db.query(
    `UPDATE leads SET score = $1,
       metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object('interest', jsonb_build_object('temperature', $2::text, 'last_engaged_at', $3::text, 'updated_at', NOW()::text))
     WHERE id = $4`,
    [interest.score, interest.temperature, interest.last_engaged_at, leadId]
  );
  return interest;
}

// ── AI brief ──

function rulesBrief(lead, interest) {
  const name = lead.first_name || 'They';
  const top = interest.signals.filter((s) => s.points > 0).slice(0, 3);
  const doc = interest.documents.find((d) => d.seconds > 0);
  const page = interest.website.pages.find((p) => HIGH_INTENT.test(`${p.path} ${p.title || ''}`));
  const focus = page ? (page.title || page.path) : doc?.top_page ? `page ${doc.top_page.page} of “${doc.name}”` : null;
  let action;
  if (interest.temperature === 'hot') action = `Call ${name} now — engagement is at its peak.`;
  else if (interest.temperature === 'warm') action = `Send a short WhatsApp${focus ? ` about ${focus}` : ''} and offer a call.`;
  else if (interest.temperature === 'lukewarm') action = 'Share something useful (brochure or price list) and watch whether they open it.';
  else action = 'Low engagement so far — a brief check-in or a re-engagement flow.';
  return {
    source: 'rules',
    summary: top.length ? top.map((s) => `${s.label} — ${s.detail}`).join('. ') + '.' : 'No engagement recorded yet.',
    cares_about: focus ? `Most attention on ${focus}.` : 'Not enough behaviour yet to tell.',
    next_action: action,
    message: `Hi ${lead.first_name || ''}, ${focus ? `I saw you were looking at ${focus} — ` : ''}happy to answer any questions. Is now a good time for a quick call?`.replace(/\s+/g, ' ').trim(),
  };
}

async function generateBrief(workspaceId, leadId, { force = false } = {}) {
  const lead = (await db.query('SELECT * FROM leads WHERE id = $1 AND workspace_id = $2', [leadId, workspaceId])).rows[0];
  if (!lead) return null;
  const interest = await computeInterest(workspaceId, leadId);
  const cached = lead.metadata?.ai_brief;
  if (!force && cached && cached.score === interest.score && Date.now() - new Date(cached.generated_at).getTime() < 6 * 3600000) {
    return { ...cached, interest };
  }

  let brief = rulesBrief(lead, interest);
  if (process.env.OPENAI_API_KEY && interest.signals.length) {
    try {
      const facts = {
        lead: { first_name: lead.first_name, city: lead.city, budget: lead.budget, source: lead.lead_source, stage: lead.stage, notes: (lead.notes || '').slice(0, 500) },
        interest_score: interest.score, temperature: interest.temperature,
        signals: interest.signals.slice(0, 12).map((s) => `${s.label}: ${s.detail}`),
        website_pages: interest.website.pages.slice(0, 8).map((p) => ({ page: p.title || p.path, seconds: p.seconds })),
        documents: interest.documents.map((d) => ({ name: d.name, seconds: d.seconds, completion: d.completion, most_read_page: d.top_page })),
      };
      const resp = await axios.post('https://api.openai.com/v1/chat/completions', {
        model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
        temperature: 0.4,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: 'You are a sales coach inside a CRM. From the behavioural facts given, return JSON with keys: summary (2 sentences, plain language, cite the evidence), cares_about (1 sentence), next_action (1 imperative sentence for the salesperson), message (a short, friendly WhatsApp message to the lead, under 320 characters, no emojis overload, do not mention tracking). Use only the facts given — never invent numbers.' },
          { role: 'user', content: JSON.stringify(facts) },
        ],
      }, { headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` }, timeout: 20000 });
      const parsed = JSON.parse(resp.data.choices?.[0]?.message?.content || '{}');
      if (parsed.summary && parsed.next_action) brief = { source: 'ai', summary: parsed.summary, cares_about: parsed.cares_about || brief.cares_about, next_action: parsed.next_action, message: parsed.message || brief.message };
    } catch (err) {
      logger.error('AI interest brief failed, using rules:', err.response?.data?.error?.message || err.message);
    }
  }
  const stored = { ...brief, score: interest.score, generated_at: new Date().toISOString() };
  await db.query(`UPDATE leads SET metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object('ai_brief', $1::jsonb) WHERE id = $2`, [JSON.stringify(stored), leadId]);
  return { ...stored, interest };
}

module.exports = {
  leadLinkToken, leadIdFromToken, linkVisitorToLead, findLeadByContact, recordView, alertOnceForSession,
  computeInterest, refreshLeadInterest, generateBrief, fmtSecs,
};
