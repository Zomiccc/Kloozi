import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { Sparkles, RefreshCw, Copy, MessageSquare, Globe, FileText, Link2 } from 'lucide-react';
import API from '../lib/api';
import { TOKENS, formatWait, useNow } from './ui';

/* ═══════════════════════════════════════════════════════════════
   INTEREST — what this person actually did, and what to do next.
   Score is behaviour-based and every point is shown as evidence.
   ═══════════════════════════════════════════════════════════════ */

const TEMP = {
  hot: { label: 'Hot', color: TOKENS.ember, bg: '#FFE8D2' },
  warm: { label: 'Warm', color: '#C99A1E', bg: '#FFF1C2' },
  lukewarm: { label: 'Lukewarm', color: TOKENS.skyDeep, bg: TOKENS.sky },
  cold: { label: 'Cold', color: TOKENS.ink3, bg: TOKENS.canvasAlt },
};

export function fmtSecs(s) {
  const n = Math.round(Number(s) || 0);
  if (n < 60) return `${n}s`;
  const m = Math.floor(n / 60);
  return m < 60 ? `${m}m ${String(n % 60).padStart(2, '0')}s` : `${Math.floor(m / 60)}h ${m % 60}m`;
}

function Gauge({ score, color }) {
  const r = 52; const c = Math.PI * r; const pct = Math.max(0, Math.min(100, score)) / 100;
  return (
    <svg width="132" height="76" viewBox="0 0 132 76" aria-hidden>
      <path d="M 14 70 A 52 52 0 0 1 118 70" fill="none" stroke={TOKENS.canvasAlt} strokeWidth="10" strokeLinecap="round" />
      <motion.path
        d="M 14 70 A 52 52 0 0 1 118 70" fill="none" stroke={color} strokeWidth="10" strokeLinecap="round"
        strokeDasharray={c} initial={{ strokeDashoffset: c }} animate={{ strokeDashoffset: c * (1 - pct) }}
        transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
      />
    </svg>
  );
}

export default function InterestPanel({ leadId, lead, onScore }) {
  const [data, setData] = useState(null);
  const [brief, setBrief] = useState(null);
  const [aiEnabled, setAiEnabled] = useState(false);
  const [thinking, setThinking] = useState(false);
  const now = useNow(30000);

  const load = async () => {
    try {
      const res = await API.get(`/leads/${leadId}/interest`);
      setData(res.data.interest);
      setBrief(res.data.brief);
      setAiEnabled(res.data.ai_enabled);
      onScore?.(res.data.interest.score, res.data.interest.temperature);
      if (!res.data.brief) askAI(false);
    } catch { toast.error('Could not load interest'); }
  };
  useEffect(() => { load(); const t = setInterval(load, 60000); return () => clearInterval(t); }, [leadId]); // eslint-disable-line

  const askAI = async (force = true) => {
    setThinking(true);
    try {
      const res = await API.post(`/leads/${leadId}/interest/brief`, { force });
      setBrief(res.data.brief);
      setData(res.data.interest);
      setAiEnabled(res.data.ai_enabled);
    } catch { toast.error('Could not generate the brief'); }
    finally { setThinking(false); }
  };

  const copyTrackedLink = async () => {
    try {
      const res = await API.get(`/leads/${leadId}/tracked-link`);
      await navigator.clipboard.writeText(res.data.url);
      toast.success('Tracked link copied — when they open it, their visit shows up here');
    } catch (err) { toast.error(err.response?.data?.error || 'Could not create link'); }
  };

  if (!data) return <div className="skeleton" style={{ height: 220 }} />;
  const t = TEMP[data.temperature] || TEMP.cold;
  const phone = String(lead?.phone || '').replace(/\D/g, '');
  const lastMins = data.last_engaged_at ? (now - new Date(data.last_engaged_at).getTime()) / 60000 : null;
  const positives = data.signals.filter((s) => s.points > 0);

  return (
    <div className="flex flex-col" style={{ gap: 16 }}>
      {/* ── Score + brief ── */}
      <div className="grid gap-4 2xl:grid-cols-[minmax(0,320px)_1fr]">
        <div style={{ background: TOKENS.surface, border: `1px solid ${TOKENS.hairline}`, borderRadius: 12, padding: '20px 22px' }}>
          <div className="flex items-center justify-between">
            <p className="meta-label">Interest</p>
            {data.website.live && (
              <span className="flex items-center mono" style={{ gap: 6, fontSize: 11, color: TOKENS.ember }}>
                <span className="heat-dot heat-live" style={{ background: TOKENS.ember }} /> on your site now
              </span>
            )}
          </div>
          <div className="flex items-end" style={{ gap: 14, marginTop: 8 }}>
            <div className="relative" style={{ width: 132, height: 76 }}>
              <Gauge score={data.score} color={t.color} />
              <span className="serif absolute" style={{ left: 0, right: 0, bottom: -2, textAlign: 'center', fontSize: 40, lineHeight: 1 }}>{data.score}</span>
            </div>
            <div style={{ paddingBottom: 4 }}>
              <span style={{ background: t.bg, color: t.color, borderRadius: 6, padding: '2px 8px', fontSize: 12, fontWeight: 600 }}>{t.label}</span>
              <p className="mono" style={{ fontSize: 11.5, color: TOKENS.ink3, marginTop: 8 }}>
                {lastMins === null ? 'no activity yet' : `last active ${formatWait(lastMins)} ago`}
              </p>
            </div>
          </div>
          <div className="grid grid-cols-3" style={{ marginTop: 18, borderTop: `1px solid ${TOKENS.hairline}`, paddingTop: 12 }}>
            {[
              ['Site', fmtSecs(data.website.seconds)],
              ['Docs', fmtSecs(data.documents.reduce((a, d) => a + d.seconds, 0))],
              ['Replies', String((data.whatsapp.inbound || 0) + (data.email.replies || 0))],
            ].map(([k, v]) => (
              <div key={k}>
                <p className="meta-label">{k}</p>
                <p className="mono" style={{ fontSize: 14, marginTop: 2 }}>{v}</p>
              </div>
            ))}
          </div>
          <button onClick={copyTrackedLink} className="btn btn-secondary btn-sm w-full" style={{ marginTop: 16 }}>
            <Link2 size={13} /> Copy tracked website link
          </button>
        </div>

        <div style={{ background: '#FFFFFF', color: 'var(--ink)', border: '1px solid var(--hairline)', borderRadius: 14, padding: '18px 20px', boxShadow: '0 1px 2px rgba(28,25,23,0.04)' }}>
          <div className="flex items-center justify-between" style={{ gap: 12 }}>
            <p className="eyebrow flex items-center" style={{ gap: 6 }}>
              <Sparkles size={13} />
              Interest brief
              {brief?.generated_at && <span style={{ color: 'var(--ink-3)', fontWeight: 500, textTransform: 'none', letterSpacing: 0 }}>· {(() => { const w = formatWait((now - new Date(brief.generated_at).getTime()) / 60000); return w === 'now' ? 'just now' : `${w} ago`; })()}</span>}
            </p>
            <button onClick={() => askAI(true)} disabled={thinking} className="flex items-center" style={{ gap: 6, fontSize: 12.5, fontWeight: 600, color: 'var(--ink-2)' }}>
              <RefreshCw size={12} className={thinking ? 'animate-spin' : ''} /> {thinking ? 'thinking…' : 'refresh'}
            </button>
          </div>
          {!brief ? (
            <p style={{ marginTop: 14, color: 'var(--ink-3)' }}>{thinking ? 'Reading their behaviour…' : 'No brief yet.'}</p>
          ) : (
            <>
              <p style={{ fontSize: 17, fontWeight: 700, lineHeight: 1.3, marginTop: 10, color: 'var(--ink)' }}>{brief.next_action}</p>
              <p style={{ fontSize: 13.5, lineHeight: 1.55, color: 'var(--ink-2)', marginTop: 8 }}>{brief.summary}</p>
              {brief.cares_about && <p style={{ fontSize: 13, color: 'var(--ink-2)', marginTop: 6 }}><span style={{ fontWeight: 600, color: 'var(--ink)' }}>Cares about:</span> {brief.cares_about}</p>}
              {brief.message && (
                <div style={{ marginTop: 14, background: '#FAFAF9', border: '1px solid var(--hairline)', borderRadius: 12, padding: 12 }}>
                  <p className="meta-label" style={{ marginBottom: 6 }}>Suggested message</p>
                  <p style={{ fontSize: 13.5, lineHeight: 1.5 }}>{brief.message}</p>
                  <div className="flex flex-wrap" style={{ gap: 8, marginTop: 10 }}>
                    {phone && (
                      <a href={`https://wa.me/${phone}?text=${encodeURIComponent(brief.message)}`} target="_blank" rel="noreferrer" className="btn btn-primary btn-sm">
                        <MessageSquare size={13} /> Send on WhatsApp
                      </a>
                    )}
                    <button onClick={() => { navigator.clipboard.writeText(brief.message); toast.success('Copied'); }} className="btn btn-secondary btn-sm">
                      <Copy size={13} /> Copy
                    </button>
                  </div>
                </div>
              )}
              {!aiEnabled && (
                <p style={{ fontSize: 11.5, color: 'var(--ink-3)', marginTop: 12 }}>Rule-based. Add OPENAI_API_KEY on the server for AI-written briefs.</p>
              )}
            </>
          )}
        </div>
      </div>

      {/* ── Evidence ── */}
      <div style={{ background: TOKENS.surface, border: `1px solid ${TOKENS.hairline}`, borderRadius: 12 }}>
        <p className="meta-label" style={{ padding: '14px 18px 10px', borderBottom: `1px solid ${TOKENS.hairline}` }}>Why this score</p>
        {data.signals.length === 0 ? (
          <p className="t-body-sm" style={{ padding: 18, color: TOKENS.ink2 }}>
            Nothing yet. Share a document from Content, send a tracked website link, or install the website script — every read, visit and reply lands here.
          </p>
        ) : data.signals.map((s, i) => (
          <div key={i} className="flex items-center" style={{ gap: 12, padding: '10px 18px', borderBottom: i < data.signals.length - 1 ? `1px solid ${TOKENS.hairline}` : 'none' }}>
            <span className="mono" style={{ width: 40, textAlign: 'right', fontSize: 12.5, color: s.points > 0 ? TOKENS.ink : TOKENS.coralDeep }}>{s.points > 0 ? `+${s.points}` : s.points}</span>
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ fontSize: 13.5, fontWeight: 600 }}>{s.label}</span>
              <span className="t-body-sm" style={{ color: TOKENS.ink2 }}> — {s.detail}</span>
            </span>
            {s.at && <span className="mono hidden sm:inline" style={{ fontSize: 11, color: TOKENS.ink3 }}>{formatWait((now - new Date(s.at).getTime()) / 60000)} ago</span>}
          </div>
        ))}
        {positives.length > 0 && (
          <p className="mono" style={{ fontSize: 11, color: TOKENS.ink3, padding: '8px 18px 12px', borderTop: `1px solid ${TOKENS.hairline}` }}>
            Score is capped at 100 and decays after 14 quiet days.
          </p>
        )}
      </div>

      {/* ── Documents, page by page ── */}
      {data.documents.length > 0 && (
        <div style={{ background: TOKENS.surface, border: `1px solid ${TOKENS.hairline}`, borderRadius: 12 }}>
          <p className="meta-label flex items-center" style={{ gap: 6, padding: '14px 18px 10px', borderBottom: `1px solid ${TOKENS.hairline}` }}><FileText size={12} /> Documents</p>
          {data.documents.map((d) => {
            const max = Math.max(1, ...d.pages.map((p) => p.seconds));
            return (
              <div key={d.tracking_id} style={{ padding: '14px 18px', borderBottom: `1px solid ${TOKENS.hairline}` }}>
                <div className="flex items-baseline justify-between flex-wrap" style={{ gap: 8 }}>
                  <span style={{ fontWeight: 600 }}>{d.name}</span>
                  <span className="mono" style={{ fontSize: 12, color: TOKENS.ink2 }}>
                    {d.opens ? `${d.opens} open${d.opens === 1 ? '' : 's'} · ${fmtSecs(d.seconds)}${d.completion !== null ? ` · ${d.pages_read}/${d.page_count} pages` : ''}` : 'not opened yet'}
                  </span>
                </div>
                {d.pages.length > 0 && (
                  <div className="flex items-end" style={{ gap: 3, height: 54, marginTop: 12 }}>
                    {d.pages.map((p) => {
                      const top = d.top_page && p.page === d.top_page.page && p.seconds > 0;
                      return (
                        <div key={p.page} className="flex-1 flex flex-col items-center" style={{ gap: 3, minWidth: 6 }} title={`Page ${p.page}: ${fmtSecs(p.seconds)}`}>
                          <motion.div
                            initial={{ height: 0 }} animate={{ height: `${Math.max(p.seconds ? 8 : 3, (p.seconds / max) * 40)}px` }}
                            transition={{ duration: 0.5, delay: p.page * 0.02 }}
                            style={{ width: '100%', borderRadius: 2, background: top ? TOKENS.ember : p.seconds ? TOKENS.ink : TOKENS.hairline }}
                          />
                          {d.pages.length <= 24 && <span className="mono" style={{ fontSize: 9.5, color: top ? TOKENS.ember : TOKENS.ink3 }}>{p.page}</span>}
                        </div>
                      );
                    })}
                  </div>
                )}
                {d.top_page?.seconds > 0 && (
                  <p className="t-body-sm" style={{ color: TOKENS.ink2, marginTop: 8 }}>
                    Spent longest on <b style={{ color: TOKENS.ember }}>page {d.top_page.page}</b> ({fmtSecs(d.top_page.seconds)}) — that's what to talk about.
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── Website ── */}
      {data.website.visits > 0 && (
        <div style={{ background: TOKENS.surface, border: `1px solid ${TOKENS.hairline}`, borderRadius: 12 }}>
          <p className="meta-label flex items-center" style={{ gap: 6, padding: '14px 18px 10px', borderBottom: `1px solid ${TOKENS.hairline}` }}>
            <Globe size={12} /> Website · {data.website.visits} visit{data.website.visits === 1 ? '' : 's'} · {fmtSecs(data.website.seconds)}
          </p>
          {data.website.pages.map((p, i) => {
            const max = Math.max(1, ...data.website.pages.map((x) => x.seconds));
            return (
              <div key={p.path + i} className="flex items-center" style={{ gap: 12, padding: '9px 18px', borderBottom: i < data.website.pages.length - 1 ? `1px solid ${TOKENS.hairline}` : 'none' }}>
                <span className="min-w-0 flex-1">
                  <span className="block truncate" style={{ fontSize: 13.5, fontWeight: 500 }}>{p.title || p.path}</span>
                  <span className="block mono truncate" style={{ fontSize: 11, color: TOKENS.ink3 }}>{p.path}</span>
                </span>
                <span style={{ width: 120, height: 6, background: TOKENS.canvasAlt, borderRadius: 3, overflow: 'hidden' }} className="hidden sm:block">
                  <span style={{ display: 'block', height: '100%', width: `${(p.seconds / max) * 100}%`, background: TOKENS.ink }} />
                </span>
                <span className="mono" style={{ width: 64, textAlign: 'right', fontSize: 12.5 }}>{fmtSecs(p.seconds)}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/** Compact header chip: score + temperature, used on the lead header. */
export function InterestChip({ score = 0, temperature }) {
  const t = TEMP[temperature] || (score >= 70 ? TEMP.hot : score >= 45 ? TEMP.warm : score >= 20 ? TEMP.lukewarm : TEMP.cold);
  return (
    <span className="inline-flex items-center" style={{ gap: 6, background: t.bg, color: t.color, borderRadius: 6, padding: '2px 8px', fontSize: 12, fontWeight: 600 }}>
      <span className="mono">{score}</span> {t.label}
    </span>
  );
}
