import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import API from '../../lib/api';
import toast from 'react-hot-toast';
import { ArrowLeft, Filter, Plus, Trash2, Play, ArrowUp, ArrowDown } from 'lucide-react';

export default function AutomationRules() {
  const navigate = useNavigate();
  const [rules, setRules] = useState([]);
  const [showCreate, setShowCreate] = useState(false);

  useEffect(() => { loadRules(); }, []);
  const loadRules = async () => { try { const res = await API.get('/automations/rules'); setRules(res.data.rules || []); } catch {} };

  const handleDelete = async (id) => { if (!confirm('Delete?')) return; try { await API.delete(`/automations/rules/${id}`); toast.success('Deleted'); loadRules(); } catch {} };
  const handleToggle = async (rule) => { try { await API.put(`/automations/rules/${rule.id}`, { is_active: !rule.is_active }); loadRules(); } catch {} };
  const handleTest = async (rule) => { try { const res = await API.post(`/automations/rules/${rule.id}/test`, { sample_lead: { first_name: 'Test', phone: '+1234567890', city: 'Test City', budget: '500000', lead_source: 'facebook' } }); toast.success(res.data.message); } catch {} };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <button onClick={() => navigate('/app/automations')} className="flex items-center gap-2 text-sm text-ink-secondary hover:text-ink-primary"><ArrowLeft size={16} /> Back to Automations</button>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-surface-page rounded-xl flex items-center justify-center"><Filter size={24} className="text-ink-secondary" /></div>
          <div><h2 className="text-xl font-bold text-ink-primary">Lead Automation Rules</h2><p className="text-sm text-ink-secondary">Assign leads via rules or round robin</p></div>
        </div>
        <button onClick={() => setShowCreate(true)} className="px-4 py-2 rounded-lg btn btn-primary flex items-center gap-2 transition-colors"><Plus size={16} /> New Rule</button>
      </div>

      {rules.length === 0 ? (
        <div className="card text-center py-12"><Filter size={48} className="text-ink-tertiary mx-auto mb-3" /><p className="text-ink-secondary">No automation rules yet</p></div>
      ) : (
        <div className="space-y-3">
          {rules.map(r => (
            <div key={r.id} className="card">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2"><span className="font-medium text-ink-primary">{r.name}</span><span className={`badge ${r.is_active ? 'bg-surface-page text-ink-secondary' : 'bg-surface-hover text-ink-secondary'}`}>{r.is_active ? 'Active' : 'Inactive'}</span></div>
                  <p className="text-xs text-ink-tertiary mt-1">Source: {r.trigger_source} | Priority: {r.priority}</p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => handleTest(r)} className="px-3 py-2 rounded-lg bg-surface-hover text-ink-secondary border border-surface-border hover:bg-surface-hover text-sm p-2 transition-colors" title="Test"><Play size={14} /></button>
                  <button onClick={() => handleToggle(r)} className="px-3 py-2 rounded-lg bg-surface-hover text-ink-secondary border border-surface-border hover:bg-surface-hover text-sm p-2 transition-colors" title="Toggle"><Filter size={14} /></button>
                  <button onClick={() => handleDelete(r.id)} className="px-3 py-2 rounded-lg bg-surface-page text-ink-secondary border border-surface-border hover:bg-surface-hover text-sm p-2 transition-colors"><Trash2 size={14} /></button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showCreate && <CreateRuleModal onClose={() => setShowCreate(false)} onCreated={() => { setShowCreate(false); loadRules(); }} />}
    </div>
  );

  function CreateRuleModal({ onClose, onCreated }) {
    const [form, setForm] = useState({ name: '', trigger_source: 'any', conditions: [{ field: 'budget', operator: 'greater_than', value: '' }], actions: [{ type: 'assign_agent', value: '' }], is_active: true, priority: 0 });
    const fields = ['first_name', 'last_name', 'phone', 'email', 'city', 'budget', 'lead_source', 'stage'];
    const operators = [{ v: 'equals', l: 'Equals' }, { v: 'contains', l: 'Contains' }, { v: 'greater_than', l: 'Greater Than' }, { v: 'less_than', l: 'Less Than' }];
    const actionTypes = [{ v: 'assign_agent', l: 'Assign to Agent' }, { v: 'assign_round_robin', l: 'Assign Round Robin' }, { v: 'add_tag', l: 'Add Tag' }, { v: 'change_stage', l: 'Change Stage' }, { v: 'send_to_distribution', l: 'Send to Distribution' }];

    const handleCreate = async () => {
      if (!form.name) return toast.error('Name required');
      try { await API.post('/automations/rules', form); toast.success('Rule created'); onCreated(); } catch { toast.error('Failed'); }
    };

    return (
      <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50 p-4">
        <div className="bg-white border border-surface-border rounded-2xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-modal">
          <div className="flex items-center justify-between mb-4"><h2 className="text-xl font-bold text-ink-primary">New Automation Rule</h2><button onClick={onClose}>✕</button></div>
          <div className="space-y-4">
            <input className="input" placeholder="Rule name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
            <select className="input" value={form.trigger_source} onChange={e => setForm({ ...form, trigger_source: e.target.value })}>
              <option value="any">Any Source</option><option value="facebook">Facebook</option><option value="google">Google</option><option value="tiktok">TikTok</option><option value="website">Website</option><option value="lead_form">Lead Form</option>
            </select>
            <div>
              <label className="text-sm font-medium text-ink-secondary">Conditions:</label>
              {form.conditions.map((c, i) => (
                <div key={i} className="flex gap-2 mt-2">
                  <select className="input flex-1" value={c.field} onChange={e => setForm({ ...form, conditions: form.conditions.map((x, idx) => idx === i ? { ...x, field: e.target.value } : x) })}>{fields.map(f => <option key={f} value={f}>{f}</option>)}</select>
                  <select className="input w-32" value={c.operator} onChange={e => setForm({ ...form, conditions: form.conditions.map((x, idx) => idx === i ? { ...x, operator: e.target.value } : x) })}>{operators.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}</select>
                  <input className="input flex-1" placeholder="Value" value={c.value} onChange={e => setForm({ ...form, conditions: form.conditions.map((x, idx) => idx === i ? { ...x, value: e.target.value } : x) })} />
                </div>
              ))}
              <button onClick={() => setForm({ ...form, conditions: [...form.conditions, { field: 'city', operator: 'equals', value: '' }] })} className="text-xs text-ink-secondary mt-2">+ Add Condition</button>
            </div>
            <div>
              <label className="text-sm font-medium text-ink-secondary">Actions:</label>
              {form.actions.map((a, i) => (
                <div key={i} className="flex gap-2 mt-2">
                  <select className="input flex-1" value={a.type} onChange={e => setForm({ ...form, actions: form.actions.map((x, idx) => idx === i ? { ...x, type: e.target.value } : x) })}>{actionTypes.map(a => <option key={a.v} value={a.v}>{a.l}</option>)}</select>
                  {a.type !== 'assign_round_robin' && a.type !== 'send_to_distribution' && <input className="input flex-1" placeholder="Value" value={a.value} onChange={e => setForm({ ...form, actions: form.actions.map((x, idx) => idx === i ? { ...x, value: e.target.value } : x) })} />}
                </div>
              ))}
              <button onClick={() => setForm({ ...form, actions: [...form.actions, { type: 'add_tag', value: '' }] })} className="text-xs text-ink-secondary mt-2">+ Add Action</button>
            </div>
            <button onClick={handleCreate} className="w-full px-4 py-2.5 rounded-lg btn btn-primary transition-colors">Create Rule</button>
          </div>
        </div>
      </div>
    );
  }
}
