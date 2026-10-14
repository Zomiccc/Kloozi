import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import API from '../../lib/api';
import toast from 'react-hot-toast';
import { Filter, X } from 'lucide-react';
import { pillStyle } from '../../components/ui';
import { useAutomationOptions, ActionValueField } from '../../lib/automationOptions';

const SOURCES = [
  { v: 'any', l: 'Any source' }, { v: 'facebook', l: 'Facebook' }, { v: 'google_ads', l: 'Google Ads' }, { v: 'google', l: 'Google Forms' },
  { v: 'tiktok', l: 'TikTok' }, { v: 'linkedin', l: 'LinkedIn' }, { v: 'website', l: 'Website' },
  { v: 'lead_form', l: 'Lead form' }, { v: 'wordpress', l: 'WordPress' }, { v: 'whatsapp', l: 'WhatsApp' },
  { v: 'import', l: 'CSV import' }, { v: 'manual', l: 'Added manually' },
];
const FIELDS = ['first_name', 'last_name', 'phone', 'email', 'city', 'budget', 'lead_source', 'stage', 'notes'];
const OPERATORS = [
  { v: 'equals', l: 'Equals' }, { v: 'not_equals', l: 'Does not equal' }, { v: 'contains', l: 'Contains' },
  { v: 'greater_than', l: 'Greater than' }, { v: 'less_than', l: 'Less than' },
  { v: 'is_empty', l: 'Is empty' }, { v: 'is_not_empty', l: 'Is not empty' },
];
const ACTIONS = [
  { v: 'assign_agent', l: 'Assign to agent', kind: 'agent' },
  { v: 'assign_round_robin', l: 'Assign round robin', kind: null },
  { v: 'add_tag', l: 'Add tag', kind: 'text', placeholder: 'Tag name' },
  { v: 'change_stage', l: 'Change stage', kind: 'stage' },
  { v: 'send_to_distribution', l: 'Send to lead distribution', kind: null },
  { v: 'send_whatsapp', l: 'Send WhatsApp message', kind: 'message' },
  { v: 'start_sequence', l: 'Start WhatsApp sequence', kind: 'sequence' },
  { v: 'notify_managers', l: 'Notify managers', kind: 'text', placeholder: 'Notification title' },
];
const actionMeta = (type) => ACTIONS.find((a) => a.v === type) || { l: type, kind: 'text' };
const sourceLabel = (v) => SOURCES.find((s) => s.v === v)?.l || v;
const opLabel = (v) => OPERATORS.find((o) => o.v === v)?.l.toLowerCase() || v;

function describeRule(r) {
  const when = (r.conditions || []).map((c) => `${c.field} ${opLabel(c.operator)}${/empty/.test(c.operator) ? '' : ` ${c.value}`}`);
  const then = (r.actions || []).map((a) => `${actionMeta(a.type).l}${a.value && !['send_whatsapp', 'start_sequence'].includes(a.type) ? ` (${a.value})` : ''}`);
  return { when: [sourceLabel(r.trigger_source || 'any'), ...when].join(' · '), then: then.join(' → ') || 'No actions' };
}

export default function AutomationRules() {
  const navigate = useNavigate();
  const [rules, setRules] = useState([]);
  const [showCreate, setShowCreate] = useState(false);
  const options = useAutomationOptions();

  useEffect(() => { loadRules(); }, []);
  const loadRules = async () => { try { const res = await API.get('/automations/rules'); setRules(res.data.rules || []); } catch {} };

  const handleDelete = async (id) => {
    if (!confirm('Delete this rule?')) return;
    try { await API.delete(`/automations/rules/${id}`); toast.success('Rule deleted'); loadRules(); } catch { toast.error('Could not delete rule'); }
  };
  const handleToggle = async (rule) => {
    try { await API.put(`/automations/rules/${rule.id}`, { is_active: !rule.is_active }); loadRules(); } catch { toast.error('Could not update rule'); }
  };
  const handleTest = async (rule) => {
    const source = rule.trigger_source && rule.trigger_source !== 'any' ? rule.trigger_source : 'facebook';
    const sample = { first_name: 'Test', phone: '+1234567890', city: 'Lahore', budget: '500000', lead_source: source, stage: 'new' };
    try {
      const res = await API.post(`/automations/rules/${rule.id}/test`, { sample_lead: sample });
      (res.data.matched ? toast.success : toast)(`${res.data.message} (sample: ${source}, budget 500000, Lahore)`);
    } catch { toast.error('Test failed'); }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <button onClick={() => navigate('/app/automations')} className="text-ink-secondary hover:text-ink-primary transition-colors" style={{ fontSize: '13px' }}>← Back to Automations</button>

      <div className="flex items-baseline justify-between gap-4">
        <div>
          <h1 className="text-ink-primary" style={{ fontSize: '28px', fontWeight: 650, letterSpacing: '-0.01em' }}>Lead Automation Rules</h1>
          <p className="text-ink-secondary mt-1" style={{ fontSize: '14px' }}>Run on every new lead, in priority order — assign, tag, move stage, relay or message.</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="text-ink-primary hover:text-accent-deep underline underline-offset-4 transition-colors flex-shrink-0" style={{ fontSize: '15px', fontWeight: 600 }}>New rule</button>
      </div>

      {rules.length === 0 ? (
        <div className="text-center py-20">
          <Filter size={28} className="text-ink-tertiary mx-auto mb-4" />
          <p className="text-ink-primary" style={{ fontSize: '22px', fontWeight: 600 }}>No automation rules yet.</p>
          <p className="text-ink-secondary mt-2" style={{ fontSize: '15px' }}>Example: Facebook leads with budget over 1,000,000 → tag “hot” and assign to your senior agent.</p>
        </div>
      ) : (
        <div>
          {rules.map((r) => {
            const d = describeRule(r);
            return (
              <div key={r.id} className="group hairline-b py-4 flex items-center gap-4">
                <div className="flex-1 min-w-0">
                  <p className="text-ink-primary" style={{ fontSize: '14px', fontWeight: 500 }}>{r.name}</p>
                  <p className="text-ink-tertiary mt-1 truncate" style={{ fontSize: '12px' }}>IF {d.when}</p>
                  <p className="text-ink-tertiary truncate" style={{ fontSize: '12px' }}>THEN {d.then} · Priority <span className="mono">{r.priority}</span></p>
                </div>
                <span className="flex-shrink-0" style={pillStyle(r.is_active ? '#0E8A5F' : '#A8A29E')}>
                  {r.is_active ? 'Active' : 'Paused'}
                </span>
                <div className="flex items-center gap-3 flex-shrink-0 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                  <button onClick={() => handleTest(r)} className="text-ink-primary hover:text-accent-deep transition-colors" style={{ fontSize: '13px' }}>Test</button>
                  <button onClick={() => handleToggle(r)} className="text-ink-primary hover:text-accent-deep transition-colors" style={{ fontSize: '13px' }}>{r.is_active ? 'Pause' : 'Enable'}</button>
                  <button onClick={() => handleDelete(r.id)} className="text-ink-tertiary hover:text-ink-primary transition-colors" style={{ fontSize: '13px' }}>Delete</button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showCreate && <CreateRuleModal options={options} onClose={() => setShowCreate(false)} onCreated={() => { setShowCreate(false); loadRules(); }} />}
    </div>
  );
}

function CreateRuleModal({ options, onClose, onCreated }) {
  const [form, setForm] = useState({
    name: '', trigger_source: 'any',
    conditions: [{ field: 'budget', operator: 'greater_than', value: '' }],
    actions: [{ type: 'assign_agent', value: '' }],
    is_active: true, priority: 0,
  });
  const [saving, setSaving] = useState(false);
  const setCondition = (i, patch) => setForm({ ...form, conditions: form.conditions.map((x, idx) => (idx === i ? { ...x, ...patch } : x)) });
  const setAction = (i, patch) => setForm({ ...form, actions: form.actions.map((x, idx) => (idx === i ? { ...x, ...patch } : x)) });

  const handleCreate = async () => {
    if (!form.name.trim()) return toast.error('Give the rule a name');
    const missing = form.actions.find((a) => actionMeta(a.type).kind && !String(a.value || '').trim());
    if (missing) return toast.error(`Fill in the value for “${actionMeta(missing.type).l}”`);
    setSaving(true);
    try {
      await API.post('/automations/rules', form);
      toast.success('Rule created — it will run on every new lead');
      onCreated();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Could not create rule');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(28,25,23,0.25)' }} onClick={onClose}>
      <div className="card-raised w-full max-w-lg max-h-[90vh] overflow-y-auto animate-scale-in" style={{ borderRadius: '10px' }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between hairline-b pb-4 mb-4">
          <h2 className="text-ink-primary" style={{ fontSize: '22px', fontWeight: 600 }}>New automation rule</h2>
          <button onClick={onClose} className="text-ink-tertiary hover:text-ink-primary transition-colors"><X size={18} /></button>
        </div>
        <div className="space-y-4">
          <div>
            <p className="meta-label mb-1">Rule name</p>
            <input className="input" placeholder="e.g. Hot Facebook leads to Ali" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div className="flex gap-3">
            <div className="flex-1">
              <p className="meta-label mb-1">When a new lead arrives from</p>
              <select className="input" value={form.trigger_source} onChange={(e) => setForm({ ...form, trigger_source: e.target.value })}>
                {SOURCES.map((s) => <option key={s.v} value={s.v}>{s.l}</option>)}
              </select>
            </div>
            <div style={{ width: '96px' }}>
              <p className="meta-label mb-1">Priority</p>
              <input className="input" type="number" min="0" value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })} />
            </div>
          </div>
          <div>
            <p className="meta-label mb-2">And all of these are true (optional)</p>
            {form.conditions.map((c, i) => (
              <div key={i} className="flex gap-2 mb-2">
                <select className="input flex-1" value={c.field} onChange={(e) => setCondition(i, { field: e.target.value })}>{FIELDS.map((f) => <option key={f} value={f}>{f.replace('_', ' ')}</option>)}</select>
                <select className="input w-36" value={c.operator} onChange={(e) => setCondition(i, { operator: e.target.value })}>{OPERATORS.map((o) => <option key={o.v} value={o.v}>{o.l}</option>)}</select>
                {!/empty/.test(c.operator) && <input className="input flex-1" placeholder="Value" value={c.value} onChange={(e) => setCondition(i, { value: e.target.value })} />}
                <button onClick={() => setForm({ ...form, conditions: form.conditions.filter((_, idx) => idx !== i) })} className="text-ink-tertiary hover:text-ink-primary"><X size={14} /></button>
              </div>
            ))}
            <button onClick={() => setForm({ ...form, conditions: [...form.conditions, { field: 'city', operator: 'equals', value: '' }] })} className="text-ink-secondary hover:text-ink-primary underline underline-offset-4 transition-colors" style={{ fontSize: '13px' }}>+ Add condition</button>
          </div>
          <div>
            <p className="meta-label mb-2">Then do this</p>
            {form.actions.map((a, i) => {
              const meta = actionMeta(a.type);
              return (
                <div key={i} className="flex gap-2 mb-2 items-start">
                  <select className="input flex-1" value={a.type} onChange={(e) => setAction(i, { type: e.target.value, value: '' })}>{ACTIONS.map((x) => <option key={x.v} value={x.v}>{x.l}</option>)}</select>
                  {meta.kind && <ActionValueField kind={meta.kind} value={a.value} placeholder={meta.placeholder} options={options} onChange={(value) => setAction(i, { value })} />}
                  {form.actions.length > 1 && <button onClick={() => setForm({ ...form, actions: form.actions.filter((_, idx) => idx !== i) })} className="text-ink-tertiary hover:text-ink-primary mt-3"><X size={14} /></button>}
                </div>
              );
            })}
            <button onClick={() => setForm({ ...form, actions: [...form.actions, { type: 'add_tag', value: '' }] })} className="text-ink-secondary hover:text-ink-primary underline underline-offset-4 transition-colors" style={{ fontSize: '13px' }}>+ Add action</button>
          </div>
          <div className="flex justify-end gap-3 hairline pt-4">
            <button onClick={onClose} className="text-ink-secondary hover:text-ink-primary underline underline-offset-4 transition-colors" style={{ fontSize: '14px' }}>Cancel</button>
            <button onClick={handleCreate} disabled={saving} className="btn btn-primary">{saving ? 'Saving…' : 'Create rule'}</button>
          </div>
        </div>
      </div>
    </div>
  );
}
