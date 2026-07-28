import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import API from '../../lib/api';
import toast from 'react-hot-toast';
import { ArrowLeft, Music, CheckCircle2, AlertCircle, RefreshCw, Trash2 } from 'lucide-react';
import BrandLogo from '../../components/BrandLogo';

export default function TikTokIntegration() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [connected, setConnected] = useState(false);
  const [integration, setIntegration] = useState(null);
  const [loading, setLoading] = useState(false);

  const requirements = ['TikTok for Business account with admin access', 'At least one Instant Form created in TikTok Ads Manager'];

  useEffect(() => {
    if (searchParams.get('connected') === 'true') {
      setConnected(true);
      loadIntegration();
      toast.success('TikTok connected successfully!');
    } else if (searchParams.get('error') === 'oauth_failed') {
      toast.error('TikTok authentication failed. Please try again.');
    }
  }, [searchParams]);

  const loadIntegration = async () => {
    try {
      const res = await API.get('/integrations');
      const tk = (res.data.integrations || []).find(i => i.type === 'tiktok' && i.is_connected);
      if (tk) { setIntegration(tk); setConnected(true); }
    } catch {}
  };

  useEffect(() => { loadIntegration(); }, []);

  const handleOAuth = () => {
    const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:5000';
    const redirectUri = `${apiBase}/api/integrations/oauth/tiktok/callback`;
    const workspaceId = localStorage.getItem('workspaceId') || '';
    const tiktokAppId = '';
    const scope = 'creative.management,lead.management';
    window.location.href = `https://business-api.tiktok.com/portal/auth?app_id=${tiktokAppId}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${workspaceId}&scope=${scope}`;
  };

  const handleDisconnect = async () => {
    try {
      let id = integration?.id;
      if (!id) {
        const res = await API.get('/integrations');
        const tk = (res.data.integrations || []).find(i => i.type === 'tiktok' && i.is_connected);
        if (!tk) { toast.error('No TikTok connection found'); return; }
        id = tk.id;
      }
      await API.delete(`/integrations/${id}/disconnect`);
      setConnected(false);
      setIntegration(null);
      toast.success('TikTok disconnected');
    } catch (err) { toast.error(err.response?.data?.error || 'Failed to disconnect'); }
  };

  if (connected) {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <button onClick={() => navigate('/app/automations')} className="flex items-center gap-2 text-sm text-ink-secondary hover:text-ink-primary"><ArrowLeft size={16} /> Back to Automations</button>
        <div className="card">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 bg-surface-hover rounded-xl flex items-center justify-center"><BrandLogo brand="tiktok" /></div>
            <div><h2 className="text-xl font-bold text-ink-primary">TikTok Lead Generation</h2><p className="text-sm text-ink-secondary">Receive leads from TikTok Lead Generation</p></div>
          </div>
          <div className="text-center py-4">
            <CheckCircle2 size={32} className="text-ink-secondary mx-auto mb-2" />
            <p className="font-medium text-ink-primary">TikTok Connected!</p>
            <p className="text-sm text-ink-secondary">All new TikTok lead form submissions will instantly create leads in Zomic CRM.</p>
          </div>
          <div className="flex gap-2 mt-4">
            <button onClick={handleOAuth} className="px-3 py-2 rounded-lg bg-surface-hover text-ink-secondary border border-surface-border hover:bg-surface-hover flex items-center gap-1 text-sm transition-colors"><RefreshCw size={14} /> Reconnect</button>
            <button onClick={handleDisconnect} className="px-3 py-2 rounded-lg bg-surface-page text-ink-secondary border border-surface-border hover:bg-surface-hover flex items-center gap-1 text-sm transition-colors"><Trash2 size={14} /> Disconnect</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <button onClick={() => navigate('/app/automations')} className="flex items-center gap-2 text-sm text-ink-secondary hover:text-ink-primary"><ArrowLeft size={16} /> Back to Automations</button>
      <div className="card">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 bg-surface-hover rounded-xl flex items-center justify-center"><BrandLogo brand="tiktok" /></div>
          <div><h2 className="text-xl font-bold text-ink-primary">TikTok Lead Generation</h2><p className="text-sm text-ink-secondary">Receive leads from TikTok Lead Generation</p></div>
        </div>
        <div className="space-y-4">
          <div className="bg-surface-page border border-surface-border rounded-lg p-4 flex items-start gap-3">
            <AlertCircle size={20} className="text-ink-secondary flex-shrink-0" />
            <div><p className="text-sm font-medium text-ink-secondary">Requirements:</p><ul className="text-xs text-ink-secondary/80 mt-1 space-y-1">{requirements.map(r => <li key={r}>• {r}</li>)}</ul></div>
          </div>
          <p className="text-sm text-ink-secondary">Click below to login with your TikTok for Business account. You'll be redirected to TikTok's real login page.</p>
          <button onClick={handleOAuth} disabled={loading} className="bg-white text-ink-primary px-6 py-3 rounded-lg font-medium flex items-center gap-2 mx-auto hover:bg-surface-hover transition-colors">
            <Music size={20} /> Connect to TikTok
          </button>
        </div>
      </div>
    </div>
  );
}
