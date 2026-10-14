import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import API from '../../lib/api';
import toast from 'react-hot-toast';
import { CountUp } from '../../lib/motion';
import { describeSegmentConditions } from '../../lib/marketingShared';

export default function MktAnalytics() {
  const [overview, setOverview] = useState(null);
  const [flows, setFlows] = useState([]);
  const [campaigns, setCampaigns] = useState([]);
  const [segments, setSegments] = useState([]);

  useEffect(() => {
    API.get('/marketing/analytics/overview').then((r) => setOverview(r.data)).catch(() => {});
    API.get('/marketing/flows').then((r) => setFlows(r.data.flows)).catch(() => {});
    API.get('/campaigns').then((r) => setCampaigns(r.data.campaigns.filter((c) => c.channel === 'email'))).catch(() => {});
    API.get('/marketing/segments').then((r) => setSegments(r.data.segments)).catch(() => {});
  }, []);

  if (!overview) {
    return <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="skeleton h-20" />)}</div>;
  }

  const sent = overview.emails?.sent || 0;
  const opened = overview.emails?.opened || 0;
  const clicked = overview.emails?.clicked || 0;
  const openRate = sent ? ((opened / sent) * 100).toFixed(1) : null;
  const clickRate = sent ? ((clicked / sent) * 100).toFixed(1) : null;

  return (
    <div className="space-y-8">
      <div>
        <h1 style={{ fontSize: '32px', fontWeight: 650, letterSpacing: '-0.01em' }}>Marketing analytics</h1>
        <p className="text-ink-secondary mt-1" style={{ fontSize: '15px' }}>
          Did the automations actually move leads — not just how many emails went out.
        </p>
      </div>

      {/* Headline numbers — count up, stagger in */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-8">
        {[
          { node: <Stat big={sent} label="Emails delivered to SendGrid" /> },
          { node: <Stat big={opened} label="Opened" sub={openRate != null ? `${openRate}% of sent` : 'no sends yet'} /> },
          { node: <Stat big={clicked} label="Clicked a link" sub={clickRate != null ? `${clickRate}% of sent` : ''} /> },
          { node: (
            <Stat
              big={`${overview.flows?.live ?? 0}/${overview.flows?.total ?? 0}`}
              label="Flows live"
              sub={`${overview.enrollments?.active ?? 0} leads in progress`}
            />
          ) },
        ].map((s, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06, duration: 0.25 }}>
            {s.node}
          </motion.div>
        ))}
      </section>

      {/* Flows */}
      <section>
        <div className="flex items-baseline justify-between mb-3">
          <h2 className="font-bold" style={{ fontSize: '18px' }}>Flow performance</h2>
          <Link to="/app/marketing/flows" className="text-sm font-semibold text-accent-deep hover:underline underline-offset-2">Open flows ↗</Link>
        </div>
        {flows.length === 0 ? (
          <p className="text-ink-secondary text-sm">No flows yet.</p>
        ) : (
          <table className="flazyn-table">
            <thead><tr><th>Flow</th><th>Status</th><th className="text-right">Entered</th><th className="text-right">In progress</th><th className="text-right">Completed</th><th className="text-right">Exited</th></tr></thead>
            <tbody>
              {flows.map((f) => (
                <tr key={f.id} className="cursor-pointer">
                  <td><Link to={`/app/marketing/flows/${f.id}`} className="font-semibold hover:underline underline-offset-2">{f.name}</Link></td>
                  <td><span className={`badge ${f.status === 'live' ? 'badge-success' : f.status === 'paused' ? 'badge-warning' : 'badge-neutral'}`}>{f.status}</span></td>
                  <td className="mono text-right">{f.stats?.entered ?? 0}</td>
                  <td className="mono text-right">{f.stats?.active ?? 0}</td>
                  <td className="mono text-right">{f.stats?.completed ?? 0}</td>
                  <td className="mono text-right">{f.stats?.exited ?? 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <p className="mt-2 text-ink-tertiary" style={{ fontSize: '12px' }}>
          Per-flow conversion & attributed value live on each flow's Analytics tab.
        </p>
      </section>

      {/* Campaigns */}
      <section>
        <div className="flex items-baseline justify-between mb-3">
          <h2 className="font-bold" style={{ fontSize: '18px' }}>Campaigns</h2>
          <Link to="/app/marketing/campaigns" className="text-sm font-semibold text-accent-deep hover:underline underline-offset-2">Open campaigns ↗</Link>
        </div>
        {campaigns.length === 0 ? (
          <p className="text-ink-secondary text-sm">No email campaigns yet.</p>
        ) : (
          <table className="flazyn-table">
            <thead><tr><th>Campaign</th><th>Sent</th><th className="text-right">Audience</th><th className="text-right">Opened</th><th className="text-right">Clicked</th></tr></thead>
            <tbody>
              {campaigns.slice(0, 10).map((c) => (
                <tr key={c.id}>
                  <td className="font-semibold">{c.name}</td>
                  <td><span className={`badge ${c.status === 'completed' ? 'badge-success' : c.status === 'sending' ? 'badge-info' : c.status === 'scheduled' ? 'badge-warning' : 'badge-neutral'}`}>{c.status}</span></td>
                  <td className="mono text-right">{c.recipients_count}</td>
                  <td className="mono text-right">{c.opened_count}</td>
                  <td className="mono text-right">{c.clicked_count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {/* Segments */}
      <section>
        <div className="flex items-baseline justify-between mb-3">
          <h2 className="font-bold" style={{ fontSize: '18px' }}>Segments right now</h2>
          <Link to="/app/marketing/segments" className="text-sm font-semibold text-accent-deep hover:underline underline-offset-2">Manage ↗</Link>
        </div>
        {segments.length === 0 ? (
          <p className="text-ink-secondary text-sm">No segments yet.</p>
        ) : (
          <div className="space-y-2">
            {segments.map((s) => (
              <div key={s.id} className="flex items-center justify-between gap-4 hairline-b py-2.5 hover-accent-left">
                <div className="min-w-0">
                  <p className="font-semibold truncate" style={{ fontSize: '14px' }}>{s.name}</p>
                  <p className="text-ink-tertiary truncate" style={{ fontSize: '12px' }}>{describeSegmentConditions(s)}</p>
                </div>
                <span className="mono flex-shrink-0" style={{ fontSize: '20px', fontWeight: 600 }}>{s.live_count ?? '—'}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      <p className="text-ink-tertiary" style={{ fontSize: '12px', maxWidth: '640px' }}>
        Honesty note: opens are measured by tracking pixel and clicks by redirect — both real events.
        "Won" figures count enrolled/sent leads currently in a Won stage; attributed value sums their budget
        fields because deal revenue is not tracked anywhere else in this product.
      </p>
    </div>
  );
}

function Stat({ big, label, sub }) {
  const numeric = Number(String(big).split('/')[0]);
  const isNumeric = !Number.isNaN(numeric) && String(big).indexOf('/') === -1;
  return (
    <div>
      <p className="mono" style={{ fontSize: '36px', fontWeight: 600, letterSpacing: '-0.02em' }}>
        {isNumeric ? <CountUp value={numeric} /> : big}
      </p>
      <p className="meta-label mt-0.5">{label}</p>
      {sub && <p className="text-ink-secondary mono" style={{ fontSize: '12px' }}>{sub}</p>}
    </div>
  );
}
