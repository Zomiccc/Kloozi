import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import API from '../../lib/api';
import toast from 'react-hot-toast';
import { Plus, X, Search, Send } from 'lucide-react';
import { fmtDateTime } from '../../lib/marketingShared';
import useCreateRegistry from '../../stores/createStore';

const statusMeta = {
  draft: { label: 'Draft', cls: 'badge-neutral' },
  scheduled: { label: 'Scheduled', cls: 'badge-warning' },
  sending: { label: 'Sending', cls: 'badge-info' },
  completed: { label: 'Sent', cls: 'badge-success' },
  cancelled: { label: 'Cancelled', cls: 'badge-danger' },
};

export default function Campaigns() {
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [openStats, setOpenStats] = useState(null);
  const register = useCreateRegistry((s) => s.register);
  const clearRegistry = useCreateRegistry((s) => s.clear);

  useEffect(() => {
    register([{ label: 'New campaign', icon: <Send size={14} />, run: () => setShowCreate(true) }]);
    return () => clearRegistry();
  }, [register, clearRegistry]);

  useEffect(() => { load(); }, []);
  const load = async () => {
    try {
      const all = (await API.get('/campaigns')).data.campaigns;
      setCampaigns(all.filter((c) => c.channel === 'email'));
    } catch { toast.error('Failed to load campaigns'); }
    finally { setLoading(false); }
  };

  const send = async (c) => {
    try { await API.post(`/campaigns/${c.id}/send`); toast.success(`"${c.name}" is sending`); load(); }
    catch (err) { toast.error(err.response?.data?.error || 'Send failed'); }
  };
  const cancel = async (c) => {
    try { await API.post(`/campaigns/${c.id}/cancel`); toast.success('Cancelled'); load(); }
    catch { toast.error('Cancel failed'); }
  };
  const toggleStats = async (c) => {
    if (openStats?.id === c.id) return setOpenStats(null);
    try {
      const res = await API.get(`/campaigns/${c.id}/stats`);
      setOpenStats({ id: c.id, ...res.data });
    } catch { toast.error('Failed to load stats'); }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 style={{ fontSize: '32px', fontWeight: 650, letterSpacing: '-0.01em' }}>Campaigns</h1>
        <p className="text-ink-secondary mt-1" style={{ fontSize: '15px' }}>
          One email, one moment — sent to a whole segment or handpicked leads.
        </p>
      </div>

      {loading ? (
        <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="skeleton h-16" />)}</div>
      ) : campaigns.length === 0 ? (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="pt-16 max-w-[560px]">
          <p style={{ fontSize: '22px', fontWeight: 600 }}>No campaigns yet.</p>
          <p className="text-ink-secondary mt-2" style={{ fontSize: '15px' }}>
            For always-on automation use Flows; for a single broadcast, use the + in the top bar.
          </p>
        </motion.div>
      ) : (
        <div>
          {campaigns.map((c, idx) => {
            const meta = statusMeta[c.status] || statusMeta.draft;
            return (
              <motion.div
                key={c.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(idx * 0.04, 0.3), duration: 0.2 }}
                className="group hairline-b py-4 hover-accent-left"
              >
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline gap-3 flex-wrap">
                      <h3 className="font-semibold" style={{ fontSize: '15px' }}>{c.name}</h3>
                      <span className={`badge ${meta.cls}`}>{meta.label}</span>
                      {c.segment_name && <span className="badge badge-info">segment · {c.segment_name}</span>}
                    </div>
                    <div className="flex flex-wrap items-center gap-x-5 gap-y-1 mt-1 mono text-ink-secondary" style={{ fontSize: '12px' }}>
                      <span>{c.recipients_count} audience</span>
                      <span>{c.sent_count} sent</span>
                      <span>{c.opened_count} opened</span>
                      <span>{c.clicked_count} clicked</span>
                      {c.scheduled_at && c.status === 'scheduled' && (
                        <span className="text-amber-700">fires {fmtDateTime(c.scheduled_at)}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 opacity-60 group-hover:opacity-100 transition-opacity flex-shrink-0">
                    {(c.status === 'draft') && <button onClick={() => send(c)} className="btn btn-primary !min-h-0 !py-1.5 text-sm flex items-center gap-1.5"><Send size={13} /> Send now</button>}
                    {(c.status === 'scheduled' || c.status === 'sending') && <button onClick={() => cancel(c)} className="btn-danger text-sm font-medium">Cancel</button>}
                    <button onClick={() => toggleStats(c)} className="btn-ghost text-sm font-medium">{openStats?.id === c.id ? 'Hide stats' : 'Stats'}</button>
                  </div>
                </div>

                {openStats?.id === c.id && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2, ease: 'easeOut' }}
                    className="overflow-hidden"
                  >
                  <div className="mt-4 grid grid-cols-2 md:grid-cols-5 gap-6 hairline pt-4">
                    {[
                      ['Open rate', `${openStats.openRate}%`, openStats.openedCount],
                      ['Click rate', `${openStats.clickRate}%`, openStats.clickedCount],
                      ['Delivered', `${openStats.deliveryRate}%`, openStats.sentCount],
                      ['Won leads', openStats.convertedCount, ''],
                      ['Attributed value', Number(openStats.attributedValue).toLocaleString(), 'budget basis'],
                    ].map(([l, big, sub], i) => (
                      <motion.div key={l} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
                        <p className="mono" style={{ fontSize: '24px', fontWeight: 600 }}>{big}</p>
                        <p className="meta-label">{l}{sub ? ` · ${sub}` : ''}</p>
                      </motion.div>
                    ))}
                    <p className="col-span-2 md:col-span-5 text-ink-tertiary" style={{ fontSize: '12px' }}>
                      Opened/clicked come from real per-recipient tracking events. "Won" counts campaign recipients whose lead is currently in a Won stage; attributed value sums their budget figures.
                    </p>
                  </div>
                  </motion.div>
                )}
              </motion.div>
            );
          })}
        </div>
      )}

      {showCreate && <Compose onClose={() => setShowCreate(false)} onSaved={() => { setShowCreate(false); load(); }} />}
    </div>
  );
}

/* ───────────────────────── Compose ───────────────────────── */

function Compose({ onClose, onSaved }) {
  const [name, setName] = useState('');
  const [audienceMode, setAudienceMode] = useState('segment');   // segment | manual
  const [segments, setSegments] = useState([]);
  const [segmentId, setSegmentId] = useState('');
  const [leads, setLeads] = useState([]);
  const [q, setQ] = useState('');
  const [picked, setPicked] = useState(new Set());
  const [emails, setEmails] = useState([]);
  const [emailId, setEmailId] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [scheduleAt, setScheduleAt] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    API.get('/marketing/segments').then((r) => setSegments(r.data.segments)).catch(() => {});
    API.get('/marketing/emails').then((r) => setEmails(r.data.emails)).catch(() => {});
  }, []);

  useEffect(() => {
    if (audienceMode !== 'manual') return;
    const t = setTimeout(async () => {
      try {
        const r = await API.get(`/leads?search=${encodeURIComponent(q)}&limit=30`);
        setLeads(r.data.leads || r.data);
      } catch { setLeads([]); }
    }, 250);
    return () => clearTimeout(t);
  }, [q, audienceMode]);

  useEffect(() => {
    const em = emails.find((x) => x.id === emailId);
    if (em) setSubject(em.subject || '');
  }, [emailId]); // eslint-disable-line

  const save = async () => {
    if (!name.trim()) return toast.error('Name required');
    if (audienceMode === 'segment' && !segmentId) return toast.error('Pick a segment');
    if (audienceMode === 'manual' && picked.size === 0) return toast.error('Pick at least one lead');
    setSaving(true);
    try {
      const payload = {
        name,
        channel: 'email',
        type: 'bulk',
        marketing_email_id: emailId || undefined,
        subject: subject || undefined,
        body: body || undefined,
        segment_id: audienceMode === 'segment' ? segmentId : undefined,
        lead_ids: audienceMode === 'manual' ? [...picked] : undefined,
        scheduled_at: scheduleAt ? new Date(scheduleAt).toISOString() : undefined,
      };
      await API.post('/campaigns', payload);
      toast.success(scheduleAt ? 'Campaign scheduled' : 'Campaign created as draft');
      onSaved();
    } catch (err) { toast.error(err.response?.data?.error || 'Create failed'); }
    finally { setSaving(false); }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
      className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-0 sm:p-6 overflow-y-auto"
      style={{ background: 'rgba(28,25,23,0.2)' }}
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.97, y: 8 }}
        transition={{ type: 'spring', stiffness: 360, damping: 30 }}
        className="card-raised w-full max-w-2xl my-0 sm:my-8 !p-0"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 pt-5 pb-4 hairline-b sticky top-0 bg-white z-10 rounded-t-lg">
          <h2 style={{ fontSize: '22px', fontWeight: 600 }}>New email campaign</h2>
          <button onClick={onClose} className="text-ink-tertiary hover:text-ink-primary"><X size={18} /></button>
        </div>

        <div className="px-6 py-5 space-y-5 max-h-[70vh] overflow-y-auto">
          <div>
            <p className="meta-label mb-1">Name</p>
            <input className="input" placeholder='e.g. "March offer blast"' value={name} onChange={(e) => setName(e.target.value)} />
          </div>

          {/* Audience */}
          <div className="hairline pt-4">
            <p className="meta-label mb-2">Audience</p>
            <div className="flex mb-3" style={{ border: '1px solid #E7E5E4', borderRadius: '8px', width: 'fit-content' }}>
              {[['segment', 'From segment'], ['manual', 'Pick leads']].map(([v, l]) => (
                <button key={v} onClick={() => setAudienceMode(v)}
                  className={`px-3 py-1.5 text-sm font-semibold ${audienceMode === v ? 'bg-brand text-white' : 'text-ink-secondary'}`}>
                  {l}
                </button>
              ))}
            </div>
            {audienceMode === 'segment' ? (
              segments.length === 0
                ? <p className="text-sm text-ink-tertiary">No segments yet — create one under Marketing → Segments.</p>
                : (
                  <>
                    <select className="input" value={segmentId} onChange={(e) => setSegmentId(e.target.value)}>
                      <option value="">Choose a segment…</option>
                      {segments.map((s) => <option key={s.id} value={s.id}>{s.name} ({s.live_count ?? '?'} leads)</option>)}
                    </select>
                    <p className="text-ink-tertiary mt-1.5" style={{ fontSize: '12px' }}>
                      Membership is evaluated when the campaign sends — unsubscribed leads are skipped automatically.
                    </p>
                  </>
                )
            ) : (
              <>
                <div className="relative mb-2">
                  <Search size={14} className="absolute left-2 top-2.5 text-ink-tertiary" />
                  <input autoFocus className="input !pl-7" placeholder="Search leads…" value={q} onChange={(e) => setQ(e.target.value)} />
                </div>
                <div className="max-h-44 overflow-y-auto space-y-1">
                  {(leads || []).map((l) => (
                    <label key={l.id} className="flex items-center gap-3 py-1 cursor-pointer hover-accent-left px-1">
                      <input type="checkbox" checked={picked.has(l.id)}
                        onChange={(e) => {
                          const n = new Set(picked);
                          e.target.checked ? n.add(l.id) : n.delete(l.id);
                          setPicked(n);
                        }} />
                      <span className="flex-1 text-sm font-medium">{l.first_name} {l.last_name}</span>
                      <span className="text-ink-tertiary text-xs truncate max-w-[180px]">{l.email}</span>
                    </label>
                  ))}
                </div>
                <p className="mono text-ink-secondary mt-1" style={{ fontSize: '12px' }}>{picked.size} selected</p>
              </>
            )}
          </div>

          {/* Email */}
          <div className="hairline pt-4 space-y-3">
            <p className="meta-label">Email</p>
            <select className="input" value={emailId} onChange={(e) => setEmailId(e.target.value)}>
              <option value="">Quick write (no saved design)…</option>
              {emails.map((em) => <option key={em.id} value={em.id}>Use saved: {em.name}</option>)}
            </select>
            {!emailId && (
              <>
                <input className="input" placeholder="Subject — hi {{First_Name}}…" value={subject} onChange={(e) => setSubject(e.target.value)} />
                <textarea className="input" rows={4} placeholder="<p>Plain HTML body…</p>" value={body} onChange={(e) => setBody(e.target.value)} />
                <button className="text-xs font-semibold text-accent-deep hover:underline"
                  onClick={() => window.open('/app/marketing/emails/new', '_blank')}>
                  Or design one properly in the builder ↗
                </button>
              </>
            )}
          </div>

          {/* Schedule */}
          <div className="hairline pt-4">
            <p className="meta-label mb-1">When</p>
            <input type="datetime-local" className="input sm:max-w-xs" value={scheduleAt}
              onChange={(e) => setScheduleAt(e.target.value)} />
            <p className="text-ink-tertiary mt-1" style={{ fontSize: '12px' }}>
              {scheduleAt ? `Fires automatically at ${fmtDateTime(scheduleAt)}` : 'Leave empty to create a draft you send manually.'}
            </p>
          </div>
        </div>

        <div className="flex justify-end gap-3 px-6 py-4 hairline-t sticky bottom-0 bg-white rounded-b-lg">
          <button onClick={onClose} className="btn-ghost font-medium">Cancel</button>
          <motion.button whileTap={{ scale: 0.97 }} onClick={save} disabled={saving} className="btn btn-primary flex items-center gap-2">
            <Send size={14} /> {saving ? 'Creating…' : scheduleAt ? 'Schedule campaign' : 'Create draft'}
          </motion.button>
        </div>
      </motion.div>
    </motion.div>
  );
}
