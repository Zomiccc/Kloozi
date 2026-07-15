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

  const statusColors = { draft: 'bg-dark-100 text-dark-600', scheduled: 'bg-amber-100 text-amber-700', sending: 'bg-blue-100 text-blue-700', completed: 'bg-green-100 text-green-700' };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-dark-900">SMS Campaigns</h1>
        <button onClick={() => setShowCreate(true)} className="btn btn-primary flex items-center gap-2"><Plus size={16} /> New Campaign</button>
      </div>
      {loading ? <div className="flex justify-center py-8"><div className="animate-spin w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full" /></div> :
        campaigns.length === 0 ? <div className="card text-center py-12 text-dark-400"><p>No SMS campaigns yet</p></div> :
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {campaigns.map(c => (
            <div key={c.id} className="card">
              <div className="flex items-start justify-between mb-2"><h3 className="font-semibold">{c.name}</h3><span className={`badge ${statusColors[c.status]}`}>{c.status}</span></div>
              <div className="grid grid-cols-2 gap-2 text-sm mt-3">
                <div><p className="text-dark-400">Recipients</p><p className="font-medium">{c.recipients_count}</p></div>
                <div><p className="text-dark-400">Sent</p><p className="font-medium">{c.sent_count}</p></div>
                <div><p className="text-dark-400">Delivered</p><p className="font-medium">{c.delivered_count}</p></div>
                <div><p className="text-dark-400">Failed</p><p className="font-medium">{c.failed_count}</p></div>
              </div>
              <div className="flex gap-2 mt-4">
                {c.status === 'draft' && <button onClick={() => handleSend(c.id)} className="btn btn-primary flex-1 text-sm py-1.5"><Send size={14} /> Send</button>}
                <button onClick={() => loadStats(c.id)} className="btn btn-secondary flex-1 text-sm py-1.5"><BarChart3 size={14} /> Stats</button>
              </div>
            </div>
          ))}
        </div>
      }
      {showCreate && <CreateCampaignModal channel="sms" onClose={() => setShowCreate(false)} onSave={handleCreate} />}
    </div>
  );
}
