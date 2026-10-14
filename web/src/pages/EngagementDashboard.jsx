import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { Activity, Copy, FileText, Globe, Sparkles } from 'lucide-react';
import API from '../lib/api';
import { Avatar, TOKENS, formatWait, useNow, EmptyState } from '../components/ui';
import { fmtSecs, InterestChip } from '../components/InterestPanel';

/* ═══════════════════════════════════════════════════════════════
   INTEREST BOARD — who is engaged right now, who is hottest, and
   what they have been reading. Refreshes live.
   ═══════════════════════════════════════════════════════════════ */

export default function EngagementDashboard() {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const now = useNow(15000);

  const load = async () => {
    try { const res = await API.get('/analytics/interest-board'); setData(res.data); } catch { toast.error('Could not load interest'); }
  };
  useEffect(() => { load(); const t = setInterval(load, 15000); return () => clearInterval(t); }, []);

  if (!data) return <div className="flex flex-col" style={{ gap: 12 }}>{[0, 1, 2].map((i) => <div key={i} className="skeleton" style={{ height: i ? 160 : 90 }} />)}</div>;
  const ago = (d) => (d ? `${formatWait((now - new Date(d).getTime()) / 60000)} ago` : '—');
  const totals = data.totals || {};

  return (
    <div className="flex flex-col" style={{ gap: 22 }}>
      <div className="flex items-end justify-between flex-wrap" style={{ gap: 16 }}>
        <div>
          <p className="meta-label" style={{ marginBottom: 6 }}>Last 7 days</p>
          <h1 className="t-display" style={{ fontSize: 'clamp(34px, 5vw, 50px)' }}>
            {data.live.length > 0 ? <><span style={{ color: TOKENS.ember }}>{data.live.length}</span> {data.live.length === 1 ? 'lead is' : 'leads are'} <em>looking right now.</em></> : <>Who's <em>actually interested.</em></>}
          </h1>
        </div>
        <div className="flex" style={{ background: TOKENS.surface, border: `1px solid ${TOKENS.hairline}`, borderRadius: 12 }}>
          {[['Engaged leads', totals.engaged_leads || 0], ['Site visits', totals.web_sessions || 0], ['Doc reading', fmtSecs(totals.doc_seconds || 0)]].map(([l, v], i) => (
            <div key={l} style={{ padding: '12px 18px', borderLeft: i ? `1px solid ${TOKENS.hairline}` : 'none' }}>
              <p className="meta-label">{l}</p>
              <p className="serif" style={{ fontSize: 28, lineHeight: 1.05, marginTop: 4 }}>{v}</p>
            </div>
          ))}
        </div>
      </div>

      {!data.tracking_installed && <InstallCard snippet={data.snippet} />}

      {/* Live now */}
      <section>
        <p className="meta-label flex items-center" style={{ gap: 8, marginBottom: 10 }}>
          <span className={`heat-dot ${data.live.length ? 'heat-live' : ''}`} style={{ background: data.live.length ? TOKENS.ember : TOKENS.hairlineStrong }} /> Right now
        </p>
        {data.live.length === 0 ? (
          <p className="t-body-sm" style={{ color: TOKENS.ink2, padding: '14px 16px', background: TOKENS.surface, border: `1px dashed ${TOKENS.hairlineStrong}`, borderRadius: 12 }}>
            Nobody is on your site or reading a document this minute. You'll get a notification the moment someone starts.
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {data.live.map((l) => (
              <motion.button
                key={l.lead_id}
                initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                onClick={() => navigate(`/app/leads/${l.lead_id}`)}
                className="text-left"
                style={{ background: 'linear-gradient(135deg, #7C5CFF 0%, #5B3DF5 100%)', color: '#FAFAF9', borderRadius: 12, padding: '14px 16px', border: '1px solid rgba(245,158,11,0.35)' }}
              >
                <div className="flex items-center" style={{ gap: 10 }}>
                  <Avatar first={l.first_name} last={l.last_name} size={32} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate" style={{ fontWeight: 600 }}>{l.first_name} {l.last_name}</span>
                    <span className="block mono" style={{ fontSize: 11, color: '#A8A29E' }}>{fmtSecs(l.total_seconds)} this session</span>
                  </span>
                  <span className="heat-dot heat-live" style={{ background: TOKENS.ember }} />
                </div>
                <p className="flex items-center t-body-sm" style={{ gap: 6, marginTop: 10, color: '#D6D3D1' }}>
                  {l.channel === 'document' ? <FileText size={13} /> : <Globe size={13} />}
                  <span className="truncate">{l.channel === 'document' ? `Reading ${l.looking_at || 'a document'}${l.page ? ` · page ${l.page}` : ''}` : l.looking_at || 'Browsing your site'}</span>
                </p>
              </motion.button>
            ))}
          </div>
        )}
      </section>

      <div className="grid gap-5 lg:grid-cols-[1.25fr_1fr]">
        {/* Hottest */}
        <section>
          <p className="meta-label" style={{ marginBottom: 10 }}>Hottest open leads</p>
          {data.hottest.length === 0 ? (
            <div className="row-list"><EmptyState icon={<Activity size={22} />} title="No signals yet." body="Share a tracked document or install the website script — interest builds from what people actually do." /></div>
          ) : (
            <div className="row-list">
              {data.hottest.map((l, i) => (
                <button key={l.id} onClick={() => navigate(`/app/leads/${l.id}`)} className="row-card text-left">
                  <span className="mono" style={{ width: 18, color: TOKENS.ink3, fontSize: 12 }}>{i + 1}</span>
                  <Avatar first={l.first_name} last={l.last_name} size={32} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate" style={{ fontWeight: 600, fontSize: 14 }}>{l.first_name} {l.last_name}</span>
                    {l.next_action
                      ? <span className="flex items-center t-body-sm truncate" style={{ gap: 5, color: TOKENS.ink2 }}><Sparkles size={11} style={{ color: TOKENS.accentDeep, flexShrink: 0 }} /> <span className="truncate">{l.next_action}</span></span>
                      : <span className="block t-body-sm" style={{ color: TOKENS.ink3 }}>last active {ago(l.last_engaged_at)}</span>}
                  </span>
                  <InterestChip score={l.score} temperature={l.temperature} />
                </button>
              ))}
            </div>
          )}
        </section>

        {/* Recent */}
        <section>
          <p className="meta-label" style={{ marginBottom: 10 }}>Recent reading & visits</p>
          <div className="row-list">
            {data.recent.length === 0 && <p className="t-body-sm" style={{ color: TOKENS.ink2, padding: 16 }}>Nothing recorded yet.</p>}
            {data.recent.map((s) => (
              <button key={s.id} onClick={() => s.lead_id && navigate(`/app/leads/${s.lead_id}`)} className="row-card text-left" style={{ minHeight: 52 }}>
                <span className="flex items-center justify-center" style={{ width: 28, height: 28, borderRadius: 7, background: s.channel === 'document' ? '#FFE8D2' : TOKENS.sky, color: s.channel === 'document' ? TOKENS.peachDeep : TOKENS.skyDeep, flexShrink: 0 }}>
                  {s.channel === 'document' ? <FileText size={14} /> : <Globe size={14} />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate" style={{ fontSize: 13.5, fontWeight: 600 }}>{s.lead_id ? `${s.first_name || ''} ${s.last_name || ''}`.trim() : 'Anonymous visitor'}</span>
                  <span className="block t-body-sm truncate" style={{ color: TOKENS.ink2 }}>{s.top_view || (s.channel === 'document' ? 'Document' : 'Website')}</span>
                </span>
                <span className="text-right">
                  <span className="block mono" style={{ fontSize: 12.5 }}>{fmtSecs(s.total_seconds)}</span>
                  <span className="block mono" style={{ fontSize: 11, color: TOKENS.ink3 }}>{ago(s.last_seen_at)}</span>
                </span>
              </button>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

function InstallCard({ snippet }) {
  return (
    <div className="flex flex-col md:flex-row md:items-center" style={{ gap: 16, background: TOKENS.surface, border: `1px solid ${TOKENS.hairline}`, borderRadius: 12, padding: '16px 18px' }}>
      <div className="flex-1 min-w-0">
        <p style={{ fontWeight: 600 }}>Add one line to your website to see visits and time on page</p>
        <p className="t-body-sm" style={{ color: TOKENS.ink2, marginTop: 2 }}>Paste it before <span className="mono">&lt;/body&gt;</span> (WordPress: Appearance → Theme File Editor, or any "header & footer scripts" plugin). Leads are recognised when they fill a form or open a tracked link.</p>
        <code className="mono block truncate" style={{ marginTop: 10, background: TOKENS.canvas, border: `1px solid ${TOKENS.hairline}`, borderRadius: 8, padding: '8px 10px', fontSize: 12 }}>{snippet}</code>
      </div>
      <button onClick={() => { navigator.clipboard.writeText(snippet); toast.success('Snippet copied'); }} className="btn btn-primary flex-shrink-0"><Copy size={14} /> Copy snippet</button>
    </div>
  );
}
