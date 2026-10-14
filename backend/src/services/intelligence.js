const db = require('../config/database');
const ai = require('./ai');

/* ═══════════════════════════════════════════════════════════════
   FLAZYN INTELLIGENCE — per-lead signals
   Everything here works from the workspace's own data (messages, calls,
   emails, tracking, won/lost history). AI (when a key is set) only
   improves wording; every signal has a deterministic version.
   ═══════════════════════════════════════════════════════════════ */

const DAY = 86400000;
const HOUR = 3600000;
const OPEN_STAGES = ['new', 'contacted', 'interested', 'negotiating', 'qualified', 'proposal'];
const ADVANCED_STAGES = ['interested', 'negotiating', 'qualified', 'proposal'];

// ── Context ─────────────────────────────────────────────────────────────────

async function loadContext(workspaceId, leadId) {
  const lead = (await db.query(
    `SELECT l.*, u.first_name AS agent_first_name, u.last_name AS agent_last_name
     FROM leads l LEFT JOIN users u ON u.id = l.assigned_to WHERE l.id = $1 AND l.workspace_id = $2`,
    [leadId, workspaceId]
  )).rows[0];
  if (!lead) return null;
  const [wa, sms, calls, emails, acts, fus, sessions, ws] = await Promise.all([
    db.query(`SELECT direction, message_text AS text, COALESCE(sent_at, created_at) AS at FROM whatsapp_messages WHERE lead_id = $1 ORDER BY COALESCE(sent_at, created_at)`, [leadId]),
    db.query(`SELECT direction, message_text AS text, COALESCE(sent_at, created_at) AS at FROM sms_messages WHERE lead_id = $1 ORDER BY COALESCE(sent_at, created_at)`, [leadId]),
    db.query('SELECT * FROM calls WHERE lead_id = $1 ORDER BY created_at', [leadId]),
    db.query('SELECT subject, sent_at, opened_at, clicked_at, replied_at, status FROM emails WHERE lead_id = $1 ORDER BY sent_at', [leadId]),
    db.query('SELECT type, description, metadata, created_at FROM lead_activities WHERE lead_id = $1 ORDER BY created_at', [leadId]),
    db.query('SELECT * FROM follow_ups WHERE lead_id = $1 ORDER BY due_date', [leadId]),
    db.query('SELECT channel, total_seconds, started_at, last_seen_at FROM engagement_sessions WHERE lead_id = $1 ORDER BY last_seen_at DESC LIMIT 50', [leadId]),
    db.query('SELECT name, settings FROM workspaces WHERE id = $1', [workspaceId]),
  ]);
  const messages = [
    ...wa.rows.map((m) => ({ ...m, channel: 'whatsapp' })),
    ...sms.rows.map((m) => ({ ...m, channel: 'sms' })),
  ].filter((m) => m.text && m.at).map((m) => ({ ...m, at: new Date(m.at) })).sort((a, b) => a.at - b.at);
  const settings = parseJson(ws.rows[0]?.settings, {});
  return {
    workspaceId, lead, messages, calls: calls.rows, emails: emails.rows, activities: acts.rows,
    followUps: fus.rows, sessions: sessions.rows, settings, workspaceName: ws.rows[0]?.name || '',
    timezone: settings.whatsapp_auto_responder?.timezone || process.env.DEFAULT_TIMEZONE || 'Australia/Sydney',
  };
}

function parseJson(v, d) {
  if (v && typeof v === 'object') return v;
  try { return v ? JSON.parse(v) : d; } catch { return d; }
}
const inbound = (ctx) => ctx.messages.filter((m) => m.direction === 'inbound');
const median = (arr) => {
  if (!arr.length) return null;
  const s = [...arr].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
const leadName = (l) => [l.first_name, l.last_name].filter(Boolean).join(' ') || 'This lead';

// ── Text analysis ───────────────────────────────────────────────────────────

const POSITIVE = ['thank', 'thanks', 'great', 'perfect', 'love', 'interested', 'sounds good', 'awesome', 'excellent', 'yes', 'keen', 'happy', 'amazing', 'nice', 'wonderful', 'definitely', 'sure', 'appreciate', 'excited', '👍', '😊', '🙂', '😍', '🙏', '❤'];
const NEGATIVE = ['not interested', 'too expensive', 'expensive', 'too much', 'no thanks', 'stop', 'unsubscribe', 'busy', 'disappointed', 'unhappy', 'annoyed', 'angry', 'scam', 'waste', 'never', 'bad', 'worse', 'terrible', 'leave me', "don't contact", 'dont contact', 'remove me', 'not now', 'not sure', '👎', '😡', '😠'];

function sentimentOf(text) {
  const t = String(text || '').toLowerCase();
  let score = 0;
  for (const w of POSITIVE) if (t.includes(w)) score += 1;
  for (const w of NEGATIVE) if (t.includes(w)) score -= 1.3;
  if (/\?\s*$/.test(t)) score += 0.2; // asking = engaged
  return Math.max(-3, Math.min(3, score));
}

function conversationSentiment(ctx) {
  const msgs = inbound(ctx).slice(-6);
  if (!msgs.length) return { label: 'unknown', score: 0, trend: 'flat', based_on: 0 };
  let wsum = 0;
  let sum = 0;
  msgs.forEach((m, i) => { const w = i + 1; wsum += w; sum += sentimentOf(m.text) * w; });
  const score = Math.round((sum / wsum) * 100) / 100;
  const first = sentimentOf(msgs[0].text);
  const last = sentimentOf(msgs[msgs.length - 1].text);
  return {
    label: score > 0.35 ? 'positive' : score < -0.35 ? 'negative' : 'neutral',
    score,
    trend: last - first > 0.8 ? 'improving' : first - last > 0.8 ? 'cooling' : 'flat',
    based_on: msgs.length,
    last_message: msgs[msgs.length - 1].text.slice(0, 160),
  };
}

const OBJECTIONS = {
  price: ['expensive', 'price', 'cost', 'budget', 'cheaper', 'discount', 'afford', 'too much', 'deal', 'best rate', 'fee'],
  timing: ['not now', 'later', 'next month', 'next year', 'busy', 'timing', 'not ready', 'in a few', 'after the holidays', 'maybe later'],
  authority: ['my partner', 'my wife', 'my husband', 'my boss', 'my manager', 'the board', 'check with', 'ask my', 'discuss with', 'decide together', 'run it by', 'family decision'],
  trust: ['reviews', 'legit', 'scam', 'guarantee', 'trust', 'proof', 'references', 'is this real', 'testimonials'],
  competitor: ['another agent', 'another company', 'other company', 'cheaper elsewhere', 'other quote', 'quoted me', 'competitor', 'someone else', 'going with', 'other provider', 'other agency'],
  need: ['not sure', "don't need", 'dont need', 'think about it', 'just looking', 'not interested', 'just browsing'],
};
const PRICE_ANSWER = (ctx) => `Great question${ctx.lead.first_name ? `, ${ctx.lead.first_name}` : ''}! I'll send you the full price breakdown and what's included right now. Would a quick 5-minute call today suit, so I can match it to what you need?`;
const OBJECTION_LABEL = { price: 'Price', timing: 'Timing', authority: 'Needs someone else to decide', trust: 'Trust', competitor: 'Considering a competitor', need: 'Unsure they need it' };

function detectObjections(text) {
  const t = String(text || '').toLowerCase();
  return Object.entries(OBJECTIONS).filter(([, words]) => words.some((w) => t.includes(w))).map(([k]) => k);
}

function competitorMentions(ctx) {
  const names = (Array.isArray(ctx.settings.competitors) ? ctx.settings.competitors : String(ctx.settings.competitors || '').split(','))
    .map((n) => String(n).trim()).filter(Boolean);
  const hits = [];
  for (const m of inbound(ctx)) {
    const t = m.text.toLowerCase();
    const named = names.find((n) => t.includes(n.toLowerCase()));
    const generic = OBJECTIONS.competitor.find((w) => t.includes(w));
    if (named || generic) hits.push({ competitor: named || 'another provider', message: m.text.slice(0, 200), at: m.at });
  }
  return hits;
}

const COUNTERS = {
  price: 'Totally fair to compare. Can I show you what is included so you can compare like for like? Most clients find the total cost works out lower once everything is counted.',
  timing: 'No rush at all. Would it help if I sent a short summary now and checked back on a date that suits you?',
  authority: 'Makes sense to decide together. Would a quick 10-minute call with both of you help, so all the questions get answered at once?',
  trust: 'Great question. I can share recent reviews and put you in touch with a client who was in the same situation. Would that help?',
  competitor: 'Good that you are comparing. Could you share what they offered? I will show you exactly where we differ, so you can pick what is best for you.',
  need: 'Happy to help you work that out. What would need to be true for this to be worth it for you?',
};

function personality(ctx) {
  const msgs = inbound(ctx);
  if (msgs.length < 2) return { type: 'unknown', label: 'Not enough messages yet', tip: 'Send a friendly opener and a simple question to learn how they like to talk.', confidence: 0 };
  const texts = msgs.map((m) => m.text);
  const avgLen = texts.reduce((a, t) => a + t.length, 0) / texts.length;
  const rate = (re) => texts.filter((t) => re.test(t)).length / texts.length;
  const numbers = rate(/\d|\$|price|cost|size|sqm|spec|compare|detail|how much|exact/i);
  const feeling = rate(/[!😊😍❤🙏🥰]|love|excited|dream|family|feel|happy|amazing|wow/i);
  const decisive = rate(/^(ok|yes|sure|done|book|let'?s|when can|today|now|sounds good)\b/i);
  const latencies = replyLatencies(ctx);
  const fast = latencies.length ? median(latencies) < 20 * 60000 : false;
  const scores = {
    analytical: numbers * 2 + (avgLen > 90 ? 0.6 : 0),
    emotional: feeling * 2 + (avgLen > 40 && avgLen < 140 ? 0.2 : 0),
    fast_decider: decisive * 2 + (avgLen < 35 ? 0.6 : 0) + (fast ? 0.6 : 0),
  };
  const [type, val] = Object.entries(scores).sort((a, b) => b[1] - a[1])[0];
  const meta = {
    analytical: { label: 'Analytical', tip: 'Lead with facts: numbers, comparisons and a clear breakdown. Send the detail in writing and give them time to read it.' },
    emotional: { label: 'Emotional / relationship-driven', tip: 'Be warm and personal. Talk about how it will feel and share stories from similar clients before the numbers.' },
    fast_decider: { label: 'Fast decider', tip: 'Keep it short. Give one clear recommendation and a direct next step, e.g. "Shall I book Thursday 2pm?"' },
  }[type];
  return { type, ...meta, confidence: Math.min(1, Math.round(val * 50) / 100 + Math.min(msgs.length, 8) * 0.05) };
}

// ── Timing ─────────────────────────────────────────────────────────────────

/** ms from each of our outbound messages to their next inbound reply. */
function replyLatencies(ctx) {
  const out = [];
  let waitingSince = null;
  for (const m of ctx.messages) {
    if (m.direction !== 'inbound') { if (!waitingSince) waitingSince = m.at; continue; }
    if (waitingSince) { out.push(m.at - waitingSince); waitingSince = null; }
  }
  return out;
}

function localParts(date, tz) {
  try {
    const p = new Intl.DateTimeFormat('en-US', { timeZone: tz, weekday: 'short', hour: 'numeric', hourCycle: 'h23' }).formatToParts(date);
    return { day: p.find((x) => x.type === 'weekday').value, hour: Number(p.find((x) => x.type === 'hour').value) };
  } catch { return { day: date.toUTCString().slice(0, 3), hour: date.getUTCHours() }; }
}

async function bestTime(ctx) {
  let stamps = inbound(ctx).map((m) => m.at);
  let basis = 'this lead';
  if (stamps.length < 3) {
    const r = await db.query(
      `SELECT COALESCE(sent_at, created_at) AS at FROM whatsapp_messages
       WHERE workspace_id = $1 AND direction = 'inbound' AND created_at > NOW() - INTERVAL '90 days' LIMIT 2000`, [ctx.workspaceId]);
    if (r.rows.length >= 10) { stamps = r.rows.map((x) => new Date(x.at)); basis = 'all your leads'; }
  }
  if (stamps.length < 3) return { hour: 10, days: ['Tue', 'Wed', 'Thu'], label: 'Weekdays around 10am', basis: 'general best practice', confidence: 0.2, next_at: null };
  const hours = new Array(24).fill(0);
  const days = {};
  for (const d of stamps) { const p = localParts(d, ctx.timezone); hours[p.hour] += 1; days[p.day] = (days[p.day] || 0) + 1; }
  // smooth: an hour's score includes its neighbours
  const smooth = hours.map((v, h) => v * 2 + (hours[(h + 23) % 24] || 0) + (hours[(h + 1) % 24] || 0));
  const hour = smooth.indexOf(Math.max(...smooth));
  const topDays = Object.entries(days).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([d]) => d);
  const fmt = (h) => `${((h + 11) % 12) + 1}${h < 12 ? 'am' : 'pm'}`;
  // next occurrence of that hour on a preferred day
  let next = null;
  for (let i = 0; i < 8 * 24 && !next; i += 1) {
    const t = new Date(Date.now() + i * HOUR);
    const p = localParts(t, ctx.timezone);
    if (p.hour === hour && (topDays.includes(p.day) || stamps.length < 6) && t > new Date(Date.now() + 10 * 60000)) next = t;
  }
  return {
    hour, days: topDays, label: `${topDays.join(', ')} around ${fmt(hour)}`, basis,
    confidence: Math.min(0.95, 0.3 + stamps.length * 0.05), next_at: next ? next.toISOString() : null,
  };
}

function ghostRisk(ctx) {
  const ins = inbound(ctx);
  const lat = replyLatencies(ctx);
  const reasons = [];
  if (ins.length < 2) return { level: 'unknown', reasons: ['Not enough back-and-forth yet'], hours_to_cold: null };
  const half = Math.floor(lat.length / 2);
  const early = median(lat.slice(0, half || 1));
  const late = median(lat.slice(half || 1));
  if (early && late && late > early * 1.8 && late > 30 * 60000) reasons.push(`Replies are slowing down (${Math.round(early / 60000)}m → ${Math.round(late / 60000)}m)`);
  const lens = ins.map((m) => m.text.length);
  const lh = Math.floor(lens.length / 2);
  const lenEarly = median(lens.slice(0, lh || 1));
  const lenLate = median(lens.slice(lh || 1));
  if (lenEarly && lenLate && lenLate < lenEarly * 0.55) reasons.push('Their messages are getting shorter');
  const last = ctx.messages[ctx.messages.length - 1];
  const typical = median(lat) || 6 * HOUR;
  let hoursToCold = null;
  if (last && last.direction !== 'inbound') {
    const waited = Date.now() - last.at;
    const coldAt = Math.max(typical * 4, 36 * HOUR);
    if (waited > typical * 1.5) reasons.push(`No reply for ${Math.round(waited / HOUR)}h (they usually reply in ${Math.max(1, Math.round(typical / 60000))}m)`);
    hoursToCold = Math.max(0, Math.round((coldAt - waited) / HOUR));
  }
  const level = reasons.length >= 2 ? 'high' : reasons.length === 1 ? 'medium' : 'low';
  return { level, reasons, hours_to_cold: level === 'low' ? null : hoursToCold };
}

// ── Deal risk ──────────────────────────────────────────────────────────────

function dealRisk(ctx, sentiment, ghost) {
  const l = ctx.lead;
  const stage = String(l.stage || 'new').toLowerCase();
  if (!OPEN_STAGES.includes(stage)) return { score: 0, level: 'none', reasons: [] };
  const reasons = [];
  let score = 0;
  const ins = inbound(ctx);
  const ageH = (Date.now() - new Date(l.created_at)) / HOUR;
  if (ADVANCED_STAGES.includes(stage) && ageH < 48 && ins.length < 2 && ctx.calls.length < 1) { score += 30; reasons.push('Moved forward very fast with almost no conversation'); }
  const lastIn = ins[ins.length - 1];
  if (ADVANCED_STAGES.includes(stage) && (!lastIn || Date.now() - lastIn.at > 7 * DAY)) { score += 25; reasons.push(lastIn ? `No reply from them in ${Math.round((Date.now() - lastIn.at) / DAY)} days` : 'They have never replied in writing'); }
  if (ins.some((m) => detectObjections(m.text).includes('authority'))) { score += 20; reasons.push('The decision-maker has not been in the conversation'); }
  if (ctx.followUps.some((f) => f.status === 'pending' && new Date(f.due_date) < Date.now() - DAY)) { score += 10; reasons.push('A follow-up is more than a day overdue'); }
  if (sentiment.label === 'negative') { score += 15; reasons.push('Recent messages sound negative'); }
  if (ghost.level === 'high') { score += 15; reasons.push('Showing signs of going quiet'); }
  if (competitorMentions(ctx).length) { score += 10; reasons.push('Mentioned a competitor'); }
  const channels = new Set([...ctx.messages.map((m) => m.channel), ...(ctx.calls.length ? ['call'] : []), ...(ctx.emails.length ? ['email'] : [])]);
  if (ADVANCED_STAGES.includes(stage) && channels.size <= 1) { score += 5; reasons.push('Only one way of contact so far'); }
  score = Math.min(100, score);
  return { score, level: score >= 50 ? 'high' : score >= 25 ? 'medium' : 'low', reasons };
}

// ── Deal size (+ feedback loop) ────────────────────────────────────────────

function moneyHints(text) {
  const out = [];
  const re = /(\$|aud|usd|budget|around|about|up to|max|maximum)?\s*\$?\s*(\d{1,3}(?:[,\s]\d{3})+|\d+(?:\.\d+)?)\s*(k|m|mil|million|thousand)?\b/gi;
  let m;
  while ((m = re.exec(String(text || '')))) {
    const hasCue = m[1] || m[3];
    if (!hasCue) continue;
    let n = parseFloat(m[2].replace(/[,\s]/g, ''));
    const unit = (m[3] || '').toLowerCase();
    if (unit === 'k' || unit === 'thousand') n *= 1000;
    if (unit === 'm' || unit === 'mil' || unit === 'million') n *= 1000000;
    if (n >= 100) out.push(n);
  }
  return out;
}

async function calibration(workspaceId, source) {
  const r = await db.query(
    `SELECT lead_source, actual / NULLIF(predicted, 0) AS ratio FROM deal_predictions
     WHERE workspace_id = $1 AND actual IS NOT NULL AND predicted > 0 ORDER BY closed_at DESC LIMIT 200`, [workspaceId]);
  const all = r.rows.map((x) => Number(x.ratio)).filter((x) => x > 0 && x < 10);
  const same = r.rows.filter((x) => x.lead_source === source).map((x) => Number(x.ratio)).filter((x) => x > 0 && x < 10);
  const pick = same.length >= 3 ? same : all;
  if (pick.length < 3) return { factor: 1, samples: pick.length };
  return { factor: Math.round(median(pick) * 100) / 100, samples: pick.length, by_source: same.length >= 3 };
}

async function dealSize(ctx) {
  const l = ctx.lead;
  const basis = [];
  const candidates = [];
  if (Number(l.budget) > 0) { candidates.push(Number(l.budget)); basis.push(`Budget on file: ${Number(l.budget).toLocaleString()}`); }
  const hinted = inbound(ctx).flatMap((m) => moneyHints(m.text));
  if (hinted.length) { candidates.push(median(hinted)); basis.push(`They mentioned ${hinted.map((n) => n.toLocaleString()).slice(0, 3).join(', ')}`); }
  const won = await db.query(
    `SELECT COALESCE(deal_value, budget) AS v, lead_source FROM leads
     WHERE workspace_id = $1 AND stage = 'won' AND COALESCE(deal_value, budget) > 0 ORDER BY updated_at DESC LIMIT 300`, [ctx.workspaceId]);
  const sameSrc = won.rows.filter((x) => x.lead_source === l.lead_source).map((x) => Number(x.v));
  const allWon = won.rows.map((x) => Number(x.v));
  const typical = median(sameSrc.length >= 3 ? sameSrc : allWon);
  if (typical) basis.push(`Typical won deal${sameSrc.length >= 3 ? ` from ${l.lead_source}` : ''}: ${Math.round(typical).toLocaleString()}`);
  let raw = candidates.length ? median(candidates) : typical;
  if (!raw) return { predicted: null, basis: ['Not enough information yet. Add a budget or win a few deals.'], confidence: 0 };
  if (candidates.length && typical) raw = raw * 0.75 + typical * 0.25;
  const engagement = Math.max(0.85, Math.min(1.15, 0.85 + (Number(l.score) || 0) / 330));
  const cal = await calibration(ctx.workspaceId, l.lead_source);
  if (cal.samples >= 3 && cal.factor !== 1) basis.push(`Adjusted ×${cal.factor} from ${cal.samples} past predictions vs actual results`);
  const predicted = Math.round(raw * engagement * cal.factor);
  const spread = candidates.length ? 0.15 : 0.35;
  return {
    predicted, low: Math.round(predicted * (1 - spread)), high: Math.round(predicted * (1 + spread)),
    basis, confidence: Math.min(0.9, (candidates.length ? 0.45 : 0.2) + Math.min(cal.samples, 10) * 0.03),
  };
}

// ── Next best action ───────────────────────────────────────────────────────

const TOUCH_TYPES = { call: ['call_logged', 'call_made', 'call'], whatsapp: ['whatsapp_sent'], email: ['email_sent'], sms: ['sms_sent'] };

/** Which first-touch channel most often moved similar leads past "contacted". */
async function channelHistory(workspaceId, source) {
  const r = await db.query(
    `WITH first_touch AS (
       SELECT DISTINCT ON (a.lead_id) a.lead_id, a.type
       FROM lead_activities a JOIN leads l ON l.id = a.lead_id
       WHERE l.workspace_id = $1 AND a.type = ANY($2) AND a.created_at < l.created_at + INTERVAL '3 days'
         AND ($3::text IS NULL OR l.lead_source = $3)
       ORDER BY a.lead_id, a.created_at)
     SELECT f.type, COUNT(*)::int AS n,
            COUNT(*) FILTER (WHERE l.stage IN ('interested','negotiating','qualified','proposal','won'))::int AS progressed
     FROM first_touch f JOIN leads l ON l.id = f.lead_id GROUP BY f.type`,
    [workspaceId, Object.values(TOUCH_TYPES).flat(), source || null]
  );
  const stats = {};
  for (const [ch, types] of Object.entries(TOUCH_TYPES)) {
    const rows = r.rows.filter((x) => types.includes(x.type));
    const n = rows.reduce((a, x) => a + x.n, 0);
    const p = rows.reduce((a, x) => a + x.progressed, 0);
    stats[ch] = { n, progressed: p, rate: (p + 1) / (n + 3) }; // smoothed
  }
  return stats;
}

async function nextBestAction(ctx, { ghost, sentiment, best }) {
  const l = ctx.lead;
  const stage = String(l.stage || 'new').toLowerCase();
  const why = [];
  const live = ctx.sessions.find((s) => Date.now() - new Date(s.last_seen_at) < 5 * 60000);
  if (live) return { action: 'Call now', channel: 'call', why: [`They are ${live.channel === 'document' ? 'reading your document' : 'on your website'} right now`], confidence: 0.9, when: 'now' };
  if (stage === 'won' || stage === 'lost') {
    return stage === 'won'
      ? { action: 'Ask for a referral or review', channel: 'whatsapp', why: ['Deal is won; happy clients refer friends'], confidence: 0.5, when: 'this week' }
      : { action: 'Leave for now', channel: null, why: ['Lead is lost. Flazyn will flag them if they show interest again'], confidence: 0.5, when: null };
  }
  let stats = await channelHistory(ctx.workspaceId, l.lead_source);
  if (Object.values(stats).every((s) => s.n < 5)) stats = await channelHistory(ctx.workspaceId, null);
  const available = (ch) => (ch === 'email' ? !!l.email : !!l.phone);
  const ranked = Object.entries(stats).filter(([ch]) => available(ch)).sort((a, b) => b[1].rate - a[1].rate);
  const lastIn = inbound(ctx).slice(-1)[0];
  const clicked = ctx.emails.find((e) => e.clicked_at && Date.now() - new Date(e.clicked_at) < 2 * DAY);

  let channel;
  if (clicked && l.phone) { channel = 'call'; why.push(`Clicked your email ${Math.round((Date.now() - new Date(clicked.clicked_at)) / HOUR)}h ago`); }
  else if (lastIn && Date.now() - lastIn.at < 3 * DAY) { channel = lastIn.channel; why.push(`They last replied on ${lastIn.channel === 'sms' ? 'SMS' : 'WhatsApp'}`); }
  else if (ghost.level === 'high' && l.phone) { channel = 'call'; why.push('Messages are going unanswered, so a call cuts through'); }
  else if (ranked.length) {
    channel = ranked[0][0];
    const s = ranked[0][1];
    why.push(s.n >= 5 ? `${Math.round((s.progressed / s.n) * 100)}% of similar leads moved forward after a first ${channel === 'call' ? 'call' : channel === 'whatsapp' ? 'WhatsApp' : channel}` : 'Calling first works best for most new leads');
  } else channel = l.phone ? 'call' : 'email';

  if (stage === 'new') why.unshift('Not contacted yet. Speed matters most now');
  if (sentiment.label === 'negative') why.push('Tone is negative, so acknowledge their concern first');
  const label = { call: 'Call', whatsapp: 'Send a WhatsApp', email: 'Send an email', sms: 'Send an SMS' }[channel] || 'Reach out';
  const when = stage === 'new' ? 'now' : best?.label ? best.label : 'today';
  const conf = ranked.length && stats[channel]?.n >= 5 ? Math.min(0.9, 0.4 + stats[channel].n * 0.02) : 0.45;
  return { action: label, channel, why, confidence: Math.round(conf * 100) / 100, when, history: stats };
}

// ── Reactivation radar ─────────────────────────────────────────────────────

async function reactivationSignal(ctx) {
  if (String(ctx.lead.stage).toLowerCase() !== 'lost') return null;
  const lostAct = [...ctx.activities].reverse().find((a) => a.type === 'stage_change' && String(parseJson(a.metadata, {}).new_stage || '').toLowerCase() === 'lost');
  const since = lostAct ? new Date(lostAct.created_at) : new Date(ctx.lead.updated_at);
  const signals = [];
  for (const m of inbound(ctx)) if (m.at > since) signals.push(`Messaged you: "${m.text.slice(0, 80)}"`);
  for (const e of ctx.emails) {
    if (e.opened_at && new Date(e.opened_at) > since) signals.push(`Opened "${e.subject}"`);
    if (e.clicked_at && new Date(e.clicked_at) > since) signals.push(`Clicked a link in "${e.subject}"`);
  }
  for (const s of ctx.sessions) if (new Date(s.last_seen_at) > since) signals.push(s.channel === 'document' ? 'Re-read your document' : 'Visited your website');
  for (const a of ctx.activities) if (new Date(a.created_at) > since && /duplicate|form_resubmitted|lead_resubmitted/.test(a.type)) signals.push('Filled in a form again');
  if (!signals.length) return null;
  return { since: since.toISOString(), signals: [...new Set(signals)].slice(0, 5) };
}

// ── Full lead picture ──────────────────────────────────────────────────────

async function leadInsights(workspaceId, leadId) {
  const ctx = await loadContext(workspaceId, leadId);
  if (!ctx) return null;
  const sentiment = conversationSentiment(ctx);
  const ghost = ghostRisk(ctx);
  const best = await bestTime(ctx);
  const [size, nba, reactivation] = await Promise.all([dealSize(ctx), nextBestAction(ctx, { ghost, sentiment, best }), reactivationSignal(ctx)]);
  const risk = dealRisk(ctx, sentiment, ghost);
  const competitors = competitorMentions(ctx).map((c) => ({ ...c, counter: COUNTERS.competitor }));
  const lastIn = inbound(ctx).slice(-1)[0];
  // A plain price *question* ("what's the price range?") needs an answer, not objection handling.
  const priceQuestion = lastIn && /\?|how much|price range|what.{0,15}(price|cost)/i.test(lastIn.text) && !/expensive|too much|cheaper|discount|afford|over (our|my) budget/i.test(lastIn.text);
  const objections = lastIn ? detectObjections(lastIn.text).map((k) => ({
    key: k,
    label: k === 'price' && priceQuestion ? 'Price question' : OBJECTION_LABEL[k],
    counter: k === 'price' && priceQuestion ? PRICE_ANSWER(ctx) : COUNTERS[k],
  })) : [];
  const out = {
    next_best_action: nba, deal_risk: risk, ghost, personality: personality(ctx), sentiment, best_time: best,
    deal_size: size, competitors, objections, reactivation, ai_enabled: ai.enabled(), computed_at: new Date().toISOString(),
  };
  // Remember the latest prediction so the won/lost result can calibrate future ones.
  if (size.predicted && OPEN_STAGES.includes(String(ctx.lead.stage).toLowerCase())) {
    await db.query('UPDATE leads SET predicted_value = $1 WHERE id = $2', [size.predicted, leadId]);
    await db.query(
      `INSERT INTO deal_predictions (workspace_id, lead_id, lead_source, predicted, predicted_at) VALUES ($1,$2,$3,$4,NOW())
       ON CONFLICT (lead_id) DO UPDATE SET predicted = EXCLUDED.predicted, predicted_at = NOW() WHERE deal_predictions.closed_at IS NULL`,
      [workspaceId, leadId, ctx.lead.lead_source, size.predicted]
    );
  }
  await db.query(
    `UPDATE leads SET metadata = jsonb_set(COALESCE(metadata, '{}'::jsonb), '{intel}', $1::jsonb) WHERE id = $2`,
    [JSON.stringify({ risk: risk.score, risk_level: risk.level, ghost: ghost.level, sentiment: sentiment.label, personality: out.personality.type, nba: nba.action, computed_at: out.computed_at }), leadId]
  );
  return out;
}

module.exports = {
  loadContext, leadInsights, conversationSentiment, ghostRisk, dealRisk, dealSize, personality, bestTime,
  nextBestAction, reactivationSignal, competitorMentions, detectObjections, moneyHints, replyLatencies,
  calibration, channelHistory, sentimentOf, OBJECTION_LABEL, COUNTERS, OPEN_STAGES, inbound, leadName, parseJson, median,
};
