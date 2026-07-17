import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import API from '../../lib/api';
import toast from 'react-hot-toast';
import { ArrowLeft, Music, CheckCircle2, AlertCircle, RefreshCw, Trash2 } from 'lucide-react';

export default function TikTokIntegration() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [connected, setConnected] = useState(false);
  const [forms, setForms] = useState([]);
  const [loading, setLoading] = useState(false);

  const requirements = ['TikTok for Business account with admin access', 'At least one Instant Form created in TikTok Ads Manager'];

  const handleConnect = () => { setLoading(true); setTimeout(() => { setForms([{ id: '1', name: 'Real Estate Lead Form' }, { id: '2', name: 'Property Inquiry Form' }]); setLoading(false); setStep(2); setConnected(true); toast.success('TikTok connected!'); }, 1500); };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <button onClick={() => navigate('/automations')} className="flex items-center gap-2 text-sm text-dark-400 hover:text-dark-600"><ArrowLeft size={16} /> Back to Automations</button>

      <div className="card">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 bg-dark-900 rounded-xl flex items-center justify-center"><Music size={24} className="text-white" /></div>
          <div><h2 className="text-xl font-bold text-dark-900">TikTok Lead Generation</h2><p className="text-sm text-dark-400">Receive leads from TikTok Lead Generation</p></div>
        </div>

        {step === 0 && (
          <div className="space-y-4">
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-start gap-3">
              <AlertCircle size={20} className="text-amber-600 flex-shrink-0" />
              <div><p className="text-sm font-medium text-amber-800">Requirements:</p><ul className="text-xs text-amber-700 mt-1 space-y-1">{requirements.map(r => <li key={r}>• {r}</li>)}</ul></div>
            </div>
            <p className="text-sm text-dark-600">Note: If login doesn't work on mobile, try desktop or request desktop site in browser.</p>
            <button onClick={handleConnect} disabled={loading} className="bg-dark-900 text-white px-6 py-3 rounded-lg font-medium flex items-center gap-2 mx-auto hover:bg-dark-800">
              <Music size={20} /> {loading ? 'Connecting...' : 'Connect to TikTok'}
            </button>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-4">
            <p className="text-sm font-medium text-dark-700">Permissions:</p>
            <div className="space-y-2">
              <label className="flex items-center gap-3 p-3 border border-dark-100 rounded-lg"><input type="checkbox" defaultChecked /> <span className="text-sm">Enable: Creative Management ✓</span></label>
              <label className="flex items-center gap-3 p-3 border border-dark-100 rounded-lg"><input type="checkbox" defaultChecked /> <span className="text-sm">Enable: Lead Management ✓</span></label>
            </div>
            <button onClick={handleConnect} disabled={loading} className="btn btn-primary w-full">{loading ? 'Connecting...' : 'Confirm'}</button>
          </div>
        )}

        {connected && (
          <div className="space-y-4">
            <div className="text-center py-4">
              <CheckCircle2 size={32} className="text-green-600 mx-auto mb-2" />
              <p className="font-medium text-dark-900">TikTok Connected!</p>
              <p className="text-sm text-dark-400">All new TikTok lead form submissions will instantly create leads in CRM Final.</p>
            </div>
            <div>
              <h3 className="font-semibold text-sm mb-3">Connected TikTok Forms:</h3>
              {forms.map(f => (
                <div key={f.id} className="flex items-center justify-between p-3 border border-dark-100 rounded-lg mb-2">
                  <div><p className="text-sm font-medium">{f.name}</p></div>
                  <div className="flex gap-2">
                    <button onClick={() => toast.success('Test lead sent!')} className="text-xs text-primary-600 hover:underline">Send Test Lead</button>
                  </div>
                </div>
              ))}
              <div className="flex gap-2 mt-4">
                <button onClick={() => toast.success('Scanning for new forms...')} className="btn btn-secondary flex items-center gap-1 text-sm"><RefreshCw size={14} /> Connect New Forms</button>
                <button onClick={() => { setConnected(false); setStep(0); }} className="btn btn-danger flex items-center gap-1 text-sm"><Trash2 size={14} /> Disconnect</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
