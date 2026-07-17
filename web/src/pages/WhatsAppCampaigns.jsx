import { useState, useEffect } from 'react';
import API from '../lib/api';
import toast from 'react-hot-toast';
import { Plus, Send, BarChart3, MessageSquare, X, Users, FileText, Clock, CheckCircle2, AlertCircle, Image } from 'lucide-react';

export default function WhatsAppCampaigns() {
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showBuilder, setShowBuilder] = useState(false);
  const [stats, setStats] = useState(null);

  useEffect(() => { loadCampaigns(); }, []);

  const loadCampaigns = async () => {
    try { const res = await API.get('/campaigns'); setCampaigns(res.data.campaigns.filter(c => c.channel === 'whatsapp')); }
    catch { toast.error('Failed to load'); }
    finally { setLoading(false); }
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
        <h1 className="text-2xl font-bold text-dark-900">WhatsApp Campaigns</h1>
        <button onClick={() => setShowBuilder(true)} className="btn btn-primary flex items-center gap-2"><Plus size={16} /> New Campaign</button>
      </div>

      <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-start gap-3">
        <MessageSquare size={20} className="text-green-600 flex-shrink-0" />
        <div>
          <p className="text-sm font-medium text-green-800">Send bulk WhatsApp messages from your own number</p>
          <p className="text-xs text-green-700 mt-1">Messages are sent one by one with random delays to avoid blocking. Each message is personalized with lead data.</p>
        </div>
      </div>

      {loading ? <div className="flex justify-center py-8"><div className="animate-spin w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full" /></div> :
        campaigns.length === 0 ? (
          <div className="card text-center py-12">
            <MessageSquare size={48} className="text-dark-300 mx-auto mb-3" />
            <p className="text-lg font-medium text-dark-700">No WhatsApp campaigns yet</p>
            <p className="text-sm text-dark-400 mt-1">Create your first campaign to start messaging leads in bulk</p>
          </div>
        ) : (
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
                {stats?.id === c.id && (
                  <div className="mt-3 pt-3 border-t border-dark-100 grid grid-cols-3 gap-2 text-center text-xs">
                    <div><p className="font-bold">{stats.delivery_rate || 0}%</p><p className="text-dark-400">Delivery</p></div>
                    <div><p className="font-bold">{stats.read_count || 0}</p><p className="text-dark-400">Read</p></div>
                    <div><p className="font-bold">{stats.reply_count || 0}</p><p className="text-dark-400">Replies</p></div>
                  </div>
                )}
                <div className="flex gap-2 mt-4">
                  {c.status === 'draft' && <button onClick={() => handleSend(c.id)} className="btn btn-primary flex-1 text-sm py-1.5"><Send size={14} /> Send</button>}
                  <button onClick={() => loadStats(c.id)} className="btn btn-secondary flex-1 text-sm py-1.5"><BarChart3 size={14} /> Stats</button>
                </div>
              </div>
            ))}
          </div>
        )
      }

      {showBuilder && <CampaignBuilder onClose={() => setShowBuilder(false)} onCreated={() => { setShowBuilder(false); loadCampaigns(); }} />}
    </div>
  );
}

function CampaignBuilder({ onClose, onCreated }) {
  const [step, setStep] = useState(1);
  const [name, setName] = useState('');
  const [message, setMessage] = useState('');
  const [recipientFilter, setRecipientFilter] = useState('all');
  const [selectedStages, setSelectedStages] = useState([]);
  const [selectedTags, setSelectedTags] = useState([]);
  const [schedule, setSchedule] = useState('now');
  const [scheduleDate, setScheduleDate] = useState('');
  const [attachFile, setAttachFile] = useState(null);
  const [files, setFiles] = useState([]);
  const [recipientCount, setRecipientCount] = useState(0);

  useEffect(() => { loadFiles(); }, []);

  const loadFiles = async () => {
    try { const res = await API.get('/content'); setFiles(res.data.files || []); } catch {}
  };

  const checkRecipients = async () => {
    try {
      const params = {};
      if (recipientFilter === 'stage' && selectedStages.length) params.stages = selectedStages.join(',');
      if (recipientFilter === 'tag' && selectedTags.length) params.tags = selectedTags.join(',');
      const res = await API.get('/leads', { params: { ...params, limit: 1 } });
      setRecipientCount(res.data.pagination?.total || 0);
    } catch {}
  };

  useEffect(() => { if (step === 2) checkRecipients(); }, [step, recipientFilter, selectedStages, selectedTags]);

  const handleCreate = async () => {
    if (!name || !message) return toast.error('Name and message required');
    try {
      await API.post('/campaigns', {
        name, channel: 'whatsapp', message,
        recipient_filter: { type: recipientFilter, stages: selectedStages, tags: selectedTags },
        file_id: attachFile,
        schedule: schedule === 'later' ? scheduleDate : null,
      });
      toast.success('Campaign created');
      onCreated();
    } catch { toast.error('Create failed'); }
  };

  const insertVariable = (varName) => {
    setMessage(message + ` {{${varName}}}`);
  };

  const variables = ['first_name', 'last_name', 'phone', 'email', 'city', 'budget'];

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold">WhatsApp Campaign Builder</h2>
          <button onClick={onClose}><X size={20} /></button>
        </div>

        {/* Steps indicator */}
        <div className="flex items-center gap-2 mb-6">
          {['Message', 'Recipients', 'Schedule'].map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium ${step > i + 1 ? 'bg-green-500 text-white' : step === i + 1 ? 'bg-primary-600 text-white' : 'bg-dark-100 text-dark-400'}`}>
                {step > i + 1 ? <CheckCircle2 size={14} /> : i + 1}
              </div>
              <span className={`text-sm ${step >= i + 1 ? 'text-dark-900 font-medium' : 'text-dark-400'}`}>{s}</span>
              {i < 2 && <div className={`w-8 h-0.5 ${step > i + 1 ? 'bg-green-500' : 'bg-dark-100'}`} />}
            </div>
          ))}
        </div>

        {/* Step 1: Message */}
        {step === 1 && (
          <div className="space-y-4">
            <div><label className="text-sm font-medium">Campaign Name *</label><input className="input mt-1" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. New Property Launch" /></div>
            <div>
              <label className="text-sm font-medium">Message *</label>
              <div className="flex gap-1 mt-1 mb-2 flex-wrap">
                {variables.map(v => <button key={v} onClick={() => insertVariable(v)} className="text-xs bg-primary-50 text-primary-700 px-2 py-1 rounded hover:bg-primary-100">{`{{${v}}}`}</button>)}
              </div>
              <textarea className="input" rows={5} value={message} onChange={e => setMessage(e.target.value)} placeholder="Hi {{first_name}}, we have a new property in {{city}}..." />
              <p className="text-xs text-dark-400 mt-1">Variables will be replaced with lead data when sending</p>
            </div>
            <div>
              <label className="text-sm font-medium">Attach File (optional)</label>
              <select className="input mt-1" value={attachFile || ''} onChange={e => setAttachFile(e.target.value || null)}>
                <option value="">No attachment</option>
                {files.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
              </select>
            </div>
            {/* Preview */}
            {message && (
              <div className="bg-green-50 rounded-lg p-4">
                <p className="text-xs text-dark-400 mb-2">Preview:</p>
                <p className="text-sm text-dark-900 whitespace-pre-wrap">{message.replace(/\{\{(\w+)\}\}/g, '[$1]')}</p>
              </div>
            )}
            <button onClick={() => setStep(2)} disabled={!name || !message} className="btn btn-primary w-full">Next: Select Recipients</button>
          </div>
        )}

        {/* Step 2: Recipients */}
        {step === 2 && (
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Recipient Filter</label>
              <div className="space-y-2 mt-2">
                <label className="flex items-center gap-3 p-3 border border-dark-100 rounded-lg cursor-pointer hover:bg-dark-50">
                  <input type="radio" checked={recipientFilter === 'all'} onChange={() => setRecipientFilter('all')} />
                  <div><p className="text-sm font-medium">All Leads</p><p className="text-xs text-dark-400">Send to all leads with phone numbers</p></div>
                </label>
                <label className="flex items-center gap-3 p-3 border border-dark-100 rounded-lg cursor-pointer hover:bg-dark-50">
                  <input type="radio" checked={recipientFilter === 'stage'} onChange={() => setRecipientFilter('stage')} />
                  <div><p className="text-sm font-medium">By Stage</p><p className="text-xs text-dark-400">Select specific lead stages</p></div>
                </label>
                <label className="flex items-center gap-3 p-3 border border-dark-100 rounded-lg cursor-pointer hover:bg-dark-50">
                  <input type="radio" checked={recipientFilter === 'tag'} onChange={() => setRecipientFilter('tag')} />
                  <div><p className="text-sm font-medium">By Tag</p><p className="text-xs text-dark-400">Select leads with specific tags</p></div>
                </label>
              </div>
            </div>
            {recipientFilter === 'stage' && (
              <div className="flex gap-2 flex-wrap">
                {['new', 'contacted', 'interested', 'negotiating', 'won', 'lost'].map(s => (
                  <label key={s} className="flex items-center gap-1 text-sm"><input type="checkbox" checked={selectedStages.includes(s)} onChange={e => setSelectedStages(e.target.checked ? [...selectedStages, s] : selectedStages.filter(x => x !== s))} /> {s}</label>
                ))}
              </div>
            )}
            <div className="bg-primary-50 rounded-lg p-4 flex items-center gap-3">
              <Users size={20} className="text-primary-600" />
              <div><p className="text-sm font-medium text-primary-800">{recipientCount} recipients</p><p className="text-xs text-primary-600">Only leads with phone numbers will receive the message</p></div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setStep(1)} className="btn btn-secondary flex-1">Back</button>
              <button onClick={() => setStep(3)} className="btn btn-primary flex-1">Next: Schedule</button>
            </div>
          </div>
        )}

        {/* Step 3: Schedule */}
        {step === 3 && (
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">When to send?</label>
              <div className="space-y-2 mt-2">
                <label className="flex items-center gap-3 p-3 border border-dark-100 rounded-lg cursor-pointer hover:bg-dark-50">
                  <input type="radio" checked={schedule === 'now'} onChange={() => setSchedule('now')} />
                  <div><p className="text-sm font-medium">Send Now</p><p className="text-xs text-dark-400">Start sending immediately</p></div>
                </label>
                <label className="flex items-center gap-3 p-3 border border-dark-100 rounded-lg cursor-pointer hover:bg-dark-50">
                  <input type="radio" checked={schedule === 'later'} onChange={() => setSchedule('later')} />
                  <div><p className="text-sm font-medium">Schedule for Later</p><p className="text-xs text-dark-400">Pick a date and time</p></div>
                </label>
              </div>
            </div>
            {schedule === 'later' && (
              <div><label className="text-sm font-medium">Date & Time</label><input type="datetime-local" className="input mt-1" value={scheduleDate} onChange={e => setScheduleDate(e.target.value)} /></div>
            )}
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start gap-2">
              <AlertCircle size={16} className="text-amber-600 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-amber-700">Messages are sent with random 5-15 second delays between each to prevent blocking. Do not close the browser tab while sending is in progress.</p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setStep(2)} className="btn btn-secondary flex-1">Back</button>
              <button onClick={handleCreate} className="btn btn-primary flex-1">{schedule === 'now' ? 'Create & Send' : 'Create Campaign'}</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
