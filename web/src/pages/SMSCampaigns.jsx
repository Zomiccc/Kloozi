import { useState, useEffect } from 'react';
import API from '../lib/api';
import toast from 'react-hot-toast';
import { Plus, Send, BarChart3 } from 'lucide-react';
import { CreateCampaignModal } from './EmailCampaigns';

export default function SMSCampaigns() {
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [stats, setStats] = useState(null);

  useEffect(() => { loadCampaigns(); }, []);

  const loadCampaigns = async () => {
    try { const res = await API.get('/campaigns'); setCampaigns(res.data.campaigns.filter(c => c.channel === 'sms')); }
    catch { toast.error('Failed to load'); }
    finally { setLoading(false); }
  };

  const handleCreate = async (data) => {
    try { await API.post('/campaigns', { ...data, channel: 'sms' }); toast.success('Campaign created'); setShowCreate(false); loadCampaigns(); }
    catch { toast.error('Create failed'); }
  };

  const handleSend = async (id) => {
    try { await API.post(`/campaigns/${id}/send`); toast.success('Sending started'); loadCampaigns(); }
    catch { toast.error('Send failed'); }
  };

  const loadStats = async (id) => {
    try { const res = await API.get(`/campaigns/${id}/stats`); setStats({ id, ...res.data }); }
    catch { toast.error('Failed'); }
  };

  const statusColors = { draft: 'bg-white/10 text-slate-400', scheduled: 'bg-amber-500/15 text-amber-400', sending: 'bg-blue-500/15 text-blue-400', completed: 'bg-emerald-500/15 text-emerald-400' };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">SMS Campaigns</h1>
        <button onClick={() => setShowCreate(true)} className="px-4 py-2 rounded-lg text-sm bg-indigo-500 text-white hover:bg-indigo-600 flex items-center gap-2 transition-colors"><Plus size={16} /> New Campaign</button>
      </div>
      {loading ? <div className="flex justify-center py-8"><div className="animate-spin w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full" /></div> :
        campaigns.length === 0 ? <div className="card text-center py-12 text-slate-400"><p>No SMS campaigns yet</p></div> :
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {campaigns.map((c, idx) => (
            <div key={c.id || idx} className="card">
              <div className="flex items-start justify-between mb-2"><h3 className="font-semibold text-white">{c.name}</h3><span className={`badge ${statusColors[c.status]}`}>{c.status}</span></div>
              <div className="grid grid-cols-2 gap-2 text-sm mt-3">
                <div><p className="text-slate-500">Recipients</p><p className="font-medium text-white">{c.recipients_count}</p></div>
                <div><p className="text-slate-500">Sent</p><p className="font-medium text-white">{c.sent_count}</p></div>
                <div><p className="text-slate-500">Delivered</p><p className="font-medium text-white">{c.delivered_count}</p></div>
                <div><p className="text-slate-500">Failed</p><p className="font-medium text-white">{c.failed_count}</p></div>
              </div>
              <div className="flex gap-2 mt-4">
                {c.status === 'draft' && <button onClick={() => handleSend(c.id)} className="px-3 py-1.5 rounded-lg text-sm bg-indigo-500 text-white hover:bg-indigo-600 transition-colors flex-1 flex items-center justify-center gap-1"><Send size={14} /> Send</button>}
                <button onClick={() => loadStats(c.id)} className="px-3 py-1.5 rounded-lg text-sm bg-white/5 text-slate-300 border border-white/10 hover:bg-white/10 transition-colors flex-1 flex items-center justify-center gap-1"><BarChart3 size={14} /> Stats</button>
              </div>
            </div>
          ))}
        </div>
      }
      {showCreate && <CreateCampaignModal channel="sms" onClose={() => setShowCreate(false)} onSave={handleCreate} />}
    </div>
  );
}
