import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import API from '../lib/api';
import toast from 'react-hot-toast';
import {
  ArrowLeft, Phone, Mail, MessageSquare, Smartphone, Edit, Trash2,
  Calendar, Activity, Zap, FileText,
  Send, MapPin, DollarSign, Tag, User, TrendingUp, Eye, Clock, Target
} from 'lucide-react';

const stageConfig = {
  new: { color: '#0066FF', bg: '#0066FF10' },
  contacted: { color: '#FF9500', bg: '#FF950010' },
  interested: { color: '#AF52DE', bg: '#AF52DE10' },
  negotiating: { color: '#FF3B5C', bg: '#FF3B5C10' },
  won: { color: '#34C759', bg: '#34C75910' },
  lost: { color: '#8E8E93', bg: '#8E8E9310' },
};

export default function LeadProfile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({});
  const [activeTab, setActiveTab] = useState('activity');
  const [whatsappMessages, setWhatsappMessages] = useState([]);
  const [contentViews, setContentViews] = useState([]);
  const [showMessage, setShowMessage] = useState(false);
  const [messageText, setMessageText] = useState('');
  const [engagement, setEngagement] = useState(null);

  useEffect(() => { loadLead(); }, [id]);

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

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this lead?')) return;
    try {
      await API.delete(`/leads/${id}`);
      toast.success('Lead deleted');
      navigate('/app/leads');
    } catch (err) { toast.error('Delete failed'); }
  };

  const handleMarkQualified = async () => {
    try { await API.post(`/automations/meta-capi/lead/${id}/qualified`); toast.success('Lead marked as qualified! Meta CAPI event sent.'); loadLead(); }
    catch { toast.error('Failed'); }
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
        <div className="skeleton h-24" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="skeleton h-64" />
          <div className="lg:col-span-2 skeleton h-64" />
        </div>
      </div>
    );
  }
  if (!data) return null;

  const lead = data.lead;
  const initials = `${(lead.first_name || '?')[0]}${(lead.last_name || '')[0] || ''}`.toUpperCase();
  const stageCfg = stageConfig[lead.stage] || stageConfig.new;
  const scoreColor = lead.score >= 70 ? '#34C759' : lead.score >= 40 ? '#FF9500' : '#FF3B5C';

  return (
    <div className="space-y-6">
      <button onClick={() => navigate('/app/leads')} className="flex items-center gap-2 text-sm font-semibold text-ink-secondary hover:text-ink-primary transition-colors">
        <ArrowLeft size={16} /> Back to Leads
      </button>

      {/* Hero Section */}
      <div className="card stagger-in" style={{ padding: '32px' }}>
        <div className="flex items-center gap-5 flex-wrap">
          <div
            className="w-20 h-20 rounded-3xl flex items-center justify-center text-white text-2xl font-extrabold flex-shrink-0 shadow-card"
            style={{ background: 'linear-gradient(135deg, #0066FF, #AF52DE)' }}
          >
            {initials}
          </div>
          <div className="flex-1 min-w-[200px]">
            <h1 className="text-3xl font-extrabold text-ink-primary tracking-tight">{lead.first_name} {lead.last_name}</h1>
            <p className="text-ink-secondary flex items-center gap-3 mt-1.5 text-sm flex-wrap">
              {lead.city && <span className="flex items-center gap-1"><MapPin size={14} /> {lead.city}</span>}
              <span className="flex items-center gap-1"><Tag size={14} /> {lead.lead_source}</span>
            </p>
            <div className="flex gap-2 mt-3">
              <span className="badge capitalize" style={{ background: stageCfg.bg, color: stageCfg.color, padding: '4px 12px' }}>
                {lead.stage}
              </span>
              <span className="badge" style={{ background: `${scoreColor}15`, color: scoreColor, padding: '4px 12px' }}>
                Score: {lead.score || 0}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Quick action buttons */}
      <div className="flex gap-2 flex-wrap">
        <button onClick={handleCall} disabled={!lead.phone} className="btn btn-ghost" style={{ color: '#34C759', borderColor: '#34C75930' }}><Phone size={16} /> Call</button>
        <button onClick={() => setShowMessage(!showMessage)} disabled={!lead.phone} className="btn btn-ghost" style={{ color: '#34C759', borderColor: '#34C75930' }}><MessageSquare size={16} /> WhatsApp</button>
        <button onClick={handleWhatsApp} disabled={!lead.phone} className="btn btn-ghost"><MessageSquare size={16} /> Open Chat</button>
        <button onClick={handleEmail} disabled={!lead.email} className="btn btn-ghost" style={{ color: '#0066FF', borderColor: '#0066FF30' }}><Mail size={16} /> Email</button>
        <button onClick={handleSMS} disabled={!lead.phone} className="btn btn-ghost"><Smartphone size={16} /> SMS</button>
        <button onClick={() => setEditing(!editing)} className="btn btn-ghost"><Edit size={16} /> {editing ? 'Cancel' : 'Edit'}</button>
        <button onClick={handleMarkQualified} className="btn btn-blue"><Zap size={16} /> Mark Qualified</button>
        <button onClick={handleDelete} className="btn btn-ghost" style={{ color: '#FF3B5C' }}><Trash2 size={16} /> Delete</button>
      </div>

      {/* WhatsApp message box */}
      {showMessage && (
        <div className="card animate-slide-up" style={{ borderColor: '#34C75930' }}>
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-ink-primary">Send WhatsApp Message</h3>
            <button onClick={() => setShowMessage(false)} className="text-ink-tertiary hover:text-ink-primary">✕</button>
          </div>
          <textarea className="input" rows={3} placeholder="Type your message..." value={messageText} onChange={e => setMessageText(e.target.value)} />
          <button onClick={handleSendWhatsApp} className="btn btn-primary mt-3"><Send size={16} /> Send</button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Lead details */}
        <div className="card stagger-in" style={{ animationDelay: '80ms' }}>
          <h3 className="text-lg font-bold text-ink-primary mb-4">Lead Details</h3>
          {editing ? (
            <div className="space-y-3">
              <input className="input" placeholder="First Name" value={form.first_name || ''} onChange={(e) => setForm({ ...form, first_name: e.target.value })} />
              <input className="input" placeholder="Last Name" value={form.last_name || ''} onChange={(e) => setForm({ ...form, last_name: e.target.value })} />
              <input className="input" placeholder="Phone" value={form.phone || ''} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              <input className="input" placeholder="Email" value={form.email || ''} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              <input className="input" placeholder="City" value={form.city || ''} onChange={(e) => setForm({ ...form, city: e.target.value })} />
              <input type="number" className="input" placeholder="Budget" value={form.budget || ''} onChange={(e) => setForm({ ...form, budget: e.target.value })} />
              <select className="input" value={form.stage || ''} onChange={(e) => setForm({ ...form, stage: e.target.value })}>
                <option value="new">New</option><option value="contacted">Contacted</option>
                <option value="interested">Interested</option><option value="negotiating">Negotiating</option>
                <option value="won">Won</option><option value="lost">Lost</option>
              </select>
              <textarea className="input" rows={3} placeholder="Notes" value={form.notes || ''} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
              <button onClick={handleSave} className="btn btn-primary w-full">Save Changes</button>
            </div>
          ) : (
            <dl className="space-y-3">
              <Detail icon={Phone} label="Phone" value={lead.phone} />
              <Detail icon={Mail} label="Email" value={lead.email} />
              <Detail icon={MapPin} label="City" value={lead.city} />
              <Detail icon={DollarSign} label="Budget" value={lead.budget ? `$${parseInt(lead.budget).toLocaleString()}` : '-'} />
              <Detail icon={Tag} label="Source" value={lead.lead_source} />
              <Detail icon={User} label="Agent" value={lead.agent_first_name ? `${lead.agent_first_name} ${lead.agent_last_name}` : 'Unassigned'} />
              <Detail icon={Calendar} label="Created" value={new Date(lead.created_at).toLocaleDateString()} />
              <div><dt className="text-sm font-semibold text-ink-secondary">Notes</dt><dd className="text-sm text-ink-primary mt-1">{lead.notes || 'No notes'}</dd></div>
              {lead.tags && lead.tags.length > 0 && (
                <div><dt className="text-sm font-semibold text-ink-secondary">Tags</dt><dd className="flex gap-1 mt-1 flex-wrap">{lead.tags.map((t, idx) => <span key={t || idx} className="badge" style={{ background: '#0066FF10', color: '#0066FF' }}>{t}</span>)}</dd></div>
              )}
            </dl>
          )}
        </div>

        {/* Right column: tabs */}
        <div className="lg:col-span-2 space-y-4">
          {/* Tab bar */}
          <div className="flex gap-1 bg-white border border-surface-border rounded-full p-1 flex-wrap">
            {[
              { key: 'activity', label: 'Activity', icon: Activity },
              { key: 'engagement', label: 'Engagement', icon: TrendingUp },
              { key: 'whatsapp', label: 'WhatsApp', icon: MessageSquare },
              { key: 'content', label: 'Content Views', icon: FileText },
              { key: 'followups', label: 'Follow-ups', icon: Calendar },
              { key: 'calls', label: 'Calls', icon: Phone },
            ].map(t => (
              <button key={t.key} onClick={() => setActiveTab(t.key)} className={`tab-pill ${activeTab === t.key ? 'tab-pill-active bg-accent-red' : 'text-ink-secondary hover:text-ink-primary'}`}>
                <t.icon size={14} /> {t.label}
              </button>
            ))}
          </div>

          {/* Engagement tab */}
          {activeTab === 'engagement' && (
            <EngagementSection engagement={engagement} />
          )}

          {/* Activity timeline */}
          {activeTab === 'activity' && (
            <div className="card stagger-in">
              <h3 className="text-lg font-bold text-ink-primary mb-4 flex items-center gap-2"><Activity size={18} /> Activity Timeline</h3>
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {data.activities && data.activities.length > 0 ? data.activities.map((act, idx) => (
                  <div key={act.id || idx} className="flex gap-3 pb-3 border-b border-surface-border last:border-0">
                    <div className="w-8 h-8 rounded-xl bg-surface-page flex items-center justify-center flex-shrink-0">
                      <Activity size={14} className="text-accent-blue" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-ink-primary">{act.description}</p>
                      <p className="text-xs text-ink-tertiary mt-0.5">{new Date(act.created_at).toLocaleString()}</p>
                    </div>
                  </div>
                )) : <p className="text-ink-tertiary text-sm">No activities yet</p>}
              </div>
            </div>
          )}

          {/* WhatsApp messages */}
          {activeTab === 'whatsapp' && (
            <div className="card stagger-in">
              <h3 className="text-lg font-bold text-ink-primary mb-4 flex items-center gap-2"><MessageSquare size={18} /> WhatsApp Conversation</h3>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {whatsappMessages.length > 0 ? whatsappMessages.map((msg, idx) => (
                  <div key={msg.id || idx} className={`flex ${msg.direction === 'outgoing' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[70%] rounded-2xl px-4 py-2.5 ${msg.direction === 'outgoing' ? 'text-white' : 'bg-surface-page text-ink-primary'}`} style={msg.direction === 'outgoing' ? { background: '#34C759' } : {}}>
                      <p className="text-sm">{msg.message}</p>
                      <p className={`text-xs mt-1 ${msg.direction === 'outgoing' ? 'text-white/70' : 'text-ink-tertiary'}`}>{new Date(msg.created_at).toLocaleTimeString()}</p>
                    </div>
                  </div>
                )) : <p className="text-ink-tertiary text-sm">No WhatsApp messages yet</p>}
              </div>
            </div>
          )}

          {/* Content views */}
          {activeTab === 'content' && (
            <div className="card stagger-in">
              <h3 className="text-lg font-bold text-ink-primary mb-4 flex items-center gap-2"><FileText size={18} /> Content Views</h3>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {contentViews.length > 0 ? contentViews.map((v, idx) => (
                  <div key={v.id || idx} className="flex items-center justify-between py-2 border-b border-surface-border last:border-0">
                    <div><p className="text-sm font-bold text-ink-primary">{v.file_name || 'Unknown file'}</p><p className="text-xs text-ink-tertiary">{v.views || 1} views</p></div>
                    <p className="text-xs text-ink-tertiary">{new Date(v.created_at).toLocaleString()}</p>
                  </div>
                )) : <p className="text-ink-tertiary text-sm">No content viewed yet</p>}
              </div>
            </div>
          )}

          {/* Follow-ups */}
          {activeTab === 'followups' && (
            <div className="card stagger-in">
              <h3 className="text-lg font-bold text-ink-primary mb-4 flex items-center gap-2"><Calendar size={18} /> Follow-ups</h3>
              {data.followUps && data.followUps.length > 0 ? data.followUps.map((fu, idx) => (
                <div key={fu.id || idx} className="flex items-center justify-between py-2 border-b border-surface-border last:border-0">
                  <div><p className="text-sm font-bold text-ink-primary">{fu.type}</p><p className="text-xs text-ink-tertiary">{fu.title || 'No title'}</p></div>
                  <div className="text-right">
                    <p className="text-xs text-ink-tertiary">{new Date(fu.due_date).toLocaleString()}</p>
                    <span className="badge" style={{ background: fu.status === 'completed' ? '#34C75910' : fu.status === 'pending' ? '#FF950010' : '#8E8E9310', color: fu.status === 'completed' ? '#34C759' : fu.status === 'pending' ? '#FF9500' : '#8E8E93' }}>{fu.status}</span>
                  </div>
                </div>
              )) : <p className="text-ink-tertiary text-sm">No follow-ups</p>}
            </div>
          )}

          {/* Calls */}
          {activeTab === 'calls' && (
            <div className="card stagger-in">
              <h3 className="text-lg font-bold text-ink-primary mb-4 flex items-center gap-2"><Phone size={18} /> Call History</h3>
              {data.calls && data.calls.length > 0 ? data.calls.map((call, idx) => (
                <div key={call.id || idx} className="flex items-center justify-between py-2 border-b border-surface-border last:border-0">
                  <div><p className="text-sm font-bold text-ink-primary">{call.outcome}</p><p className="text-xs text-ink-tertiary">{call.notes || 'No notes'}</p></div>
                  <p className="text-xs text-ink-tertiary">{new Date(call.created_at).toLocaleString()}</p>
                </div>
              )) : <p className="text-ink-tertiary text-sm">No calls logged</p>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Detail({ icon: Icon, label, value }) {
  return <div className="flex items-center justify-between"><dt className="text-sm font-semibold text-ink-secondary flex items-center gap-1.5"><Icon size={14} /> {label}</dt><dd className="text-sm text-ink-primary font-bold">{value || '-'}</dd></div>;
}

function EngagementSection({ engagement }) {
  if (!engagement) {
    return <div className="card stagger-in"><p className="text-ink-tertiary text-sm">Loading engagement data...</p></div>;
  }

  const { score, reasons, metrics, activities } = engagement;
  const scoreColor = score >= 70 ? '#34C759' : score >= 40 ? '#FF9500' : '#FF3B5C';

  return (
    <div className="space-y-4">
      {/* Conversion Signal Score */}
      <div className="card stagger-in">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-ink-primary flex items-center gap-2">
            <Target size={18} style={{ color: scoreColor }} /> Conversion Signal
          </h3>
          <span className="text-xs text-ink-tertiary">(estimate based on activity)</span>
        </div>

        {/* Score bar */}
        <div className="mb-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="flex-1 h-3 rounded-full bg-surface-page overflow-hidden">
              <div className="h-full rounded-full transition-all" style={{ width: `${score}%`, background: scoreColor }} />
            </div>
            <span className="text-2xl font-extrabold" style={{ color: scoreColor }}>{score}%</span>
          </div>
        </div>

        {/* Reasons */}
        {reasons && reasons.length > 0 ? (
          <div className="space-y-2">
            <p className="text-sm font-semibold text-ink-secondary">Signal Reasons:</p>
            {reasons.map((r, idx) => (
              <div key={idx} className="flex items-center justify-between py-1.5 px-3 rounded-xl bg-surface-page">
                <span className="text-sm text-ink-primary">{r.label}</span>
                <span className="text-sm font-bold" style={{ color: r.points > 0 ? '#34C759' : '#FF3B5C' }}>
                  {r.points > 0 ? '+' : ''}{r.points}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-ink-tertiary">No engagement signals yet. Send emails or share documents to generate signals.</p>
        )}
      </div>

      {/* Metrics grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <MetricCard icon={Eye} label="Doc Views" value={metrics?.totalDocViews || 0} color="#0066FF" />
        <MetricCard icon={Mail} label="Email Opens" value={metrics?.emailOpens || 0} color="#FF9500" />
        <MetricCard icon={Target} label="Email Clicks" value={metrics?.emailClicks || 0} color="#AF52DE" />
        <MetricCard icon={Clock} label="Time Spent" value={`${Math.floor((metrics?.totalTimeSpent || 0) / 60)}m ${((metrics?.totalTimeSpent || 0) % 60)}s`} color="#34C759" />
      </div>

      {/* Activity timeline */}
      <div className="card stagger-in">
        <h3 className="text-lg font-bold text-ink-primary mb-4 flex items-center gap-2"><Activity size={18} /> Engagement Timeline</h3>
        <div className="space-y-3 max-h-64 overflow-y-auto">
          {activities && activities.length > 0 ? activities.map((act, idx) => (
            <div key={act.id || idx} className="flex gap-3 pb-3 border-b border-surface-border last:border-0">
              <div className="w-8 h-8 rounded-xl bg-surface-page flex items-center justify-center flex-shrink-0">
                <Activity size={14} className="text-accent-blue" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-ink-primary">{act.description}</p>
                <p className="text-xs text-ink-tertiary mt-0.5">{new Date(act.created_at).toLocaleString()}</p>
              </div>
            </div>
          )) : <p className="text-ink-tertiary text-sm">No activities recorded yet</p>}
        </div>
      </div>
    </div>
  );
}

function MetricCard({ icon: Icon, label, value, color }) {
  return (
    <div className="card stagger-in flex items-center gap-3" style={{ padding: '16px' }}>
      <div className="w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0" style={{ background: `${color}15` }}>
        <Icon size={20} style={{ color }} />
      </div>
      <div>
        <p className="text-lg font-extrabold text-ink-primary">{value}</p>
        <p className="text-xs font-semibold text-ink-tertiary">{label}</p>
      </div>
    </div>
  );
}

