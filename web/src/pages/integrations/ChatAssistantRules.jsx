import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import API from '../../lib/api';
import toast from 'react-hot-toast';
import { ArrowLeft, Bot, Plus, Trash2, Zap, Save } from 'lucide-react';

export default function ChatAssistantRules() {
  const navigate = useNavigate();
  const [rules, setRules] = useState([]);
  const [showCreate, setShowCreate] = useState(false);

  useEffect(() => { loadRules(); }, []);
  const loadRules = async () => { try { const res = await API.get('/automations/chat-assistant'); setRules(res.data.rules || []); } catch {} };

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
    { value: 'send_template', label: 'Send Template' },
    { value: 'send_file', label: 'Send File' },
    { value: 'create_lead', label: 'Create Lead' },
    { value: 'assign_agent', label: 'Assign to Agent' },
    { value: 'add_tag', label: 'Add Tag' },
    { value: 'change_stage', label: 'Change Stage' },
  ];

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <button onClick={() => navigate('/automations')} className="flex items-center gap-2 text-sm text-dark-400 hover:text-dark-600"><ArrowLeft size={16} /> Back to Automations</button>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center"><Bot size={24} className="text-green-600" /></div>
          <div><h2 className="text-xl font-bold text-dark-900">WhatsApp Chat Assistant</h2><p className="text-sm text-dark-400">Configure automated response rules for incoming WhatsApp messages</p></div>
        </div>
        <button onClick={() => setShowCreate(true)} className="btn btn-primary flex items-center gap-2"><Plus size={16} /> New Rule</button>
      </div>

      <div className="bg-blue-50 rounded-lg p-4">
        <p className="text-sm text-blue-800">Rules run 24/7 even when agent is offline. Each rule has a trigger condition and action.</p>
      </div>

      {rules.length === 0 ? (
        <div className="card text-center py-12"><Bot size={48} className="text-dark-300 mx-auto mb-3" /><p className="text-dark-400">No rules configured yet</p></div>
      ) : (
        <div className="space-y-3">
          {rules.map(r => (
            <div key={r.id} className="card flex items-center justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2"><span className="font-medium text-dark-900">{r.name}</span><span className={`badge ${r.is_active ? 'bg-green-100 text-green-700' : 'bg-dark-100 text-dark-600'}`}>{r.is_active ? 'Active' : 'Inactive'}</span></div>
                <p className="text-xs text-dark-400 mt-1">IF {r.trigger_condition} "{r.trigger_value}" → {r.action_type}: {r.action_value}</p>
              </div>
              <button onClick={() => handleDelete(r.id)} className="text-red-500 p-2"><Trash2 size={16} /></button>
            </div>
          ))}
        </div>
      )}

      {showCreate && <CreateRuleModal triggerConditions={triggerConditions} actionTypes={actionTypes} onClose={() => setShowCreate(false)} onCreated={() => { setShowCreate(false); loadRules(); }} />}
    </div>
  );

  function CreateRuleModal({ triggerConditions, actionTypes, onClose, onCreated }) {
    const [form, setForm] = useState({ name: '', trigger_condition: 'contains', trigger_value: '', action_type: 'send_template', action_value: '', is_active: true });
    const handleCreate = async () => {
      if (!form.name || !form.action_value) return toast.error('Fill all fields');
      try { await API.post('/automations/chat-assistant', form); toast.success('Rule created'); onCreated(); } catch { toast.error('Failed'); }
    };
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl p-6 w-full max-w-md">
          <div className="flex items-center justify-between mb-4"><h2 className="text-xl font-bold">New Chat Assistant Rule</h2><button onClick={onClose}>✕</button></div>
          <div className="space-y-3">
            <input className="input" placeholder="Rule name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
            <select className="input" value={form.trigger_condition} onChange={e => setForm({ ...form, trigger_condition: e.target.value })}>{triggerConditions.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}</select>
            <input className="input" placeholder='Trigger value (e.g. "price")' value={form.trigger_value} onChange={e => setForm({ ...form, trigger_value: e.target.value })} />
            <select className="input" value={form.action_type} onChange={e => setForm({ ...form, action_type: e.target.value })}>{actionTypes.map(a => <option key={a.value} value={a.value}>{a.label}</option>)}</select>
            <input className="input" placeholder="Action value (template name, file name, agent name, tag, stage)" value={form.action_value} onChange={e => setForm({ ...form, action_value: e.target.value })} />
            <label className="flex items-center gap-2"><input type="checkbox" checked={form.is_active} onChange={e => setForm({ ...form, is_active: e.target.checked })} /> <span className="text-sm">Active</span></label>
            <button onClick={handleCreate} className="btn btn-primary w-full">Create Rule</button>
          </div>
        </div>
      </div>
    );
  }
}
