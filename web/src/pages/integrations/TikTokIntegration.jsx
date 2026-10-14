import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import API from '../../lib/api';
import toast from 'react-hot-toast';
import { Music } from 'lucide-react';
import BrandLogo from '../../components/BrandLogo';
import ManagedConnect from '../../components/ManagedConnect';
import { pillStyle } from '../../components/ui';
import { startOAuth } from '../../lib/oauth';

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
    } else if (searchParams.get('error')) {
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

  const handleOAuth = () => startOAuth('tiktok');

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
        <button onClick={() => navigate('/app/automations')} className="text-ink-secondary hover:text-ink-primary transition-colors" style={{ fontSize: '13px' }}>← Back to Automations</button>

        <div className="flex items-center gap-3">
          <BrandLogo brand="tiktok" />
          <div>
            <h1 className="text-ink-primary" style={{ fontSize: '24px', fontWeight: 650 }}>TikTok Lead Generation</h1>
            <span className=" flex-shrink-0" style={pillStyle('#0E8A5F')}> Connected
            </span>
          </div>
        </div>

        <p className="text-ink-secondary" style={{ fontSize: '14px' }}>All new TikTok lead form submissions will instantly create leads in Flazyn.</p>

        <div className="hairline pt-4 flex items-center gap-4">
          <button onClick={handleOAuth} className="text-ink-primary hover:text-accent-deep underline underline-offset-4 transition-colors" style={{ fontSize: '13px' }}>Reconnect</button>
          <button onClick={handleDisconnect} className="text-ink-tertiary hover:text-ink-primary underline underline-offset-4 transition-colors" style={{ fontSize: '13px' }}>Disconnect</button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <button onClick={() => navigate('/app/automations')} className="text-ink-secondary hover:text-ink-primary transition-colors" style={{ fontSize: '13px' }}>← Back to Automations</button>

      <div className="flex items-center gap-3">
        <BrandLogo brand="tiktok" />
        <div>
          <h1 className="text-ink-primary" style={{ fontSize: '24px', fontWeight: 650 }}>TikTok Lead Generation</h1>
          <p className="text-ink-secondary mt-1" style={{ fontSize: '14px' }}>Receive leads from TikTok Lead Generation</p>
        </div>
      </div>

      <ManagedConnect platform="tiktok" />

      <div className="card" style={{ padding: 20 }}>
        <p style={{ fontWeight: 700, fontSize: 15 }}>One-click TikTok login</p>
        <p style={{ fontSize: 13, color: 'var(--ink-2)', marginTop: 2 }}>Coming once TikTok approves Flazyn (in review). Until then, the Connect button above works just the same.</p>
        <div className="space-y-3 mt-4">
        <div>
          <p className="meta-label mb-2">Requirements</p>
          <ul className="space-y-1">
            {requirements.map((r, idx) => <motion.li key={r} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(idx * 0.04, 0.3), duration: 0.2 }} className="text-ink-secondary" style={{ fontSize: '13px' }}>· {r}</motion.li>)}
          </ul>
        </div>
        <p className="text-ink-secondary" style={{ fontSize: '14px' }}>Click below to login with your TikTok for Business account.</p>
        <button onClick={handleOAuth} disabled={loading || import.meta.env.VITE_TIKTOK_DIRECT !== 'true'} className="btn btn-secondary inline-flex items-center gap-2">
          <Music size={18} /> Connect to TikTok
        </button>
      </div>
      </div>
    </div>
  );
}
