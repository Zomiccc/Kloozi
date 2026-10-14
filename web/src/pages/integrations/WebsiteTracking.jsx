import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ArrowLeft, Copy, RefreshCw, Globe, FileText, MousePointerClick } from 'lucide-react';
import API from '../../lib/api';
import { TOKENS, formatWait } from '../../components/ui';

/* Website & document tracking — the data source for the Interest score. */
export default function WebsiteTracking() {
  const navigate = useNavigate();
  const [setup, setSetup] = useState(null);
  const [url, setUrl] = useState('');

  const load = async () => {
    try { const res = await API.get('/automations/tracking'); setSetup(res.data); setUrl(res.data.website_url || ''); }
    catch { toast.error('Could not load tracking setup'); }
  };
  useEffect(() => { load(); }, []);

  const saveUrl = async () => {
    try { await API.put('/automations/tracking', { website_url: url }); toast.success('Website saved'); load(); }
    catch (err) { toast.error(err.response?.data?.error || 'Could not save'); }
  };
  const regenerate = async () => {
    if (!confirm('Generate a new key? The old snippet stops working — you must update your website.')) return;
    try { await API.post('/automations/tracking/regenerate'); toast.success('New key generated'); load(); } catch { toast.error('Only admins can do this'); }
  };

  if (!setup) return <div className="skeleton" style={{ height: 320 }} />;
  const last = setup.stats?.last_hit;

  return (
    <div className="max-w-3xl mx-auto flex flex-col" style={{ gap: 22 }}>
      <button onClick={() => navigate('/app/automations')} className="btn-ghost text-sm font-medium flex items-center gap-1.5 self-start"><ArrowLeft size={14} /> Automations</button>
      <div>
        <p className="meta-label" style={{ marginBottom: 6 }}>Interest tracking</p>
        <h1 className="t-display" style={{ fontSize: 'clamp(32px, 5vw, 46px)' }}>See what leads <em>actually read.</em></h1>
        <p className="t-body-sm" style={{ color: TOKENS.ink2, marginTop: 8 }}>
          Time on your website, which pages, which PDF pages they lingered on — all of it feeds each lead's Interest score and AI brief.
        </p>
      </div>

      <div className="grid sm:grid-cols-3" style={{ gap: 12 }}>
        {[
          [Globe, 'Website visits', 'Add the script below. Visitors are matched to leads when they submit a form or open a tracked link.'],
          [FileText, 'Documents', 'Already on. Files shared from Content open in a tracked viewer that records time per page.'],
          [MousePointerClick, 'Tracked links', 'On a lead, “Copy tracked website link” identifies them the moment they click.'],
        ].map(([Icon, title, body]) => (
          <div key={title} style={{ background: TOKENS.surface, border: `1px solid ${TOKENS.hairline}`, borderRadius: 12, padding: 16 }}>
            <Icon size={16} />
            <p style={{ fontWeight: 600, marginTop: 8 }}>{title}</p>
            <p className="t-body-sm" style={{ color: TOKENS.ink2, marginTop: 4 }}>{body}</p>
          </div>
        ))}
      </div>

      <section style={{ background: TOKENS.surface, border: `1px solid ${TOKENS.hairline}`, borderRadius: 12, padding: 20 }}>
        <div className="flex items-center justify-between flex-wrap" style={{ gap: 8 }}>
          <p style={{ fontWeight: 600 }}>1 · Install the script</p>
          <span className="flex items-center mono" style={{ gap: 6, fontSize: 11.5, color: last ? TOKENS.mintDeep : TOKENS.ink3 }}>
            <span className="heat-dot" style={{ background: last ? TOKENS.mintDeep : TOKENS.hairlineStrong }} />
            {last ? `receiving — last hit ${formatWait((Date.now() - new Date(last).getTime()) / 60000)} ago` : 'waiting for first visit'}
          </span>
        </div>
        <p className="t-body-sm" style={{ color: TOKENS.ink2, marginTop: 6 }}>
          Paste before <span className="mono">&lt;/body&gt;</span> on every page. WordPress: any “Insert headers and footers” plugin. Webflow/Wix/Shopify: site settings → custom code.
        </p>
        <div className="flex" style={{ gap: 8, marginTop: 12 }}>
          <code className="mono flex-1 min-w-0 truncate" style={{ background: TOKENS.canvas, border: `1px solid ${TOKENS.hairline}`, borderRadius: 8, padding: '10px 12px', fontSize: 12 }}>{setup.snippet}</code>
          <button onClick={() => { navigator.clipboard.writeText(setup.snippet); toast.success('Copied'); }} className="btn btn-primary"><Copy size={14} /> Copy</button>
        </div>
        <div className="flex items-center justify-between flex-wrap" style={{ gap: 8, marginTop: 12 }}>
          <p className="mono" style={{ fontSize: 11.5, color: TOKENS.ink3 }}>
            Last 24h: {setup.stats?.sessions_24h || 0} visits · {setup.stats?.identified_24h || 0} matched to leads
          </p>
          <button onClick={regenerate} className="btn btn-ghost btn-sm"><RefreshCw size={13} /> New key</button>
        </div>
      </section>

      <section style={{ background: TOKENS.surface, border: `1px solid ${TOKENS.hairline}`, borderRadius: 12, padding: 20 }}>
        <p style={{ fontWeight: 600 }}>2 · Your website address</p>
        <p className="t-body-sm" style={{ color: TOKENS.ink2, marginTop: 6 }}>Used to build tracked links you send to leads (WhatsApp, email).</p>
        <div className="flex" style={{ gap: 8, marginTop: 12 }}>
          <input className="input flex-1" placeholder="https://yourcompany.com" value={url} onChange={(e) => setUrl(e.target.value)} />
          <button onClick={saveUrl} className="btn btn-secondary">Save</button>
        </div>
      </section>

      <p className="t-body-sm" style={{ color: TOKENS.ink3 }}>
        Privacy: tracking only links browsing to a lead after they identify themselves (form or tracked link). Your privacy policy already discloses this — keep a cookie notice on your site if you serve visitors in the EU/UK.
      </p>
    </div>
  );
}
