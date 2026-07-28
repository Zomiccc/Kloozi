import { useState, useEffect } from 'react';
import API from '../lib/api';
import { BarChart3, TrendingUp, Users, Phone, Mail, Target, Download } from 'lucide-react';
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const COLORS = ['#0066FF', '#34C759', '#FF9500', '#FF3B5C', '#AF52DE', '#FF9500'];

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
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <h1 className="text-3xl font-extrabold text-ink-primary tracking-tight">Analytics & Reports</h1>
        <div className="flex gap-2">
          <input type="date" value={dateRange.from} onChange={(e) => setDateRange({ ...dateRange, from: e.target.value })} className="input w-auto" />
          <input type="date" value={dateRange.to} onChange={(e) => setDateRange({ ...dateRange, to: e.target.value })} className="input w-auto" />
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 bg-white border border-surface-border rounded-full p-1 flex-wrap">
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} className={`tab-pill ${tab === t.key ? 'tab-pill-active bg-accent-red' : 'text-ink-secondary hover:text-ink-primary'}`}>{t.label}</button>
        ))}
      </div>

      {loading ? <div className="flex justify-center py-8"><div className="animate-spin w-8 h-8 border-4 border-accent-blue border-t-transparent rounded-full" /></div> :
        <div className="space-y-6">
          {tab === 'leads' && data && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <ChartCard title="Leads by Source" data={data.bySource?.map(s => ({ name: s.lead_source, count: parseInt(s.count) })) || []} type="bar" />
              <ChartCard title="Leads by City" data={data.byCity?.map(c => ({ name: c.city, count: parseInt(c.count) })) || []} type="bar" />
              <ChartCard title="Lead Trend" data={data.trend?.map(t => ({ name: new Date(t.date).toLocaleDateString('en', { month: 'short', day: 'numeric' }), count: parseInt(t.count) })) || []} type="line" />
              <ChartCard title="Leads by Budget Range" data={data.byBudget?.map(b => ({ name: b.range, count: parseInt(b.count) })) || []} type="bar" />
            </div>
          )}
          {tab === 'conversion' && data && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <ChartCard title="Conversion by Source" data={data.bySource?.map(s => ({ name: s.lead_source, count: parseFloat(s.conversion_rate) })) || []} type="bar" />
              <ChartCard title="Conversion by Agent" data={data.byAgent?.map(a => ({ name: `${a.first_name} ${a.last_name}`, count: parseFloat(a.conversion_rate) })) || []} type="bar" />
              <div className="card stagger-in">
                <h3 className="text-lg font-bold text-ink-primary mb-2">Average Time to Close</h3>
                <p className="text-4xl font-extrabold" style={{ color: '#0066FF' }}>{data.avgTimeToClose} days</p>
              </div>
            </div>
          )}
          {tab === 'pipeline' && data && (
            <div className="card stagger-in">
              <h3 className="text-lg font-bold text-ink-primary mb-4">Pipeline Stages</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                {data.stages?.map(s => (
                  <div key={s.name} className="rounded-2xl border p-4 text-center" style={{ borderColor: `${s.color}40`, background: `${s.color}08` }}>
                    <p className="text-2xl font-extrabold text-ink-primary">{parseInt(s.count)}</p>
                    <p className="text-sm font-semibold" style={{ color: s.color }}>{s.name}</p>
                  </div>
                ))}
              </div>
              <div className="mt-4 grid grid-cols-2 gap-4">
                <div className="rounded-2xl p-4 border border-surface-border bg-surface-page">
                  <p className="text-sm font-semibold text-ink-secondary">Moved This Week</p>
                  <p className="text-2xl font-extrabold" style={{ color: '#0066FF' }}>{data.movedThisWeek}</p>
                </div>
                <div className="rounded-2xl p-4 border border-surface-border bg-surface-page">
                  <p className="text-sm font-semibold text-ink-secondary">Stuck Leads (7+ days)</p>
                  <p className="text-2xl font-extrabold" style={{ color: '#FF3B5C' }}>{data.stuckLeads}</p>
                </div>
              </div>
            </div>
          )}
          {tab === 'agents' && data && (
            <div className="card overflow-hidden" style={{ padding: 0 }}>
              <table className="w-full">
                <thead className="bg-surface-page border-b border-surface-border">
                  <tr>
                    <th className="p-3 text-left text-xs font-bold text-ink-tertiary uppercase">Agent</th>
                    <th className="p-3 text-left text-xs font-bold text-ink-tertiary uppercase">Calls</th>
                    <th className="p-3 text-left text-xs font-bold text-ink-tertiary uppercase">Emails</th>
                    <th className="p-3 text-left text-xs font-bold text-ink-tertiary uppercase">WhatsApp</th>
                    <th className="p-3 text-left text-xs font-bold text-ink-tertiary uppercase">SMS</th>
                    <th className="p-3 text-left text-xs font-bold text-ink-tertiary uppercase">Won</th>
                    <th className="p-3 text-left text-xs font-bold text-ink-tertiary uppercase">Lost</th>
                    <th className="p-3 text-left text-xs font-bold text-ink-tertiary uppercase">Total Leads</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-border">
                  {data.agents?.map(a => (
                    <tr key={a.id} className="hover:bg-surface-page transition-colors">
                      <td className="p-3 font-bold text-ink-primary">{a.first_name} {a.last_name}</td>
                      <td className="p-3 font-semibold text-ink-secondary">{parseInt(a.calls)}</td>
                      <td className="p-3 font-semibold text-ink-secondary">{parseInt(a.emails)}</td>
                      <td className="p-3 font-semibold text-ink-secondary">{parseInt(a.whatsapp)}</td>
                      <td className="p-3 font-semibold text-ink-secondary">{parseInt(a.sms)}</td>
                      <td className="p-3 font-bold" style={{ color: '#34C759' }}>{parseInt(a.won)}</td>
                      <td className="p-3 font-bold" style={{ color: '#FF3B5C' }}>{parseInt(a.lost)}</td>
                      <td className="p-3 font-semibold text-ink-primary">{parseInt(a.total_leads)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {tab === 'dashboard' && data && (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              <StatBox label="Total Leads" value={data.leadStats?.totalLeads} icon={Users} color="#0066FF" />
              <StatBox label="Conversion Rate" value={`${data.conversionRate}%`} icon={Target} color="#34C759" />
              <StatBox label="Calls Today" value={data.callsToday} icon={Phone} color="#AF52DE" />
              <StatBox label="Emails Today" value={data.emailsToday} icon={Mail} color="#FF9500" />
              <StatBox label="Won" value={data.leadStats?.won} icon={TrendingUp} color="#34C759" />
              <StatBox label="Stuck Leads" value={data.stuckLeads} icon={BarChart3} color="#FF3B5C" />
            </div>
          )}
        </div>
      }
    </div>
  );
}

function ChartCard({ title, data, type }) {
  return (
    <div className="card stagger-in">
      <h3 className="text-lg font-bold text-ink-primary mb-4">{title}</h3>
      <ResponsiveContainer width="100%" height={250}>
        {type === 'line' ? (
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E5E5EA" />
            <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#8E8E93', fontFamily: 'SF Pro Display' }} />
            <YAxis tick={{ fontSize: 12, fill: '#8E8E93', fontFamily: 'SF Pro Display' }} />
            <Tooltip contentStyle={{ background: '#FFFFFF', border: '1px solid #E5E5EA', borderRadius: 12, color: '#1D1D1F', fontFamily: 'SF Pro Display', boxShadow: '0 4px 24px rgba(0,0,0,0.08)' }} />
            <Line type="monotone" dataKey="count" stroke="#0066FF" strokeWidth={2.5} dot={{ fill: '#0066FF', r: 4 }} activeDot={{ r: 6 }} />
          </LineChart>
        ) : (
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E5E5EA" />
            <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#8E8E93', fontFamily: 'SF Pro Display' }} />
            <YAxis tick={{ fontSize: 12, fill: '#8E8E93', fontFamily: 'SF Pro Display' }} />
            <Tooltip contentStyle={{ background: '#FFFFFF', border: '1px solid #E5E5EA', borderRadius: 12, color: '#1D1D1F', fontFamily: 'SF Pro Display', boxShadow: '0 4px 24px rgba(0,0,0,0.08)' }} />
            <Bar dataKey="count" fill="#0066FF" radius={[8, 8, 0, 0]} />
          </BarChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}

function StatBox({ label, value, icon: Icon, color }) {
  return (
    <div className="card card-hover stagger-in flex items-center gap-4">
      <div className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0" style={{ background: `${color}15` }}>
        <Icon size={24} style={{ color }} />
      </div>
      <div>
        <p className="text-2xl font-extrabold text-ink-primary">{value}</p>
        <p className="text-sm font-semibold text-ink-secondary">{label}</p>
      </div>
    </div>
  );
}
