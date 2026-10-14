import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import API from '../../lib/api';
import toast from 'react-hot-toast';
import { ArrowLeft, Plus, Trash2 } from 'lucide-react';
import useCreateRegistry from '../../stores/createStore';
import { useAutomationOptions, ActionValueField } from '../../lib/automationOptions';

export default function ChatAssistantRules() {
  const navigate = useNavigate();
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const options = useAutomationOptions();
  const register = useCreateRegistry((s) => s.register);
  const clearRegistry = useCreateRegistry((s) => s.clear);

  useEffect(() => {
    register([{ label: 'New assistant rule', icon: <Plus size={14} />, run: () => setShowCreate(true) }]);
    return () => clearRegistry();
  }, [register, clearRegistry]);

  useEffect(() => { loadRules(); }, []);
  const loadRules = async () => {
    try { const res = await API.get('/automations/chat-assistant'); setRules(res.data.rules || []); }
    catch {}
    finally { setLoading(false); }
  };

  const handleToggle = async (id) => {
    try { await API.put(`/automations/chat-assistant/${id}/toggle`); loadRules(); } catch { toast.error('Failed'); }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this rule?')) return;
    try { await API.delete(`/automations/chat-assistant/${id}`); toast.success('Deleted'); loadRules(); } catch { toast.error('Failed'); }
  };

  const triggerConditions = [
    { value: 'contains', label: 'Message contains' },
    { value: 'new_number', label: 'Message from new number' },
    { value: 'no_reply_5min', label: 'No reply from agent in 5 minutes' },
  ];
  const actionTypes = [
    { value: 'send_template', label: 'Send reply message', kind: 'message' },
    { value: 'send_file', label: 'Send file from Content', kind: 'file' },
    { value: 'create_lead', label: 'Create lead (if not one yet)', kind: null },
    { value: 'assign_agent', label: 'Assign to agent', kind: 'agent' },
    { value: 'add_tag', label: 'Add tag', kind: 'text' },
    { value: 'change_stage', label: 'Change stage', kind: 'stage' },
  ];
  const triggerLabel = (v) => triggerConditions.find((t) => t.value === v)?.label || v;
  const actionLabel = (v) => actionTypes.find((a) => a.value === v)?.label || v;
  const actionValueLabel = (r) => {
    if (!r.action_value) return null;
    if (r.action_type === 'send_file') return options.files.find((f) => f.id === r.action_value)?.name || 'file';
    if (r.action_type === 'send_template') return `"${String(r.action_value).slice(0, 40)}${String(r.action_value).length > 40 ? '…' : ''}"`;
    return r.action_value;
  };

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <button onClick={() => navigate('/app/automations')} className="btn-ghost text-sm font-medium flex items-center gap-1.5">
        <ArrowLeft size={14} /> Automations
      </button>

      <div>
        <h1 style={{ fontSize: '32px', fontWeight: 650, letterSpacing: '-0.01em' }}>Chat Assistant</h1>
        <p className="text-ink-secondary mt-1" style={{ fontSize: '15px' }}>
          Rules that answer WhatsApp messages while you sleep — every message checked against every active rule.
        </p>
      </div>

      {loading ? (
        <div className="space-y-2">{[1, 2, 3].map((i) => <div key={i} className="skeleton h-16" />)}</div>
      ) : rules.length === 0 ? (
        <div className="pt-16 max-w-[560px]">
          <p style={{ fontSize: '22px', fontWeight: 600 }}>No rules yet.</p>
          <p className="text-ink-secondary mt-2" style={{ fontSize: '15px' }}>
            One rule = one trigger + one action. They run 24/7, even when you're offline.
          </p>
        </div>
      ) : (
        <div>
          {rules.map((r, idx) => (
            <motion.div
              key={r.id}
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(idx * 0.04, 0.3), duration: 0.2 }}
              className="group hairline-b py-4 flex items-start justify-between gap-4 hover-accent-left"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-3 flex-wrap">
                  <h3 className="font-semibold" style={{ fontSize: '15px' }}>{r.name}</h3>
                  <span className={`badge ${r.is_active ? 'badge-success' : 'badge-neutral'}`}>{r.is_active ? 'Active' : 'Paused'}</span>
                </div>
                <p className="text-ink-secondary mt-1 truncate" style={{ fontSize: '13px' }}>
                  IF {triggerLabel(r.trigger_condition)}{r.trigger_value ? <> · <span className="mono">"{r.trigger_value}"</span></> : null}
                  {' '}→ THEN {actionLabel(r.action_type)}{actionValueLabel(r) ? <> · <span className="mono">{actionValueLabel(r)}</span></> : null}
                </p>
              </div>
              <div className="flex items-center gap-3 flex-shrink-0 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                <button onClick={() => handleToggle(r.id)} className="text-ink-primary hover:text-accent-deep text-sm">{r.is_active ? 'Pause' : 'Resume'}</button>
                <button onClick={() => handleDelete(r.id)} className="btn-danger text-sm font-medium">
                  <Trash2 size={14} />
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {showCreate && (
        <CreateRuleModal triggerConditions={triggerConditions} actionTypes={actionTypes} options={options} onClose={() => setShowCreate(false)} onCreated={() => { setShowCreate(false); loadRules(); }} />
      )}
    </div>
  );

  function CreateRuleModal({ triggerConditions, actionTypes, options, onClose, onCreated }) {
    const [form, setForm] = useState({ name: '', trigger_condition: 'contains', trigger_value: '', action_type: 'send_template', action_value: '', is_active: true });
    const handleCreate = async () => {
      const kind = actionTypes.find((a) => a.value === form.action_type)?.kind;
      if (!form.name) return toast.error('Give the rule a name');
      if (form.trigger_condition === 'contains' && !form.trigger_value.trim()) return toast.error('Enter at least one keyword');
      if (kind && !String(form.action_value).trim()) return toast.error('Fill in the action');
      try { await API.post('/automations/chat-assistant', form); toast.success('Rule created'); onCreated(); }
      catch (err) { toast.error(err.response?.data?.error || 'Failed'); }
    };
    return (
      <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-0 sm:p-6 overflow-y-auto" style={{ background: 'rgba(28,25,23,0.25)' }} onClick={onClose}>
        <div className="card-raised w-full max-w-md my-auto" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center justify-between mb-5">
            <h2 style={{ fontSize: '18px', fontWeight: 600 }}>New chat assistant rule</h2>
            <button onClick={onClose} className="text-ink-tertiary hover:text-ink-primary transition-colors">✕</button>
          </div>
          <div className="space-y-4">
            <div>
              <p className="meta-label mb-1">Rule name</p>
              <input className="input" placeholder="e.g. Price enquiry auto-reply" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div>
              <p className="meta-label mb-1">When this happens</p>
              <select className="input" value={form.trigger_condition} onChange={(e) => setForm({ ...form, trigger_condition: e.target.value })}>
                {triggerConditions.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            {form.trigger_condition === 'contains' && (
              <div>
                <p className="meta-label mb-1">Keywords (comma-separated)</p>
                <input className="input" placeholder='e.g. price, rate, cost' value={form.trigger_value} onChange={(e) => setForm({ ...form, trigger_value: e.target.value })} />
              </div>
            )}
            <div>
              <p className="meta-label mb-1">Then do this</p>
              <select className="input" value={form.action_type} onChange={(e) => setForm({ ...form, action_type: e.target.value, action_value: '' })}>
                {actionTypes.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}
              </select>
            </div>
            {actionTypes.find((a) => a.value === form.action_type)?.kind && (
              <div>
                <p className="meta-label mb-1">{form.action_type === 'send_template' ? 'Reply text (supports {{First_Name}})' : 'Action target'}</p>
                <div className="flex">
                  <ActionValueField
                    kind={actionTypes.find((a) => a.value === form.action_type)?.kind}
                    value={form.action_value}
                    placeholder="Tag name"
                    options={options}
                    onChange={(action_value) => setForm({ ...form, action_value })}
                  />
                </div>
              </div>
            )}
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} />
              <span className="text-sm text-ink-secondary">Rule is active</span>
            </label>
            <button onClick={handleCreate} className="btn btn-primary w-full">Create rule</button>
          </div>
        </div>
      </div>
    );
  }
}
