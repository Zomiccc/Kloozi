// "Request an update", per-workspace WhatsApp connection and Facebook
// auto switch-on tests (dry-run server on :5055, see test-automations.js).
// Uses a throwaway workspace that is deleted at the end; nothing is really sent.
require('dotenv').config({ path: `${process.cwd()}/.env` });
const axios = require('axios');
const jwt = require('jsonwebtoken');
const db = require(`${process.cwd()}/src/config/database`);
const updateRequests = require(`${process.cwd()}/src/services/updateRequestService`);
const waConnection = require(`${process.cwd()}/src/services/whatsappConnection`);
const { matchPage } = require(`${process.cwd()}/src/services/facebookPartnerService`);

const BASE = 'http://localhost:5055/api';
const results = [];
const check = (name, ok, extra = '') => results.push({ name, ok: !!ok, extra: ok ? '' : String(extra).slice(0, 300) });
const one = async (q, p = []) => (await db.query(q, p)).rows[0];

(async () => {
  let ws;
  const tag = Date.now();
  try {
    ws = (await one(`INSERT INTO workspaces (name, slug, plan, subscription_status) VALUES ('Team E2E Realty', $1, 'pro', 'active') RETURNING id`, [`team-${tag}`])).id;
    const mk = (first, role) => one(`INSERT INTO users (workspace_id, email, password_hash, first_name, last_name, role, status) VALUES ($1,$2,'x',$3,'Test',$4,'active') RETURNING *`, [ws, `team-${first.toLowerCase()}-${tag}@flazyn.test`, first, role]);
    const admin = await mk('Hassan', 'admin');
    const agent = await mk('Sara', 'agent');
    const tok = (u) => jwt.sign({ userId: u.id, workspaceId: u.workspace_id, role: u.role }, process.env.JWT_SECRET, { expiresIn: '1h' });
    const aapi = axios.create({ baseURL: BASE, headers: { Authorization: `Bearer ${tok(admin)}` }, validateStatus: () => true });
    const gapi = axios.create({ baseURL: BASE, headers: { Authorization: `Bearer ${tok(agent)}` }, validateStatus: () => true });
    const lead = await one(`INSERT INTO leads (workspace_id, first_name, last_name, phone, stage, assigned_to) VALUES ($1,'Omar','Khan','+61 400 111 222','contacted',$2) RETURNING *`, [ws, agent.id]);
    const unassigned = await one(`INSERT INTO leads (workspace_id, first_name, stage) VALUES ($1,'Nobody','new') RETURNING *`, [ws]);

    // ── Request an update ──
    let r = await aapi.post(`/leads/${unassigned.id}/update-request`, {});
    check('needs an assigned member', r.status === 400 && /Assign/.test(r.data.error), JSON.stringify(r.data));
    r = await gapi.post(`/leads/${lead.id}/update-request`, {});
    check('agents cannot request updates', r.status === 403, r.status);
    r = await aapi.post(`/leads/${lead.id}/update-request`, { note: 'Did they confirm the visit?' });
    check('manager requests an update', r.status === 201 && r.data.request?.requested_by_name === 'Hassan Test' && r.data.request.note === 'Did they confirm the visit?', JSON.stringify(r.data));
    check('assigned member notified', await one(`SELECT 1 FROM notifications WHERE user_id = $1 AND type = 'update_requested' AND title LIKE 'Update requested: Omar%' AND body LIKE '%confirm the visit%'`, [agent.id]));
    check('timeline shows the request', await one(`SELECT 1 FROM lead_activities WHERE lead_id = $1 AND type = 'update_requested'`, [lead.id]));
    r = await aapi.post(`/leads/${lead.id}/update-request`, {});
    check('second tap reuses the open request', r.status === 200 && r.data.already === true, JSON.stringify(r.data));
    r = await gapi.get(`/leads/${lead.id}/update-request`);
    check('member sees the banner data', r.data.request?.assigned_to === agent.id, JSON.stringify(r.data));
    r = await aapi.get('/leads', { params: { limit: 50 } });
    check('pipeline list flags the lead', r.data.leads?.find((l) => l.id === lead.id)?.update_requested === true && r.data.leads.find((l) => l.id === unassigned.id)?.update_requested === false);
    await aapi.post(`/leads/${lead.id}/timeline`, { type: 'note', description: 'Manager note to self' });
    check('requester’s own note does not clear it', (await gapi.get(`/leads/${lead.id}/update-request`)).data.request);
    r = await gapi.post(`/leads/${lead.id}/timeline`, { type: 'call', description: 'Called Omar, visit confirmed for Saturday' });
    check('member logs a call → request cleared', r.status === 201 && (await gapi.get(`/leads/${lead.id}/update-request`)).data.request === null, JSON.stringify(r.data));
    const closed = await one('SELECT * FROM update_requests WHERE lead_id = $1', [lead.id]);
    check('request records who/what cleared it', closed.resolved_by === agent.id && closed.resolved_type === 'call' && /Saturday/.test(closed.resolved_note), JSON.stringify(closed));
    await updateRequests.notifyResolved();
    check('requester told the lead was updated', await one(`SELECT 1 FROM notifications WHERE user_id = $1 AND type = 'update_received' AND body LIKE '%visit confirmed%'`, [admin.id]));
    await updateRequests.notifyResolved();
    check('…only once', Number((await one(`SELECT COUNT(*) c FROM notifications WHERE user_id = $1 AND type = 'update_received'`, [admin.id])).c) === 1);

    await aapi.post(`/leads/${lead.id}/update-request`, {});
    r = await aapi.delete(`/leads/${lead.id}/update-request`);
    check('manager can withdraw', r.data.cleared === true && (await gapi.get(`/leads/${lead.id}/update-request`)).data.request === null, JSON.stringify(r.data));

    await aapi.post(`/leads/${lead.id}/update-request`, {});
    await db.query(`UPDATE update_requests SET created_at = NOW() - INTERVAL '5 hours' WHERE lead_id = $1 AND resolved_at IS NULL`, [lead.id]);
    await updateRequests.remindStale();
    check('reminder after 4 hours', await one(`SELECT 1 FROM notifications WHERE user_id = $1 AND title LIKE 'Still waiting: update on Omar%'`, [agent.id]));
    await aapi.delete(`/leads/${lead.id}/update-request`);

    // automatic requests on idle leads
    const idle = await one(`INSERT INTO leads (workspace_id, first_name, stage, assigned_to, created_at) VALUES ($1,'Idle','interested',$2, NOW() - INTERVAL '10 days') RETURNING *`, [ws, agent.id]);
    const wonIdle = await one(`INSERT INTO leads (workspace_id, first_name, stage, assigned_to, created_at) VALUES ($1,'Closed','Won',$2, NOW() - INTERVAL '10 days') RETURNING *`, [ws, agent.id]);
    r = await aapi.put('/analytics/workspace-settings', { auto_update_request_days: 0 });
    await updateRequests.autoRequestStale();
    check('auto requests off when set to 0', !(await one('SELECT 1 FROM update_requests WHERE lead_id = $1', [idle.id])));
    r = await aapi.put('/analytics/workspace-settings', { auto_update_request_days: 3 });
    await updateRequests.autoRequestStale();
    const auto = await one('SELECT * FROM update_requests WHERE lead_id = $1', [idle.id]);
    check('idle assigned lead gets an automatic request', auto?.auto === true && auto.resolved_at === null, JSON.stringify(auto));
    check('won leads are left alone', !(await one('SELECT 1 FROM update_requests WHERE lead_id = $1', [wonIdle.id])));
    check('member notified about idle lead', await one(`SELECT 1 FROM notifications WHERE user_id = $1 AND body LIKE 'No calls, notes or messages on Idle%'`, [agent.id]));
    await updateRequests.autoRequestStale();
    check('no duplicate automatic request', Number((await one('SELECT COUNT(*) c FROM update_requests WHERE lead_id = $1', [idle.id])).c) === 1);
    r = await gapi.get(`/leads/${idle.id}/update-request`);
    check('automatic request shows as “by Flazyn”', r.data.request?.requested_by_name === 'Flazyn', JSON.stringify(r.data));
    await gapi.post(`/leads/${idle.id}/timeline`, { type: 'note', description: 'Still deciding' });
    check('any member update clears an automatic request', (await gapi.get(`/leads/${idle.id}/update-request`)).data.request === null);

    // settings form can't flip server-owned keys
    r = await aapi.put('/analytics/workspace-settings', { demo: 'true', whatsapp_phone_number_id: '999', auto_update_request_days: 99 });
    const s = (await one('SELECT settings FROM workspaces WHERE id = $1', [ws])).settings;
    check('settings form cannot set demo/WhatsApp routing', s.demo === undefined && s.whatsapp_phone_number_id === undefined && s.auto_update_request_days === 30, JSON.stringify(s));

    // ── WhatsApp connection ──
    r = await aapi.get('/whatsapp/connection');
    check('connection status (not connected)', r.status === 200 && r.data.connected === false && typeof r.data.shared?.available === 'boolean', JSON.stringify(r.data));
    r = await gapi.post('/whatsapp/connection/shared');
    check('agents cannot connect WhatsApp', r.status === 403, r.status);
    r = await aapi.post('/whatsapp/connection/manual', { phone_number_id: 'abc', access_token: 'short' });
    check('manual connect validates input', r.status === 400, JSON.stringify(r.data));
    const sharedAvailable = !!(process.env.WHATSAPP_PHONE_NUMBER_ID && process.env.WHATSAPP_ACCESS_TOKEN);
    if (sharedAvailable) {
      r = await aapi.post('/whatsapp/connection/shared');
      const st = await one('SELECT settings FROM workspaces WHERE id = $1', [ws]);
      check('one-click Flazyn number', r.status === 200 && r.data.connected && r.data.mode === 'shared' && st.settings.whatsapp_connection === 'shared' && !st.settings.whatsapp_phone_number_id, JSON.stringify(r.data));
      const creds = await waConnection.credentialsFor(ws);
      check('shared mode sends from the platform number', creds.mode === 'platform' && creds.phoneNumberId === process.env.WHATSAPP_PHONE_NUMBER_ID);
      check('shared-number reply routed to this workspace by lead phone', await waConnection.sharedNumberWorkspace('61400111222') === ws);
      r = await aapi.post('/whatsapp/connection/manual', { phone_number_id: '123456789', access_token: 'x'.repeat(40) });
      check('manual connect reports Meta’s refusal', r.status === 400 && /Meta/.test(r.data.error), JSON.stringify(r.data));
      r = await aapi.delete('/whatsapp/connection');
      const after = await aapi.get('/whatsapp/connection');
      check('disconnect', r.status === 200 && after.data.connected === false);
    } else check('shared number configured in .env', false, 'WHATSAPP_PHONE_NUMBER_ID / WHATSAPP_ACCESS_TOKEN missing');

    // ── Facebook auto switch-on: Page matching ──
    const pages = [{ id: '111', name: 'Harbour Homes', username: 'harbourhomesau' }, { id: '222', name: 'Harbour Homes Sydney' }, { id: '333', name: 'Bluegum Realty' }];
    check('match by exact Page name', matchPage({ asset_name: 'harbour homes' }, 'x', pages)?.id === '111');
    check('match by Page link', matchPage({ asset_url: 'https://facebook.com/harbourhomesau' }, 'x', pages)?.id === '111');
    check('match by workspace name when no Page given', matchPage({}, 'Bluegum Realty', pages)?.id === '333');
    check('ambiguous name is left for the team', matchPage({ asset_name: 'Harbour' }, 'Nope', pages) === null);
  } catch (err) {
    check('suite crashed', false, err.stack);
  } finally {
    try {
      if (ws) {
        await db.query('DELETE FROM notifications WHERE workspace_id = $1', [ws]);
        await db.query('DELETE FROM workspaces WHERE id = $1', [ws]);
        await db.query("DELETE FROM users WHERE email LIKE 'team-%@flazyn.test'");
      }
    } catch (e) { check('teardown', false, e.message); }
    for (const x of results) console.log(`${x.ok ? 'PASS' : 'FAIL'}  ${x.name}${x.extra ? `  —  ${x.extra}` : ''}`);
    const failed = results.filter((x) => !x.ok).length;
    console.log(`\n${results.length - failed}/${results.length} passed`);
    process.exit(failed ? 1 : 0);
  }
})();
