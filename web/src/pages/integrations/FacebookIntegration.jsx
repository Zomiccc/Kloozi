import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import API from '../../lib/api';
import toast from 'react-hot-toast';
import { ArrowLeft, Facebook, CheckCircle2, RefreshCw, Trash2, AlertCircle } from 'lucide-react';
import BrandLogo from '../../components/BrandLogo';

export default function FacebookIntegration() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [connected, setConnected] = useState(false);
  const [integration, setIntegration] = useState(null);
  const [loading, setLoading] = useState(false);
  const [oauthConfig, setOauthConfig] = useState({ fbAppId: '', apiBase: '' });

  useEffect(() => {
    API.get('/integrations/oauth/config').then(res => {
      setOauthConfig({
        fbAppId: res.data.facebook?.appId || import.meta.env.VITE_FB_APP_ID || '',
        apiBase: res.data.apiUrl || import.meta.env.VITE_API_URL || 'http://localhost:5000',
      });
    }).catch(() => {
      setOauthConfig({
        fbAppId: import.meta.env.VITE_FB_APP_ID || '',
        apiBase: import.meta.env.VITE_API_URL || 'http://localhost:5000',
      });
    });
  }, []);

  useEffect(() => {
    if (searchParams.get('connected') === 'true') {
      setConnected(true);
      loadIntegration();
      toast.success('Facebook connected successfully!');
    } else if (searchParams.get('error') === 'oauth_failed') {
      const reason = searchParams.get('reason');
      toast.error(`Facebook authentication failed${reason ? ': ' + reason : ''}. Please try again.`);
    }
  }, [searchParams]);

  const loadIntegration = async () => {
    try {
      const res = await API.get('/integrations');
      const fb = (res.data.integrations || []).find(i => i.type === 'facebook' && i.is_connected);
      if (fb) { setIntegration(fb); setConnected(true); }
    } catch {}
  };

  useEffect(() => { loadIntegration(); }, []);

  const handleOAuth = () => {
    if (!oauthConfig.fbAppId) {
      toast.error('Facebook App ID not configured. Check backend FACEBOOK_APP_ID.');
      return;
    }
    const redirectUri = `${oauthConfig.apiBase}/api/integrations/oauth/facebook/callback`;
    const workspaceId = localStorage.getItem('workspaceId') || '';
    const scope = 'pages_show_list,pages_manage_metadata,business_management';
    window.location.href = `https://www.facebook.com/v18.0/dialog/oauth?client_id=${oauthConfig.fbAppId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${scope}&response_type=code&state=${workspaceId}`;
  };

  const handleDisconnect = async () => {
    try {
      let id = integration?.id;
      if (!id) {
        const res = await API.get('/integrations');
        const fb = (res.data.integrations || []).find(i => i.type === 'facebook' && i.is_connected);
        if (!fb) { toast.error('No Facebook connection found'); return; }
        id = fb.id;
      }
      await API.delete(`/integrations/${id}/disconnect`);
      setConnected(false);
      setIntegration(null);
      toast.success('Facebook disconnected');
    } catch (err) { toast.error(err.response?.data?.error || 'Failed to disconnect'); }
  };

  if (connected) {
    const creds = integration?.credentials || {};
    const pages = creds.pages || [];
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <button onClick={() => navigate('/app/automations')} className="flex items-center gap-2 text-sm text-ink-secondary hover:text-ink-primary transition-colors"><ArrowLeft size={16} /> Back to Automations</button>
        <div className="card text-center">
          <div className="w-16 h-16 bg-surface-page rounded-full flex items-center justify-center mx-auto mb-4"><CheckCircle2 size={32} style={{ color: '#34C759' }} /></div>
          <h2 className="text-xl font-bold text-ink-primary">Facebook Connected!</h2>
          <p className="text-sm text-ink-secondary mt-2">Your Facebook pages are now connected. New lead ad submissions will instantly create leads in CRM Final.</p>
        </div>
        {pages.length > 0 && (
          <div className="card">
            <h3 className="font-bold text-ink-primary mb-4">Connected Pages</h3>
            {pages.map(page => (
              <div key={page.id} className="border border-surface-border rounded-2xl p-4 mb-3">
                <div className="flex items-center justify-between mb-2">
                  <div><p className="font-bold text-ink-primary">{page.name}</p><p className="text-xs text-ink-tertiary">{page.category || 'Facebook Page'}</p></div>
                  <div className="flex gap-2">
                    <button className="text-xs font-semibold hover:underline" onClick={handleOAuth}>Renew Permissions</button>
                  </div>
                </div>
                <p className="text-xs text-ink-tertiary mt-2 pl-4">Lead forms refresh every 24 hours automatically</p>
              </div>
            ))}
          </div>
        )}
        <div className="rounded-2xl p-4 flex items-start gap-3 border border-surface-border">
          <AlertCircle size={20} className="flex-shrink-0" style={{ color: '#FF9500' }} />
          <div><p className="text-sm font-bold text-ink-primary">Permissions Renewal</p><p className="text-xs text-ink-secondary mt-1">If you change your Facebook password, permissions will expire. Click "Renew Permissions" to reconnect.</p></div>
        </div>
        <button onClick={handleDisconnect} className="px-4 py-2 rounded-lg btn btn-ghost flex items-center gap-1 text-sm mx-auto transition-colors"><Trash2 size={14} /> Disconnect Facebook</button>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <button onClick={() => navigate('/app/automations')} className="flex items-center gap-2 text-sm text-ink-secondary hover:text-ink-primary transition-colors"><ArrowLeft size={16} /> Back to Automations</button>
      <div className="card">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: '#0066FF15' }}><BrandLogo brand="facebook" /></div>
          <div><h2 className="text-xl font-bold text-ink-primary">Facebook & Instagram Lead Ads</h2><p className="text-sm text-ink-secondary">Receive new leads from Facebook & Instagram Lead Ads</p></div>
        </div>
        <div className="text-center py-8">
          <p className="text-sm text-ink-secondary mb-6">Click below to login with your Facebook account. You'll be redirected to Facebook to authorize permissions for your Pages and Lead Ads.</p>
          <button onClick={handleOAuth} disabled={loading} className="bg-[#1877F2] text-white px-6 py-3 rounded-lg font-medium flex items-center gap-2 mx-auto ">
            <Facebook size={20} /> Login with Facebook
          </button>
          <p className="text-xs text-ink-tertiary mt-4">Permissions: pages_show_list, pages_manage_metadata, business_management</p>
        </div>
      </div>
    </div>
  );
}
