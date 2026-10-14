import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import API from '../lib/api';
import { CountUp } from '../lib/motion';
import useAuthStore from '../stores/authStore';
import { ArrowRight, ArrowUpRight, Clock, Users, Mail, Phone, Flame, TrendingUp } from 'lucide-react';
import { avatarTone, initialsOf } from '../lib/avatar';
import { pillStyle } from '../components/ui';

const stageColors = {
  new: '#2F6FDB', contacted: '#B45309', interested: '#2F6FDB',
  negotiating: '#B45309', won: '#0E8A5F', lost: '#A8A29E',
};

export default function Welcome() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const firstName = user?.firstName || user?.first_name || 'there';
  const [stats, setStats] = useState(null);
  const [recentLeads, setRecentLeads] = useState([]);

  useEffect(() => {
    API.get('/analytics/dashboard').then((r) => setStats(r.data)).catch(() => {});
    API.get('/leads?limit=6').then((r) => setRecentLeads(r.data.leads || [])).catch(() => {});
  }, []);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const today = new Date().toLocaleDateString('en', { weekday: 'long', month: 'long', day: 'numeric' });

  const s = stats || {};
  const st = s.leadStats || {};
  const followUpsLeft = (s.followUpsToday?.total || 0) - (s.followUpsToday?.completed || 0);
  const loading = !stats;

  return (
    <div className="max-w-[1100px]">
      {/* Greeting */}
      <div className="pt-4">
        <p className="meta-label mb-2">{today}</p>
        <h1 className="text-ink-primary" style={{ fontSize: '40px', fontWeight: 650, letterSpacing: '-0.015em', lineHeight: 1.15 }}>
          {greeting}, {firstName}.
        </h1>
        <p className="text-ink-secondary mt-2" style={{ fontSize: '15px' }}>
          {followUpsLeft > 0
            ? <>You have <b className="text-ink-primary">{followUpsLeft} follow-up{followUpsLeft > 1 ? 's' : ''}</b> waiting — clear them before lunch.</>
            : 'Nothing urgent today. Time to hunt.'}
        </p>
      </div>

      {/* The Display number + supporting metrics */}
      <motion.div
        initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.22 }}
        className="hairline mt-10 pt-8 flex items-end justify-between gap-8 flex-wrap"
      >
        <div>
          <p className="meta-label mb-1">Pipeline under management</p>
          <p className="mono text-ink-primary" style={{ fontSize: '56px', fontWeight: 700, letterSpacing: '-0.02em', lineHeight: 1.05 }}>
            <CountUp value={Number(st.totalLeads) || 0} />
          </p>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-8 gap-y-4 pb-1">
          {[
            { label: 'New today', value: st.leadsToday || 0 },
            { label: 'Won all-time', value: st.won || 0 },
            { label: 'Conversion', value: `${s.conversionRate ?? 0}%`, mono: false },
            { label: 'Follow-ups left', value: followUpsLeft, danger: followUpsLeft > 0 },
          ].map((m) => (
            <div key={m.label}>
              <p className="meta-label mb-1">{m.label}</p>
              <p className="mono" style={{ fontSize: '20px', fontWeight: 600, color: m.danger ? '#B45309' : '#1C1917' }}>
                {m.mono === false ? (s.conversionRate ?? 0) + '%' : <CountUp value={Number(m.value) || 0} />}
              </p>
            </div>
          ))}
        </div>
      </motion.div>

      {/* Two-column brief */}
      <div className="grid lg:grid-cols-[1fr_380px] gap-10 mt-12 items-start">
        {/* Latest arrivals */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <p className="meta-label">Latest arrivals</p>
            <button onClick={() => navigate('/app/leads')} className="text-sm font-medium text-ink-secondary hover:text-ink-primary transition-colors flex items-center gap-1">
              All leads <ArrowRight size={13} />
            </button>
          </div>
          {loading ? (
            <div className="space-y-2">{[1, 2, 3, 4].map((i) => <div key={i} className="skeleton h-14" />)}</div>
          ) : recentLeads.length === 0 ? (
            <div className="pt-8 max-w-[420px]">
              <p className="text-ink-primary" style={{ fontSize: '24px', fontWeight: 650 }}>No leads yet.</p>
              <p className="text-ink-secondary mt-1" style={{ fontSize: '14px' }}>Connect a source in Automations or add your first lead.</p>
              <button onClick={() => navigate('/app/automations')} className="btn btn-accent mt-5">Connect a source</button>
            </div>
          ) : (
            <div>
              {recentLeads.map((l, idx) => (
                <motion.button
                  key={l.id}
                  initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(idx * 0.05, 0.35), duration: 0.2 }}
                  onClick={() => navigate(`/app/leads/${l.id}`)}
                  className="group w-full hairline-b py-3 flex items-center gap-3 text-left hover-accent-left"
                >
                  <span
                    className="flex items-center justify-center text-xs font-bold  flex-shrink-0"
                    style={{ background: avatarTone(`${l.first_name || ''}${l.last_name || ''}`).bg, color: avatarTone(`${l.first_name || ''}${l.last_name || ''}`).fg, width: '32px', height: '32px', borderRadius: '10px' }}
                  >
                    {initialsOf(l.first_name, l.last_name)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold text-ink-primary truncate" style={{ fontSize: '14px' }}>{l.first_name} {l.last_name}</span>
                    <span className="block mono text-ink-secondary truncate" style={{ fontSize: '12px' }}>{l.phone || l.email || l.city || ''}</span>
                  </span>
                  <span className="capitalize hidden sm:block text-ink-tertiary flex-shrink-0" style={{ fontSize: '12px' }}>{l.lead_source || ''}</span>
                  <span className="capitalize flex-shrink-0" style={pillStyle(stageColors[l.stage] || stageColors.new)}>
                    {l.stage}
                  </span>
                  <ArrowUpRight size={14} className="text-ink-tertiary opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                </motion.button>
              ))}
            </div>
          )}
        </section>

        {/* Right rail — actions */}
        <aside className="space-y-8">
          <section>
            <p className="meta-label mb-4">Act now</p>
            <div className="space-y-2">
              {[
                { label: 'Clear follow-ups', sub: `${followUpsLeft} waiting`, route: '/app/leads?view=follow_ups', icon: Clock, hot: followUpsLeft > 0 },
                { label: 'Call list', sub: 'Work your newest leads', route: '/app/leads', icon: Phone },
                { label: 'Unread mail', sub: 'Internal team messages', route: '/app/mailbox', icon: Mail },
                { label: "See what's working", sub: 'Analytics & engagement', route: '/app/analytics', icon: TrendingUp },
              ].map((a, i) => (
                <motion.button
                  key={a.label}
                  initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: Math.min(i * 0.05, 0.3), duration: 0.2 }}
                  onClick={() => navigate(a.route)}
                  className="group w-full flex items-center gap-3 p-4 bg-white text-left transition-all hover:elev-sm active:scale-[0.99]"
                  style={{ border: '1px solid #E7E5E4', borderRadius: '10px' }}
                >
                  <span className={`flex-shrink-0 ${a.hot ? 'text-accent-deep' : 'text-ink-tertiary'}`}>
                    {a.hot ? <Flame size={17} /> : <a.icon size={17} />}
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="block font-semibold text-ink-primary" style={{ fontSize: '14px' }}>{a.label}</span>
                    <span className="block text-ink-secondary" style={{ fontSize: '12px' }}>{a.sub}</span>
                  </span>
                  <ArrowRight size={14} className="text-ink-tertiary group-hover:translate-x-0.5 group-hover:text-ink-primary transition-all flex-shrink-0" />
                </motion.button>
              ))}
            </div>
          </section>

          <section>
            <p className="meta-label mb-4">Go deeper</p>
            <div className="flex flex-wrap gap-2">
              {[
                { label: 'Build a flow', route: '/app/marketing/flows/new' },
                { label: 'New campaign', route: '/app/marketing/campaigns' },
                { label: 'Team performance', route: '/app/team' },
                { label: 'Engagement report', route: '/app/engagement' },
              ].map((x, i) => (
                <motion.button
                  key={x.label}
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.25 + i * 0.04 }}
                  onClick={() => navigate(x.route)}
                  className="text-sm font-medium text-ink-secondary hover:text-ink-primary underline underline-offset-4 transition-colors"
                >
                  {x.label}
                </motion.button>
              ))}
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
