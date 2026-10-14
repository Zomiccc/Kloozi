import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import API from '../../lib/api';
import toast from 'react-hot-toast';
import { ArrowLeft, Plus, Trash2, Copy, ExternalLink } from 'lucide-react';
import useCreateRegistry from '../../stores/createStore';

export default function LeadFormsBuilder() {
  const navigate = useNavigate();
  const [pages, setPages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState(null);
  const register = useCreateRegistry((s) => s.register);
  const clearRegistry = useCreateRegistry((s) => s.clear);

  useEffect(() => {
    register([{ label: 'New lead form', icon: <Plus size={14} />, run: () => { setEditing(null); setShowCreate(true); } }]);
    return () => clearRegistry();
  }, [register, clearRegistry]);

  useEffect(() => { loadPages(); }, []);

  const loadPages = async () => {
    try { const res = await API.get('/automations/lead-form-pages'); setPages(res.data.pages || []); }
    catch {}
    finally { setLoading(false); }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this form page?')) return;
    try { await API.delete(`/automations/lead-form-pages/${id}`); toast.success('Deleted'); loadPages(); } catch { toast.error('Failed'); }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <button onClick={() => navigate('/app/automations')} className="btn-ghost text-sm font-medium flex items-center gap-1.5">
        <ArrowLeft size={14} /> Automations
      </button>

      <div>
        <h1 style={{ fontSize: '32px', fontWeight: 650, letterSpacing: '-0.01em' }}>Lead Forms</h1>
        <p className="text-ink-secondary mt-1" style={{ fontSize: '15px' }}>
          Share a link anywhere — submissions land in Flazyn as leads, instantly.
        </p>
      </div>

      {loading ? (
        <div className="grid sm:grid-cols-2 gap-6">{[1, 2].map((i) => <div key={i} className="skeleton h-40" />)}</div>
      ) : pages.length === 0 ? (
        <div className="pt-16 max-w-[560px]">
          <p style={{ fontSize: '22px', fontWeight: 600 }}>No forms yet.</p>
          <p className="text-ink-secondary mt-2" style={{ fontSize: '15px' }}>
            Build one in a minute — pick your fields, get a shareable link.
          </p>
        </div>
      ) : (
        <div>
          {pages.map((p, idx) => (
            <motion.div
              key={p.id}
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(idx * 0.04, 0.3), duration: 0.2 }}
              className="group hairline-b py-4 hover-accent-left"
            >
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="min-w-0">
                  <div className="flex items-center gap-3 flex-wrap">
                    <h3 className="font-semibold" style={{ fontSize: '15px' }}>{p.name}</h3>
                    <span className={`badge ${p.is_active ? 'badge-success' : 'badge-neutral'}`}>{p.is_active ? 'Live' : 'Off'}</span>
                  </div>
                  {p.title && p.title !== p.name && <p className="text-ink-secondary mt-0.5" style={{ fontSize: '13px' }}>{p.title}</p>}
                  <div className="flex items-center gap-5 mt-2">
                    <span className="mono text-ink-secondary" style={{ fontSize: '13px' }}>{p.views || 0} views</span>
                    <span className="mono text-ink-secondary" style={{ fontSize: '13px' }}>{p.submissions || 0} submissions</span>
                    {(p.fields?.length || 0) > 0 && <span className="text-ink-secondary" style={{ fontSize: '13px' }}>{p.fields.length} fields</span>}
                  </div>
                </div>
                <div className="flex items-center gap-4 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity flex-shrink-0">
                  <button onClick={() => window.open(`/api/automations/lead-form/${p.form_key}`, '_blank')} className="btn-ghost text-sm font-medium flex items-center gap-1.5"><ExternalLink size={13} /> Open</button>
                  <button onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/api/automations/lead-form/${p.form_key}`); toast.success('Link copied'); }} className="btn-ghost text-sm font-medium flex items-center gap-1.5"><Copy size={13} /> Copy link</button>
                  <button onClick={() => { setEditing(p); setShowCreate(true); }} className="btn-ghost text-sm font-medium">Edit</button>
                  <button onClick={() => handleDelete(p.id)} className="btn-danger text-sm font-medium"><Trash2 size={14} /></button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {showCreate && <FormBuilderModal page={editing} onClose={() => { setShowCreate(false); setEditing(null); }} onSaved={() => { setShowCreate(false); setEditing(null); loadPages(); }} />}
    </div>
  );
}

function FormBuilderModal({ page, onClose, onSaved }) {
  const [name, setName] = useState(page?.name || '');
  const [title, setTitle] = useState(page?.title || '');
  const [description, setDescription] = useState(page?.description || '');
  const [thankYou, setThankYou] = useState(page?.thank_you_message || 'Thank you! We will contact you soon.');
  const [redirectUrl, setRedirectUrl] = useState(page?.redirect_url || '');
  const [logoUrl, setLogoUrl] = useState(page?.branding?.logo_url || '');
  const [primaryColor, setPrimaryColor] = useState(page?.branding?.primary_color || '#1C1917');
  const [templateId, setTemplateId] = useState(page?.template_id || null);
  const [submitLabel, setSubmitLabel] = useState(page?.branding?.submit_label || 'Send');
  const [company, setCompany] = useState(page?.branding?.company_name || '');
  const [designs, setDesigns] = useState([]);
  useEffect(() => {
    API.get('/templates', { params: { kind: 'form' } }).then((r) => setDesigns(r.data.templates || [])).catch(() => {});
  }, []);
  const [fields, setFields] = useState(page?.fields || [
    { name: 'first_name', label: 'First Name', type: 'text', required: true },
    { name: 'phone', label: 'Phone', type: 'phone', required: true },
    { name: 'email', label: 'Email', type: 'email', required: false },
  ]);

  const fieldTypes = ['text', 'phone', 'email', 'number', 'textarea', 'select', 'date'];
  const addField = () => setFields([...fields, { name: `field_${Date.now()}`, label: 'New Field', type: 'text', required: false }]);
  const updateField = (i, key, val) => setFields(fields.map((f, idx) => idx === i ? { ...f, [key]: val } : f));
  const removeField = (i) => setFields(fields.filter((_, idx) => idx !== i));

  const handleSave = async () => {
    if (!name) return toast.error('Form name required');
    const payload = { name, title, description, thank_you_message: thankYou, redirect_url: redirectUrl, branding: { ...(page?.branding || {}), logo_url: logoUrl, primary_color: primaryColor, submit_label: submitLabel, company_name: company }, fields, template_id: templateId };
    try {
      if (page) { await API.put(`/automations/lead-form-pages/${page.id}`, payload); toast.success('Form updated'); }
      else { await API.post('/automations/lead-form-pages', payload); toast.success('Form created'); }
      onSaved();
    } catch { toast.error('Failed to save'); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-0 sm:p-6 overflow-y-auto" style={{ background: 'rgba(28,25,23,0.25)' }} onClick={onClose}>
      <div className="card-raised w-full max-w-2xl my-auto max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-6">
          <h2 style={{ fontSize: '18px', fontWeight: 600 }}>{page ? 'Edit form' : 'New lead form'}</h2>
          <button onClick={onClose} className="text-ink-tertiary hover:text-ink-primary transition-colors">✕</button>
        </div>

        <div className="space-y-5">
          <div>
            <p className="meta-label mb-2">Design</p>
            <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1 mb-4">
              {designs.map((d) => {
                const on = templateId ? templateId === d.id : d.name === 'Ledger';
                return (
                  <button key={d.id} type="button" onClick={() => setTemplateId(d.id)} className="flex-shrink-0 text-left"
                    style={{ width: 118, borderRadius: 10, border: `1.5px solid ${on ? '#1C1917' : '#E7E5E4'}`, padding: 6, background: '#FFFFFF' }}>
                    <span className="block" style={{ height: 52, borderRadius: 6, background: d.preview_color || '#F5F5F4', border: '1px solid rgba(28,25,23,0.08)' }} />
                    <span className="block truncate" style={{ fontSize: 12, fontWeight: 600, marginTop: 6 }}>{d.name}</span>
                    <span className="block truncate" style={{ fontSize: 10.5, color: '#A8A29E' }}>{d.is_system ? d.category : 'Yours'}</span>
                  </button>
                );
              })}
            </div>
            <p className="meta-label mb-1">Internal name *</p>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Website contact form" />
          </div>
          <div>
            <p className="meta-label mb-1">Headline shown to visitors</p>
            <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Contact us" />
          </div>
          <div>
            <p className="meta-label mb-1">Description</p>
            <textarea className="input" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <p className="meta-label mb-1">Logo URL</p>
              <input className="input mono" style={{ fontSize: '13px' }} value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)} placeholder="https://…" />
            </div>
            <div>
              <p className="meta-label mb-1">Accent color</p>
              <div className="flex items-center gap-3 h-10">
                <input type="color" value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)} className="w-9 h-9 cursor-pointer border-0 bg-transparent p-0" />
                <span className="mono text-ink-secondary" style={{ fontSize: '13px' }}>{primaryColor}</span>
              </div>
            </div>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <p className="meta-label mb-1">Button label</p>
              <input className="input mb-3" value={submitLabel} onChange={(e) => setSubmitLabel(e.target.value)} />
              <p className="meta-label mb-1">Company name (shown on some designs)</p>
              <input className="input mb-3" value={company} onChange={(e) => setCompany(e.target.value)} />
              <p className="meta-label mb-1">Thank-you message</p>
              <input className="input" value={thankYou} onChange={(e) => setThankYou(e.target.value)} />
            </div>
            <div>
              <p className="meta-label mb-1">Redirect URL (optional)</p>
              <input className="input mono" style={{ fontSize: '13px' }} value={redirectUrl} onChange={(e) => setRedirectUrl(e.target.value)} placeholder="https://…" />
            </div>
          </div>

          <div className="hairline pt-5">
            <div className="flex items-center justify-between mb-3">
              <p className="meta-label">Fields</p>
              <button onClick={addField} className="btn-ghost text-sm font-medium flex items-center gap-1"><Plus size={14} /> Add field</button>
            </div>
            <div className="space-y-3">
              {fields.map((f, i) => (
                <div key={i} className="flex items-end gap-2 flex-wrap">
                  <div className="min-w-[110px] flex-1">
                    <input className="input" placeholder="Field key" value={f.name} onChange={(e) => updateField(i, 'name', e.target.value)} />
                  </div>
                  <div className="min-w-[110px] flex-1">
                    <input className="input" placeholder="Label shown" value={f.label} onChange={(e) => updateField(i, 'label', e.target.value)} />
                  </div>
                  <select className="input flex-shrink-0" style={{ width: '104px' }} value={f.type} onChange={(e) => updateField(i, 'type', e.target.value)}>
                    {fieldTypes.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                  <label className="flex items-center gap-1.5 cursor-pointer select-none pb-2" style={{ fontSize: '13px' }}>
                    <input type="checkbox" checked={!!f.required} onChange={(e) => updateField(i, 'required', e.target.checked)} /> Req
                  </label>
                  <button onClick={() => removeField(i)} className="btn-danger mb-0.5"><Trash2 size={14} /></button>
                </div>
              ))}
            </div>
          </div>

          <button onClick={handleSave} className="btn btn-primary w-full">{page ? 'Save changes' : 'Create form'}</button>
        </div>
      </div>
    </div>
  );
}
