import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import API from '../../lib/api';
import toast from 'react-hot-toast';
import { ArrowLeft, Zap, Save, CheckCircle2 } from 'lucide-react';
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

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <button onClick={() => navigate('/app/automations')} className="flex items-center gap-2 text-sm text-ink-secondary hover:text-ink-primary"><ArrowLeft size={16} /> Back to Automations</button>

      <div className="card">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 bg-surface-page rounded-xl flex items-center justify-center"><BrandLogo brand="meta" /></div>
          <div><h2 className="text-xl font-bold text-ink-primary">Meta Conversions API</h2><p className="text-sm text-ink-secondary">Optimise Facebook Lead Ad campaigns</p></div>
        </div>

        <div className="bg-surface-page border border-surface-border rounded-lg p-4 mb-6">
          <p className="text-sm text-ink-secondary">You must have Facebook integration already connected before configuring Meta Conversions API.</p>
        </div>

        <div className="space-y-4">
          <div><label className="text-sm font-medium text-ink-secondary">Meta Pixel / Dataset ID</label><input className="input mt-1" placeholder="123456789012345" value={config.pixel_id} onChange={e => setConfig({ ...config, pixel_id: e.target.value })} /></div>
          <div><label className="text-sm font-medium text-ink-secondary">Access Token</label><input className="input mt-1" placeholder="EAAG..." value={config.access_token} onChange={e => setConfig({ ...config, access_token: e.target.value })} /></div>
          <label className="flex items-center gap-2"><input type="checkbox" checked={config.is_active} onChange={e => setConfig({ ...config, is_active: e.target.checked })} /> <span className="text-sm text-ink-secondary">Active</span></label>
          <button onClick={handleSave} className="px-4 py-2 rounded-lg btn btn-primary flex items-center gap-2 transition-colors"><Save size={16} /> Save Configuration</button>
        </div>

        <div className="mt-6 border-t border-surface-border pt-6">
          <h3 className="font-semibold text-ink-primary mb-3">How it works:</h3>
          <ul className="space-y-2 text-sm text-ink-secondary">
            <li className="flex items-start gap-2"><CheckCircle2 size={16} className="text-ink-secondary flex-shrink-0 mt-0.5" /> When new Facebook lead arrives → INITIAL_LEAD event auto-sent to Meta</li>
            <li className="flex items-start gap-2"><CheckCircle2 size={16} className="text-ink-secondary flex-shrink-0 mt-0.5" /> When agent marks lead as "Qualified" → QUALIFIED_LEAD event sent to Meta</li>
            <li className="flex items-start gap-2"><CheckCircle2 size={16} className="text-ink-secondary flex-shrink-0 mt-0.5" /> Meta uses these signals to optimize ad campaigns and find better leads</li>
            <li className="flex items-start gap-2"><CheckCircle2 size={16} className="text-ink-secondary flex-shrink-0 mt-0.5" /> Must send events for 7 days minimum before Meta starts optimizing</li>
            <li className="flex items-start gap-2"><CheckCircle2 size={16} className="text-ink-secondary flex-shrink-0 mt-0.5" /> After 7 days: 2-4 week learning phase, then run Conversion Optimization campaigns</li>
          </ul>
        </div>

        <div className="mt-4 bg-surface-page border border-surface-border rounded-lg p-4">
          <p className="text-sm text-ink-secondary">On lead profile page, use the "Mark as Qualified" button for Facebook leads to fire the QUALIFIED_LEAD event to Meta.</p>
        </div>
      </div>
    </div>
  );
}
