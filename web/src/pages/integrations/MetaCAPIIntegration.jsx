import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import API from '../../lib/api';
import toast from 'react-hot-toast';
import { Save } from 'lucide-react';
import BrandLogo from '../../components/BrandLogo';

export default function MetaCAPIIntegration() {
  const navigate = useNavigate();
  const [config, setConfig] = useState({ pixel_id: '', access_token: '', is_active: true });
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadConfig(); }, []);

  const loadConfig = async () => {
    try { const res = await API.get('/automations/meta-capi'); if (res.data.config) setConfig(res.data.config); } catch {} finally { setLoading(false); }
  };

  const handleSave = async () => {
    try { await API.put('/automations/meta-capi', config); toast.success('Meta CAPI config saved'); } catch { toast.error('Failed'); }
  };

  const howItWorks = [
    'When new Facebook lead arrives → INITIAL_LEAD event auto-sent to Meta',
    'When agent marks lead as "Qualified" → QUALIFIED_LEAD event sent to Meta',
    'Meta uses these signals to optimize ad campaigns and find better leads',
    'Must send events for 7 days minimum before Meta starts optimizing',
    'After 7 days: 2-4 week learning phase, then run Conversion Optimization campaigns',
  ];

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <button onClick={() => navigate('/app/automations')} className="text-ink-secondary hover:text-ink-primary transition-colors" style={{ fontSize: '13px' }}>← Back to Automations</button>

      <div className="flex items-center gap-3">
        <BrandLogo brand="meta" />
        <div>
          <h1 className="text-ink-primary" style={{ fontSize: '24px', fontWeight: 650 }}>Meta Conversions API</h1>
          <p className="text-ink-secondary mt-1" style={{ fontSize: '14px' }}>Optimise Facebook Lead Ad campaigns</p>
        </div>
      </div>

      <div className="hairline pt-4">
        <div className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full" style={{ background: '#EDE9FF' }} />
          <p className="text-ink-secondary" style={{ fontSize: '13px' }}>You must have Facebook integration already connected before configuring Meta Conversions API.</p>
        </div>
      </div>

      <div className="hairline pt-4 space-y-4">
        <div>
          <p className="meta-label mb-1">Meta Pixel / Dataset ID</p>
          <input className="input" placeholder="123456789012345" value={config.pixel_id} onChange={e => setConfig({ ...config, pixel_id: e.target.value })} />
        </div>
        <div>
          <p className="meta-label mb-1">Access token</p>
          <input className="input" placeholder="EAAG..." value={config.access_token} onChange={e => setConfig({ ...config, access_token: e.target.value })} />
        </div>
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={config.is_active} onChange={e => setConfig({ ...config, is_active: e.target.checked })} className="accent-accent-orange" />
          <span className="text-ink-secondary" style={{ fontSize: '14px' }}>Active</span>
        </label>
        <button onClick={handleSave} className="btn btn-primary inline-flex items-center gap-2"><Save size={16} /> Save configuration</button>
      </div>

      <div className="hairline pt-4 space-y-3">
        <p className="meta-label">How it works</p>
        <ul className="space-y-2">
          {howItWorks.map((item, i) => (
            <li key={i} className="flex items-start gap-2">
              <span className="w-1.5 h-1.5 rounded-full flex-shrink-0 mt-1.5" style={{ background: '#EDE9FF' }} />
              <span className="text-ink-secondary" style={{ fontSize: '13px' }}>{item}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="hairline pt-4">
        <p className="text-ink-secondary" style={{ fontSize: '13px' }}>On lead profile page, use the "Mark as Qualified" button for Facebook leads to fire the QUALIFIED_LEAD event to Meta.</p>
      </div>
    </div>
  );
}
