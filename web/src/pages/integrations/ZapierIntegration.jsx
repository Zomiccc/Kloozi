import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import API from '../../lib/api';
import toast from 'react-hot-toast';
import BrandLogo from '../../components/BrandLogo';

export default function ZapierIntegration() {
  const navigate = useNavigate();
  const [token, setToken] = useState('');

  useEffect(() => { loadToken(); }, []);

  const loadToken = async () => {
    try { const res = await API.get('/automations/account-token'); setToken(res.data.account_token); } catch {}
  };

  const steps = [
    'Create a Zap in Zapier',
    'Trigger: any app (Typeform, JotForm, Calendly, etc.)',
    'Action: Webhooks by Zapier → POST',
    'URL: paste the webhook URL above',
    'Payload Type: JSON',
    'Map fields to: first_name, last_name, phone, email, city, budget, message, source',
  ];

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <button onClick={() => navigate('/app/automations')} className="text-ink-secondary hover:text-ink-primary transition-colors" style={{ fontSize: '13px' }}>← Back to Automations</button>

      <div className="flex items-center gap-3">
        <BrandLogo brand="zapier" />
        <div>
          <h1 className="text-ink-primary" style={{ fontSize: '24px', fontWeight: 650 }}>Zapier & Webhooks</h1>
          <p className="text-ink-secondary mt-1" style={{ fontSize: '14px' }}>Connect any other lead source via webhook</p>
        </div>
      </div>

      <div className="hairline pt-4 space-y-2">
        <p className="meta-label">Incoming webhook URL</p>
        <div className="flex items-center gap-2">
          <code className="flex-1 text-ink-secondary mono break-all" style={{ fontSize: '13px' }}>http://localhost:5000/api/integrations/lead/{token || '[TOKEN]'}/zapier</code>
          <button onClick={() => { navigator.clipboard.writeText(`http://localhost:5000/api/integrations/lead/${token}/zapier`); toast.success('Copied!'); }} className="text-ink-primary hover:text-accent-deep underline underline-offset-4 transition-colors flex-shrink-0" style={{ fontSize: '13px' }}>Copy</button>
        </div>
        <p className="text-ink-tertiary" style={{ fontSize: '12px' }}>Send POST requests with JSON body containing: first_name, last_name, phone, email, city, budget, message, source</p>
      </div>

      <div className="hairline pt-4 space-y-3">
        <p className="meta-label">Instructions for connecting via Zapier</p>
        <ol className="space-y-2">
          {steps.map((s, i) => (
            <li key={i} className="flex items-start gap-3">
              <span className="mono flex-shrink-0" style={{ fontSize: '13px', color: '#4A2FD6', fontWeight: 600 }}>{i + 1}.</span>
              <span className="text-ink-secondary" style={{ fontSize: '13px' }}>{s}</span>
            </li>
          ))}
        </ol>
      </div>

      <div className="hairline pt-4">
        <button onClick={async () => {
          try {
            const res = await fetch(`http://localhost:5000/api/integrations/lead/${token}/zapier`, {
              method: 'POST', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ first_name: 'Zapier', last_name: 'Test', email: 'zapier@test.com', phone: '+10000000000', message: 'Test from Zapier' })
            });
            if (res.ok) toast.success('Test lead sent! Check CRM to verify.');
            else toast.error('Test failed');
          } catch { toast.error('Connection failed'); }
        }} className="btn btn-primary">Send test lead</button>
      </div>
    </div>
  );
}
