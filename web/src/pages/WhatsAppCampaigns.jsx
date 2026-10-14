import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import API from '../lib/api';
import toast from 'react-hot-toast';
import { pillStyle } from '../components/ui';

const statusDots = { draft: '#57534E', scheduled: '#EDE9FF', sending: '#2F6FDB', completed: '#0E8A5F' };

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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-ink-primary" style={{ fontSize: '28px', fontWeight: 650, letterSpacing: '-0.01em' }}>WhatsApp Campaigns</h1>
        <button onClick={() => setShowBuilder(true)} className="btn btn-primary">New campaign</button>
      </div>

      {/* Sandbox notice */}
      <div className="hairline pt-4">
        <div className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full" style={{ background: '#EDE9FF' }} />
          <p className="text-ink-secondary" style={{ fontSize: '13px' }}>Running in sandbox mode — contacts must join sandbox before receiving messages. Go live after Meta business verification.</p>
        </div>
      </div>

      {/* Info */}
      <div className="hairline pt-4">
        <p className="text-ink-secondary" style={{ fontSize: '14px' }}>Send bulk WhatsApp messages from your own number. Messages are sent one by one with random delays to avoid blocking. Each message is personalized with lead data.</p>
      </div>

      {loading ? <div className="flex justify-center py-8"><div className="animate-spin w-6 h-6 border-2 border-ink-tertiary border-t-transparent rounded-full" /></div> :
        campaigns.length === 0 ? (
          <div className="hairline pt-8 text-center">
            <p className="text-ink-secondary" style={{ fontSize: '16px', fontWeight: 500 }}>No WhatsApp campaigns yet</p>
            <p className="text-ink-tertiary mt-1" style={{ fontSize: '13px' }}>Create your first campaign to start messaging leads in bulk</p>
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

  const recipientFilterPayload = () => ({ type: recipientFilter, stages: selectedStages, tags: selectedTags });

  const checkRecipients = async () => {
    try {
      const res = await API.post('/campaigns/preview-audience', { channel: 'whatsapp', recipient_filter: recipientFilterPayload() });
      setRecipientCount(res.data.count || 0);
    } catch {}
  };

  useEffect(() => { if (step === 2) checkRecipients(); }, [step, recipientFilter, selectedStages, selectedTags]);

  const handleCreate = async () => {
    if (!name || !message) return toast.error('Name and message required');
    if (schedule === 'later' && !scheduleDate) return toast.error('Pick a date and time');
    try {
      const res = await API.post('/campaigns', {
        name, channel: 'whatsapp', message,
        recipient_filter: recipientFilterPayload(),
        file_id: attachFile,
        schedule: schedule === 'later' ? new Date(scheduleDate).toISOString() : null,
      });
      if (schedule === 'now') {
        await API.post(`/campaigns/${res.data.campaign.id}/send`);
        toast.success(`Sending to ${res.data.campaign.recipients_count} leads`);
      } else {
        toast.success('Campaign scheduled');
      }
      onCreated();
    } catch (err) { toast.error(err.response?.data?.error || 'Create failed'); }
  };

  const insertVariable = (varName) => {
    setMessage(message + ` {{${varName}}}`);
  };

  const variables = ['first_name', 'last_name', 'phone', 'email', 'city', 'budget'];

  return (
    <div className="fixed inset-0 bg-[rgba(28,25,23,0.25)] flex items-center justify-center z-50 p-4">
      <div className="card-raised w-full max-w-2xl max-h-[90vh] overflow-y-auto" style={{ borderRadius: '10px' }}>
        <div className="flex items-center justify-between p-6 hairline-bottom">
          <h2 className="text-ink-primary" style={{ fontSize: '20px', fontWeight: 650 }}>New WhatsApp Campaign</h2>
          <button onClick={onClose} className="text-ink-tertiary hover:text-ink-primary transition-colors" style={{ fontSize: '14px' }}>Close</button>
        </div>

        <div className="p-6 space-y-6">
          {/* Steps indicator */}
          <div className="flex items-center gap-3">
            {['Message', 'Recipients', 'Schedule'].map((s, i) => (
              <div key={s} className="flex items-center gap-3">
                <span className={`mono ${step === i + 1 ? 'text-accent-deep' : step > i + 1 ? 'text-ink-primary' : 'text-ink-tertiary'}`} style={{ fontSize: '13px', fontWeight: 500 }}>{step > i + 1 ? '✓' : i + 1}</span>
                <span className={`${step >= i + 1 ? 'text-ink-primary' : 'text-ink-tertiary'}`} style={{ fontSize: '14px', fontWeight: step === i + 1 ? 500 : 400 }}>{s}</span>
                {i < 2 && <span className="text-ink-tertiary">·</span>}
              </div>
            ))}
          </div>

          {/* Step 1: Message */}
          {step === 1 && (
            <div className="space-y-4">
              <div><p className="meta-label mb-1">Campaign name</p><input className="input" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. New Property Launch" /></div>
              <div>
                <p className="meta-label mb-1">Message</p>
                <div className="flex gap-1 mb-2 flex-wrap">
                  {variables.map(v => <button key={v} onClick={() => insertVariable(v)} className="text-ink-secondary hover:text-ink-primary transition-colors mono" style={{ fontSize: '12px' }}>{`{{${v}}}`}</button>)}
                </div>
                <textarea className="input" rows={5} value={message} onChange={e => setMessage(e.target.value)} placeholder="Hi {{first_name}}, we have a new property in {{city}}..." />
                <p className="text-ink-tertiary mt-1" style={{ fontSize: '12px' }}>Variables will be replaced with lead data when sending</p>
              </div>
              <div>
                <p className="meta-label mb-1">Attach file (optional)</p>
                <select className="input" value={attachFile || ''} onChange={e => setAttachFile(e.target.value || null)}>
                  <option value="">No attachment</option>
                  {files.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                </select>
              </div>
              {message && (
                <div className="hairline pt-3 space-y-1">
                  <p className="meta-label">Preview</p>
                  <p className="text-ink-secondary whitespace-pre-wrap" style={{ fontSize: '14px' }}>{message.replace(/\{\{(\w+)\}\}/g, '[$1]')}</p>
                </div>
              )}
              <button onClick={() => setStep(2)} disabled={!name || !message} className="btn btn-primary w-full disabled:opacity-50 transition-opacity">Next: Select recipients</button>
            </div>
          )}

          {/* Step 2: Recipients */}
          {step === 2 && (
            <div className="space-y-4">
              <p className="meta-label">Recipient filter</p>
              <div className="space-y-2">
                {[
                  { value: 'all', label: 'All leads', desc: 'Send to all leads with phone numbers' },
                  { value: 'stage', label: 'By stage', desc: 'Select specific lead stages' },
                  { value: 'tag', label: 'By tag', desc: 'Select leads with specific tags' },
                ].map(opt => (
                  <label key={opt.value} className="flex items-center gap-3 py-2.5 hairline-row cursor-pointer">
                    <input type="radio" checked={recipientFilter === opt.value} onChange={() => setRecipientFilter(opt.value)} className="accent-accent-orange" />
                    <div><p className="text-ink-primary" style={{ fontSize: '14px', fontWeight: 500 }}>{opt.label}</p><p className="text-ink-tertiary" style={{ fontSize: '12px' }}>{opt.desc}</p></div>
                  </label>
                ))}
              </div>
              {recipientFilter === 'stage' && (
                <div className="flex gap-3 flex-wrap">
                  {['new', 'contacted', 'interested', 'negotiating', 'won', 'lost'].map(s => (
                    <label key={s} className="flex items-center gap-1.5 text-ink-secondary cursor-pointer" style={{ fontSize: '13px' }}><input type="checkbox" checked={selectedStages.includes(s)} onChange={e => setSelectedStages(e.target.checked ? [...selectedStages, s] : selectedStages.filter(x => x !== s))} className="accent-accent-orange" /> {s}</label>
                  ))}
                </div>
              )}
              {recipientFilter === 'tag' && (
                <div>
                  <p className="meta-label mb-1">Tags (comma separated)</p>
                  <input className="input" placeholder="e.g. hot, vip" value={selectedTags.join(', ')}
                    onChange={e => setSelectedTags(e.target.value.split(',').map(t => t.trim()).filter(Boolean))} />
                </div>
              )}
              <div className="hairline pt-3">
                <p className="text-ink-primary mono" style={{ fontSize: '16px', fontWeight: 500 }}>{recipientCount} recipients</p>
                <p className="text-ink-tertiary" style={{ fontSize: '12px' }}>Only leads with phone numbers will receive the message</p>
              </div>
              <div className="flex gap-3">
                <button onClick={() => setStep(1)} className="text-ink-secondary hover:text-ink-primary transition-colors" style={{ fontSize: '14px' }}>Back</button>
                <button onClick={() => setStep(3)} className="btn btn-primary flex-1">Next: Schedule</button>
              </div>
            </div>
          )}

          {/* Step 3: Schedule */}
          {step === 3 && (
            <div className="space-y-4">
              <p className="meta-label">When to send?</p>
              <div className="space-y-2">
                {[
                  { value: 'now', label: 'Send now', desc: 'Start sending immediately' },
                  { value: 'later', label: 'Schedule for later', desc: 'Pick a date and time' },
                ].map(opt => (
                  <label key={opt.value} className="flex items-center gap-3 py-2.5 hairline-row cursor-pointer">
                    <input type="radio" checked={schedule === opt.value} onChange={() => setSchedule(opt.value)} className="accent-accent-orange" />
                    <div><p className="text-ink-primary" style={{ fontSize: '14px', fontWeight: 500 }}>{opt.label}</p><p className="text-ink-tertiary" style={{ fontSize: '12px' }}>{opt.desc}</p></div>
                  </label>
                ))}
              </div>
              {schedule === 'later' && (
                <div><p className="meta-label mb-1">Date & time</p><input type="datetime-local" className="input" value={scheduleDate} onChange={e => setScheduleDate(e.target.value)} /></div>
              )}
              <p className="text-ink-tertiary" style={{ fontSize: '12px' }}>Messages are sent with random 5-15 second delays between each to prevent blocking. Do not close the browser tab while sending is in progress.</p>
              <div className="flex gap-3">
                <button onClick={() => setStep(2)} className="text-ink-secondary hover:text-ink-primary transition-colors" style={{ fontSize: '14px' }}>Back</button>
                <button onClick={handleCreate} className="btn btn-primary flex-1">{schedule === 'now' ? 'Create & send' : 'Create campaign'}</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
