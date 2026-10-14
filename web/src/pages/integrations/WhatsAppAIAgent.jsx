import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import API from '../../lib/api';
import toast from 'react-hot-toast';
import { ArrowLeft } from 'lucide-react';

const availableFields = ['name', 'budget', 'interest', 'product', 'city', 'email', 'phone', 'message'];

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
      toast.success('AI agent settings saved');
    } catch { toast.error('Failed to save'); }
    finally { setSaving(false); }
  };

  const toggleField = (field) => {
    setConfig((prev) => ({
      ...prev,
      extract_fields: prev.extract_fields.includes(field)
        ? prev.extract_fields.filter((f) => f !== field)
        : [...prev.extract_fields, field],
    }));
  };

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <button onClick={() => navigate('/app/automations')} className="btn-ghost text-sm font-medium flex items-center gap-1.5">
        <ArrowLeft size={14} /> Automations
      </button>

      <div>
        <h1 style={{ fontSize: '32px', fontWeight: 650, letterSpacing: '-0.01em' }}>AI Agent Lite</h1>
        <p className="text-ink-secondary mt-1" style={{ fontSize: '15px' }}>
          An AI that reads incoming WhatsApp messages, pulls out the details that matter, and can reply on your behalf.
        </p>
      </div>

      <div className="hairline p-4 flex items-start gap-3" style={{ borderLeft: '2px solid #B45309' }}>
        <div>
          <p style={{ fontSize: '14px', fontWeight: 600, color: '#B45309' }}>Requires an OpenAI key</p>
          <p className="text-ink-secondary mt-0.5" style={{ fontSize: '13px' }}>
            Set <span className="mono">OPENAI_API_KEY</span> in your backend <span className="mono">.env</span> — until then these features stay dormant, nothing breaks.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="space-y-2">{[1, 2, 3].map((i) => <div key={i} className="skeleton h-14" />)}</div>
      ) : (
        <div className="space-y-7">
          {/* Enable */}
          <label className="hairline-b pb-6 flex items-start justify-between gap-4 cursor-pointer select-none">
            <span>
              <span className="font-semibold block" style={{ fontSize: '16px' }}>Enable AI agent</span>
              <span className="text-ink-secondary block mt-1" style={{ fontSize: '14px' }}>
                New WhatsApp messages from unknown numbers get read and processed by the AI.
              </span>
            </span>
            <input type="checkbox" className="sr-only" checked={!!config.is_enabled} onChange={(e) => setConfig((prev) => ({ ...prev, is_enabled: e.target.checked }))} />
            <span
              aria-hidden
              className={`relative inline-block w-10 h-[22px] flex-shrink-0 mt-1 transition-colors duration-150 ${config.is_enabled ? '' : 'bg-[#E7E5E4]'}`}
              style={config.is_enabled ? { background: '#EDE9FF' } : {}}
            >
              <span className="absolute top-[3px] w-4 h-4 bg-white transition-all duration-150" style={{ left: config.is_enabled ? '22px' : '3px', borderRadius: '8px' }} />
            </span>
          </label>

          <div className={`transition-opacity ${config.is_enabled ? '' : 'opacity-40 pointer-events-none'}`}>
            {/* Extract fields */}
            <div>
              <p className="meta-label mb-1">Extract from every message</p>
              <p className="text-ink-secondary mb-3" style={{ fontSize: '13px' }}>Pick what the AI should look for and save onto the lead.</p>
              <div className="flex flex-wrap gap-2">
                {availableFields.map((field) => {
                  const active = config.extract_fields.includes(field);
                  return (
                    <button
                      key={field}
                      type="button"
                      onClick={() => toggleField(field)}
                      className={`text-sm transition-all ${active ? 'font-semibold text-white' : 'text-ink-secondary hover:text-ink-primary'}`}
                      style={{
                        padding: '6px 14px',
                        borderRadius: '8px',
                        background: active ? '#1C1917' : 'transparent',
                        border: `1px solid ${active ? '#1C1917' : '#E7E5E4'}`,
                      }}
                    >
                      {field}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Auto reply */}
            <label className="hairline-b py-6 mt-7 flex items-start justify-between gap-4 cursor-pointer select-none">
              <span>
                <span className="font-semibold block" style={{ fontSize: '16px' }}>Auto-reply</span>
                <span className="text-ink-secondary block mt-1" style={{ fontSize: '14px' }}>
                  The AI writes and sends its own response immediately.
                </span>
              </span>
              <input type="checkbox" className="sr-only" checked={!!config.auto_reply} onChange={(e) => setConfig((prev) => ({ ...prev, auto_reply: e.target.checked }))} />
              <span
                aria-hidden
                className={`relative inline-block w-10 h-[22px] flex-shrink-0 mt-1 transition-colors duration-150 ${config.auto_reply ? '' : 'bg-[#E7E5E4]'}`}
                style={config.auto_reply ? { background: '#EDE9FF' } : {}}
              >
                <span className="absolute top-[3px] w-4 h-4 bg-white transition-all duration-150" style={{ left: config.auto_reply ? '22px' : '3px', borderRadius: '8px' }} />
              </span>
            </label>

            {/* System prompt */}
            <div className="mt-7">
              <p className="meta-label mb-1">Custom system prompt · optional</p>
              <textarea
                className="input"
                rows={4}
                value={config.system_prompt || ''}
                onChange={(e) => setConfig((prev) => ({ ...prev, system_prompt: e.target.value }))}
                placeholder="Leave blank to use the default prompt…"
              />
            </div>
          </div>

          <button onClick={handleSave} disabled={saving} className="btn btn-primary w-full sm:w-auto">
            {saving ? 'Saving…' : 'Save settings'}
          </button>
        </div>
      )}
    </div>
  );
}
