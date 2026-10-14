import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence, useInView } from 'framer-motion';
import { ChevronDown, Check } from 'lucide-react';

/* ═══════════════════════════════════════════════════════════════
   FLAZYN MOTION — Section 9, exact timings.
   Soft, springy, tactile. Nothing exceeds 320ms except stagger
   sequences and the Won-deal moment.
   ═══════════════════════════════════════════════════════════════ */

export const EASE_SOFT = [0.22, 1, 0.36, 1];
export const SPRING_PRESS = { type: 'spring', stiffness: 350, damping: 15 };
export const SPRING_TAB = { type: 'spring', stiffness: 380, damping: 30 };
export const SPRING_DROP = { type: 'spring', stiffness: 280, damping: 18 };

/* ─── Section 7 tabs: segmented pill switcher.
       The active background is a layout animation that slides to the
       new position — the signature tactile moment. ─── */
export function SectionTabs({ tabs, active, onChange, layoutId = 'section-tabs', right = null, className = '' }) {
  return (
    <div className={`flex items-center justify-between flex-wrap gap-4 ${className}`} style={{ marginBottom: '24px' }}>
      <div className="segmented no-scrollbar" style={{ maxWidth: '100%', overflowX: 'auto' }}>
        {tabs.map((t) => {
          const key = t.key ?? t.value ?? t;
          const label = t.label ?? t;
          const on = active === key;
          return (
            <button
              key={key}
              onClick={() => onChange(key)}
              className="relative"
              style={{
                padding: '7px 16px',
                fontSize: '13px',
                fontWeight: 700,
                borderRadius: '999px',
                color: on ? '#1C1917' : '#57534E',
                whiteSpace: 'nowrap',
              }}
            >
              {on && (
                <motion.span
                  layoutId={layoutId}
                  transition={SPRING_TAB}
                  className="absolute inset-0"
                  style={{ background: '#FFFFFF', borderRadius: '999px', boxShadow: '0 2px 8px rgba(28,25,23,0.06)' }}
                />
              )}
              <span className="relative z-10">{label}</span>
            </button>
          );
        })}
      </div>
      {right && <div className="flex items-center gap-3">{right}</div>}
    </div>
  );
}

/* ─── Page transition: opacity 0→1, y 10→0, 220ms, ease-soft.
       Children stagger 60ms apart. ─── */
export const pageVariants = {
  hidden: { opacity: 0, y: 10 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.22, ease: EASE_SOFT, staggerChildren: 0.06, delayChildren: 0.02 },
  },
};

export const itemVariants = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { duration: 0.22, ease: EASE_SOFT } },
};

export function Page({ children, className = '', style }) {
  return (
    <motion.div variants={pageVariants} initial="hidden" animate="show" className={className} style={style}>
      {children}
    </motion.div>
  );
}

export function Item({ children, className = '', style, as = 'div' }) {
  const Comp = motion[as] || motion.div;
  return (
    <Comp variants={itemVariants} className={className} style={style}>
      {children}
    </Comp>
  );
}

/* List rows: stagger in on first load, animate out on filter change. */
export function RowList({ items, render, keyOf, className = '' }) {
  return (
    <AnimatePresence initial={false}>
      {items.map((item, i) => (
        <motion.div
          key={keyOf(item)}
          layout
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0, transition: { duration: 0.22, ease: EASE_SOFT, delay: Math.min(i * 0.06, 0.36) } }}
          exit={{ opacity: 0, y: -6, transition: { duration: 0.15 } }}
          className={className}
        >
          {render(item)}
        </motion.div>
      ))}
    </AnimatePresence>
  );
}

/* ─── Number count-up: 0 → value over 650ms on mount.
       On update the background briefly pulses accent-tint (300ms). ─── */
export function CountUp({ value, duration = 0.65, decimals = 0, prefix = '', suffix = '', className = '', style }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: '-20px' });
  const [display, setDisplay] = useState(0);
  const [pulse, setPulse] = useState(false);
  const fromRef = useRef(0);
  const mountedRef = useRef(false);

  useEffect(() => {
    if (!inView) return;
    const from = fromRef.current;
    if (mountedRef.current && from !== value) {
      setPulse(true);
      const p = setTimeout(() => setPulse(false), 300);
      var clearPulse = () => clearTimeout(p);
    }
    mountedRef.current = true;
    const start = performance.now();
    let raf;
    const tick = (now) => {
      const t = Math.min((now - start) / (duration * 1000), 1);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(from + (value - from) * eased);
      if (t < 1) raf = requestAnimationFrame(tick);
      else fromRef.current = value;
    };
    raf = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(raf); if (clearPulse) clearPulse(); };
  }, [inView, value, duration]);

  const shown = decimals > 0
    ? display.toFixed(decimals).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
    : Math.round(display).toLocaleString();

  return (
    <span
      ref={ref}
      className={className}
      style={{
        background: pulse ? 'rgba(91,61,245,0.35)' : 'transparent',
        borderRadius: '8px',
        transition: 'background 300ms ease',
        ...style,
      }}
    >
      {prefix}{shown}{suffix}
    </span>
  );
}

/* ─── Modal — Section 7/9. 24px radius, modal shadow, plum backdrop,
       scale 0.94→1 + fade, 220ms spring-flavoured. Slides up on mobile. ─── */
export function Modal({ open, onClose, children, maxWidth = 'md', maxHeight = '90vh' }) {
  if (!open) return null;
  const widths = { sm: 'max-w-sm', md: 'max-w-md', lg: 'max-w-lg', xl: 'max-w-2xl', '2xl': 'max-w-4xl' };
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-6 overflow-y-auto"
      style={{ background: 'rgba(28,25,23,0.25)' }}
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.94, y: 40 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 20 }}
        transition={{ duration: 0.22, ease: EASE_SOFT }}
        className={`w-full ${widths[maxWidth] || widths.md} sm:my-auto overflow-y-auto`}
        style={{
          background: '#FFFFFF',
          borderRadius: '10px',
          boxShadow: '0 24px 64px rgba(28,25,23,0.20)',
          maxHeight,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sm:hidden mx-auto" style={{ width: '40px', height: '4px', borderRadius: '999px', background: '#E7E5E4', marginTop: '12px' }} />
        {children}
      </motion.div>
    </motion.div>
  );
}

/* ─── The Won moment — Section 9. The single piece of extra delight:
       a mint pulse, a checkmark that pops in with a gentle bounce. ─── */
export function WinBurst() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const handler = () => { setShow(true); setTimeout(() => setShow(false), 1600); };
    window.addEventListener('flazyn:won', handler);
    return () => window.removeEventListener('flazyn:won', handler);
  }, []);
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          className="fixed inset-0 z-[100] pointer-events-none flex items-center justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            className="flex items-center justify-center"
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{ scale: [0.6, 1.15, 1], opacity: 1 }}
            exit={{ scale: 0.94, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 400, damping: 17 }}
            style={{
              width: 104,
              height: 104,
              borderRadius: '10px',
              background: '#D5F5E8',
              color: '#0E8A5F',
              boxShadow: '0 24px 64px rgba(28,25,23,0.20)',
            }}
          >
            <motion.span
              initial={{ scale: 0, rotate: -12 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: 'spring', stiffness: 400, damping: 14, delay: 0.1 }}
              className="flex"
            >
              <Check size={52} strokeWidth={3} />
            </motion.span>
          </motion.div>
          <motion.div
            className="absolute inset-0"
            style={{ background: 'radial-gradient(circle at 50% 50%, rgba(215,234,200,0.30), transparent 55%)' }}
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 1, 0] }}
            transition={{ duration: 1.3, ease: 'easeOut' }}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function celebrateWin() {
  window.dispatchEvent(new CustomEvent('flazyn:won'));
}

/* ─── Collapsible filter — Section 10: filters live behind a pill
       trigger and open as a soft dropdown panel, never a permanent row. ─── */
export function FilterPanel({ label = 'Filter', activeCount = 0, children, align = 'right' }) {
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
      <button onClick={() => setOpen(!open)} className={`pill-trigger ${open || activeCount > 0 ? 'pill-trigger-active' : ''}`}>
        {label}
        {activeCount > 0 && (
          <span className="mono" style={{ fontSize: '11px', background: '#FFFFFF', borderRadius: '999px', padding: '1px 7px' }}>
            {activeCount}
          </span>
        )}
        <motion.span animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.2 }} className="flex">
          <ChevronDown size={14} />
        </motion.span>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ duration: 0.2, ease: EASE_SOFT }}
            className="absolute z-40 mt-2 popover"
            style={{ [align]: 0, width: '300px' }}
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
