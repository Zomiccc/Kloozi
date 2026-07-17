import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import API from '../lib/api';
import toast from 'react-hot-toast';
import {
  ArrowLeft, Phone, Mail, MessageSquare, Smartphone, Edit, Trash2,
  Calendar, Clock, CheckCircle, Tag, User, Activity, Zap, FileText,
  Send, MapPin, DollarSign, Users, ChevronRight, Star
} from 'lucide-react';

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

  useEffect(() => { loadLead(); }, [id]);

  const loadLead = async () => {
    try {
      const res = await API.get(`/leads/${id}`);
      setData(res.data);
      setForm(res.data.lead);
      loadWhatsappMessages();
      loadContentViews();
    } catch (err) {
      toast.error('Failed to load lead');
      navigate('/leads');
    } finally { setLoading(false); }
  };

  const loadWhatsappMessages = async () => {
    try { const res = await API.get(`/whatsapp/conversation/${id}`); setWhatsappMessages(res.data.messages || []); } catch {}
  };

  const loadContentViews = async () => {
    try { const res = await API.get(`/content/lead/${id}/views`); setContentViews(res.data.views || []); } catch {}
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
      navigate('/leads');
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

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full" /></div>;
  if (!data) return null;

  const lead = data.lead;
  const stageColors = { new: 'bg-blue-100 text-blue-700', contacted: 'bg-purple-100 text-purple-700', interested: 'bg-amber-100 text-amber-700', negotiating: 'bg-orange-100 text-orange-700', won: 'bg-green-100 text-green-700', lost: 'bg-red-100 text-red-700' };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <button onClick={() => navigate('/leads')} className="p-2 hover:bg-dark-100 rounded-lg"><ArrowLeft size={20} /></button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-dark-900">{lead.first_name} {lead.last_name}</h1>
          <p className="text-dark-400 flex items-center gap-2"><MapPin size={14} /> {lead.city} • <Tag size={14} /> {lead.lead_source}</p>
        </div>
        <span className={`badge ${stageColors[lead.stage]}`}>{lead.stage}</span>
        <span className={`badge ${lead.score >= 70 ? 'bg-green-100 text-green-700' : lead.score >= 40 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>Score: {lead.score}</span>
      </div>

      {/* Quick actions */}
      <div className="flex gap-2 flex-wrap">
        <button onClick={handleCall} disabled={!lead.phone} className="btn btn-secondary flex items-center gap-2"><Phone size={16} /> Call</button>
        <button onClick={() => setShowMessage(!showMessage)} disabled={!lead.phone} className="btn btn-secondary flex items-center gap-2"><MessageSquare size={16} /> WhatsApp</button>
        <button onClick={handleWhatsApp} disabled={!lead.phone} className="btn btn-secondary flex items-center gap-2"><MessageSquare size={16} /> Open Chat</button>
        <button onClick={handleEmail} disabled={!lead.email} className="btn btn-secondary flex items-center gap-2"><Mail size={16} /> Email</button>
        <button onClick={handleSMS} disabled={!lead.phone} className="btn btn-secondary flex items-center gap-2"><Smartphone size={16} /> SMS</button>
        <button onClick={() => setEditing(!editing)} className="btn btn-secondary flex items-center gap-2"><Edit size={16} /> {editing ? 'Cancel' : 'Edit'}</button>
        {lead.lead_source === 'facebook' && <button onClick={handleMarkQualified} className="btn btn-success flex items-center gap-2"><Zap size={16} /> Mark as Qualified</button>}
        <button onClick={handleDelete} className="btn btn-danger flex items-center gap-2"><Trash2 size={16} /> Delete</button>
      </div>

      {/* WhatsApp message box */}
      {showMessage && (
        <div className="card bg-green-50 border-green-200">
          <div className="flex items-center justify-between mb-2"><h3 className="font-medium text-dark-900">Send WhatsApp Message</h3><button onClick={() => setShowMessage(false)}>✕</button></div>
          <textarea className="input" rows={3} placeholder="Type your message..." value={messageText} onChange={e => setMessageText(e.target.value)} />
          <button onClick={handleSendWhatsApp} className="btn btn-primary mt-2 flex items-center gap-2"><Send size={16} /> Send</button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Lead details */}
        <div className="card">
          <h3 className="font-semibold text-dark-900 mb-4">Lead Details</h3>
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
              <div><dt className="text-sm text-dark-400">Notes</dt><dd className="text-sm text-dark-700 mt-1">{lead.notes || 'No notes'}</dd></div>
              {lead.tags && lead.tags.length > 0 && (
                <div><dt className="text-sm text-dark-400">Tags</dt><dd className="flex gap-1 mt-1 flex-wrap">{lead.tags.map(t => <span key={t} className="badge bg-primary-100 text-primary-700">{t}</span>)}</dd></div>
              )}
            </dl>
          )}
        </div>

        {/* Right column: tabs */}
        <div className="lg:col-span-2 space-y-4">
          {/* Tab bar */}
          <div className="flex gap-1 border-b border-dark-100">
            {[
              { key: 'activity', label: 'Activity', icon: Activity },
              { key: 'whatsapp', label: 'WhatsApp', icon: MessageSquare },
              { key: 'content', label: 'Content Views', icon: FileText },
              { key: 'followups', label: 'Follow-ups', icon: Calendar },
              { key: 'calls', label: 'Calls', icon: Phone },
            ].map(t => (
              <button key={t.key} onClick={() => setActiveTab(t.key)} className={`px-3 py-2 text-sm font-medium flex items-center gap-1 ${activeTab === t.key ? 'text-primary-600 border-b-2 border-primary-600' : 'text-dark-400 hover:text-dark-600'}`}>
                <t.icon size={14} /> {t.label}
              </button>
            ))}
          </div>

          {/* Activity timeline */}
          {activeTab === 'activity' && (
            <div className="card">
              <h3 className="font-semibold text-dark-900 mb-4 flex items-center gap-2"><Activity size={18} /> Activity Timeline</h3>
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {data.activities && data.activities.length > 0 ? data.activities.map((act) => (
                  <div key={act.id} className="flex gap-3 pb-3 border-b border-dark-50 last:border-0">
                    <div className="w-8 h-8 bg-primary-50 rounded-full flex items-center justify-center flex-shrink-0">
                      <Activity size={14} className="text-primary-600" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm text-dark-900">{act.description}</p>
                      <p className="text-xs text-dark-400 mt-0.5">{new Date(act.created_at).toLocaleString()}</p>
                    </div>
                  </div>
                )) : <p className="text-dark-400 text-sm">No activities yet</p>}
              </div>
            </div>
          )}

          {/* WhatsApp messages */}
          {activeTab === 'whatsapp' && (
            <div className="card">
              <h3 className="font-semibold text-dark-900 mb-4 flex items-center gap-2"><MessageSquare size={18} /> WhatsApp Conversation</h3>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {whatsappMessages.length > 0 ? whatsappMessages.map(msg => (
                  <div key={msg.id} className={`flex ${msg.direction === 'outgoing' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[70%] rounded-lg px-3 py-2 ${msg.direction === 'outgoing' ? 'bg-primary-600 text-white' : 'bg-dark-100 text-dark-900'}`}>
                      <p className="text-sm">{msg.message}</p>
                      <p className={`text-xs mt-1 ${msg.direction === 'outgoing' ? 'text-primary-200' : 'text-dark-400'}`}>{new Date(msg.created_at).toLocaleTimeString()}</p>
                    </div>
                  </div>
                )) : <p className="text-dark-400 text-sm">No WhatsApp messages yet</p>}
              </div>
            </div>
          )}

          {/* Content views */}
          {activeTab === 'content' && (
            <div className="card">
              <h3 className="font-semibold text-dark-900 mb-4 flex items-center gap-2"><FileText size={18} /> Content Views</h3>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {contentViews.length > 0 ? contentViews.map(v => (
                  <div key={v.id} className="flex items-center justify-between py-2 border-b border-dark-50 last:border-0">
                    <div><p className="text-sm font-medium text-dark-900">{v.file_name || 'Unknown file'}</p><p className="text-xs text-dark-400">{v.views || 1} views</p></div>
                    <p className="text-xs text-dark-400">{new Date(v.created_at).toLocaleString()}</p>
                  </div>
                )) : <p className="text-dark-400 text-sm">No content viewed yet</p>}
              </div>
            </div>
          )}

          {/* Follow-ups */}
          {activeTab === 'followups' && (
            <div className="card">
              <h3 className="font-semibold text-dark-900 mb-4 flex items-center gap-2"><Calendar size={18} /> Follow-ups</h3>
              {data.followUps && data.followUps.length > 0 ? data.followUps.map((fu) => (
                <div key={fu.id} className="flex items-center justify-between py-2 border-b border-dark-50 last:border-0">
                  <div><p className="text-sm font-medium text-dark-900">{fu.type}</p><p className="text-xs text-dark-400">{fu.title || 'No title'}</p></div>
                  <div className="text-right"><p className="text-xs text-dark-500">{new Date(fu.due_date).toLocaleString()}</p><span className={`badge ${fu.status === 'completed' ? 'bg-green-100 text-green-700' : fu.status === 'pending' ? 'bg-amber-100 text-amber-700' : 'bg-dark-100 text-dark-600'}`}>{fu.status}</span></div>
                </div>
              )) : <p className="text-dark-400 text-sm">No follow-ups</p>}
            </div>
          )}

          {/* Calls */}
          {activeTab === 'calls' && (
            <div className="card">
              <h3 className="font-semibold text-dark-900 mb-4 flex items-center gap-2"><Phone size={18} /> Call History</h3>
              {data.calls && data.calls.length > 0 ? data.calls.map((call) => (
                <div key={call.id} className="flex items-center justify-between py-2 border-b border-dark-50 last:border-0">
                  <div><p className="text-sm font-medium text-dark-900">{call.outcome}</p><p className="text-xs text-dark-400">{call.notes || 'No notes'}</p></div>
                  <p className="text-xs text-dark-400">{new Date(call.created_at).toLocaleString()}</p>
                </div>
              )) : <p className="text-dark-400 text-sm">No calls logged</p>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Detail({ icon: Icon, label, value }) {
  return <div className="flex items-center justify-between"><dt className="text-sm text-dark-400 flex items-center gap-1.5"><Icon size={14} /> {label}</dt><dd className="text-sm text-dark-700 font-medium">{value || '-'}</dd></div>;
}
