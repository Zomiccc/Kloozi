import { useState, useEffect } from 'react';
import API from '../lib/api';
import toast from 'react-hot-toast';
import { Plus, Send, Calendar, X, BarChart3, Eye } from 'lucide-react';

export default function EmailCampaigns() {
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [stats, setStats] = useState(null);

  useEffect(() => { loadCampaigns(); }, []);

  const loadCampaigns = async () => {
    try { const res = await API.get('/campaigns'); setCampaigns(res.data.campaigns.filter(c => c.channel === 'email')); }
    catch { toast.error('Failed to load campaigns'); }
    finally { setLoading(false); }
  };

  const handleCreate = async (data) => {
    try { await API.post('/campaigns', { ...data, channel: 'email' }); toast.success('Campaign created'); setShowCreate(false); loadCampaigns(); }
    catch (err) { toast.error(err.response?.data?.error || 'Create failed'); }
  };

  const handleSend = async (id) => {
    try { await API.post(`/campaigns/${id}/send`); toast.success('Campaign sending started'); loadCampaigns(); }
    catch { toast.error('Send failed'); }
  };

  const loadStats = async (id) => {
    try { const res = await API.get(`/campaigns/${id}/stats`); setStats({ id, ...res.data }); }
    catch { toast.error('Failed to load stats'); }
  };

  const statusColors = { draft: { bg: '#8E8E9310', color: '#8E8E93' }, scheduled: { bg: '#FF950010', color: '#FF9500' }, sending: { bg: '#0066FF10', color: '#0066FF' }, completed: { bg: '#34C75910', color: '#34C759' }, cancelled: { bg: '#FF3B5C10', color: '#FF3B5C' } };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <h1 className="text-3xl font-extrabold text-ink-primary tracking-tight">Email Campaigns</h1>
        <button onClick={() => setShowCreate(true)} className="btn btn-primary"><Plus size={16} /> New Campaign</button>
      </div>

      {loading ? <div className="flex justify-center py-8"><div className="animate-spin w-8 h-8 border-4 border-accent-blue border-t-transparent rounded-full" /></div> :
        campaigns.length === 0 ? <div className="card text-center" style={{ padding: '48px 24px' }}><p className="text-ink-tertiary">No email campaigns yet</p></div> :
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {campaigns.map(c => {
            const sc = statusColors[c.status] || statusColors.draft;
            return (
              <div key={c.id} className="card card-hover stagger-in">
                <div className="flex items-start justify-between mb-2">
                  <h3 className="font-bold text-ink-primary">{c.name}</h3>
                  <span className="badge capitalize" style={{ background: sc.bg, color: sc.color }}>{c.status}</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm mt-3">
                  <div><p className="text-ink-tertiary">Recipients</p><p className="font-bold text-ink-primary">{c.recipients_count}</p></div>
                  <div><p className="text-ink-tertiary">Sent</p><p className="font-bold text-ink-primary">{c.sent_count}</p></div>
                  <div><p className="text-ink-tertiary">Opened</p><p className="font-bold text-ink-primary">{c.opened_count}</p></div>
                  <div><p className="text-ink-tertiary">Clicked</p><p className="font-bold text-ink-primary">{c.clicked_count}</p></div>
                </div>
                <div className="flex gap-2 mt-4">
                  {c.status === 'draft' && <button onClick={() => handleSend(c.id)} className="btn btn-primary flex-1"><Send size={14} /> Send</button>}
                  <button onClick={() => loadStats(c.id)} className="btn btn-ghost flex-1"><BarChart3 size={14} /> Stats</button>
                </div>
                {stats?.id === c.id && (
                  <div className="mt-3 pt-3 border-t border-surface-border grid grid-cols-3 gap-2 text-center text-xs">
                    <div><p className="font-extrabold text-ink-primary">{stats.deliveryRate}%</p><p className="text-ink-tertiary">Delivery</p></div>
                    <div><p className="font-extrabold text-ink-primary">{stats.openRate}%</p><p className="text-ink-tertiary">Open</p></div>
                    <div><p className="font-extrabold text-ink-primary">{stats.replyRate}%</p><p className="text-ink-tertiary">Reply</p></div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      }

      {showCreate && <CreateCampaignModal channel="email" onClose={() => setShowCreate(false)} onSave={handleCreate} />}
    </div>
  );
}

export function CreateCampaignModal({ channel, onClose, onSave }) {
  const [form, setForm] = useState({ name: '', type: 'bulk', channel, template_id: '', subject: '', body: '', filter_config: {}, scheduled_at: '' });
  const [templates, setTemplates] = useState([]);

  useEffect(() => {
    const endpoint = channel === 'email' ? '/emails/templates' : channel === 'whatsapp' ? '/whatsapp/templates' : '/sms/templates';
    API.get(endpoint).then(res => setTemplates(res.data.templates || res.data)).catch(() => {});
  }, [channel]);

  return (
    <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white border border-surface-border rounded-3xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-modal animate-slide-up">
        <div className="flex items-center justify-between mb-6"><h2 className="text-xl font-bold text-ink-primary">New {channel.charAt(0).toUpperCase() + channel.slice(1)} Campaign</h2><button onClick={onClose} className="text-ink-tertiary hover:text-ink-primary transition-colors"><X size={20} /></button></div>
        <div className="space-y-3">
          <input className="input" placeholder="Campaign name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <select className="input" value={form.template_id} onChange={(e) => setForm({ ...form, template_id: e.target.value })}>
            <option value="">Select template</option>
            {templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
          {channel === 'email' && <input className="input" placeholder="Subject (optional override)" value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} />}
          <textarea className="input" rows="3" placeholder="Body (optional override)" value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} />
          <div className="border border-surface-border rounded-2xl p-3 bg-surface-page">
            <p className="text-sm font-bold text-ink-primary mb-2">Filters (optional)</p>
            <select className="input mb-2" value={form.filter_config.stage || ''} onChange={(e) => setForm({ ...form, filter_config: { ...form.filter_config, stage: e.target.value } })}>
              <option value="">All stages</option><option value="new">New</option><option value="contacted">Contacted</option><option value="interested">Interested</option><option value="negotiating">Negotiating</option>
            </select>
            <input className="input mb-2" placeholder="City filter" value={form.filter_config.city || ''} onChange={(e) => setForm({ ...form, filter_config: { ...form.filter_config, city: e.target.value } })} />
          </div>
          <input type="datetime-local" className="input" value={form.scheduled_at} onChange={(e) => setForm({ ...form, scheduled_at: e.target.value })} />
          <p className="text-xs text-ink-tertiary">{form.scheduled_at ? 'Will be scheduled for selected time' : 'Will be created as draft'}</p>
          <div className="flex gap-2"><button onClick={onClose} className="btn btn-ghost flex-1">Cancel</button><button onClick={() => onSave(form)} className="btn btn-primary flex-1">Create</button></div>
        </div>
      </div>
    </div>
  );
}
