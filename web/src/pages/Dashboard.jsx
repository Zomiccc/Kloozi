import { useState, useEffect } from 'react';
import API from '../lib/api';
import {
  Users, Phone, Mail, CheckCircle, TrendingUp, ArrowUpRight, ArrowDownRight,
  Clock, Target, Award, AlertCircle
} from 'lucide-react';
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboard();
  }, []);

  const loadDashboard = async () => {
    try {
      const res = await API.get('/analytics/dashboard');
      setData(res.data);
    } catch (err) {
      console.error('Dashboard error:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full" /></div>;

  const stats = data?.leadStats || {};
  const trendData = (data?.leadTrend || []).map(t => ({ date: new Date(t.date).toLocaleDateString('en', { month: 'short', day: 'numeric' }), leads: parseInt(t.count) }));
  const sourceData = (data?.leadsBySource || []).map(s => ({ name: s.lead_source, value: parseInt(s.count) }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-dark-900">Dashboard</h1>
        <div className="text-sm text-dark-400">{new Date().toLocaleDateString('en', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Users} label="Total Leads" value={stats.totalLeads || 0} sub={`${stats.leadsToday || 0} today`} color="blue" />
        <StatCard icon={Phone} label="Calls Today" value={data?.callsToday || 0} color="green" />
        <StatCard icon={Mail} label="Emails Today" value={data?.emailsToday || 0} color="purple" />
        <StatCard icon={CheckCircle} label="Follow-ups Today" value={`${data?.followUpsToday?.completed || 0}/${data?.followUpsToday?.total || 0}`} color="orange" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Award} label="Won" value={stats.won || 0} color="green" />
        <StatCard icon={Target} label="Conversion Rate" value={`${data?.conversionRate || 0}%`} color="blue" />
        <StatCard icon={AlertCircle} label="Stuck Leads" value={data?.stuckLeads || 0} color="red" />
        <StatCard icon={TrendingUp} label="New Today vs Yesterday" value={`${stats.leadsToday || 0} / ${stats.leadsYesterday || 0}`} color="purple" />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <h3 className="font-semibold text-dark-900 mb-4">Lead Volume (30 days)</h3>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={trendData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="date" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Line type="monotone" dataKey="leads" stroke="#3b82f6" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="card">
          <h3 className="font-semibold text-dark-900 mb-4">Leads by Source</h3>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie data={sourceData} cx="50%" cy="50%" outerRadius={80} dataKey="value" label={({ name, value }) => `${name}: ${value}`}>
                {sourceData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Pipeline overview */}
      <div className="card">
        <h3 className="font-semibold text-dark-900 mb-4">Pipeline Overview</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <PipelineBox label="New" count={stats.newLeads || 0} color="bg-blue-50 text-blue-700 border-blue-200" />
          <PipelineBox label="Contacted" count={stats.contacted || 0} color="bg-purple-50 text-purple-700 border-purple-200" />
          <PipelineBox label="Interested" count={stats.interested || 0} color="bg-amber-50 text-amber-700 border-amber-200" />
          <PipelineBox label="Negotiating" count={stats.negotiating || 0} color="bg-orange-50 text-orange-700 border-orange-200" />
          <PipelineBox label="Won" count={stats.won || 0} color="bg-green-50 text-green-700 border-green-200" />
          <PipelineBox label="Lost" count={stats.lost || 0} color="bg-red-50 text-red-700 border-red-200" />
        </div>
      </div>

      {/* Leads by agent */}
      {data?.leadsByAgent && data.leadsByAgent.length > 0 && (
        <div className="card">
          <h3 className="font-semibold text-dark-900 mb-4">Leads by Agent</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={data.leadsByAgent.map(a => ({ name: `${a.first_name} ${a.last_name}`, leads: parseInt(a.lead_count), won: parseInt(a.won_count) }))}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Bar dataKey="leads" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              <Bar dataKey="won" fill="#10b981" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

function StatCard({ icon: Icon, label, value, sub, color }) {
  const colors = { blue: 'bg-blue-50 text-blue-600', green: 'bg-green-50 text-green-600', purple: 'bg-purple-50 text-purple-600', orange: 'bg-orange-50 text-orange-600', red: 'bg-red-50 text-red-600' };
  return (
    <div className="card flex items-center gap-4">
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${colors[color] || colors.blue}`}>
        <Icon size={24} />
      </div>
      <div>
        <p className="text-2xl font-bold text-dark-900">{value}</p>
        <p className="text-sm text-dark-400">{label}</p>
        {sub && <p className="text-xs text-dark-300 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

function PipelineBox({ label, count, color }) {
  return (
    <div className={`rounded-lg border p-4 text-center ${color}`}>
      <p className="text-2xl font-bold">{count}</p>
      <p className="text-sm mt-1">{label}</p>
    </div>
  );
}
