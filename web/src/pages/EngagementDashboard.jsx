import { useState, useEffect } from 'react';
import API from '../lib/api';
import { BarChart3, TrendingUp, Mail, FileText, Target, Users, Clock, Eye, Activity } from 'lucide-react';
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const COLORS = ['#0066FF', '#34C759', '#FF9500', '#FF3B5C', '#AF52DE', '#8E8E93'];

export default function EngagementDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState('30d');

  useEffect(() => { loadAnalytics(); }, [range]);

  const loadAnalytics = async () => {
    setLoading(true);
    try {
      const res = await API.get('/analytics/engagement', { params: { range } });
      setData(res.data);
    } catch { }
    finally { setLoading(false); }
  };

  const ranges = [
    { key: 'today', label: 'Today' },
    { key: '7d', label: '7 Days' },
    { key: '30d', label: '30 Days' },
    { key: '90d', label: '90 Days' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <h1 className="text-3xl font-extrabold text-ink-primary tracking-tight">Engagement Analytics</h1>
        <div className="flex gap-1 bg-white border border-surface-border rounded-full p-1">
          {ranges.map(r => (
            <button key={r.key} onClick={() => setRange(r.key)}
              className={`tab-pill ${range === r.key ? 'tab-pill-active bg-accent-blue' : 'text-ink-secondary hover:text-ink-primary'}`}>
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? <div className="flex justify-center py-8"><div className="animate-spin w-8 h-8 border-4 border-accent-blue border-t-transparent rounded-full" /></div> :
        data && (
          <div className="space-y-6">
            {/* Section: Email Engagement */}
            <div>
              <h2 className="text-lg font-bold text-ink-primary mb-3 flex items-center gap-2"><Mail size={18} style={{ color: '#FF9500' }} /> Email Engagement</h2>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <StatBox label="Emails Sent" value={data.email?.sent || 0} icon={Mail} color="#0066FF" />
                <StatBox label="Emails Opened" value={data.email?.opened || 0} icon={Eye} color="#34C759" />
                <StatBox label="Emails Clicked" value={data.email?.clicked || 0} icon={Target} color="#AF52DE" />
                <StatBox label="Emails Replied" value={data.email?.replied || 0} icon={Activity} color="#FF9500" />
              </div>
            </div>

            {/* Section: Content Engagement */}
            <div>
              <h2 className="text-lg font-bold text-ink-primary mb-3 flex items-center gap-2"><FileText size={18} style={{ color: '#0066FF' }} /> Content Engagement</h2>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <StatBox label="Files Sent" value={data.content?.totalSent || 0} icon={FileText} color="#0066FF" />
                <StatBox label="Files Opened" value={data.content?.totalOpened || 0} icon={Eye} color="#34C759" />
                <StatBox label="Total Views" value={data.content?.totalViews || 0} icon={BarChart3} color="#AF52DE" />
                <StatBox label="Time Spent" value={`${Math.floor((data.content?.totalTimeSpent || 0) / 60)}m`} icon={Clock} color="#FF9500" />
              </div>
            </div>

            {/* Section: Lead Activity */}
            <div>
              <h2 className="text-lg font-bold text-ink-primary mb-3 flex items-center gap-2"><Users size={18} style={{ color: '#AF52DE' }} /> Lead Activity</h2>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <StatBox label="Total Leads" value={data.leadActivity?.total || 0} icon={Users} color="#0066FF" />
                <StatBox label="New Today" value={data.leadActivity?.newToday || 0} icon={TrendingUp} color="#34C759" />
                <StatBox label="Active This Week" value={data.leadActivity?.activeThisWeek || 0} icon={Activity} color="#FF9500" />
                <StatBox label="Stuck (14+ days)" value={data.leadActivity?.stuck || 0} icon={Clock} color="#FF3B5C" />
              </div>
            </div>

            {/* Section: Conversion */}
            <div>
              <h2 className="text-lg font-bold text-ink-primary mb-3 flex items-center gap-2"><Target size={18} style={{ color: '#34C759' }} /> Conversion</h2>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <StatBox label="Won" value={data.conversion?.won || 0} icon={TrendingUp} color="#34C759" />
                <StatBox label="Lost" value={data.conversion?.lost || 0} icon={Target} color="#FF3B5C" />
                <StatBox label="Conversion Rate" value={`${data.conversion?.conversionRate || 0}%`} icon={BarChart3} color="#0066FF" />
                <StatBox label="Avg Signal Score" value={data.conversion?.avgSignalScore || 0} icon={Activity} color="#AF52DE" />
              </div>
            </div>

            {/* Top Engaged Leads */}
            <div className="card stagger-in" style={{ padding: 0 }}>
              <div className="p-5 border-b border-surface-border">
                <h2 className="text-lg font-bold text-ink-primary flex items-center gap-2"><TrendingUp size={18} style={{ color: '#0066FF' }} /> Top Engaged Leads</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-surface-page border-b border-surface-border">
                    <tr>
                      <th className="p-3 text-left text-xs font-bold text-ink-tertiary uppercase">Lead</th>
                      <th className="p-3 text-left text-xs font-bold text-ink-tertiary uppercase">Stage</th>
                      <th className="p-3 text-left text-xs font-bold text-ink-tertiary uppercase">Score</th>
                      <th className="p-3 text-left text-xs font-bold text-ink-tertiary uppercase">Emails</th>
                      <th className="p-3 text-left text-xs font-bold text-ink-tertiary uppercase">Doc Views</th>
                      <th className="p-3 text-left text-xs font-bold text-ink-tertiary uppercase">Total Opens</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-surface-border">
                    {data.topLeads && data.topLeads.length > 0 ? data.topLeads.map((lead, idx) => (
                      <tr key={lead.id || idx} className="hover:bg-surface-page transition-colors">
                        <td className="p-3 font-bold text-ink-primary">{lead.first_name} {lead.last_name}</td>
                        <td className="p-3"><span className="badge capitalize" style={{ background: '#0066FF10', color: '#0066FF' }}>{lead.stage}</span></td>
                        <td className="p-3 font-bold" style={{ color: (lead.score || 0) >= 70 ? '#34C759' : (lead.score || 0) >= 40 ? '#FF9500' : '#FF3B5C' }}>{lead.score || 0}</td>
                        <td className="p-3 font-semibold text-ink-secondary">{parseInt(lead.email_count) || 0}</td>
                        <td className="p-3 font-semibold text-ink-secondary">{parseInt(lead.doc_views) || 0}</td>
                        <td className="p-3 font-bold text-ink-primary">{parseInt(lead.total_opens) || 0}</td>
                      </tr>
                    )) : (
                      <tr><td colSpan={6} className="p-6 text-center text-ink-tertiary text-sm">No engaged leads yet</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )
      }
    </div>
  );
}

function StatBox({ label, value, icon: Icon, color }) {
  return (
    <div className="card card-hover stagger-in flex items-center gap-3" style={{ padding: '16px' }}>
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
