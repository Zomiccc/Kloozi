import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import API from '../lib/api';
import toast from 'react-hot-toast';
import { CreateCampaignModal } from '../components/CreateCampaignModal';
import { pillStyle } from '../components/ui';

const statusDots = { draft: '#57534E', scheduled: '#EDE9FF', sending: '#2F6FDB', completed: '#0E8A5F' };

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
    try { await API.post('/campaigns', { ...data, channel: 'sms', scheduled_at: data.scheduled_at ? new Date(data.scheduled_at).toISOString() : undefined }); toast.success(data.scheduled_at ? 'Campaign scheduled' : 'Campaign created. Press Send to start'); setShowCreate(false); loadCampaigns(); }
    catch (err) { toast.error(err.response?.data?.error || 'Create failed'); }
  };

  const handleSend = async (id) => {
    try { await API.post(`/campaigns/${id}/send`); toast.success('Sending started'); loadCampaigns(); }
    catch (err) { toast.error(err.response?.data?.error || 'Send failed'); }
  };

  const loadStats = async (id) => {
    try { const res = await API.get(`/campaigns/${id}/stats`); setStats({ id, ...res.data }); }
    catch { toast.error('Failed'); }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-ink-primary" style={{ fontSize: '28px', fontWeight: 650, letterSpacing: '-0.01em' }}>SMS Campaigns</h1>
        <button onClick={() => setShowCreate(true)} className="btn btn-primary">New campaign</button>
      </div>

      {loading ? <div className="flex justify-center py-8"><div className="animate-spin w-6 h-6 border-2 border-ink-tertiary border-t-transparent rounded-full" /></div> :
        campaigns.length === 0 ? (
          <div className="hairline pt-8 text-center">
            <p className="text-ink-secondary" style={{ fontSize: '16px', fontWeight: 500 }}>No SMS campaigns yet</p>
            <p className="text-ink-tertiary mt-1" style={{ fontSize: '13px' }}>Create your first campaign to start texting leads in bulk</p>
          </div>
        ) : (
          <div className="hairline pt-2">
            {campaigns.map((c, idx) => (
              <motion.div key={c.id || idx} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(idx * 0.04, 0.3), duration: 0.2 }} className="py-4 hairline-row space-y-3">
                <div className="flex items-start justify-between gap-4">
                  <h3 className="text-ink-primary" style={{ fontSize: '16px', fontWeight: 600 }}>{c.name}</h3>
                  <span className=" flex-shrink-0" style={pillStyle(statusDots[c.status] || '#57534E')}> {c.status}
                  </span>
                </div>
                <div className="grid grid-cols-4 gap-4">
                  <div><p className="meta-label">Recipients</p><p className="text-ink-primary mono" style={{ fontSize: '15px', fontWeight: 500 }}>{c.recipients_count}</p></div>
                  <div><p className="meta-label">Sent</p><p className="text-ink-primary mono" style={{ fontSize: '15px', fontWeight: 500 }}>{c.sent_count}</p></div>
                  <div><p className="meta-label">Delivered</p><p className="text-ink-primary mono" style={{ fontSize: '15px', fontWeight: 500 }}>{c.delivered_count}</p></div>
                  <div><p className="meta-label">Failed</p><p className="text-ink-primary mono" style={{ fontSize: '15px', fontWeight: 500 }}>{c.failed_count}</p></div>
                </div>
                {stats && stats.id === c.id && (
                  <div className="grid grid-cols-3 gap-4 hairline pt-3">
                    <div><p className="meta-label">Delivery rate</p><p className="text-ink-primary mono" style={{ fontSize: '15px', fontWeight: 500 }}>{stats.delivery_rate || 0}%</p></div>
                    <div><p className="meta-label">Read</p><p className="text-ink-primary mono" style={{ fontSize: '15px', fontWeight: 500 }}>{stats.read_count || 0}</p></div>
                    <div><p className="meta-label">Replies</p><p className="text-ink-primary mono" style={{ fontSize: '15px', fontWeight: 500 }}>{stats.reply_count || 0}</p></div>
                  </div>
                )}
                <div className="flex gap-4">
                  {c.status === 'draft' && <button onClick={() => handleSend(c.id)} className="text-ink-primary hover:text-accent-deep underline underline-offset-4 transition-colors" style={{ fontSize: '14px' }}>Send</button>}
                  <button onClick={() => loadStats(c.id)} className="text-ink-primary hover:text-accent-deep underline underline-offset-4 transition-colors" style={{ fontSize: '14px' }}>Stats</button>
                </div>
              </motion.div>
            ))}
          </div>
        )
      }
      {showCreate && <CreateCampaignModal channel="sms" onClose={() => setShowCreate(false)} onSave={handleCreate} />}
    </div>
  );
}
