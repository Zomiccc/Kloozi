import { useState, useEffect } from 'react';
import API from '../lib/api';
import toast from 'react-hot-toast';
import { Plus, X, UserPlus, Ban, RefreshCw, ArrowRightLeft, MapPin, Activity } from 'lucide-react';

export default function TeamManagement() {
  const [members, setMembers] = useState([]);
  const [activity, setActivity] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showInvite, setShowInvite] = useState(false);
  const [tab, setTab] = useState('members');

  useEffect(() => { loadMembers(); loadActivity(); }, []);

  const loadMembers = async () => {
    try { const res = await API.get('/team'); setMembers(res.data.members); }
    catch { toast.error('Failed to load team'); }
    finally { setLoading(false); }
  };

  const loadActivity = async () => {
    try { const res = await API.get('/team/activity-feed'); setActivity(res.data.activities); }
    catch {}
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
        <h1 className="text-2xl font-bold text-dark-900">Team Management</h1>
        <button onClick={() => setShowInvite(true)} className="btn btn-primary flex items-center gap-2"><UserPlus size={16} /> Invite Member</button>
      </div>

      <div className="flex gap-2 border-b border-dark-100">
        <button onClick={() => setTab('members')} className={`px-4 py-2 text-sm font-medium ${tab === 'members' ? 'text-primary-600 border-b-2 border-primary-600' : 'text-dark-400'}`}>Members</button>
        <button onClick={() => setTab('activity')} className={`px-4 py-2 text-sm font-medium ${tab === 'activity' ? 'text-primary-600 border-b-2 border-primary-600' : 'text-dark-400'}`}>Activity Feed</button>
      </div>

      {tab === 'members' ? (
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
      ) : (
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
