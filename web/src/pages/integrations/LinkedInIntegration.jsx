import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import API from '../../lib/api';
import toast from 'react-hot-toast';
import { ArrowLeft, Linkedin, CheckCircle2, RefreshCw, Trash2 } from 'lucide-react';

export default function LinkedInIntegration() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [connected, setConnected] = useState(false);
  const [forms, setForms] = useState([]);
  const [loading, setLoading] = useState(false);
  const [importRange, setImportRange] = useState('skip');

  const handleConnect = () => { setLoading(true); setTimeout(() => { setLoading(false); setStep(1); }, 1500); };
  const handleSelectAccount = () => setStep(2);
  const handleImport = () => {
    if (importRange !== 'skip') { setLoading(true); setTimeout(() => { setLoading(false); }, 1000); }
    setForms([{ id: '1', name: 'LinkedIn Lead Gen Form 1' }, { id: '2', name: 'Sponsored Content Form' }]);
    setConnected(true);
    setStep(3);
    toast.success('LinkedIn connected!');
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <button onClick={() => navigate('/automations')} className="flex items-center gap-2 text-sm text-dark-400 hover:text-dark-600"><ArrowLeft size={16} /> Back to Automations</button>

      <div className="card">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center"><Linkedin size={24} className="text-blue-700" /></div>
          <div><h2 className="text-xl font-bold text-dark-900">LinkedIn Lead Gen Forms</h2><p className="text-sm text-dark-400">Receive new leads from LinkedIn Lead Gen Forms</p></div>
        </div>

        {!connected && step === 0 && (
          <div className="text-center py-8">
            <p className="text-sm text-dark-600 mb-6">You must have admin access to LinkedIn Campaign Manager.</p>
            <button onClick={handleConnect} disabled={loading} className="bg-[#0A66C2] text-white px-6 py-3 rounded-lg font-medium flex items-center gap-2 mx-auto hover:bg-[#0a5bbf]">
              <Linkedin size={20} /> {loading ? 'Connecting...' : 'Connect to LinkedIn'}
            </button>
          </div>
        )}

        {!connected && step === 1 && (
          <div className="space-y-4">
            <p className="text-sm font-medium text-dark-700">Select LinkedIn ad accounts:</p>
            <label className="flex items-center gap-3 p-3 border border-dark-100 rounded-lg cursor-pointer hover:bg-dark-50">
              <input type="checkbox" defaultChecked />
              <div><p className="text-sm font-medium">Business Account</p><p className="text-xs text-dark-400">Campaign Manager</p></div>
            </label>
            <button onClick={handleSelectAccount} className="btn btn-primary w-full">Next</button>
          </div>
        )}

        {!connected && step === 2 && (
          <div className="space-y-4">
            <p className="text-sm font-medium text-dark-700">Import past leads?</p>
            {['24h', '7d', '30d', '90d', 'skip'].map(opt => (
              <label key={opt} className="flex items-center gap-3 p-3 border border-dark-100 rounded-lg cursor-pointer hover:bg-dark-50">
                <input type="radio" name="li_import" checked={importRange === opt} onChange={() => setImportRange(opt)} />
                <span className="text-sm">{opt === 'skip' ? 'Skip' : opt === '24h' ? 'Last 24 hours' : opt === '7d' ? 'Last 7 days' : opt === '30d' ? 'Last 30 days' : 'Last 90 days'}</span>
              </label>
            ))}
            <button onClick={handleImport} disabled={loading} className="btn btn-primary w-full">{loading ? 'Importing...' : 'Continue'}</button>
          </div>
        )}

        {connected && (
          <div className="space-y-4">
            <div className="text-center py-4">
              <CheckCircle2 size={32} className="text-green-600 mx-auto mb-2" />
              <p className="font-medium text-dark-900">LinkedIn Connected!</p>
              <p className="text-sm text-dark-400">All new LinkedIn Lead Gen Form submissions will instantly create leads.</p>
            </div>
            <div>
              <h3 className="font-semibold text-sm mb-3">Connected Lead Gen Forms:</h3>
              {forms.map(f => (
                <div key={f.id} className="flex items-center justify-between p-3 border border-dark-100 rounded-lg mb-2">
                  <p className="text-sm font-medium">{f.name}</p>
                  <button onClick={() => toast.success('Test lead sent!')} className="text-xs text-primary-600 hover:underline">Send Test Lead</button>
                </div>
              ))}
              <div className="flex gap-2 mt-4 flex-wrap">
                <button onClick={() => toast.success('Syncing forms...')} className="btn btn-secondary flex items-center gap-1 text-sm"><RefreshCw size={14} /> Sync Forms</button>
                <button onClick={() => toast.success('Importing...')} className="btn btn-secondary text-sm">Import Past Leads</button>
                <button className="btn btn-secondary text-sm">Renew Access</button>
                <button onClick={() => { setConnected(false); setStep(0); }} className="btn btn-danger flex items-center gap-1 text-sm"><Trash2 size={14} /> Disconnect</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
