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
      <button onClick={() => navigate('/automations')} className="flex items-center gap-2 text-sm text-dark-400 hover:text-dark-600"><ArrowLeft size={16} /> Back to Automations</button>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-primary-100 rounded-xl flex items-center justify-center"><Send size={24} className="text-primary-600" /></div>
          <div><h2 className="text-xl font-bold text-dark-900">Lead Distribution</h2><p className="text-sm text-dark-400">Forward leads to recipients via WhatsApp/email</p></div>
        </div>
        <button onClick={() => setShowConfig(true)} className="btn btn-primary flex items-center gap-2"><Plus size={16} /> New Distribution</button>
      </div>

      {configs.length === 0 ? (
        <div className="card text-center py-12"><Send size={48} className="text-dark-300 mx-auto mb-3" /><p className="text-dark-400">No distribution configs yet</p></div>
      ) : (
        <div className="space-y-3">
          {configs.map(c => (
            <div key={c.id} className="card flex items-center justify-between">
              <div><p className="font-medium text-dark-900 capitalize">Source: {c.source}</p><p className="text-xs text-dark-400">Mode: {c.mode} | Recipients: {typeof c.recipients === 'string' ? JSON.parse(c.recipients).length : c.recipients?.length || 0}</p></div>
            </div>
          ))}
        </div>
      )}

      {showConfig && <ConfigModal onClose={() => setShowConfig(false)} onSaved={() => { setShowConfig(false); loadConfigs(); }} />}
    </div>
  );

  function ConfigModal({ onClose, onSaved }) {
    const [source, setSource] = useState('any');
    const [mode, setMode] = useState('all');
    const [recipients, setRecipients] = useState([{ type: 'email', value: '' }]);

    const handleSave = async () => {
      try { await API.put('/automations/distribution', { source, mode, recipients }); toast.success('Distribution saved'); onSaved(); } catch { toast.error('Failed'); }
    };

    const recipientTypes = [{ v: 'email', l: 'Email' }, { v: 'whatsapp', l: 'WhatsApp' }, { v: 'team_member', l: 'Team Member' }];

    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl p-6 w-full max-w-md">
          <div className="flex items-center justify-between mb-4"><h2 className="text-xl font-bold">Distribution Config</h2><button onClick={onClose}>✕</button></div>
          <div className="space-y-3">
            <select className="input" value={source} onChange={e => setSource(e.target.value)}>
              <option value="any">Any Source</option><option value="facebook">Facebook</option><option value="google">Google</option><option value="tiktok">TikTok</option><option value="website">Website</option>
            </select>
            <select className="input" value={mode} onChange={e => setMode(e.target.value)}>
              <option value="all">All leads to all recipients</option><option value="round_robin">Round Robin</option>
            </select>
            <div>
              <label className="text-sm font-medium">Recipients:</label>
              {recipients.map((r, i) => (
                <div key={i} className="flex gap-2 mt-2">
                  <select className="input w-32" value={r.type} onChange={e => setRecipients(recipients.map((x, idx) => idx === i ? { ...x, type: e.target.value } : x))}>{recipientTypes.map(t => <option key={t.v} value={t.v}>{t.l}</option>)}</select>
                  <input className="input flex-1" placeholder="Email / WhatsApp number / User ID" value={r.value} onChange={e => setRecipients(recipients.map((x, idx) => idx === i ? { ...x, value: e.target.value } : x))} />
                </div>
              ))}
              <button onClick={() => setRecipients([...recipients, { type: 'email', value: '' }])} className="text-xs text-primary-600 mt-2">+ Add Recipient</button>
            </div>
            <button onClick={handleSave} className="btn btn-primary w-full">Save</button>
          </div>
        </div>
      </div>
    );
  }
}
