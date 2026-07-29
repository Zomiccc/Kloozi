import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import API from '../../lib/api';
import toast from 'react-hot-toast';
import { ArrowLeft, MessageSquare, ToggleRight, Users } from 'lucide-react';
import BrandLogo from '../../components/BrandLogo';

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
    <div className="max-w-2xl mx-auto space-y-6">
      <button onClick={() => navigate('/app/automations')} className="flex items-center gap-2 text-sm text-ink-secondary hover:text-ink-primary"><ArrowLeft size={16} /> Back to Automations</button>

      <div className="flex items-center gap-3">
        <div className="w-12 h-12 bg-surface-page rounded-xl flex items-center justify-center"><BrandLogo brand="whatsapp" /></div>
        <div><h2 className="text-xl font-bold text-ink-primary">WhatsApp Chats</h2><p className="text-sm text-ink-secondary">Auto-create leads from WhatsApp conversations</p></div>
      </div>

      {loading ? <div className="flex justify-center py-8"><div className="animate-spin w-8 h-8 border-4 border-surface-border border-t-accent-blue rounded-full" /></div> : (
        <div className="card space-y-6">
          <div className="bg-surface-page border border-surface-border rounded-lg p-4 flex items-start gap-3">
            <MessageSquare size={20} className="text-ink-secondary flex-shrink-0" />
            <div><p className="text-sm font-medium text-ink-secondary">How it works:</p><p className="text-xs text-ink-tertiary mt-1">When enabled, any new WhatsApp number that messages your connected number will automatically create a lead record. This works in real-time via the webhook.</p></div>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-ink-primary">Enable Auto-Create</h3>
              <p className="text-sm text-ink-secondary">Automatically create leads from new WhatsApp numbers</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" className="sr-only peer" checked={config.is_enabled} onChange={e => setConfig(prev => ({ ...prev, is_enabled: e.target.checked }))} />
              <div className="w-11 h-6 bg-surface-border peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-accent-blue"></div>
            </label>
          </div>

          <div>
            <label className="text-sm font-medium text-ink-secondary">Auto-Assign To Agent</label>
            <select className="input mt-1" value={config.auto_assign_to || ''} onChange={e => setConfig(prev => ({ ...prev, auto_assign_to: e.target.value || null }))}>
              <option value="">Round Robin (default)</option>
              {agents.map(agent => (
                <option key={agent.id} value={agent.id}>{agent.first_name} {agent.last_name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-sm font-medium text-ink-secondary">Default Stage</label>
            <select className="input mt-1" value={config.default_stage} onChange={e => setConfig(prev => ({ ...prev, default_stage: e.target.value }))}>
              {stages.map(stage => (
                <option key={stage.id} value={stage.name}>{stage.name}</option>
              ))}
            </select>
          </div>

          <button onClick={handleSave} disabled={saving} className="w-full px-4 py-2.5 rounded-lg btn btn-primary flex items-center justify-center gap-2 transition-colors disabled:opacity-50">
            <ToggleRight size={16} /> {saving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      )}
    </div>
  );
}
