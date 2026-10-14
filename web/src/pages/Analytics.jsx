import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import API from '../lib/api';
import { CountUp } from '../lib/motion';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Segmented } from '../components/ui';

const CHART_COLOR = '#EDE9FF';
const GRID_COLOR = '#E7E5E4';
const TICK_COLOR = '#A8A29E';

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

  const tooltipStyle = {
    background: '#FFFFFF', border: '1px solid #E7E5E4', borderRadius: '10px',
    color: '#1C1917', fontFamily: 'IBM Plex Mono, monospace', fontSize: '12px',
    boxShadow: '0 2px 12px rgba(28,25,23,0.06)',
  };

  return (
    <div className="space-y-6">
      {/* Header — editorial */}
      <div className="flex items-baseline justify-between flex-wrap gap-4">
        <h1 className="text-ink-primary" style={{ fontSize: '32px', fontWeight: 650, letterSpacing: '-0.01em' }}>Analytics</h1>
        <div className="flex items-center gap-3">
          <input type="date" value={dateRange.from} onChange={(e) => setDateRange({ ...dateRange, from: e.target.value })} className="input" style={{ width: 'auto', fontSize: '13px' }} />
          <span className="text-ink-tertiary" style={{ fontSize: '13px' }}>to</span>
          <input type="date" value={dateRange.to} onChange={(e) => setDateRange({ ...dateRange, to: e.target.value })} className="input" style={{ width: 'auto', fontSize: '13px' }} />
        </div>
      </div>

      {/* Scope switch — segmented pill control (Section 7) */}
      <div style={{ marginBottom: '24px' }}>
        <Segmented layoutId="analytics-tab" options={tabs} value={tab} onChange={setTab} />
      </div>

      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4].map((i) => <div key={i} className="skeleton h-32" />)}
        </div>
      ) : (
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={tab}
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="space-y-8"
          >
          {tab === 'leads' && data && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <ChartPanel title="Leads by source" data={data.bySource?.map(s => ({ name: s.lead_source, count: parseInt(s.count) })) || []} type="bar" tooltipStyle={tooltipStyle} />
              <ChartPanel title="Leads by city" data={data.byCity?.map(c => ({ name: c.city, count: parseInt(c.count) })) || []} type="bar" tooltipStyle={tooltipStyle} />
              <ChartPanel title="Lead trend" data={data.trend?.map(t => ({ name: new Date(t.date).toLocaleDateString('en', { month: 'short', day: 'numeric' }), count: parseInt(t.count) })) || []} type="line" tooltipStyle={tooltipStyle} />
              <ChartPanel title="Leads by budget range" data={data.byBudget?.map(b => ({ name: b.range, count: parseInt(b.count) })) || []} type="bar" tooltipStyle={tooltipStyle} />
            </div>
          )}
          {tab === 'conversion' && data && (
            <div className="space-y-8">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <ChartPanel title="Conversion by source" data={data.bySource?.map(s => ({ name: s.lead_source, count: parseFloat(s.conversion_rate) })) || []} type="bar" tooltipStyle={tooltipStyle} />
                <ChartPanel title="Conversion by agent" data={data.byAgent?.map(a => ({ name: `${a.first_name} ${a.last_name}`, count: parseFloat(a.conversion_rate) })) || []} type="bar" tooltipStyle={tooltipStyle} />
              </div>
              <div>
                <p className="meta-label mb-1">Average time to close</p>
                <p className="mono text-ink-primary" style={{ fontSize: '48px', fontWeight: 600 }}>
                  <CountUp value={Number(data.avgTimeToClose) || 0} /><span className="text-ink-tertiary" style={{ fontSize: '20px', fontWeight: 400 }}> days</span>
                </p>
              </div>
            </div>
          )}
          {tab === 'pipeline' && data && (
            <div className="space-y-6">
              <div>
                <p className="meta-label mb-3">Pipeline stages</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-0">
                  {data.stages?.map((s, i) => (
                    <motion.div
                      key={s.name}
                      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.06, duration: 0.25 }}
                      className={i > 0 ? 'hairline-l pl-4' : ''}
                    >
                      <p className="mono text-ink-primary" style={{ fontSize: '28px', fontWeight: 600 }}>
                        <CountUp value={parseInt(s.count) || 0} />
                      </p>
                      <p className="text-ink-secondary" style={{ fontSize: '13px' }}>{s.name}</p>
                    </motion.div>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-0">
                <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3, duration: 0.25 }} className="pr-4">
                  <p className="meta-label mb-1">Moved this week</p>
                  <p className="mono text-ink-primary" style={{ fontSize: '28px', fontWeight: 600 }}><CountUp value={Number(data.movedThisWeek) || 0} /></p>
                </motion.div>
                <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4, duration: 0.25 }} className="hairline-l pl-4">
                  <p className="meta-label mb-1">Stuck leads (7+ days)</p>
                  <p className="mono" style={{ fontSize: '28px', fontWeight: 600, color: '#B45309' }}><CountUp value={Number(data.stuckLeads) || 0} /></p>
                </motion.div>
              </div>
            </div>
          )}
          {tab === 'agents' && data && (
            <div>
              {/* Header row */}
              <div className="hairline-b pb-2 flex items-center gap-4">
                <span className="meta-label flex-1">Agent</span>
                <span className="meta-label mono flex-shrink-0" style={{ width: '60px' }}>Calls</span>
                <span className="meta-label mono flex-shrink-0" style={{ width: '60px' }}>Emails</span>
                <span className="meta-label mono flex-shrink-0" style={{ width: '80px' }}>WhatsApp</span>
                <span className="meta-label mono flex-shrink-0" style={{ width: '50px' }}>SMS</span>
                <span className="meta-label mono flex-shrink-0" style={{ width: '50px' }}>Won</span>
                <span className="meta-label mono flex-shrink-0" style={{ width: '50px' }}>Lost</span>
                <span className="meta-label mono flex-shrink-0" style={{ width: '80px' }}>Total</span>
              </div>
              {data.agents?.map(a => (
                <div key={a.id} className="hairline-b py-3 flex items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <p className="text-ink-primary truncate" style={{ fontSize: '14px', fontWeight: 500 }}>{a.first_name} {a.last_name}</p>
                  </div>
                  <span className="mono text-ink-secondary flex-shrink-0" style={{ width: '60px', fontSize: '13px' }}>{parseInt(a.calls)}</span>
                  <span className="mono text-ink-secondary flex-shrink-0" style={{ width: '60px', fontSize: '13px' }}>{parseInt(a.emails)}</span>
                  <span className="mono text-ink-secondary flex-shrink-0" style={{ width: '80px', fontSize: '13px' }}>{parseInt(a.whatsapp)}</span>
                  <span className="mono text-ink-secondary flex-shrink-0" style={{ width: '50px', fontSize: '13px' }}>{parseInt(a.sms)}</span>
                  <span className="mono text-ink-primary flex-shrink-0" style={{ width: '50px', fontSize: '13px', fontWeight: 600 }}>{parseInt(a.won)}</span>
                  <span className="mono text-ink-tertiary flex-shrink-0" style={{ width: '50px', fontSize: '13px' }}>{parseInt(a.lost)}</span>
                  <span className="mono text-ink-secondary flex-shrink-0" style={{ width: '80px', fontSize: '13px' }}>{parseInt(a.total_leads)}</span>
                </div>
              ))}
            </div>
          )}
          {tab === 'dashboard' && data && (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-0">
              {[
                { label: 'Total leads', value: data.leadStats?.totalLeads },
                { label: 'Conversion rate', value: `${data.conversionRate}%` },
                { label: 'Calls today', value: data.callsToday },
                { label: 'Emails today', value: data.emailsToday },
                { label: 'Won', value: data.leadStats?.won },
                { label: 'Stuck leads', value: data.stuckLeads },
              ].map((s, i) => (
                <motion.div
                  key={s.label}
                  initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05, duration: 0.25 }}
                  className={i > 0 ? 'hairline-l pl-4' : ''}
                >
                  <p className="meta-label mb-1">{s.label}</p>
                  <p className="mono text-ink-primary" style={{ fontSize: '28px', fontWeight: 600 }}>
                    {typeof s.value === 'number' || (s.value && !String(s.value).includes('%'))
                      ? <CountUp value={parseFloat(String(s.value)) || 0} />
                      : (s.value ?? 0)}
                  </p>
                </motion.div>
              ))}
            </div>
          )}
          </motion.div>
        </AnimatePresence>
      )}
    </div>
  );
}

function ChartPanel({ title, data, type, tooltipStyle }) {
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
      <p className="meta-label mb-3">{title}</p>
      <ResponsiveContainer width="100%" height={240}>
        {type === 'line' ? (
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} />
            <XAxis dataKey="name" tick={{ fontSize: 11, fill: TICK_COLOR, fontFamily: 'IBM Plex Mono, monospace' }} axisLine={{ stroke: GRID_COLOR }} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: TICK_COLOR, fontFamily: 'IBM Plex Mono, monospace' }} axisLine={false} tickLine={false} />
            <Tooltip contentStyle={tooltipStyle} />
            {/* Line traces itself in */}
            <Line type="monotone" dataKey="count" stroke={CHART_COLOR} strokeWidth={2}
              dot={{ fill: CHART_COLOR, r: 3 }} activeDot={{ r: 5 }}
              isAnimationActive animationDuration={900} animationEasing="ease-out" />
          </LineChart>
        ) : (
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke={GRID_COLOR} />
            <XAxis dataKey="name" tick={{ fontSize: 11, fill: TICK_COLOR, fontFamily: 'IBM Plex Mono, monospace' }} axisLine={{ stroke: GRID_COLOR }} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: TICK_COLOR, fontFamily: 'IBM Plex Mono, monospace' }} axisLine={false} tickLine={false} />
            <Tooltip contentStyle={tooltipStyle} cursor={{ fill: '#FAFAF9' }} />
            {/* Bars grow out of the baseline */}
            <Bar dataKey="count" fill={CHART_COLOR} radius={[2, 2, 0, 0]}
              isAnimationActive animationDuration={700} animationEasing="ease-out" />
          </BarChart>
        )}
      </ResponsiveContainer>
    </motion.div>
  );
}
