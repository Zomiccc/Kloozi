import { useEffect, useState, useCallback } from 'react';
import toast from 'react-hot-toast';
import { Sparkles, RefreshCw, Phone, MessageCircle, Mail, AlertTriangle, Clock, User, Smile, Meh, Frown, DollarSign, Swords, Undo2, FileSearch } from 'lucide-react';
import API from '../lib/api';

/* ═══════════════════════════════════════════════════════════════
   AI COACH — everything Flazyn has worked out about one lead:
   next best action, deal risk, going-quiet warning, how they like
   to talk, mood, best time to message, likely deal size, competitor
   and objection alerts, comeback signals and (if lost) an autopsy.
   ═══════════════════════════════════════════════════════════════ */

const CH_ICON = { call: Phone, whatsapp: MessageCircle, email: Mail, sms: MessageCircle };
const money = (n) => (n || n === 0 ? `$${Math.round(n).toLocaleString('en-AU')}` : '—');

export default function IntelPanel({ lead, onWhatsApp, onRefreshLead }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [autopsy, setAutopsy] = useState(null);
  const [dealValue, setDealValue] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try { const r = await API.get(`/intel/leads/${lead.id}`); setData(r.data); } catch { /* panel stays quiet */ }
    finally { setLoading(false); }
  }, [lead.id]);
  useEffect(() => { load(); }, [load, lead.stage]);
  useEffect(() => { setDealValue(lead.deal_value || ''); }, [lead.deal_value]);

  const runAutopsy = async () => {
    try { const r = await API.post(`/intel/leads/${lead.id}/autopsy`); setAutopsy(r.data); } catch { toast.error('Could not run the autopsy'); }
  };
  const saveDealValue = async () => {
    try { await API.put(`/intel/leads/${lead.id}/deal-value`, { deal_value: Number(dealValue) }); toast.success('Deal value saved'); onRefreshLead?.(); }
    catch (err) { toast.error(err.response?.data?.error || 'Could not save'); }
  };

  if (loading && !data) return <div className="card" style={{ padding: 18 }}><div className="skeleton" style={{ height: 120 }} /></div>;
  if (!data) return null;
  const nba = data.next_best_action || {};
  const Icon = CH_ICON[nba.channel] || Sparkles;
  const doAction = () => {
    if (nba.channel === 'call' && lead.phone) window.location.href = `tel:${lead.phone}`;
    else if (nba.channel === 'whatsapp') onWhatsApp?.();
    else if (nba.channel === 'email' && lead.email) window.location.href = `mailto:${lead.email}`;
    else if (nba.channel === 'sms' && lead.phone) window.location.href = `sms:${lead.phone}`;
  };
  const risk = data.deal_risk || {};
  const ghost = data.ghost || {};
  const sent = data.sentiment || {};
  const SentIcon = sent.label === 'positive' ? Smile : sent.label === 'negative' ? Frown : Meh;
  const isLost = String(lead.stage).toLowerCase() === 'lost';
  const isWon = String(lead.stage).toLowerCase() === 'won';

  return (
    <div className="flex flex-col gap-4">
      {/* 1. Next best action */}
      <div className="card" style={{ padding: 18 }}>
        <div className="flex items-center justify-between">
          <p className="eyebrow flex items-center gap-1.5"><Sparkles size={13} /> Next best action</p>
          <button onClick={load} title="Recalculate" className="row-action"><RefreshCw size={14} className={loading ? 'animate-spin' : ''} /></button>
        </div>
        <p style={{ fontSize: 17, fontWeight: 700, marginTop: 8 }}>{nba.action}{nba.when && nba.when !== 'now' ? <span style={{ fontWeight: 500, color: 'var(--ink-2)', fontSize: 14 }}> · {nba.when}</span> : null}</p>
        <ul style={{ marginTop: 6 }}>{(nba.why || []).map((w) => <li key={w} style={{ fontSize: 13, color: 'var(--ink-2)' }}>• {w}</li>)}</ul>
        {nba.channel && (
          <button onClick={doAction} className="btn btn-primary btn-sm w-full mt-3"><Icon size={15} /> {nba.action}</button>
        )}
        <div className="flex items-center gap-2 mt-3">
          <span style={{ flex: 1, height: 6, borderRadius: 99, background: 'var(--canvas-alt)', overflow: 'hidden' }}>
            <span style={{ display: 'block', height: '100%', width: `${Math.round((nba.confidence || 0) * 100)}%`, background: 'var(--brand)', borderRadius: 99 }} />
          </span>
          <span style={{ fontSize: 11.5, color: 'var(--ink-3)' }}>{Math.round((nba.confidence || 0) * 100)}% sure</span>
        </div>
      </div>

      {/* 7. Comeback signal */}
      {data.reactivation && (
        <div className="card" style={{ padding: 16, background: '#F3F0FF', borderColor: '#DDD6FE' }}>
          <p style={{ fontWeight: 700 }} className="flex items-center gap-2"><Undo2 size={15} /> Showing interest again</p>
          <ul className="mt-1">{data.reactivation.signals.map((s) => <li key={s} style={{ fontSize: 13, color: 'var(--ink-2)' }}>• {s}</li>)}</ul>
        </div>
      )}

      {/* 2 + 10. Deal health */}
      {!isLost && !isWon && (risk.score > 0 || ghost.level === 'high' || ghost.level === 'medium') && (
        <div className="card" style={{ padding: 16, background: risk.level === 'high' || ghost.level === 'high' ? '#FFFBEB' : '#fff', borderColor: risk.level === 'high' || ghost.level === 'high' ? '#FDE68A' : 'var(--hairline)' }}>
          <div className="flex items-center justify-between">
            <p style={{ fontWeight: 700 }} className="flex items-center gap-2"><AlertTriangle size={15} style={{ color: '#D97706' }} /> Deal health</p>
            {risk.score > 0 && <span className="badge" style={{ background: risk.level === 'high' ? '#FEF3C7' : '#F5F5F4', color: risk.level === 'high' ? '#92400E' : 'var(--ink-2)' }}>Risk {risk.score}/100</span>}
          </div>
          <ul className="mt-1">{(risk.reasons || []).map((r) => <li key={r} style={{ fontSize: 13, color: 'var(--ink-2)' }}>• {r}</li>)}</ul>
          {(ghost.level === 'high' || ghost.level === 'medium') && (
            <p style={{ fontSize: 13, marginTop: 8, color: '#92400E', fontWeight: 600 }} className="flex items-start gap-1.5">
              <Clock size={14} style={{ marginTop: 2 }} />
              {ghost.hours_to_cold !== null ? `Likely to go cold in ~${ghost.hours_to_cold}h. ` : ''}{ghost.reasons?.[0]}
            </p>
          )}
        </div>
      )}

      {/* 16 + objections */}
      {(data.competitors?.length > 0 || data.objections?.length > 0) && (
        <div className="card" style={{ padding: 16 }}>
          <p style={{ fontWeight: 700 }} className="flex items-center gap-2"><Swords size={15} /> {data.competitors?.length ? `Mentioned ${data.competitors[0].competitor}` : `Concern: ${data.objections[0].label}`}</p>
          <p style={{ fontSize: 13, color: 'var(--ink-2)', marginTop: 6 }}>{data.competitors?.[0]?.counter || data.objections[0].counter}</p>
          <button onClick={() => { navigator.clipboard.writeText(data.competitors?.[0]?.counter || data.objections[0].counter); toast.success('Copied'); }} className="btn btn-secondary btn-sm mt-2">Copy reply</button>
        </div>
      )}

      {/* 15, 17, 18, 19. About them */}
      <div className="card" style={{ padding: 16 }}>
        <p style={{ fontWeight: 700, marginBottom: 8 }}>About them</p>
        <Row icon={User} label="Style" value={data.personality?.label} hint={data.personality?.tip} />
        <Row icon={SentIcon} label="Mood" value={sent.label === 'unknown' ? 'Not enough messages' : `${sent.label}${sent.trend !== 'flat' ? ` · ${sent.trend}` : ''}`} />
        <Row icon={Clock} label="Best time" value={data.best_time?.label} hint={`Based on ${data.best_time?.basis}`} />
        <Row icon={DollarSign} label="Likely deal" value={data.deal_size?.predicted ? `${money(data.deal_size.low)} – ${money(data.deal_size.high)}` : 'Not enough info'} hint={(data.deal_size?.basis || []).join(' · ')} />
        {isWon && (
          <div className="flex items-center gap-2 mt-3">
            <input className="input" style={{ height: 34 }} type="number" placeholder="Final deal value" value={dealValue} onChange={(e) => setDealValue(e.target.value)} />
            <button onClick={saveDealValue} className="btn btn-secondary btn-sm">Save</button>
          </div>
        )}
        {!data.ai_enabled && <p style={{ fontSize: 11.5, color: 'var(--ink-3)', marginTop: 10 }}>Running on Flazyn's built-in rules. Add an OpenAI key on the server for AI-written replies, briefs and call transcripts.</p>}
      </div>

      {/* 11. Autopsy */}
      {isLost && (
        <div className="card" style={{ padding: 16 }}>
          <p style={{ fontWeight: 700 }} className="flex items-center gap-2"><FileSearch size={15} /> Why was this lost?</p>
          {!autopsy ? (
            <button onClick={runAutopsy} className="btn btn-secondary btn-sm w-full mt-2">Run lost-deal autopsy</button>
          ) : (
            <div className="mt-2" style={{ fontSize: 13 }}>
              <p style={{ fontWeight: 600 }}>{autopsy.verdict}</p>
              {autopsy.turning_point && <p style={{ color: 'var(--ink-2)', marginTop: 4 }}>Turning point: {autopsy.turning_point}</p>}
              {autopsy.lessons?.length > 0 && <><p className="meta-label mt-3">Next time</p><ul>{autopsy.lessons.map((l) => <li key={l} style={{ color: 'var(--ink-2)' }}>• {l}</li>)}</ul></>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Row({ icon: Icon, label, value, hint }) {
  return (
    <div className="flex items-start gap-2.5" style={{ padding: '7px 0', borderTop: '1px solid var(--hairline)' }} title={hint || ''}>
      <Icon size={15} style={{ color: 'var(--ink-3)', marginTop: 2, flexShrink: 0 }} />
      <div className="min-w-0">
        <p style={{ fontSize: 12, color: 'var(--ink-3)' }}>{label}</p>
        <p className="capitalize-first" style={{ fontSize: 13.5, fontWeight: 600 }}>{value || '—'}</p>
        {hint && label === 'Style' && <p style={{ fontSize: 12.5, color: 'var(--ink-2)', marginTop: 2 }}>{hint}</p>}
      </div>
    </div>
  );
}
