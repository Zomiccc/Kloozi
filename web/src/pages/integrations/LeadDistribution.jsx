import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import API from '../../lib/api';
import toast from 'react-hot-toast';
import { ArrowLeft, Send, Save, Plus, Trash2 } from 'lucide-react';

export default function LeadDistribution() {
  const navigate = useNavigate();
  const [configs, setConfigs] = useState([]);
  const [showConfig, setShowConfig] = useState(false);

  useEffect(() => { loadConfigs(); }, []);
  const loadConfigs = async () => { try { const res = await API.get('/automations/distribution'); setConfigs(res.data.configs || []); } catch {} };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <button onClick={() => navigate('/app/automations')} className="flex items-center gap-2 text-sm text-ink-secondary hover:text-ink-primary"><ArrowLeft size={16} /> Back to Automations</button>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-surface-page rounded-xl flex items-center justify-center"><Send size={24} className="text-ink-secondary" /></div>
          <div><h2 className="text-xl font-bold text-ink-primary">Lead Distribution</h2><p className="text-sm text-ink-secondary">Forward leads to recipients via WhatsApp/email</p></div>
        </div>
        <button onClick={() => setShowConfig(true)} className="px-4 py-2 rounded-lg btn btn-primary flex items-center gap-2 transition-colors"><Plus size={16} /> New Distribution</button>
      </div>

      {configs.length === 0 ? (
        <div className="card text-center py-12"><Send size={48} className="text-ink-tertiary mx-auto mb-3" /><p className="text-ink-secondary">No distribution configs yet</p></div>
      ) : (
        <div className="space-y-3">
          {configs.map(c => (
            <div key={c.id} className="card flex items-center justify-between">
              <div><p className="font-medium text-ink-primary capitalize">Type: {c.type}</p><p className="text-xs text-ink-tertiary">Recipients: {typeof c.config === 'string' ? JSON.parse(c.config).recipients?.length || 0 : c.config?.recipients?.length || 0}</p></div>
            </div>
          ))}
        </div>
      )}

      {showConfig && <ConfigModal onClose={() => setShowConfig(false)} onSaved={() => { setShowConfig(false); loadConfigs(); }} />}
    </div>
  );

  function ConfigModal({ onClose, onSaved }) {
    const [type, setType] = useState('round_robin');
    const [recipients, setRecipients] = useState([{ type: 'email', value: '' }]);

    const handleSave = async () => {
      try { await API.put('/automations/distribution', { type, config: { recipients } }); toast.success('Distribution saved'); onSaved(); } catch { toast.error('Failed'); }
    };

    const recipientTypes = [{ v: 'email', l: 'Email' }, { v: 'whatsapp', l: 'WhatsApp' }, { v: 'team_member', l: 'Team Member' }];

    return (
      <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50 p-4">
        <div className="bg-white border border-surface-border rounded-2xl p-6 w-full max-w-md shadow-modal">
          <div className="flex items-center justify-between mb-4"><h2 className="text-xl font-bold text-ink-primary">Distribution Config</h2><button onClick={onClose}>✕</button></div>
          <div className="space-y-3">
            <select className="input" value={type} onChange={e => setType(e.target.value)}>
              <option value="round_robin">Round Robin</option><option value="all">All Recipients</option>
            </select>
            <div>
              <label className="text-sm font-medium text-ink-secondary">Recipients:</label>
              {recipients.map((r, i) => (
                <div key={i} className="flex gap-2 mt-2">
                  <select className="input w-32" value={r.type} onChange={e => setRecipients(recipients.map((x, idx) => idx === i ? { ...x, type: e.target.value } : x))}>{recipientTypes.map(t => <option key={t.v} value={t.v}>{t.l}</option>)}</select>
                  <input className="input flex-1" placeholder="Email / WhatsApp number / User ID" value={r.value} onChange={e => setRecipients(recipients.map((x, idx) => idx === i ? { ...x, value: e.target.value } : x))} />
                </div>
              ))}
              <button onClick={() => setRecipients([...recipients, { type: 'email', value: '' }])} className="text-xs text-ink-secondary mt-2">+ Add Recipient</button>
            </div>
            <button onClick={handleSave} className="w-full px-4 py-2.5 rounded-lg btn btn-primary transition-colors">Save</button>
          </div>
        </div>
      </div>
    );
  }
}
