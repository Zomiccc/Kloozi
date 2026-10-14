import { useEffect, useState, useCallback } from 'react';
import toast from 'react-hot-toast';
import { Copy, ExternalLink, CheckCircle2, Loader2, X, AlertCircle } from 'lucide-react';
import API from '../lib/api';
import BrandLogo from './BrandLogo';

/* ═══════════════════════════════════════════════════════════════
   CONNECT (managed) — a client connects Facebook / LinkedIn / TikTok
   in ~3 clicks: open their ad platform at the right screen, paste
   Flazyn's ID, tap Done. The Flazyn team switches the feed on and the
   card turns "Connected" by itself when the first lead arrives.
   ═══════════════════════════════════════════════════════════════ */

const META = {
  facebook: {
    brand: 'facebook', name: 'Facebook & Instagram', what: 'Facebook Page',
    open: 'https://business.facebook.com/settings/partners', openLabel: 'Open Meta Business Settings',
    idLabel: 'Flazyn Business ID', idKey: 'business_id',
    steps: ['Click Add, then "Give a partner access to your assets"', 'Paste the Flazyn Business ID', 'Pick your Page and switch on Leads, then Save'],
    assetHint: 'Your Facebook Page name, e.g. Harbour Homes',
    requestedNote: 'Connecting automatically. This usually takes under 5 minutes. We’ll notify you when your first lead can come through.',
  },
  linkedin: {
    brand: 'linkedin', name: 'LinkedIn', what: 'LinkedIn Page',
    open: 'https://www.linkedin.com/campaignmanager/', openLabel: 'Open LinkedIn Campaign Manager',
    idLabel: 'Add this member', idKey: 'member_name',
    steps: ['Open your ad account, then Account settings → Manage access', 'Add the member below as a Viewer', 'On your LinkedIn Page: Admin tools → Manage admins → add them as Lead Gen Forms Manager'],
    assetHint: 'Your LinkedIn Page name (optional)',
  },
  tiktok: {
    brand: 'tiktok', name: 'TikTok', what: 'TikTok ad account',
    open: 'https://business.tiktok.com/', openLabel: 'Open TikTok Business Center',
    idLabel: 'Flazyn Business Center ID', idKey: 'business_center_id',
    steps: ['Go to Users → Partners → Add partner', 'Paste the Flazyn Business Center ID', 'Share your ad account with Analyst access (include leads)'],
    assetHint: 'Your ad account name (optional)',
  },
};

const STATUS = {
  requested: { label: 'Connecting…', note: 'We’re switching on your lead feed. This usually takes a few hours. We’ll notify you when it’s live.', tone: 'blue' },
  in_progress: { label: 'Connecting…', note: 'Our team is finishing the connection now.', tone: 'blue' },
  needs_client: { label: 'Action needed', note: '', tone: 'amber' },
  connected: { label: 'Connected', note: 'New leads arrive in Flazyn automatically.', tone: 'green' },
};

export default function ManagedConnect({ platform }) {
  const m = META[platform];
  const [data, setData] = useState(null);
  const [open, setOpen] = useState(false);
  const load = useCallback(() => API.get('/connections').then((r) => setData(r.data)).catch(() => setData({ requests: [], flazyn: {} })), []);
  useEffect(() => { load(); const t = setInterval(load, 20000); return () => clearInterval(t); }, [load]);

  const req = data?.requests?.find((r) => r.platform === platform);
  const st = req ? STATUS[req.status] : null;
  const toneCss = { green: { background: '#ECFDF5', color: '#047857' }, blue: { background: '#EFF6FF', color: '#1D4ED8' }, amber: { background: '#FFFBEB', color: '#92400E' } };

  return (
    <div className="card" style={{ padding: 20 }}>
      <div className="flex items-start gap-3">
        <BrandLogo brand={m.brand} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p style={{ fontWeight: 700, fontSize: 16 }}>Connect {m.name}</p>
            {st && <span className="badge" style={toneCss[st.tone]}>{st.label}</span>}
          </div>
          <p style={{ fontSize: 13.5, color: 'var(--ink-2)', marginTop: 2 }}>
            {st ? (req.status === 'needs_client' ? (req.message_to_client || 'Please check the access you gave Flazyn.') : (req.status === 'requested' && m.requestedNote) || st.note)
              : `New leads from your ${m.what} land in Flazyn within seconds. Auto-replies, assignment and alerts start straight away.`}
          </p>
          {req?.asset_name && <p style={{ fontSize: 12.5, color: 'var(--ink-3)', marginTop: 4 }}>{m.what}: {req.asset_name}</p>}
        </div>
      </div>
      <div className="flex gap-2 mt-4">
        {(!req || req.status === 'needs_client') && (
          <button onClick={() => setOpen(true)} className="btn btn-primary">{req ? 'Fix connection' : `Connect ${m.name}`}</button>
        )}
        {req && req.status !== 'connected' && req.status !== 'needs_client' && (
          <button onClick={() => setOpen(true)} className="btn btn-secondary btn-sm">Show the steps again</button>
        )}
      </div>
      {open && <Wizard platform={platform} flazyn={data?.flazyn?.[platform] || {}} existing={req} onClose={() => setOpen(false)} onDone={() => { setOpen(false); load(); }} />}
    </div>
  );
}

function Wizard({ platform, flazyn, existing, onClose, onDone }) {
  const m = META[platform];
  const [asset, setAsset] = useState(existing?.asset_name || '');
  const [opened, setOpened] = useState(false);
  const [busy, setBusy] = useState(false);
  const id = flazyn[m.idKey];
  const copy = (t) => { navigator.clipboard.writeText(t); toast.success('Copied'); };
  const done = async () => {
    setBusy(true);
    try { await API.post('/connections', { platform, asset_name: asset }); toast.success('Thanks! We’re switching it on.'); onDone(); }
    catch (err) { toast.error(err.response?.data?.error || 'Something went wrong'); }
    finally { setBusy(false); }
  };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(28,25,23,0.25)' }} onClick={onClose}>
      <div className="card-raised w-full" style={{ maxWidth: 480 }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2"><BrandLogo brand={m.brand} /><p style={{ fontWeight: 700, fontSize: 17 }}>Connect {m.name}</p></div>
          <button onClick={onClose} className="row-action"><X size={18} /></button>
        </div>

        {/* 1 */}
        <div className="mt-5 flex gap-3">
          <Num n={1} done={opened} />
          <div className="flex-1">
            <p style={{ fontWeight: 600 }}>Give Flazyn access to your leads</p>
            <ul className="mt-1" style={{ fontSize: 13, color: 'var(--ink-2)' }}>{m.steps.map((s) => <li key={s}>• {s}</li>)}</ul>
            <div className="flex items-center gap-2 mt-3">
              <div className="flex-1 min-w-0" style={{ padding: '8px 12px', background: '#FAFAF9', border: '1px solid var(--hairline)', borderRadius: 10 }}>
                <p style={{ fontSize: 11.5, color: 'var(--ink-3)' }}>{m.idLabel}</p>
                <p className="truncate" style={{ fontWeight: 700, fontSize: 14 }}>{id || 'Sent to you by email'}</p>
              </div>
              {id && <button onClick={() => copy(id)} className="btn btn-secondary btn-sm"><Copy size={14} /> Copy</button>}
            </div>
            {platform === 'linkedin' && flazyn.profile_url && (
              <a href={flazyn.profile_url} target="_blank" rel="noreferrer" style={{ fontSize: 12.5, color: 'var(--brand)', fontWeight: 600 }}>View Flazyn's LinkedIn profile</a>
            )}
            <a href={m.open} target="_blank" rel="noreferrer" onClick={() => setOpened(true)} className="btn btn-primary btn-sm mt-3 inline-flex">
              {m.openLabel} <ExternalLink size={14} />
            </a>
          </div>
        </div>

        {/* 2 */}
        <div className="mt-5 flex gap-3">
          <Num n={2} />
          <div className="flex-1">
            <p style={{ fontWeight: 600 }}>Tell us it’s done</p>
            <input className="input mt-2" placeholder={m.assetHint} value={asset} onChange={(e) => setAsset(e.target.value)} />
            <button onClick={done} disabled={busy} className="btn btn-primary w-full mt-3">
              {busy ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle2 size={16} />} Done, connect it
            </button>
            <p className="flex items-start gap-1.5 mt-2" style={{ fontSize: 12, color: 'var(--ink-3)' }}>
              <AlertCircle size={13} style={{ marginTop: 2, flexShrink: 0 }} /> Flazyn only reads your lead form answers. You can remove access anytime from the same screen.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function Num({ n, done }) {
  return (
    <span className="flex items-center justify-center flex-shrink-0" style={{ width: 26, height: 26, borderRadius: 999, background: done ? '#ECFDF5' : '#F3F0FF', color: done ? '#047857' : '#4A2FD6', fontWeight: 700, fontSize: 13 }}>
      {done ? '✓' : n}
    </span>
  );
}
