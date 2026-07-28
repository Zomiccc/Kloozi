import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import API from '../lib/api';
import toast from 'react-hot-toast';
import { Plus, X, UserPlus, Ban, RefreshCw, ArrowRightLeft, MapPin, Activity, BarChart3, Users2, GitBranch, Settings, TrendingUp, Phone, Mail, MessageSquare, CheckCircle2, Clock } from 'lucide-react';

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

  useEffect(() => { loadMembers(); loadActivity(); loadSubteams(); loadAssignmentRules(); loadStats(); }, []);

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

  const roleColors = { super_admin: { bg: '#AF52DE10', color: '#AF52DE' }, admin: { bg: '#0066FF10', color: '#0066FF' }, sales_manager: { bg: '#FF950010', color: '#FF9500' }, sales_agent: { bg: '#34C75910', color: '#34C759' } };

  const sortedMembers = [...members].filter(m => m.status === 'active').sort((a, b) => (b.lead_count || 0) - (a.lead_count || 0));
  const podium = sortedMembers.slice(0, 3);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <h1 className="text-3xl font-extrabold text-ink-primary tracking-tight">Team</h1>
        <button onClick={() => setShowInvite(true)} className="btn btn-primary"><UserPlus size={16} /> Invite Member</button>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 bg-white border border-surface-border rounded-full p-1 flex-wrap">
        {[
          { key: 'dashboard', label: 'Dashboard', icon: BarChart3 },
          { key: 'members', label: 'Members', icon: Users2 },
          { key: 'subteams', label: 'Subteams', icon: GitBranch },
          { key: 'assignment', label: 'Lead Assignment', icon: ArrowRightLeft },
        ].map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} className={`tab-pill ${tab === t.key ? 'tab-pill-active bg-accent-red' : 'text-ink-secondary hover:text-ink-primary'}`}>
            <t.icon size={16} /> {t.label}
          </button>
        ))}
      </div>

      {/* Dashboard tab */}
      {tab === 'dashboard' && (
        <div className="space-y-6">
          {/* Podium Leaderboard */}
          {podium.length > 0 && (
            <div className="grid grid-cols-3 gap-4 stagger-in">
              {podium.map((m, idx) => {
                const heights = ['h-28', 'h-36', 'h-24'];
                const colors = ['#FF9500', '#8E8E93', '#FF950080'];
                const positions = ['2nd', '1st', '3rd'];
                const actualIdx = idx === 0 ? 1 : idx === 1 ? 0 : 2;
                const m2 = podium[actualIdx];
                const h2 = heights[actualIdx];
                const c2 = colors[actualIdx];
                const p2 = positions[actualIdx];
                return (
                  <div key={m2.id} className="flex flex-col items-center">
                    <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-white text-lg font-extrabold mb-2 shadow-card" style={{ background: 'linear-gradient(135deg, #0066FF, #AF52DE)' }}>
                      {m2.first_name?.[0] || '?'}
                    </div>
                    <p className="text-sm font-bold text-ink-primary">{m2.first_name} {m2.last_name}</p>
                    <p className="text-xs text-ink-tertiary mb-2">{m2.lead_count || 0} leads</p>
                    <div className={`${h2} w-full rounded-t-2xl flex items-center justify-center text-white font-extrabold text-lg`} style={{ background: c2 }}>
                      {p2}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Stats cards */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {[
              { label: 'Total Leads', value: stats.totalLeads, icon: Users2, color: '#0066FF' },
              { label: 'New Leads', value: stats.newLeads, icon: TrendingUp, color: '#34C759' },
              { label: 'Won', value: stats.wonLeads, icon: CheckCircle2, color: '#AF52DE' },
              { label: 'Calls', value: stats.totalCalls, icon: Phone, color: '#FF9500' },
              { label: 'Messages', value: stats.totalMessages, icon: MessageSquare, color: '#0066FF' },
              { label: 'Active Agents', value: stats.activeAgents || members.filter(m => m.status === 'active').length, icon: Activity, color: '#FF3B5C' },
            ].map(s => (
              <div key={s.label} className="card card-hover stagger-in">
                <div className="w-10 h-10 rounded-2xl flex items-center justify-center mb-3" style={{ background: `${s.color}15` }}>
                  <s.icon size={20} style={{ color: s.color }} />
                </div>
                <p className="text-2xl font-extrabold text-ink-primary">{s.value}</p>
                <p className="text-xs font-semibold text-ink-secondary">{s.label}</p>
              </div>
            ))}
          </div>

          {/* Team performance table */}
          <div className="card overflow-hidden" style={{ padding: 0 }}>
            <div className="p-4 border-b border-surface-border"><h3 className="font-bold text-ink-primary">Team Performance</h3></div>
            <table className="w-full">
              <thead className="bg-surface-page border-b border-surface-border">
                <tr>
                  <th className="p-3 text-left text-xs font-bold text-ink-tertiary uppercase">Agent</th>
                  <th className="p-3 text-left text-xs font-bold text-ink-tertiary uppercase">Leads</th>
                  <th className="p-3 text-left text-xs font-bold text-ink-tertiary uppercase">Won</th>
                  <th className="p-3 text-left text-xs font-bold text-ink-tertiary uppercase">Calls Today</th>
                  <th className="p-3 text-left text-xs font-bold text-ink-tertiary uppercase">Messages</th>
                  <th className="p-3 text-left text-xs font-bold text-ink-tertiary uppercase">Win Rate</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-border">
                {members.filter(m => m.status === 'active').map(m => (
                  <tr key={m.id} className="hover:bg-surface-page transition-colors">
                    <td className="p-3"><div className="flex items-center gap-2"><div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white" style={{ background: 'linear-gradient(135deg, #0066FF, #AF52DE)' }}>{m.first_name?.[0] || '?'}</div><div><p className="text-sm font-bold text-ink-primary">{m.first_name} {m.last_name}</p><p className="text-xs text-ink-tertiary">{m.designation || m.role?.replace('_', ' ')}</p></div></div></td>
                    <td className="p-3 text-sm font-semibold text-ink-primary">{m.lead_count || 0}</td>
                    <td className="p-3 text-sm font-semibold text-ink-primary">{m.won_count || 0}</td>
                    <td className="p-3 text-sm font-semibold text-ink-primary">{m.calls_today || 0}</td>
                    <td className="p-3 text-sm font-semibold text-ink-primary">{m.messages_today || 0}</td>
                    <td className="p-3 text-sm font-bold text-ink-primary">{m.lead_count > 0 ? Math.round(((m.won_count || 0) / m.lead_count) * 100) : 0}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Activity feed */}
          <div className="card stagger-in">
            <h3 className="text-lg font-bold text-ink-primary mb-4 flex items-center gap-2"><Activity size={18} /> Team Activity (Last 24h)</h3>
            {activity.length === 0 ? <p className="text-ink-tertiary text-sm">No recent activity</p> :
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {activity.map((a, idx) => (
                  <div key={a.id || `activity-${idx}`} className="flex items-center gap-3 py-2 border-b border-surface-border last:border-0">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white" style={{ background: 'linear-gradient(135deg, #0066FF, #AF52DE)' }}>{a.first_name?.[0] || '?'}</div>
                    <div className="flex-1"><p className="text-sm text-ink-secondary"><strong className="text-ink-primary">{a.first_name} {a.last_name}</strong> — {a.description}</p><p className="text-xs text-ink-tertiary">{new Date(a.created_at).toLocaleString()}</p></div>
                  </div>
                ))}
              </div>
            }
          </div>
        </div>
      )}

      {/* Members tab */}
      {tab === 'members' && (
        loading ? <div className="flex justify-center py-8"><div className="animate-spin w-8 h-8 border-4 border-accent-blue border-t-transparent rounded-full" /></div> :
        <div className="card overflow-hidden" style={{ padding: 0 }}>
          <table className="w-full">
            <thead className="bg-surface-page border-b border-surface-border">
              <tr>
                <th className="p-3 text-left text-xs font-bold text-ink-tertiary uppercase">Name</th>
                <th className="p-3 text-left text-xs font-bold text-ink-tertiary uppercase">Role</th>
                <th className="p-3 text-left text-xs font-bold text-ink-tertiary uppercase">Leads</th>
                <th className="p-3 text-left text-xs font-bold text-ink-tertiary uppercase">Won</th>
                <th className="p-3 text-left text-xs font-bold text-ink-tertiary uppercase">Calls Today</th>
                <th className="p-3 text-left text-xs font-bold text-ink-tertiary uppercase">Status</th>
                <th className="p-3 text-left text-xs font-bold text-ink-tertiary uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-border">
              {members.map(m => {
                const rc = roleColors[m.role] || roleColors.sales_agent;
                return (
                  <tr key={m.id} className="hover:bg-surface-page transition-colors">
                    <td className="p-3"><div className="font-bold text-ink-primary">{m.first_name} {m.last_name}</div><div className="text-xs text-ink-tertiary">{m.email}</div></td>
                    <td className="p-3"><span className="badge capitalize" style={{ background: rc.bg, color: rc.color }}>{(m.role || 'sales_agent').replace('_', ' ')}</span></td>
                    <td className="p-3 text-sm font-semibold text-ink-primary">{m.lead_count}</td>
                    <td className="p-3 text-sm font-semibold text-ink-primary">{m.won_count}</td>
                    <td className="p-3 text-sm font-semibold text-ink-primary">{m.calls_today}</td>
                    <td className="p-3"><span className="badge capitalize" style={{ background: m.status === 'active' ? '#34C75910' : m.status === 'suspended' ? '#FF3B5C10' : '#FF950010', color: m.status === 'active' ? '#34C759' : m.status === 'suspended' ? '#FF3B5C' : '#FF9500' }}>{m.status}</span></td>
                    <td className="p-3">
                      {m.status === 'active' ? <button onClick={() => handleSuspend(m.id)} className="p-1.5 rounded-lg hover:bg-red-50 transition-colors" style={{ color: '#FF3B5C' }}><Ban size={16} /></button> :
                      <button onClick={() => handleReactivate(m.id)} className="p-1.5 rounded-lg hover:bg-green-50 transition-colors" style={{ color: '#34C759' }}><RefreshCw size={16} /></button>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Subteams tab */}
      {tab === 'subteams' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <p className="text-sm font-semibold text-ink-secondary">Create subteams to organize your agents and distribute leads efficiently.</p>
            <button onClick={() => toast.success('Create subteam modal')} className="btn btn-primary"><Plus size={16} /> Create Subteam</button>
          </div>
          {subteams.length === 0 ? (
            <div className="card text-center" style={{ padding: '48px 24px' }}>
              <div className="w-16 h-16 rounded-3xl bg-surface-page flex items-center justify-center mx-auto mb-4"><GitBranch size={32} className="text-ink-tertiary" /></div>
              <p className="text-ink-tertiary">No subteams yet</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {subteams.map(st => (
                <div key={st.id} className="card card-hover stagger-in">
                  <h3 className="font-bold text-ink-primary">{st.name}</h3>
                  <div className="grid grid-cols-2 gap-2 mt-3 text-sm">
                    <div><p className="text-ink-tertiary text-xs">Members</p><p className="font-bold text-ink-primary">{st.member_count || 0}</p></div>
                    <div><p className="text-ink-tertiary text-xs">Leads</p><p className="font-bold text-ink-primary">{st.lead_count || 0}</p></div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Lead Assignment tab */}
      {tab === 'assignment' && (
        <div className="space-y-4">
          <div className="rounded-2xl p-4 border border-surface-border bg-surface-page">
            <p className="text-sm font-semibold text-ink-secondary">Configure how new leads are assigned to your team members. Rules are processed in order of priority.</p>
          </div>
          {assignmentRules.length === 0 ? (
            <div className="card text-center" style={{ padding: '48px 24px' }}>
              <div className="w-16 h-16 rounded-3xl bg-surface-page flex items-center justify-center mx-auto mb-4"><ArrowRightLeft size={32} className="text-ink-tertiary" /></div>
              <p className="text-ink-tertiary">No assignment rules yet</p>
              <p className="text-sm text-ink-secondary mt-1">Leads will be assigned round-robin by default</p>
            </div>
          ) : (
            <div className="space-y-3">
              {assignmentRules.map(r => (
                <div key={r.id} className="card card-hover stagger-in flex items-center justify-between">
                  <div><p className="font-bold text-ink-primary">{r.name}</p><p className="text-xs text-ink-tertiary mt-1">{r.conditions} → {r.action}</p></div>
                  <span className="badge" style={{ background: r.is_active ? '#34C75910' : '#8E8E9310', color: r.is_active ? '#34C759' : '#8E8E93' }}>{r.is_active ? 'Active' : 'Inactive'}</span>
                </div>
              ))}
            </div>
          )}
          <button onClick={() => navigate('/app/automations/rules')} className="btn btn-primary">Configure Automation Rules</button>
        </div>
      )}

      {showInvite && <InviteModal onClose={() => setShowInvite(false)} onInvite={handleInvite} />}
    </div>
  );
}

function InviteModal({ onClose, onInvite }) {
  const [form, setForm] = useState({ email: '', role: 'sales_agent', first_name: '', last_name: '', designation: '' });
  return (
    <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white border border-surface-border rounded-3xl p-6 w-full max-w-md shadow-modal animate-slide-up">
        <div className="flex items-center justify-between mb-6"><h2 className="text-xl font-bold text-ink-primary">Invite Team Member</h2><button onClick={onClose} className="text-ink-tertiary hover:text-ink-primary transition-colors"><X size={20} /></button></div>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <input className="input" placeholder="First name" value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} />
            <input className="input" placeholder="Last name" value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} />
          </div>
          <input className="input" placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <select className="input" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
            <option value="sales_agent">Sales Agent</option><option value="sales_manager">Sales Manager</option><option value="admin">Admin</option>
          </select>
          <input className="input" placeholder="Designation (optional)" value={form.designation} onChange={(e) => setForm({ ...form, designation: e.target.value })} />
          <button onClick={() => onInvite(form)} className="btn btn-primary w-full">Send Invitation</button>
        </div>
      </div>
    </div>
  );
}
