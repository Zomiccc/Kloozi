// Managed connections + lead connector tests (dry-run server on :5055, see test-automations.js).
require('dotenv').config({ path: `${process.cwd()}/.env` });
const axios = require('axios');
const jwt = require('jsonwebtoken');
const db = require(`${process.cwd()}/src/config/database`);

const BASE = 'http://localhost:5055/api';
const results = [];
const check = (name, ok, extra = '') => results.push({ name, ok: !!ok, extra: ok ? '' : String(extra).slice(0, 300) });
const one = async (q, p = []) => (await db.query(q, p)).rows[0];

(async () => {
  let ws;
  const tag = Date.now();
  try {
    ws = (await one(`INSERT INTO workspaces (name, slug, plan, subscription_status) VALUES ('Conn E2E Client', $1, 'pro', 'active') RETURNING id`, [`conn-${tag}`])).id;
    for (const [i, s] of ['New', 'Contacted', 'Interested', 'Negotiating', 'Won', 'Lost'].entries()) await db.query('INSERT INTO lead_stages (workspace_id, name, sort_order, is_default, is_won, is_lost) VALUES ($1,$2,$3,$4,$5,$6)', [ws, s, i, i === 0, s === 'Won', s === 'Lost']);
    const client = await one(`INSERT INTO users (workspace_id, email, password_hash, first_name, role, status) VALUES ($1,$2,'x','Cara','admin','active') RETURNING *`, [ws, `conn-client-${tag}@flazyn.test`]);
    const opsEmail = (process.env.PLATFORM_ADMIN_EMAILS || '').split(',')[0].trim();
    const ops = await one('SELECT * FROM users WHERE LOWER(email) = LOWER($1)', [opsEmail]);
    const tok = (u) => jwt.sign({ userId: u.id, workspaceId: u.workspace_id, role: u.role }, process.env.JWT_SECRET, { expiresIn: '1h' });
    const capi = axios.create({ baseURL: BASE, headers: { Authorization: `Bearer ${tok(client)}` }, validateStatus: () => true });
    const oapi = ops ? axios.create({ baseURL: BASE, headers: { Authorization: `Bearer ${tok(ops)}` }, validateStatus: () => true }) : null;

    let r = await capi.get('/connections');
    check('client sees connect info, not team queue', r.status === 200 && r.data.flazyn?.facebook && r.data.is_platform_admin === false, JSON.stringify(r.data));
    r = await capi.get('/connections/admin/all');
    check('client blocked from team queue', r.status === 403, r.status);
    r = await capi.post('/connections', { platform: 'facebook', asset_name: 'Cara Homes Page' });
    check('client clicks "Done, connect it"', r.status === 201 && r.data.request.status === 'requested', JSON.stringify(r.data));
    const reqId = r.data.request.id;
    r = await capi.post('/connections', { platform: 'facebook', asset_name: 'Cara Homes Page' });
    check('clicking again reuses the same request', r.data.request?.id === reqId, JSON.stringify(r.data));

    if (!oapi) check('platform admin user exists for PLATFORM_ADMIN_EMAILS', false, opsEmail);
    else {
      check('team alerted about new request', await one(`SELECT 1 FROM notifications WHERE user_id = $1 AND type = 'connection_request' AND data->>'requestId' = $2`, [ops.id, reqId]));
      r = await oapi.get('/connections/admin/all');
      const row = r.data.requests?.find((x) => x.id === reqId);
      check('team queue lists it with the client lead link', row && /\/api\/integrations\/connect\/[a-f0-9]{32}\/facebook$/.test(row.lead_link), JSON.stringify(row).slice(0, 300));
      r = await oapi.post(`/connections/admin/${reqId}/test`);
      check('team test lead lands in client pipeline (tagged test)', r.status === 200 && await one(`SELECT 1 FROM leads WHERE workspace_id = $1 AND tags @> '["facebook-test"]'`, [ws]), JSON.stringify(r.data));
      check('test lead does not mark it connected', (await one('SELECT status FROM connection_requests WHERE id = $1', [reqId])).status === 'requested');
      r = await oapi.put(`/connections/admin/${reqId}`, { status: 'needs_client', message_to_client: 'Please give Flazyn Leads access on the Page' });
      check('team can ask client to fix something', r.data.request?.status === 'needs_client' && await one(`SELECT 1 FROM notifications WHERE user_id = $1 AND type = 'connection_update' AND body LIKE 'Please give Flazyn%'`, [client.id]));
      r = await capi.get('/connections');
      check('client sees the message', r.data.requests?.[0]?.message_to_client === 'Please give Flazyn Leads access on the Page', JSON.stringify(r.data.requests));
      const link = row.lead_link.replace(/^https?:\/\/[^/]+\/api/, BASE);
      // forwarder (Make/Zapier run by the Flazyn team) posts a real Facebook lead
      r = await axios.post(link, { id: 'fb-9988', field_data: [{ name: 'full_name', values: ['Liam Brown'] }, { name: 'phone_number', values: ['+61 455 222 333'] }, { name: 'which_suburb?', values: ['Braddon'] }], campaign_name: 'Spring' }, { validateStatus: () => true });
      const lead = await one(`SELECT * FROM leads WHERE workspace_id = $1 AND first_name = 'Liam'`, [ws]);
      check('real lead created with source + mapping', r.status === 200 && lead?.lead_source === 'facebook' && lead.city === 'Braddon' && JSON.stringify(lead.custom_fields).includes('Facebook campaign'), JSON.stringify(lead && { s: lead.lead_source, c: lead.city }));
      const st = await one('SELECT status, connected_at FROM connection_requests WHERE id = $1', [reqId]);
      check('first real lead flips request to Connected', st.status === 'connected' && st.connected_at, JSON.stringify(st));
      check('client told it is connected', await one(`SELECT 1 FROM notifications WHERE user_id = $1 AND title LIKE '%is connected%'`, [client.id]));
      r = await axios.post(link, { id: 'fb-9988', field_data: [{ name: 'full_name', values: ['Liam Brown'] }] }, { validateStatus: () => true });
      check('repeat delivery ignored', r.data.duplicate === true && Number((await one(`SELECT COUNT(*) c FROM leads WHERE workspace_id = $1 AND first_name = 'Liam'`, [ws])).c) === 1, JSON.stringify(r.data));
      r = await axios.post(link.replace(/[a-f0-9]{32}/, 'bad-token-xxxxxxxxxxxx'), { name: 'X' }, { validateStatus: () => true });
      check('wrong link rejected', r.status === 401, r.status);
      r = await axios.post(link.replace('/facebook', '/linkedin'), { 'First Name': 'Ada', 'Last Name': 'L', 'Email Address': `ada-${tag}@example.com`, 'Company Name': 'Analytical', 'Lead ID': 'li-1' }, { validateStatus: () => true });
      const ada = await one(`SELECT * FROM leads WHERE workspace_id = $1 AND first_name = 'Ada'`, [ws]);
      check('LinkedIn-style fields mapped', ada?.lead_source === 'linkedin' && ada.email && JSON.stringify(ada.custom_fields).includes('Company'), JSON.stringify(ada && ada.custom_fields));
    }
  } catch (err) {
    check('suite crashed', false, err.stack);
  } finally {
    try { if (ws) { await db.query('DELETE FROM workspaces WHERE id = $1', [ws]); await db.query("DELETE FROM users WHERE email LIKE 'conn-client-%@flazyn.test'"); await db.query(`DELETE FROM notifications WHERE type = 'connection_request' AND title LIKE 'Conn E2E Client%'`); } } catch (e) { check('teardown', false, e.message); }
    for (const x of results) console.log(`${x.ok ? 'PASS' : 'FAIL'}  ${x.name}${x.extra ? `  —  ${x.extra}` : ''}`);
    const failed = results.filter((x) => !x.ok).length;
    console.log(`\n${results.length - failed}/${results.length} passed`);
    process.exit(failed ? 1 : 0);
  }
})();
