import { useState, useEffect } from 'react';
import API from '../lib/api';
import toast from 'react-hot-toast';
import { Plug, Trash2, Plus, Link, Code, X } from 'lucide-react';

export default function Integrations() {
  const [integrations, setIntegrations] = useState([]);
  const [webhooks, setWebhooks] = useState([]);
  const [forms, setForms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('integrations');
  const [showConnect, setShowConnect] = useState(null);
  const [showEmbed, setShowEmbed] = useState(null);

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
    { type: 'facebook', name: 'Facebook Lead Ads', icon: '📘', color: 'bg-blue-50' },
    { type: 'google', name: 'Google Lead Forms', icon: '🔍', color: 'bg-red-50' },
    { type: 'tiktok', name: 'TikTok Lead Ads', icon: '🎵', color: 'bg-dark-50' },
    { type: 'instagram', name: 'Instagram Lead Ads', icon: '📷', color: 'bg-purple-50' },
    { type: 'whatsapp', name: 'WhatsApp Business', icon: '💬', color: 'bg-green-50' },
    { type: 'sendgrid', name: 'SendGrid Email', icon: '📧', color: 'bg-blue-50' },
    { type: 'twilio', name: 'Twilio SMS', icon: '📱', color: 'bg-red-50' },
    { type: 'stripe', name: 'Stripe Payments', icon: '💳', color: 'bg-purple-50' },
    { type: 'zapier', name: 'Zapier Webhook', icon: '⚡', color: 'bg-orange-50' },
  ];

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-dark-900">Integrations</h1>

      <div className="flex gap-2 border-b border-dark-100">
        <button onClick={() => setTab('integrations')} className={`px-4 py-2 text-sm font-medium ${tab === 'integrations' ? 'text-primary-600 border-b-2 border-primary-600' : 'text-dark-400'}`}>Connected</button>
        <button onClick={() => setTab('webhooks')} className={`px-4 py-2 text-sm font-medium ${tab === 'webhooks' ? 'text-primary-600 border-b-2 border-primary-600' : 'text-dark-400'}`}>Webhooks</button>
        <button onClick={() => setTab('forms')} className={`px-4 py-2 text-sm font-medium ${tab === 'forms' ? 'text-primary-600 border-b-2 border-primary-600' : 'text-dark-400'}`}>Embed Forms</button>
      </div>

      {tab === 'integrations' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {availableIntegrations.map(int => {
            const connected = integrations.find(i => i.type === int.type && i.is_connected);
            return (
              <div key={int.type} className="card flex items-center gap-4">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl ${int.color}`}>{int.icon}</div>
                <div className="flex-1"><h3 className="font-semibold text-dark-900">{int.name}</h3><p className="text-xs text-dark-400">{connected ? 'Connected' : 'Not connected'}</p></div>
                {connected ? <button onClick={() => handleDisconnect(connected.id)} className="btn btn-danger text-sm py-1.5">Disconnect</button> : <button onClick={() => setShowConnect(int)} className="btn btn-primary text-sm py-1.5">Connect</button>}
              </div>
            );
          })}
        </div>
      )}

      {tab === 'webhooks' && (
        <div className="space-y-4">
          <button onClick={handleCreateWebhook} className="btn btn-primary flex items-center gap-2"><Plus size={16} /> Create Webhook</button>
          {webhooks.map(wh => (
            <div key={wh.id} className="card flex items-center gap-4">
              <Link size={20} className="text-primary-600" />
              <div className="flex-1"><p className="text-sm font-medium capitalize">{wh.type}</p><p className="text-xs text-dark-400 font-mono break-all">{wh.endpoint_url}</p></div>
              <button onClick={() => { navigator.clipboard.writeText(wh.endpoint_url); toast.success('Copied!'); }} className="btn btn-secondary text-sm py-1.5">Copy</button>
            </div>
          ))}
          {webhooks.length === 0 && <p className="text-dark-400 text-sm">No webhooks yet</p>}
        </div>
      )}

      {tab === 'forms' && (
        <div className="space-y-4">
          <button onClick={handleCreateForm} className="btn btn-primary flex items-center gap-2"><Plus size={16} /> Create Embed Form</button>
          {forms.map(f => (
            <div key={f.id} className="card flex items-center gap-4">
              <Code size={20} className="text-primary-600" />
              <div className="flex-1"><p className="text-sm font-medium">{f.name}</p><p className="text-xs text-dark-400">{f.fields?.length || 0} fields</p></div>
              <button onClick={async () => { try { const res = await API.get(`/integrations/embed-forms/${f.id}/code`); navigator.clipboard.writeText(res.data.embedCode); toast.success('Embed code copied!'); } catch { toast.error('Failed'); } }} className="btn btn-secondary text-sm py-1.5">Get Embed Code</button>
            </div>
          ))}
          {forms.length === 0 && <p className="text-dark-400 text-sm">No embed forms yet</p>}
        </div>
      )}

      {showConnect && <ConnectModal integration={showConnect} onClose={() => setShowConnect(null)} onConnect={handleConnect} />}
    </div>
  );
}

function ConnectModal({ integration, onClose, onConnect }) {
  const [credentials, setCredentials] = useState({});
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl p-6 w-full max-w-md">
        <div className="flex items-center justify-between mb-4"><h2 className="text-xl font-bold">Connect {integration.name}</h2><button onClick={onClose}><X size={20} /></button></div>
        <div className="space-y-3">
          <input className="input" placeholder="API Key / Access Token" value={credentials.api_key || ''} onChange={(e) => setCredentials({ ...credentials, api_key: e.target.value })} />
          <input className="input" placeholder="Additional credential (optional)" value={credentials.api_secret || ''} onChange={(e) => setCredentials({ ...credentials, api_secret: e.target.value })} />
          <button onClick={() => onConnect(integration.type, credentials)} className="btn btn-primary w-full">Connect</button>
        </div>
      </div>
    </div>
  );
}
