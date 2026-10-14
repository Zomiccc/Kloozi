import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { AlertTriangle, Smile, Meh, Frown, Undo2, DollarSign, Shuffle, Target, Settings2, Trash2, Bell } from 'lucide-react';
import API from '../lib/api';
import useAuthStore from '../stores/authStore';
import { Helper } from '../components/ui';
import { enableDesktopAlerts, canNotify } from '../lib/liveAlerts';

/* ═══════════════════════════════════════════════════════════════
   AI INSIGHTS — the team-wide view of Flazyn Intelligence.
   ═══════════════════════════════════════════════════════════════ */

const TABS = [
  { key: 'risk', label: 'Deals at risk', icon: AlertTriangle },
  { key: 'mood', label: 'Conversation mood', icon: Smile },
  { key: 'comebacks', label: 'Comebacks', icon: Undo2 },
  { key: 'ads', label: 'Ad spend → revenue', icon: DollarSign, manager: true },
  { key: 'routing', label: 'Lead routing', icon: Shuffle },
  { key: 'predictions', label: 'Prediction accuracy', icon: Target },
  { key: 'settings', label: 'Settings', icon: Settings2 },
];
const money = (n) => (n || n === 0 ? `$${Math.round(n).toLocaleString('en-AU')}` : '—');

export default function Insights() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const isAgent = user?.role === 'sales_agent';
  const [tab, setTab] = useState('risk');
  const [boards, setBoards] = useState(null);

  useEffect(() => { API.get('/intel/boards', { timeout: 90000 }).then((r) => setBoards(r.data)).catch(() => setBoards({ risk: [], sentiment: [], reactivation: [], predictions: {} })); }, []);
  const tabs = TABS.filter((t) => !(t.manager && isAgent));

  return (
    <div>
      <div className="flex items-end justify-between flex-wrap gap-3" style={{ marginBottom: 16 }}>
        <div>
          <p className="eyebrow">Flazyn Intelligence</p>
          <h1 className="t-h1" style={{ marginTop: 4 }}>AI insights</h1>
          <p style={{ color: 'var(--ink-2)', marginTop: 2 }}>What needs attention across your pipeline, worked out from your own deals.</p>
        </div>
        {boards && !boards.ai_enabled && <span className="badge">Built-in rules · add an OpenAI key for AI writing</span>}
      </div>

      <div className="flex no-scrollbar overflow-x-auto" style={{ gap: 4, borderBottom: '1px solid var(--hairline)', marginBottom: 18 }}>
        {tabs.map((t) => {
          const on = tab === t.key;
          const count = t.key === 'risk' ? boards?.risk?.length : t.key === 'comebacks' ? boards?.reactivation?.length : null;
          return (
            <button key={t.key} onClick={() => setTab(t.key)} className="relative flex items-center gap-2 whitespace-nowrap" style={{ padding: '10px 14px', fontSize: 14, fontWeight: on ? 700 : 500, color: on ? 'var(--ink)' : 'var(--ink-2)' }}>
              <t.icon size={15} /> {t.label}{count ? <span className="count-pill">{count}</span> : null}
              {on && <motion.span layoutId="insights-tab" className="absolute" style={{ left: 8, right: 8, bottom: -1, height: 2, borderRadius: 2, background: 'var(--brand)' }} />}
            </button>
          );
        })}
      </div>

      {tab === 'risk' && <RiskTab rows={boards?.risk} navigate={navigate} />}
      {tab === 'mood' && <MoodTab rows={boards?.sentiment} navigate={navigate} />}
      {tab === 'comebacks' && <ComebackTab rows={boards?.reactivation} navigate={navigate} />}
      {tab === 'ads' && <AdsTab />}
      {tab === 'routing' && <RoutingTab canEdit={['admin', 'super_admin'].includes(user?.role)} />}
      {tab === 'predictions' && <PredictionsTab p={boards?.predictions} navigate={navigate} />}
      {tab === 'settings' && <SettingsTab canEdit={!isAgent} />}
    </div>
  );
}

function Loading() { return <div className="flex flex-col gap-2">{[0, 1, 2].map((i) => <div key={i} className="skeleton" style={{ height: 64 }} />)}</div>; }
function Empty({ title, body }) { return <div className="card text-center" style={{ padding: 40 }}><p style={{ fontWeight: 700 }}>{title}</p><p style={{ color: 'var(--ink-2)', fontSize: 13.5, marginTop: 4 }}>{body}</p></div>; }

function RiskTab({ rows, navigate }) {
  if (!rows) return <Loading />;
  if (!rows.length) return <Empty title="No deals look risky right now" body="Flazyn watches for deals that move too fast, go quiet, mention competitors or are missing the decision-maker." />;
  return (
    <div className="row-list">
      {rows.map((r) => (
        <div key={r.id} className="row-card cursor-pointer" onClick={() => navigate(`/app/leads/${r.id}`)} style={{ alignItems: 'flex-start' }}>
          <span className="flex items-center justify-center flex-shrink-0" style={{ width: 46, height: 46, borderRadius: 12, background: r.risk.level === 'high' ? '#FEF3C7' : '#F5F5F4', color: r.risk.level === 'high' ? '#92400E' : 'var(--ink-2)', fontWeight: 700 }}>{r.risk.score}</span>
          <div className="flex-1 min-w-0">
            <p style={{ fontWeight: 600 }}>{r.name} <span style={{ fontWeight: 400, color: 'var(--ink-3)', fontSize: 13 }}>· {r.stage}{r.agent ? ` · ${r.agent}` : ''}{Number(r.budget) ? ` · ${money(r.budget)}` : ''}</span></p>
            <p style={{ fontSize: 13, color: 'var(--ink-2)', marginTop: 2 }}>{[...r.risk.reasons, ...(r.ghost.level === 'high' && r.ghost.hours_to_cold !== null ? [`May go cold in ~${r.ghost.hours_to_cold}h`] : [])].join(' · ')}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

function MoodTab({ rows, navigate }) {
  if (!rows) return <Loading />;
  if (!rows.length) return <Empty title="No WhatsApp conversations in the last 14 days" body="Once leads message you, each conversation gets a live positive / neutral / negative read here." />;
  const counts = rows.reduce((a, r) => ({ ...a, [r.label]: (a[r.label] || 0) + 1 }), {});
  return (
    <>
      <div className="grid gap-3 mb-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))' }}>
        <div className="stat-tile"><p className="label">Positive</p><p className="value" style={{ color: '#047857' }}>{counts.positive || 0}</p></div>
        <div className="stat-tile"><p className="label">Neutral</p><p className="value">{counts.neutral || 0}</p></div>
        <div className="stat-tile"><p className="label">Negative</p><p className="value" style={{ color: '#B45309' }}>{counts.negative || 0}</p></div>
      </div>
      <div className="row-list">
        {rows.map((r) => {
          const Icon = r.label === 'positive' ? Smile : r.label === 'negative' ? Frown : Meh;
          const color = r.label === 'positive' ? '#047857' : r.label === 'negative' ? '#B45309' : 'var(--ink-3)';
          return (
            <div key={r.id} className="row-card cursor-pointer" onClick={() => navigate(`/app/leads/${r.id}`)}>
              <Icon size={20} style={{ color, flexShrink: 0 }} />
              <div className="flex-1 min-w-0">
                <p style={{ fontWeight: 600 }}>{r.name} <span style={{ fontWeight: 400, color: 'var(--ink-3)', fontSize: 13 }}>· {r.stage}{r.agent ? ` · ${r.agent}` : ''}</span></p>
                <p className="truncate" style={{ fontSize: 13, color: 'var(--ink-2)' }}>"{r.last_message}"</p>
              </div>
              <span className="badge capitalize" style={{ color }}>{r.label}{r.trend !== 'flat' ? ` · ${r.trend}` : ''}</span>
            </div>
          );
        })}
      </div>
    </>
  );
}

function ComebackTab({ rows, navigate }) {
  const [running, setRunning] = useState(false);
  const scan = async () => {
    setRunning(true);
    try { const r = await API.post('/intel/radar/run', {}, { timeout: 120000 }); toast.success(`Scanned ${r.data.checked} lost leads, ${r.data.flagged} new comebacks`); window.location.reload(); }
    catch { toast.error('Scan failed'); } finally { setRunning(false); }
  };
  if (!rows) return <Loading />;
  return (
    <>
      <Helper icon="📡">Every 6 hours Flazyn re-checks your lost leads. If one messages you, opens an email, re-reads your brochure or visits your site, it shows up here and the owner gets an alert.</Helper>
      <div className="flex justify-end my-3"><button onClick={scan} disabled={running} className="btn btn-secondary btn-sm">{running ? 'Scanning…' : 'Scan now'}</button></div>
      {!rows.length ? <Empty title="No lost leads are showing interest yet" body="When one does, you'll see why here." /> : (
        <div className="row-list">
          {rows.map((r) => (
            <div key={r.id} className="row-card cursor-pointer" onClick={() => navigate(`/app/leads/${r.id}`)}>
              <Undo2 size={18} style={{ color: 'var(--brand)', flexShrink: 0 }} />
              <div className="flex-1 min-w-0">
                <p style={{ fontWeight: 600 }}>{r.name}</p>
                <p style={{ fontSize: 13, color: 'var(--ink-2)' }}>{(r.signals || []).join(' · ')}</p>
              </div>
              <span style={{ fontSize: 12, color: 'var(--ink-3)' }}>{r.flagged_at ? new Date(r.flagged_at).toLocaleDateString('en-AU') : ''}</span>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

function AdsTab() {
  const [d, setD] = useState(null);
  const [months, setMonths] = useState(3);
  const [form, setForm] = useState({ source: 'facebook', campaign: '', month: new Date().toISOString().slice(0, 7), amount: '' });
  const load = () => API.get('/intel/ads', { params: { months } }).then((r) => setD(r.data)).catch(() => setD({ rows: [], tips: [], spend: [], totals: {} }));
  useEffect(() => { load(); }, [months]); // eslint-disable-line
  const save = async () => {
    try { await API.put('/intel/ads/spend', { ...form, amount: Number(form.amount) }); toast.success('Spend saved'); setForm({ ...form, amount: '', campaign: '' }); load(); }
    catch (err) { toast.error(err.response?.data?.error || 'Could not save'); }
  };
  const del = async (id) => { await API.delete(`/intel/ads/spend/${id}`); load(); };
  if (!d) return <Loading />;
  return (
    <>
      <div className="grid gap-3 mb-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))' }}>
        <div className="stat-tile"><p className="label">Ad spend</p><p className="value">{money(d.totals.spend)}</p></div>
        <div className="stat-tile"><p className="label">Leads</p><p className="value">{d.totals.leads || 0}</p></div>
        <div className="stat-tile"><p className="label">Closed revenue</p><p className="value">{money(d.totals.revenue)}</p></div>
        <div className="stat-tile"><p className="label">Return on ad spend</p><p className="value">{d.totals.roas ? `${d.totals.roas}×` : '—'}</p></div>
      </div>
      {d.tips?.map((t) => <div key={t} className="helper mb-2"><span>💡</span><div>{t}</div></div>)}
      <div className="flex items-center justify-between mt-4 mb-2">
        <p style={{ fontWeight: 700 }}>By source and campaign</p>
        <select className="input" style={{ width: 160, height: 34 }} value={months} onChange={(e) => setMonths(Number(e.target.value))}>
          <option value={1}>This month</option><option value={3}>Last 3 months</option><option value={6}>Last 6 months</option><option value={12}>Last 12 months</option>
        </select>
      </div>
      <div className="overflow-x-auto">
        <table className="flazyn-table">
          <thead><tr><th>Source</th><th>Campaign</th><th>Spend</th><th>Leads</th><th>Won</th><th>Revenue</th><th>Cost / lead</th><th>Cost / sale</th><th>Return</th></tr></thead>
          <tbody>
            {d.rows.length === 0 && <tr><td colSpan={9} style={{ color: 'var(--ink-3)' }}>No leads in this period yet.</td></tr>}
            {d.rows.map((r) => (
              <tr key={`${r.source}${r.campaign}`}>
                <td className="capitalize">{String(r.source).replace(/_/g, ' ')}</td><td>{r.campaign || '—'}</td><td>{r.spend ? money(r.spend) : '—'}</td>
                <td>{r.leads}</td><td>{r.won}</td><td>{money(r.revenue)}</td><td>{r.cost_per_lead ? money(r.cost_per_lead) : '—'}</td>
                <td>{r.cost_per_win ? money(r.cost_per_win) : '—'}</td>
                <td style={{ fontWeight: 700, color: r.roas >= 3 ? '#047857' : r.roas !== null && r.roas < 1 ? '#B45309' : 'inherit' }}>{r.roas !== null ? `${r.roas}×` : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="card mt-5">
        <p style={{ fontWeight: 700 }}>Add what you spent</p>
        <p style={{ fontSize: 13, color: 'var(--ink-2)', marginTop: 2 }}>Copy the monthly spend from Facebook / Google / TikTok Ads Manager. Leave campaign blank for the whole platform.</p>
        <div className="grid gap-2 mt-3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))' }}>
          <select className="input" value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })}>
            {['facebook', 'google_ads', 'tiktok', 'linkedin', 'website'].map((s) => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
          </select>
          <input className="input" placeholder="Campaign (optional)" value={form.campaign} onChange={(e) => setForm({ ...form, campaign: e.target.value })} />
          <input className="input" type="month" value={form.month} onChange={(e) => setForm({ ...form, month: e.target.value })} />
          <input className="input" type="number" placeholder="Amount $" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
          <button onClick={save} disabled={!form.amount} className="btn btn-primary">Save</button>
        </div>
        {d.spend?.length > 0 && (
          <div className="mt-3">{d.spend.slice(0, 12).map((s) => (
            <div key={s.id} className="flex items-center justify-between" style={{ padding: '6px 0', borderTop: '1px solid var(--hairline)', fontSize: 13 }}>
              <span className="capitalize">{s.source.replace(/_/g, ' ')}{s.campaign ? ` · ${s.campaign}` : ''} · {String(s.month).slice(0, 7)}</span>
              <span className="flex items-center gap-3">{money(Number(s.amount))}<button onClick={() => del(s.id)} className="row-action"><Trash2 size={14} /></button></span>
            </div>
          ))}</div>
        )}
      </div>
    </>
  );
}

function RoutingTab({ canEdit }) {
  const [d, setD] = useState(null);
  const load = () => API.get('/intel/routing').then((r) => setD(r.data)).catch(() => {});
  useEffect(() => { load(); }, []);
  const set = async (strategy) => {
    try { await API.put('/intel/routing', { strategy }); toast.success('Routing updated'); load(); } catch (err) { toast.error(err.response?.data?.error || 'Only admins can change routing'); }
  };
  if (!d) return <Loading />;
  const options = [
    { k: 'best_fit', t: 'Smart routing (best fit)', b: 'Each new lead goes to the agent who wins that kind of lead most often (same source and budget), balanced by how busy they are.' },
    { k: 'least_loaded', t: 'Least busy agent', b: 'The agent with the fewest open leads gets the next one.' },
    { k: 'round_robin', t: 'Take turns (round robin)', b: 'Agents get new leads one after another.' },
  ];
  return (
    <>
      <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))' }}>
        {options.map((o) => (
          <button key={o.k} disabled={!canEdit} onClick={() => set(o.k)} className="card text-left" style={{ padding: 16, borderColor: d.strategy === o.k ? 'var(--brand)' : 'var(--hairline)', boxShadow: d.strategy === o.k ? '0 0 0 3px rgba(91,61,245,0.12)' : undefined }}>
            <p style={{ fontWeight: 700 }}>{o.t} {d.strategy === o.k && <span className="count-pill" style={{ marginLeft: 6 }}>On</span>}</p>
            <p style={{ fontSize: 13, color: 'var(--ink-2)', marginTop: 4 }}>{o.b}</p>
          </button>
        ))}
      </div>
      <p style={{ fontWeight: 700, margin: '20px 0 8px' }}>What each agent is best at</p>
      <div className="overflow-x-auto">
        <table className="flazyn-table">
          <thead><tr><th>Agent</th><th>Open leads</th><th>Won / closed</th><th>Win rate</th><th>Strongest with</th></tr></thead>
          <tbody>
            {d.agents.map((a) => {
              const best = Object.entries(a.by_source || {}).filter(([, v]) => v.closed >= 2).sort((x, y) => (y[1].won / y[1].closed) - (x[1].won / x[1].closed))[0];
              return (
                <tr key={a.id}>
                  <td style={{ fontWeight: 600 }}>{a.name}</td><td>{a.open}</td><td>{a.won} / {a.closed}</td>
                  <td>{a.win_rate !== null ? `${a.win_rate}%` : '—'}</td>
                  <td className="capitalize">{best ? `${best[0].replace(/_/g, ' ')} leads (${Math.round((best[1].won / best[1].closed) * 100)}%)` : 'Not enough closed deals yet'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}

function PredictionsTab({ p, navigate }) {
  if (!p) return <Loading />;
  return (
    <>
      <Helper icon="🎯">Flazyn predicts each deal's size from the budget, what the lead says and your past wins. When a deal closes, it compares the prediction to the real amount and adjusts future predictions. The more you win, the more accurate it gets.</Helper>
      <div className="grid gap-3 my-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
        <div className="stat-tile"><p className="label">Closed deals measured</p><p className="value">{p.closed_with_prediction || 0}</p></div>
        <div className="stat-tile"><p className="label">Average error</p><p className="value">{p.avg_error_pct !== null && p.avg_error_pct !== undefined ? `${p.avg_error_pct}%` : '—'}</p></div>
        <div className="stat-tile"><p className="label">Current adjustment</p><p className="value">×{p.calibration_factor || 1}</p></div>
      </div>
      {p.recent?.length > 0 && (
        <table className="flazyn-table">
          <thead><tr><th>Deal</th><th>Predicted</th><th>Closed at</th><th>Difference</th></tr></thead>
          <tbody>{p.recent.map((r, i) => (
            <tr key={i}><td>{r.name}</td><td>{money(r.predicted)}</td><td>{money(r.actual)}</td><td>{Math.round(((r.actual - r.predicted) / r.predicted) * 100)}%</td></tr>
          ))}</tbody>
        </table>
      )}
    </>
  );
}

function SettingsTab({ canEdit }) {
  const [list, setList] = useState('');
  const [perm, setPerm] = useState(canNotify() ? Notification.permission : 'unsupported');
  useEffect(() => { API.get('/intel/settings').then((r) => setList((r.data.competitors || []).join(', '))).catch(() => {}); }, []);
  const save = async () => {
    try { const r = await API.put('/intel/settings', { competitors: list }); setList(r.data.competitors.join(', ')); toast.success('Saved'); }
    catch (err) { toast.error(err.response?.data?.error || 'Could not save'); }
  };
  return (
    <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))' }}>
      <div className="card">
        <p style={{ fontWeight: 700 }}>Competitors to watch for</p>
        <p style={{ fontSize: 13, color: 'var(--ink-2)', marginTop: 2 }}>When a lead mentions one of these on WhatsApp, the agent is alerted with a suggested reply. Separate names with commas.</p>
        <textarea className="input mt-3" rows={3} disabled={!canEdit} placeholder="e.g. ABC Realty, Ray White, LJ Hooker" value={list} onChange={(e) => setList(e.target.value)} />
        {canEdit && <button onClick={save} className="btn btn-primary btn-sm mt-2">Save</button>}
      </div>
      <div className="card">
        <p style={{ fontWeight: 700 }} className="flex items-center gap-2"><Bell size={16} /> Live strike alerts</p>
        <p style={{ fontSize: 13, color: 'var(--ink-2)', marginTop: 2 }}>The moment a lead opens your proposal or brochure, Flazyn buzzes your phone, chimes and pops up an alert, even when Flazyn is in another tab.</p>
        <button disabled={perm === 'granted' || perm === 'unsupported'} onClick={async () => setPerm(await enableDesktopAlerts())} className="btn btn-primary btn-sm mt-3">
          {perm === 'granted' ? 'Alerts are on ✓' : perm === 'unsupported' ? 'Not supported in this browser' : perm === 'denied' ? 'Blocked: allow notifications in browser settings' : 'Turn on alerts'}
        </button>
        <p style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 8 }}>On the Flazyn mobile app, alerts arrive as push notifications.</p>
      </div>
    </div>
  );
}
