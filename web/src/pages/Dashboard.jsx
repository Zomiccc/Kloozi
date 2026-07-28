import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import API from '../lib/api';
import useAuthStore from '../stores/authStore';
import {
  Users, Phone, Mail, CheckCircle, TrendingUp, Clock, Target, Award,
  AlertCircle, ArrowUpRight, Zap, Bot
} from 'lucide-react';
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const CHART_COLORS = ['#0066FF', '#FF9500', '#AF52DE', '#FF3B5C', '#34C759', '#8E8E93', '#FF2D55', '#FFCC00', '#5AC8FA', '#64D2FF', '#30D158', '#BF5AF2'];
const SOURCE_COLOR_MAP = {
  facebook: '#1877F2', instagram: '#E4405F', google: '#4285F4', tiktok: '#000000',
  linkedin: '#0A66C2', wordpress: '#21759B', website: '#0066FF', manual: '#8E8E93',
  webhook: '#FF9500', 'lead_form': '#AF52DE', referral: '#34C759', import: '#FF3B5C',
};
function getSourceColor(name, idx) {
  if (!name) return CHART_COLORS[idx % CHART_COLORS.length];
  const key = String(name).toLowerCase().replace(/\s+/g, '_');
  if (SOURCE_COLOR_MAP[key]) return SOURCE_COLOR_MAP[key];
  let hash = 0;
  for (let i = 0; i < key.length; i++) hash = key.charCodeAt(i) + ((hash << 5) - hash);
  return CHART_COLORS[Math.abs(hash) % CHART_COLORS.length];
}
const STAGE_COLORS = {
  New: '#0066FF',
  Contacted: '#FF9500',
  Interested: '#AF52DE',
  Negotiating: '#FF3B5C',
  Won: '#34C759',
  Lost: '#8E8E93',
};

function useCountUp(target, duration = 800) {
  const [value, setValue] = useState(0);
  const ref = useRef(null);
  useEffect(() => {
    const start = performance.now();
    const to = Number(target) || 0;
    function tick(now) {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(to * eased));
      if (progress < 1) ref.current = requestAnimationFrame(tick);
    }
    ref.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(ref.current);
  }, [target, duration]);
  return value;
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

export default function Dashboard() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [aiInsights, setAiInsights] = useState(null);

  useEffect(() => {
    loadDashboard();
    loadAIInsights();
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

  const loadAIInsights = async () => {
    try {
      const res = await API.get('/analytics/ai-insight');
      setAiInsights(res.data);
    } catch (err) {
      console.error('AI insight error:', err);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="skeleton h-10 w-80" />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => <div key={i} className="skeleton h-32" />)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="skeleton h-80 lg:col-span-2" />
          <div className="skeleton h-80" />
        </div>
      </div>
    );
  }

  const stats = data?.leadStats || {};
  const trendData = (data?.leadTrend || []).map(t => ({ date: new Date(t.date).toLocaleDateString('en', { month: 'short', day: 'numeric' }), leads: parseInt(t.count) }));
  const sourceData = (data?.leadsBySource || []).map(s => ({ name: s.lead_source, value: parseInt(s.count) }));
  const followUpsTotal = data?.followUpsToday?.total || 0;
  const followUpsDone = data?.followUpsToday?.completed || 0;

  const pipeline = [
    { label: 'New', count: stats.newLeads || 0, color: STAGE_COLORS.New },
    { label: 'Contacted', count: stats.contacted || 0, color: STAGE_COLORS.Contacted },
    { label: 'Interested', count: stats.interested || 0, color: STAGE_COLORS.Interested },
    { label: 'Negotiating', count: stats.negotiating || 0, color: STAGE_COLORS.Negotiating },
    { label: 'Won', count: stats.won || 0, color: STAGE_COLORS.Won },
    { label: 'Lost', count: stats.lost || 0, color: STAGE_COLORS.Lost },
  ];
  const maxPipeline = Math.max(...pipeline.map(p => p.count), 1);

  return (
    <div className="space-y-6">
      {/* Greeting Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-ink-primary tracking-tight">
            {getGreeting()}, {user?.firstName || 'there'}
          </h1>
          <p className="text-sm font-semibold text-ink-secondary mt-1">
            {new Date().toLocaleDateString('en', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {followUpsTotal > 0 && (
            <div className="stat-chip" style={{ borderColor: '#FF9500' }}>
              <Clock size={16} className="text-accent-orange" />
              <span className="text-sm font-bold text-ink-primary">{followUpsTotal - followUpsDone}</span>
              <span className="text-sm text-ink-secondary">follow-ups due</span>
            </div>
          )}
          <button onClick={() => navigate('/app/leads')} className="btn btn-blue" style={{ minHeight: '40px' }}>
            <Zap size={16} /> Quick Add Lead
          </button>
        </div>
      </div>

      {/* Primary Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard icon={Users} label="Total Leads" value={stats.totalLeads || 0} sub={`${stats.leadsToday || 0} new today`} color="#0066FF" delay={0} />
        <StatCard icon={Award} label="Won Deals" value={stats.won || 0} sub={`Conversion: ${data?.conversionRate || 0}%`} color="#34C759" delay={80} />
        <StatCard icon={AlertCircle} label="Stuck Leads" value={data?.stuckLeads || 0} sub="Need attention" color="#FF3B5C" delay={160} />
      </div>

      {/* Secondary Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MiniStat icon={Phone} label="Calls Today" value={data?.callsToday || 0} color="#FF9500" />
        <MiniStat icon={Mail} label="Emails Today" value={data?.emailsToday || 0} color="#AF52DE" />
        <MiniStat icon={CheckCircle} label="Follow-ups Done" value={followUpsDone} sub={`of ${followUpsTotal}`} color="#34C759" />
        <MiniStat icon={TrendingUp} label="New Today" value={stats.leadsToday || 0} sub={`vs ${stats.leadsYesterday || 0} yesterday`} color="#0066FF" />
      </div>

      {/* Main Content — 2-col + 1-col */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Lead Volume Chart */}
        <div className="card card-hover lg:col-span-2 stagger-in" style={{ animationDelay: '200ms' }}>
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-lg font-bold text-ink-primary">Lead Volume</h3>
              <p className="text-sm text-ink-secondary mt-0.5">Last 30 days</p>
            </div>
            <div className="flex items-center gap-2 text-sm font-semibold text-accent-green">
              <ArrowUpRight size={16} /> Trending up
            </div>
          </div>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={trendData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E5EA" vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 12, fill: '#8E8E93' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 12, fill: '#8E8E93' }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ background: '#FFFFFF', border: '1px solid #E5E5EA', borderRadius: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.08)', fontSize: '13px', fontWeight: 600, color: '#1D1D1F' }} />
              <Line type="monotone" dataKey="leads" stroke="#0066FF" strokeWidth={3} dot={false} activeDot={{ r: 6, fill: '#0066FF' }} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Leads by Source */}
        <div className="card card-hover stagger-in" style={{ animationDelay: '280ms' }}>
          <h3 className="text-lg font-bold text-ink-primary mb-1">Lead Sources</h3>
          <p className="text-sm text-ink-secondary mb-4">Where leads come from</p>
          {sourceData.length === 0 ? (
            <div className="flex items-center justify-center h-[240px] text-ink-tertiary text-sm">No data yet</div>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie data={sourceData} cx="50%" cy="50%" outerRadius={75} innerRadius={45} dataKey="value" paddingAngle={3}>
                  {sourceData.map((s, i) => <Cell key={i} fill={getSourceColor(s.name, i)} stroke="none" />)}
                </Pie>
                <Tooltip contentStyle={{ background: '#FFFFFF', border: '1px solid #E5E5EA', borderRadius: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.08)', fontSize: '13px', fontWeight: 600 }} />
              </PieChart>
            </ResponsiveContainer>
          )}
          <div className="space-y-2 mt-4">
            {sourceData.slice(0, 4).map((s, i) => (
              <div key={s.name} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ background: getSourceColor(s.name, i) }} />
                  <span className="text-sm font-semibold text-ink-secondary capitalize">{s.name}</span>
                </div>
                <span className="text-sm font-bold text-ink-primary">{s.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Pipeline Overview */}
      <div className="card card-hover stagger-in" style={{ animationDelay: '360ms' }}>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-lg font-bold text-ink-primary">Pipeline Overview</h3>
            <p className="text-sm text-ink-secondary mt-0.5">Leads at each stage</p>
          </div>
          <button onClick={() => navigate('/app/leads')} className="text-sm font-bold text-accent-blue hover:underline">
            View all leads →
          </button>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {pipeline.map((p) => (
            <div key={p.label} className="rounded-2xl border border-surface-border bg-surface-page p-4 text-center overflow-hidden relative transition-all duration-200 hover:shadow-card">
              <p className="text-3xl font-extrabold" style={{ color: p.color }}>{p.count}</p>
              <p className="text-sm font-semibold text-ink-secondary mt-1">{p.label}</p>
              <div className="h-1.5 mt-3 rounded-full bg-surface-border overflow-hidden">
                <div className="h-full rounded-full transition-all duration-700" style={{ width: `${(p.count / maxPipeline) * 100}%`, background: p.color }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Leads by Agent + AI Insight */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {data?.leadsByAgent && data.leadsByAgent.length > 0 && (
          <div className="card card-hover lg:col-span-2 stagger-in" style={{ animationDelay: '440ms' }}>
            <h3 className="text-lg font-bold text-ink-primary mb-1">Leads by Agent</h3>
            <p className="text-sm text-ink-secondary mb-4">Team performance overview</p>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={data.leadsByAgent.map(a => ({ name: `${a.first_name} ${a.last_name}`, leads: parseInt(a.lead_count), won: parseInt(a.won_count) }))}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E5EA" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#8E8E93' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 12, fill: '#8E8E93' }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ background: '#FFFFFF', border: '1px solid #E5E5EA', borderRadius: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.08)', fontSize: '13px', fontWeight: 600 }} />
                <Bar dataKey="leads" fill="#0066FF" radius={[6, 6, 0, 0]} barSize={28} />
                <Bar dataKey="won" fill="#34C759" radius={[6, 6, 0, 0]} barSize={28} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* AI Insight Card */}
        <div className="card stagger-in" style={{ animationDelay: '520ms', background: 'linear-gradient(135deg, #0066FF, #AF52DE)' }}>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
              <Bot size={22} className="text-white" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">AI Insight</h3>
              <p className="text-xs text-white/80">{aiInsights?.aiPowered ? 'Powered by Zomic AI' : 'Rule-based insights'}</p>
            </div>
          </div>
          <div className="space-y-3 mt-6">
            {(aiInsights?.insights || []).slice(0, 3).map((ins, i) => (
              <div key={i} className="bg-white/15 rounded-xl p-3 backdrop-blur-sm">
                <p className="text-sm text-white font-bold mb-1">{ins.title}</p>
                <p className="text-sm text-white/90">{ins.text}</p>
              </div>
            ))}
            {!aiInsights && (
              <div className="bg-white/15 rounded-xl p-3 backdrop-blur-sm">
                <p className="text-sm text-white font-semibold">Loading insights...</p>
              </div>
            )}
            <button onClick={() => navigate('/app/analytics')} className="w-full bg-white/20 hover:bg-white/30 rounded-xl py-2.5 text-sm font-bold text-white transition-all backdrop-blur-sm">
              View Full Analytics →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, sub, color, delay = 0 }) {
  const count = useCountUp(value);
  return (
    <div
      className="card card-hover stagger-in relative overflow-hidden"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="absolute top-0 left-0 right-0 h-1 rounded-t-2xl" style={{ background: color }} />
      <div className="flex items-center gap-4">
        <div
          className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0"
          style={{ background: `${color}15` }}
        >
          <Icon size={24} style={{ color }} />
        </div>
        <div className="min-w-0">
          <p className="text-3xl font-extrabold text-ink-primary tracking-tight">{count}</p>
          <p className="text-sm font-semibold text-ink-secondary">{label}</p>
          {sub && <p className="text-xs text-ink-tertiary mt-0.5">{sub}</p>}
        </div>
      </div>
    </div>
  );
}

function MiniStat({ icon: Icon, label, value, sub, color }) {
  const count = useCountUp(value, 600);
  return (
    <div className="card card-hover stagger-in" style={{ padding: '20px' }}>
      <div className="flex items-center gap-2 mb-3">
        <Icon size={18} style={{ color }} />
        <span className="text-xs font-semibold text-ink-secondary uppercase tracking-wider">{label}</span>
      </div>
      <p className="text-2xl font-extrabold text-ink-primary">{count}</p>
      {sub && <p className="text-xs text-ink-tertiary mt-1">{sub}</p>}
    </div>
  );
}

