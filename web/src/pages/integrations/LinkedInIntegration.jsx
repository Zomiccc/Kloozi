import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import API from '../../lib/api';
import toast from 'react-hot-toast';
import { Linkedin } from 'lucide-react';
import BrandLogo from '../../components/BrandLogo';
import ManagedConnect from '../../components/ManagedConnect';
import { pillStyle } from '../../components/ui';
import { startOAuth } from '../../lib/oauth';

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
    } else if (searchParams.get('error')) {
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

  const handleOAuth = () => startOAuth('linkedin');

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
      <motion.div className="max-w-2xl mx-auto space-y-6" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
        <button onClick={() => navigate('/app/automations')} className="text-ink-secondary hover:text-ink-primary transition-colors" style={{ fontSize: '13px' }}>← Back to Automations</button>

        <div className="flex items-center gap-3">
          <BrandLogo brand="linkedin" />
          <div>
            <h1 className="text-ink-primary" style={{ fontSize: '24px', fontWeight: 650 }}>LinkedIn Lead Gen Forms</h1>
            <span className=" flex-shrink-0" style={pillStyle('#0E8A5F')}> Connected
            </span>
          </div>
        </div>

        <p className="text-ink-secondary" style={{ fontSize: '14px' }}>All new LinkedIn Lead Gen Form submissions will instantly create leads in Flazyn.</p>

        <div className="hairline pt-4 flex items-center gap-4">
          <button onClick={handleOAuth} className="text-ink-primary hover:text-accent-deep underline underline-offset-4 transition-colors" style={{ fontSize: '13px' }}>Reconnect</button>
          <button onClick={handleDisconnect} className="text-ink-tertiary hover:text-ink-primary underline underline-offset-4 transition-colors" style={{ fontSize: '13px' }}>Disconnect</button>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div className="max-w-2xl mx-auto space-y-6" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
      <button onClick={() => navigate('/app/automations')} className="text-ink-secondary hover:text-ink-primary transition-colors" style={{ fontSize: '13px' }}>← Back to Automations</button>

      <div className="flex items-center gap-3">
        <BrandLogo brand="linkedin" />
        <div>
          <h1 className="text-ink-primary" style={{ fontSize: '24px', fontWeight: 650 }}>LinkedIn Lead Gen Forms</h1>
          <p className="text-ink-secondary mt-1" style={{ fontSize: '14px' }}>Receive new leads from LinkedIn Lead Gen Forms</p>
        </div>
      </div>

      <ManagedConnect platform="linkedin" />

      <div className="card" style={{ padding: 20 }}>
        <p style={{ fontWeight: 700, fontSize: 15 }}>One-click LinkedIn login</p>
        <p style={{ fontSize: 13, color: 'var(--ink-2)', marginTop: 2 }}>Coming once LinkedIn approves Flazyn. Until then, the Connect button above works just the same.</p>
        <div className="space-y-3 mt-4">
        <p className="text-ink-secondary" style={{ fontSize: '14px' }}>You must have admin access to LinkedIn Campaign Manager. Click below to login with your LinkedIn account.</p>
        <button onClick={handleOAuth} disabled={loading || import.meta.env.VITE_LINKEDIN_DIRECT !== 'true'} className="btn btn-secondary inline-flex items-center gap-2">
          <Linkedin size={18} /> Connect to LinkedIn
        </button>
      </div>
      </div>
    </motion.div>
  );
}
