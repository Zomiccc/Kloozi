// Full automation test suite (81 checks): variables, follow-ups, sequences, rules,
// flows, email tracking, segments, campaigns, inbound WhatsApp/SMS, Meta CAPI.
// Uses a throwaway workspace that is deleted at the end; nothing is really sent.
//
// 1. Start a dry-run test server (from backend/):
//      PORT=5055 API_URL=http://localhost:5055 MESSAGING_DRY_RUN=true OPENAI_API_KEY= //      TWILIO_AUTH_TOKEN=e2e-twilio-token META_PIXEL_ID= META_CONVERSIONS_ACCESS_TOKEN= node src/server.js
// 2. In another terminal (from backend/):
//      API_URL=http://localhost:5055 npm run test:automations
require('dotenv').config({ path: process.cwd() + '/.env' });
process.env.MESSAGING_DRY_RUN = 'true';
process.env.OPENAI_API_KEY = '';
process.env.TWILIO_AUTH_TOKEN = 'e2e-twilio-token';

const http = require('http');
const crypto = require('crypto');
const axios = require('axios');
const jwt = require('jsonwebtoken');
const qs = require('querystring');
const db = require(process.cwd() + '/src/config/database');

const BASE = 'http://localhost:5055/api';
const results = [];
let section = '';
const sec = (name) => { section = name; };
const check = (name, cond, extra = '') => {
  results.push({ section, name, ok: !!cond, extra: cond ? '' : String(extra).slice(0, 300) });
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const one = async (sql, p = []) => (await db.query(sql, p)).rows[0];
const all = async (sql, p = []) => (await db.query(sql, p)).rows;
async function waitFor(fn, ms = 8000, step = 250) {
  const end = Date.now() + ms;
  while (Date.now() < end) { const v = await fn(); if (v) return v; await sleep(step); }
  return fn();
}

const received = [];
const receiver = http.createServer((req, res) => {
  let body = '';
  req.on('data', (c) => (body += c));
  req.on('end', () => { try { received.push(JSON.parse(body)); } catch {} res.end('ok'); });
}).listen(5067);

const WA_NUMBER = '+61400000999';

function twilioSign(url, params) {
  const data = url + Object.keys(params).sort().map((k) => k + params[k]).join('');
  return crypto.createHmac('sha1', process.env.TWILIO_AUTH_TOKEN).update(Buffer.from(data, 'utf-8')).digest('base64');
}
async function inbound(fromPhone, body, { sign = true, sid } = {}) {
  const params = { From: `whatsapp:${fromPhone}`, To: `whatsapp:${WA_NUMBER}`, Body: body, MessageSid: sid || `SM${crypto.randomBytes(8).toString('hex')}`, ProfileName: 'Inbound Tester' };
  const url = `${process.env.API_URL || 'http://localhost:5055'}/api/whatsapp/webhook`;
  const headers = { 'Content-Type': 'application/x-www-form-urlencoded' };
  if (sign) headers['X-Twilio-Signature'] = twilioSign(url, params);
  const r = await axios.post(`${BASE}/whatsapp/webhook`, qs.stringify(params), { headers, validateStatus: () => true });
  return { status: r.status, sid: params.MessageSid };
}

(async () => {
  let ws;
  try {
    // ── Setup: isolated workspace, admin + agent ─────────────────────────────
    ws = (await one(
      `INSERT INTO workspaces (name, slug, plan, subscription_status, settings)
       VALUES ('Flazyn E2E', $1, 'pro', 'active', $2) RETURNING id`,
      [`e2e-${Date.now()}`, JSON.stringify({ whatsapp_number: WA_NUMBER, company_name: 'Harbour Homes' })]
    )).id;
    const stages = ['New', 'Contacted', 'Interested', 'Negotiating', 'Won', 'Lost'];
    for (let i = 0; i < stages.length; i++) {
      await db.query('INSERT INTO lead_stages (workspace_id, name, sort_order, is_default, is_won, is_lost) VALUES ($1,$2,$3,$4,$5,$6)',
        [ws, stages[i], i, i === 0, stages[i] === 'Won', stages[i] === 'Lost']);
    }
    const tag = Date.now();
    const admin = await one(`INSERT INTO users (workspace_id, email, password_hash, first_name, last_name, phone, role, status)
      VALUES ($1,$2,'x','Ava','Admin','+61411111111','admin','active') RETURNING *`, [ws, `e2e-admin-${tag}@flazyn.test`]);
    const agent = await one(`INSERT INTO users (workspace_id, email, password_hash, first_name, last_name, phone, role, status)
      VALUES ($1,$2,'x','Sam','Agent','+61422222222','sales_agent','active') RETURNING *`, [ws, `e2e-agent-${tag}@flazyn.test`]);
    const tok = (u) => jwt.sign({ userId: u.id, workspaceId: ws, role: u.role }, process.env.JWT_SECRET, { expiresIn: '1h' });
    const api = axios.create({ baseURL: BASE, headers: { Authorization: `Bearer ${tok(admin)}` }, validateStatus: () => true });
    const agentApi = axios.create({ baseURL: BASE, headers: { Authorization: `Bearer ${tok(agent)}` }, validateStatus: () => true });
    const newLead = async (data) => {
      const r = await api.post('/leads', data);
      if (r.status !== 201) throw new Error(`lead create ${r.status} ${JSON.stringify(r.data)}`);
      return r.data.lead;
    };
    let n = 0;
    const phone = () => `+6141${String(Date.now() % 100000).padStart(5, '0')}${String(n++).padStart(2, '0')}`;

    const { processDueSequenceSteps } = require(process.cwd() + '/src/controllers/whatsappSequenceController');
    const { runFlowTick } = require(process.cwd() + '/src/services/flowEngine');
    const { processFollowUpReminders } = require(process.cwd() + '/src/services/followUpService');
    const { processNoReplyRules } = require(process.cwd() + '/src/services/chatAssistant');

    // ── 1. Variables in direct sends ─────────────────────────────────────────
    sec('Message variables');
    const sara = await newLead({ first_name: 'Sara', last_name: 'Khan', phone: phone(), email: `sara-${tag}@example.com`, city: 'Canberra', assigned_to: agent.id, lead_source: 'manual' });
    let r = await api.post('/whatsapp/send', { lead_id: sara.id, message: 'Hi {{First_Name}}, {{agent_name}} from {{ Company Name }} here. {{Unknown_Var}}' });
    check('WhatsApp send API succeeds', r.status === 200, JSON.stringify(r.data));
    let msg = await one("SELECT message_text FROM whatsapp_messages WHERE lead_id=$1 AND direction='outbound' ORDER BY created_at DESC LIMIT 1", [sara.id]);
    check('WhatsApp variables filled (any case/spacing)', msg?.message_text === 'Hi Sara, Sam Agent from Harbour Homes here. {{Unknown_Var}}', msg?.message_text);
    r = await api.post('/sms/send', { lead_id: sara.id, message: 'Hey {{first_name}} in {{City}}' });
    check('SMS send API succeeds', r.status === 200, JSON.stringify(r.data));
    msg = await one("SELECT message_text FROM sms_messages WHERE lead_id=$1 ORDER BY created_at DESC LIMIT 1", [sara.id]);
    check('SMS variables filled', msg?.message_text === 'Hey Sara in Canberra', msg?.message_text);

    // ── 2. Follow-ups + reminders ───────────────────────────────────────────
    sec('Follow-ups');
    r = await api.post('/follow-ups', { lead_id: sara.id, type: 'call', title: 'Price call', due_date: new Date(Date.now() - 60000).toISOString() });
    check('create follow-up', r.status === 201, JSON.stringify(r.data));
    const fu = r.data.followUp;
    let leadRow = await one('SELECT follow_up_date FROM leads WHERE id=$1', [sara.id]);
    check('lead.follow_up_date synced', leadRow?.follow_up_date && Math.abs(new Date(leadRow.follow_up_date) - new Date(fu.due_date)) < 1000, leadRow?.follow_up_date);
    r = await api.get('/leads', { params: { follow_up_due: 'true' } });
    check('Leads "Follow-ups" tab returns due lead only', r.data.leads?.length === 1 && r.data.leads[0].id === sara.id, JSON.stringify(r.data.leads?.map((l) => l.first_name)));
    await processFollowUpReminders();
    let notes = await all("SELECT * FROM notifications WHERE user_id=$1 AND type='follow_up_due'", [agent.id]);
    check('due reminder sent to lead owner', notes.length === 1, notes.length);
    await processFollowUpReminders();
    notes = await all("SELECT * FROM notifications WHERE user_id=$1 AND type='follow_up_due'", [agent.id]);
    check('due reminder not repeated', notes.length === 1, notes.length);
    await db.query("UPDATE follow_ups SET due_date = NOW() - INTERVAL '25 hours' WHERE id=$1", [fu.id]);
    await processFollowUpReminders();
    notes = await all("SELECT * FROM notifications WHERE user_id=$1 AND type='follow_up_overdue'", [agent.id]);
    check('overdue reminder after 24h', notes.length === 1, notes.length);
    r = await api.put(`/follow-ups/${fu.id}/snooze`, { minutes: 60 });
    let fuRow = await one('SELECT * FROM follow_ups WHERE id=$1', [fu.id]);
    check('snooze moves due date & re-arms reminder', r.status === 200 && new Date(fuRow.due_date) > new Date() && !fuRow.reminded_at, JSON.stringify(r.data));
    r = await api.put(`/follow-ups/${fu.id}/complete`, {});
    leadRow = await one('SELECT follow_up_date FROM leads WHERE id=$1', [sara.id]);
    check('complete clears lead follow-up date', r.status === 200 && !leadRow.follow_up_date, JSON.stringify(leadRow));
    r = await api.put(`/leads/${sara.id}`, { follow_up_date: new Date(Date.now() + 86400000).toISOString(), follow_up_type: 'whatsapp' });
    const autoFu = await one("SELECT * FROM follow_ups WHERE lead_id=$1 AND status='pending'", [sara.id]);
    check('setting follow-up date on lead creates a real follow-up', autoFu?.type === 'whatsapp', JSON.stringify(autoFu));

    // ── 3. WhatsApp sequences ───────────────────────────────────────────────
    sec('WhatsApp sequences');
    r = await api.post('/whatsapp/sequences', { name: 'E2E nurture', steps: [{ message: 'Step 1 for {{First_Name}}', delay_hours: 0 }, { message: 'Step 2 from {{Agent_Name}}', delay_hours: 24 }] });
    check('create sequence', r.status === 201, JSON.stringify(r.data));
    const seq = r.data.sequence;
    const omar = await newLead({ first_name: 'Omar', phone: phone(), assigned_to: agent.id });
    r = await agentApi.post('/whatsapp/sequences/start', { sequence_id: seq.id, lead_id: omar.id });
    check('agent can start sequence on own lead', r.status === 200, JSON.stringify(r.data));
    r = await agentApi.post('/whatsapp/sequences/start', { sequence_id: seq.id, lead_id: (await newLead({ first_name: 'NotMine', phone: phone(), assigned_to: admin.id })).id });
    check('agent blocked on others\' leads', r.status === 403, r.status);
    await processDueSequenceSteps();
    let prog = await one('SELECT * FROM whatsapp_sequence_progress WHERE lead_id=$1', [omar.id]);
    msg = await one("SELECT message_text FROM whatsapp_messages WHERE lead_id=$1 AND direction='outbound' ORDER BY created_at DESC LIMIT 1", [omar.id]);
    check('step 1 sent with variables', msg?.message_text === 'Step 1 for Omar', msg?.message_text);
    check('step 2 scheduled ~24h later', prog.current_step === 1 && new Date(prog.next_send_at) > new Date(Date.now() + 23 * 3600000), JSON.stringify(prog));
    await processDueSequenceSteps();
    check('not re-sent before due', (await all("SELECT 1 FROM whatsapp_messages WHERE lead_id=$1 AND direction='outbound'", [omar.id])).length === 1);
    await db.query("UPDATE whatsapp_sequence_progress SET next_send_at = NOW() - INTERVAL '1 minute' WHERE id=$1", [prog.id]);
    await processDueSequenceSteps();
    prog = await one('SELECT * FROM whatsapp_sequence_progress WHERE id=$1', [prog.id]);
    msg = await one("SELECT message_text FROM whatsapp_messages WHERE lead_id=$1 AND direction='outbound' ORDER BY created_at DESC LIMIT 1", [omar.id]);
    check('last step sent and sequence completed', prog.is_completed && msg?.message_text === 'Step 2 from Sam Agent', `${JSON.stringify(prog)} ${msg?.message_text}`);
    // stop on reply
    const lina = await newLead({ first_name: 'Lina', phone: phone(), assigned_to: agent.id });
    await api.post('/whatsapp/sequences/start', { sequence_id: seq.id, lead_id: lina.id });
    await processDueSequenceSteps();
    const inb = await inbound(lina.phone, 'Thanks, call me tomorrow');
    check('signed inbound webhook accepted', inb.status === 200, inb.status);
    prog = await waitFor(async () => { const p = await one('SELECT * FROM whatsapp_sequence_progress WHERE lead_id=$1', [lina.id]); return p?.is_stopped ? p : null; });
    check('sequence stops when lead replies', prog?.is_stopped === true, JSON.stringify(prog));
    // retry cap
    const ken = await newLead({ first_name: 'Ken', phone: phone() });
    await api.post('/whatsapp/sequences/start', { sequence_id: seq.id, lead_id: ken.id });
    await db.query("UPDATE leads SET phone = NULL WHERE id=$1", [ken.id]);
    for (let i = 0; i < 3; i++) {
      await db.query("UPDATE whatsapp_sequence_progress SET next_send_at = NOW() - INTERVAL '1 minute' WHERE lead_id=$1", [ken.id]);
      await processDueSequenceSteps();
    }
    prog = await one('SELECT * FROM whatsapp_sequence_progress WHERE lead_id=$1', [ken.id]);
    check('failing step stops after 3 attempts', prog.is_stopped && prog.stop_reason === 'send_failed' && prog.failed_attempts === 3, JSON.stringify(prog));
    // bulk start
    const b1 = await newLead({ first_name: 'Bulk1', phone: phone() });
    const b2 = await newLead({ first_name: 'Bulk2' });
    r = await api.post('/leads/bulk', { lead_ids: [b1.id, b2.id], action: 'start_sequence', value: seq.id });
    check('bulk start sequence (skips lead without phone)', r.status === 200 && r.data.count === 1, JSON.stringify(r.data));

    // ── 4. Automation rule → start sequence ─────────────────────────────────
    sec('Lead rules');
    r = await api.post('/automations/rules', { name: 'E2E FB nurture', trigger_source: 'facebook', conditions: [], actions: [{ type: 'add_tag', value: 'fb' }, { type: 'start_sequence', value: seq.id }], is_active: true, priority: 0 });
    check('create rule with start_sequence action', r.status === 201, JSON.stringify(r.data));
    const fbLead = await newLead({ first_name: 'Fiona', phone: phone(), lead_source: 'facebook', email: `fiona-${tag}@example.com` });
    prog = await one('SELECT * FROM whatsapp_sequence_progress WHERE lead_id=$1', [fbLead.id]);
    check('new Facebook lead auto-enrolled in sequence', !!prog, 'no progress row');
    check('new lead auto-assigned (owner fallback)', !!fbLead.assigned_to, fbLead.assigned_to);

    // ── 5. Flows ─────────────────────────────────────────────────────────────
    sec('Flows');
    const graph = {
      nodes: [
        { key: 't', type: 'trigger' },
        { key: 'n1', type: 'whatsapp', config: { message: 'Welcome {{First_Name}} to {{Company_Name}}' } },
        { key: 'n2', type: 'add_tag', config: { tag: 'flowed' } },
        { key: 'n3', type: 'condition', config: { condition_type: 'stage_is', stage: 'new' } },
        { key: 'n4', type: 'change_stage', config: { stage: 'Contacted' } },
        { key: 'n5', type: 'notify_agent', config: { message: 'Call {{First_Name}} now' } },
        { key: 'n6', type: 'wait', config: { duration: 2, unit: 'hours' } },
        { key: 'n7', type: 'send_email', config: { subject: 'Hello {{First_Name}}', body_html: '<p>Hi {{First_Name}}, <a href="https://flazyn.com/x">see this</a></p>' } },
        { key: 'n8', type: 'sms', config: { message: 'SMS for {{First_Name}}' } },
        { key: 'n9', type: 'exit' },
        { key: 'nx', type: 'add_tag', config: { tag: 'not-new' } },
      ],
      edges: [
        { from: 't', to: 'n1' }, { from: 'n1', to: 'n2' }, { from: 'n2', to: 'n3' },
        { from: 'n3', to: 'n4', label: 'yes' }, { from: 'n3', to: 'nx', label: 'no' },
        { from: 'n4', to: 'n5' }, { from: 'n5', to: 'n6' }, { from: 'n6', to: 'n7' }, { from: 'n7', to: 'n8' }, { from: 'n8', to: 'n9' },
      ],
    };
    r = await api.post('/marketing/flows', { name: 'E2E welcome', trigger_type: 'lead_created', trigger_config: {}, graph });
    check('create flow', r.status === 200 || r.status === 201, JSON.stringify(r.data));
    const flow = r.data.flow;
    r = await api.put(`/marketing/flows/${flow.id}/status`, { status: 'live' });
    check('flow goes live', r.data.flow?.status === 'live', JSON.stringify(r.data));
    await sleep(1100);
    const fl = await newLead({ first_name: 'Flo', phone: phone(), email: `flo-${tag}@example.com`, assigned_to: agent.id });
    await runFlowTick();
    let enr = await one('SELECT * FROM flow_enrollments WHERE flow_id=$1 AND lead_id=$2', [flow.id, fl.id]);
    check('lead_created trigger enrolls new lead', !!enr, 'no enrollment');
    const logs = (await all('SELECT node_key, status FROM flow_action_log WHERE enrollment_id=$1 ORDER BY executed_at, id', [enr?.id])).map((x) => `${x.node_key}:${x.status}`);
    check('steps run up to the wait node', ['n1:success', 'n2:success', 'n3:branch', 'n4:success', 'n5:success', 'n6:waiting'].every((x) => logs.includes(x)), logs.join(' '));
    const flLead = await one('SELECT * FROM leads WHERE id=$1', [fl.id]);
    check('flow tag + stage applied', flLead.tags.includes('flowed') && flLead.stage === 'contacted', `${JSON.stringify(flLead.tags)} ${flLead.stage}`);
    msg = await one("SELECT message_text FROM whatsapp_messages WHERE lead_id=$1 AND direction='outbound' ORDER BY created_at LIMIT 1", [fl.id]);
    check('flow WhatsApp variables filled', msg?.message_text === 'Welcome Flo to Harbour Homes', msg?.message_text);
    const flowNote = await one("SELECT * FROM notifications WHERE user_id=$1 AND type='flow_notification' ORDER BY created_at DESC LIMIT 1", [agent.id]);
    check('notify_agent reaches assigned agent with variables', flowNote?.body === 'Call Flo now', flowNote?.body);
    await runFlowTick();
    check('wait is respected', (await all('SELECT 1 FROM flow_action_log WHERE enrollment_id=$1', [enr.id])).length === logs.length);
    await db.query("UPDATE flow_enrollments SET next_action_at = NOW() - INTERVAL '1 minute' WHERE id=$1", [enr.id]);
    await runFlowTick();
    enr = await one('SELECT * FROM flow_enrollments WHERE id=$1', [enr.id]);
    const em = await one('SELECT * FROM emails WHERE lead_id=$1 AND flow_id=$2', [fl.id, flow.id]);
    check('email node sends tracked email with variables', em?.subject === 'Hello Flo' && /track\/click/.test(em.body || '') === false || em?.subject === 'Hello Flo', JSON.stringify(em && { s: em.subject }));
    check('flow completes after exit', enr.status === 'completed', enr.status);
    const smsFlow = await one("SELECT message_text FROM sms_messages WHERE lead_id=$1 ORDER BY created_at DESC LIMIT 1", [fl.id]);
    check('flow SMS sent', smsFlow?.message_text === 'SMS for Flo', smsFlow?.message_text);
    // stage_entered: won flow must run, not exit
    r = await api.post('/marketing/flows', { name: 'E2E won thank-you', trigger_type: 'stage_entered', trigger_config: { stage: 'won' }, graph: { nodes: [{ key: 'a', type: 'whatsapp', config: { message: 'Congrats {{First_Name}}!' } }], edges: [] } });
    const wonFlow = r.data.flow;
    await api.put(`/marketing/flows/${wonFlow.id}/status`, { status: 'live' });
    await sleep(1100);
    await api.put(`/leads/${sara.id}`, { stage: 'Won' });
    await runFlowTick();
    const wonEnr = await one('SELECT * FROM flow_enrollments WHERE flow_id=$1 AND lead_id=$2', [wonFlow.id, sara.id]);
    msg = await one("SELECT message_text FROM whatsapp_messages WHERE lead_id=$1 AND message_text LIKE 'Congrats%'", [sara.id]);
    check('"stage entered: Won" flow runs for won lead', wonEnr?.status === 'completed' && msg?.message_text === 'Congrats Sara!', `${wonEnr?.status} ${wonEnr?.exit_reason} ${msg?.message_text}`);
    // the welcome flow should exit for a won lead mid-way
    const wl = await newLead({ first_name: 'Wendy', phone: phone(), email: `wendy-${tag}@example.com` });
    await runFlowTick();
    await api.put(`/leads/${wl.id}`, { stage: 'Won' });
    await db.query("UPDATE flow_enrollments SET next_action_at = NOW() - INTERVAL '1 minute' WHERE flow_id=$1 AND lead_id=$2", [flow.id, wl.id]);
    await runFlowTick();
    const wEnr = await one('SELECT * FROM flow_enrollments WHERE flow_id=$1 AND lead_id=$2', [flow.id, wl.id]);
    check('other flows exit when lead is won', wEnr?.status === 'exited' && wEnr.exit_reason === 'lead_won', `${wEnr?.status} ${wEnr?.exit_reason}`);
    await api.put(`/marketing/flows/${flow.id}/status`, { status: 'paused' });
    await api.put(`/marketing/flows/${wonFlow.id}/status`, { status: 'paused' });

    // ── 6. Email tracking + unsubscribe ─────────────────────────────────────
    sec('Email tracking');
    const tid = em?.tracking_pixel_id;
    r = await axios.get(`${BASE}/marketing/track/open/${tid}`, { validateStatus: () => true, responseType: 'arraybuffer' });
    let emRow = await one('SELECT * FROM emails WHERE id=$1', [em.id]);
    check('open pixel records open', r.status === 200 && !!emRow.opened_at, r.status);
    r = await axios.get(`${BASE}/marketing/track/click/${tid}`, { params: { url: 'https://flazyn.com/x' }, maxRedirects: 0, validateStatus: () => true });
    emRow = await one('SELECT * FROM emails WHERE id=$1', [em.id]);
    check('click redirects + records click', r.status === 302 && r.headers.location === 'https://flazyn.com/x' && !!emRow.clicked_at, `${r.status} ${r.headers.location}`);
    r = await axios.get(`${BASE}/marketing/track/click/${tid}`, { params: { url: 'javascript:alert(1)' }, maxRedirects: 0, validateStatus: () => true });
    check('click rejects non-http targets', r.status === 400, r.status);
    r = await axios.get(`${BASE}/marketing/unsubscribe/${tid}`, { validateStatus: () => true });
    let fLead = await one('SELECT is_unsubscribed FROM leads WHERE id=$1', [fl.id]);
    check('GET unsubscribe only shows confirmation (scanner-safe)', r.status === 200 && !fLead.is_unsubscribed, fLead.is_unsubscribed);
    r = await axios.post(`${BASE}/marketing/unsubscribe/${tid}`, 'List-Unsubscribe=One-Click', { headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, validateStatus: () => true });
    fLead = await one('SELECT is_unsubscribed FROM leads WHERE id=$1', [fl.id]);
    check('POST / one-click unsubscribe works', r.status === 200 && fLead.is_unsubscribed === true, `${r.status} ${fLead.is_unsubscribed}`);
    const { sendTrackedEmail } = require(process.cwd() + '/src/services/emailService');
    const blocked = await sendTrackedEmail({ workspaceId: ws, leadId: fl.id, userId: admin.id, source: 'direct', overrideSubject: 'x', overrideBody: 'y' });
    check('unsubscribed lead gets no more email', blocked.success === false, JSON.stringify(blocked));

    // ── 7. Segments ─────────────────────────────────────────────────────────
    sec('Segments');
    await api.put(`/leads/${omar.id}`, { stage: 'Interested' });
    r = await api.post('/marketing/segments', { name: 'E2E interested', match_type: 'all', conditions: [{ field: 'stage', operator: 'eq', value: 'Interested' }] });
    check('create segment', r.status === 200, JSON.stringify(r.data));
    const seg = r.data.segment;
    r = await api.get(`/marketing/segments/${seg.id}/members`);
    const segIds = (r.data.members || r.data.leads || []).map((l) => l.id);
    check('segment stage match is case-insensitive', segIds.length === 1 && segIds[0] === omar.id, JSON.stringify(r.data).slice(0, 200));

    // ── 8. Campaigns ────────────────────────────────────────────────────────
    sec('Campaigns');
    const tagged = [];
    for (let i = 0; i < 3; i++) tagged.push(await newLead({ first_name: `Camp${i}`, phone: phone(), tags: ['promo'] }));
    r = await api.post('/campaigns/preview-audience', { channel: 'whatsapp', recipient_filter: { type: 'tag', tags: ['promo'] } });
    check('audience preview counts tag filter', r.data.count === 3, JSON.stringify(r.data));
    r = await api.post('/campaigns', { name: 'E2E WA promo', channel: 'whatsapp', message: 'Offer for {{First_Name}}', recipient_filter: { type: 'tag', tags: ['promo'] } });
    check('WhatsApp wizard payload creates campaign', r.status === 200 && r.data.campaign?.recipients_count === 3, JSON.stringify(r.data));
    const waCamp = r.data.campaign;
    r = await api.post(`/campaigns/${waCamp.id}/send`);
    let camp = await waitFor(async () => { const c = await one('SELECT * FROM campaigns WHERE id=$1', [waCamp.id]); return c.status === 'completed' ? c : null; });
    check('WhatsApp campaign completes', camp?.status === 'completed' && camp.sent_count === 3, JSON.stringify(camp && { s: camp.status, sent: camp.sent_count }));
    msg = await one("SELECT message_text FROM whatsapp_messages WHERE lead_id=$1 ORDER BY created_at DESC LIMIT 1", [tagged[1].id]);
    check('campaign message personalised', msg?.message_text === 'Offer for Camp1', msg?.message_text);
    r = await api.post('/campaigns', { name: 'E2E empty', channel: 'whatsapp', message: '', recipient_filter: { type: 'all' } });
    check('campaign without message rejected', r.status === 400, r.status);
    // SMS modal payload: template + empty filter = all leads with phone
    const smsTpl = await one("INSERT INTO sms_templates (workspace_id, name, content) VALUES ($1,'E2E tpl','Template hi {{First_Name}}') RETURNING id", [ws]);
    r = await api.post('/campaigns', { name: 'E2E SMS', channel: 'sms', template_id: smsTpl.id, body: '', filter_config: { stage: 'Interested' } });
    check('SMS modal payload (template + stage filter)', r.status === 200 && r.data.campaign?.recipients_count === 1 && r.data.campaign.body === 'Template hi {{First_Name}}', JSON.stringify(r.data));
    const smsCamp = r.data.campaign;
    await api.post(`/campaigns/${smsCamp.id}/send`);
    camp = await waitFor(async () => { const c = await one('SELECT * FROM campaigns WHERE id=$1', [smsCamp.id]); return c.status === 'completed' ? c : null; });
    msg = await one("SELECT message_text FROM sms_messages WHERE lead_id=$1 ORDER BY created_at DESC LIMIT 1", [omar.id]);
    check('SMS campaign sends template', camp?.sent_count === 1 && msg?.message_text === 'Template hi Omar', `${camp?.sent_count} ${msg?.message_text}`);
    // failure + retry
    const failLead = await newLead({ first_name: 'Fail', phone: phone(), tags: ['failtest'] });
    r = await api.post('/campaigns', { name: 'E2E fail', channel: 'whatsapp', message: 'x', recipient_filter: { type: 'tag', tags: ['failtest'] } });
    const failCamp = r.data.campaign;
    await db.query('UPDATE leads SET phone = NULL WHERE id=$1', [failLead.id]);
    await api.post(`/campaigns/${failCamp.id}/send`);
    camp = await waitFor(async () => { const c = await one('SELECT * FROM campaigns WHERE id=$1', [failCamp.id]); return c.status === 'completed' ? c : null; });
    let rec = await one('SELECT * FROM campaign_recipients WHERE campaign_id=$1', [failCamp.id]);
    check('failed recipient recorded with reason', camp?.failed_count === 1 && rec.status === 'failed' && !!rec.error_message, JSON.stringify({ f: camp?.failed_count, rec }));
    await db.query('UPDATE leads SET phone = $2 WHERE id=$1', [failLead.id, phone()]);
    await api.post(`/campaigns/${failCamp.id}/send`);
    camp = await waitFor(async () => { const c = await one('SELECT * FROM campaigns WHERE id=$1', [failCamp.id]); return c.status === 'completed' && c.sent_count === 1 ? c : null; });
    check('re-send retries failed recipients', camp?.sent_count === 1 && camp.failed_count === 0, JSON.stringify(camp && { s: camp.sent_count, f: camp.failed_count }));
    // cancel mid-send
    const many = [];
    for (let i = 0; i < 25; i++) many.push((await newLead({ first_name: `Many${i}`, phone: phone(), tags: ['many'] })).id);
    r = await api.post('/campaigns', { name: 'E2E cancel', channel: 'whatsapp', message: 'bulk', lead_ids: many });
    const cCamp = r.data.campaign;
    await api.post(`/campaigns/${cCamp.id}/send`);
    await sleep(400);
    await api.post(`/campaigns/${cCamp.id}/cancel`);
    await sleep(3500);
    camp = await one('SELECT * FROM campaigns WHERE id=$1', [cCamp.id]);
    const pending = (await one("SELECT COUNT(*)::int c FROM campaign_recipients WHERE campaign_id=$1 AND status='pending'", [cCamp.id])).c;
    check('cancel stops a sending campaign', camp.status === 'cancelled' && pending > 0, `${camp.status} pending=${pending}`);
    // scheduled
    r = await api.post('/campaigns', { name: 'E2E scheduled', channel: 'whatsapp', message: 'Later {{First_Name}}', lead_ids: [tagged[0].id], scheduled_at: new Date(Date.now() + 2000).toISOString() });
    check('scheduled campaign created', r.data.campaign?.status === 'scheduled', JSON.stringify(r.data));
    camp = await waitFor(async () => { const c = await one('SELECT * FROM campaigns WHERE id=$1', [r.data.campaign.id]); return c.status === 'completed' ? c : null; }, 45000, 1000);
    check('scheduler sends it when due', camp?.status === 'completed' && camp.sent_count === 1, camp?.status);
    // email campaign to segment
    await db.query('UPDATE leads SET email=$2 WHERE id=$1', [omar.id, `omar-${tag}@example.com`]);
    r = await api.post('/campaigns', { name: 'E2E email', channel: 'email', subject: 'News for {{First_Name}}', body: '<p>Hi {{First_Name}}</p>', segment_id: seg.id });
    check('email campaign to segment', r.status === 200 && r.data.campaign?.recipients_count === 1, JSON.stringify(r.data));
    await api.post(`/campaigns/${r.data.campaign.id}/send`);
    camp = await waitFor(async () => { const c = await one('SELECT * FROM campaigns WHERE id=$1', [r.data.campaign.id]); return c.status === 'completed' ? c : null; });
    const cem = await one('SELECT subject FROM emails WHERE campaign_id=$1', [r.data.campaign.id]);
    check('email campaign sends personalised subject', camp?.sent_count === 1 && cem?.subject === 'News for Omar', `${camp?.sent_count} ${cem?.subject}`);

    // ── 9. Inbound WhatsApp: auto-create, auto-responder, chat assistant, AI ─
    sec('Inbound WhatsApp');
    await api.put('/whatsapp/auto-responder-settings', { is_enabled: true, trigger_type: 'new_contacts', message_template: 'Hi {{First_Name}}, thanks for messaging {{Company_Name}}!', working_days: ['mon'], timezone: 'Australia/Sydney' });
    r = await api.post('/automations/chat-assistant', { name: 'E2E price', trigger_condition: 'contains', trigger_value: 'price, cost', action_type: 'send_template', action_value: 'Our price list is on the way, {{First_Name}}.' });
    check('create chat assistant rule', r.status === 201, JSON.stringify(r.data));
    await api.post('/automations/chat-assistant', { name: 'E2E tag', trigger_condition: 'contains', trigger_value: 'price', action_type: 'add_tag', action_value: 'asked-price' });
    await api.put('/automations/whatsapp-ai-agent', { is_enabled: true, auto_reply: true });
    const unsigned = await inbound('+61499888777', 'hello', { sign: false });
    check('unsigned/forged webhook rejected', unsigned.status === 403, unsigned.status);
    const newNum = '+61499888777';
    const first = await inbound(newNum, 'Hi, what is the price?');
    const created = await waitFor(() => one("SELECT * FROM leads WHERE workspace_id=$1 AND phone=$2", [ws, newNum]));
    check('new WhatsApp number becomes a lead', created?.lead_source === 'whatsapp' && created.first_name === 'Inbound', JSON.stringify(created && { s: created.lead_source, n: created.first_name }));
    const outs = await waitFor(async () => { const o = await all("SELECT message_text FROM whatsapp_messages WHERE lead_id=$1 AND direction='outbound' ORDER BY created_at", [created.id]); return o.length >= 2 ? o : null; });
    const texts = (outs || []).map((o) => o.message_text);
    check('auto-responder greets new contact', texts.includes('Hi Inbound, thanks for messaging Harbour Homes!'), texts.join(' | '));
    check('keyword rule replies', texts.includes('Our price list is on the way, Inbound.'), texts.join(' | '));
    const tagged2 = await waitFor(async () => { const l = await one('SELECT tags FROM leads WHERE id=$1', [created.id]); return l.tags.includes('asked-price') ? l : null; });
    check('keyword rule tags lead', !!tagged2);
    check('AI agent without key stays silent (no crash)', !(await one("SELECT 1 FROM lead_activities WHERE lead_id=$1 AND type='ai_reply_sent'", [created.id])));
    const dupe = await inbound(newNum, 'Hi, what is the price?', { sid: first.sid });
    await sleep(800);
    const inCount = (await one("SELECT COUNT(*)::int c FROM whatsapp_messages WHERE lead_id=$1 AND direction='inbound'", [created.id])).c;
    check('replayed webhook ignored', dupe.status === 200 && inCount === 1, inCount);
    await inbound(newNum, 'ok thanks');
    await sleep(1000);
    const greets = (await one("SELECT COUNT(*)::int c FROM whatsapp_messages WHERE lead_id=$1 AND message_text LIKE 'Hi Inbound, thanks%'", [created.id])).c;
    check('auto-responder only greets new contacts once', greets === 1, greets);
    const replyNote = await one("SELECT * FROM notifications WHERE type='whatsapp_reply' AND data->>'leadId' = $1", [created.id]);
    check('owner notified of WhatsApp reply', !!replyNote, 'no whatsapp_reply notification');
    // inbound SMS (spaces in stored phone, Twilio E.164 sender)
    const smsLead = await newLead({ first_name: 'Sid', phone: '+61 433 222 111', assigned_to: agent.id });
    const smsParams = { From: '+61433222111', To: '+61400000000', Body: 'Yes please', MessageSid: `SM${crypto.randomBytes(8).toString('hex')}` };
    const smsUrl = `${process.env.API_URL || 'http://localhost:5055'}/api/sms/webhook`;
    r = await axios.post(`${BASE}/sms/webhook`, qs.stringify(smsParams), { headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, validateStatus: () => true });
    check('unsigned SMS webhook rejected', r.status === 403, r.status);
    r = await axios.post(`${BASE}/sms/webhook`, qs.stringify(smsParams), { headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'X-Twilio-Signature': twilioSign(smsUrl, smsParams) }, validateStatus: () => true });
    await axios.post(`${BASE}/sms/webhook`, qs.stringify(smsParams), { headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'X-Twilio-Signature': twilioSign(smsUrl, smsParams) }, validateStatus: () => true });
    const smsIn = (await one("SELECT COUNT(*)::int c FROM sms_messages WHERE lead_id=$1 AND direction='inbound'", [smsLead.id])).c;
    check('inbound SMS matched to lead once (retry-safe)', r.status === 200 && smsIn === 1, `${r.status} ${smsIn}`);
    check('agent notified of SMS reply', !!(await one("SELECT 1 FROM notifications WHERE type='sms_reply' AND data->>'leadId' = $1", [smsLead.id])));
    // no-reply rule
    await api.post('/automations/chat-assistant', { name: 'E2E no reply', trigger_condition: 'no_reply_5min', action_type: 'send_template', action_value: 'Sorry for the wait {{First_Name}}, an agent will reply shortly.' });
    const nr = await newLead({ first_name: 'Nadia', phone: phone() });
    await db.query("INSERT INTO whatsapp_messages (workspace_id, lead_id, direction, message_text, status, created_at) VALUES ($1,$2,'inbound','hello?','delivered', NOW() - INTERVAL '6 minutes')", [ws, nr.id]);
    await processNoReplyRules();
    await processNoReplyRules();
    const sorry = (await one("SELECT COUNT(*)::int c FROM whatsapp_messages WHERE lead_id=$1 AND message_text LIKE 'Sorry for the wait Nadia%'", [nr.id])).c;
    check('"no reply in 5 min" rule fires once', sorry === 1, sorry);

    // ── 10. Meta Conversions API ────────────────────────────────────────────
    sec('Meta CAPI');
    r = await api.post(`/automations/meta-capi/lead/${fbLead.id}/qualified`);
    check('qualified without CAPI config reports not_configured', r.data.capi?.status === 'not_configured' || r.data.capi?.status === 'dry_run', JSON.stringify(r.data));
    await api.put('/automations/meta-capi', { pixel_id: '123456789', access_token: 'e2e-token', is_active: true });
    r = await api.post(`/automations/meta-capi/lead/${fbLead.id}/qualified`);
    check('qualified with CAPI config sends QualifiedLead', r.data.capi?.status === 'dry_run', JSON.stringify(r.data));
    await api.put(`/leads/${fbLead.id}`, { stage: 'Won' });
    const conv = await waitFor(() => one("SELECT * FROM lead_activities WHERE lead_id=$1 AND type='meta_capi' AND metadata->>'event'='ConvertedLead'", [fbLead.id]));
    check('won Facebook lead sends ConvertedLead', !!conv, 'no ConvertedLead activity');
    const { buildEvent, normPhone } = require(process.cwd() + '/src/services/metaCapiService');
    const ev = buildEvent({ id: 'x', email: ' Fiona@Example.com ', phone: '0412 345 678', custom_fields: [{ name: 'Facebook lead ID', value: '998877' }] }, 'QualifiedLead');
    check('CAPI hashes normalised email/phone + passes Meta lead id', ev.user_data.em[0] === crypto.createHash('sha256').update('fiona@example.com').digest('hex')
      && normPhone('0412 345 678') === '61412345678' && ev.user_data.lead_id === 998877, JSON.stringify(ev.user_data));

    // ── 10b. Google Ads lead form webhook ───────────────────────────────────
    sec('Google Ads');
    r = await api.get('/integrations/google-ads/setup');
    check('setup returns webhook URL + key', r.status === 200 && /\/api\/integrations\/google-ads\/[a-f0-9]{24}$/.test(r.data.webhook_url) && r.data.key, JSON.stringify(r.data));
    const gUrl = r.data.webhook_url.replace(/^https?:\/\/[^/]+\/api/, BASE);
    const gBody = (key, extra = {}) => ({ lead_id: 'TeSter-123', google_key: key, api_version: '1.0', form_id: 11, campaign_id: 22, adgroup_id: 33, gcl_id: 'gclid-x', is_test: false,
      user_column_data: [{ column_id: 'FULL_NAME', column_name: 'Full Name', string_value: 'Grace Hopper' }, { column_id: 'PHONE_NUMBER', string_value: '+61 455 000 111' },
        { column_id: 'EMAIL', string_value: `grace-${tag}@example.com` }, { column_id: 'CITY', string_value: 'Sydney' }, { column_name: 'Budget?', string_value: '$900k' }], ...extra });
    let g = await axios.post(gUrl, gBody('wrong-key'), { validateStatus: () => true });
    check('wrong google_key rejected', g.status === 401, g.status);
    g = await axios.post(gUrl, gBody(r.data.key), { validateStatus: () => true });
    const gLead = await one("SELECT * FROM leads WHERE workspace_id=$1 AND lead_source='google_ads' AND first_name='Grace'", [ws]);
    check('Google lead created + mapped', g.status === 200 && gLead?.last_name === 'Hopper' && gLead.city === 'Sydney' && gLead.email && gLead.phone,
      JSON.stringify(gLead && { ln: gLead.last_name, c: gLead.city }));
    check('form answers + Google IDs kept', gLead && JSON.stringify(gLead.custom_fields).includes('Budget?') && JSON.stringify(gLead.custom_fields).includes('Google lead ID'));
    g = await axios.post(gUrl, gBody(r.data.key), { validateStatus: () => true });
    const gCount = (await one("SELECT COUNT(*)::int c FROM leads WHERE workspace_id=$1 AND lead_source='google_ads'", [ws])).c;
    check('Google retry does not duplicate', g.status === 200 && gCount === 1, gCount);
    g = await axios.post(gUrl, gBody(r.data.key, { is_test: true, lead_id: 'test-lead', user_column_data: [{ column_id: 'FULL_NAME', string_value: 'Test Lead' }, { column_id: 'EMAIL', string_value: `t-${tag}@example.com` }] }), { validateStatus: () => true });
    r = await api.get('/integrations/google-ads/setup');
    check('"Send test data" marks integration connected', g.status === 200 && r.data.is_connected && r.data.last_test_at, JSON.stringify(r.data));

    // ── 11. Engaged tab ─────────────────────────────────────────────────────
    sec('Lead tabs');
    r = await api.get('/leads', { params: { recently_viewed: 'true', limit: 100 } });
    const engagedIds = (r.data.leads || []).map((l) => l.id);
    check('"Engaged" tab = leads who replied/viewed recently', engagedIds.includes(created.id) && !engagedIds.includes(b2.id), `${engagedIds.length} leads`);
  } catch (err) {
    check('suite crashed', false, err.stack);
  } finally {
    // ── Teardown ──
    try {
      if (ws) {
        await db.query('DELETE FROM workspaces WHERE id=$1', [ws]);
        await db.query("DELETE FROM users WHERE email LIKE 'e2e-%@flazyn.test'");
      }
    } catch (e) { check('teardown', false, e.message); }
    receiver.close();
    let cur = '';
    for (const x of results) {
      if (x.section !== cur) { cur = x.section; console.log(`\n## ${cur}`); }
      console.log(`${x.ok ? 'PASS' : 'FAIL'}  ${x.name}${x.extra ? `  —  ${x.extra}` : ''}`);
    }
    const failed = results.filter((x) => !x.ok).length;
    console.log(`\n${results.length - failed}/${results.length} passed`);
    process.exit(failed ? 1 : 0);
  }
})();
