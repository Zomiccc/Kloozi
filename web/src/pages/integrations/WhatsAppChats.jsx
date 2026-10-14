import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import API from '../../lib/api';
import toast from 'react-hot-toast';
import { ArrowLeft } from 'lucide-react';

export default function WhatsAppChats() {
  const navigate = useNavigate();
  const [config, setConfig] = useState({ is_enabled: false, auto_assign_to: null, default_stage: 'new' });
  const [agents, setAgents] = useState([]);
  const [stages, setStages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => { loadConfig(); loadAgents(); loadStages(); }, []);

  const loadConfig = async () => {
    try {
      const res = await API.get('/automations/whatsapp-auto-create');
      setConfig(res.data.config);
    } catch { toast.error('Failed to load config'); }
    finally { setLoading(false); }
  };

  const loadAgents = async () => {
    try {
      const res = await API.get('/users?role=sales_agent');
      setAgents(res.data.users || []);
    } catch {}
  };

  const loadStages = async () => {
    try {
      const res = await API.get('/lead-stages');
      setStages(res.data.stages || []);
    } catch {}
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await API.put('/automations/whatsapp-auto-create', config);
      toast.success('Settings saved');
    } catch { toast.error('Failed to save'); }
    finally { setSaving(false); }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <button onClick={() => navigate('/app/automations')} className="btn-ghost text-sm font-medium flex items-center gap-1.5">
        <ArrowLeft size={14} /> Automations
      </button>

      <div>
        <h1 style={{ fontSize: '32px', fontWeight: 650, letterSpacing: '-0.01em' }}>WhatsApp Chats</h1>
        <p className="text-ink-secondary mt-1" style={{ fontSize: '15px' }}>
          Turn every unknown WhatsApp number into a lead automatically — no copy-pasting.
        </p>
      </div>

      {loading ? (
        <div className="space-y-2">{[1, 2, 3].map((i) => <div key={i} className="skeleton h-14" />)}</div>
      ) : (
        <div className="space-y-7">
          {/* The switch — the page's single decision */}
          <label className="hairline-b pb-6 flex items-start justify-between gap-4 cursor-pointer select-none group">
            <span>
              <span className="font-semibold block" style={{ fontSize: '16px' }}>Auto-create leads</span>
              <span className="text-ink-secondary block mt-1" style={{ fontSize: '14px' }}>
                When a brand-new number messages you, a lead appears with the conversation attached — in real time via webhook.
              </span>
            </span>
            <input
              type="checkbox"
              className="sr-only"
              checked={!!config.is_enabled}
              onChange={(e) => setConfig((prev) => ({ ...prev, is_enabled: e.target.checked }))}
            />
            <span
              aria-hidden
              className={`relative inline-block w-10 h-[22px] flex-shrink-0 mt-1 transition-colors duration-150 ${config.is_enabled ? '' : 'bg-[#E7E5E4]'}`}
              style={config.is_enabled ? { background: '#EDE9FF' } : {}}
            >
              <span
                className="absolute top-[3px] w-4 h-4 bg-white transition-all duration-150"
                style={{ left: config.is_enabled ? '22px' : '3px', borderRadius: '8px' }}
              />
            </span>
          </label>

          <div className={`transition-opacity ${config.is_enabled ? '' : 'opacity-40 pointer-events-none'}`}>
            <p className="meta-label mb-1">Auto-assign to agent</p>
            <select
              className="input"
              value={config.auto_assign_to || ''}
              onChange={(e) => setConfig((prev) => ({ ...prev, auto_assign_to: e.target.value || null }))}
            >
              <option value="">Round robin (default)</option>
              {agents.map((agent) => (
                <option key={agent.id} value={agent.id}>{agent.first_name} {agent.last_name}</option>
              ))}
            </select>

            <p className="meta-label mb-1 mt-6">Default stage for new chat leads</p>
            <select
              className="input"
              value={config.default_stage || 'new'}
              onChange={(e) => setConfig((prev) => ({ ...prev, default_stage: e.target.value }))}
            >
              {stages.map((stage) => (
                <option key={stage.id} value={stage.name}>{stage.name}</option>
              ))}
            </select>
          </div>

          <button onClick={handleSave} disabled={saving} className="btn btn-primary w-full sm:w-auto">
            {saving ? 'Saving…' : 'Save settings'}
          </button>
        </div>
      )}
    </div>
  );
}
