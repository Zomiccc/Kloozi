import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import API from '../../lib/api';
import toast from 'react-hot-toast';
import { Plus, GitBranch, Workflow } from 'lucide-react';
import { TRIGGER_TYPES, fmtDateTime } from '../../lib/marketingShared';
import useCreateRegistry from '../../stores/createStore';

const statusMeta = {
  draft: { label: 'Draft', cls: 'badge-neutral' },
  live: { label: 'Live', cls: 'badge-success' },
  paused: { label: 'Paused', cls: 'badge-warning' },
};

export default function Flows() {
  const [flows, setFlows] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const register = useCreateRegistry((s) => s.register);
  const clearRegistry = useCreateRegistry((s) => s.clear);

  useEffect(() => {
    register([{ label: 'New flow', icon: <Workflow size={14} />, run: () => navigate('/app/marketing/flows/new') }]);
    return () => clearRegistry();
  }, [register, clearRegistry, navigate]);

  useEffect(() => { load(); }, []);
  const load = async () => {
    try { setFlows((await API.get('/marketing/flows')).data.flows); }
    catch { toast.error('Failed to load flows'); }
    finally { setLoading(false); }
  };

  const setStatus = async (flow, status) => {
    try {
      await API.put(`/marketing/flows/${flow.id}/status`, { status });
      toast.success(status === 'live' ? `"${flow.name}" is live` : `Flow ${status}`);
      load();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Status change failed');
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 style={{ fontSize: '32px', fontWeight: 650, letterSpacing: '-0.01em' }}>Flows</h1>
        <p className="text-ink-secondary mt-1" style={{ fontSize: '15px' }}>
          Automated sequences that react to what your leads do — not one-off sends.
        </p>
      </div>

      <DescribeFlow onBuilt={(id) => navigate(`/app/marketing/flows/${id}`)} />

      {loading ? (
        <div className="grid md:grid-cols-2 gap-x-8">
          {[1, 2, 3, 4].map(i => <div key={i} className="skeleton h-24" />)}
        </div>
      ) : flows.length === 0 ? (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="pt-16 max-w-[560px]">
          <GitBranch size={36} className="mx-auto text-ink-tertiary mb-3" />
          <p style={{ fontSize: '22px', fontWeight: 600 }}>No flows yet.</p>
          <p className="text-ink-secondary mt-2" style={{ fontSize: '15px' }}>
            Build your first automation — a trigger, a few steps, done.
          </p>
          <button onClick={() => navigate('/app/marketing/flows/new')} className="btn btn-primary mt-5">Build a flow</button>
        </motion.div>
      ) : (
        <div className="grid gap-x-8 md:grid-cols-2">
          {flows.map((f, idx) => {
            const meta = statusMeta[f.status] || statusMeta.draft;
            const trigger = TRIGGER_TYPES.find((t) => t.value === f.trigger_type);
            return (
              <motion.div
                key={f.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(idx * 0.05, 0.35), duration: 0.22, ease: 'easeOut' }}
                whileHover={{ x: 2 }}
                className="hairline-b py-4 hover-accent-left group cursor-pointer"
                onClick={() => navigate(`/app/marketing/flows/${f.id}`)}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="font-semibold truncate" style={{ fontSize: '15px' }}>{f.name}</h3>
                    <p className="text-ink-secondary mt-0.5" style={{ fontSize: '13px' }}>
                      When: {trigger?.label || f.trigger_type || 'manual'}
                    </p>
                  </div>
                  <span className={`badge ${meta.cls} flex-shrink-0 mt-1`}>{meta.label}</span>
                </div>

                <div className="flex items-center gap-5 mt-3 mono text-ink-secondary" style={{ fontSize: '12px' }}>
                  <span>{f.stats?.entered ?? 0} entered</span>
                  <span>{f.stats?.active ?? 0} active</span>
                  <span>{f.stats?.completed ?? 0} completed</span>
                </div>

                <div className="flex items-center gap-3 mt-3 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={(e) => e.stopPropagation()}>
                  {f.status !== 'live'
                    ? <button onClick={() => setStatus(f, 'live')} className="text-sm font-semibold hover:underline underline-offset-2" style={{ color: '#0E8A5F' }}>Go live</button>
                    : <button onClick={() => setStatus(f, 'paused')} className="text-sm font-semibold hover:underline underline-offset-2" style={{ color: '#B45309' }}>Pause</button>}
                  <Link to={`/app/marketing/flows/${f.id}`} className="btn-ghost text-sm font-medium">Open builder</Link>
                </div>

                <p className="text-ink-tertiary mt-2" style={{ fontSize: '11px' }}>Updated {fmtDateTime(f.updated_at)}</p>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}

const EXAMPLES = [
  'When a lead comes in from Facebook, send a WhatsApp "Hi {{First_Name}}, thanks for reaching out!", wait 1 day, then send an email',
  'When a lead moves to interested, notify the agent, wait 2 days, then send an SMS',
  'When a lead has no activity for 14 days, send a WhatsApp check-in and tag them as re-engage',
];

/* Talk-to-build: describe an automation in plain English, get a draft flow. */
function DescribeFlow({ onBuilt }) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const build = async () => {
    setBusy(true);
    try {
      const r = await API.post('/intel/flows/from-text', { text }, { timeout: 60000 });
      toast.success('Draft flow built. Check it, then switch it on.');
      onBuilt(r.data.flow.id);
    } catch (err) { toast.error(err.response?.data?.error || 'Could not build that flow'); }
    finally { setBusy(false); }
  };
  return (
    <div className="card" style={{ padding: 18 }}>
      <p className="eyebrow">✨ Describe it, Flazyn builds it</p>
      <p style={{ fontSize: 14, color: 'var(--ink-2)', marginTop: 4 }}>Write what should happen in plain English. You'll get a draft flow to check before it goes live.</p>
      <textarea className="input mt-3" rows={2} value={text} onChange={(e) => setText(e.target.value)} placeholder={EXAMPLES[0]} />
      <div className="flex flex-wrap items-center gap-2 mt-2">
        <button onClick={build} disabled={busy || text.trim().length < 8} className="btn btn-primary btn-sm">{busy ? 'Building…' : 'Build flow'}</button>
        {EXAMPLES.slice(1).map((e) => (
          <button key={e} onClick={() => setText(e)} className="chip" style={{ textTransform: 'none' }}>{e.slice(0, 48)}…</button>
        ))}
      </div>
    </div>
  );
}
