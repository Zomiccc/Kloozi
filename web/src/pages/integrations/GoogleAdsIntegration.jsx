import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Copy, RefreshCw, CheckCircle2, Circle, ExternalLink } from 'lucide-react';
import API from '../../lib/api';
import BrandLogo from '../../components/BrandLogo';
import { Helper } from '../../components/ui';

/* Google Ads lead forms → Flazyn. Free: Google posts each lead to a webhook URL + key. */
export default function GoogleAdsIntegration() {
  const navigate = useNavigate();
  const [setup, setSetup] = useState(null);
  const [rotating, setRotating] = useState(false);

  const load = async () => {
    try { const r = await API.get('/integrations/google-ads/setup'); setSetup(r.data); }
    catch (err) { toast.error(err.response?.data?.error || 'Could not load Google Ads setup'); }
  };
  useEffect(() => {
    load();
    const t = setInterval(load, 15000); // picks up "Send test data" without a refresh
    return () => clearInterval(t);
  }, []);

  const copy = (text, what) => { navigator.clipboard.writeText(text); toast.success(`${what} copied`); };
  const rotate = async () => {
    if (!confirm('Make a new key? You will need to paste the new key into every Google Ads lead form.')) return;
    setRotating(true);
    try { const r = await API.post('/integrations/google-ads/rotate-key'); setSetup(r.data); toast.success('New key ready'); }
    catch { toast.error('Could not make a new key'); }
    finally { setRotating(false); }
  };

  const tested = !!setup?.last_test_at;
  const live = (setup?.leads_received || 0) > 0;

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      <button onClick={() => navigate('/app/automations')} className="text-ink-secondary hover:text-ink-primary" style={{ fontSize: 13, fontWeight: 500 }}>← Back to Automations</button>

      <div className="flex items-center gap-3">
        <BrandLogo brand="google" />
        <div className="flex-1">
          <h1 className="t-h1">Google Ads lead forms</h1>
          <p style={{ color: 'var(--ink-2)', marginTop: 2 }}>Every lead from your Google Ads lead form lands in Flazyn within seconds.</p>
        </div>
        <span className="badge" style={live || tested ? { background: '#ECFDF5', color: '#047857' } : undefined}>
          {live ? 'Receiving leads' : tested ? 'Test lead received' : 'Not connected yet'}
        </span>
      </div>

      <Helper icon="💡">
        No Google approval needed and it's free. You paste two things into your Google Ads lead form: the <b>webhook URL</b> and the <b>key</b> below.
      </Helper>

      <div className="card space-y-4">
        <Field label="Webhook URL" value={setup?.webhook_url} onCopy={() => copy(setup.webhook_url, 'Webhook URL')} />
        <Field label="Key" value={setup?.key} onCopy={() => copy(setup.key, 'Key')}
          extra={<button onClick={rotate} disabled={rotating} className="btn btn-secondary btn-sm"><RefreshCw size={14} className={rotating ? 'animate-spin' : ''} /> New key</button>} />
      </div>

      <div className="card">
        <p style={{ fontWeight: 700, fontSize: 15, marginBottom: 12 }}>How to connect (2 minutes)</p>
        <ol className="space-y-3">
          {[
            <>In Google Ads, open <b>Campaigns → Assets</b> and pick your <b>lead form</b> (or create one).</>,
            <>Scroll to <b>Lead delivery</b> → <b>Webhook integration</b>.</>,
            <>Paste the <b>Webhook URL</b> and the <b>Key</b> from this page.</>,
            <>Click <b>Send test data</b>. A test lead shows up in your Pipeline tagged <i>google-ads-test</i>, and this page turns green.</>,
            <>Save the form. Real leads now arrive automatically and your rules, auto-replies and alerts run on them.</>,
          ].map((step, i) => {
            const done = (i === 3 && tested) || (i === 4 && live);
            return (
              <li key={i} className="flex gap-3" style={{ fontSize: 14, color: 'var(--ink-2)' }}>
                {done ? <CheckCircle2 size={18} style={{ color: '#10B981', flexShrink: 0, marginTop: 1 }} /> : <Circle size={18} style={{ color: 'var(--hairline-strong)', flexShrink: 0, marginTop: 1 }} />}
                <span>{step}</span>
              </li>
            );
          })}
        </ol>
        <a href="https://support.google.com/google-ads/answer/9423234" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 mt-4" style={{ fontSize: 13, fontWeight: 600, color: 'var(--brand)' }}>
          Google's guide to lead form webhooks <ExternalLink size={13} />
        </a>
      </div>

      {(tested || live) && (
        <div className="card flex flex-wrap gap-6">
          <Stat label="Leads received" value={setup.leads_received || 0} />
          <Stat label="Last lead" value={setup.last_lead_at ? new Date(setup.last_lead_at).toLocaleString() : '—'} />
          <Stat label="Last test" value={setup.last_test_at ? new Date(setup.last_test_at).toLocaleString() : '—'} />
        </div>
      )}

      <Helper icon="🔒">
        The URL must be reachable from the internet. While you're testing on this computer, use your ngrok address (set <code>API_URL</code> to it) so Google can reach Flazyn.
      </Helper>
    </div>
  );
}

function Field({ label, value, onCopy, extra }) {
  return (
    <div>
      <p className="meta-label mb-1">{label}</p>
      <div className="flex items-center gap-2">
        <code className="flex-1 truncate" style={{ padding: '10px 12px', background: '#FAFAF9', border: '1px solid var(--hairline)', borderRadius: 10, fontSize: 13 }}>{value || 'Loading…'}</code>
        <button onClick={onCopy} disabled={!value} className="btn btn-secondary btn-sm"><Copy size={14} /> Copy</button>
        {extra}
      </div>
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div>
      <p className="meta-label">{label}</p>
      <p style={{ fontWeight: 700, marginTop: 2 }}>{value}</p>
    </div>
  );
}
