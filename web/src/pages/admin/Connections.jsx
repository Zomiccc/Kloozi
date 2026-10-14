import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Copy, Send, AlertTriangle, Zap } from 'lucide-react';
import API from '../../lib/api';
import BrandLogo from '../../components/BrandLogo';

/* Flazyn team only: switch on each client's lead feed.
   For each request: open the client's Page/ad account (they've given Flazyn
   access), point the forwarder at their private lead link, send a test lead,
   mark Connected. A real lead arriving marks it connected automatically. */

const FILTERS = [['', 'All open'], ['requested', 'New'], ['in_progress', 'In progress'], ['needs_client', 'Waiting on client'], ['connected', 'Connected']];
const LABEL = { requested: 'New', in_progress: 'In progress', needs_client: 'Waiting on client', connected: 'Connected', cancelled: 'Cancelled' };
const TONE = { requested: { background: '#EFF6FF', color: '#1D4ED8' }, in_progress: { background: '#F3F0FF', color: '#4A2FD6' }, needs_client: { background: '#FFFBEB', color: '#92400E' }, connected: { background: '#ECFDF5', color: '#047857' } };

export default function Connections() {
  const [filter, setFilter] = useState('');
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const load = () => API.get('/connections/admin/all', { params: filter ? { status: filter } : {} })
    .then((r) => setData(r.data)).catch((e) => setError(e.response?.status === 403 ? 'This page is for the Flazyn team only.' : 'Could not load requests'));
  useEffect(() => { load(); const t = setInterval(load, 30000); return () => clearInterval(t); }, [filter]); // eslint-disable-line

  const update = async (id, body, msg) => {
    try { await API.put(`/connections/admin/${id}`, body); toast.success(msg); load(); } catch (e) { toast.error(e.response?.data?.error || 'Update failed'); }
  };
  const test = async (id) => {
    try { await API.post(`/connections/admin/${id}/test`); toast.success('Test lead sent to the client’s Pipeline'); load(); } catch (e) { toast.error(e.response?.data?.error || 'Test failed'); }
  };
  const ask = (row) => {
    const m = window.prompt('What should the client fix? (they’ll get this message)', row.message_to_client || 'We can’t see your Page yet. Please check that Flazyn has Leads access.');
    if (m) update(row.id, { status: 'needs_client', message_to_client: m }, 'Client notified');
  };

  // Facebook: Pages clients shared with Flazyn that aren't feeding anyone yet
  const [fbPages, setFbPages] = useState(null);
  const loadPages = () => API.get('/connections/admin/facebook/pages').then((r) => setFbPages(r.data)).catch((e) => setFbPages({ enabled: true, pages: [], error: e.response?.data?.error || 'Could not list Pages' }));
  useEffect(() => { loadPages(); }, []);
  const runAuto = async () => {
    try {
      const r = await API.post('/connections/admin/facebook/run');
      toast.success(r.data.skipped ? 'Auto switch-on is not configured' : `${r.data.connected || 0} switched on automatically`);
      load(); loadPages();
    } catch (e) { toast.error(e.response?.data?.error || 'Run failed'); }
  };
  const attach = async (row, pageId) => {
    if (!pageId) return;
    try { const r = await API.post(`/connections/admin/${row.id}/facebook-page`, { page_id: pageId }); toast.success(`Switched on: ${r.data.page.name}`); load(); loadPages(); }
    catch (e) { toast.error(e.response?.data?.error || 'Could not switch on'); }
  };

  if (error) return <div className="card text-center" style={{ padding: 40 }}><p style={{ fontWeight: 700 }}>{error}</p></div>;
  const rows = (data?.requests || []).filter((r) => (filter ? true : r.status !== 'connected' && r.status !== 'cancelled'));

  return (
    <div>
      <p className="eyebrow">Flazyn team</p>
      <h1 className="t-h1" style={{ marginTop: 4 }}>Connections</h1>
      <p style={{ color: 'var(--ink-2)', marginTop: 2 }}>Clients who’ve given Flazyn access and are waiting for their lead feed to be switched on.</p>

      {data && !data.public_url_ok && (
        <div className="helper mt-4" style={{ background: '#FFFBEB', borderColor: '#FDE68A' }}>
          <AlertTriangle size={16} style={{ color: '#B45309', flexShrink: 0, marginTop: 2 }} />
          <div>Lead links point to <b>localhost</b>. Set <code>API_URL</code> to the public address (live server or ngrok) so the forwarder can reach them.</div>
        </div>
      )}

      {fbPages?.enabled && (
        <div className="card mt-4 flex items-center gap-3 flex-wrap" style={{ padding: 14 }}>
          <BrandLogo brand="facebook" />
          <div className="flex-1 min-w-0" style={{ fontSize: 13.5 }}>
            <b>Facebook switches on by itself.</b> When a client shares their Page with Flazyn, it’s matched by name and connected within 5 minutes.
            {fbPages.error ? <span style={{ color: '#92400E' }}> {fbPages.error}</span> : <span style={{ color: 'var(--ink-2)' }}> {fbPages.pages.length} shared Page{fbPages.pages.length === 1 ? '' : 's'} not matched yet.</span>}
          </div>
          <button onClick={runAuto} className="btn btn-secondary btn-sm"><Zap size={14} /> Run now</button>
        </div>
      )}

      <div className="flex gap-2 flex-wrap mt-4 mb-4">
        {FILTERS.map(([k, l]) => <button key={k} onClick={() => setFilter(k)} className={`chip ${filter === k ? 'chip-active' : ''}`} style={{ textTransform: 'none' }}>{l}</button>)}
      </div>

      {!data ? <div className="skeleton" style={{ height: 120 }} /> : rows.length === 0 ? (
        <div className="card text-center" style={{ padding: 40 }}><p style={{ fontWeight: 700 }}>Nothing waiting 🎉</p><p style={{ color: 'var(--ink-2)', fontSize: 13.5 }}>New connection requests appear here and you’ll get an alert.</p></div>
      ) : (
        <div className="flex flex-col gap-3">
          {rows.map((r) => (
            <div key={r.id} className="card" style={{ padding: 18 }}>
              <div className="flex items-start gap-3 flex-wrap">
                <BrandLogo brand={r.platform} />
                <div className="flex-1 min-w-0">
                  <p style={{ fontWeight: 700 }}>{r.workspace_name} <span className="badge" style={{ marginLeft: 6, ...(TONE[r.status] || {}) }}>{LABEL[r.status]}</span></p>
                  <p style={{ fontSize: 13, color: 'var(--ink-2)' }}>
                    {r.asset_name ? `${r.asset_name} · ` : ''}{[r.first_name, r.last_name].filter(Boolean).join(' ')} {r.requester_email ? `(${r.requester_email})` : ''} · requested {new Date(r.created_at).toLocaleString('en-AU')}
                  </p>
                  {r.message_to_client && r.status === 'needs_client' && <p style={{ fontSize: 13, color: '#92400E', marginTop: 4 }}>Asked client: {r.message_to_client}</p>}
                </div>
              </div>
              {r.platform === 'facebook' && r.status !== 'connected' && fbPages?.pages?.length > 0 && (
                <div className="mt-3">
                  <p className="meta-label mb-1">Pick their Page to switch it on now</p>
                  <select className="input" style={{ height: 38 }} defaultValue="" onChange={(e) => attach(r, e.target.value)}>
                    <option value="" disabled>Choose a Page shared with Flazyn…</option>
                    {fbPages.pages.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
              )}
              <div className="mt-3">
                <p className="meta-label mb-1">Client’s private lead link (forward their leads here)</p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 truncate" style={{ padding: '8px 12px', background: '#FAFAF9', border: '1px solid var(--hairline)', borderRadius: 10, fontSize: 12.5 }}>{r.lead_link}</code>
                  <button onClick={() => { navigator.clipboard.writeText(r.lead_link); toast.success('Copied'); }} className="btn btn-secondary btn-sm"><Copy size={14} /> Copy</button>
                </div>
              </div>
              <div className="flex gap-2 flex-wrap mt-3">
                {r.status === 'requested' && <button onClick={() => update(r.id, { status: 'in_progress' }, 'Marked in progress')} className="btn btn-secondary btn-sm">Start</button>}
                <button onClick={() => test(r.id)} className="btn btn-secondary btn-sm"><Send size={14} /> Send test lead</button>
                {r.status !== 'connected' && <button onClick={() => update(r.id, { status: 'connected' }, 'Client told it’s connected')} className="btn btn-primary btn-sm">Mark connected</button>}
                {r.status !== 'connected' && <button onClick={() => ask(r)} className="btn btn-secondary btn-sm">Ask client to fix something</button>}
              </div>
              <input className="input mt-3" style={{ height: 36 }} placeholder="Team note (only the Flazyn team sees this)" defaultValue={r.ops_note || ''}
                onBlur={(e) => e.target.value !== (r.ops_note || '') && update(r.id, { ops_note: e.target.value }, 'Note saved')} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
