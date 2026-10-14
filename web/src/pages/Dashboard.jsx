import { useState, useEffect, lazy, Suspense } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { UserPlus, Facebook, MessageCircle, Upload, Flame, CalendarClock, Inbox, ChevronRight } from 'lucide-react';
import API from '../lib/api';
import useAuthStore from '../stores/authStore';
import { ContactButtons, StatusCell, Clay, Tilt, Helper, formatWait, useNow } from '../components/ui';
import { CssClay } from '../components/three/ClayScene';

const ClayScene = lazy(() => import('../components/three/ClayScene'));

/* ═══════════════════════════════════════════════════════════════
   HOME — "what should I do right now?"
   1. Welcome + three numbers that matter today (3D scene alongside)
   2. Do these now: new leads waiting + follow-ups due, one tap to contact
   3. Pipeline at a glance (colour columns), hot leads, quick starts
   ═══════════════════════════════════════════════════════════════ */

const STAGES = ['new', 'contacted', 'interested', 'negotiating', 'won', 'lost'];

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

export default function Dashboard() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const now = useNow(60000);
  const [waiting, setWaiting] = useState({ total: 0, leads: [] });
  const [followUps, setFollowUps] = useState([]);
  const [pipeline, setPipeline] = useState({});
  const [hot, setHot] = useState([]);
  const [tip, setTip] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      await Promise.all([
        API.get('/leads', { params: { stage: 'new', sort: 'oldest', limit: 6 } })
          .then((r) => setWaiting({ total: r.data.pagination?.total || 0, leads: r.data.leads || [] })).catch(() => {}),
        API.get('/follow-ups', { params: { status: 'pending' } })
          .then((r) => setFollowUps((r.data.followUps || []).filter((f) => new Date(f.due_date) <= endOfToday()))).catch(() => {}),
        Promise.all(STAGES.map((s) => API.get('/leads', { params: { stage: s, limit: 1 } }).then((r) => [s, r.data.pagination?.total || 0]).catch(() => [s, 0])))
          .then((pairs) => setPipeline(Object.fromEntries(pairs))),
        API.get('/analytics/interest-board').then((r) => setHot((r.data.hottest || []).slice(0, 5))).catch(() => {}),
      ]);
      setLoading(false);
      // The AI tip can take a few seconds; it fills in when ready.
      API.get('/analytics/ai-insight').then((r) => setTip((r.data.insights || [])[0] || null)).catch(() => {});
    })();
  }, []);

  const totalLeads = Object.values(pipeline).reduce((a, b) => a + b, 0);
  const todo = [
    ...followUps.map((f) => ({
      key: `f-${f.id}`, id: f.lead_id, name: `${f.first_name || ''} ${f.last_name || ''}`.trim() || 'Unnamed lead', phone: f.phone,
      why: `${labelType(f.type)} ${new Date(f.due_date) < new Date(now) ? 'overdue' : 'due today'}${f.title ? ` · ${f.title}` : ''}`,
      tone: new Date(f.due_date) < new Date(now) ? 'amber' : 'teal', when: new Date(f.due_date),
    })),
    ...waiting.leads.map((l) => ({
      key: `l-${l.id}`, id: l.id, name: `${l.first_name || ''} ${l.last_name || ''}`.trim() || 'Unnamed lead', phone: l.phone, email: l.email,
      why: `New lead from ${prettySource(l.lead_source)} · waiting ${formatWait((now - new Date(l.created_at).getTime()) / 60000)}`,
      tone: 'sun', when: new Date(l.created_at),
    })),
  ].sort((a, b) => a.when - b.when).slice(0, 8);

  return (
    <div className="flex flex-col" style={{ gap: 22 }}>
      {/* ── 1. Welcome ── */}
      <section className="card relative overflow-hidden" style={{ padding: 0, background: 'linear-gradient(120deg, #FFFFFF 0%, #FAFAF9 55%, #F5F2FF 100%)' }}>
        <div className="grid items-center" style={{ gridTemplateColumns: 'minmax(0, 1.25fr) minmax(0, 1fr)' }}>
          <div style={{ padding: '30px 32px', position: 'relative', zIndex: 1 }}>
            <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--brand-deep)' }}>{greeting()}, {user?.firstName || 'there'} 👋</p>
            <h1 className="t-display" style={{ fontSize: 34, marginTop: 6 }}>
              {loading ? 'Loading your day…' : todo.length ? `You have ${todo.length} thing${todo.length === 1 ? '' : 's'} to do today` : 'You’re all caught up!'}
            </h1>
            <p style={{ color: 'var(--ink-2)', marginTop: 8, maxWidth: 460 }}>
              Contact new leads quickly. Most people buy from whoever replies first.
            </p>
            <div className="grid" style={{ gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 12, marginTop: 22, maxWidth: 520 }}>
              <BigNumber icon={Inbox} tone="sun" value={waiting.total} label="New leads waiting" onClick={() => navigate('/app/leads?tab=uncontacted')} />
              <BigNumber icon={CalendarClock} tone="violet" value={followUps.length} label="Follow-ups today" onClick={() => navigate('/app/leads?tab=follow_ups')} />
              <BigNumber icon={Flame} tone="peach" value={hot.length} label="Hot leads" onClick={() => navigate('/app/engagement')} />
            </div>
          </div>
          <div className="hidden md:block" style={{ height: 300 }}>
            <Suspense fallback={<CssClay style={{ width: '100%', height: '100%' }} />}>
              <ClayScene variant="home" style={{ width: '100%', height: '100%' }} />
            </Suspense>
          </div>
        </div>
      </section>

      <div className="grid gap-5" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 420px), 1fr))' }}>
        {/* ── 2. Do these now ── */}
        <section className="card" style={{ padding: 0 }}>
          <Header title="Do these now" sub="Oldest first. Tap to call or WhatsApp." action={{ label: 'All leads', to: '/app/leads' }} />
          {loading ? <Skeleton /> : todo.length === 0 ? (
            <Empty emoji="🎉" title="Nothing waiting" body="New leads and follow-ups due today will show up here." />
          ) : (
            <div>
              {todo.map((t, i) => (
                <motion.div key={t.key} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}
                  className="flex items-center cursor-pointer" onClick={() => navigate(`/app/leads/${t.id}`)}
                  style={{ gap: 12, padding: '12px 20px', borderTop: '1px solid var(--hairline)' }}>
                  <span style={{ width: 4, alignSelf: 'stretch', borderRadius: 4, background: t.tone === 'amber' ? 'var(--ember)' : t.tone === 'sun' ? '#FFC940' : 'var(--brand)' }} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate" style={{ fontWeight: 800 }}>{t.name}</p>
                    <p className="truncate" style={{ fontSize: 13, color: t.tone === 'amber' ? '#8A5A00' : 'var(--ink-2)' }}>{t.why}</p>
                  </div>
                  <ContactButtons compact phone={t.phone} email={t.email} />
                </motion.div>
              ))}
            </div>
          )}
        </section>

        {/* ── 3. Pipeline ── */}
        <section className="card" style={{ padding: 0 }}>
          <Header title="Your pipeline" sub={`${totalLeads} lead${totalLeads === 1 ? '' : 's'} in total`} action={{ label: 'Open board', to: '/app/leads' }} />
          <div style={{ padding: '6px 20px 20px' }}>
            {STAGES.map((s) => {
              const n = pipeline[s] || 0;
              const pct = totalLeads ? Math.max(n ? 4 : 0, Math.round((n / totalLeads) * 100)) : 0;
              return (
                <button key={s} onClick={() => navigate(`/app/leads?stage=${s}`)} className="w-full flex items-center text-left" style={{ gap: 14, padding: '8px 0' }}>
                  <StatusCell stage={s} style={{ minWidth: 120 }} />
                  <span className="flex-1" style={{ height: 12, background: 'var(--canvas-alt)', borderRadius: 999, overflow: 'hidden' }}>
                    <motion.span initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                      className={`st-${s}`} style={{ display: 'block', height: '100%', borderRadius: 999 }} />
                  </span>
                  <span style={{ width: 36, textAlign: 'right', fontWeight: 800 }}>{n}</span>
                </button>
              );
            })}
          </div>
        </section>
      </div>

      <div className="grid gap-5" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 420px), 1fr))' }}>
        {/* ── 4. Hot leads ── */}
        <section className="card" style={{ padding: 0 }}>
          <Header title="🔥 Hot leads" sub="Reading your brochure or visiting your website" action={{ label: 'See all', to: '/app/engagement' }} />
          {loading ? <Skeleton /> : hot.length === 0 ? (
            <Empty emoji="👀" title="No hot leads yet" body="Send a brochure from Files or add the tracking code to your website. Flazyn will tell you who’s interested." />
          ) : hot.map((l) => (
            <div key={l.id} className="flex items-center cursor-pointer" onClick={() => navigate(`/app/leads/${l.id}`)} style={{ gap: 12, padding: '12px 20px', borderTop: '1px solid var(--hairline)' }}>
              <ScoreRing score={Number(l.score) || 0} />
              <div className="min-w-0 flex-1">
                <p className="truncate" style={{ fontWeight: 800 }}>{`${l.first_name || ''} ${l.last_name || ''}`.trim() || 'Unnamed lead'}</p>
                <p className="truncate" style={{ fontSize: 13, color: 'var(--ink-2)' }}>{l.next_action || 'Showing strong interest'}</p>
              </div>
              <ContactButtons compact phone={l.phone} />
            </div>
          ))}
        </section>

        {/* ── 5. Quick starts + tip ── */}
        <section className="flex flex-col" style={{ gap: 16 }}>
          <div className="grid" style={{ gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 14 }}>
            <QuickTile icon={UserPlus} tone="sky" title="Add a lead" body="Type in someone who called you" onClick={() => navigate('/app/leads?new=true')} />
            <QuickTile icon={Facebook} tone="violet" title="Get leads from ads" body="Facebook, Google, TikTok…" onClick={() => navigate('/app/automations')} />
            <QuickTile icon={MessageCircle} tone="mint" title="Auto-reply on WhatsApp" body="Greet every new enquiry" onClick={() => navigate('/app/automations/whatsapp-auto-responder')} />
            <QuickTile icon={Upload} tone="sun" title="Import a list" body="Bring leads from a spreadsheet" onClick={() => navigate('/app/leads?import=true')} />
          </div>
          {tip && (
            <Helper icon="✨">
              <p style={{ fontWeight: 800, color: 'var(--ink)' }}>{tip.title}</p>
              <p>{tip.text}</p>
            </Helper>
          )}
        </section>
      </div>
    </div>
  );
}

function endOfToday() {
  const d = new Date();
  d.setHours(23, 59, 59, 999);
  return d;
}

const TYPE_LABEL = { call: 'Call', whatsapp: 'WhatsApp', email: 'Email', sms: 'SMS', meeting: 'Meeting', visit: 'Site visit' };
const labelType = (t) => TYPE_LABEL[t] || 'Follow-up';
const prettySource = (s) => ({ facebook: 'Facebook', google_ads: 'Google Ads', tiktok: 'TikTok', linkedin: 'LinkedIn', whatsapp: 'WhatsApp', website: 'your website', lead_form: 'a lead form', manual: 'manual entry', import: 'an import', wordpress: 'WordPress' }[s] || (s ? s.replace(/_/g, ' ') : 'somewhere'));

function BigNumber({ icon, tone, value, label, onClick }) {
  return (
    <Tilt>
      <button onClick={onClick} className="w-full text-left" style={{ background: '#FFFFFF', border: '1px solid var(--hairline)', borderRadius: 14, padding: '14px 14px 12px', boxShadow: 'var(--sh-card)' }}>
        <Clay icon={icon} tone={tone} size="sm" className="tilt-pop" />
        <p style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1.1, marginTop: 10 }}>{value}</p>
        <p style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--ink-2)' }}>{label}</p>
      </button>
    </Tilt>
  );
}

function Header({ title, sub, action }) {
  const navigate = useNavigate();
  return (
    <div className="flex items-start justify-between" style={{ padding: '18px 20px 12px', gap: 12 }}>
      <div>
        <h2 style={{ fontSize: 17, fontWeight: 800 }}>{title}</h2>
        {sub && <p style={{ fontSize: 13, color: 'var(--ink-3)', marginTop: 2 }}>{sub}</p>}
      </div>
      {action && (
        <button onClick={() => navigate(action.to)} className="flex items-center flex-shrink-0" style={{ fontSize: 13, fontWeight: 800, color: 'var(--brand-deep)', gap: 2 }}>
          {action.label} <ChevronRight size={15} />
        </button>
      )}
    </div>
  );
}

function QuickTile({ icon, tone, title, body, onClick }) {
  return (
    <Tilt>
      <button onClick={onClick} className="card card-hover w-full h-full text-left" style={{ padding: 18 }}>
        <Clay icon={icon} tone={tone} className="tilt-pop" />
        <p style={{ fontWeight: 800, marginTop: 12 }}>{title}</p>
        <p style={{ fontSize: 13, color: 'var(--ink-2)', marginTop: 2 }}>{body}</p>
      </button>
    </Tilt>
  );
}

function ScoreRing({ score }) {
  const pct = Math.min(100, Math.max(0, score));
  const color = pct >= 70 ? '#F59E0B' : pct >= 40 ? '#5B3DF5' : '#98A2B3';
  return (
    <span className="flex items-center justify-center flex-shrink-0" title={`Interest ${pct}/100`}
      style={{ width: 42, height: 42, borderRadius: 999, background: `conic-gradient(${color} ${pct * 3.6}deg, var(--canvas-alt) 0)` }}>
      <span className="flex items-center justify-center" style={{ width: 32, height: 32, borderRadius: 999, background: '#fff', fontSize: 12, fontWeight: 800 }}>{pct}</span>
    </span>
  );
}

function Empty({ emoji, title, body }) {
  return (
    <div className="text-center" style={{ padding: '30px 24px 34px', borderTop: '1px solid var(--hairline)' }}>
      <p style={{ fontSize: 30 }}>{emoji}</p>
      <p style={{ fontWeight: 800, marginTop: 6 }}>{title}</p>
      <p style={{ fontSize: 13, color: 'var(--ink-2)', marginTop: 4, maxWidth: 360, marginInline: 'auto' }}>{body}</p>
    </div>
  );
}

function Skeleton() {
  return (
    <div style={{ padding: '4px 20px 20px' }} className="flex flex-col gap-2">
      {[0, 1, 2].map((i) => <div key={i} className="skeleton" style={{ height: 52 }} />)}
    </div>
  );
}

