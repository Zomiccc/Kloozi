import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import API from '../../lib/api';
import toast from 'react-hot-toast';
import { ArrowLeft, Bot, Save, AlertCircle } from 'lucide-react';
import BrandLogo from '../../components/BrandLogo';

export default function WhatsAppAIAgent() {
  const navigate = useNavigate();
  const [config, setConfig] = useState({ is_enabled: false, extract_fields: ['name', 'budget', 'interest', 'product'], auto_reply: true, system_prompt: '' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => { loadConfig(); }, []);

  const loadConfig = async () => {
    try {
      const res = await API.get('/automations/whatsapp-ai-agent');
      setConfig(res.data.config);
    } catch { toast.error('Failed to load config'); }
    finally { setLoading(false); }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await API.put('/automations/whatsapp-ai-agent', config);
      toast.success('AI Agent settings saved');
    } catch { toast.error('Failed to save'); }
    finally { setSaving(false); }
  };

  const toggleField = (field) => {
    setConfig(prev => ({
      ...prev,
      extract_fields: prev.extract_fields.includes(field)
        ? prev.extract_fields.filter(f => f !== field)
        : [...prev.extract_fields, field]
    }));
  };

  const availableFields = ['name', 'budget', 'interest', 'product', 'city', 'email', 'phone', 'message'];

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <button onClick={() => navigate('/app/automations')} className="flex items-center gap-2 text-sm text-ink-secondary hover:text-ink-primary"><ArrowLeft size={16} /> Back to Automations</button>

      <div className="flex items-center gap-3">
        <div className="w-12 h-12 bg-surface-page rounded-xl flex items-center justify-center"><Bot size={24} className="text-ink-secondary" /></div>
        <div><h2 className="text-xl font-bold text-ink-primary">WhatsApp AI Agent Lite</h2><p className="text-sm text-ink-secondary">AI-powered lead extraction and responses</p></div>
      </div>

      <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-4 flex items-start gap-3">
        <AlertCircle size={20} className="text-amber-400 flex-shrink-0 mt-0.5" />
        <div><p className="text-sm font-medium text-amber-400">Requires OpenAI API Key</p><p className="text-xs text-amber-500/80 mt-1">Set OPENAI_API_KEY in backend .env to enable AI features.</p></div>
      </div>

      {loading ? <div className="flex justify-center py-8"><div className="animate-spin w-8 h-8 border-4 border-surface-border border-t-accent-blue rounded-full" /></div> : (
        <div className="card space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-ink-primary">Enable AI Agent</h3>
              <p className="text-sm text-ink-secondary">When enabled, AI will process new WhatsApp messages from unknown numbers</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" className="sr-only peer" checked={config.is_enabled} onChange={e => setConfig(prev => ({ ...prev, is_enabled: e.target.checked }))} />
              <div className="w-11 h-6 bg-surface-border peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-accent-blue"></div>
            </label>
          </div>

          <div>
            <h3 className="font-semibold text-ink-primary mb-3">Extract Fields</h3>
            <p className="text-sm text-ink-secondary mb-3">Select which fields the AI should try to extract from messages</p>
            <div className="flex flex-wrap gap-2">
              {availableFields.map(field => (
                <label key={field} className="flex items-center gap-2 px-3 py-2 rounded-lg border border-surface-border cursor-pointer hover:bg-surface-hover transition-colors">
                  <input type="checkbox" checked={config.extract_fields.includes(field)} onChange={() => toggleField(field)} />
                  <span className="text-sm text-ink-primary capitalize">{field}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-ink-primary">Auto-Reply</h3>
              <p className="text-sm text-ink-secondary">Generate and send AI replies automatically</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" className="sr-only peer" checked={config.auto_reply} onChange={e => setConfig(prev => ({ ...prev, auto_reply: e.target.checked }))} />
              <div className="w-11 h-6 bg-surface-border peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-accent-blue"></div>
            </label>
          </div>

          <div>
            <h3 className="font-semibold text-ink-primary mb-3">Custom System Prompt (Optional)</h3>
            <p className="text-sm text-ink-secondary mb-3">Override the default AI behavior with a custom prompt</p>
            <textarea
              className="input"
              rows={4}
              value={config.system_prompt}
              onChange={e => setConfig(prev => ({ ...prev, system_prompt: e.target.value }))}
              placeholder="Leave blank to use default prompt..."
            />
          </div>

          <button onClick={handleSave} disabled={saving} className="w-full px-4 py-2.5 rounded-lg btn btn-primary flex items-center justify-center gap-2 transition-colors disabled:opacity-50">
            <Save size={16} /> {saving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      )}
    </div>
  );
}
