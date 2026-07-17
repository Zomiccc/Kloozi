import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import API from '../../lib/api';
import toast from 'react-hot-toast';
import { ArrowLeft, Facebook, CheckCircle2, ChevronRight, ChevronLeft, RefreshCw, Trash2, AlertCircle } from 'lucide-react';

const steps = ['Login', 'Confirm', 'Select Pages', 'Import Past Leads', 'Success'];

export default function FacebookIntegration() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [connected, setConnected] = useState(false);
  const [pages, setPages] = useState([]);
  const [selectedPages, setSelectedPages] = useState([]);
  const [importRange, setImportRange] = useState('skip');
  const [loading, setLoading] = useState(false);
  const [connectedPages, setConnectedPages] = useState([]);
  const [leadForms, setLeadForms] = useState({});

  const handleOAuth = () => {
    const fbAppId = import.meta.env.VITE_FB_APP_ID || '';
    const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:5000';
    const redirectUri = `${apiBase}/api/integrations/oauth/facebook/callback`;
    const workspaceId = localStorage.getItem('workspaceId') || '';
    const scope = 'ads_management,leads_retrieval,pages_show_list,pages_read_engagement,pages_manage_metadata';
    window.location.href = `https://www.facebook.com/v18.0/dialog/oauth?client_id=${fbAppId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${scope}&response_type=code&state=${workspaceId}`;
  };

  const handleSimulateOAuth = () => {
    setLoading(true);
    setTimeout(() => {
      setPages([
        { id: '1', name: 'My Business Page', category: 'Real Estate' },
        { id: '2', name: 'Property Sales', category: 'Property' },
        { id: '3', name: 'Luxury Homes', category: 'Real Estate' },
      ]);
      setLoading(false);
      setStep(1);
    }, 1500);
  };

  const handleConnectPages = async () => {
    setLoading(true);
    try {
      await API.post('/integrations/connect', {
        type: 'facebook',
        credentials: { pages: selectedPages },
      });
      setConnectedPages(pages.filter(p => selectedPages.includes(p.id)));
      setLeadForms({
        '1': [{ id: 'f1', name: 'Lead Capture Form' }, { id: 'f2', name: 'Property Inquiry' }],
        '2': [{ id: 'f3', name: 'Quick Lead Form' }],
      });
      setLoading(false);
      setStep(4);
      setConnected(true);
      toast.success('Facebook connected successfully!');
    } catch {
      toast.error('Connection failed');
      setLoading(false);
    }
  };

  const handleImportPastLeads = async () => {
    if (importRange === 'skip') { setStep(4); return; }
    setLoading(true);
    try {
      await API.post('/integrations/connect', { type: 'facebook_import', credentials: { range: importRange } });
      setLoading(false);
      setStep(4);
      toast.success('Past leads imported!');
    } catch {
      toast.error('Import failed');
      setLoading(false);
      setStep(4);
    }
  };

  if (connected && step === 4) {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <button onClick={() => navigate('/automations')} className="flex items-center gap-2 text-sm text-dark-400 hover:text-dark-600"><ArrowLeft size={16} /> Back to Automations</button>
        <div className="card text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4"><CheckCircle2 size={32} className="text-green-600" /></div>
          <h2 className="text-xl font-bold text-dark-900">Facebook Connected!</h2>
          <p className="text-sm text-dark-400 mt-2">Your Facebook pages are now connected. New lead ad submissions will instantly create leads in CRM Final.</p>
        </div>
        <div className="card">
          <h3 className="font-semibold mb-4">Connected Pages & Lead Forms</h3>
          {connectedPages.map(page => (
            <div key={page.id} className="border border-dark-100 rounded-lg p-4 mb-3">
              <div className="flex items-center justify-between mb-2">
                <div><p className="font-medium text-dark-900">{page.name}</p><p className="text-xs text-dark-400">{page.category}</p></div>
                <div className="flex gap-2">
                  <button onClick={() => toast.success('Importing past leads...')} className="text-xs text-primary-600 hover:underline">Import Past Leads</button>
                  <button className="text-xs text-red-500 hover:underline">Remove</button>
                  <button className="text-xs text-amber-600 hover:underline">Renew Permissions</button>
                </div>
              </div>
              {(leadForms[page.id] || []).map(form => (
                <div key={form.id} className="flex items-center gap-2 text-sm text-dark-600 pl-4 py-1">
                  <CheckCircle2 size={14} className="text-green-500" /> {form.name}
                </div>
              ))}
              <p className="text-xs text-dark-400 mt-2 pl-4">Lead forms refresh every 24 hours automatically</p>
            </div>
          ))}
        </div>
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-start gap-3">
          <AlertCircle size={20} className="text-amber-600 flex-shrink-0" />
          <div><p className="text-sm font-medium text-amber-800">Permissions Renewal</p><p className="text-xs text-amber-700 mt-1">If you change your Facebook password, permissions will expire. Click "Renew Permissions" to reconnect.</p></div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <button onClick={() => navigate('/automations')} className="flex items-center gap-2 text-sm text-dark-400 hover:text-dark-600"><ArrowLeft size={16} /> Back to Automations</button>

      <div className="card">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center"><Facebook size={24} className="text-blue-600" /></div>
          <div><h2 className="text-xl font-bold text-dark-900">Facebook & Instagram Lead Ads</h2><p className="text-sm text-dark-400">Receive new leads from Facebook & Instagram Lead Ads</p></div>
        </div>

        <div className="flex items-center gap-2 mb-6">
          {steps.map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium ${i <= step ? 'bg-primary-600 text-white' : 'bg-dark-100 text-dark-400'}`}>{i + 1}</div>
              {i < steps.length - 1 && <div className={`w-8 h-0.5 ${i < step ? 'bg-primary-600' : 'bg-dark-100'}`} />}
            </div>
          ))}
        </div>

        {step === 0 && (
          <div className="text-center py-8">
            <p className="text-sm text-dark-600 mb-6">Click below to login with your Facebook account. We'll request permissions to access your Pages and Lead Ads.</p>
            <button onClick={handleSimulateOAuth} disabled={loading} className="bg-[#1877F2] text-white px-6 py-3 rounded-lg font-medium flex items-center gap-2 mx-auto hover:bg-[#166FE5]">
              <Facebook size={20} /> {loading ? 'Connecting...' : 'Login with Facebook'}
            </button>
            <p className="text-xs text-dark-400 mt-4">Permissions: ads_management, leads_retrieval, pages_show_list, pages_read_engagement, pages_manage_metadata</p>
          </div>
        )}

        {step === 1 && (
          <div className="text-center py-8">
            <p className="text-sm text-dark-600 mb-6">Connect CRM Final to your Facebook account to start receiving leads.</p>
            <button onClick={() => setStep(2)} className="btn btn-primary mx-auto">Next</button>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <p className="text-sm font-medium text-dark-700">Select Facebook Pages to connect:</p>
            {pages.map(page => (
              <label key={page.id} className="flex items-center gap-3 p-3 border border-dark-100 rounded-lg cursor-pointer hover:bg-dark-50">
                <input type="checkbox" checked={selectedPages.includes(page.id)} onChange={(e) => setSelectedPages(e.target.checked ? [...selectedPages, page.id] : selectedPages.filter(id => id !== page.id))} />
                <div><p className="text-sm font-medium">{page.name}</p><p className="text-xs text-dark-400">{page.category}</p></div>
              </label>
            ))}
            <div className="flex gap-2">
              <button onClick={() => setStep(1)} className="btn btn-secondary flex items-center gap-1"><ChevronLeft size={16} /> Back</button>
              <button onClick={handleConnectPages} disabled={selectedPages.length === 0 || loading} className="btn btn-primary flex-1">{loading ? 'Connecting...' : 'Connect Pages'}</button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <p className="text-sm font-medium text-dark-700">Import past leads?</p>
            <p className="text-xs text-dark-400">Facebook only keeps leads for 90 days maximum. Duplicate leads are automatically skipped.</p>
            {['24h', '7d', '30d', '90d', 'skip'].map(opt => (
              <label key={opt} className="flex items-center gap-3 p-3 border border-dark-100 rounded-lg cursor-pointer hover:bg-dark-50">
                <input type="radio" name="import" checked={importRange === opt} onChange={() => setImportRange(opt)} />
                <span className="text-sm">{opt === 'skip' ? 'Skip' : opt === '24h' ? 'Last 24 hours' : opt === '7d' ? 'Last 7 days' : opt === '30d' ? 'Last 30 days' : 'Last 90 days'}</span>
              </label>
            ))}
            <button onClick={handleImportPastLeads} disabled={loading} className="btn btn-primary w-full">{loading ? 'Importing...' : 'Continue'}</button>
          </div>
        )}
      </div>
    </div>
  );
}
