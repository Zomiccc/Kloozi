import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import API from '../../lib/api';
import toast from 'react-hot-toast';
import { Facebook } from 'lucide-react';
import BrandLogo from '../../components/BrandLogo';
import ManagedConnect from '../../components/ManagedConnect';
import { pillStyle } from '../../components/ui';
import { startOAuth } from '../../lib/oauth';

export default function FacebookIntegration() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [connected, setConnected] = useState(false);
  const [integration, setIntegration] = useState(null);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    if (searchParams.get('connected') === 'true') {
      setConnected(true);
      loadIntegration();
      toast.success('Facebook connected successfully!');
    } else if (searchParams.get('error')) {
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

  const handleOAuth = () => startOAuth('facebook');

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
        <button onClick={() => navigate('/app/automations')} className="text-ink-secondary hover:text-ink-primary transition-colors" style={{ fontSize: '13px' }}>← Back to Automations</button>

        <div className="flex items-center gap-3">
          <BrandLogo brand="facebook" />
          <div>
            <h1 className="text-ink-primary" style={{ fontSize: '24px', fontWeight: 650 }}>Facebook & Instagram Lead Ads</h1>
            <span className=" flex-shrink-0" style={pillStyle('#0E8A5F')}> Connected
            </span>
          </div>
        </div>

        <p className="text-ink-secondary" style={{ fontSize: '14px' }}>Your Facebook pages are now connected. New lead ad submissions will instantly create leads in Flazyn.</p>

        {pages.length > 0 && (
          <div>
            <p className="meta-label mb-3">Connected pages</p>
            {pages.map((page, idx) => (
              <motion.div key={page.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(idx * 0.04, 0.3), duration: 0.2 }} className="hairline-b py-3 flex items-center justify-between gap-4">
                <div>
                  <p className="text-ink-primary" style={{ fontSize: '14px', fontWeight: 500 }}>{page.name}</p>
                  <p className="text-ink-tertiary" style={{ fontSize: '12px' }}>{page.category || 'Facebook Page'}</p>
                </div>
                <button onClick={handleOAuth} className="text-ink-primary hover:text-accent-deep underline underline-offset-4 transition-colors" style={{ fontSize: '13px' }}>Renew permissions</button>
              </motion.div>
            ))}
          </div>
        )}

        <div className="hairline pt-4">
          <p className="meta-label mb-1">Permissions renewal</p>
          <p className="text-ink-secondary" style={{ fontSize: '13px' }}>If you change your Facebook password, permissions will expire. Click "Renew Permissions" to reconnect.</p>
        </div>

        <button onClick={handleDisconnect} className="text-ink-tertiary hover:text-ink-primary underline underline-offset-4 transition-colors" style={{ fontSize: '13px' }}>Disconnect Facebook</button>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <button onClick={() => navigate('/app/automations')} className="text-ink-secondary hover:text-ink-primary transition-colors" style={{ fontSize: '13px' }}>← Back to Automations</button>

      <div className="flex items-center gap-3">
        <BrandLogo brand="facebook" />
        <div>
          <h1 className="text-ink-primary" style={{ fontSize: '24px', fontWeight: 650 }}>Facebook & Instagram Lead Ads</h1>
          <p className="text-ink-secondary mt-1" style={{ fontSize: '14px' }}>Receive new leads from Facebook & Instagram Lead Ads</p>
        </div>
      </div>

      <ManagedConnect platform="facebook" />

      <div className="card" style={{ padding: 20 }}>
        <p style={{ fontWeight: 700, fontSize: 15 }}>Or log in with Facebook</p>
        <p style={{ fontSize: 13, color: 'var(--ink-2)', marginTop: 2 }}>For Pages your own team manages.</p>
        <div className="space-y-3 mt-4">
        <p className="text-ink-secondary" style={{ fontSize: '14px' }}>Click below to login with your Facebook account. You'll be redirected to Facebook to authorize permissions for your Pages and Lead Ads.</p>
        <button onClick={handleOAuth} disabled={loading} className="btn btn-secondary inline-flex items-center gap-2">
          <Facebook size={18} /> Login with Facebook
        </button>
        <p className="text-ink-tertiary mono" style={{ fontSize: '12px' }}>Permissions: pages_show_list, pages_manage_metadata, business_management</p>
      </div>
      </div>
    </div>
  );
}
