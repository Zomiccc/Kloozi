const db = require('../config/database');
const ai = require('./ai');
const intel = require('./intelligence');
const { logActivity } = require('../utils/activityLog');

/* ═══════════════════════════════════════════════════════════════
   AI FEATURES — reply suggester + negotiation co-pilot, lost-deal
   autopsy, meeting briefs, call intelligence, voice-to-CRM and the
   talk-to-build flow builder. Each has a rule-based fallback so the
   feature still works (more simply) without an OpenAI key.
   ═══════════════════════════════════════════════════════════════ */

const fmtConvo = (ctx, n = 20) => ctx.messages.slice(-n)
  .map((m) => `${m.direction === 'inbound' ? 'LEAD' : 'AGENT'} (${m.channel}, ${m.at.toISOString().slice(0, 16).replace('T', ' ')}): ${m.text}`)
  .join('\n') || '(no messages yet)';

function leadFacts(ctx) {
  const l = ctx.lead;
  return [
    `Name: ${intel.leadName(l)}`, `Stage: ${l.stage}`, l.city && `City: ${l.city}`, Number(l.budget) > 0 && `Budget: ${l.budget}`,
    `Source: ${l.lead_source}`, l.notes && `Notes: ${String(l.notes).slice(0, 400)}`,
    `Business: ${ctx.settings.company_name || ctx.workspaceName}`,
  ].filter(Boolean).join('\n');
}

// ── 4. Negotiation co-pilot: what worked on this objection in deals you won ──

async function copilot(workspaceId, text) {
  const kinds = intel.detectObjections(text);
  if (!kinds.length) return { objections: [], examples: [], suggestion: null };
  const won = await db.query(
    `SELECT m.lead_id, m.direction, m.message_text AS text, COALESCE(m.sent_at, m.created_at) AS at, l.first_name
     FROM whatsapp_messages m JOIN leads l ON l.id = m.lead_id
     WHERE m.workspace_id = $1 AND l.stage = 'won' AND m.message_text IS NOT NULL
     ORDER BY m.lead_id, COALESCE(m.sent_at, m.created_at) LIMIT 5000`, [workspaceId]);
  const examples = [];
  for (let i = 0; i < won.rows.length - 1; i += 1) {
    const m = won.rows[i];
    if (m.direction !== 'inbound') continue;
    const k = intel.detectObjections(m.text).find((x) => kinds.includes(x));
    if (!k) continue;
    const reply = won.rows.slice(i + 1).find((x) => x.lead_id === m.lead_id && x.direction !== 'inbound');
    if (reply && reply.text.length > 15) examples.push({ objection: intel.OBJECTION_LABEL[k], they_said: m.text.slice(0, 200), you_replied: reply.text.slice(0, 400), lead: m.first_name || 'a client' });
  }
  const picked = examples.slice(-4).reverse();
  return {
    objections: kinds.map((k) => ({ key: k, label: intel.OBJECTION_LABEL[k] })),
    examples: picked,
    suggestion: intel.COUNTERS[kinds[0]],
    from_history: picked.length > 0,
  };
}

// ── 12. AI reply suggester (uses personality + co-pilot) ──

async function suggestReply(workspaceId, leadId, { draft = '' } = {}) {
  const ctx = await intel.loadContext(workspaceId, leadId);
  if (!ctx) return null;
  const pers = intel.personality(ctx);
  const lastIn = intel.inbound(ctx).slice(-1)[0];
  const co = await copilot(workspaceId, `${lastIn?.text || ''} ${draft}`);
  const first = ctx.lead.first_name || 'there';

  if (ai.enabled()) {
    const r = await ai.chatJSON(
      `You write WhatsApp replies for a sales agent at "${ctx.settings.company_name || ctx.workspaceName}". Be human, warm and brief (max 70 words), no markdown, no invented prices or promises. Match the lead's style. Return JSON {"reply": string, "alternatives": [string, string], "why": string}.`,
      `${leadFacts(ctx)}\nPersonality: ${pers.label}. Tip: ${pers.tip}\n${co.examples.length ? `Replies that won similar deals:\n${co.examples.map((e) => `- They: "${e.they_said}" → Agent: "${e.you_replied}"`).join('\n')}\n` : ''}${draft ? `Agent's draft to improve: "${draft}"\n` : ''}Conversation:\n${fmtConvo(ctx)}\n\nWrite the next message from the agent.`,
      { maxTokens: 500, temperature: 0.6 }
    );
    if (r?.reply) return { reply: r.reply, alternatives: (r.alternatives || []).slice(0, 2), why: r.why, copilot: co, personality: pers, source: 'ai' };
  }
  let reply;
  if (draft) reply = draft.trim();
  else if (co.suggestion) reply = `Hi ${first}, ${co.suggestion.charAt(0).toLowerCase()}${co.suggestion.slice(1)}`;
  else if (lastIn && /\?\s*$/.test(lastIn.text)) reply = `Hi ${first}, great question! Let me get you the details now. Is a quick call easier, or shall I message them here?`;
  else if (!lastIn) reply = `Hi ${first}, thanks for your enquiry with ${ctx.settings.company_name || ctx.workspaceName}! When is a good time for a quick chat about what you're looking for?`;
  else reply = `Hi ${first}, just checking in. Did you have any questions I can help with?`;
  if (pers.type === 'fast_decider') reply = reply.split('. ').slice(0, 2).join('. ');
  return { reply, alternatives: [], why: co.suggestion ? `They raised: ${co.objections.map((o) => o.label).join(', ')}` : 'Based on where the conversation is', copilot: co, personality: pers, source: 'rules' };
}

// ── 11. Lost deal autopsy ──

async function autopsy(workspaceId, leadId) {
  const ctx = await intel.loadContext(workspaceId, leadId);
  if (!ctx) return null;
  const l = ctx.lead;
  const facts = [];
  const firstOut = ctx.messages.find((m) => m.direction !== 'inbound');
  const firstCall = ctx.calls[0];
  const firstTouch = [firstOut?.at, firstCall && new Date(firstCall.created_at)].filter(Boolean).sort((a, b) => a - b)[0];
  if (firstTouch) {
    const mins = (firstTouch - new Date(l.created_at)) / 60000;
    if (mins > 60) facts.push(`First reply took ${mins > 1440 ? `${Math.round(mins / 1440)} days` : `${Math.round(mins / 60)} hours`}. Leads contacted within 5 minutes convert far more often.`);
  } else facts.push('Nobody ever contacted this lead.');
  let gaps = 0;
  for (let i = 1; i < ctx.messages.length; i += 1) if (ctx.messages[i].at - ctx.messages[i - 1].at > 4 * 86400000) gaps += 1;
  if (gaps) facts.push(`${gaps} gap${gaps > 1 ? 's' : ''} of 4+ days with no contact.`);
  const unanswered = ctx.messages.filter((m, i) => m.direction === 'inbound' && /\?/.test(m.text)
    && !ctx.messages.slice(i + 1).some((x) => x.direction !== 'inbound' && x.at - m.at < 86400000));
  if (unanswered.length) facts.push(`${unanswered.length} question${unanswered.length > 1 ? 's were' : ' was'} not answered within a day (e.g. "${unanswered[0].text.slice(0, 90)}").`);
  const objections = [...new Set(intel.inbound(ctx).flatMap((m) => intel.detectObjections(m.text)))];
  if (objections.length) facts.push(`Objections raised: ${objections.map((k) => intel.OBJECTION_LABEL[k]).join(', ')}.`);
  if (!ctx.calls.length && ctx.messages.length > 4) facts.push('The whole deal ran over text and never had a call.');
  const sent = intel.conversationSentiment(ctx);
  if (sent.label === 'negative') facts.push('Their tone turned negative towards the end.');

  if (ai.enabled() && ctx.messages.length) {
    const r = await ai.chatJSON(
      'You are a sales coach reviewing a LOST deal. Be specific and kind. Return JSON {"verdict": one sentence, "turning_point": the moment it went wrong (quote it if possible), "mistakes": [up to 3 short items], "lessons": [up to 3 short items for next time]}.',
      `${leadFacts(ctx)}\nObserved facts:\n- ${facts.join('\n- ')}\nConversation:\n${fmtConvo(ctx, 40)}`,
      { maxTokens: 600 }
    );
    if (r?.verdict) {
      await logActivity(workspaceId, leadId, null, 'ai_autopsy', `Lost deal autopsy: ${r.verdict}`, { autopsy: r });
      return { ...r, facts, source: 'ai' };
    }
  }
  const result = {
    verdict: facts[0] || 'Not enough history to say what went wrong.',
    turning_point: unanswered[0] ? `Their question "${unanswered[0].text.slice(0, 100)}" went unanswered.` : (gaps ? 'Contact went quiet for several days.' : null),
    mistakes: facts.slice(0, 3),
    lessons: [
      firstTouch && (firstTouch - new Date(l.created_at)) > 3600000 ? 'Reply to new leads within 5 minutes. Use the WhatsApp auto-responder to buy time.' : null,
      gaps ? 'Plan a follow-up every time a conversation ends.' : null,
      objections.includes('price') ? 'Answer price objections with value and a like-for-like comparison.' : null,
      !ctx.calls.length ? 'Get on a call early; voice builds trust faster than text.' : null,
    ].filter(Boolean).slice(0, 3),
    facts, source: 'rules',
  };
  await logActivity(workspaceId, leadId, null, 'ai_autopsy', `Lost deal autopsy: ${result.verdict}`, { autopsy: result });
  return result;
}

// ── 9. Meeting brief ──

async function meetingBrief(workspaceId, leadId) {
  const ctx = await intel.loadContext(workspaceId, leadId);
  if (!ctx) return null;
  const pers = intel.personality(ctx);
  const size = await intel.dealSize(ctx);
  const objections = [...new Set(intel.inbound(ctx).flatMap((m) => intel.detectObjections(m.text)))];
  const likely = objections[objections.length - 1] || (Number(ctx.lead.budget) > 0 ? 'price' : 'need');
  const engaged = ctx.sessions.slice(0, 3).map((s) => `${s.channel === 'document' ? 'read a document' : 'visited the website'} (${Math.round((s.total_seconds || 0) / 60)} min)`);
  if (ai.enabled()) {
    const r = await ai.chatJSON(
      'Write a pre-call brief for a sales agent. Return JSON {"summary": one paragraph (max 70 words), "likely_objection": short, "how_to_handle": one sentence, "opener": one friendly opening line}.',
      `${leadFacts(ctx)}\nPersonality: ${pers.label}\nPredicted deal size: ${size.predicted || 'unknown'}\nRecent engagement: ${engaged.join(', ') || 'none'}\nConversation:\n${fmtConvo(ctx, 25)}`,
      { maxTokens: 450 }
    );
    if (r?.summary) return { ...r, personality: pers, predicted_value: size.predicted, source: 'ai' };
  }
  const l = ctx.lead;
  const lastIn = intel.inbound(ctx).slice(-1)[0];
  const summary = [
    `${intel.leadName(l)} came from ${String(l.lead_source || 'an enquiry').replace(/_/g, ' ')}${l.city ? ` in ${l.city}` : ''} and is at the "${l.stage}" stage.`,
    Number(l.budget) > 0 ? `Budget is about ${Number(l.budget).toLocaleString()}.` : null,
    lastIn ? `Last said: "${lastIn.text.slice(0, 120)}".` : 'They have not written to you yet.',
    engaged.length ? `Recently ${engaged.join(' and ')}.` : null,
  ].filter(Boolean).join(' ');
  return {
    summary, likely_objection: intel.OBJECTION_LABEL[likely], how_to_handle: intel.COUNTERS[likely],
    opener: `Hi ${l.first_name || 'there'}, thanks for making time. I've had a look at what you need and have a couple of ideas.`,
    personality: pers, predicted_value: size.predicted, source: 'rules',
  };
}

// ── 3. Call intelligence ──

function analyzeTranscriptRules(transcript) {
  const lines = String(transcript || '').split(/\n+/).map((x) => x.trim()).filter(Boolean);
  let agentWords = 0;
  let leadWords = 0;
  for (const line of lines) {
    const m = line.match(/^(agent|me|rep|sales|lead|client|customer|them|caller)\s*[:\-]\s*(.*)$/i);
    if (!m) continue;
    const words = m[2].split(/\s+/).length;
    if (/agent|me|rep|sales/i.test(m[1])) agentWords += words; else leadWords += words;
  }
  const total = agentWords + leadWords;
  const objections = [...new Set(intel.detectObjections(transcript))].map((k) => intel.OBJECTION_LABEL[k]);
  return {
    talk_ratio: total ? { agent: Math.round((agentWords / total) * 100), lead: Math.round((leadWords / total) * 100) } : null,
    objections,
    debrief: objections.length ? `Call covered ${objections.join(', ').toLowerCase()} concerns; follow up on them.` : 'Call logged; no objections detected.',
    next_step: objections.includes(intel.OBJECTION_LABEL.authority) ? 'Set up a call that includes the decision-maker' : 'Send a summary and agree a next step',
    sentiment: intel.sentimentOf(transcript) > 0.3 ? 'positive' : intel.sentimentOf(transcript) < -0.3 ? 'negative' : 'neutral',
  };
}

async function analyzeCall(workspaceId, { callId, leadId, userId, audio, transcript: givenTranscript, duration }) {
  let call = callId ? (await db.query('SELECT * FROM calls WHERE id = $1 AND workspace_id = $2', [callId, workspaceId])).rows[0] : null;
  if (!call) {
    if (!leadId) throw new Error('lead_id is required');
    const lead = (await db.query('SELECT phone FROM leads WHERE id = $1 AND workspace_id = $2', [leadId, workspaceId])).rows[0];
    if (!lead) throw new Error('Lead not found');
    call = (await db.query(
      `INSERT INTO calls (workspace_id, lead_id, user_id, phone_number, outcome, duration_seconds) VALUES ($1,$2,$3,$4,'recorded',$5) RETURNING *`,
      [workspaceId, leadId, userId, lead.phone, Number(duration) || 0]
    )).rows[0];
  }
  let transcript = givenTranscript || call.transcript;
  if (!transcript && audio) {
    transcript = await ai.transcribe(audio.buffer, audio.originalname || 'call.webm', audio.mimetype || 'audio/webm');
    if (!transcript) throw new Error(ai.enabled() ? 'Could not transcribe that recording' : 'Transcribing recordings needs OPENAI_API_KEY on the server. You can paste a transcript instead.');
  }
  if (!transcript) throw new Error('Upload a recording or paste a transcript');

  let analysis = null;
  if (ai.enabled()) {
    analysis = await ai.chatJSON(
      'You analyse sales call transcripts. The transcript may not label speakers: infer who is the sales agent and who is the lead. Return JSON {"talk_ratio": {"agent": percent, "lead": percent}, "objections": [short labels], "debrief": ONE line (max 25 words), "next_step": short, "sentiment": "positive"|"neutral"|"negative", "coaching": one short tip for the agent}.',
      transcript.slice(0, 24000), { maxTokens: 400 }
    );
  }
  if (!analysis?.debrief) analysis = { ...analyzeTranscriptRules(transcript), source: 'rules' };
  else analysis.source = 'ai';
  await db.query('UPDATE calls SET transcript = $1, analysis = $2, notes = COALESCE(NULLIF(notes, \'\'), $3) WHERE id = $4', [transcript, JSON.stringify(analysis), analysis.debrief, call.id]);
  await logActivity(workspaceId, call.lead_id, userId, 'call_analyzed', `Call debrief: ${analysis.debrief}`, { call_id: call.id, analysis });
  return { call_id: call.id, transcript, analysis };
}

// ── 13. Voice-to-CRM ──

const STAGE_WORDS = [
  ['won', /\b(won|closed (it|the deal)|signed|deal done|they bought|said yes|booked in)\b/i],
  ['lost', /\b(lost|not interested|went with|no longer interested|dead|said no)\b/i],
  ['negotiating', /\b(negotiat\w*|discussing (the )?price|counter[- ]?offer|sending (a |the )?quote|proposal)/i],
  ['interested', /\b(interested|keen|wants to see|inspection|viewing|demo)\b/i],
  ['contacted', /\b(spoke|called|talked|left (a )?voicemail|no answer)\b/i],
];

function parseWhen(text) {
  const t = text.toLowerCase();
  const d = new Date();
  const set = (days, hour = 10) => { d.setDate(d.getDate() + days); d.setHours(hour, 0, 0, 0); return d; };
  const hourMatch = t.match(/\b(?:at\s*)?(\d{1,2})\s*(am|pm)\b/);
  const hour = hourMatch ? (Number(hourMatch[1]) % 12) + (hourMatch[2] === 'pm' ? 12 : 0) : 10;
  if (/\btomorrow\b/.test(t)) return set(1, hour);
  if (/\bnext week\b/.test(t)) return set(7, hour);
  const inDays = t.match(/\bin (\d+) days?\b/);
  if (inDays) return set(Number(inDays[1]), hour);
  const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const named = days.findIndex((x) => t.includes(x));
  if (named >= 0) return set(((named - d.getDay() + 7) % 7) || 7, hour);
  if (/\b(later today|this afternoon)\b/.test(t)) return set(0, 15);
  return null;
}

async function voiceToCrm(workspaceId, leadId, userId, { audio, text: givenText }) {
  const lead = (await db.query('SELECT * FROM leads WHERE id = $1 AND workspace_id = $2', [leadId, workspaceId])).rows[0];
  if (!lead) throw new Error('Lead not found');
  let text = givenText;
  if (!text && audio) {
    text = await ai.transcribe(audio.buffer, audio.originalname || 'note.webm', audio.mimetype || 'audio/webm');
    if (!text) throw new Error(ai.enabled() ? 'Could not understand that recording' : 'Voice notes need OPENAI_API_KEY on the server. You can type the note instead.');
  }
  if (!text) throw new Error('Record or type a note');

  let parsed = null;
  if (ai.enabled()) {
    parsed = await ai.chatJSON(
      `Turn a sales agent's spoken note about a lead into CRM updates. Today is ${new Date().toISOString().slice(0, 10)}. Stages: new, contacted, interested, negotiating, won, lost. Return JSON {"summary": one sentence, "stage": stage or null if unchanged, "follow_up": {"type": "call"|"whatsapp"|"email"|"meeting", "when": ISO datetime, "note": short} or null, "budget": number or null}.`,
      `Current stage: ${lead.stage}\nNote: ${text}`, { maxTokens: 300 }
    );
  }
  if (!parsed?.summary) {
    const stage = STAGE_WORDS.find(([, re]) => re.test(text))?.[0] || null;
    const when = parseWhen(text);
    const budget = intel.moneyHints(text)[0] || null;
    parsed = {
      summary: text.length > 200 ? `${text.slice(0, 197)}…` : text,
      stage: stage && stage !== lead.stage ? stage : null,
      follow_up: when ? { type: /whatsapp|message/i.test(text) ? 'whatsapp' : /meet|visit|inspection/i.test(text) ? 'meeting' : 'call', when: when.toISOString(), note: text.slice(0, 120) } : null,
      budget, source: 'rules',
    };
  } else parsed.source = 'ai';

  const applied = [];
  const { changeStage, onLeadUpdated } = require('./leadPipeline');
  if (parsed.stage && parsed.stage !== String(lead.stage).toLowerCase()) {
    const after = await changeStage(workspaceId, lead, parsed.stage, userId, 'voice note');
    await onLeadUpdated(workspaceId, lead, after, { actorId: userId });
    applied.push(`Stage → ${parsed.stage}`);
  }
  if (parsed.budget && !Number(lead.budget)) {
    await db.query('UPDATE leads SET budget = $1 WHERE id = $2', [parsed.budget, leadId]);
    applied.push(`Budget → ${Number(parsed.budget).toLocaleString()}`);
  }
  if (parsed.follow_up?.when && !Number.isNaN(new Date(parsed.follow_up.when).getTime())) {
    await db.query(
      `INSERT INTO follow_ups (workspace_id, lead_id, user_id, type, title, due_date, status) VALUES ($1,$2,$3,$4,$5,$6,'pending')`,
      [workspaceId, leadId, lead.assigned_to || userId, parsed.follow_up.type || 'call', parsed.follow_up.note || 'From voice note', new Date(parsed.follow_up.when)]
    );
    const { syncLeadFollowUp } = require('./followUpService');
    await syncLeadFollowUp(leadId);
    applied.push(`Follow-up ${new Date(parsed.follow_up.when).toLocaleString('en-AU', { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}`);
  }
  await db.query(`UPDATE leads SET notes = TRIM(BOTH E'\\n' FROM COALESCE(notes, '') || E'\\n' || $1), last_activity_at = NOW() WHERE id = $2`, [`[Voice note ${new Date().toISOString().slice(0, 10)}] ${parsed.summary}`, leadId]);
  await logActivity(workspaceId, leadId, userId, 'voice_note', `Voice note: ${parsed.summary}`, { transcript: text, applied });
  return { transcript: text, summary: parsed.summary, applied, source: parsed.source };
}

// ── 6. Talk-to-build flow builder ──

const NODE_TYPES = ['send_email', 'wait', 'condition', 'add_tag', 'change_stage', 'notify_agent', 'whatsapp', 'sms', 'exit'];
const TRIGGERS = ['lead_created', 'stage_entered', 'tagged_with', 'days_inactive', 'source_is', 'manual'];

function validateGraph(spec) {
  const nodes = (spec.nodes || []).filter((n) => n && NODE_TYPES.includes(n.type)).slice(0, 25)
    .map((n, i) => ({ key: String(n.key || `n${i + 1}`), type: n.type, config: n.config || {}, x: 120, y: 80 + i * 120 }));
  const keys = new Set(nodes.map((n) => n.key));
  let edges = (spec.edges || []).filter((e) => keys.has(e.from) && keys.has(e.to)).map((e) => ({ from: e.from, to: e.to, ...(e.label ? { label: String(e.label).toLowerCase() } : {}) }));
  if (!edges.length) edges = nodes.slice(1).map((n, i) => ({ from: nodes[i].key, to: n.key }));
  for (const n of nodes) {
    if (n.type === 'wait') { n.config.duration = Math.max(1, Number(n.config.duration) || 1); if (!['minutes', 'hours', 'days'].includes(n.config.unit)) n.config.unit = 'days'; }
  }
  const trigger_type = TRIGGERS.includes(spec.trigger_type) ? spec.trigger_type : 'lead_created';
  return { trigger_type, trigger_config: spec.trigger_config || {}, graph: { nodes: [{ key: 't', type: 'trigger', x: 120, y: 0, config: {} }, ...nodes], edges: nodes.length ? [{ from: 't', to: nodes[0].key }, ...edges] : [] } };
}

function flowFromTextRules(text) {
  // Keep quoted messages whole: hide them before splitting the sentence into steps.
  const quotes = [];
  const masked = String(text).replace(/["“]([^"”]+)["”]/g, (_, q) => { quotes.push(q); return `"@@Q${quotes.length - 1}@@"`; });
  const unmask = (s) => s.replace(/@@Q(\d+)@@/g, (_, i) => quotes[Number(i)]);
  const parts = masked.split(/\bthen\b|,|\.|;|\band\b(?=\s+(?:wait|send|tag|move|notify|text|sms|email|whatsapp))/i).map((s) => s.trim()).filter(Boolean);
  const spec = { trigger_type: 'lead_created', trigger_config: {}, nodes: [] };
  let k = 0;
  let pendingLabel = null; // edge label for the step right after a condition
  const edges = [];
  const add = (type, config) => {
    const key = `n${++k}`;
    if (spec.nodes.length) edges.push({ from: spec.nodes[spec.nodes.length - 1].key, to: key, ...(pendingLabel ? { label: pendingLabel } : {}) });
    pendingLabel = null;
    spec.nodes.push({ key, type, config });
  };
  for (const raw of parts) {
    let p = raw;
    let low = p.toLowerCase();
    const cond = low.match(/^(?:and )?if\b.*?\b(opened?|clicked?|repl(?:ied|y))\b/);
    if (cond) {
      add('condition', { condition_type: /click/.test(cond[1]) ? 'email_clicked' : /repl/.test(cond[1]) ? 'email_replied' : 'email_opened' });
      pendingLabel = /\bnot\b|n't\b|\bnever\b/.test(low) ? 'no' : 'yes';
      const after = p.split(/\bthen\b/i)[1];
      if (!after || !after.trim()) continue;
      p = after.trim();
      low = p.toLowerCase();
    }
    const src = low.match(/\b(facebook|google|tiktok|linkedin|website|whatsapp|instagram)\b/);
    if (/^(when|whenever|if a|every time)/.test(low)) {
      if (src) { spec.trigger_type = 'source_is'; spec.trigger_config = { source: src[1] === 'google' ? 'google_ads' : src[1] }; }
      const stage = low.match(/(?:moves? to|becomes?|enters?|is marked)\s+(new|contacted|interested|negotiating|won|lost)/);
      if (stage) { spec.trigger_type = 'stage_entered'; spec.trigger_config = { stage: stage[1] }; }
      const tag = low.match(/tagged(?: with)? ["']?([\w-]+)/);
      if (tag) { spec.trigger_type = 'tagged_with'; spec.trigger_config = { tag: tag[1] }; }
      const idle = low.match(/(?:no activity|inactive|quiet) (?:for )?(\d+) days?/);
      if (idle) { spec.trigger_type = 'days_inactive'; spec.trigger_config = { days: Number(idle[1]) }; }
      continue;
    }
    const wait = low.match(/wait (\d+) ?(minute|hour|day|week)s?/);
    if (wait) { const n = Number(wait[1]); add('wait', wait[2] === 'week' ? { duration: n * 7, unit: 'days' } : { duration: n, unit: `${wait[2]}s` }); continue; }
    const quotedRaw = p.match(/["“](.+?)["”]/)?.[1];
    const quoted = quotedRaw ? unmask(quotedRaw) : undefined;
    if (/whatsapp/.test(low)) { add('whatsapp', { message: quoted || 'Hi {{First_Name}}, thanks for your interest! When suits you for a quick chat?' }); continue; }
    if (/\b(sms|text)\b/.test(low)) { add('sms', { message: quoted || 'Hi {{First_Name}}, just following up on your enquiry. Reply anytime!' }); continue; }
    if (/email/.test(low)) { add('send_email', { subject: quoted || 'Following up, {{First_Name}}', body_html: '<p>Hi {{First_Name}},</p><p>Just following up on your enquiry. Happy to answer any questions.</p>' }); continue; }
    const tag = low.match(/tag (?:them |it |the lead )?(?:as |with )?["']?([\w-]+)/);
    if (tag) { add('add_tag', { tag: tag[1] }); continue; }
    const stage = low.match(/(?:move|change|set)(?: them| the lead| it)?(?: stage)? to (new|contacted|interested|negotiating|won|lost)/);
    if (stage) { add('change_stage', { stage: stage[1] }); continue; }
    if (/notify|alert|tell (the )?agent|let me know/.test(low)) { add('notify_agent', { message: quoted || 'Time to follow up with {{First_Name}}' }); continue; }
  }
  if (!spec.nodes.length) add('notify_agent', { message: 'New lead: {{First_Name}}' });
  spec.edges = edges;
  return spec;
}

async function flowFromText(workspaceId, userId, text) {
  let spec = null;
  if (ai.enabled()) {
    spec = await ai.chatJSON(
      `Convert a plain-English automation into a flow for a CRM. Allowed trigger_type: ${TRIGGERS.join(', ')} (trigger_config: stage_entered {stage}, tagged_with {tag}, days_inactive {days}, source_is {source: facebook|google_ads|tiktok|linkedin|website|whatsapp}). Allowed node types and config:
send_email {subject, body_html}; wait {duration, unit: minutes|hours|days}; condition {condition_type: email_opened|email_clicked|email_replied|stage_is|score_above, stage?, score?}; add_tag {tag}; change_stage {stage}; notify_agent {message}; whatsapp {message}; sms {message}; exit {}.
Messages may use {{First_Name}}, {{Agent_Name}}, {{Company_Name}}. Conditions branch with edges labelled "yes"/"no". Return JSON {"name": short name, "trigger_type", "trigger_config", "nodes": [{"key","type","config"}], "edges": [{"from","to","label"?}]}.`,
      text, { maxTokens: 1200, temperature: 0.2 }
    );
  }
  const source = spec?.nodes?.length ? 'ai' : 'rules';
  if (!spec?.nodes?.length) spec = flowFromTextRules(text);
  const v = validateGraph(spec);
  const name = (spec.name || text.slice(0, 60)).trim();
  const r = await db.query(
    `INSERT INTO flows (workspace_id, name, description, trigger_type, trigger_config, graph, created_by)
     VALUES ($1,$2,$3,$4,$5::jsonb,$6::jsonb,$7) RETURNING *`,
    [workspaceId, name, `Built from: "${text.slice(0, 300)}"`, v.trigger_type, JSON.stringify(v.trigger_config), JSON.stringify(v.graph), userId]
  );
  return { flow: r.rows[0], source };
}

module.exports = {
  copilot, suggestReply, autopsy, meetingBrief, analyzeCall, analyzeTranscriptRules, voiceToCrm, parseWhen,
  flowFromText, flowFromTextRules, validateGraph,
};
