// Intelligence feature tests (rules mode, no OpenAI key). Same setup as test-automations.js:
//   PORT=5055 API_URL=http://localhost:5055 MESSAGING_DRY_RUN=true OPENAI_API_KEY= TWILIO_AUTH_TOKEN=e2e-twilio-token node src/server.js
//   API_URL=http://localhost:5055 node scripts/test-intelligence.js
require('dotenv').config({ path: `${process.cwd()}/.env` });
process.env.MESSAGING_DRY_RUN = 'true';
process.env.OPENAI_API_KEY = '';
process.env.TWILIO_AUTH_TOKEN = 'e2e-twilio-token';
const crypto = require('crypto');
const axios = require('axios');
const jwt = require('jsonwebtoken');
const qs = require('querystring');
const db = require(`${process.cwd()}/src/config/database`);

const BASE = 'http://localhost:5055/api';
const results = [];
let section = '';
const sec = (n) => { section = n; };
const check = (name, ok, extra = '') => results.push({ section, name, ok: !!ok, extra: ok ? '' : String(extra).slice(0, 400) });
const one = async (q, p = []) => (await db.query(q, p)).rows[0];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const ago = (h) => new Date(Date.now() - h * 3600000);

(async () => {
  let ws;
  try {
    ws = (await one(`INSERT INTO workspaces (name, slug, plan, subscription_status, settings) VALUES ('Flazyn Intel E2E', $1, 'pro', 'active', $2) RETURNING id`,
      [`intel-${Date.now()}`, JSON.stringify({ whatsapp_number: '+61400000888', company_name: 'Harbour Homes', competitors: ['ABC Realty'] })])).id;
    for (const [i, s] of ['New', 'Contacted', 'Interested', 'Negotiating', 'Won', 'Lost'].entries()) {
      await db.query('INSERT INTO lead_stages (workspace_id, name, sort_order, is_default, is_won, is_lost) VALUES ($1,$2,$3,$4,$5,$6)', [ws, s, i, i === 0, s === 'Won', s === 'Lost']);
    }
    const tag = Date.now();
    const mkUser = async (f, role) => one(`INSERT INTO users (workspace_id, email, password_hash, first_name, last_name, role, status) VALUES ($1,$2,'x',$3,'T',$4,'active') RETURNING *`, [ws, `intel-${f.toLowerCase()}-${tag}@flazyn.test`, f, role]);
    const admin = await mkUser('Ava', 'admin');
    const sam = await mkUser('Sam', 'sales_agent');
    const kai = await mkUser('Kai', 'sales_agent');
    const tok = (u) => jwt.sign({ userId: u.id, workspaceId: ws, role: u.role }, process.env.JWT_SECRET, { expiresIn: '1h' });
    const api = axios.create({ baseURL: BASE, headers: { Authorization: `Bearer ${tok(admin)}` }, validateStatus: () => true });
    let n = 0;
    const lead = async (o) => one(
      `INSERT INTO leads (workspace_id, first_name, last_name, phone, email, lead_source, stage, budget, assigned_to, created_at, updated_at, score)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$10,$11) RETURNING *`,
      [ws, o.first || `H${n}`, o.last || 'Test', o.phone || `+6141${String(tag % 100000).padStart(5, '0')}${String(n++).padStart(3, '0')}`, o.email || null,
        o.source || 'facebook', o.stage || 'new', o.budget || null, o.agent || null, o.created || ago(24 * 20), o.score || 0]);
    const msg = (leadId, dir, text, at) => db.query(`INSERT INTO whatsapp_messages (workspace_id, lead_id, direction, message_text, status, sent_at, created_at) VALUES ($1,$2,$3,$4,'sent',$5,$5)`, [ws, leadId, dir, text, at]);
    const act = (leadId, type, at, meta = {}) => db.query(`INSERT INTO lead_activities (workspace_id, lead_id, type, description, metadata, created_at) VALUES ($1,$2,$3,$4,$5,$6)`, [ws, leadId, type, type, JSON.stringify(meta), at]);

    // History: Sam wins Facebook leads (WhatsApp first), Kai wins Google Ads leads.
    for (let i = 0; i < 6; i += 1) {
      const l = await lead({ source: 'facebook', stage: 'won', budget: 500000, agent: sam.id, created: ago(24 * 30) });
      await act(l.id, 'whatsapp_sent', ago(24 * 30 - 1));
      await msg(l.id, 'inbound', 'Honestly it seems too expensive for us', ago(24 * 29));
      await msg(l.id, 'outbound', `Totally get it. The price includes styling and marketing, which saves you about $8k compared to others. Can I show you the breakdown? (#${i})`, ago(24 * 29 - 1));
      await db.query(`INSERT INTO deal_predictions (workspace_id, lead_id, lead_source, predicted, actual, closed_at) VALUES ($1,$2,'facebook',100000,120000,NOW())`, [ws, l.id]);
    }
    for (let i = 0; i < 4; i += 1) { const l = await lead({ source: 'facebook', stage: 'lost', agent: sam.id }); await act(l.id, 'email_sent', ago(24 * 20 - 1)); }
    for (let i = 0; i < 5; i += 1) { const l = await lead({ source: 'facebook', stage: 'lost', agent: kai.id }); await act(l.id, 'email_sent', ago(24 * 20 - 1)); }
    for (let i = 0; i < 5; i += 1) await lead({ source: 'google_ads', stage: 'won', budget: 300000, agent: kai.id });
    await lead({ source: 'google_ads', stage: 'lost', agent: sam.id });
    await lead({ source: 'google_ads', stage: 'lost', agent: sam.id });

    // ── 1, 2, 15, 16, 19: a hot but risky lead ──
    sec('Lead signals');
    const L = await lead({ first: 'Lara', source: 'facebook', stage: 'negotiating', agent: sam.id, created: ago(10), score: 60 });
    await msg(L.id, 'outbound', 'Hi Lara, thanks for your enquiry!', ago(9));
    await msg(L.id, 'inbound', 'Thanks! I need to check with my wife first. ABC Realty quoted me cheaper. Our budget is around $750k, is the price negotiable?', ago(8.9));
    let r = await api.get(`/intel/leads/${L.id}`);
    const I = r.data;
    check('insights endpoint works', r.status === 200 && I.next_best_action, JSON.stringify(r.data).slice(0, 200));
    check('#2 deal risk flags fast progression + missing decision-maker', I.deal_risk?.score >= 50
      && I.deal_risk.reasons.some((x) => /fast/i.test(x)) && I.deal_risk.reasons.some((x) => /decision-maker/i.test(x)), JSON.stringify(I.deal_risk));
    check('#16 competitor detected with counter-response', I.competitors?.[0]?.competitor === 'ABC Realty' && I.competitors[0].counter, JSON.stringify(I.competitors));
    check('objections detected (price + authority)', ['price', 'authority'].every((k) => I.objections?.some((o) => o.key === k)), JSON.stringify(I.objections));
    check('#19 deal size uses their $750k hint', I.deal_size?.predicted > 600000 && I.deal_size.basis.some((b) => /750,000/.test(b)), JSON.stringify(I.deal_size));
    check('#20 prediction calibrated from past actuals (×1.2)', I.deal_size?.basis.some((b) => /×1\.2/.test(b)), JSON.stringify(I.deal_size?.basis));
    check('#17 sentiment computed', ['positive', 'neutral', 'negative'].includes(I.sentiment?.label), JSON.stringify(I.sentiment));
    check('#15 personality returns a tip', I.personality?.tip, JSON.stringify(I.personality));
    const pred = await one('SELECT predicted FROM deal_predictions WHERE lead_id = $1', [L.id]);
    check('#20 prediction stored for later comparison', Number(pred?.predicted) === I.deal_size.predicted, JSON.stringify(pred));

    // ── 1: next best action from history ──
    sec('Next best action');
    const N = await lead({ first: 'Nina', source: 'facebook', stage: 'new', agent: sam.id, created: ago(0.2) });
    r = await api.get(`/intel/leads/${N.id}`);
    check('#1 new Facebook lead → WhatsApp (what worked historically)', r.data.next_best_action?.channel === 'whatsapp' && /%/.test(r.data.next_best_action.why.join(' ')), JSON.stringify(r.data.next_best_action));
    await db.query(`INSERT INTO engagement_sessions (id, workspace_id, lead_id, channel, total_seconds, started_at, last_seen_at) VALUES ($1,$2,$3,'document',120,NOW(),NOW())`, [crypto.randomBytes(8).toString('hex'), ws, N.id]);
    r = await api.get(`/intel/leads/${N.id}`);
    check('#1 reading your document right now → Call now', r.data.next_best_action?.action === 'Call now', JSON.stringify(r.data.next_best_action));

    // ── 18: best time ──
    sec('Best time');
    const B = await lead({ first: 'Bea', stage: 'contacted', agent: sam.id });
    for (let d = 1; d <= 5; d += 1) {
      const at = new Date(Date.now() - d * 86400000); at.setUTCHours(9, 15, 0, 0); // 19:15 Sydney (AEST)/20:15 (AEDT)
      await msg(B.id, 'outbound', 'Any thoughts?', new Date(at - 3600000));
      await msg(B.id, 'inbound', 'Sorry just saw this, yes keen', at);
    }
    r = await api.get(`/intel/leads/${B.id}`);
    check('#18 learns their usual reply hour', r.data.best_time?.basis === 'this lead' && [19, 20].includes(r.data.best_time.hour) && r.data.best_time.next_at, JSON.stringify(r.data.best_time));

    // ── 10: ghost predictor ──
    sec('Ghost predictor');
    const G = await lead({ first: 'Gus', stage: 'interested', agent: sam.id });
    await msg(G.id, 'outbound', 'Hi Gus!', ago(120));
    await msg(G.id, 'inbound', 'Hi! Yes I am really interested in the 3 bedroom place, can you tell me more about the area, schools and parking?', ago(119.9));
    await msg(G.id, 'outbound', 'Sure, here are the details…', ago(100));
    await msg(G.id, 'inbound', 'Great thanks, could we look at it on the weekend with my partner, maybe Saturday morning?', ago(99.8));
    await msg(G.id, 'outbound', 'Saturday works. 10am?', ago(80));
    await msg(G.id, 'inbound', 'maybe', ago(60));
    await msg(G.id, 'outbound', 'Shall I lock in 10am?', ago(50));
    await msg(G.id, 'inbound', 'ok', ago(30));
    await msg(G.id, 'outbound', 'Great, confirming Saturday 10am. See you there!', ago(26));
    r = await api.get(`/intel/leads/${G.id}`);
    check('#10 ghost risk high (slower + shorter replies)', r.data.ghost?.level === 'high' && r.data.ghost.hours_to_cold !== null, JSON.stringify(r.data.ghost));
    const ops = require(`${process.cwd()}/src/services/intelOps`);
    await ops.runGhostWatch();
    check('#10 agent warned before they go cold', await one(`SELECT 1 FROM notifications WHERE user_id = $1 AND type = 'ghost_warning' AND data->>'leadId' = $2`, [sam.id, G.id]));
    await ops.runGhostWatch();
    check('#10 warning not repeated within 48h', Number((await one(`SELECT COUNT(*) c FROM notifications WHERE type='ghost_warning' AND data->>'leadId' = $1`, [G.id])).c) === 1);

    // ── 7: reactivation radar ──
    sec('Reactivation radar');
    const R = await lead({ first: 'Rita', stage: 'lost', agent: sam.id, created: ago(24 * 40) });
    await db.query(`UPDATE leads SET updated_at = $1 WHERE id = $2`, [ago(24 * 5), R.id]);
    await act(R.id, 'stage_change', ago(24 * 5), { new_stage: 'lost' });
    await msg(R.id, 'inbound', 'Hi, are you still selling that place? We might be ready now', ago(20));
    const radar = await ops.runReactivationRadar();
    const rr = await one('SELECT metadata FROM leads WHERE id = $1', [R.id]);
    check('#7 lost lead with new activity flagged', radar.flagged >= 1 && rr.metadata?.reactivation?.signals?.length, JSON.stringify(radar));
    check('#7 owner notified', await one(`SELECT 1 FROM notifications WHERE user_id = $1 AND type = 'reactivation'`, [sam.id]));
    r = await api.get('/intel/boards');
    check('#7 shows on Insights board', r.data.reactivation?.some((x) => x.id === R.id), JSON.stringify(r.data.reactivation).slice(0, 200));

    // ── 8: smart routing ──
    sec('Smart routing');
    r = await api.put('/intel/routing', { strategy: 'best_fit' });
    check('switch to best-fit routing', r.data.strategy === 'best_fit', JSON.stringify(r.data));
    r = await api.post('/leads', { first_name: 'Gwen', phone: '+61455111222', lead_source: 'google_ads' });
    check('#8 Google Ads lead → Kai (wins Google leads)', r.data.lead?.assigned_to === kai.id, `${r.data.lead?.assigned_to} vs kai ${kai.id}`);
    const why = await one(`SELECT description FROM lead_activities WHERE lead_id = $1 AND type = 'lead_assigned'`, [r.data.lead?.id]);
    check('#8 routing explains why', /smart routing/.test(why?.description || ''), why?.description);
    r = await api.post('/leads', { first_name: 'Finn', phone: '+61455111333', lead_source: 'facebook' });
    check('#8 Facebook lead → Sam (wins Facebook leads)', r.data.lead?.assigned_to === sam.id, r.data.lead?.assigned_to);
    r = await api.get('/intel/routing');
    check('agent strengths listed', r.data.agents?.length === 2 && r.data.agents.every((a) => a.win_rate !== undefined), JSON.stringify(r.data).slice(0, 200));

    // ── 4, 12: co-pilot + reply ──
    sec('Reply suggester + co-pilot');
    r = await api.post('/intel/copilot', { text: 'It is too expensive for us' });
    check('#4 co-pilot finds what worked in won deals', r.data.examples?.length >= 1 && /breakdown/.test(r.data.examples[0].you_replied), JSON.stringify(r.data).slice(0, 300));
    r = await api.post(`/intel/leads/${L.id}/reply`, {});
    check('#12 reply suggested for the conversation', r.status === 200 && r.data.reply?.length > 10 && r.data.copilot, JSON.stringify(r.data).slice(0, 300));

    // ── 9: meeting brief ──
    sec('Meeting briefs');
    r = await api.post(`/intel/leads/${L.id}/brief`);
    check('#9 brief has summary + likely objection', /Lara/.test(r.data.summary) && r.data.likely_objection && r.data.opener, JSON.stringify(r.data).slice(0, 300));
    const fu = await one(`INSERT INTO follow_ups (workspace_id, lead_id, user_id, type, title, due_date, status) VALUES ($1,$2,$3,'call','Price call', NOW() + INTERVAL '30 minutes','pending') RETURNING id`, [ws, L.id, sam.id]);
    await ops.runMeetingBriefs();
    const fuRow = await one('SELECT brief, brief_sent_at FROM follow_ups WHERE id = $1', [fu.id]);
    check('#9 brief auto-sent before a scheduled call', fuRow.brief_sent_at && fuRow.brief?.summary && await one(`SELECT 1 FROM notifications WHERE user_id=$1 AND type='meeting_brief'`, [sam.id]), JSON.stringify(fuRow).slice(0, 200));

    // ── 3: call intelligence ──
    sec('Call intelligence');
    r = await api.post(`/intel/leads/${L.id}/calls/analyze`, { transcript: 'Agent: Hi Lara, thanks for taking the call. I wanted to walk you through the pricing and what is included.\nLead: Honestly it feels too expensive and I need to check with my wife.\nAgent: Totally fair. Shall we set up a time with both of you?\nLead: Ok maybe Thursday.', duration: 240 });
    check('#3 transcript analysed: talk ratio, objections, one-line debrief', r.status === 200 && r.data.analysis?.talk_ratio?.agent > 50 && r.data.analysis.objections.length >= 2 && r.data.analysis.debrief, JSON.stringify(r.data).slice(0, 300));
    const call = await one('SELECT notes, analysis FROM calls WHERE id = $1', [r.data.call_id]);
    check('#3 debrief saved on the call', call?.notes && call.analysis?.debrief, JSON.stringify(call).slice(0, 200));
    r = await api.post(`/intel/leads/${L.id}/calls/analyze`, {});
    check('#3 clear error without audio/transcript', r.status === 400, r.status);

    // ── 13: voice-to-CRM (typed fallback) ──
    sec('Voice-to-CRM');
    r = await api.post(`/intel/leads/${N.id}/voice`, { text: 'Spoke to Nina, she is keen to see the house, call her tomorrow at 3pm. Budget about 600k.' });
    const nAfter = await one('SELECT stage, budget FROM leads WHERE id = $1', [N.id]);
    const nFu = await one(`SELECT due_date FROM follow_ups WHERE lead_id = $1 AND status = 'pending'`, [N.id]);
    check('#13 stage updated from the note', nAfter.stage === 'interested', nAfter.stage);
    check('#13 budget captured', Number(nAfter.budget) === 600000, nAfter.budget);
    check('#13 follow-up created for tomorrow 3pm', nFu && new Date(nFu.due_date).getHours() === 15, JSON.stringify(nFu));
    check('#13 summary saved', r.data.applied?.length === 3 && r.data.summary, JSON.stringify(r.data));

    r = await api.post(`/intel/leads/${L.id}/voice`, { text: 'Just spoke with Lara, they are negotiating on price now, follow up Friday at 11am' });
    check('#13 "negotiating" note moves stage to negotiating', (await one('SELECT stage FROM leads WHERE id = $1', [L.id])).stage === 'negotiating' || r.data.applied?.every((x) => !/Stage/.test(x)), JSON.stringify(r.data));

    // ── 6: talk-to-build flows ──
    sec('Talk-to-build flows');
    r = await api.post('/intel/flows/from-text', { text: 'When a lead comes in from Facebook, send a WhatsApp "Hi {{First_Name}}, thanks for reaching out!", then wait 2 days, then send an email, then tag them as nurtured' });
    const g = r.data.flow?.graph;
    const types = (g?.nodes || []).map((x) => x.type).join(',');
    check('#6 flow built from plain English', r.status === 201 && r.data.flow.trigger_type === 'source_is' && types === 'trigger,whatsapp,wait,send_email,add_tag', `${r.data.flow?.trigger_type} ${types}`);
    check('#6 message + wait kept', /thanks for reaching out/.test(JSON.stringify(g)) && g.nodes.find((x) => x.type === 'wait')?.config.duration === 2, JSON.stringify(g).slice(0, 300));
    const flowId = r.data.flow.id;
    const r2 = await api.post('/intel/flows/from-text', { text: 'When a new Facebook lead arrives, WhatsApp them a friendly hello, wait 1 day, if they have not opened our email then notify the agent' });
    const g2 = r2.data.flow?.graph;
    check('#6 "if not opened" becomes a condition with a "no" branch', g2?.nodes.some((x) => x.type === 'condition') && g2.edges.some((e) => e.label === 'no') && r2.data.flow.trigger_type === 'source_is', JSON.stringify(g2).slice(0, 300));
    r = await api.put(`/marketing/flows/${flowId}/status`, { status: 'live' });
    check('#6 built flow is valid enough to go live', r.data.flow?.status === 'live', JSON.stringify(r.data));

    // ── 5: ad spend quality loop ──
    sec('Ad spend loop');
    const month = new Date().toISOString().slice(0, 7);
    await api.put('/intel/ads/spend', { source: 'facebook', month, amount: 1000 });
    await api.put('/intel/ads/spend', { source: 'google_ads', month, amount: 2000 });
    await db.query(`UPDATE leads SET created_at = NOW() - INTERVAL '2 days' WHERE workspace_id = $1 AND stage = 'won'`, [ws]);
    r = await api.get('/intel/ads');
    const fb = r.data.rows?.find((x) => x.source === 'facebook');
    check('#5 revenue vs spend per source', fb?.spend === 1000 && fb.revenue === 3000000 && fb.roas === 3000, JSON.stringify(fb));
    check('#5 budget recommendation given', r.data.tips?.some((t) => /Move budget|winner/.test(t)), JSON.stringify(r.data.tips));

    // ── 20: won feedback ──
    sec('Prediction feedback loop');
    const W = await lead({ first: 'Will', stage: 'negotiating', budget: 120000, agent: sam.id });
    await db.query(`INSERT INTO deal_predictions (workspace_id, lead_id, lead_source, predicted) VALUES ($1,$2,'facebook',100000)`, [ws, W.id]);
    r = await api.put(`/intel/leads/${W.id}/deal-value`, { deal_value: 130000 });
    await api.put(`/leads/${W.id}`, { stage: 'Won' });
    await sleep(800);
    const wp = await one('SELECT actual, closed_at FROM deal_predictions WHERE lead_id = $1', [W.id]);
    check('#20 actual recorded against prediction on win', Number(wp?.actual) === 130000 && wp.closed_at, JSON.stringify(wp));
    check('#20 gap logged on the lead', await one(`SELECT 1 FROM lead_activities WHERE lead_id = $1 AND type = 'prediction_feedback' AND description LIKE '%+30%%'`, [W.id]));

    // ── 11: autopsy (auto on lost) ──
    sec('Lost deal autopsy');
    const X = await lead({ first: 'Xia', stage: 'interested', agent: sam.id, created: ago(24 * 10) });
    await msg(X.id, 'outbound', 'Hi Xia!', ago(24 * 8));
    await msg(X.id, 'inbound', 'How much is the deposit?', ago(24 * 7.9));
    await msg(X.id, 'outbound', 'Following up', ago(24 * 2));
    await api.put(`/leads/${X.id}`, { stage: 'Lost' });
    await sleep(1200);
    const au = await one(`SELECT metadata FROM lead_activities WHERE lead_id = $1 AND type = 'ai_autopsy'`, [X.id]);
    check('#11 autopsy runs automatically when a deal is lost', au?.metadata?.autopsy?.verdict, JSON.stringify(au).slice(0, 200));
    check('#11 finds slow first reply + unanswered question', /First reply took/.test(JSON.stringify(au?.metadata)) && /not answered/.test(JSON.stringify(au?.metadata)), JSON.stringify(au?.metadata).slice(0, 400));

    // ── 16, 17: inbound hooks + sentiment board ──
    sec('Competitor + sentiment');
    const C = await lead({ first: 'Cal', phone: '+61455999000', stage: 'contacted', agent: sam.id });
    const params = { From: 'whatsapp:+61455999000', To: 'whatsapp:+61400000888', Body: 'Not interested anymore, ABC Realty is cheaper and you are too expensive', MessageSid: `SM${crypto.randomBytes(8).toString('hex')}` };
    const url = `${process.env.API_URL || 'http://localhost:5055'}/api/whatsapp/webhook`;
    const sig = crypto.createHmac('sha1', process.env.TWILIO_AUTH_TOKEN).update(url + Object.keys(params).sort().map((k) => k + params[k]).join('')).digest('base64');
    await axios.post(`${BASE}/whatsapp/webhook`, qs.stringify(params), { headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'X-Twilio-Signature': sig }, validateStatus: () => true });
    await sleep(1500);
    check('#16 competitor mention flagged live', await one(`SELECT 1 FROM lead_activities WHERE lead_id = $1 AND type = 'competitor_mentioned'`, [C.id]));
    check('#16 agent gets counter-response', await one(`SELECT 1 FROM notifications WHERE user_id = $1 AND type = 'competitor' AND body LIKE 'Suggested reply%'`, [sam.id]));
    r = await api.get('/intel/boards');
    check('#17 sentiment board: most negative first', r.data.sentiment?.[0]?.id === C.id && r.data.sentiment[0].label === 'negative', JSON.stringify(r.data.sentiment?.slice(0, 2)));
    check('#2 risk board lists risky deals', r.data.risk?.some((x) => x.id === L.id), JSON.stringify(r.data.risk?.map((x) => x.name)));
    check('#20 accuracy report', r.data.predictions?.closed_with_prediction >= 1 && r.data.predictions.avg_error_pct !== null, JSON.stringify(r.data.predictions).slice(0, 200));
  } catch (err) {
    check('suite crashed', false, err.stack);
  } finally {
    try { if (ws) { await db.query('DELETE FROM workspaces WHERE id = $1', [ws]); await db.query("DELETE FROM users WHERE email LIKE 'intel-%@flazyn.test'"); } } catch (e) { check('teardown', false, e.message); }
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
