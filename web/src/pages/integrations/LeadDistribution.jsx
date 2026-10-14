import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import API from '../../lib/api';
import toast from 'react-hot-toast';
import { ArrowLeft, Plus, Trash2 } from 'lucide-react';
import useCreateRegistry from '../../stores/createStore';
import { useAutomationOptions, memberLabel } from '../../lib/automationOptions';

const RECIPIENT_TYPES = [{ v: 'team_member', l: 'Team member' }, { v: 'email', l: 'Email' }, { v: 'whatsapp', l: 'WhatsApp' }];

export default function LeadDistribution() {
  const navigate = useNavigate();
  const [configs, setConfigs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null); // null | {} (new) | config row
  const options = useAutomationOptions();
  const register = useCreateRegistry((s) => s.register);
  const clearRegistry = useCreateRegistry((s) => s.clear);

  useEffect(() => {
    register([{ label: 'New distribution', icon: <Plus size={14} />, run: () => setEditing({}) }]);
    return () => clearRegistry();
  }, [register, clearRegistry]);

  useEffect(() => { loadConfigs(); }, []);
  const loadConfigs = async () => {
    try { const res = await API.get('/automations/distribution'); setConfigs(res.data.configs || []); }
    catch {}
    finally { setLoading(false); }
  };

  const recipientName = (r) => {
    if (r.type !== 'team_member') return r.value;
    const m = options.members.find((x) => x.id === r.value || x.email === r.value);
    return m ? [m.first_name, m.last_name].filter(Boolean).join(' ') || m.email : r.value;
  };
  const toggle = async (c) => {
    try { await API.put(`/automations/distribution/${c.id}/toggle`); loadConfigs(); } catch { toast.error('Could not update'); }
  };
  const remove = async (c) => {
    if (!confirm('Delete this distribution?')) return;
    try { await API.delete(`/automations/distribution/${c.id}`); toast.success('Deleted'); loadConfigs(); } catch { toast.error('Could not delete'); }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <button onClick={() => navigate('/app/automations')} className="btn-ghost text-sm font-medium flex items-center gap-1.5">
        <ArrowLeft size={14} /> Automations
      </button>

      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 style={{ fontSize: '32px', fontWeight: 650, letterSpacing: '-0.01em' }}>Lead Distribution</h1>
          <p className="text-ink-secondary mt-1" style={{ fontSize: '15px' }}>
            Every new lead, relayed to the right people — round-robin or broadcast.
          </p>
        </div>
        <button onClick={() => setEditing({})} className="btn btn-primary flex-shrink-0"><Plus size={14} /> New</button>
      </div>

      {loading ? (
        <div className="space-y-2">{[1, 2].map((i) => <div key={i} className="skeleton h-16" />)}</div>
      ) : configs.length === 0 ? (
        <div className="pt-16 max-w-[560px]">
          <p style={{ fontSize: '22px', fontWeight: 600 }}>No distributions yet.</p>
          <p className="text-ink-secondary mt-2" style={{ fontSize: '15px' }}>
            Set one up and new leads get assigned to team members, or forwarded by email or WhatsApp, the moment they arrive.
          </p>
        </div>
      ) : (
        <div>
          {configs.map((c, idx) => {
            let cfg = {};
            try { cfg = typeof c.config === 'string' ? JSON.parse(c.config) : (c.config || {}); } catch {}
            const recipients = cfg.recipients || [];
            const active = c.is_active !== false;
            return (
              <motion.div
                key={c.id}
                initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(idx * 0.04, 0.3), duration: 0.2 }}
                className="group hairline-b py-4 hover-accent-left"
              >
                <div className="flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-3">
                      <h3 className="font-semibold" style={{ fontSize: '15px' }}>
                        {c.name || (c.type === 'all' ? 'Broadcast to everyone' : 'Round robin')}
                      </h3>
                      <span className={`badge ${active ? 'badge-success' : 'badge-neutral'}`}>{active ? 'Active' : 'Paused'}</span>
                    </div>
                    <p className="text-ink-secondary mt-1 truncate" style={{ fontSize: '13px' }}>
                      {recipients.length ? recipients.map(recipientName).join(' · ') : 'No recipients'}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity" style={{ fontSize: '13px' }}>
                    <button onClick={() => setEditing(c)} className="text-ink-primary hover:text-accent-deep">Edit</button>
                    <button onClick={() => toggle(c)} className="text-ink-primary hover:text-accent-deep">{active ? 'Pause' : 'Resume'}</button>
                    <button onClick={() => remove(c)} className="btn-danger"><Trash2 size={14} /></button>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {editing && <ConfigModal existing={editing.id ? editing : null} options={options} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); loadConfigs(); }} />}
    </div>
  );
}

function ConfigModal({ existing, options, onClose, onSaved }) {
  let existingCfg = {};
  try { existingCfg = typeof existing?.config === 'string' ? JSON.parse(existing.config) : (existing?.config || {}); } catch {}
  const [name, setName] = useState(existing?.name || '');
  const [type, setType] = useState(existing?.type || 'round_robin');
  const [recipients, setRecipients] = useState(existingCfg.recipients?.length ? existingCfg.recipients : [{ type: 'team_member', value: '' }]);
  const update = (i, patch) => setRecipients(recipients.map((x, idx) => (idx === i ? { ...x, ...patch } : x)));

  const handleSave = async () => {
    if (recipients.some((r) => !String(r.value).trim())) return toast.error('Fill in every recipient');
    try {
      await API.put('/automations/distribution', { id: existing?.id, name: name || null, type, config: { recipients } });
      toast.success('Distribution saved');
      onSaved();
    } catch (err) { toast.error(err.response?.data?.error || 'Failed'); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-0 sm:p-6 overflow-y-auto" style={{ background: 'rgba(28,25,23,0.25)' }} onClick={onClose}>
      <div className="card-raised w-full max-w-md my-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h2 style={{ fontSize: '18px', fontWeight: 600 }}>{existing ? 'Edit distribution' : 'New distribution'}</h2>
          <button onClick={onClose} className="text-ink-tertiary hover:text-ink-primary transition-colors">✕</button>
        </div>
        <div className="space-y-4">
          <div>
            <p className="meta-label mb-1">Name (optional)</p>
            <input className="input" placeholder="e.g. Karachi sales team" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <p className="meta-label mb-1">Strategy</p>
            <select className="input" value={type} onChange={(e) => setType(e.target.value)}>
              <option value="round_robin">Round robin — one recipient per lead, in turn</option>
              <option value="all">All recipients — everyone gets every lead</option>
            </select>
            <p className="text-ink-tertiary mt-1" style={{ fontSize: '12px' }}>Team members are also assigned the lead if nobody owns it yet.</p>
          </div>
          <div>
            <p className="meta-label mb-2">Recipients</p>
            <div className="space-y-3">
              {recipients.map((r, i) => (
                <div key={i} className="flex items-end gap-2">
                  <select className="input flex-shrink-0" style={{ width: '132px' }} value={r.type} onChange={(e) => update(i, { type: e.target.value, value: '' })}>
                    {RECIPIENT_TYPES.map((t) => <option key={t.v} value={t.v}>{t.l}</option>)}
                  </select>
                  {r.type === 'team_member' ? (
                    <select className="input flex-1" value={r.value} onChange={(e) => update(i, { value: e.target.value })}>
                      <option value="">Choose…</option>
                      {options.members.map((m) => <option key={m.id} value={m.id}>{memberLabel(m)}</option>)}
                    </select>
                  ) : (
                    <input className="input flex-1" placeholder={r.type === 'email' ? 'name@company.com' : '+92 300 1234567'} value={r.value} onChange={(e) => update(i, { value: e.target.value })} />
                  )}
                  {recipients.length > 1 && (
                    <button onClick={() => setRecipients(recipients.filter((_, idx) => idx !== i))} className="btn-danger mb-1"><Trash2 size={14} /></button>
                  )}
                </div>
              ))}
            </div>
            <button onClick={() => setRecipients([...recipients, { type: 'team_member', value: '' }])} className="btn-ghost mt-3 text-sm font-medium">+ Add recipient</button>
          </div>
          <button onClick={handleSave} className="btn btn-primary w-full">Save distribution</button>
        </div>
      </div>
    </div>
  );
}
