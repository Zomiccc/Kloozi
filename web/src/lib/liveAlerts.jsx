import { useEffect } from 'react';
import { io } from 'socket.io-client';
import toast from 'react-hot-toast';

/* Live alerts over the socket. "Strike" alerts (a lead is reading your
   proposal right now) also buzz the phone, chime and show a system
   notification so they're noticed even in another tab. */

const STRIKE_TYPES = ['interest_live', 'demo_lead'];
const SOFT_TYPES = ['ghost_warning', 'reactivation', 'meeting_brief', 'competitor', 'new_lead', 'whatsapp_reply', 'follow_up_due', 'update_requested', 'update_received'];

export function chime() {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    const ctx = new Ctx();
    [880, 1320].forEach((f, i) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.frequency.value = f;
      o.connect(g); g.connect(ctx.destination);
      const t = ctx.currentTime + i * 0.16;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.18, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
      o.start(t); o.stop(t + 0.32);
    });
  } catch { /* audio blocked until the user interacts — fine */ }
}

export function canNotify() {
  return typeof window !== 'undefined' && 'Notification' in window;
}

export async function enableDesktopAlerts() {
  if (!canNotify()) return 'unsupported';
  if (Notification.permission === 'granted') return 'granted';
  return Notification.requestPermission();
}

export function useLiveAlerts(onOpenLead) {
  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    if (!token) return undefined;
    const socket = io('/', { path: '/socket.io', auth: { token }, transports: ['websocket', 'polling'], reconnectionDelay: 3000 });
    socket.on('notification:new', (n) => {
      const data = typeof n.data === 'string' ? (() => { try { return JSON.parse(n.data); } catch { return {}; } })() : (n.data || {});
      const open = () => data.leadId && onOpenLead?.(data.leadId);
      try { window.dispatchEvent(new CustomEvent('flazyn:notification', { detail: { ...n, data } })); } catch { /* ignore */ }
      if (STRIKE_TYPES.includes(n.type)) {
        if (navigator.vibrate) navigator.vibrate([220, 90, 220, 90, 320]);
        chime();
        if (canNotify() && Notification.permission === 'granted' && document.visibilityState !== 'visible') {
          const sys = new Notification(/^[⚡💬]/.test(n.title) ? n.title : `⚡ ${n.title}`, { body: n.body, tag: `strike-${data.leadId}`, requireInteraction: true });
          sys.onclick = () => { window.focus(); open(); sys.close(); };
        }
        toast((t) => (
          <button onClick={() => { open(); toast.dismiss(t.id); }} style={{ textAlign: 'left' }}>
            <b>{/^[⚡💬]/.test(n.title) ? n.title : `⚡ ${n.title}`}</b><br /><span style={{ fontSize: 13, color: '#57534E' }}>{n.body} Tap to open.</span>
          </button>
        ), { duration: 15000, id: `strike-${data.leadId}` });
      } else if (SOFT_TYPES.includes(n.type)) {
        toast((t) => (
          <button onClick={() => { open(); toast.dismiss(t.id); }} style={{ textAlign: 'left' }}>
            <b>{n.title}</b><br /><span style={{ fontSize: 13, color: '#57534E' }}>{String(n.body || '').slice(0, 140)}</span>
          </button>
        ), { duration: 8000 });
      }
    });
    return () => { socket.close(); };
  }, [onOpenLead]);
}
