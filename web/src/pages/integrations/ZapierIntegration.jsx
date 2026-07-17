import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import API from '../../lib/api';
import toast from 'react-hot-toast';
import { ArrowLeft, Link2, Copy, Plus, Trash2, Send, Webhook, CheckCircle2 } from 'lucide-react';

export default function ZapierIntegration() {
  const navigate = useNavigate();
  const [webhooks, setWebhooks] = useState([]);
  const [token, setToken] = useState('');
  const [showCreate, setShowCreate] = useState(false);

  useEffect(() => { loadWebhooks(); loadToken(); }, []);

  const loadWebhooks = async () => {
    try { const res = await API.get('/integrations/webhooks'); setWebhooks(res.data.webhooks || []); } catch {}
  };
  const loadToken = async () => {
    try { const res = await API.get('/automations/account-token'); setToken(res.data.account_token); } catch {}
  };

  const handleCreate = async () => {
    try { await API.post('/integrations/webhooks', { type: 'zapier' }); toast.success('Webhook created'); setShowCreate(false); loadWebhooks(); } catch { toast.error('Failed'); }
  };
  const handleTest = async (url) => {
    try {
      const res = await fetch(`http://localhost:5000/api/integrations/lead/${token}/zapier`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ first_name: 'Test', phone: '+1234567890', email: 'test@test.com' })
      });
      if (res.ok) toast.success('Test lead sent!');
      else toast.error('Test failed');
    } catch { toast.error('Connection failed'); }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <button onClick={() => navigate('/automations')} className="flex items-center gap-2 text-sm text-dark-400 hover:text-dark-600"><ArrowLeft size={16} /> Back to Automations</button>

      <div className="card">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center"><Link2 size={24} className="text-orange-600" /></div>
          <div><h2 className="text-xl font-bold text-dark-900">Zapier & Webhooks</h2><p className="text-sm text-dark-400">Connect any other lead source via webhook</p></div>
        </div>

        <div className="bg-primary-50 rounded-lg p-4 mb-6">
          <label className="text-sm font-medium text-dark-700">Incoming Webhook URL:</label>
          <div className="flex items-center gap-2 mt-2">
            <code className="flex-1 bg-white px-3 py-2 rounded-lg text-sm text-dark-700 font-mono break-all">http://localhost:5000/api/integrations/lead/{token || '[TOKEN]'}/zapier</code>
            <button onClick={() => { navigator.clipboard.writeText(`http://localhost:5000/api/integrations/lead/${token}/zapier`); toast.success('Copied!'); }} className="btn btn-secondary p-2"><Copy size={16} /></button>
          </div>
          <p className="text-xs text-dark-400 mt-2">Send POST requests with JSON body containing: first_name, last_name, phone, email, city, budget, message, source</p>
        </div>

        <div className="card bg-dark-50">
          <h3 className="font-semibold text-dark-900 mb-3">Instructions for connecting via Zapier:</h3>
          <ol className="space-y-2 text-sm text-dark-600">
            {['Create a Zap in Zapier', 'Trigger: any app (Typeform, JotForm, Calendly, etc.)', 'Action: Webhooks by Zapier → POST', 'URL: paste the webhook URL above', 'Payload Type: JSON', 'Map fields to: first_name, last_name, phone, email, city, budget, message, source'].map((s, i) => (
              <li key={i} className="flex items-start gap-3"><div className="w-5 h-5 bg-primary-600 text-white rounded-full flex items-center justify-center text-xs flex-shrink-0">{i + 1}</div><span>{s}</span></li>
            ))}
          </ol>
        </div>

        <div className="mt-4">
          <button onClick={async () => {
            try {
              const res = await fetch(`http://localhost:5000/api/integrations/lead/${token}/zapier`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ first_name: 'Zapier', last_name: 'Test', email: 'zapier@test.com', phone: '+10000000000', message: 'Test from Zapier' })
              });
              if (res.ok) toast.success('Test lead sent! Check CRM to verify.');
              else toast.error('Test failed');
            } catch { toast.error('Connection failed'); }
          }} className="btn btn-primary w-full">Send Test Lead</button>
        </div>
      </div>
    </div>
  );
}
