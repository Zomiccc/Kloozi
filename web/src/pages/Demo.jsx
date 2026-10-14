import { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { Plus, X, Zap, Phone, MessageCircle, Sparkles, CheckCircle2, ArrowRight, Loader2 } from 'lucide-react';
import API from '../lib/api';
import useAuthStore from '../stores/authStore';
import { useLiveAlerts, chime, enableDesktopAlerts, canNotify } from '../lib/liveAlerts';

/* ═══════════════════════════════════════════════════════════════
   MAGIC LINK DEMO (mobile-first, no signup)
   1. Company, your name, what you sell, your team
   2. "Send me a test lead" → countdown → phone chimes / buzzes
   3. The lead appears: assigned to a teammate, WhatsApp auto-reply
      already sent, the customer replies, the AI coach says what next.
   ═══════════════════════════════════════════════════════════════ */

const INDUSTRIES = [['real_estate', '🏡 Real estate'], ['solar', '☀️ Solar'], ['home_services', '🛠️ Home services'], ['education', '🎓 Education'], ['other', '✨ Something else']];

export default function Demo() {
  const [params] = useSearchParams();
  const [stage, setStage] = useState(() => (localStorage.getItem('flazyn:demo') && localStorage.getItem('accessToken') ? 'live' : 'setup'));
  return (
    <div style={{ minHeight: '100dvh', background: 'linear-gradient(180deg, #FAFAF9 0%, #F3F0FF 100%)', display: 'flex', justifyContent: 'center' }}>
      <div style={{ width: '100%', maxWidth: 440, padding: '20px 16px 40px' }}>
        <div className="flex items-center gap-2" style={{ marginBottom: 18 }}>
          <span className="flex items-center justify-center" style={{ width: 30, height: 30, borderRadius: 9, background: 'linear-gradient(135deg, #7C5CFF 0%, #5B3DF5 55%, #E255C9 130%)', color: '#fff', fontWeight: 800 }}>F</span>
          <span style={{ fontWeight: 700, fontSize: 17 }}>Flazyn</span>
          <span className="badge" style={{ marginLeft: 'auto' }}>Live demo</span>
        </div>
        {stage === 'setup' ? <Setup refCode={params.get('ref')} onStarted={() => setStage('live')} /> : <Live onReset={() => { localStorage.removeItem('flazyn:demo'); setStage('setup'); }} />}
      </div>
    </div>
  );
}

function Setup({ refCode, onStarted }) {
  const [company, setCompany] = useState('');
  const [yourName, setYourName] = useState('');
  const [industry, setIndustry] = useState('real_estate');
  const [members, setMembers] = useState(['', '']);
  const [busy, setBusy] = useState(false);
  const start = async () => {
    setBusy(true);
    try {
      const r = await API.post('/demo/start', { company, your_name: yourName, industry, members: members.filter((m) => m.trim()), ref: refCode });
      localStorage.setItem('accessToken', r.data.accessToken);
      localStorage.setItem('refreshToken', r.data.refreshToken);
      localStorage.setItem('workspaceId', r.data.user.workspaceId);
      localStorage.setItem('flazyn:demo', '1');
      useAuthStore.setState({ user: r.data.user, isAuthenticated: true });
      onStarted();
    } catch (err) { toast.error(err.response?.data?.error || 'Could not start the demo'); }
    finally { setBusy(false); }
  };
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
      <h1 style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1.15 }}>See your next lead arrive, live, in 60 seconds.</h1>
      <p style={{ color: 'var(--ink-2)', marginTop: 8 }}>No sign-up. Nothing is sent to anyone. This private demo deletes itself tomorrow.</p>
      <div className="card mt-5" style={{ padding: 18 }}>
        <label className="meta-label">Your business name</label>
        <input className="input mt-1" value={company} onChange={(e) => setCompany(e.target.value)} placeholder="e.g. Harbour Homes" />
        <label className="meta-label mt-3 block">Your name</label>
        <input className="input mt-1" value={yourName} onChange={(e) => setYourName(e.target.value)} placeholder="e.g. Sarah" />
        <label className="meta-label mt-3 block">What do you sell?</label>
        <div className="flex flex-wrap gap-2 mt-1">
          {INDUSTRIES.map(([k, l]) => <button key={k} onClick={() => setIndustry(k)} className={`chip ${industry === k ? 'chip-active' : ''}`} style={{ textTransform: 'none' }}>{l}</button>)}
        </div>
        <label className="meta-label mt-3 block">Your team (they’ll get the leads)</label>
        {members.map((m, i) => (
          <div key={i} className="flex gap-2 mt-1">
            <input className="input" value={m} onChange={(e) => setMembers(members.map((x, j) => (j === i ? e.target.value : x)))} placeholder={['e.g. Ali', 'e.g. Priya', 'e.g. Tom', 'Team member', 'Team member'][i]} />
            {members.length > 1 && <button onClick={() => setMembers(members.filter((_, j) => j !== i))} className="row-action"><X size={16} /></button>}
          </div>
        ))}
        {members.length < 5 && <button onClick={() => setMembers([...members, ''])} className="flex items-center gap-1 mt-2" style={{ fontSize: 13, fontWeight: 600, color: 'var(--brand)' }}><Plus size={14} /> Add someone</button>}
        <button onClick={start} disabled={busy} className="btn btn-primary w-full mt-5" style={{ height: 48, fontSize: 15 }}>
          {busy ? <Loader2 size={18} className="animate-spin" /> : <>Start my demo <ArrowRight size={17} /></>}
        </button>
      </div>
    </motion.div>
  );
}

function Live({ onReset }) {
  const navigate = useNavigate();
  const [me, setMe] = useState(null);
  const [phase, setPhase] = useState('ready'); // ready | waiting | arrived
  const [count, setCount] = useState(0);
  const [lead, setLead] = useState(null);
  const [msgs, setMsgs] = useState([]);
  const [coach, setCoach] = useState(null);
  const [alertsOn, setAlertsOn] = useState(canNotify() && Notification.permission === 'granted');
  const knownIds = useRef(new Set());
  const arrivedAt = useRef(0);

  useEffect(() => {
    API.get('/demo/me').then((r) => { if (!r.data.demo) onReset(); else setMe(r.data); }).catch(() => onReset());
    API.get('/leads', { params: { limit: 50 } }).then((r) => (r.data.leads || []).forEach((l) => knownIds.current.add(l.id))).catch(() => {});
  }, []); // eslint-disable-line
  useLiveAlerts(useCallback(() => {}, []));

  const send = async () => {
    chime(); // unlocks sound on phones (needs a tap)
    try {
      const r = await API.post('/demo/lead');
      setPhase('waiting'); setLead(null); setMsgs([]); setCoach(null);
      setCount(r.data.eta_seconds);
    } catch (err) { toast.error(err.response?.data?.error || 'Could not send a test lead'); }
  };

  // countdown + watch for the lead
  useEffect(() => {
    if (phase !== 'waiting') return undefined;
    const t = setInterval(async () => {
      setCount((c) => Math.max(0, c - 1));
      try {
        const r = await API.get('/leads', { params: { limit: 5 } });
        const fresh = (r.data.leads || []).find((l) => !knownIds.current.has(l.id));
        if (fresh) {
          knownIds.current.add(fresh.id);
          arrivedAt.current = Date.now();
          setLead(fresh); setPhase('arrived');
          if (navigator.vibrate) navigator.vibrate([220, 90, 220, 90, 320]);
          chime();
        }
      } catch { /* keep waiting */ }
    }, 1000);
    return () => clearInterval(t);
  }, [phase]);

  // after arrival: live conversation + AI coach
  useEffect(() => {
    if (phase !== 'arrived' || !lead) return undefined;
    const tick = async () => {
      try {
        const r = await API.get('/whatsapp/inbox', { params: { lead_id: lead.id } });
        const list = (r.data.messages || []).slice().sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
        setMsgs((prev) => {
          if (list.length > prev.length && prev.length && list[list.length - 1].direction === 'inbound' && navigator.vibrate) navigator.vibrate(160);
          return list;
        });
        if (list.filter((m) => m.direction === 'inbound').length >= 2 && !coach) {
          const c = await API.get(`/intel/leads/${lead.id}`); setCoach(c.data);
        }
        const fresh = await API.get(`/leads/${lead.id}`); setLead((l) => ({ ...l, ...fresh.data.lead }));
      } catch { /* retry */ }
    };
    tick();
    const t = setInterval(tick, 2000);
    return () => clearInterval(t);
  }, [phase, lead?.id, coach]); // eslint-disable-line

  const agentName = lead?.agent_first_name;

  return (
    <div>
      <h1 style={{ fontSize: 24, fontWeight: 800, letterSpacing: '-0.02em' }}>{me?.company || 'Your'} × Flazyn</h1>
      {me?.team?.length > 0 && <p style={{ color: 'var(--ink-2)', fontSize: 13.5, marginTop: 2 }}>Team: {me.team.join(', ')}</p>}

      {!alertsOn && canNotify() && (
        <button onClick={async () => setAlertsOn((await enableDesktopAlerts()) === 'granted')} className="helper w-full text-left mt-4" style={{ cursor: 'pointer' }}>
          <span>🔔</span><div><b>Let Flazyn alert this phone</b><br />So you feel it the moment a lead comes in.</div>
        </button>
      )}

      <AnimatePresence mode="wait">
        {phase === 'ready' && (
          <motion.div key="ready" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="card text-center mt-4" style={{ padding: 24 }}>
            <p style={{ fontSize: 15, color: 'var(--ink-2)' }}>Imagine someone just filled in your Facebook ad form.</p>
            <button onClick={send} className="btn btn-primary w-full mt-4" style={{ height: 56, fontSize: 16, borderRadius: 14 }}><Zap size={19} /> Send me a test lead</button>
          </motion.div>
        )}
        {phase === 'waiting' && (
          <motion.div key="waiting" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="card text-center mt-4" style={{ padding: 28 }}>
            <div className="mx-auto flex items-center justify-center" style={{ width: 96, height: 96, borderRadius: 999, background: `conic-gradient(#5B3DF5 ${(1 - count / 9) * 360}deg, #EDE9FF 0)` }}>
              <span className="flex items-center justify-center" style={{ width: 80, height: 80, borderRadius: 999, background: '#fff', fontSize: 30, fontWeight: 800 }}>{count}</span>
            </div>
            <p style={{ fontWeight: 700, marginTop: 14 }}>A customer is filling in your ad form…</p>
            <p style={{ fontSize: 13, color: 'var(--ink-3)', marginTop: 4 }}>Keep your phone in your hand 👀</p>
          </motion.div>
        )}
        {phase === 'arrived' && lead && (
          <motion.div key="arrived" initial={{ opacity: 0, y: 16, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ type: 'spring', stiffness: 260, damping: 22 }} className="mt-4 flex flex-col gap-3">
            <div className="card" style={{ padding: 18, borderColor: '#DDD6FE', boxShadow: '0 0 0 4px rgba(91,61,245,0.08)' }}>
              <p className="eyebrow">⚡ New lead · just now</p>
              <p style={{ fontSize: 20, fontWeight: 800, marginTop: 6 }}>{lead.first_name} {lead.last_name}</p>
              <p style={{ fontSize: 13.5, color: 'var(--ink-2)' }}>Facebook ad · {lead.city}{Number(lead.budget) ? ` · budget $${Number(lead.budget).toLocaleString('en-AU')}` : ''}</p>
              <div className="flex flex-col gap-1.5 mt-3" style={{ fontSize: 13.5 }}>
                <Done>Added to your pipeline instantly</Done>
                {agentName && <Done>Assigned to <b>{agentName}</b> (their phone got the alert too)</Done>}
                {msgs.some((m) => m.direction !== 'inbound') && <Done>WhatsApp auto-reply sent in 1 second</Done>}
              </div>
              <div className="grid grid-cols-2 gap-2 mt-4">
                <span className="tap tap-call" style={{ justifyContent: 'center' }}><Phone size={16} /> Call</span>
                <span className="tap tap-wa" style={{ justifyContent: 'center' }}><MessageCircle size={16} /> WhatsApp</span>
              </div>
            </div>

            <div className="card" style={{ padding: 14, background: '#ECE5DD' }}>
              <p style={{ fontSize: 12, color: '#57534E', textAlign: 'center', marginBottom: 8 }}>WhatsApp with {lead.first_name}</p>
              <div className="flex flex-col gap-2">
                {msgs.map((m) => (
                  <motion.div key={m.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                    style={{ alignSelf: m.direction === 'inbound' ? 'flex-start' : 'flex-end', maxWidth: '85%', background: m.direction === 'inbound' ? '#fff' : '#DCF8C6', padding: '8px 11px', borderRadius: 10, fontSize: 13.5, boxShadow: '0 1px 1px rgba(0,0,0,0.08)' }}>
                    {m.message_text}
                    {m.direction !== 'inbound' && <span style={{ display: 'block', fontSize: 10.5, color: '#78716C', textAlign: 'right' }}>Auto-reply · Flazyn</span>}
                  </motion.div>
                ))}
                {msgs.filter((m) => m.direction === 'inbound').length < 2 && <p style={{ fontSize: 12, color: '#78716C', alignSelf: 'flex-start' }}>{lead.first_name} is typing…</p>}
              </div>
            </div>

            {coach && (
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="card" style={{ padding: 16 }}>
                <p className="eyebrow flex items-center gap-1.5"><Sparkles size={13} /> Flazyn AI · next best action</p>
                <p style={{ fontWeight: 700, fontSize: 16, marginTop: 6 }}>{coach.next_best_action?.action}</p>
                <p style={{ fontSize: 13, color: 'var(--ink-2)' }}>{(coach.next_best_action?.why || []).join(' · ')}</p>
                {coach.objections?.[0] && (
                  <div className="stat-tile mt-3"><p className="label">They asked about {coach.objections[0].label.toLowerCase()}. Suggested reply:</p><p style={{ fontSize: 13.5, marginTop: 4 }}>“{coach.objections[0].counter}”</p></div>
                )}
              </motion.div>
            )}

            <div className="flex flex-col gap-2 mt-1">
              <button onClick={send} className="btn btn-secondary w-full"><Zap size={16} /> Send another lead</button>
              <button onClick={() => navigate('/app/leads')} className="btn btn-secondary w-full">See it in the full Flazyn app</button>
              <button onClick={() => navigate('/signup')} className="btn btn-primary w-full" style={{ height: 50 }}>Start my free trial <ArrowRight size={17} /></button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <button onClick={onReset} style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 18, display: 'block', marginInline: 'auto' }}>Start over</button>
    </div>
  );
}

function Done({ children }) {
  return <span className="flex items-start gap-2"><CheckCircle2 size={16} style={{ color: '#10B981', flexShrink: 0, marginTop: 2 }} /><span>{children}</span></span>;
}
