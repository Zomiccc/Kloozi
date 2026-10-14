import { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { CheckCircle2, Facebook, Zap, ChevronDown, ChevronUp, RefreshCw } from 'lucide-react';
import API from '../lib/api';
import useAuthStore from '../stores/authStore';

/* Connect WhatsApp in a few clicks.
   1. "Connect with Facebook" — Meta Embedded Signup popup: log in, pick or
      create the WhatsApp Business number, done.
   2. "Use Flazyn's number for now" — instant, for trials.
   3. Advanced: paste an existing Cloud API number's ID + token. */

const ADMIN_ROLES = ['super_admin', 'admin'];
const FB_VERSION = 'v21.0';

function loadFacebookSdk(appId) {
  return new Promise((resolve, reject) => {
    if (window.FB) { window.FB.init({ appId, xfbml: false, version: FB_VERSION }); return resolve(window.FB); }
    window.fbAsyncInit = () => { window.FB.init({ appId, autoLogAppEvents: true, xfbml: false, version: FB_VERSION }); resolve(window.FB); };
    const s = document.createElement('script');
    s.src = 'https://connect.facebook.net/en_US/sdk.js';
    s.async = true; s.defer = true; s.crossOrigin = 'anonymous';
    s.onerror = () => reject(new Error('Could not load Facebook. Check your connection or ad blocker.'));
    document.body.appendChild(s);
  });
}

const prettyNumber = (n) => (n ? `+${String(n).replace(/\D/g, '').replace(/^(\d{1,3})(\d{3})(\d{3})(\d+)$/, '$1 $2 $3 $4')}` : '');

export default function WhatsAppConnect({ compact = false }) {
  const { user } = useAuthStore();
  const isAdmin = ADMIN_ROLES.includes(user?.role);
  const [st, setSt] = useState(null);
  const [busy, setBusy] = useState('');
  const [advanced, setAdvanced] = useState(false);
  const [manual, setManual] = useState({ phone_number_id: '', access_token: '', waba_id: '' });
  const session = useRef({});

  const load = () => API.get('/whatsapp/connection').then((r) => setSt(r.data)).catch(() => setSt({ connected: false, embedded: {}, shared: {} }));
  useEffect(() => { load(); }, []);

  // Embedded Signup reports the chosen number through postMessage.
  useEffect(() => {
    const onMessage = (event) => {
      if (!/^https:\/\/([a-z0-9-]+\.)*facebook\.com$/.test(String(event.origin))) return;
      try {
        const data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
        if (data?.type !== 'WA_EMBEDDED_SIGNUP') return;
        if (String(data.event).startsWith('FINISH')) session.current = { phone_number_id: data.data?.phone_number_id, waba_id: data.data?.waba_id };
        else if (data.event === 'CANCEL') session.current = { cancelled: true, step: data.data?.current_step };
      } catch { /* not ours */ }
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);

  const connectFacebook = async () => {
    setBusy('embedded');
    session.current = {};
    try {
      const FB = await loadFacebookSdk(st.embedded.app_id);
      FB.login((resp) => {
        const code = resp?.authResponse?.code;
        if (!code) { setBusy(''); if (!session.current.cancelled) toast('Facebook window closed'); return; }
        // The number usually arrives just before the login callback; give it a moment if not.
        let tries = 0;
        const finish = async () => {
          if (!session.current.phone_number_id && tries++ < 20) { setTimeout(finish, 250); return; }
          try {
            await API.post('/whatsapp/connection/embedded', { code, ...session.current });
            toast.success('WhatsApp connected');
            load();
          } catch (err) { toast.error(err.response?.data?.error || 'Could not connect WhatsApp'); }
          finally { setBusy(''); }
        };
        finish();
      }, {
        config_id: st.embedded.config_id,
        response_type: 'code',
        override_default_response_type: true,
        extras: { setup: {}, featureType: '', sessionInfoVersion: '3' },
      });
    } catch (err) { toast.error(err.message); setBusy(''); }
  };

  const connectShared = async () => {
    setBusy('shared');
    try { await API.post('/whatsapp/connection/shared'); toast.success('Connected to Flazyn’s number'); load(); }
    catch (err) { toast.error(err.response?.data?.error || 'Could not connect'); }
    finally { setBusy(''); }
  };

  const connectManual = async (e) => {
    e.preventDefault();
    setBusy('manual');
    try { await API.post('/whatsapp/connection/manual', manual); toast.success('WhatsApp connected'); setManual({ phone_number_id: '', access_token: '', waba_id: '' }); load(); }
    catch (err) { toast.error(err.response?.data?.error || 'Could not connect'); }
    finally { setBusy(''); }
  };

  const disconnect = async () => {
    if (!window.confirm('Disconnect WhatsApp? Automations stop sending until you connect again.')) return;
    setBusy('disconnect');
    try { await API.delete('/whatsapp/connection'); toast.success('Disconnected'); load(); }
    catch (err) { toast.error(err.response?.data?.error || 'Could not disconnect'); }
    finally { setBusy(''); }
  };

  if (!st) return <div className="card skeleton" style={{ height: compact ? 120 : 180 }} />;

  if (st.connected) {
    const shared = st.mode === 'shared';
    return (
      <div className="card" style={{ padding: 20 }}>
        <div className="flex items-start gap-3">
          <span className="flex items-center justify-center flex-shrink-0" style={{ width: 40, height: 40, borderRadius: 12, background: '#ECFDF5', color: '#0E8A5F' }}><CheckCircle2 size={20} /></span>
          <div className="flex-1 min-w-0">
            <p style={{ fontWeight: 650, fontSize: 15 }}>WhatsApp is connected</p>
            <p className="mono" style={{ fontSize: 15, marginTop: 2 }}>{prettyNumber(st.display_number) || 'Number pending'}</p>
            <p style={{ fontSize: 13, color: 'var(--ink-2)', marginTop: 2 }}>
              {shared ? 'Using Flazyn’s shared number. Connect your own number any time so customers see your business name.' : `Your number${st.verified_name ? ` · shows as “${st.verified_name}”` : ''}`}
            </p>
          </div>
          {isAdmin && <button onClick={disconnect} disabled={!!busy} className="btn btn-secondary btn-sm">Disconnect</button>}
        </div>
        {shared && isAdmin && st.embedded?.available && (
          <button onClick={connectFacebook} disabled={!!busy} className="btn btn-primary btn-sm mt-4 inline-flex items-center gap-2">
            {busy === 'embedded' ? <RefreshCw size={14} className="animate-spin" /> : <Facebook size={14} />} Switch to my own number
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="card" style={{ padding: 20 }}>
      <p style={{ fontWeight: 650, fontSize: 16 }}>Connect WhatsApp</p>
      <p style={{ fontSize: 13.5, color: 'var(--ink-2)', marginTop: 2 }}>Send and receive WhatsApp messages from Flazyn. Replies land in your Inbox and new chats become leads.</p>
      {!isAdmin && <p style={{ fontSize: 13, color: 'var(--ink-3)', marginTop: 10 }}>Ask an admin on your team to connect WhatsApp.</p>}

      {isAdmin && (
        <div className="grid gap-3 mt-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))' }}>
          {st.embedded?.available && (
            <button onClick={connectFacebook} disabled={!!busy} className="text-left transition-shadow hover:shadow-md" style={{ border: '1.5px solid #5B3DF5', borderRadius: 14, padding: 16, background: '#FAF8FF' }}>
              <span className="flex items-center gap-2" style={{ fontWeight: 650, color: '#3F25C9' }}>
                {busy === 'embedded' ? <RefreshCw size={16} className="animate-spin" /> : <Facebook size={16} />} Connect my number
              </span>
              <span className="block" style={{ fontSize: 12.5, color: 'var(--ink-2)', marginTop: 6 }}>Log in with Facebook and pick your WhatsApp Business number. About 2 minutes.</span>
              <span className="block" style={{ fontSize: 11.5, color: 'var(--ink-3)', marginTop: 8 }}>Recommended · customers see your business name</span>
            </button>
          )}
          {st.shared?.available && (
            <button onClick={connectShared} disabled={!!busy} className="text-left transition-shadow hover:shadow-md" style={{ border: '1px solid #E7E5E4', borderRadius: 14, padding: 16, background: '#FFFFFF' }}>
              <span className="flex items-center gap-2" style={{ fontWeight: 650 }}>
                {busy === 'shared' ? <RefreshCw size={16} className="animate-spin" /> : <Zap size={16} />} Use Flazyn’s number for now
              </span>
              <span className="block" style={{ fontSize: 12.5, color: 'var(--ink-2)', marginTop: 6 }}>Start in one click. Messages come from Flazyn’s number. Switch to your own later.</span>
            </button>
          )}
          {!st.embedded?.available && !st.shared?.available && (
            <p style={{ fontSize: 13, color: 'var(--ink-3)' }}>WhatsApp is being set up for Flazyn. Check back soon.</p>
          )}
        </div>
      )}

      {isAdmin && (
        <div className="mt-4">
          <button onClick={() => setAdvanced((v) => !v)} className="inline-flex items-center gap-1" style={{ fontSize: 12.5, color: 'var(--ink-3)' }}>
            {advanced ? <ChevronUp size={13} /> : <ChevronDown size={13} />} I already have a WhatsApp Cloud API number
          </button>
          {advanced && (
            <form onSubmit={connectManual} className="grid gap-3 mt-3" style={{ maxWidth: 480 }}>
              <div><p className="meta-label mb-1">Phone number ID</p><input className="input mono" inputMode="numeric" value={manual.phone_number_id} onChange={(e) => setManual({ ...manual, phone_number_id: e.target.value })} placeholder="e.g. 1370744916124134" /></div>
              <div><p className="meta-label mb-1">WhatsApp Business account ID (optional)</p><input className="input mono" inputMode="numeric" value={manual.waba_id} onChange={(e) => setManual({ ...manual, waba_id: e.target.value })} /></div>
              <div><p className="meta-label mb-1">Permanent access token</p><input className="input mono" type="password" autoComplete="off" value={manual.access_token} onChange={(e) => setManual({ ...manual, access_token: e.target.value })} placeholder="System user token" /></div>
              <button type="submit" disabled={!!busy} className="btn btn-secondary btn-sm justify-self-start">{busy === 'manual' ? 'Checking with Meta…' : 'Connect'}</button>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
