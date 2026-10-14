import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import API from '../lib/api';
import toast from 'react-hot-toast';
import { celebrateWin } from '../lib/motion';
import { avatarTone, initialsOf } from '../lib/avatar';
import {
  ArrowLeft, Phone, Mail, MessageSquare, Smartphone, Edit, Trash2,
  Calendar, Activity, Zap, FileText,
  Send, MapPin, DollarSign, Tag, User, TrendingUp, Eye, Clock, Target,
  X
} from 'lucide-react';
import { pillStyle, StatusCell, ContactButtons } from '../components/ui';
import InterestPanel, { InterestChip } from '../components/InterestPanel';
import IntelPanel from '../components/IntelPanel';
import { VoiceNoteButton, BriefButton, CallAnalyzer, CallAnalysis } from '../components/AiTools';
import { UpdateRequestBanner, RequestUpdateButton, useUpdateRequest } from '../components/UpdateRequest';

const stageColors = {
  new: '#2F6FDB', contacted: '#B45309', interested: '#2F6FDB',
  negotiating: '#B45309', won: '#0E8A5F', lost: '#A8A29E',
};

const FOLLOW_UP_LABEL = { call: 'Call', whatsapp: 'WhatsApp', email: 'Email', sms: 'SMS', meeting: 'Meeting', visit: 'Site visit' };

const tabs = [
  { key: 'engagement', label: 'Interest' },
  { key: 'activity', label: 'Activity' },
  { key: 'whatsapp', label: 'WhatsApp' },
  { key: 'content', label: 'Content' },
  { key: 'followups', label: 'Follow-ups' },
  { key: 'calls', label: 'Calls' },
];

export default function LeadProfile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({});
  const [activeTab, setActiveTab] = useState('engagement');
  const [whatsappMessages, setWhatsappMessages] = useState([]);
  const [contentViews, setContentViews] = useState([]);
  const [showMessage, setShowMessage] = useState(false);
  const [messageText, setMessageText] = useState('');
  const [engagement, setEngagement] = useState(null);
  const [teamMembers, setTeamMembers] = useState([]);
  const [showAssign, setShowAssign] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [sequences, setSequences] = useState([]);
  const [showSequence, setShowSequence] = useState(false);
  const [fuForm, setFuForm] = useState(null);

  const loadSequences = async () => {
    try { const res = await API.get('/whatsapp/sequences'); setSequences((res.data.sequences || []).filter((sq) => sq.is_active !== false)); } catch {}
  };

  const startSequence = async (sequenceId) => {
    try {
      const res = await API.post('/whatsapp/sequences/start', { sequence_id: sequenceId, lead_id: id });
      toast.success(res.data.message || 'Sequence started');
      setShowSequence(false);
      loadLead();
    } catch (err) { toast.error(err.response?.data?.error || 'Could not start sequence'); }
  };

  const openFollowUpForm = () => {
    const d = new Date(Date.now() + 24 * 3600 * 1000);
    d.setMinutes(0, 0, 0);
    const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
    setFuForm({ type: 'call', due: local, title: '' });
  };

  const saveFollowUp = async () => {
    if (!fuForm?.due) return toast.error('Pick a date and time');
    try {
      await API.post('/follow-ups', { lead_id: id, type: fuForm.type, title: fuForm.title || null, due_date: new Date(fuForm.due).toISOString() });
      toast.success('Follow-up scheduled');
      setFuForm(null);
      loadLead();
    } catch (err) { toast.error(err.response?.data?.error || 'Could not schedule follow-up'); }
  };

  const followUpAction = async (fuId, action) => {
    try {
      if (action === 'done') await API.put(`/follow-ups/${fuId}/complete`);
      else if (action === 'snooze') await API.put(`/follow-ups/${fuId}/snooze`, { minutes: 60 });
      else if (action === 'tomorrow') await API.put(`/follow-ups/${fuId}/snooze`, { minutes: 24 * 60 });
      else if (action === 'delete') await API.delete(`/follow-ups/${fuId}`);
      toast.success(action === 'done' ? 'Marked done' : action === 'delete' ? 'Removed' : 'Snoozed');
      loadLead();
    } catch { toast.error('Update failed'); }
  };

  useEffect(() => { loadLead(); loadTeamMembers(); loadSequences(); }, [id]);
  const [updateRequest, reloadUpdateRequest] = useUpdateRequest(id, data);

  const loadLead = async () => {
    try {
      const res = await API.get(`/leads/${id}`);
      setData(res.data);
      setForm(res.data.lead);
      loadWhatsappMessages();
      loadContentViews();
      loadEngagement();
    } catch (err) {
      toast.error('Failed to load lead');
      navigate('/app/leads');
    } finally { setLoading(false); }
  };

  const loadTeamMembers = async () => {
    try { const res = await API.get('/flazyn-mail/team-members'); setTeamMembers(res.data.members || []); } catch {}
  };

  const handleAssign = async (agentId) => {
    setAssigning(true);
    try {
      await API.put(`/leads/${id}`, { assigned_to: agentId });
      toast.success(agentId ? 'Lead assigned' : 'Lead unassigned');
      setShowAssign(false);
      loadLead();
    } catch { toast.error('Failed to assign lead'); }
    finally { setAssigning(false); }
  };

  const loadWhatsappMessages = async () => {
    try { const res = await API.get(`/whatsapp/inbox`, { params: { lead_id: id } }); setWhatsappMessages(res.data.messages || []); } catch {}
  };

  const loadContentViews = async () => {
    try { const res = await API.get(`/content`, { params: { lead_id: id } }); setContentViews(res.data.files || []); } catch {}
  };

  const loadEngagement = async () => {
    try { const res = await API.get(`/analytics/leads/${id}/engagement`); setEngagement(res.data); } catch {}
  };

  const handleSave = async () => {
    try {
      await API.put(`/leads/${id}`, form);
      toast.success('Lead updated');
      setEditing(false);
      loadLead();
    } catch (err) { toast.error('Update failed'); }
  };

  /* Autosave: field blur persists silently; inline confirmation instead of a Save button */
  const [savedAt, setSavedAt] = useState(null);
  const autosaveField = async (field, value) => {
    if (form[field] !== value && !value === false) { /* noop guard */ }
    const next = { ...form, [field]: value };
    setForm(next);
    try {
      await API.put(`/leads/${id}`, { [field]: value });
      if (field === 'stage' && String(value).toLowerCase() === 'won') celebrateWin();
      setSavedAt(new Date());
    } catch { /* silent — next edit retries */ }
  };

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this lead?')) return;
    try {
      await API.delete(`/leads/${id}`);
      toast.success('Lead deleted');
      navigate('/app/leads');
    } catch (err) { toast.error('Delete failed'); }
  };

  const handleMarkQualified = async () => {
    try { const r = await API.post(`/automations/meta-capi/lead/${id}/qualified`); (r.data.capi?.status === 'failed' ? toast.error : toast.success)(r.data.message || 'Lead marked as qualified'); loadLead(); }
    catch { toast.error('Failed'); }
  };

  const [suggesting, setSuggesting] = useState(false);
  const [copilot, setCopilot] = useState(null);
  const suggestReply = async () => {
    setSuggesting(true);
    try {
      const r = await API.post(`/intel/leads/${id}/reply`, { draft: messageText }, { timeout: 60000 });
      setMessageText(r.data.reply || '');
      setCopilot(r.data);
    } catch { toast.error('Could not suggest a reply'); }
    finally { setSuggesting(false); }
  };

  const handleSendWhatsApp = async () => {
    if (!messageText) return;
    try { await API.post('/whatsapp/send', { lead_id: id, message: messageText }); toast.success('Message sent'); setMessageText(''); setShowMessage(false); loadWhatsappMessages(); }
    catch { toast.error('Send failed'); }
  };

  const handleCall = () => { if (data.lead.phone) window.location.href = `tel:${data.lead.phone}`; };
  const handleWhatsApp = () => { if (data.lead.phone) window.open(`https://wa.me/${data.lead.phone.replace(/\D/g, '')}`, '_blank'); };
  const handleEmail = () => { if (data.lead.email) window.location.href = `mailto:${data.lead.email}`; };
  const handleSMS = () => { if (data.lead.phone) window.location.href = `sms:${data.lead.phone}`; };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="skeleton h-16 w-64" />
        <div className="skeleton h-32" />
        <div className="skeleton h-64" />
      </div>
    );
  }
  if (!data) return null;

  const lead = data.lead;
  const initialsStr = `${(lead.first_name || '?')[0]}${(lead.last_name || '')[0] || ''}`.toUpperCase();
  const stageColor = stageColors[lead.stage] || stageColors.new;
  const scoreColor = lead.score >= 70 ? '#0E8A5F' : lead.score >= 40 ? '#B45309' : '#B45309';

  return (
    <div className="space-y-6">
      {/* Back link — text, not button */}
      <button onClick={() => navigate('/app/leads')} className="text-ink-secondary hover:text-ink-primary transition-colors flex items-center gap-1.5" style={{ fontSize: '14px' }}>
        <ArrowLeft size={14} /> Leads
      </button>

      {/* Header — who, where they are in the pipeline, and one tap to reach them */}
      <div className="card" style={{ padding: 0, position: 'relative', zIndex: 5 }}>
        <div style={{ height: 6, borderTopLeftRadius: 'inherit', borderTopRightRadius: 'inherit' }} className={`st-${(lead.stage || 'new').toLowerCase()}`} />
        <UpdateRequestBanner leadId={id} request={updateRequest} onChange={reloadUpdateRequest} />
        <div className="flex items-start gap-4 flex-wrap sm:flex-nowrap" style={{ padding: '22px 24px 0' }}>
          <span
            className="flex items-center justify-center flex-shrink-0"
            style={{ background: avatarTone(`${lead.first_name || ''}${lead.last_name || ''}`).bg, color: avatarTone(`${lead.first_name || ''}${lead.last_name || ''}`).fg, width: 64, height: 64, borderRadius: 999, fontSize: 24, fontWeight: 800, boxShadow: '0 0 0 4px #fff, 0 8px 18px -8px rgba(28,25,23,0.35)' }}
          >
            {initialsOf(lead.first_name, lead.last_name)}
          </span>
          <div className="flex-1 min-w-0">
            <h1 className="t-h1 truncate">{`${lead.first_name || ''} ${lead.last_name || ''}`.trim() || 'Unnamed lead'}</h1>
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              <ProfileStagePicker value={lead.stage || 'new'} onPick={(v) => autosaveField('stage', v).then(loadLead)} />
              {lead.city && <span className="stat-chip"><MapPin size={12} /> {lead.city}</span>}
              {lead.lead_source && <span className="stat-chip capitalize">From {String(lead.lead_source).replace(/_/g, ' ')}</span>}
              <button onClick={() => setActiveTab('engagement')}><InterestChip score={lead.score || 0} temperature={lead.metadata?.interest?.temperature} /></button>
            </div>
          </div>

          <RequestUpdateButton leadId={id} lead={lead} request={updateRequest} onDone={reloadUpdateRequest} />

          {/* Agent assignment control */}
          <div className="relative flex-shrink-0">
            <button
              onClick={() => setShowAssign(!showAssign)}
              className="flex items-center gap-2 transition-colors"
              style={{
                fontSize: '13px', fontWeight: 600, padding: '9px 14px', borderRadius: '10px',
                background: lead.assigned_to ? '#F5F5F4' : '#FAFAF9', color: lead.assigned_to ? '#1C1917' : '#57534E',
                border: '1px solid #E7E5E4',
              }}
            >
              <User size={14} />
              {lead.agent_first_name ? `${lead.agent_first_name} ${lead.agent_last_name || ''}` : 'Assign agent'}
            </button>
            <AnimatePresence>
              {showAssign && (
                <motion.div
                  initial={{ opacity: 0, y: -6, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -6, scale: 0.98 }}
                  transition={{ duration: 0.15 }}
                  className="absolute right-0 z-30 bg-white"
                  style={{ top: 'calc(100% + 8px)', width: '220px', borderRadius: '10px', border: '1px solid #E7E5E4', boxShadow: '0 12px 32px rgba(28,25,23,0.16)', padding: '6px' }}
                >
                  <p className="meta-label" style={{ padding: '8px 10px 4px' }}>Assign to</p>
                  {teamMembers.length === 0 && <p className="text-ink-tertiary" style={{ fontSize: '13px', padding: '8px 10px' }}>No team members</p>}
                  {teamMembers.map((m) => (
                    <button
                      key={m.id}
                      disabled={assigning}
                      onClick={() => handleAssign(m.id)}
                      className="w-full flex items-center gap-2 text-left transition-colors"
                      style={{ padding: '9px 10px', borderRadius: '10px', fontSize: '13px', fontWeight: 600, color: lead.assigned_to === m.id ? '#1C1917' : '#1C1917', background: lead.assigned_to === m.id ? '#F5F5F4' : 'transparent' }}
                      onMouseEnter={(e) => { if (lead.assigned_to !== m.id) e.currentTarget.style.background = '#FAFAF9'; }}
                      onMouseLeave={(e) => { if (lead.assigned_to !== m.id) e.currentTarget.style.background = 'transparent'; }}
                    >
                      <span className="flex items-center justify-center flex-shrink-0" style={{ width: '24px', height: '24px', borderRadius: '8px', background: avatarTone(`${m.first_name}${m.last_name}`).bg, color: avatarTone(`${m.first_name}${m.last_name}`).fg, fontSize: '10px', fontWeight: 700 }}>
                        {(m.first_name || '?')[0]}
                      </span>
                      {m.first_name} {m.last_name}
                    </button>
                  ))}
                  {lead.assigned_to && (
                    <button
                      disabled={assigning}
                      onClick={() => handleAssign(null)}
                      className="w-full text-left transition-colors"
                      style={{ padding: '9px 10px', borderRadius: '10px', fontSize: '13px', fontWeight: 600, color: '#B45309', marginTop: '2px', borderTop: '1px solid #E7E5E4' }}
                    >
                      Unassign
                    </button>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
        <div className="flex items-center flex-wrap" style={{ gap: 10, padding: '18px 24px 20px' }}>
          <ContactButtons phone={lead.phone} email={lead.email} onWhatsApp={() => setShowMessage(!showMessage)} />
          <span className="flex-1" />
          <VoiceNoteButton leadId={id} onDone={loadLead} />
          <button onClick={() => { setActiveTab('followups'); openFollowUpForm(); }} className="btn btn-secondary btn-sm"><Calendar size={15} /> Schedule follow-up</button>
          <button onClick={() => setEditing(!editing)} className="btn btn-secondary btn-sm"><Edit size={15} /> {editing ? 'Done editing' : 'Edit details'}</button>
        </div>
      </div>

      {/* WhatsApp message composer */}
      {showMessage && (
        <div className="card animate-slide-up" style={{ padding: 18 }}>
          <div className="flex items-center justify-between mb-2">
            <p style={{ fontWeight: 800 }}>Send a WhatsApp message</p>
            <button onClick={() => setShowMessage(false)} className="text-ink-tertiary hover:text-ink-primary"><X size={16} /></button>
          </div>
          <textarea className="input" rows={3} placeholder="Hi {{First_Name}}, …  (tip: {{First_Name}} becomes their name)" value={messageText} onChange={e => setMessageText(e.target.value)} />
          {copilot?.copilot?.examples?.length > 0 && (
            <div className="stat-tile mt-3">
              <p className="label">What worked before when someone said "{copilot.copilot.objections.map((o) => o.label.toLowerCase()).join(', ')}"</p>
              {copilot.copilot.examples.slice(0, 2).map((e, i) => (
                <button key={i} onClick={() => setMessageText(e.you_replied)} className="block text-left mt-2" style={{ fontSize: 13 }}>
                  <span style={{ color: 'var(--ink-3)' }}>{e.lead} won after: </span>"{e.you_replied}" <span style={{ color: 'var(--brand)', fontWeight: 600 }}>Use</span>
                </button>
              ))}
            </div>
          )}
          {copilot?.personality?.tip && copilot.personality.type !== 'unknown' && <p style={{ fontSize: 12.5, color: 'var(--ink-3)', marginTop: 6 }}>{copilot.personality.label}: {copilot.personality.tip}</p>}
          <div className="flex items-center gap-3 mt-3 flex-wrap"><button onClick={suggestReply} disabled={suggesting} className="btn btn-secondary">{suggesting ? 'Thinking…' : '✨ Suggest a reply'}</button><button onClick={handleSendWhatsApp} className="btn btn-primary"><Send size={15} /> Send on WhatsApp</button><a href={`https://wa.me/${String(lead.phone || '').replace(/\D/g, '')}`} target="_blank" rel="noreferrer" style={{ fontSize: 13, fontWeight: 700, color: 'var(--brand-deep)' }}>or open WhatsApp on this device</a></div>
        </div>
      )}

      {/* About · Activity · Next steps */}
      <div className="grid grid-cols-1 xl:grid-cols-[300px_minmax(0,1fr)_280px] lg:grid-cols-[280px_minmax(0,1fr)] gap-5 items-start">
        <aside className="card lg:sticky" style={{ padding: 18, top: 12 }}>
          <p style={{ fontWeight: 800, fontSize: 15, marginBottom: 10 }}>About this lead</p>
            {editing ? (
              <div className="space-y-3">
                <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between">
                  <p className="meta-label">Editing — saves as you leave each field</p>
                  <AnimatePresence>
                    {savedAt && (
                      <motion.span
                        key={savedAt.getTime()}
                        initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}
                        className="font-semibold" style={{ fontSize: '12px', color: '#0E8A5F' }}
                      >
                        Saved
                      </motion.span>
                    )}
                  </AnimatePresence>
                </motion.div>
                <div>
                  <p className="meta-label mb-1">First name</p>
                  <input className="input" defaultValue={form.first_name || ''} onBlur={(e) => autosaveField('first_name', e.target.value)} />
                </div>
                <div>
                  <p className="meta-label mb-1">Last name</p>
                  <input className="input" defaultValue={form.last_name || ''} onBlur={(e) => autosaveField('last_name', e.target.value)} />
                </div>
                <div>
                  <p className="meta-label mb-1">Phone</p>
                  <input className="input mono" defaultValue={form.phone || ''} onBlur={(e) => autosaveField('phone', e.target.value)} />
                </div>
                <div>
                  <p className="meta-label mb-1">Email</p>
                  <input className="input" defaultValue={form.email || ''} onBlur={(e) => autosaveField('email', e.target.value)} />
                </div>
                <div>
                  <p className="meta-label mb-1">City</p>
                  <input className="input" defaultValue={form.city || ''} onBlur={(e) => autosaveField('city', e.target.value)} />
                </div>
                <div>
                  <p className="meta-label mb-1">Budget</p>
                  <input type="number" className="input mono" defaultValue={form.budget || ''} onBlur={(e) => autosaveField('budget', e.target.value)} />
                </div>
                <div>
                  <p className="meta-label mb-1">Stage</p>
                  <select className="input" value={form.stage || ''} onChange={(e) => autosaveField('stage', e.target.value)}>
                    <option value="new">New</option><option value="contacted">Contacted</option>
                    <option value="interested">Interested</option><option value="negotiating">Negotiating</option>
                    <option value="won">Won</option><option value="lost">Lost</option>
                  </select>
                </div>
                <div>
                  <p className="meta-label mb-1">Notes</p>
                  <textarea className="input" rows={3} defaultValue={form.notes || ''} onBlur={(e) => autosaveField('notes', e.target.value)} />
                </div>
                <button onClick={() => setEditing(false)} className="text-ink-secondary hover:text-ink-primary underline underline-offset-4 w-full text-center" style={{ fontSize: '14px' }}>Done editing</button>
              </div>
            ) : (
              <dl className="space-y-0">
                <DetailRow label="Phone" value={lead.phone} mono />
                <DetailRow label="Email" value={lead.email} />
                <DetailRow label="City" value={lead.city} />
                <DetailRow label="Budget" value={lead.budget ? Number(lead.budget).toLocaleString() : null} mono />
                <DetailRow label="Source" value={lead.lead_source} />
                <DetailRow label="Agent" value={lead.agent_first_name ? `${lead.agent_first_name} ${lead.agent_last_name || ''}` : 'Unassigned'} />
                <DetailRow label="Created" value={new Date(lead.created_at).toLocaleDateString('en', { month: 'short', day: 'numeric', year: 'numeric' })} mono />
                {lead.tags && lead.tags.length > 0 && (
                  <div className="pt-3">
                    <dt className="meta-label mb-1">Tags</dt>
                    <dd className="flex gap-2 flex-wrap">
                      {lead.tags.map((t, idx) => (
                        <span key={t || idx} className="text-ink-secondary" style={{ fontSize: '13px' }}>· {t}</span>
                      ))}
                    </dd>
                  </div>
                )}
                {lead.notes && (
                  <div className="pt-3">
                    <dt className="meta-label mb-1">Notes</dt>
                    <dd className="text-ink-primary" style={{ fontSize: '14px' }}>{lead.notes}</dd>
                  </div>
                )}
              </dl>
            )}
        </aside>

        <div className="min-w-0 card" style={{ padding: 0 }}>
          <nav className="flex no-scrollbar overflow-x-auto" style={{ gap: 2, padding: '6px 10px 0', borderBottom: '1px solid var(--hairline)' }}>
            {tabs.map((t) => {
              const on = activeTab === t.key;
              return (
                <button key={t.key} onClick={() => setActiveTab(t.key)} className="relative whitespace-nowrap"
                  style={{ padding: '12px 14px', fontSize: 14, fontWeight: on ? 800 : 600, color: on ? 'var(--ink)' : 'var(--ink-2)' }}>
                  {t.label}
                  {on && <motion.span layoutId="profile-tab" className="absolute" style={{ left: 10, right: 10, bottom: -1, height: 3, borderRadius: 3, background: 'var(--brand)' }} />}
                </button>
              );
            })}
          </nav>
        <div style={{ padding: 20 }}>
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.18, ease: 'easeOut' }}
            >
          {/* Engagement tab */}
          {activeTab === 'engagement' && (
            <InterestPanel
              leadId={id}
              lead={lead}
              onScore={(score, temperature) => setData((d) => (d && d.lead.score !== score
                ? { ...d, lead: { ...d.lead, score, metadata: { ...(d.lead.metadata || {}), interest: { ...(d.lead.metadata?.interest || {}), temperature } } } }
                : d))}
            />
          )}

          {/* Activity timeline */}
          {activeTab === 'activity' && (
            <div>
              <h2 className="text-ink-primary mb-4" style={{ fontSize: '20px', fontWeight: 650 }}>Activity</h2>
              <div className="space-y-0 max-h-[500px] overflow-y-auto">
                {data.activities && data.activities.length > 0 ? data.activities.map((act, idx) => (
                  <motion.div
                    key={act.id || idx}
                    initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: Math.min(idx * 0.03, 0.4), duration: 0.2 }}
                    className="hairline-b py-3 flex items-start justify-between gap-4 hover-accent-left"
                  >
                    <div>
                      <p className="text-ink-primary font-medium" style={{ fontSize: '14px' }}>{act.description}</p>
                      <p className="text-ink-tertiary mt-0.5 mono" style={{ fontSize: '12px' }}>{new Date(act.created_at).toLocaleString()}</p>
                    </div>
                  </motion.div>
                )) : <p className="text-ink-tertiary py-4" style={{ fontSize: '14px' }}>No activities yet</p>}
              </div>
            </div>
          )}
          {activeTab === 'whatsapp' && (
            <div>
              <h2 className="text-ink-primary mb-4" style={{ fontSize: '20px', fontWeight: 650 }}>WhatsApp</h2>
              <div className="space-y-3 max-h-[500px] overflow-y-auto">
                {whatsappMessages.length > 0 ? whatsappMessages.map((msg, idx) => (
                  <div key={msg.id || idx} className={`flex ${msg.direction === 'outgoing' ? 'justify-end' : 'justify-start'}`}>
                    <div
                      className="max-w-[70%] px-4 py-2.5"
                      style={{
                        background: msg.direction === 'outgoing' ? '#1C1917' : 'transparent',
                        color: msg.direction === 'outgoing' ? '#FAFAF9' : '#1C1917',
                        border: msg.direction === 'outgoing' ? 'none' : '1px solid #E7E5E4',
                        borderRadius: '8px',
                      }}
                    >
                      <p style={{ fontSize: '14px' }}>{msg.message}</p>
                      <p className="mt-1 mono" style={{ fontSize: '11px', color: msg.direction === 'outgoing' ? 'rgba(250,249,246,0.6)' : '#A8A29E' }}>
                        {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                )) : <p className="text-ink-tertiary py-4" style={{ fontSize: '14px' }}>No WhatsApp messages yet</p>}
              </div>
            </div>
          )}

          {/* Content views */}
          {activeTab === 'content' && (
            <div>
              <h2 className="text-ink-primary mb-4" style={{ fontSize: '20px', fontWeight: 650 }}>Content views</h2>
              <div className="space-y-0 max-h-[500px] overflow-y-auto">
                {contentViews.length > 0 ? contentViews.map((v, idx) => (
                  <div key={v.id || idx} className="hairline-b py-3 flex items-center justify-between">
                    <div>
                      <p className="text-ink-primary font-medium" style={{ fontSize: '14px' }}>{v.file_name || 'Unknown file'}</p>
                      <p className="text-ink-tertiary mono" style={{ fontSize: '12px' }}>{v.views || 1} views</p>
                    </div>
                    <p className="text-ink-tertiary mono" style={{ fontSize: '12px' }}>{new Date(v.created_at).toLocaleDateString('en', { month: 'short', day: 'numeric' })}</p>
                  </div>
                )) : <p className="text-ink-tertiary py-4" style={{ fontSize: '14px' }}>No content viewed yet</p>}
              </div>
            </div>
          )}

          {/* Follow-ups */}
          {activeTab === 'followups' && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-ink-primary" style={{ fontSize: '20px', fontWeight: 650 }}>Follow-ups</h2>
                {!fuForm && (
                  <button onClick={openFollowUpForm} className="text-ink-primary hover:text-accent-deep underline underline-offset-4 transition-colors" style={{ fontSize: '14px', fontWeight: 600 }}>
                    Schedule follow-up
                  </button>
                )}
              </div>
              {fuForm && (
                <div className="hairline-b pb-4 mb-2 grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))' }}>
                  <label className="block">
                    <span className="text-ink-tertiary mono block mb-1" style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Type</span>
                    <select value={fuForm.type} onChange={(e) => setFuForm({ ...fuForm, type: e.target.value })} className="input w-full">
                      <option value="call">Call</option>
                      <option value="whatsapp">WhatsApp</option>
                      <option value="email">Email</option>
                      <option value="sms">SMS</option>
                      <option value="meeting">Meeting</option>
                      <option value="visit">Site visit</option>
                    </select>
                  </label>
                  <label className="block">
                    <span className="text-ink-tertiary mono block mb-1" style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>When</span>
                    <input type="datetime-local" value={fuForm.due} onChange={(e) => setFuForm({ ...fuForm, due: e.target.value })} className="input w-full" />
                  </label>
                  <label className="block">
                    <span className="text-ink-tertiary mono block mb-1" style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Note</span>
                    <input value={fuForm.title} onChange={(e) => setFuForm({ ...fuForm, title: e.target.value })} placeholder="e.g. Send price list" className="input w-full" />
                  </label>
                  <div className="flex items-end gap-3">
                    <button onClick={saveFollowUp} className="btn btn-primary btn-sm">Save</button>
                    <button onClick={() => setFuForm(null)} className="text-ink-secondary hover:text-ink-primary" style={{ fontSize: '14px' }}>Cancel</button>
                  </div>
                </div>
              )}
              {data.followUps && data.followUps.length > 0 ? (
                <div className="space-y-0">
                  {data.followUps.map((fu, idx) => {
                    const overdue = fu.status === 'pending' && new Date(fu.due_date) < new Date();
                    const statusColor = fu.status === 'completed' ? '#0E8A5F' : overdue ? '#B45309' : fu.status === 'pending' ? '#2F6FDB' : '#A8A29E';
                    return (
                      <div key={fu.id || idx} className="hairline-b py-3 flex items-center justify-between" style={{ gap: 12 }}>
                        <div className="min-w-0">
                          <p className="text-ink-primary font-medium" style={{ fontSize: '14px' }}>{FOLLOW_UP_LABEL[fu.type] || fu.type}</p>
                          <p className="text-ink-tertiary truncate" style={{ fontSize: '13px' }}>{fu.title || fu.notes || 'No note'}</p>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="text-ink-tertiary mono mb-1" style={{ fontSize: '12px' }}>
                            {new Date(fu.due_date).toLocaleString('en', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                          </p>
                          <span className="capitalize" style={pillStyle(statusColor)}>{overdue ? 'overdue' : fu.status}</span>
                          {fu.status === 'pending' && (
                            <div className="flex justify-end gap-3 mt-2" style={{ fontSize: '12px', fontWeight: 600 }}>
                              <button onClick={() => followUpAction(fu.id, 'done')} className="text-ink-primary hover:text-accent-deep">Done</button>
                              <button onClick={() => followUpAction(fu.id, 'snooze')} className="text-ink-secondary hover:text-ink-primary">+1h</button>
                              <button onClick={() => followUpAction(fu.id, 'tomorrow')} className="text-ink-secondary hover:text-ink-primary">Tomorrow</button>
                              <button onClick={() => followUpAction(fu.id, 'delete')} className="text-ink-tertiary hover:text-ink-primary">Remove</button>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : !fuForm && <p className="text-ink-tertiary py-4" style={{ fontSize: '14px' }}>No follow-ups yet. Schedule one and you get a reminder when it is due.</p>}
            </div>
          )}

          {/* Calls */}
          {activeTab === 'calls' && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-ink-primary" style={{ fontSize: '18px', fontWeight: 700 }}>Calls</h2>
                <CallAnalyzer leadId={id} onDone={loadLead} />
              </div>
              {data.calls && data.calls.length > 0 ? (
                <div className="space-y-0">
                  {data.calls.map((call, idx) => (
                    <div key={call.id || idx} className="hairline-b py-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-ink-primary font-medium capitalize" style={{ fontSize: '14px' }}>{call.outcome || 'Call'}{call.duration_seconds ? ` · ${Math.round(call.duration_seconds / 60)} min` : ''}</p>
                          {!call.analysis && <p className="text-ink-tertiary" style={{ fontSize: '13px' }}>{call.notes || 'No notes'}</p>}
                        </div>
                        <p className="text-ink-tertiary" style={{ fontSize: '12px' }}>{new Date(call.created_at).toLocaleDateString('en', { month: 'short', day: 'numeric' })}</p>
                      </div>
                      {call.analysis && <div className="stat-tile mt-2"><CallAnalysis a={typeof call.analysis === 'string' ? JSON.parse(call.analysis) : call.analysis} /></div>}
                    </div>
                  ))}
                </div>
              ) : <p className="text-ink-tertiary py-4" style={{ fontSize: '14px' }}>No calls logged</p>}
            </div>
          )}
            </motion.div>
        </div>
        </div>

        <aside className="flex flex-col gap-4 lg:col-span-2 xl:col-span-1">
          <IntelPanel lead={lead} onWhatsApp={() => setShowMessage(true)} onRefreshLead={loadLead} />
          <div className="card" style={{ padding: 18 }}>
            <p style={{ fontWeight: 800, fontSize: 15 }}>Next step</p>
            {(() => {
              const next = (data.followUps || []).filter((f) => f.status === 'pending').sort((x, y) => new Date(x.due_date) - new Date(y.due_date))[0];
              if (!next) return (
                <>
                  <p style={{ fontSize: 13, color: 'var(--ink-2)', marginTop: 4 }}>No follow-up planned. Leads go cold without one.</p>
                  <button onClick={() => { setActiveTab('followups'); openFollowUpForm(); }} className="btn btn-primary btn-sm w-full mt-3"><Calendar size={15} /> Plan a follow-up</button>
                </>
              );
              const late = new Date(next.due_date) < new Date();
              return (
                <div className="mt-2" style={{ padding: 12, borderRadius: 12, background: late ? '#FFF6DB' : '#F3F0FF', border: `1px solid ${late ? '#FFE7A3' : '#DDD6FE'}` }}>
                  <p style={{ fontWeight: 800, color: late ? '#8A5A00' : 'var(--brand-deep)' }}>{FOLLOW_UP_LABEL[next.type] || 'Follow-up'} {late ? '· overdue' : ''}</p>
                  <p style={{ fontSize: 13, color: 'var(--ink-2)' }}>{new Date(next.due_date).toLocaleString('en', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</p>
                  {next.title && <p style={{ fontSize: 13, marginTop: 4 }}>{next.title}</p>}
                  {['call', 'meeting', 'visit'].includes(next.type) && <div className="mt-2"><BriefButton leadId={id} /></div>}
                  <div className="flex gap-3 mt-2" style={{ fontSize: 13, fontWeight: 800 }}>
                    <button onClick={() => followUpAction(next.id, 'done')} style={{ color: 'var(--brand-deep)' }}>✓ Done</button>
                    <button onClick={() => followUpAction(next.id, 'tomorrow')} style={{ color: 'var(--ink-2)' }}>Move to tomorrow</button>
                  </div>
                </div>
              );
            })()}
          </div>

          <div className="card" style={{ padding: 18 }}>
            <p style={{ fontWeight: 800, fontSize: 15 }}>Automate</p>
            <p style={{ fontSize: 13, color: 'var(--ink-2)', marginTop: 4 }}>Let Flazyn keep in touch for you.</p>
            <div className="relative mt-3">
              <button onClick={() => setShowSequence(!showSequence)} disabled={!lead.phone} className="btn btn-secondary btn-sm w-full"><Send size={15} /> Start a WhatsApp sequence</button>
              {showSequence && (
                <div className="popover popover-flush absolute left-0 right-0 z-20" style={{ top: 40 }}>
                  {sequences.length === 0 ? (
                    <p className="px-3 py-2 text-ink-tertiary" style={{ fontSize: 13 }}>No sequences yet. Create one in Automations → Sequences.</p>
                  ) : sequences.map((sq) => (
                    <button key={sq.id} onClick={() => startSequence(sq.id)} className="block w-full text-left px-3 py-2 rounded-lg hover:bg-brand-soft" style={{ fontSize: 13.5, fontWeight: 600 }}>
                      {sq.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button onClick={handleMarkQualified} className="btn btn-secondary btn-sm w-full mt-2"><Zap size={15} /> Mark as a good lead</button>
            <p style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 6 }}>"Good lead" tells Facebook ads to find more people like this.</p>
          </div>

          <button onClick={handleDelete} className="flex items-center justify-center gap-2" style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink-3)', padding: 8 }}>
            <Trash2 size={14} /> Delete this lead
          </button>
        </aside>
      </div>
    </div>
  );
}

const PROFILE_STAGES = ['new', 'contacted', 'interested', 'negotiating', 'won', 'lost'];
function ProfileStagePicker({ value, onPick }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <StatusCell stage={value} onClick={() => setOpen(!open)} title="Change status" />
      {open && (
        <>
          <div className="fixed inset-0 z-20" onClick={() => setOpen(false)} />
          <div className="absolute z-30 popover popover-flush" style={{ top: 36, left: 0, width: 170 }}>
            {PROFILE_STAGES.map((st) => (
              <button key={st} onClick={() => { setOpen(false); onPick(st); }} className="w-full flex" style={{ padding: 4 }}>
                <StatusCell stage={st} style={{ width: '100%', outline: st === value ? '2px solid var(--ink)' : 'none', outlineOffset: 1 }} />
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function DetailRow({ label, value, mono }) {
  return (
    <div className="hairline-b py-2.5 flex items-baseline justify-between" style={{ gap: 12 }}>
      <dt className="meta-label flex-shrink-0">{label}</dt>
      <dd className={`text-ink-primary text-right min-w-0 break-all ${mono ? 'mono' : ''}`} style={{ fontSize: '13.5px', fontWeight: 500 }}>{value || '—'}</dd>
    </div>
  );
}

function EngagementSection({ engagement }) {
  if (!engagement) {
    return <div className="hairline pt-4"><p className="text-ink-tertiary" style={{ fontSize: '14px' }}>Loading engagement data...</p></div>;
  }

  const { score, reasons, metrics, activities } = engagement;
  const scoreColor = score >= 70 ? '#0E8A5F' : score >= 40 ? '#B45309' : '#B45309';

  return (
    <div className="space-y-6">
      {/* Conversion signal — display number + bar */}
      <div className="hairline pt-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-ink-primary" style={{ fontSize: '22px', fontWeight: 600 }}>Conversion signal</h2>
          <span className="text-ink-tertiary" style={{ fontSize: '13px' }}>estimate</span>
        </div>
        <div className="flex items-baseline gap-4 mb-4">
          <span className="mono text-ink-primary" style={{ fontSize: '56px', fontWeight: 700, letterSpacing: '-0.02em', lineHeight: '1.05', color: scoreColor }}>
            {score}%
          </span>
          <div className="flex-1 h-2 bg-transparent" style={{ borderBottom: '1px solid #E7E5E4' }}>
            <div className="h-full transition-all duration-500" style={{ width: `${score}%`, background: scoreColor }} />
          </div>
        </div>

        {/* Reasons — hairline list */}
        {reasons && reasons.length > 0 ? (
          <div className="space-y-0">
            <p className="meta-label mb-2">Signal reasons</p>
            {reasons.map((r, idx) => (
              <div key={idx} className="hairline-b py-2.5 flex items-center justify-between">
                <span className="text-ink-primary" style={{ fontSize: '14px' }}>{r.label}</span>
                <span className="mono font-semibold" style={{ fontSize: '14px', color: r.points > 0 ? '#0E8A5F' : '#B45309' }}>
                  {r.points > 0 ? '+' : ''}{r.points}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-ink-tertiary" style={{ fontSize: '14px' }}>No engagement signals yet. Send emails or share documents to generate signals.</p>
        )}
      </div>

      {/* Metrics — inline row with hairline separators */}
      <div className="hairline pt-4">
        <p className="meta-label mb-3">Metrics</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-0">
          <MetricItem label="Doc views" value={metrics?.totalDocViews || 0} />
          <MetricItem label="Email opens" value={metrics?.emailOpens || 0} border />
          <MetricItem label="Email clicks" value={metrics?.emailClicks || 0} border />
          <MetricItem label="Time spent" value={`${Math.floor((metrics?.totalTimeSpent || 0) / 60)}m ${((metrics?.totalTimeSpent || 0) % 60)}s`} border />
        </div>
      </div>

      {/* Activity timeline */}
      <div className="hairline pt-4">
        <h2 className="text-ink-primary mb-4" style={{ fontSize: '22px', fontWeight: 600 }}>Engagement timeline</h2>
        <div className="space-y-0 max-h-64 overflow-y-auto">
          {activities && activities.length > 0 ? activities.map((act, idx) => (
            <div key={act.id || idx} className="hairline-b py-3">
              <p className="text-ink-primary font-medium" style={{ fontSize: '14px' }}>{act.description}</p>
              <p className="text-ink-tertiary mt-0.5 mono" style={{ fontSize: '12px' }}>{new Date(act.created_at).toLocaleString()}</p>
            </div>
          )) : <p className="text-ink-tertiary py-4" style={{ fontSize: '14px' }}>No activities recorded yet</p>}
        </div>
      </div>
    </div>
  );
}

function MetricItem({ label, value, border }) {
  return (
    <div className={`py-3 ${border ? 'sm:border-l sm:border-hairline sm:pl-4' : ''}`}>
      <p className="meta-label mb-1">{label}</p>
      <p className="mono text-ink-primary" style={{ fontSize: '22px', fontWeight: 600 }}>{value}</p>
    </div>
  );
}

