import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import API from '../../lib/api';
import toast from 'react-hot-toast';
import { ArrowLeft, Linkedin, CheckCircle2, RefreshCw, Trash2 } from 'lucide-react';
import BrandLogo from '../../components/BrandLogo';

export default function LinkedInIntegration() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [connected, setConnected] = useState(false);
  const [integration, setIntegration] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (searchParams.get('connected') === 'true') {
      setConnected(true);
      loadIntegration();
      toast.success('LinkedIn connected successfully!');
    } else if (searchParams.get('error') === 'oauth_failed') {
      toast.error('LinkedIn authentication failed. Please try again.');
    }
  }, [searchParams]);

  const loadIntegration = async () => {
    try {
      const res = await API.get('/integrations');
      const li = (res.data.integrations || []).find(i => i.type === 'linkedin' && i.is_connected);
      if (li) { setIntegration(li); setConnected(true); }
    } catch {}
  };

  useEffect(() => { loadIntegration(); }, []);

  const handleOAuth = () => {
    const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:5000';
    const redirectUri = `${apiBase}/api/integrations/oauth/linkedin/callback`;
    const workspaceId = localStorage.getItem('workspaceId') || '';
    const linkedinClientId = import.meta.env.VITE_LINKEDIN_CLIENT_ID || '';
    
    if (!linkedinClientId || linkedinClientId === 'add_later') {
      toast.error('LinkedIn integration is pending approval. Check back soon.');
      return;
    }
    
    const scope = 'r_ads,r_ads_lead_retrieval,r_organization_social,rw_organization';
    window.location.href = `https://www.linkedin.com/oauth/v2/authorization?response_type=code&client_id=${linkedinClientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${scope}&state=${workspaceId}`;
  };

  const handleDisconnect = async () => {
    try {
      let id = integration?.id;
      if (!id) {
        const res = await API.get('/integrations');
        const li = (res.data.integrations || []).find(i => i.type === 'linkedin' && i.is_connected);
        if (!li) { toast.error('No LinkedIn connection found'); return; }
        id = li.id;
      }
      await API.delete(`/integrations/${id}/disconnect`);
      setConnected(false);
      setIntegration(null);
      toast.success('LinkedIn disconnected');
    } catch (err) { toast.error(err.response?.data?.error || 'Failed to disconnect'); }
  };

  if (connected) {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <button onClick={() => navigate('/app/automations')} className="flex items-center gap-2 text-sm text-ink-secondary hover:text-ink-primary"><ArrowLeft size={16} /> Back to Automations</button>
        <div className="card">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 bg-surface-page rounded-xl flex items-center justify-center"><BrandLogo brand="linkedin" /></div>
            <div><h2 className="text-xl font-bold text-ink-primary">LinkedIn Lead Gen Forms</h2><p className="text-sm text-ink-secondary">Receive new leads from LinkedIn Lead Gen Forms</p></div>
          </div>
          <div className="text-center py-4">
            <CheckCircle2 size={32} className="text-ink-secondary mx-auto mb-2" />
            <p className="font-medium text-ink-primary">LinkedIn Connected!</p>
            <p className="text-sm text-ink-secondary">All new LinkedIn Lead Gen Form submissions will instantly create leads in Zomic CRM.</p>
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
          <div className="w-12 h-12 bg-surface-page rounded-xl flex items-center justify-center"><BrandLogo brand="linkedin" /></div>
          <div><h2 className="text-xl font-bold text-ink-primary">LinkedIn Lead Gen Forms</h2><p className="text-sm text-ink-secondary">Receive new leads from LinkedIn Lead Gen Forms</p></div>
        </div>
        <div className="text-center py-8">
          <p className="text-sm text-ink-secondary mb-6">You must have admin access to LinkedIn Campaign Manager. Click below to login with your LinkedIn account.</p>
          <button onClick={handleOAuth} disabled={loading} className="bg-[#0A66C2] text-white px-6 py-3 rounded-lg font-medium flex items-center gap-2 mx-auto ">
            <Linkedin size={20} /> Connect to LinkedIn
          </button>
        </div>
      </div>
    </div>
  );
}
