import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import toast from 'react-hot-toast';
import { Copy, Download, AlertTriangle } from 'lucide-react';
import useAuthStore from '../../stores/authStore';

/* Flazyn team: the QR you show in a client's office. Scanning it opens
   the no-signup demo on their phone; ?ref= records who ran the demo. */
export default function DemoQR() {
  const { user } = useAuthStore();
  const [base, setBase] = useState(() => {
    try { return localStorage.getItem('flazyn:demo-base') || window.location.origin; } catch { return window.location.origin; }
  });
  const [img, setImg] = useState('');
  const ref = (user?.firstName || 'team').toLowerCase().replace(/[^a-z0-9]/g, '');
  const link = `${base.replace(/\/$/, '')}/demo?ref=${ref}`;
  const local = /localhost|127\.0\.0\.1/.test(base);

  useEffect(() => {
    QRCode.toDataURL(link, { width: 640, margin: 1, color: { dark: '#1C1917', light: '#FFFFFF' } }).then(setImg).catch(() => setImg(''));
    try { localStorage.setItem('flazyn:demo-base', base); } catch { /* ignore */ }
  }, [link, base]);

  return (
    <div className="max-w-xl mx-auto">
      <p className="eyebrow">Flazyn team</p>
      <h1 className="t-h1" style={{ marginTop: 4 }}>Live demo QR</h1>
      <p style={{ color: 'var(--ink-2)', marginTop: 2 }}>Show this in a meeting. They scan it, add their team, tap “Send me a test lead”, and their phone lights up within seconds. No sign-up, and nothing is sent to anyone.</p>

      <div className="card mt-5 text-center" style={{ padding: 24 }}>
        {img ? <img src={img} alt="Demo QR code" style={{ width: 280, height: 280, margin: '0 auto', imageRendering: 'pixelated' }} /> : <div className="skeleton" style={{ width: 280, height: 280, margin: '0 auto' }} />}
        <p style={{ fontWeight: 700, marginTop: 12 }}>Scan to try Flazyn</p>
        <code className="block truncate mt-2" style={{ fontSize: 12.5, color: 'var(--ink-2)' }}>{link}</code>
        <div className="flex gap-2 justify-center mt-4">
          <button onClick={() => { navigator.clipboard.writeText(link); toast.success('Link copied'); }} className="btn btn-secondary btn-sm"><Copy size={14} /> Copy link</button>
          {img && <a href={img} download="flazyn-demo-qr.png" className="btn btn-secondary btn-sm"><Download size={14} /> Download QR</a>}
        </div>
      </div>

      {local && (
        <div className="helper mt-4" style={{ background: '#FFFBEB', borderColor: '#FDE68A' }}>
          <AlertTriangle size={16} style={{ color: '#B45309', flexShrink: 0, marginTop: 2 }} />
          <div>This QR points to <b>localhost</b>, which a client’s phone can’t open. Enter your public Flazyn address below (your live site, or your ngrok address while testing).</div>
        </div>
      )}
      <div className="card mt-4" style={{ padding: 16 }}>
        <label className="meta-label">Public address of the Flazyn app</label>
        <input className="input mt-1" value={base} onChange={(e) => setBase(e.target.value.trim())} placeholder="https://app.flazyn.com" />
      </div>
    </div>
  );
}
