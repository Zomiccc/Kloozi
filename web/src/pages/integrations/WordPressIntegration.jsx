import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import API from '../../lib/api';
import toast from 'react-hot-toast';
import { Download } from 'lucide-react';
import BrandLogo from '../../components/BrandLogo';

const supportedPlugins = ['Elementor Forms', 'WPForms', 'Contact Form 7', 'Ninja Forms', 'Divi Forms', 'Gravity Forms', 'Houzez', 'Forminator', 'Fluent Forms', 'Formidable Forms', 'Everest Forms', 'MetForm'];

export default function WordPressIntegration() {
  const navigate = useNavigate();
  const [token, setToken] = useState('');
  const [siteName, setSiteName] = useState('');
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
      toast.success('Token regenerated! Update your WordPress plugin with the new token.');
    } catch { toast.error('Failed to regenerate token'); }
    setRegenerating(false);
  };

  const downloadPlugin = () => {
    const link = document.createElement('a');
    link.href = '/plugins/wordpress/flazyn.zip';
    link.download = 'flazyn.zip';
    link.click();
    toast.success('Plugin download started');
  };

  const steps = [
    'Download the Flazyn plugin using the button above',
    'Log into your WordPress admin site',
    'Go to Plugins → Add New → Upload Plugin',
    'Choose the downloaded flazyn.zip file and click Install Now',
    'Click Activate once installed',
    'Click Flazyn in the left admin sidebar',
    'Paste your Account Token and optionally set a Website Name',
    'Click Save Settings, then Test Connection to verify',
  ];

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <button onClick={() => navigate('/app/automations')} className="text-ink-secondary hover:text-ink-primary transition-colors" style={{ fontSize: '13px' }}>← Back to Automations</button>

      <div className="flex items-center gap-3">
        <BrandLogo brand="wordpress" />
        <div>
          <h1 className="text-ink-primary" style={{ fontSize: '24px', fontWeight: 650 }}>WordPress Integration</h1>
          <p className="text-ink-secondary mt-1" style={{ fontSize: '14px' }}>Receive new leads from WordPress contact forms</p>
        </div>
      </div>

      <div className="hairline pt-4 space-y-2">
        <div className="flex items-center justify-between">
          <p className="meta-label">Your account token</p>
          <button onClick={regenerateToken} disabled={regenerating} className="text-ink-secondary hover:text-ink-primary underline underline-offset-4 transition-colors" style={{ fontSize: '12px' }}>{regenerating ? 'Regenerating...' : 'Regenerate'}</button>
        </div>
        <div className="flex items-center gap-2">
          <code className="flex-1 text-ink-secondary mono break-all" style={{ fontSize: '13px' }}>{token || 'Loading...'}</code>
          <button onClick={() => { navigator.clipboard.writeText(token); toast.success('Token copied!'); }} className="text-ink-primary hover:text-accent-deep underline underline-offset-4 transition-colors flex-shrink-0" style={{ fontSize: '13px' }}>Copy</button>
        </div>
      </div>

      <div className="hairline pt-4 space-y-2">
        <p className="meta-label">Website name (optional)</p>
        <input className="input" placeholder="e.g. My Property Site" value={siteName} onChange={(e) => setSiteName(e.target.value)} />
        <p className="text-ink-tertiary" style={{ fontSize: '12px' }}>Shown on lead alerts to identify which site the lead came from</p>
      </div>

      <div className="hairline pt-4 space-y-3">
        <div className="flex items-center justify-between">
          <p className="meta-label">Install the WordPress plugin</p>
          <button onClick={downloadPlugin} className="btn btn-primary inline-flex items-center gap-2"><Download size={14} /> Download plugin</button>
        </div>
        <ol className="space-y-2">
          {steps.map((step, i) => (
            <li key={i} className="flex items-start gap-3">
              <span className="mono flex-shrink-0" style={{ fontSize: '13px', color: '#4A2FD6', fontWeight: 600 }}>{i + 1}.</span>
              <span className="text-ink-secondary" style={{ fontSize: '13px' }}>{step}</span>
            </li>
          ))}
        </ol>
        <p className="text-ink-tertiary" style={{ fontSize: '12px' }}>The plugin automatically detects 12 popular form plugins. Any form submission will be sent to Flazyn instantly. Use the Test Connection button in the plugin to verify.</p>
      </div>

      <div className="hairline pt-4 space-y-3">
        <p className="meta-label">Supported WordPress form plugins</p>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-1">
          {supportedPlugins.map(p => (
            <p key={p} className="text-ink-secondary" style={{ fontSize: '13px' }}>· {p}</p>
          ))}
        </div>
      </div>
    </div>
  );
}
