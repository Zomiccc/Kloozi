import { useState, useEffect } from 'react';
import API from '../lib/api';
import { BarChart3, TrendingUp, Users, Phone, Mail, Target, Download } from 'lucide-react';
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

export default function Analytics() {
  const [tab, setTab] = useState('leads');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState({ from: '', to: '' });

  useEffect(() => { loadAnalytics(); }, [tab, dateRange]);

  const loadAnalytics = async () => {
    setLoading(true);
    try {
      const params = {};
      if (dateRange.from) params.date_from = dateRange.from;
      if (dateRange.to) params.date_to = dateRange.to;
      const res = await API.get(`/analytics/${tab}`, { params });
      setData(res.data);
    } catch { }
    finally { setLoading(false); }
  };

  const tabs = [
    { key: 'leads', label: 'Leads' }, { key: 'conversion', label: 'Conversion' },
    { key: 'pipeline', label: 'Pipeline' }, { key: 'agents', label: 'Agents' },
    { key: 'dashboard', label: 'Overview' },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <h1 className="text-2xl font-bold text-dark-900">Analytics & Reports</h1>
        <div className="flex gap-2">
          <input type="date" value={dateRange.from} onChange={(e) => setDateRange({ ...dateRange, from: e.target.value })} className="input w-auto" />
          <input type="date" value={dateRange.to} onChange={(e) => setDateRange({ ...dateRange, to: e.target.value })} className="input w-auto" />
        </div>
      </div>

      <div className="flex gap-2 border-b border-dark-100 overflow-x-auto">
        {tabs.map(t => <button key={t.key} onClick={() => setTab(t.key)} className={`px-4 py-2 text-sm font-medium whitespace-nowrap ${tab === t.key ? 'text-primary-600 border-b-2 border-primary-600' : 'text-dark-400'}`}>{t.label}</button>)}
      </div>

      {loading ? <div className="flex justify-center py-8"><div className="animate-spin w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full" /></div> :
        <div className="space-y-6">
          {tab === 'leads' && data && (
            <>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <ChartCard title="Leads by Source" data={data.bySource?.map(s => ({ name: s.lead_source, count: parseInt(s.count) })) || []} type="bar" />
                <ChartCard title="Leads by City" data={data.byCity?.map(c => ({ name: c.city, count: parseInt(c.count) })) || []} type="bar" />
                <ChartCard title="Lead Trend" data={data.trend?.map(t => ({ name: new Date(t.date).toLocaleDateString('en', { month: 'short', day: 'numeric' }), count: parseInt(t.count) })) || []} type="line" />
                <ChartCard title="Leads by Budget Range" data={data.byBudget?.map(b => ({ name: b.range, count: parseInt(b.count) })) || []} type="bar" />
              </div>
            </>
          )}
          {tab === 'conversion' && data && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <ChartCard title="Conversion by Source" data={data.bySource?.map(s => ({ name: s.lead_source, rate: parseFloat(s.conversion_rate) })) || []} type="bar" />
              <ChartCard title="Conversion by Agent" data={data.byAgent?.map(a => ({ name: `${a.first_name} ${a.last_name}`, rate: parseFloat(a.conversion_rate) })) || []} type="bar" />
              <div className="card"><h3 className="font-semibold mb-2">Average Time to Close</h3><p className="text-3xl font-bold text-primary-600">{data.avgTimeToClose} days</p></div>
            </div>
          )}
          {tab === 'pipeline' && data && (
            <div className="card">
              <h3 className="font-semibold mb-4">Pipeline Stages</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                {data.stages?.map(s => <div key={s.name} className="rounded-lg border p-4 text-center" style={{ borderColor: s.color }}><p className="text-2xl font-bold">{parseInt(s.count)}</p><p className="text-sm" style={{ color: s.color }}>{s.name}</p></div>)}
              </div>
              <div className="mt-4 grid grid-cols-2 gap-4"><div className="bg-blue-50 p-4 rounded-lg"><p className="text-sm text-dark-400">Moved This Week</p><p className="text-2xl font-bold text-blue-600">{data.movedThisWeek}</p></div><div className="bg-red-50 p-4 rounded-lg"><p className="text-sm text-dark-400">Stuck Leads (7+ days)</p><p className="text-2xl font-bold text-red-600">{data.stuckLeads}</p></div></div>
            </div>
          )}
          {tab === 'agents' && data && (
            <div className="bg-white rounded-xl border border-dark-100 overflow-hidden">
              <table className="w-full">
                <thead className="bg-dark-50"><tr><th className="p-3 text-left text-xs uppercase text-dark-500">Agent</th><th className="p-3 text-left text-xs uppercase text-dark-500">Calls</th><th className="p-3 text-left text-xs uppercase text-dark-500">Emails</th><th className="p-3 text-left text-xs uppercase text-dark-500">WhatsApp</th><th className="p-3 text-left text-xs uppercase text-dark-500">SMS</th><th className="p-3 text-left text-xs uppercase text-dark-500">Won</th><th className="p-3 text-left text-xs uppercase text-dark-500">Lost</th><th className="p-3 text-left text-xs uppercase text-dark-500">Total Leads</th></tr></thead>
                <tbody className="divide-y divide-dark-50">
                  {data.agents?.map(a => <tr key={a.id} className="hover:bg-dark-50"><td className="p-3 font-medium">{a.first_name} {a.last_name}</td><td className="p-3">{parseInt(a.calls)}</td><td className="p-3">{parseInt(a.emails)}</td><td className="p-3">{parseInt(a.whatsapp)}</td><td className="p-3">{parseInt(a.sms)}</td><td className="p-3 text-green-600">{parseInt(a.won)}</td><td className="p-3 text-red-600">{parseInt(a.lost)}</td><td className="p-3">{parseInt(a.total_leads)}</td></tr>)}
                </tbody>
              </table>
            </div>
          )}
          {tab === 'dashboard' && data && (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              <StatBox label="Total Leads" value={data.leadStats?.totalLeads} icon={Users} color="blue" />
              <StatBox label="Conversion Rate" value={`${data.conversionRate}%`} icon={Target} color="green" />
              <StatBox label="Calls Today" value={data.callsToday} icon={Phone} color="purple" />
              <StatBox label="Emails Today" value={data.emailsToday} icon={Mail} color="orange" />
              <StatBox label="Won" value={data.leadStats?.won} icon={TrendingUp} color="green" />
              <StatBox label="Stuck Leads" value={data.stuckLeads} icon={BarChart3} color="red" />
            </div>
          )}
        </div>
      }
    </div>
  );
}

function ChartCard({ title, data, type }) {
  return (
    <div className="card">
      <h3 className="font-semibold text-dark-900 mb-4">{title}</h3>
      <ResponsiveContainer width="100%" height={250}>
        {type === 'line' ? (
          <LineChart data={data}><CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" /><XAxis dataKey="name" tick={{ fontSize: 12 }} /><YAxis tick={{ fontSize: 12 }} /><Tooltip /><Line type="monotone" dataKey="count" stroke="#3b82f6" strokeWidth={2} /></LineChart>
        ) : (
          <BarChart data={data}><CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" /><XAxis dataKey="name" tick={{ fontSize: 12 }} /><YAxis tick={{ fontSize: 12 }} /><Tooltip /><Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} /></BarChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}

function StatBox({ label, value, icon: Icon, color }) {
  const colors = { blue: 'bg-blue-50 text-blue-600', green: 'bg-green-50 text-green-600', purple: 'bg-purple-50 text-purple-600', orange: 'bg-orange-50 text-orange-600', red: 'bg-red-50 text-red-600' };
  return <div className="card flex items-center gap-4"><div className={`w-12 h-12 rounded-xl flex items-center justify-center ${colors[color]}`}><Icon size={24} /></div><div><p className="text-2xl font-bold">{value}</p><p className="text-sm text-dark-400">{label}</p></div></div>;
}
