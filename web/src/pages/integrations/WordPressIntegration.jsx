import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import API from '../../lib/api';
import toast from 'react-hot-toast';
import { ArrowLeft, Globe, Copy, CheckCircle2, ChevronRight, Download, RefreshCw } from 'lucide-react';

const supportedPlugins = ['Elementor Forms', 'WPForms', 'Contact Form 7', 'Ninja Forms', 'Divi Forms', 'Gravity Forms', 'Houzez', 'Forminator', 'Fluent Forms', 'Formidable Forms', 'Everest Forms', 'MetForm'];

export default function WordPressIntegration() {
  const navigate = useNavigate();
  const [token, setToken] = useState('');
  const [siteName, setSiteName] = useState('');

  useEffect(() => { loadToken(); }, []);

  const [regenerating, setRegenerating] = useState(false);

  const loadToken = async () => {
    try { const res = await API.get('/automations/account-token'); setToken(res.data.account_token); } catch {}
  };

  const regenerateToken = async () => {
    setRegenerating(true);
    try {
      const res = await API.post('/automations/account-token/regenerate');
      setToken(res.data.account_token);
      toast.success('Token regenerated! Update your WordPress plugin with the new token.');
    } catch { toast.error('Failed to regenerate token'); }
    setRegenerating(false);
  };

  const downloadPlugin = () => {
    const link = document.createElement('a');
    link.href = '/plugins/wordpress/crm-final.zip';
    link.download = 'crm-final.zip';
    link.click();
    toast.success('Plugin download started');
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <button onClick={() => navigate('/automations')} className="flex items-center gap-2 text-sm text-dark-400 hover:text-dark-600"><ArrowLeft size={16} /> Back to Automations</button>

      <div className="card">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center"><Globe size={24} className="text-blue-600" /></div>
          <div><h2 className="text-xl font-bold text-dark-900">WordPress Integration</h2><p className="text-sm text-dark-400">Receive new leads from WordPress contact forms</p></div>
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
            <button onClick={() => { navigator.clipboard.writeText(token); toast.success('Token copied!'); }} className="btn btn-secondary p-2"><Copy size={16} /></button>
          </div>
        </div>

        <div className="mb-6">
          <label className="text-sm font-medium text-dark-700">Website Name (optional):</label>
          <input className="input mt-1" placeholder="e.g. My Property Site" value={siteName} onChange={(e) => setSiteName(e.target.value)} />
          <p className="text-xs text-dark-400 mt-1">Shown on lead alerts to identify which site the lead came from</p>
        </div>

        <div className="card bg-dark-50">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-dark-900">Install the WordPress Plugin:</h3>
            <button onClick={downloadPlugin} className="btn btn-primary flex items-center gap-2 text-sm"><Download size={14} /> Download Plugin</button>
          </div>
          <ol className="space-y-3 text-sm text-dark-600">
            {[
              'Download the CRM Final plugin using the button above',
              'Log into your WordPress admin site',
              'Go to Plugins → Add New → Upload Plugin',
              'Choose the downloaded crm-final.zip file and click Install Now',
              'Click Activate once installed',
              'Click CRM Final in the left admin sidebar',
              'Paste your Account Token and optionally set a Website Name',
              'Click Save Settings, then Test Connection to verify',
            ].map((step, i) => (
              <li key={i} className="flex items-start gap-3">
                <div className="w-6 h-6 bg-primary-600 text-white rounded-full flex items-center justify-center text-xs font-medium flex-shrink-0">{i + 1}</div>
                <span>{step}</span>
              </li>
            ))}
          </ol>
          <p className="text-sm text-dark-500 mt-4">The plugin automatically detects 12 popular form plugins. Any form submission will be sent to CRM Final instantly. Use the Test Connection button in the plugin to verify.</p>
        </div>

        <div className="mt-6">
          <h3 className="font-semibold text-dark-900 mb-3">Supported WordPress Form Plugins:</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {supportedPlugins.map(p => (
              <div key={p} className="flex items-center gap-2 text-sm text-dark-600 bg-dark-50 rounded-lg px-3 py-2">
                <CheckCircle2 size={14} className="text-green-500" /> {p}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
