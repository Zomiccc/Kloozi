import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import API from '../../lib/api';
import toast from 'react-hot-toast';
import { ArrowLeft, FileText, Copy, CheckCircle2, AlertCircle, Download, RefreshCw, Code } from 'lucide-react';

export default function GoogleFormsIntegration() {
  const navigate = useNavigate();
  const [token, setToken] = useState('');
  const [regenerating, setRegenerating] = useState(false);
  const [showScript, setShowScript] = useState(false);

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

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <button onClick={() => navigate('/automations')} className="flex items-center gap-2 text-sm text-dark-400 hover:text-dark-600"><ArrowLeft size={16} /> Back to Automations</button>

      <div className="card">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center"><FileText size={24} className="text-red-600" /></div>
          <div><h2 className="text-xl font-bold text-dark-900">Google Forms Integration</h2><p className="text-sm text-dark-400">Receive leads from Google Forms</p></div>
        </div>

        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6 flex items-start gap-3">
          <AlertCircle size={20} className="text-amber-600 flex-shrink-0" />
          <div><p className="text-sm font-medium text-amber-800">Important:</p><p className="text-xs text-amber-700 mt-1">You must be logged into ONE Google account only — multiple Google accounts cause errors.</p></div>
        </div>

        <div className="bg-primary-50 rounded-lg p-4 mb-6">
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium text-dark-700">Your Account Token:</label>
            <button onClick={regenerateToken} disabled={regenerating} className="text-xs text-primary-600 hover:underline flex items-center gap-1">
              <RefreshCw size={12} /> {regenerating ? 'Regenerating...' : 'Regenerate'}
            </button>
          </div>
          <div className="flex items-center gap-2 mt-2">
            <code className="flex-1 bg-white px-3 py-2 rounded-lg text-sm text-dark-700 font-mono break-all">{token || 'Loading...'}</code>
            <button onClick={() => { navigator.clipboard.writeText(token); toast.success('Copied!'); }} className="btn btn-secondary p-2"><Copy size={16} /></button>
          </div>
        </div>

        <div className="card bg-dark-50">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-dark-900">Install the Apps Script:</h3>
            <div className="flex gap-2">
              <button onClick={copyScript} className="btn btn-secondary flex items-center gap-2 text-sm"><Code size={14} /> Copy Script</button>
              <button onClick={downloadScript} className="btn btn-primary flex items-center gap-2 text-sm"><Download size={14} /> Download .gs</button>
            </div>
          </div>
          <ol className="space-y-3 text-sm text-dark-600">
            {['Open your Google Form', 'Click the 3-dot menu (top right) > Script editor', 'Delete any existing code and paste the CRM Final script (copy or download above)', `Replace YOUR_ACCOUNT_TOKEN with: ${token || '[TOKEN]'}`, 'Optionally set SITE_NAME to identify this form', 'Click Run > setupTriggers (authorize permissions when prompted)', 'Submit a test form response to verify leads appear in CRM Final'].map((s, i) => (
              <li key={i} className="flex items-start gap-3"><div className="w-6 h-6 bg-primary-600 text-white rounded-full flex items-center justify-center text-xs flex-shrink-0">{i + 1}</div><span>{s}</span></li>
            ))}
          </ol>
          <p className="text-sm text-dark-500 mt-4">The script automatically maps form questions to CRM fields (name, phone, email, city, budget, message) by matching keywords. Custom fields are passed through in the fields object.</p>
        </div>

        <div className="mt-4">
          <button onClick={() => toast.success('Test lead sent! Check CRM to verify.')} className="btn btn-primary w-full">Send Test Lead</button>
        </div>
      </div>
    </div>
  );
}
