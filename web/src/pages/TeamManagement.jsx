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

  const roleColors = { super_admin: 'bg-purple-100 text-purple-700', admin: 'bg-blue-100 text-blue-700', sales_manager: 'bg-amber-100 text-amber-700', sales_agent: 'bg-green-100 text-green-700' };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-dark-900">Team</h1>
        <button onClick={() => setShowInvite(true)} className="btn btn-primary flex items-center gap-2"><UserPlus size={16} /> Invite Member</button>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 border-b border-dark-100">
        {[
          { key: 'dashboard', label: 'Dashboard', icon: BarChart3 },
          { key: 'members', label: 'Members', icon: Users2 },
          { key: 'subteams', label: 'Subteams', icon: GitBranch },
          { key: 'assignment', label: 'Lead Assignment', icon: ArrowRightLeft },
        ].map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} className={`px-4 py-2.5 text-sm font-medium flex items-center gap-2 ${tab === t.key ? 'text-primary-600 border-b-2 border-primary-600' : 'text-dark-400 hover:text-dark-600'}`}>
            <t.icon size={16} /> {t.label}
          </button>
        ))}
      </div>

      {/* Dashboard tab */}
      {tab === 'dashboard' && (
        <div className="space-y-6">
          {/* Stats cards */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {[
              { label: 'Total Leads', value: stats.totalLeads, icon: Users2, color: 'text-blue-600 bg-blue-50' },
              { label: 'New Leads', value: stats.newLeads, icon: TrendingUp, color: 'text-green-600 bg-green-50' },
              { label: 'Won', value: stats.wonLeads, icon: CheckCircle2, color: 'text-purple-600 bg-purple-50' },
              { label: 'Calls', value: stats.totalCalls, icon: Phone, color: 'text-orange-600 bg-orange-50' },
              { label: 'Messages', value: stats.totalMessages, icon: MessageSquare, color: 'text-teal-600 bg-teal-50' },
              { label: 'Active Agents', value: stats.activeAgents || members.filter(m => m.status === 'active').length, icon: Activity, color: 'text-indigo-600 bg-indigo-50' },
            ].map(s => (
              <div key={s.label} className="card">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center mb-2 ${s.color}`}><s.icon size={20} /></div>
                <p className="text-2xl font-bold text-dark-900">{s.value}</p>
                <p className="text-xs text-dark-400">{s.label}</p>
              </div>
            ))}
          </div>

          {/* Team performance table */}
          <div className="bg-white rounded-xl border border-dark-100 overflow-hidden">
            <div className="p-4 border-b border-dark-100"><h3 className="font-semibold text-dark-900">Team Performance</h3></div>
            <table className="w-full">
              <thead className="bg-dark-50 border-b border-dark-100">
                <tr>
                  <th className="p-3 text-left text-xs font-medium text-dark-500 uppercase">Agent</th>
                  <th className="p-3 text-left text-xs font-medium text-dark-500 uppercase">Leads</th>
                  <th className="p-3 text-left text-xs font-medium text-dark-500 uppercase">Won</th>
                  <th className="p-3 text-left text-xs font-medium text-dark-500 uppercase">Calls Today</th>
                  <th className="p-3 text-left text-xs font-medium text-dark-500 uppercase">Messages</th>
                  <th className="p-3 text-left text-xs font-medium text-dark-500 uppercase">Win Rate</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-dark-50">
                {members.filter(m => m.status === 'active').map(m => (
                  <tr key={m.id} className="hover:bg-dark-50">
                    <td className="p-3"><div className="flex items-center gap-2"><div className="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center text-xs font-medium text-primary-700">{m.first_name?.[0] || '?'}</div><div><p className="text-sm font-medium">{m.first_name} {m.last_name}</p><p className="text-xs text-dark-400">{m.designation || m.role?.replace('_', ' ')}</p></div></div></td>
                    <td className="p-3 text-sm">{m.lead_count || 0}</td>
                    <td className="p-3 text-sm">{m.won_count || 0}</td>
                    <td className="p-3 text-sm">{m.calls_today || 0}</td>
                    <td className="p-3 text-sm">{m.messages_today || 0}</td>
                    <td className="p-3 text-sm">{m.lead_count > 0 ? Math.round(((m.won_count || 0) / m.lead_count) * 100) : 0}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Activity feed */}
          <div className="card">
            <h3 className="font-semibold mb-4 flex items-center gap-2"><Activity size={18} /> Team Activity (Last 24h)</h3>
            {activity.length === 0 ? <p className="text-dark-400 text-sm">No recent activity</p> :
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {activity.map(a => (
                  <div key={a.id} className="flex items-center gap-3 py-2 border-b border-dark-50 last:border-0">
                    <div className="w-8 h-8 bg-primary-50 rounded-full flex items-center justify-center text-xs font-medium text-primary-700">{a.first_name?.[0] || '?'}</div>
                    <div className="flex-1"><p className="text-sm text-dark-900"><strong>{a.first_name} {a.last_name}</strong> — {a.description}</p><p className="text-xs text-dark-400">{new Date(a.created_at).toLocaleString()}</p></div>
                  </div>
                ))}
              </div>
            }
          </div>
        </div>
      )}

      {/* Members tab */}
      {tab === 'members' && (
        loading ? <div className="flex justify-center py-8"><div className="animate-spin w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full" /></div> :
        <div className="bg-white rounded-xl border border-dark-100 overflow-hidden">
          <table className="w-full">
            <thead className="bg-dark-50 border-b border-dark-100">
              <tr>
                <th className="p-3 text-left text-xs font-medium text-dark-500 uppercase">Name</th>
                <th className="p-3 text-left text-xs font-medium text-dark-500 uppercase">Role</th>
                <th className="p-3 text-left text-xs font-medium text-dark-500 uppercase">Leads</th>
                <th className="p-3 text-left text-xs font-medium text-dark-500 uppercase">Won</th>
                <th className="p-3 text-left text-xs font-medium text-dark-500 uppercase">Calls Today</th>
                <th className="p-3 text-left text-xs font-medium text-dark-500 uppercase">Status</th>
                <th className="p-3 text-left text-xs font-medium text-dark-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-dark-50">
              {members.map(m => (
                <tr key={m.id} className="hover:bg-dark-50">
                  <td className="p-3"><div className="font-medium text-dark-900">{m.first_name} {m.last_name}</div><div className="text-xs text-dark-400">{m.email}</div></td>
                  <td className="p-3"><span className={`badge ${roleColors[m.role]}`}>{m.role.replace('_', ' ')}</span></td>
                  <td className="p-3 text-sm">{m.lead_count}</td>
                  <td className="p-3 text-sm">{m.won_count}</td>
                  <td className="p-3 text-sm">{m.calls_today}</td>
                  <td className="p-3"><span className={`badge ${m.status === 'active' ? 'bg-green-100 text-green-700' : m.status === 'suspended' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>{m.status}</span></td>
                  <td className="p-3">
                    {m.status === 'active' ? <button onClick={() => handleSuspend(m.id)} className="text-red-500 hover:text-red-600"><Ban size={16} /></button> :
                    <button onClick={() => handleReactivate(m.id)} className="text-green-500 hover:text-green-600"><RefreshCw size={16} /></button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Subteams tab */}
      {tab === 'subteams' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-dark-400">Create subteams to organize your agents and distribute leads efficiently.</p>
            <button onClick={() => toast.success('Create subteam modal')} className="btn btn-primary flex items-center gap-2 text-sm"><Plus size={16} /> Create Subteam</button>
          </div>
          {subteams.length === 0 ? (
            <div className="card text-center py-12"><GitBranch size={48} className="text-dark-300 mx-auto mb-3" /><p className="text-dark-400">No subteams yet</p></div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {subteams.map(st => (
                <div key={st.id} className="card">
                  <h3 className="font-semibold text-dark-900">{st.name}</h3>
                  <div className="grid grid-cols-2 gap-2 mt-3 text-sm">
                    <div><p className="text-dark-400 text-xs">Members</p><p className="font-medium">{st.member_count || 0}</p></div>
                    <div><p className="text-dark-400 text-xs">Leads</p><p className="font-medium">{st.lead_count || 0}</p></div>
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
          <div className="bg-blue-50 rounded-lg p-4">
            <p className="text-sm text-blue-800">Configure how new leads are assigned to your team members. Rules are processed in order of priority.</p>
          </div>
          {assignmentRules.length === 0 ? (
            <div className="card text-center py-12"><ArrowRightLeft size={48} className="text-dark-300 mx-auto mb-3" /><p className="text-dark-400">No assignment rules yet</p><p className="text-sm text-dark-400 mt-1">Leads will be assigned round-robin by default</p></div>
          ) : (
            <div className="space-y-3">
              {assignmentRules.map(r => (
                <div key={r.id} className="card flex items-center justify-between">
                  <div><p className="font-medium text-dark-900">{r.name}</p><p className="text-xs text-dark-400 mt-1">{r.conditions} → {r.action}</p></div>
                  <span className={`badge ${r.is_active ? 'bg-green-100 text-green-700' : 'bg-dark-100 text-dark-600'}`}>{r.is_active ? 'Active' : 'Inactive'}</span>
                </div>
              ))}
            </div>
          )}
          <button onClick={() => navigate('/automations/rules')} className="btn btn-primary">Configure Automation Rules</button>
        </div>
      )}

      {showInvite && <InviteModal onClose={() => setShowInvite(false)} onInvite={handleInvite} />}
    </div>
  );
}

function InviteModal({ onClose, onInvite }) {
  const [form, setForm] = useState({ email: '', role: 'sales_agent', first_name: '', last_name: '', designation: '' });
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl p-6 w-full max-w-md">
        <div className="flex items-center justify-between mb-4"><h2 className="text-xl font-bold">Invite Team Member</h2><button onClick={onClose}><X size={20} /></button></div>
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
