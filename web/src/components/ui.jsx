import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown } from 'lucide-react';
import { avatarTone, initialsOf } from '../lib/avatar';

/* ═══════════════════════════════════════════════════════════════
   FLAZYN — WORKSPACE PRIMITIVES
   Neutral sheets, teal actions, solid colour status cells, one-tap
   contact buttons and a few 3D "clay" accents. Pages compose these.
   ═══════════════════════════════════════════════════════════════ */

export const TOKENS = {
  canvas: '#FAFAF9',
  canvasAlt: '#F5F5F4',
  surface: '#FFFFFF',
  ink: '#1C1917',
  ink2: '#57534E',
  ink3: '#A8A29E',
  hairline: '#E7E5E4',
  hairlineStrong: '#D6D3D1',
  accent: '#EDE9FF',
  accentDeep: '#4A2FD6',
  accentHover: '#DDD6FE',
  ember: '#F59E0B',
  peach: '#FFE8D2',
  peachDeep: '#B45309',
  mint: '#D5F5E8',
  mintDeep: '#0E8A5F',
  butter: '#FFF1C2',
  butterDeep: '#8A6100',
  coral: '#FFE9C7',
  coralDeep: '#B45309',
  sky: '#DCE8FF',
  skyDeep: '#2F6FDB',
  shCard: '0 1px 2px rgba(28,25,23,0.05), 0 6px 18px -12px rgba(28,25,23,0.18)',
  shCardHover: '0 1px 0 rgba(28,25,23,0.04), 0 6px 18px -10px rgba(28,25,23,0.25)',
  shDropdown: '0 0 0 1px rgba(28,25,23,0.08), 0 18px 40px -16px rgba(28,25,23,0.35)',
  shModal: '0 0 0 1px rgba(28,25,23,0.08), 0 32px 80px -24px rgba(28,25,23,0.45)',
  easeSoft: [0.22, 1, 0.36, 1],
};

export const TONE = {
  accent: { bg: '#EDE9FF', fg: '#1C1917' },
  lavender: { bg: '#F5F5F4', fg: '#57534E' }, // legacy name → stone
  stone: { bg: '#F5F5F4', fg: '#57534E' },
  ink: { bg: '#5B3DF5', fg: '#FFFFFF' },
  peach: { bg: '#FFE8D2', fg: '#B45309' },
  mint: { bg: '#D5F5E8', fg: '#0E8A5F' },
  butter: { bg: '#FFF1C2', fg: '#8A6100' },
  coral: { bg: '#FFE9C7', fg: '#B45309' },
  sky: { bg: '#DCE8FF', fg: '#2F6FDB' },
  neutral: { bg: '#F5F5F4', fg: '#57534E' },
};

/* Pipeline reads like a fuse: cool blue → stone → volt → amber → moss. */
export const STAGE_TONE = {
  new: TONE.sky,
  contacted: TONE.stone,
  interested: TONE.accent,
  negotiating: TONE.butter,
  won: TONE.mint,
  lost: TONE.neutral,
  qualified: TONE.accent,
  proposal: TONE.butter,
};

export function stageTone(stage) {
  return STAGE_TONE[String(stage || 'new').toLowerCase()] || TONE.neutral;
}

export function statusTone(status) {
  const s = String(status || '').toLowerCase();
  if (/(won|active|connected|sent|delivered|complete|completed|success|paid|live|enabled|verified|approved|online|healthy|running)/.test(s)) return TONE.mint;
  if (/(pending|scheduled|draft|due|paused|warning|processing|queued|review|trial)/.test(s)) return TONE.butter;
  if (/(lost|failed|error|bounced|overdue|disconnected|cancelled|canceled|expired|disabled|blocked|inactive|offline|unpaid)/.test(s)) return TONE.coral;
  if (/(new|info|open|opened|clicked|contacted|invited)/.test(s)) return TONE.sky;
  return TONE.neutral;
}

/* ─── Tags — compact, square-ish, led by a small dot ─── */
export function Badge({ tone = 'neutral', children, className = '', style, dot = true, ...rest }) {
  const t = typeof tone === 'string' ? TONE[tone] || TONE.neutral : tone;
  return (
    <span
      className={`inline-flex items-center capitalize ${className}`}
      style={{
        gap: '6px', background: t.bg, color: t.fg, fontSize: '12px', fontWeight: 500, lineHeight: 1.4,
        padding: '2px 8px', borderRadius: '6px', whiteSpace: 'nowrap', ...style,
      }}
      {...rest}
    >
      {dot && <span style={{ width: 6, height: 6, borderRadius: 2, background: t.fg, opacity: 0.85, flexShrink: 0 }} />}
      {children}
    </span>
  );
}

export function StageBadge({ stage, className = '', ...rest }) {
  return <Badge tone={stageTone(stage)} className={className} {...rest}>{stage || 'new'}</Badge>;
}

export function StatusBadge({ status, className = '', ...rest }) {
  return <Badge tone={statusTone(status)} className={className} {...rest}>{String(status || '—').replace(/_/g, ' ')}</Badge>;
}

/* ─── Avatars — initials set in serif on a warm tile ─── */
export function Avatar({ name = '', first, last, size = 40, radius, className = '', style }) {
  const label = first !== undefined || last !== undefined
    ? initialsOf(first, last)
    : String(name).trim().split(/\s+/).slice(0, 2).map((w) => w[0] || '').join('').toUpperCase() || '?';
  const tone = avatarTone(first !== undefined ? `${first || ''}${last || ''}` : name);
  const r = Math.round(size * 0.28);
  return (
    <span
      className={`inline-flex items-center justify-center flex-shrink-0 ${className}`}
      style={{
        width: size, height: size, borderRadius: radius !== undefined ? Math.min(radius, r) : r,
        background: tone.bg, color: tone.fg, fontFamily: 'var(--font-serif)',
        fontSize: Math.round(size * 0.42), lineHeight: 1, letterSpacing: '-0.02em', ...style,
      }}
    >
      {label}
    </span>
  );
}

/* ─── Sheet — paper with a hairline edge ─── */
export function Card({ children, className = '', padded = true, hover = false, style, ...rest }) {
  return (
    <div
      className={`${hover ? 'card-hover' : ''} ${className}`}
      style={{
        background: TOKENS.surface, border: `1px solid ${TOKENS.hairline}`, borderRadius: '14px',
        boxShadow: TOKENS.shCard, padding: padded ? '22px' : 0, ...style,
      }}
      {...rest}
    >
      {children}
    </div>
  );
}

/* ─── Readout — mono label, serif figure. `hero` is an ink plate with a volt figure. ─── */
export function StatCard({ label, value, sub, hero = false, peach = false, icon = null, index = 0, className = '' }) {
  const bg = hero ? 'linear-gradient(135deg, #7C5CFF 0%, #5B3DF5 100%)' : peach ? '#FFE8D2' : TOKENS.surface;
  const labelColor = hero ? 'rgba(255,255,255,0.85)' : peach ? '#B45309' : TOKENS.ink3;
  const valueColor = hero ? '#FFFFFF' : peach ? '#B45309' : TOKENS.ink;
  const subColor = hero ? 'rgba(255,255,255,0.85)' : peach ? '#B45309' : TOKENS.ink2;
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, ease: TOKENS.easeSoft, delay: index * 0.05 }}
      className={className}
      style={{ background: bg, border: hero ? 'none' : `1px solid ${peach ? '#FFD9A8' : TOKENS.hairline}`, borderRadius: '14px', padding: '18px 20px', boxShadow: TOKENS.shCard }}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="meta-label" style={{ color: labelColor }}>{label}</div>
        {icon && <span style={{ color: labelColor }}>{icon}</span>}
      </div>
      <div className="serif" style={{ fontSize: '34px', color: valueColor, marginTop: '6px', lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: '12.5px', color: subColor, marginTop: '8px' }}>{sub}</div>}
    </motion.div>
  );
}

/* ─── Segmented — ink slider on a paper track ─── */
export function Segmented({ options, value, onChange, layoutId = 'segmented', size = 'md', className = '' }) {
  const pad = size === 'sm' ? '4px 10px' : '5px 12px';
  const fs = size === 'sm' ? '12px' : '12.5px';
  return (
    <div className={`segmented ${className}`}>
      {options.map((opt) => {
        const key = opt.key ?? opt.value ?? opt;
        const label = opt.label ?? opt;
        const on = value === key;
        return (
          <button
            key={key}
            onClick={() => onChange(key)}
            className="relative"
            style={{
              padding: pad, fontSize: fs, fontWeight: 500, borderRadius: '6px',
              color: on ? '#4A2FD6' : TOKENS.ink2, background: 'transparent', fontWeight: on ? 700 : 600,
              whiteSpace: 'nowrap', textTransform: 'capitalize', transition: 'color 160ms ease',
            }}
          >
            {on && (
              <motion.span
                layoutId={layoutId}
                transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                className="absolute inset-0"
                style={{ background: '#FFFFFF', borderRadius: '8px', boxShadow: '0 1px 3px rgba(28,25,23,0.14)' }}
              />
            )}
            <span className="relative z-10">{label}</span>
          </button>
        );
      })}
    </div>
  );
}

/* ─── Filter — collapsed behind a pill, opens a sheet ─── */
export function FilterPill({ label = 'Filter', activeCount = 0, children, align = 'right' }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);
  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen(!open)} className={`pill-trigger ${activeCount > 0 ? 'pill-trigger-active' : ''}`}>
        {label}
        {activeCount > 0 && (
          <span className="mono" style={{ fontSize: '11px', background: TOKENS.accent, color: TOKENS.ink, borderRadius: '4px', padding: '0 5px' }}>{activeCount}</span>
        )}
        <motion.span animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.2 }} className="flex"><ChevronDown size={14} /></motion.span>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.16, ease: TOKENS.easeSoft }}
            className="absolute z-40 mt-2 popover" style={{ [align]: 0, width: '300px' }}
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function ChipGroup({ label, options, value, onChange }) {
  return (
    <div style={{ marginBottom: '14px' }}>
      <p className="meta-label" style={{ marginBottom: '8px' }}>{label}</p>
      <div className="flex flex-wrap gap-1.5">
        {options.map((o) => {
          const key = o.value ?? o;
          const text = o.label ?? o;
          const on = value === key;
          return (
            <button key={String(key)} onClick={() => onChange(on ? '' : key)} className={`chip ${on ? 'chip-active' : ''}`}>{text}</button>
          );
        })}
      </div>
    </div>
  );
}

/* ─── Interest signal — five-bar meter, like phone reception ─── */
export function SignalChip({ score = 0, className = '' }) {
  const pct = Math.min(Math.max(Number(score) || 0, 0), 100);
  const lit = Math.max(0, Math.min(5, Math.round(pct / 20)));
  const hot = pct >= 70;
  return (
    <span className={`inline-flex items-end gap-2 ${className}`} title={`Interest ${pct}/100`}>
      <span className="inline-flex items-end" style={{ gap: '2px', height: '14px' }}>
        {[0, 1, 2, 3, 4].map((i) => (
          <motion.span
            key={i}
            initial={{ scaleY: 0 }} animate={{ scaleY: 1 }} transition={{ delay: i * 0.04, duration: 0.25 }}
            style={{
              width: 3, height: 5 + i * 2.25, borderRadius: 1, transformOrigin: 'bottom',
              background: i < lit ? (hot ? TOKENS.ember : '#5B3DF5') : TOKENS.hairlineStrong,
            }}
          />
        ))}
      </span>
      <span className="mono" style={{ fontSize: '12px', color: hot ? TOKENS.peachDeep : pct >= 40 ? TOKENS.ink : TOKENS.ink3, lineHeight: 1 }}>{pct}</span>
    </span>
  );
}

/* ─── Heat — how long a lead has waited for a first touch ─── */
export function leadHeat(lead, now = Date.now()) {
  const stage = String(lead?.stage || 'new').toLowerCase();
  const created = new Date(lead?.created_at || now).getTime();
  const mins = Math.max(0, (now - created) / 60000);
  if (stage !== 'new') return { level: 'handled', mins, color: 'transparent', label: 'Handled' };
  if (mins < 15) return { level: 'fresh', mins, color: TOKENS.ember, label: 'Fresh' };
  if (mins < 120) return { level: 'warm', mins, color: '#FBBF24', label: 'Warm' };
  if (mins < 1440) return { level: 'cooling', mins, color: '#E0A33A', label: 'Cooling' };
  return { level: 'cold', mins, color: TOKENS.hairlineStrong, label: 'Cold' };
}

export function formatWait(mins) {
  const m = Math.floor(mins);
  if (m < 1) return 'now';
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ${String(m % 60).padStart(2, '0')}m`;
  const d = Math.floor(h / 24);
  return d < 30 ? `${d}d ${h % 24}h` : `${Math.floor(d / 30)}mo`;
}

export function useNow(ms = 30000) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(t);
  }, [ms]);
  return now;
}

export function HeatDot({ heat, size = 8 }) {
  if (!heat || heat.level === 'handled') {
    return <span style={{ width: size, height: size, borderRadius: 999, border: `1.5px solid ${TOKENS.hairlineStrong}`, flexShrink: 0 }} />;
  }
  return (
    <span
      className={`heat-dot ${heat.level === 'fresh' ? 'heat-live' : ''}`}
      style={{ width: size, height: size, background: heat.color }}
      title={`${heat.label} — waiting ${formatWait(heat.mins)}`}
    />
  );
}

/* ─── Empty state — a quiet sheet with a serif line ─── */
export function EmptyState({ icon = null, title, body, action = null }) {
  return (
    <div className="flex flex-col items-center text-center" style={{ padding: '64px 24px' }}>
      {icon && (
        <span className="clay clay-lg clay-violet" style={{ marginBottom: '20px' }}>{icon}</span>
      )}
      <p className="serif" style={{ fontSize: '22px', lineHeight: 1.2 }}>{title}</p>
      {body && <p className="t-body-sm" style={{ color: TOKENS.ink2, marginTop: '8px', maxWidth: '440px' }}>{body}</p>}
      {action && <div style={{ marginTop: '22px' }}>{action}</div>}
    </div>
  );
}

/* ─── Page header — serif title, mono count, controls right ─── */
export function PageHeader({ title, count = null, eyebrow = null, children }) {
  return (
    <div className="flex items-end justify-between flex-wrap" style={{ gap: '16px', marginBottom: '22px' }}>
      <div>
        {eyebrow && <p className="meta-label" style={{ marginBottom: '6px' }}>{eyebrow}</p>}
        <div className="flex items-baseline" style={{ gap: '10px' }}>
          <h1 className="t-h1">{title}</h1>
          {count !== null && <span className="mono" style={{ color: TOKENS.ink3 }}>{count}</span>}
        </div>
      </div>
      {children && <div className="flex items-center flex-wrap" style={{ gap: '10px' }}>{children}</div>}
    </div>
  );
}

export function SkeletonRows({ count = 6, height = 56 }) {
  return (
    <div className="flex flex-col" style={{ gap: '6px' }}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="skeleton" style={{ height, opacity: Math.max(0.3, 1 - i * 0.1) }} />
      ))}
    </div>
  );
}

export function IconButton({ children, tone = 'white', size = 36, className = '', style, ...rest }) {
  const isAccent = tone === 'accent';
  return (
    <button
      className={`flex items-center justify-center flex-shrink-0 ${className}`}
      style={{
        width: size, height: size, borderRadius: '8px',
        background: isAccent ? '#5B3DF5' : TOKENS.surface,
        border: isAccent ? 'none' : `1px solid ${TOKENS.hairlineStrong}`,
        color: isAccent ? '#FFFFFF' : TOKENS.ink2,
        transition: 'background 160ms ease, color 160ms ease, border-color 160ms ease', ...style,
      }}
      {...rest}
    >
      {children}
    </button>
  );
}

export function Section({ title, action = null, children, className = '', padded = true }) {
  return (
    <Card className={className} padded={padded}>
      {(title || action) && (
        <div className="flex items-center justify-between" style={{ marginBottom: '14px', gap: '16px' }}>
          {title && <p className="meta-label" style={{ color: TOKENS.ink2 }}>{title}</p>}
          {action}
        </div>
      )}
      {children}
    </Card>
  );
}

/* Any deep/fill colour (current or legacy palette) → tag tone. */
export const DEEP_TO_TONE = {
  '#0E8A5F': TONE.mint, '#D5F5E8': TONE.mint, '#2F8D5B': TONE.mint, '#A8E6C1': TONE.mint,
  '#B45309': TONE.coral, '#FFE9C7': TONE.coral, '#B84545': TONE.coral, '#FFC2C2': TONE.coral,
  '#8A6100': TONE.butter, '#FFF1C2': TONE.butter, '#A87B12': TONE.butter, '#FFE9A8': TONE.butter,
  '#2F6FDB': TONE.sky, '#DCE8FF': TONE.sky, '#2E7BA6': TONE.sky, '#BFE3F5': TONE.sky,
  '#B45309': TONE.peach, '#FFE8D2': TONE.peach, '#B8763A': TONE.peach, '#FFD6A8': TONE.peach,
  '#EDE9FF': TONE.accent, '#DDD6FE': TONE.accent,
  '#1C1917': TONE.stone, '#F5F5F4': TONE.stone, '#7A6FCB': TONE.stone, '#E4DDFF': TONE.stone,
  '#A8A29E': TONE.neutral, '#57534E': TONE.neutral, '#F5F5F4': TONE.neutral,
  '#B3AAD1': TONE.neutral, '#8A7FB8': TONE.neutral, '#EFEBFC': TONE.neutral,
};

export function pillStyle(color, extra = {}) {
  const key = typeof color === 'string' ? color.toUpperCase() : '';
  const t = DEEP_TO_TONE[key] || TONE.neutral;
  return {
    display: 'inline-flex', alignItems: 'center', gap: '6px', background: t.bg, color: t.fg,
    fontSize: '12px', fontWeight: 500, lineHeight: 1.4, padding: '2px 8px', borderRadius: '6px', whiteSpace: 'nowrap', ...extra,
  };
}


/* ─── Status cell — solid colour, readable from across the room ─── */
const STATUS_CLASS = ['new', 'contacted', 'interested', 'negotiating', 'qualified', 'proposal', 'won', 'lost'];
export function StatusCell({ stage, className = '', style, onClick, title }) {
  const key = String(stage || 'new').toLowerCase();
  const cls = STATUS_CLASS.includes(key) ? `st-${key}` : '';
  return (
    <span onClick={onClick} title={title} className={`status-cell ${cls} ${onClick ? 'cursor-pointer' : ''} ${className}`}
      style={{ ...(cls ? {} : { background: '#5E8BC6' }), ...style }}>
      {stage || 'new'}
    </span>
  );
}

const TAP_ICONS = {
  call: 'M6.6 10.8a15.1 15.1 0 006.6 6.6l2.2-2.2a1 1 0 011-.25 11.4 11.4 0 003.6.57 1 1 0 011 1V20a1 1 0 01-1 1A17 17 0 013 4a1 1 0 011-1h3.5a1 1 0 011 1c0 1.25.2 2.45.57 3.57a1 1 0 01-.25 1z',
  wa: 'M12 3a9 9 0 00-7.8 13.5L3 21l4.6-1.2A9 9 0 1012 3zm4.4 12.6c-.2.5-1.1 1-1.6 1.1-.4 0-.9.1-2.9-.7-2.4-1-4-3.4-4.1-3.6-.1-.2-1-1.3-1-2.5s.6-1.8.9-2.1c.2-.2.5-.3.6-.3h.5c.1 0 .3 0 .5.4l.7 1.7c.1.1.1.3 0 .4l-.3.4-.3.3c-.1.1-.2.3-.1.5.4.7.9 1.3 1.5 1.8.7.6 1.3.8 1.6.9.2.1.3.1.5-.1l.7-.8c.2-.2.3-.2.5-.1l1.6.8c.2.1.4.2.4.3.1.2.1.6-.1 1.1z',
  email: 'M4 5h16a1 1 0 011 1v12a1 1 0 01-1 1H4a1 1 0 01-1-1V6a1 1 0 011-1zm8 7.2L4.6 7.4v.1L12 12.6l7.4-5.1v-.1z',
  sms: 'M4 4h16a1 1 0 011 1v11a1 1 0 01-1 1H8l-4 3.5V5a1 1 0 011-1z',
};

/* ─── One-tap contact buttons (call / WhatsApp / email / SMS) ─── */
export function ContactButtons({ phone, email, compact = false, onWhatsApp, onSms, className = '' }) {
  const digits = String(phone || '').replace(/\D/g, '');
  const items = [
    { key: 'call', label: 'Call', cls: 'tap-call', href: phone ? `tel:${phone}` : null },
    { key: 'wa', label: 'WhatsApp', cls: 'tap-wa', href: digits ? `https://wa.me/${digits}` : null, onClick: digits ? onWhatsApp : null },
    { key: 'email', label: 'Email', cls: 'tap-email', href: email ? `mailto:${email}` : null },
    { key: 'sms', label: 'SMS', cls: 'tap-sms', href: phone ? `sms:${phone}` : null, onClick: phone ? onSms : null },
  ];
  return (
    <div className={`flex items-center flex-wrap ${className}`} style={{ gap: compact ? 6 : 8 }}>
      {items.map((it) => {
        const size = compact ? 15 : 16;
        const icon = <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden><path d={TAP_ICONS[it.key]} /></svg>;
        const common = { className: `tap ${it.cls} ${compact ? 'tap-round' : ''}`, title: it.label, 'aria-label': it.label };
        if (!it.href) return <button key={it.key} type="button" {...common} disabled>{icon}{!compact && it.label}</button>;
        if (it.onClick) return <button key={it.key} type="button" {...common} onClick={(e) => { e.stopPropagation(); it.onClick(); }}>{icon}{!compact && it.label}</button>;
        return (
          <a key={it.key} {...common} href={it.href} target={it.key === 'wa' ? '_blank' : undefined} rel="noreferrer" onClick={(e) => e.stopPropagation()}>
            {icon}{!compact && it.label}
          </a>
        );
      })}
    </div>
  );
}

/* ─── 3D clay icon tile ─── */
export function Clay({ icon: Icon, tone = 'violet', size = 'md', className = '', style }) {
  const sz = size === 'sm' ? 'clay-sm' : size === 'lg' ? 'clay-lg' : '';
  const px = size === 'sm' ? 17 : size === 'lg' ? 28 : 22;
  return <span className={`clay clay-${tone} ${sz} ${className}`} style={style}>{Icon ? <Icon size={px} strokeWidth={2.2} /> : null}</span>;
}

/* ─── Tilt — card leans toward the cursor in 3D ─── */
export function Tilt({ children, max = 6, className = '', style, ...rest }) {
  const ref = useRef(null);
  const onMove = (e) => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5;
    const y = (e.clientY - r.top) / r.height - 0.5;
    el.style.transform = `rotateX(${(-y * max).toFixed(2)}deg) rotateY(${(x * max).toFixed(2)}deg)`;
  };
  const reset = () => { if (ref.current) ref.current.style.transform = ''; };
  return (
    <div className="tilt-wrap" style={{ height: '100%' }}>
      <div ref={ref} onMouseMove={onMove} onMouseLeave={reset} className={`tilt-card ${className}`} style={{ height: '100%', ...style }} {...rest}>
        {children}
      </div>
    </div>
  );
}

/* ─── Helper — a plain-language "what is this?" box ─── */
export function Helper({ icon = '💡', children, className = '' }) {
  return (
    <div className={`helper ${className}`}>
      <span style={{ fontSize: 18, lineHeight: 1.2 }} aria-hidden>{icon}</span>
      <div>{children}</div>
    </div>
  );
}
