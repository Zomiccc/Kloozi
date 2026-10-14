import { useState, useEffect } from 'react';
import API from '../lib/api';
import toast from 'react-hot-toast';
import { Plus, X } from 'lucide-react';
import { pillStyle } from '../components/ui';

export default function Integrations() {
  const [integrations, setIntegrations] = useState([]);
  const [webhooks, setWebhooks] = useState([]);
  const [forms, setForms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('integrations');
  const [showConnect, setShowConnect] = useState(null);

  useEffect(() => { loadAll(); }, []);

  const loadAll = async () => {
    try {
      const [intRes, whRes, formRes] = await Promise.all([
        API.get('/integrations'), API.get('/integrations/webhooks'), API.get('/integrations/embed-forms'),
      ]);
      setIntegrations(intRes.data.integrations);
      setWebhooks(whRes.data.webhooks);
      setForms(formRes.data.forms);
    } catch { toast.error('Failed to load integrations'); }
    finally { setLoading(false); }
  };

  const handleConnect = async (type, credentials) => {
    try { await API.post('/integrations/connect', { type, credentials }); toast.success(`${type} connected`); setShowConnect(null); loadAll(); }
    catch { toast.error('Connection failed'); }
  };

  const handleDisconnect = async (id) => {
    try { await API.delete(`/integrations/${id}/disconnect`); toast.success('Disconnected'); loadAll(); }
    catch { toast.error('Failed'); }
  };

  const handleCreateWebhook = async () => {
    try { await API.post('/integrations/webhooks', { type: 'zapier' }); toast.success('Webhook created'); loadAll(); }
    catch { toast.error('Failed'); }
  };

  const handleCreateForm = async () => {
    try { await API.post('/integrations/embed-forms', { name: 'Website Form ' + Date.now(), fields: [{ name: 'first_name', label: 'First Name', type: 'text', required: true }, { name: 'phone', label: 'Phone', type: 'text', required: true }, { name: 'email', label: 'Email', type: 'email' }] }); toast.success('Form created'); loadAll(); }
    catch { toast.error('Failed'); }
  };

  const availableIntegrations = [
    { type: 'facebook', name: 'Facebook Lead Ads' },
    { type: 'google', name: 'Google Lead Forms' },
    { type: 'tiktok', name: 'TikTok Lead Ads' },
    { type: 'instagram', name: 'Instagram Lead Ads' },
    { type: 'whatsapp', name: 'WhatsApp Business' },
    { type: 'sendgrid', name: 'SendGrid Email' },
    { type: 'twilio', name: 'Twilio SMS' },
    { type: 'stripe', name: 'Stripe Payments' },
    { type: 'zapier', name: 'Zapier Webhook' },
  ];

  const tabs = [
    { key: 'integrations', label: 'Connected' },
    { key: 'webhooks', label: 'Webhooks' },
    { key: 'forms', label: 'Embed Forms' },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-ink-primary" style={{ fontSize: '32px', fontWeight: 650, letterSpacing: '-0.01em' }}>Integrations</h1>

      {/* Tab rail */}
      <div className="hairline pt-4 flex items-center gap-5">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className="text-sm font-medium transition-colors"
            style={{
              color: tab === t.key ? '#1C1917' : '#A8A29E',
              borderBottom: tab === t.key ? '2px solid #EDE9FF' : 'none',
              paddingBottom: '4px',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => <div key={i} className="skeleton h-12" />)}
        </div>
      ) : (
        <>
          {tab === 'integrations' && (
            <div>
              {availableIntegrations.map(int => {
                const connected = integrations.find(i => i.type === int.type && i.is_connected);
                return (
                  <div key={int.type} className="group hairline-b py-4 flex items-center gap-4">
                    <div className="flex-1 min-w-0">
                      <p className="text-ink-primary" style={{ fontSize: '14px', fontWeight: 500 }}>{int.name}</p>
                      <span className=" flex-shrink-0" style={pillStyle(connected ? '#0E8A5F' : '#A8A29E')}>
                        {connected ? 'Connected' : 'Not connected'}
                      </span>
                    </div>
                    <div className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                      {connected ? (
                        <button onClick={() => handleDisconnect(connected.id)} className="text-ink-primary hover:text-accent-deep underline underline-offset-4 transition-colors" style={{ fontSize: '13px' }}>Disconnect</button>
                      ) : (
                        <button onClick={() => setShowConnect(int)} className="text-ink-primary hover:text-accent-deep underline underline-offset-4 transition-colors" style={{ fontSize: '13px' }}>Connect</button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {tab === 'webhooks' && (
            <div className="space-y-4">
              <button onClick={handleCreateWebhook} className="text-ink-primary hover:text-accent-deep underline underline-offset-4 transition-colors" style={{ fontSize: '15px', fontWeight: 600 }}>Create webhook</button>
              {webhooks.length > 0 ? (
                <div>
                  {webhooks.map(wh => (
                    <div key={wh.id} className="group hairline-b py-4 flex items-center gap-4">
                      <div className="flex-1 min-w-0">
                        <p className="text-ink-primary capitalize" style={{ fontSize: '14px', fontWeight: 500 }}>{wh.type}</p>
                        <p className="text-ink-tertiary mono truncate" style={{ fontSize: '12px' }}>{wh.endpoint_url}</p>
                      </div>
                      <button onClick={() => { navigator.clipboard.writeText(wh.endpoint_url); toast.success('Copied!'); }} className="text-ink-primary hover:text-accent-deep underline underline-offset-4 transition-colors opacity-0 group-hover:opacity-100" style={{ fontSize: '13px' }}>Copy</button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-ink-tertiary" style={{ fontSize: '14px' }}>No webhooks yet</p>
              )}
            </div>
          )}

          {tab === 'forms' && (
            <div className="space-y-4">
              <button onClick={handleCreateForm} className="text-ink-primary hover:text-accent-deep underline underline-offset-4 transition-colors" style={{ fontSize: '15px', fontWeight: 600 }}>Create embed form</button>
              {forms.length > 0 ? (
                <div>
                  {forms.map(f => (
                    <div key={f.id} className="group hairline-b py-4 flex items-center gap-4">
                      <div className="flex-1 min-w-0">
                        <p className="text-ink-primary" style={{ fontSize: '14px', fontWeight: 500 }}>{f.name}</p>
                        <p className="text-ink-tertiary mono" style={{ fontSize: '12px' }}>{f.fields?.length || 0} fields</p>
                      </div>
                      <button onClick={async () => { try { const res = await API.get(`/integrations/embed-forms/${f.id}/code`); navigator.clipboard.writeText(res.data.embedCode); toast.success('Embed code copied!'); } catch { toast.error('Failed'); } }} className="text-ink-primary hover:text-accent-deep underline underline-offset-4 transition-colors opacity-0 group-hover:opacity-100" style={{ fontSize: '13px' }}>Get embed code</button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-ink-tertiary" style={{ fontSize: '14px' }}>No embed forms yet</p>
              )}
            </div>
          )}
        </>
      )}

      {showConnect && <ConnectModal integration={showConnect} onClose={() => setShowConnect(null)} onConnect={handleConnect} />}
    </div>
  );
}

function ConnectModal({ integration, onClose, onConnect }) {
  const [credentials, setCredentials] = useState({});
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(28,25,23,0.25)' }} onClick={onClose}>
      <div className="card-raised w-full max-w-md animate-scale-in" style={{ borderRadius: '10px' }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between hairline-b pb-4 mb-4">
          <h2 className="text-ink-primary" style={{ fontSize: '22px', fontWeight: 600 }}>Connect {integration.name}</h2>
          <button onClick={onClose} className="text-ink-tertiary hover:text-ink-primary transition-colors"><X size={18} /></button>
        </div>
        <div className="space-y-4">
          <div>
            <p className="meta-label mb-1">API key / access token</p>
            <input className="input" value={credentials.api_key || ''} onChange={(e) => setCredentials({ ...credentials, api_key: e.target.value })} />
          </div>
          <div>
            <p className="meta-label mb-1">Additional credential (optional)</p>
            <input className="input" value={credentials.api_secret || ''} onChange={(e) => setCredentials({ ...credentials, api_secret: e.target.value })} />
          </div>
          <div className="flex justify-end gap-3 hairline pt-4">
            <button onClick={onClose} className="text-ink-secondary hover:text-ink-primary underline underline-offset-4 transition-colors" style={{ fontSize: '14px' }}>Cancel</button>
            <button onClick={() => onConnect(integration.type, credentials)} className="btn btn-primary">Connect</button>
          </div>
        </div>
      </div>
    </div>
  );
}
