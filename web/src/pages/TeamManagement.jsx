import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import API from '../lib/api';
import { CountUp, SectionTabs } from '../lib/motion';
import toast from 'react-hot-toast';
import { Plus, X, UserPlus, RefreshCw, ArrowRightLeft, GitBranch, MessageCircle } from 'lucide-react';

import SendPopup from '../components/SendPopup';
import { pillStyle } from '../components/ui';

export default function TeamManagement() {
  const navigate = useNavigate();
  const [members, setMembers] = useState([]);
  const [activity, setActivity] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showInvite, setShowInvite] = useState(false);
  const [tab, setTab] = useState('dashboard');
  const [subteams, setSubteams] = useState([]);
  const [assignmentRules, setAssignmentRules] = useState([]);
  const [stats, setStats] = useState({ totalLeads: 0, newLeads: 0, wonLeads: 0, totalCalls: 0, totalMessages: 0, activeAgents: 0 });
  const [messageTarget, setMessageTarget] = useState(null);
  const [showCompose, setShowCompose] = useState(false);
  const [teamMembers, setTeamMembers] = useState([]);

  useEffect(() => { loadMembers(); loadActivity(); loadSubteams(); loadAssignmentRules(); loadStats(); loadTeamMembersForMail(); }, []);

  const loadTeamMembersForMail = async () => {
    try { const res = await API.get('/flazyn-mail/team-members'); setTeamMembers(res.data.members || []); } catch {}
  };

  const handleMessageMember = (member) => { setMessageTarget(member); };
  const handleStartCompose = () => { setShowCompose(true); };

  const loadMembers = async () => {
    try { const res = await API.get('/team'); setMembers(res.data.members); }
    catch { toast.error('Failed to load team'); }
    finally { setLoading(false); }
  };

  const loadActivity = async () => {
    try { const res = await API.get('/team/activity-feed'); setActivity(res.data.activities); }
    catch {}
  };

  const loadSubteams = async () => {
    try { const res = await API.get('/team/subteams'); setSubteams(res.data.subteams || []); } catch {}
  };

  const loadAssignmentRules = async () => {
    try { const res = await API.get('/team/assignment-rules'); setAssignmentRules(res.data.rules || []); } catch {}
  };

  const loadStats = async () => {
    try { const res = await API.get('/analytics/team-stats'); setStats(res.data || stats); } catch {}
  };

  const handleInvite = async (data) => {
    try { await API.post('/team/invite', data); toast.success('Invitation sent'); setShowInvite(false); loadMembers(); }
    catch (err) { toast.error(err.response?.data?.error || 'Invite failed'); }
  };

  const handleSuspend = async (id) => {
    try { await API.post(`/team/${id}/suspend`); toast.success('Member suspended'); loadMembers(); }
    catch { toast.error('Failed'); }
  };

  const handleReactivate = async (id) => {
    try { await API.post(`/team/${id}/reactivate`); toast.success('Member reactivated'); loadMembers(); }
    catch { toast.error('Failed'); }
  };

  const roleDots = { super_admin: '#1C1917', admin: '#2F6FDB', sales_manager: '#EDE9FF', sales_agent: '#0E8A5F' };

  const sortedMembers = [...members].filter(m => m.status === 'active').sort((a, b) => (b.lead_count || 0) - (a.lead_count || 0));

  const tabs = [
    { key: 'dashboard', label: 'Dashboard' },
    { key: 'members', label: 'Members' },
    { key: 'subteams', label: 'Subteams' },
    { key: 'assignment', label: 'Lead Assignment' },
  ];

  return (
    <div className="space-y-6">
      {/* Header — editorial */}
      <div className="flex items-baseline justify-between flex-wrap gap-4">
        <h1 className="text-ink-primary" style={{ fontSize: '32px', fontWeight: 650, letterSpacing: '-0.01em' }}>Team</h1>
        <button onClick={() => setShowInvite(true)} className="text-ink-primary hover:text-accent-deep underline underline-offset-4 transition-colors" style={{ fontSize: '15px', fontWeight: 600 }}>Invite member</button>
      </div>

      {/* Tabs — pinned secondary bar */}
      <SectionTabs layoutId="team-tabs" tabs={tabs} active={tab} onChange={setTab} />

      {/* Dashboard tab */}
      {tab === 'dashboard' && (
        <div className="space-y-8">
          {/* Metrics — hairline row, no cards */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-0">
            {[
              { label: 'Total leads', value: stats.totalLeads },
              { label: 'New leads', value: stats.newLeads },
              { label: 'Won', value: stats.wonLeads },
              { label: 'Calls', value: stats.totalCalls },
              { label: 'Messages', value: stats.totalMessages },
              { label: 'Active agents', value: stats.activeAgents || members.filter(m => m.status === 'active').length },
            ].map((s, i) => (
              <motion.div key={s.label} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i * 0.04, 0.3), duration: 0.2 }} className={i > 0 ? 'hairline-l pl-4' : ''}>
                <p className="meta-label mb-1">{s.label}</p>
                <p className="mono text-ink-primary" style={{ fontSize: '28px', fontWeight: 600 }}><CountUp value={Number(s.value) || 0} /></p>
              </motion.div>
            ))}
          </div>

          {/* Leaderboard — hairline rows */}
          <div>
            <p className="meta-label mb-3">Leaderboard</p>
            {sortedMembers.map((m, idx) => (
              <motion.div key={m.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(idx * 0.04, 0.3), duration: 0.2 }} className="hairline-b py-3 flex items-center gap-3">
                <span className="mono text-ink-tertiary flex-shrink-0" style={{ fontSize: '14px', fontWeight: 600 }}>{idx + 1}</span>
                <span className="flex items-center justify-center  flex-shrink-0" style={{ background: '#F5F5F4', color: '#1C1917', width: '28px', height: '28px', borderRadius: '10px', fontSize: '11px', fontWeight: 700 }}>
                  {(m.first_name || '?')[0]}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-ink-primary truncate" style={{ fontSize: '14px', fontWeight: 500 }}>{m.first_name} {m.last_name}</p>
                </div>
                <span className="mono text-ink-secondary flex-shrink-0" style={{ fontSize: '13px' }}>{m.lead_count || 0} leads</span>
                <span className="mono text-ink-tertiary flex-shrink-0" style={{ fontSize: '13px' }}>{m.won_count || 0} won</span>
                <span className="mono text-ink-tertiary flex-shrink-0" style={{ fontSize: '13px' }}>{m.lead_count > 0 ? Math.round(((m.won_count || 0) / m.lead_count) * 100) : 0}%</span>
              </motion.div>
            ))}
          </div>

          {/* Activity feed — hairline rows */}
          <div>
            <p className="meta-label mb-3">Team activity (last 24h)</p>
            {activity.length === 0 ? (
              <p className="text-ink-tertiary" style={{ fontSize: '14px' }}>No recent activity</p>
            ) : (
              <div className="max-h-96 overflow-y-auto">
                {activity.map((a, idx) => (
                  <motion.div key={a.id || `activity-${idx}`} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(idx * 0.04, 0.3), duration: 0.2 }} className="hairline-b py-3 flex items-center gap-3">
                    <span className="flex items-center justify-center  flex-shrink-0" style={{ background: '#F5F5F4', color: '#1C1917', width: '28px', height: '28px', borderRadius: '10px', fontSize: '11px', fontWeight: 700 }}>
                      {(a.first_name || '?')[0]}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-ink-secondary" style={{ fontSize: '14px' }}>
                        <span className="text-ink-primary font-medium">{a.first_name} {a.last_name}</span> — {a.description}
                      </p>
                      <p className="text-ink-tertiary mono" style={{ fontSize: '12px' }}>{new Date(a.created_at).toLocaleString()}</p>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Members tab */}
      {tab === 'members' && (
        loading ? (
          <div className="space-y-2">
            {[1, 2, 3, 4, 5].map((i) => <div key={i} className="skeleton h-12" />)}
          </div>
        ) : (
          <div>
            {/* Header row */}
            <div className="hairline-b pb-2 flex items-center gap-4">
              <span className="meta-label flex-shrink-0" style={{ width: '28px' }}></span>
              <span className="meta-label flex-1">Name</span>
              <span className="meta-label flex-shrink-0" style={{ width: '100px' }}>Role</span>
              <span className="meta-label flex-shrink-0 mono" style={{ width: '60px' }}>Leads</span>
              <span className="meta-label flex-shrink-0 mono" style={{ width: '60px' }}>Won</span>
              <span className="meta-label flex-shrink-0 mono" style={{ width: '70px' }}>Calls</span>
              <span className="meta-label flex-shrink-0" style={{ width: '80px' }}>Status</span>
              <span className="meta-label flex-shrink-0" style={{ width: '80px' }}></span>
            </div>
            {members.map((m, idx) => (
              <motion.div key={m.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(idx * 0.04, 0.3), duration: 0.2 }} className="group hairline-b py-3 flex items-center gap-4">
                {/* Monogram */}
                <span className="flex items-center justify-center  flex-shrink-0" style={{ background: '#F5F5F4', color: '#1C1917', width: '28px', height: '28px', borderRadius: '10px', fontSize: '11px', fontWeight: 700 }}>
                  {(m.first_name || '?')[0]}
                </span>
                {/* Name */}
                <div className="flex-1 min-w-0">
                  <p className="text-ink-primary truncate" style={{ fontSize: '14px', fontWeight: 500 }}>{m.first_name} {m.last_name}</p>
                  <p className="text-ink-tertiary truncate" style={{ fontSize: '12px' }}>{m.email}</p>
                </div>
                {/* Role */}
                <span className="capitalize flex-shrink-0" style={pillStyle(roleDots[m.role] || roleDots.sales_agent)}>
                  {(m.role || 'sales_agent').replace('_', ' ')}
                </span>
                {/* Leads */}
                <span className="mono text-ink-secondary flex-shrink-0" style={{ width: '60px', fontSize: '13px' }}>{m.lead_count || 0}</span>
                {/* Won */}
                <span className="mono text-ink-secondary flex-shrink-0" style={{ width: '60px', fontSize: '13px' }}>{m.won_count || 0}</span>
                {/* Calls */}
                <span className="mono text-ink-secondary flex-shrink-0" style={{ width: '70px', fontSize: '13px' }}>{m.calls_today || 0}</span>
                {/* Status */}
                <span className="capitalize flex-shrink-0" style={pillStyle(m.status === 'active' ? '#0E8A5F' : m.status === 'suspended' ? '#B45309' : '#EDE9FF')}>
                  {m.status}
                </span>
                {/* Actions */}
                <div className="flex items-center gap-3 flex-shrink-0" style={{ width: '80px' }}>
                  <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-3">
                    {m.status === 'active' ? (
                      <button onClick={() => handleSuspend(m.id)} className="text-ink-tertiary hover:text-ink-primary transition-colors" style={{ fontSize: '13px' }}>Suspend</button>
                    ) : (
                      <button onClick={() => handleReactivate(m.id)} className="text-ink-tertiary hover:text-ink-primary transition-colors" style={{ fontSize: '13px' }}>Reactivate</button>
                    )}
                  </div>
                  {m.status === 'active' && (
                    <button onClick={() => handleMessageMember(m)} className="text-ink-tertiary hover:text-ink-primary transition-colors opacity-0 group-hover:opacity-100" title="Message">
                      <MessageCircle size={14} />
                    </button>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        )
      )}

      {/* Subteams tab */}
      {tab === 'subteams' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <p className="text-ink-secondary" style={{ fontSize: '14px' }}>Create subteams to organize your agents and distribute leads efficiently.</p>
            <button onClick={() => toast.success('Create subteam modal')} className="text-ink-primary hover:text-accent-deep underline underline-offset-4 transition-colors" style={{ fontSize: '15px', fontWeight: 600 }}>Create subteam</button>
          </div>
          {subteams.length === 0 ? (
            <div className="text-center py-20">
              <GitBranch size={28} className="text-ink-tertiary mx-auto mb-4" />
              <p className="text-ink-primary" style={{ fontSize: '22px', fontWeight: 600 }}>No subteams yet.</p>
              <p className="text-ink-secondary mt-2" style={{ fontSize: '15px' }}>Create subteams to organize your agents.</p>
            </div>
          ) : (
            <div>
              {subteams.map((st, idx) => (
                <motion.div key={st.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(idx * 0.04, 0.3), duration: 0.2 }} className="hairline-b py-4 flex items-center justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-ink-primary font-semibold" style={{ fontSize: '15px' }}>{st.name}</h3>
                    <div className="flex items-center gap-4 mt-1">
                      <span className="text-ink-secondary mono" style={{ fontSize: '13px' }}>{st.member_count || 0} members</span>
                      <span className="text-ink-secondary mono" style={{ fontSize: '13px' }}>{st.lead_count || 0} leads</span>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Lead Assignment tab */}
      {tab === 'assignment' && (
        <div className="space-y-4">
          <p className="text-ink-secondary" style={{ fontSize: '14px' }}>Configure how new leads are assigned to your team members. Rules are processed in order of priority.</p>
          {assignmentRules.length === 0 ? (
            <div className="text-center py-20">
              <ArrowRightLeft size={28} className="text-ink-tertiary mx-auto mb-4" />
              <p className="text-ink-primary" style={{ fontSize: '22px', fontWeight: 600 }}>No assignment rules yet.</p>
              <p className="text-ink-secondary mt-2" style={{ fontSize: '15px' }}>Leads will be assigned round-robin by default.</p>
            </div>
          ) : (
            <div>
              {assignmentRules.map((r, idx) => (
                <motion.div key={r.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(idx * 0.04, 0.3), duration: 0.2 }} className="hairline-b py-4 flex items-center justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-ink-primary font-semibold" style={{ fontSize: '15px' }}>{r.name}</h3>
                    <p className="text-ink-tertiary mt-1" style={{ fontSize: '13px' }}>{r.conditions} → {r.action}</p>
                  </div>
                  <span className=" flex-shrink-0" style={pillStyle(r.is_active ? '#0E8A5F' : '#A8A29E')}>
                    {r.is_active ? 'Active' : 'Inactive'}
                  </span>
                </motion.div>
              ))}
            </div>
          )}
          <button onClick={() => navigate('/app/automations/rules')} className="text-ink-primary hover:text-accent-deep underline underline-offset-4 transition-colors" style={{ fontSize: '15px', fontWeight: 600 }}>Configure automation rules</button>
        </div>
      )}

      {showInvite && <InviteModal onClose={() => setShowInvite(false)} onInvite={handleInvite} />}

      {messageTarget && (
        <SendPopup
          recipientName={`${messageTarget.first_name} ${messageTarget.last_name}`}
          onClose={() => setMessageTarget(null)}
          onFlazynMail={() => { setShowCompose(true); }}
        />
      )}

      {showCompose && messageTarget && (
        <ComposeFromTeam
          onClose={() => { setShowCompose(false); setMessageTarget(null); }}
          teamMembers={teamMembers}
          prefillRecipient={messageTarget.id}
        />
      )}
    </div>
  );
}

function InviteModal({ onClose, onInvite }) {
  const [form, setForm] = useState({ email: '', role: 'sales_agent', first_name: '', last_name: '', designation: '' });
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(28,25,23,0.25)' }} onClick={onClose}>
      <div className="card-raised w-full max-w-md animate-scale-in" style={{ borderRadius: '10px' }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between hairline-b pb-4 mb-4">
          <h2 className="text-ink-primary" style={{ fontSize: '22px', fontWeight: 600 }}>Invite team member</h2>
          <button onClick={onClose} className="text-ink-tertiary hover:text-ink-primary transition-colors"><X size={18} /></button>
        </div>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="meta-label mb-1">First name</p>
              <input className="input" value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} />
            </div>
            <div>
              <p className="meta-label mb-1">Last name</p>
              <input className="input" value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} />
            </div>
          </div>
          <div>
            <p className="meta-label mb-1">Email</p>
            <input className="input" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </div>
          <div>
            <p className="meta-label mb-1">Role</p>
            <select className="input" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
              <option value="sales_agent">Sales Agent</option><option value="sales_manager">Sales Manager</option><option value="admin">Admin</option>
            </select>
          </div>
          <div>
            <p className="meta-label mb-1">Designation (optional)</p>
            <input className="input" value={form.designation} onChange={(e) => setForm({ ...form, designation: e.target.value })} />
          </div>
          <div className="flex justify-end gap-3 hairline pt-4">
            <button onClick={onClose} className="text-ink-secondary hover:text-ink-primary underline underline-offset-4 transition-colors" style={{ fontSize: '14px' }}>Cancel</button>
            <button onClick={() => onInvite(form)} className="btn btn-primary">Send invitation</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ComposeFromTeam({ onClose, teamMembers, prefillRecipient }) {
  const [toUserId, setToUserId] = useState(prefillRecipient || '');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);

  const handleSend = async () => {
    if (!toUserId) { toast.error('Please select a recipient'); return; }
    setSending(true);
    try {
      await API.post('/flazyn-mail/compose', { to_user_id: toUserId, subject, body, is_draft: false });
      toast.success('Message sent');
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to send');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(28,25,23,0.25)' }} onClick={onClose}>
      <div className="card-raised w-full max-w-lg animate-scale-in" style={{ borderRadius: '10px' }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between hairline-b pb-4 mb-4">
          <h2 className="text-ink-primary" style={{ fontSize: '22px', fontWeight: 600 }}>Send Flazyn Mail</h2>
          <button onClick={onClose} className="text-ink-tertiary hover:text-ink-primary transition-colors"><X size={18} /></button>
        </div>
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <label className="meta-label w-12 flex-shrink-0">To</label>
            <select value={toUserId} onChange={(e) => setToUserId(e.target.value)} className="input flex-1">
              <option value="">Select team member...</option>
              {teamMembers.map(m => (
                <option key={m.id} value={m.id}>{m.first_name} {m.last_name} — {m.role?.replace('_', ' ')}</option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-3">
            <label className="meta-label w-12 flex-shrink-0">Subject</label>
            <input type="text" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Subject..." className="input flex-1" />
          </div>
          <textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="Write your message..." className="input" style={{ height: '150px', resize: 'vertical' }} />
        </div>
        <div className="flex justify-end gap-3 hairline pt-4 mt-4">
          <button onClick={onClose} className="text-ink-secondary hover:text-ink-primary underline underline-offset-4 transition-colors" style={{ fontSize: '14px' }}>Cancel</button>
          <button onClick={handleSend} className="btn btn-primary" disabled={sending}>
            {sending ? <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" /> : null}
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
