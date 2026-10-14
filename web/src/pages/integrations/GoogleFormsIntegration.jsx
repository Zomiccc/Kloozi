import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import API from '../../lib/api';
import toast from 'react-hot-toast';
import { Download } from 'lucide-react';
import BrandLogo from '../../components/BrandLogo';

export default function GoogleFormsIntegration() {
  const navigate = useNavigate();
  const [token, setToken] = useState('');
  const [regenerating, setRegenerating] = useState(false);

  useEffect(() => { loadToken(); }, []);
  const loadToken = async () => {
    try { const res = await API.get('/automations/account-token'); setToken(res.data.account_token); } catch {}
  };

  const regenerateToken = async () => {
    setRegenerating(true);
    try {
      const res = await API.post('/automations/account-token/regenerate');
      setToken(res.data.account_token);
      toast.success('Token regenerated!');
    } catch { toast.error('Failed to regenerate'); }
    setRegenerating(false);
  };

  const downloadScript = () => {
    const link = document.createElement('a');
    link.href = '/plugins/google-forms/Code.gs';
    link.download = 'Code.gs';
    link.click();
    toast.success('Apps Script file downloaded');
  };

  const copyScript = () => {
    const script = `var CONFIG = {\n  ACCOUNT_TOKEN: '${token || 'YOUR_TOKEN'}',\n  API_URL: 'http://localhost:5000',\n  SITE_NAME: ''\n};\n\nfunction setupTriggers() {\n  var form = FormApp.getActiveForm();\n  ScriptApp.getProjectTriggers().forEach(function(t) {\n    if (t.getHandlerFunction() === 'onFormSubmit') ScriptApp.deleteTrigger(t);\n  });\n  ScriptApp.newTrigger('onFormSubmit').forForm(form).onFormSubmit().create();\n}\n\nfunction onFormSubmit(e) {\n  if (!e || !e.response) return;\n  var itemResponses = e.response.getItemResponses();\n  var lead = { fields: {} };\n  for (var i = 0; i < itemResponses.length; i++) {\n    var itemResp = itemResponses[i];\n    var q = itemResp.getItem().getTitle().toLowerCase().trim();\n    var a = itemResp.getResponse();\n    if (Array.isArray(a)) a = a.join(', ');\n    if (q.indexOf('name') !== -1 && !lead.name) lead.name = a;\n    else if (q.indexOf('first') !== -1) lead.first_name = a;\n    else if (q.indexOf('last') !== -1) lead.last_name = a;\n    else if ((q.indexOf('phone') !== -1 || q.indexOf('mobile') !== -1) && !lead.phone) lead.phone = a;\n    else if (q.indexOf('email') !== -1 && !lead.email) lead.email = a;\n    else if (q.indexOf('city') !== -1 && !lead.city) lead.city = a;\n    else if (q.indexOf('budget') !== -1 && !lead.budget) lead.budget = a;\n    else if (q.indexOf('message') !== -1 || q.indexOf('note') !== -1) lead.message = a;\n    else lead.fields[itemResp.getItem().getTitle()] = a;\n  }\n  if (!lead.first_name && !lead.last_name && lead.name) {\n    var parts = lead.name.trim().split(/\\s+/);\n    lead.first_name = parts[0] || '';\n    lead.last_name = parts.slice(1).join(' ') || '';\n  }\n  if (CONFIG.SITE_NAME) lead.source = CONFIG.SITE_NAME;\n  var url = CONFIG.API_URL + '/api/integrations/lead/' + CONFIG.ACCOUNT_TOKEN + '/google_forms';\n  UrlFetchApp.fetch(url, { method: 'post', contentType: 'application/json', payload: JSON.stringify(lead), muteHttpExceptions: true });\n}`;
    navigator.clipboard.writeText(script);
    toast.success('Script copied to clipboard!');
  };

  const steps = [
    'Open your Google Form',
    'Click the 3-dot menu (top right) > Script editor',
    'Delete any existing code and paste the Flazyn script (copy or download above)',
    `Replace YOUR_ACCOUNT_TOKEN with: ${token || '[TOKEN]'}`,
    'Optionally set SITE_NAME to identify this form',
    'Click Run > setupTriggers (authorize permissions when prompted)',
    'Submit a test form response to verify leads appear in Flazyn',
  ];

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <button onClick={() => navigate('/app/automations')} className="text-ink-secondary hover:text-ink-primary transition-colors" style={{ fontSize: '13px' }}>← Back to Automations</button>

      <div className="flex items-center gap-3">
        <BrandLogo brand="google" />
        <div>
          <h1 className="text-ink-primary" style={{ fontSize: '24px', fontWeight: 650 }}>Google Forms Integration</h1>
          <p className="text-ink-secondary mt-1" style={{ fontSize: '14px' }}>Receive leads from Google Forms</p>
        </div>
      </div>

      <div className="hairline pt-4">
        <div className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full" style={{ background: '#EDE9FF' }} />
          <p className="text-ink-secondary" style={{ fontSize: '13px' }}>You must be logged into ONE Google account only — multiple Google accounts cause errors.</p>
        </div>
      </div>

      <div className="hairline pt-4 space-y-2">
        <div className="flex items-center justify-between">
          <p className="meta-label">Your account token</p>
          <button onClick={regenerateToken} disabled={regenerating} className="text-ink-secondary hover:text-ink-primary underline underline-offset-4 transition-colors" style={{ fontSize: '12px' }}>{regenerating ? 'Regenerating...' : 'Regenerate'}</button>
        </div>
        <div className="flex items-center gap-2">
          <code className="flex-1 text-ink-secondary mono break-all" style={{ fontSize: '13px' }}>{token || 'Loading...'}</code>
          <button onClick={() => { navigator.clipboard.writeText(token); toast.success('Copied!'); }} className="text-ink-primary hover:text-accent-deep underline underline-offset-4 transition-colors flex-shrink-0" style={{ fontSize: '13px' }}>Copy</button>
        </div>
      </div>

      <div className="hairline pt-4 space-y-3">
        <div className="flex items-center justify-between">
          <p className="meta-label">Install the Apps Script</p>
          <div className="flex items-center gap-3">
            <button onClick={copyScript} className="text-ink-primary hover:text-accent-deep underline underline-offset-4 transition-colors" style={{ fontSize: '13px' }}>Copy script</button>
            <button onClick={downloadScript} className="btn btn-primary inline-flex items-center gap-2"><Download size={14} /> Download .gs</button>
          </div>
        </div>
        <ol className="space-y-2">
          {steps.map((s, i) => (
            <li key={i} className="flex items-start gap-3">
              <span className="mono flex-shrink-0" style={{ fontSize: '13px', color: '#4A2FD6', fontWeight: 600 }}>{i + 1}.</span>
              <span className="text-ink-secondary" style={{ fontSize: '13px' }}>{s}</span>
            </li>
          ))}
        </ol>
        <p className="text-ink-tertiary" style={{ fontSize: '12px' }}>The script automatically maps form questions to CRM fields (name, phone, email, city, budget, message) by matching keywords. Custom fields are passed through in the fields object.</p>
      </div>

      <div className="hairline pt-4">
        <button onClick={async () => {
          try {
            const res = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/integrations/lead/${token}/google_forms`, {
              method: 'POST', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ first_name: 'Google', last_name: 'Test', email: 'googleforms@test.com', phone: '+10000000000', message: 'Test from Google Forms' })
            });
            if (res.ok) toast.success('Test lead sent! Check CRM to verify.');
            else toast.error('Test failed');
          } catch { toast.error('Connection failed'); }
        }} className="btn btn-primary">Send test lead</button>
      </div>
    </div>
  );
}
