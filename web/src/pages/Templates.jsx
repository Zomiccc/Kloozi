import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { Upload, Plus, Eye, Copy, Download, Trash2, Pencil, X, LayoutTemplate, Mail, MessageSquare, Smartphone } from 'lucide-react';
import API from '../lib/api';
import useCreateRegistry from '../stores/createStore';
import { Modal } from '../lib/motion';
import { Segmented, TOKENS, EmptyState, Badge } from '../components/ui';

/* ═══════════════════════════════════════════════════════════════
   TEMPLATES — one library for lead forms, emails, WhatsApp and SMS.
   Built-in designs, plus anything the team imports or writes.
   ═══════════════════════════════════════════════════════════════ */

const KINDS = [
  { key: 'form', label: 'Forms', icon: LayoutTemplate, help: 'Full HTML pages. Use {{fields}} where the questions go — or bring your own <form>, any field names work.' },
  { key: 'email', label: 'Emails', icon: Mail, help: 'Full HTML emails. Variables like {{First_Name}} are filled in per lead when sent.' },
  { key: 'whatsapp', label: 'WhatsApp', icon: MessageSquare, help: 'Plain text with variables. Saved to your WhatsApp quick replies.' },
  { key: 'sms', label: 'SMS', icon: Smartphone, help: 'Plain text, keep it under 160 characters for a single SMS.' },
];
const VARIABLES = ['{{First_Name}}', '{{Last_Name}}', '{{Agent_Name}}', '{{Agent_Phone}}', '{{Company_Name}}', '{{City}}', '{{Brochure_Link}}'];
const FORM_TOKENS = ['{{title}}', '{{description}}', '{{fields}}', '{{submit}}', '{{logo}}', '{{brand_color}}', '{{company}}', '{{hero_image}}'];

const STARTERS = {
  form: `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>{{title}}</title>
<style>
  body{margin:0;font-family:system-ui,sans-serif;background:#FAFAF9;color:#1C1917;display:grid;place-items:center;min-height:100vh;padding:24px}
  .box{max-width:440px;width:100%}
  h1{font-size:42px;line-height:1;margin:0 0 12px}
  .fz-field{margin-bottom:12px}.fz-field label{display:block;font-size:13px;opacity:.7;margin-bottom:4px}
  .fz-field input,.fz-field select,.fz-field textarea{width:100%;padding:12px;border-radius:8px;border:1.5px solid #D6D3D1;background:#fff;color:#1C1917;font:inherit}
  button{width:100%;padding:14px;border:0;border-radius:12px;background:{{brand_color}};color:#fff;font-weight:700;font-size:16px}
</style></head>
<body><div class="box">
  <h1>{{title}}</h1><p>{{description}}</p>
  <form>{{fields}}<button type="submit">{{submit}}</button></form>
</div></body></html>`,
  email: `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>A note for {{First_Name}}</title></head>
<body style="margin:0;background:#f4f2ee;font-family:Arial,sans-serif">
  <div style="max-width:560px;margin:24px auto;background:#fff;border-radius:10px;padding:32px">
    <h1 style="font-family:Georgia,serif;font-weight:normal">Hi {{First_Name}},</h1>
    <p>Write your email here.</p>
    <p>— {{Agent_Name}}, {{Company_Name}}</p>
  </div>
</body></html>`,
  whatsapp: 'Hi {{First_Name}}, this is {{Agent_Name}} from {{Company_Name}}. ',
  sms: 'Hi {{First_Name}}, {{Agent_Name}} here from {{Company_Name}}. ',
};

const sourceTone = { system: 'stone', custom: 'accent', imported: 'sky' };

export default function Templates() {
  const navigate = useNavigate();
  const [kind, setKind] = useState('form');
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [previewing, setPreviewing] = useState(null);
  const [editing, setEditing] = useState(null); // {} new | template
  const [importing, setImporting] = useState(false);
  const register = useCreateRegistry((s) => s.register);
  const clear = useCreateRegistry((s) => s.clear);

  const load = async () => {
    setLoading(true);
    try { const res = await API.get('/templates', { params: { kind } }); setItems(res.data.templates || []); }
    catch { toast.error('Could not load templates'); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, [kind]); // eslint-disable-line

  useEffect(() => {
    register([
      { label: 'New template', icon: <Plus size={14} />, run: () => setEditing({}) },
      { label: 'Import template', icon: <Upload size={14} />, run: () => setImporting(true) },
    ]);
    return () => clear();
  }, [register, clear]);

  const use = async (t) => {
    try {
      const res = await API.post(`/templates/${t.id}/use`);
      toast.success(res.data.message);
      if (res.data.url) { navigator.clipboard?.writeText(res.data.url).catch(() => {}); }
      if (res.data.redirect) navigate(res.data.redirect);
    } catch (err) { toast.error(err.response?.data?.error || 'Could not use template'); }
  };
  const duplicate = async (t) => {
    try { const res = await API.post(`/templates/${t.id}/duplicate`); toast.success('Copy created — edit away'); setEditing(res.data.template); load(); }
    catch { toast.error('Could not duplicate'); }
  };
  const remove = async (t) => {
    if (!confirm(`Delete “${t.name}”?`)) return;
    try { await API.delete(`/templates/${t.id}`); toast.success('Deleted'); load(); } catch { toast.error('Could not delete'); }
  };
  const exportT = async (t) => {
    try {
      const res = await API.get(`/templates/${t.id}/export`);
      const blob = new Blob([JSON.stringify(res.data, null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob); a.download = `${t.name.replace(/[^a-z0-9-_ ]/gi, '').trim() || 'template'}.flazyn.json`; a.click();
      URL.revokeObjectURL(a.href);
    } catch { toast.error('Export failed'); }
  };

  const meta = KINDS.find((k) => k.key === kind);
  const system = items.filter((t) => t.is_system);
  const mine = items.filter((t) => !t.is_system);

  return (
    <div>
      <div className="flex items-end justify-between flex-wrap" style={{ gap: 16, marginBottom: 20 }}>
        <div>
          <p className="meta-label" style={{ marginBottom: 6 }}>Library</p>
          <h1 className="t-display" style={{ fontSize: 'clamp(34px, 5vw, 50px)' }}>Templates, <em>your way.</em></h1>
          <p className="t-body-sm" style={{ color: TOKENS.ink2, marginTop: 8, maxWidth: 560 }}>Start from a design, import your own HTML, or write one from scratch. Everything here can be used in forms, campaigns, flows and quick replies.</p>
        </div>
        <div className="flex flex-wrap" style={{ gap: 8 }}>
          <button onClick={() => setImporting(true)} className="btn btn-secondary"><Upload size={14} /> Import</button>
          <button onClick={() => setEditing({ kind })} className="btn btn-primary"><Plus size={14} /> New {meta.label.replace(/s$/, '').toLowerCase()}</button>
        </div>
      </div>

      <div className="flex items-center justify-between flex-wrap" style={{ gap: 12, marginBottom: 18 }}>
        <Segmented layoutId="tpl-kind" options={KINDS.map((k) => ({ key: k.key, label: k.label }))} value={kind} onChange={setKind} />
        <p className="t-body-sm" style={{ color: TOKENS.ink3, maxWidth: 520 }}>{meta.help}</p>
      </div>

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{[0, 1, 2].map((i) => <div key={i} className="skeleton" style={{ height: 260 }} />)}</div>
      ) : (
        <>
          {mine.length > 0 && (
            <>
              <p className="meta-label" style={{ margin: '4px 0 10px' }}>Yours</p>
              <Grid items={mine} onPreview={setPreviewing} onUse={use} onDuplicate={duplicate} onEdit={setEditing} onExport={exportT} onDelete={remove} />
            </>
          )}
          <p className="meta-label" style={{ margin: mine.length ? '26px 0 10px' : '4px 0 10px' }}>Built in</p>
          {system.length === 0
            ? <EmptyState title="Nothing here yet." body="Import a template or create your own." />
            : <Grid items={system} onPreview={setPreviewing} onUse={use} onDuplicate={duplicate} onEdit={setEditing} onExport={exportT} onDelete={remove} />}
        </>
      )}

      <AnimatePresence>
        {previewing && <PreviewModal t={previewing} onClose={() => setPreviewing(null)} onUse={() => { use(previewing); setPreviewing(null); }} />}
        {importing && <ImportModal defaultKind={kind} onClose={() => setImporting(false)} onDone={(t) => { setImporting(false); if (t.kind !== kind) setKind(t.kind); else load(); }} />}
        {editing && <EditorModal initial={editing} defaultKind={kind} onClose={() => setEditing(null)} onSaved={(t) => { setEditing(null); if (t.kind !== kind) setKind(t.kind); else load(); }} />}
      </AnimatePresence>
    </div>
  );
}

function Grid({ items, ...actions }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((t, i) => <TemplateCard key={t.id} t={t} index={i} {...actions} />)}
    </div>
  );
}

function useTemplatePreview(t) {
  const [html, setHtml] = useState(null);
  useEffect(() => {
    if (!t || t.format !== 'html') return;
    let alive = true;
    API.get(`/templates/${t.id}/preview`).then((r) => alive && setHtml(r.data.html)).catch(() => {});
    return () => { alive = false; };
  }, [t?.id, t?.updated_at]); // eslint-disable-line
  return html;
}

function MessageBubble({ t, big = false }) {
  const wa = t.kind === 'whatsapp';
  return (
    <div style={{ background: wa ? '#E9E1D6' : '#F2F2F4', height: '100%', padding: big ? 24 : 16, display: 'flex', alignItems: 'flex-start', justifyContent: 'flex-end' }}>
      <div style={{ maxWidth: '88%', background: wa ? '#DCF8C6' : '#E3E3E8', borderRadius: wa ? '10px 10px 2px 10px' : '16px 16px 4px 16px', padding: '9px 11px', fontSize: big ? 15 : 12.5, lineHeight: 1.45, whiteSpace: 'pre-wrap', color: '#111', boxShadow: '0 1px 1px rgba(0,0,0,.08)' }}>
        {t.content}
      </div>
    </div>
  );
}

function Thumb({ t }) {
  const html = useTemplatePreview(t);
  const ref = useRef(null);
  const [scale, setScale] = useState(0.3);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    const ro = new ResizeObserver(() => setScale(el.clientWidth / 1100));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  if (t.format !== 'html') return <MessageBubble t={t} />;
  return (
    <div ref={ref} style={{ position: 'relative', height: '100%', overflow: 'hidden', background: t.preview_color || TOKENS.canvasAlt }}>
      {html && (
        <iframe
          title={t.name} sandbox="" srcDoc={html} tabIndex={-1}
          style={{ width: 1100, height: Math.ceil(190 / scale), border: 0, transform: `scale(${scale})`, transformOrigin: '0 0', pointerEvents: 'none', position: 'absolute', top: 0, left: 0 }}
        />
      )}
    </div>
  );
}

function TemplateCard({ t, index, onPreview, onUse, onDuplicate, onEdit, onExport, onDelete }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(index * 0.04, 0.3) }}
      className="group flex flex-col"
      style={{ background: TOKENS.surface, border: `1px solid ${TOKENS.hairline}`, borderRadius: 12, overflow: 'hidden' }}
    >
      <button onClick={() => onPreview(t)} className="relative block text-left" style={{ height: 190, borderBottom: `1px solid ${TOKENS.hairline}` }}>
        <Thumb t={t} />
        <span className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity" style={{ background: 'rgba(28,25,23,0.35)' }}>
          <span className="btn btn-sm" style={{ background: TOKENS.surface }}><Eye size={13} /> Preview</span>
        </span>
      </button>
      <div style={{ padding: '12px 14px 14px' }} className="flex flex-col flex-1">
        <div className="flex items-start justify-between" style={{ gap: 8 }}>
          <div className="min-w-0">
            <p className="truncate" style={{ fontWeight: 600 }}>{t.name}</p>
            <p className="meta-label" style={{ marginTop: 2 }}>{t.category || '—'}</p>
          </div>
          <Badge tone={sourceTone[t.source] || 'neutral'}>{t.source}</Badge>
        </div>
        {t.description && <p className="t-body-sm" style={{ color: TOKENS.ink2, marginTop: 8 }}>{t.description}</p>}
        <div className="flex-1" />
        <div className="flex items-center" style={{ gap: 6, marginTop: 12 }}>
          <button onClick={() => onUse(t)} className="btn btn-primary btn-sm flex-1">Use</button>
          {t.editable
            ? <button onClick={() => onEdit(t)} className="btn btn-secondary btn-sm" title="Edit"><Pencil size={13} /></button>
            : <button onClick={() => onDuplicate(t)} className="btn btn-secondary btn-sm" title="Duplicate to edit"><Copy size={13} /></button>}
          <button onClick={() => onExport(t)} className="btn btn-secondary btn-sm" title="Export"><Download size={13} /></button>
          {t.editable && <button onClick={() => onDelete(t)} className="btn btn-secondary btn-sm" title="Delete"><Trash2 size={13} /></button>}
        </div>
      </div>
    </motion.div>
  );
}

function PreviewModal({ t, onClose, onUse }) {
  const html = useTemplatePreview(t);
  const [device, setDevice] = useState('desktop');
  return (
    <Modal open onClose={onClose} maxWidth="2xl" maxHeight="94vh">
      <div className="flex items-center justify-between flex-wrap" style={{ gap: 10, padding: '16px 20px', borderBottom: `1px solid ${TOKENS.hairline}` }}>
        <div>
          <p className="serif" style={{ fontSize: 24, lineHeight: 1.1 }}>{t.name}</p>
          <p className="meta-label">{t.kind} · {t.category}</p>
        </div>
        <div className="flex items-center" style={{ gap: 8 }}>
          {t.format === 'html' && <Segmented layoutId="tpl-device" size="sm" options={[{ key: 'desktop', label: 'Desktop' }, { key: 'mobile', label: 'Phone' }]} value={device} onChange={setDevice} />}
          <button onClick={onUse} className="btn btn-primary btn-sm">Use this</button>
          <button onClick={onClose} className="row-action"><X size={18} /></button>
        </div>
      </div>
      <div style={{ background: TOKENS.canvasAlt, padding: 16, display: 'flex', justifyContent: 'center' }}>
        {t.format === 'html' ? (
          html
            ? <iframe title="preview" sandbox="" srcDoc={html} style={{ width: device === 'mobile' ? 390 : '100%', height: '70vh', border: `1px solid ${TOKENS.hairline}`, borderRadius: 10, background: '#fff', transition: 'width 220ms ease' }} />
            : <div className="skeleton" style={{ width: '100%', height: '70vh' }} />
        ) : (
          <div style={{ width: 390, height: 320, borderRadius: 14, overflow: 'hidden', border: `1px solid ${TOKENS.hairline}` }}><MessageBubble t={t} big /></div>
        )}
      </div>
    </Modal>
  );
}

function ImportModal({ defaultKind, onClose, onDone }) {
  const [content, setContent] = useState('');
  const [filename, setFilename] = useState('');
  const [name, setName] = useState('');
  const [kind, setKind] = useState('auto');
  const [busy, setBusy] = useState(false);

  const onFile = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 400 * 1024) return toast.error('File is too large (max 400 KB)');
    const r = new FileReader();
    r.onload = () => { setContent(String(r.result || '')); setFilename(f.name); if (!name) setName(f.name.replace(/(\.flazyn)?\.[a-z0-9]+$/i, '')); };
    r.readAsText(f);
  };
  const submit = async () => {
    if (!content.trim()) return toast.error('Choose a file or paste something first');
    setBusy(true);
    try {
      const res = await API.post('/templates/import', { content, filename, name: name || undefined, kind: kind === 'auto' ? undefined : kind });
      toast.success(`Imported as a ${res.data.template.kind} template`);
      onDone(res.data.template);
    } catch (err) { toast.error(err.response?.data?.error || 'Import failed'); }
    finally { setBusy(false); }
  };

  return (
    <Modal open onClose={onClose} maxWidth="lg">
      <div style={{ padding: 22 }}>
        <div className="flex items-center justify-between" style={{ marginBottom: 16 }}>
          <p className="serif" style={{ fontSize: 26 }}>Import a template</p>
          <button onClick={onClose} className="row-action"><X size={18} /></button>
        </div>
        <label className="flex flex-col items-center justify-center text-center cursor-pointer" style={{ border: `1.5px dashed ${TOKENS.hairlineStrong}`, borderRadius: 12, padding: '26px 16px', background: TOKENS.canvas }}>
          <Upload size={20} style={{ color: TOKENS.ink2 }} />
          <span style={{ fontWeight: 600, marginTop: 8 }}>{filename || 'Choose a file'}</span>
          <span className="t-body-sm" style={{ color: TOKENS.ink3, marginTop: 2 }}>.html for forms & emails · .txt for messages · .flazyn.json from another workspace</span>
          <input type="file" accept=".html,.htm,.txt,.json" onChange={onFile} className="hidden" />
        </label>
        <p className="meta-label" style={{ margin: '16px 0 6px' }}>…or paste it</p>
        <textarea className="input mono" rows={7} style={{ fontSize: 12 }} placeholder="<html>…</html>  or plain text" value={content} onChange={(e) => { setContent(e.target.value); setFilename(''); }} spellCheck={false} />
        <div className="grid grid-cols-2" style={{ gap: 12, marginTop: 12 }}>
          <div>
            <p className="meta-label" style={{ marginBottom: 6 }}>Name</p>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="My template" />
          </div>
          <div>
            <p className="meta-label" style={{ marginBottom: 6 }}>Type</p>
            <select className="input" value={kind} onChange={(e) => setKind(e.target.value)}>
              <option value="auto">Detect automatically</option>
              {KINDS.map((k) => <option key={k.key} value={k.key}>{k.label}</option>)}
            </select>
          </div>
        </div>
        <button onClick={submit} disabled={busy} className="btn btn-primary w-full" style={{ marginTop: 16 }}>{busy ? 'Importing…' : 'Import'}</button>
      </div>
    </Modal>
  );
}

function EditorModal({ initial, defaultKind, onClose, onSaved }) {
  const isNew = !initial.id;
  const [kind, setKind] = useState(initial.kind || defaultKind || 'form');
  const [name, setName] = useState(initial.name || '');
  const [description, setDescription] = useState(initial.description || '');
  const [content, setContent] = useState(initial.content ?? STARTERS[initial.kind || defaultKind || 'form']);
  const [preview, setPreview] = useState('');
  const [busy, setBusy] = useState(false);
  const isHtml = kind === 'form' || kind === 'email';
  const taRef = useRef(null);

  useEffect(() => {
    if (!isHtml) return;
    const t = setTimeout(() => {
      API.post('/templates/preview', { kind, content }).then((r) => setPreview(r.data.html)).catch(() => {});
    }, 350);
    return () => clearTimeout(t);
  }, [kind, content, isHtml]);

  const insert = (token) => {
    const ta = taRef.current;
    if (!ta) return setContent((c) => c + token);
    const { selectionStart: a, selectionEnd: b } = ta;
    setContent((c) => c.slice(0, a) + token + c.slice(b));
    setTimeout(() => { ta.focus(); ta.selectionStart = ta.selectionEnd = a + token.length; }, 0);
  };

  const save = async () => {
    if (!name.trim()) return toast.error('Give it a name');
    setBusy(true);
    try {
      const res = isNew
        ? await API.post('/templates', { kind, name, description, content })
        : await API.put(`/templates/${initial.id}`, { name, description, content });
      toast.success('Template saved');
      onSaved(res.data.template);
    } catch (err) { toast.error(err.response?.data?.error || 'Could not save'); }
    finally { setBusy(false); }
  };

  const tokens = kind === 'form' ? FORM_TOKENS : VARIABLES;
  const smsLen = kind === 'sms' ? content.length : null;

  return (
    <Modal open onClose={onClose} maxWidth="2xl" maxHeight="96vh">
      <div className="flex items-center justify-between flex-wrap" style={{ gap: 10, padding: '14px 20px', borderBottom: `1px solid ${TOKENS.hairline}` }}>
        <p className="serif" style={{ fontSize: 24 }}>{isNew ? 'New template' : 'Edit template'}</p>
        <div className="flex items-center" style={{ gap: 8 }}>
          <button onClick={save} disabled={busy} className="btn btn-primary btn-sm">{busy ? 'Saving…' : 'Save template'}</button>
          <button onClick={onClose} className="row-action"><X size={18} /></button>
        </div>
      </div>
      <div className={`grid ${isHtml ? 'lg:grid-cols-2' : ''}`} style={{ minHeight: '60vh' }}>
        <div style={{ padding: 18, borderRight: isHtml ? `1px solid ${TOKENS.hairline}` : 'none' }} className="flex flex-col">
          <div className="grid grid-cols-2" style={{ gap: 10 }}>
            <div>
              <p className="meta-label" style={{ marginBottom: 6 }}>Type</p>
              <select className="input" value={kind} disabled={!isNew} onChange={(e) => { setKind(e.target.value); if (isNew) setContent(STARTERS[e.target.value]); }}>
                {KINDS.map((k) => <option key={k.key} value={k.key}>{k.label}</option>)}
              </select>
            </div>
            <div>
              <p className="meta-label" style={{ marginBottom: 6 }}>Name</p>
              <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Ramadan offer" />
            </div>
          </div>
          <p className="meta-label" style={{ margin: '12px 0 6px' }}>Short description</p>
          <input className="input" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="When to use it" />
          <div className="flex items-center justify-between" style={{ margin: '14px 0 6px' }}>
            <p className="meta-label">{isHtml ? 'HTML' : 'Message'}</p>
            {smsLen !== null && <span className="mono" style={{ fontSize: 11, color: smsLen > 160 ? TOKENS.coralDeep : TOKENS.ink3 }}>{smsLen}/160</span>}
          </div>
          <div className="flex flex-wrap" style={{ gap: 4, marginBottom: 8 }}>
            {tokens.map((tk) => <button key={tk} onClick={() => insert(tk)} className="chip mono" style={{ fontSize: 11, textTransform: 'none' }}>{tk}</button>)}
          </div>
          <textarea
            ref={taRef} className="input mono flex-1" spellCheck={false}
            style={{ fontSize: 12.5, minHeight: isHtml ? 360 : 180, lineHeight: 1.5, whiteSpace: 'pre', overflow: 'auto' }}
            value={content} onChange={(e) => setContent(e.target.value)}
          />
        </div>
        {isHtml ? (
          <div style={{ background: TOKENS.canvasAlt, padding: 14 }} className="flex flex-col">
            <p className="meta-label" style={{ marginBottom: 8 }}>Live preview {kind === 'form' && '· sample questions'}</p>
            <iframe title="live preview" sandbox="" srcDoc={preview} style={{ flex: 1, minHeight: 420, border: `1px solid ${TOKENS.hairline}`, borderRadius: 10, background: '#fff' }} />
          </div>
        ) : (
          <div style={{ padding: '0 18px 18px' }}>
            <p className="meta-label" style={{ marginBottom: 8 }}>Preview</p>
            <div style={{ height: 200, borderRadius: 12, overflow: 'hidden', border: `1px solid ${TOKENS.hairline}` }}><MessageBubble t={{ kind, content }} big /></div>
          </div>
        )}
      </div>
    </Modal>
  );
}
