import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import API from '../../lib/api';
import toast from 'react-hot-toast';
import { ArrowLeft, FileText, Plus, Trash2, Copy, Edit, ExternalLink, Eye } from 'lucide-react';

export default function LeadFormsBuilder() {
  const navigate = useNavigate();
  const [pages, setPages] = useState([]);
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState(null);

  useEffect(() => { loadPages(); }, []);

  const loadPages = async () => {
    try { const res = await API.get('/automations/lead-form-pages'); setPages(res.data.pages || []); } catch {}
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this form page?')) return;
    try { await API.delete(`/automations/lead-form-pages/${id}`); toast.success('Deleted'); loadPages(); } catch { toast.error('Failed'); }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <button onClick={() => navigate('/automations')} className="flex items-center gap-2 text-sm text-dark-400 hover:text-dark-600"><ArrowLeft size={16} /> Back to Automations</button>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-primary-100 rounded-xl flex items-center justify-center"><FileText size={24} className="text-primary-600" /></div>
          <div><h2 className="text-xl font-bold text-dark-900">CRM Final Lead Forms</h2><p className="text-sm text-dark-400">Create lead forms and receive instant alerts</p></div>
        </div>
        <button onClick={() => { setEditing(null); setShowCreate(true); }} className="btn btn-primary flex items-center gap-2"><Plus size={16} /> New Form</button>
      </div>

      {pages.length === 0 ? (
        <div className="card text-center py-12">
          <FileText size={48} className="text-dark-300 mx-auto mb-3" />
          <p className="text-dark-400">No lead forms yet. Create your first form!</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {pages.map(p => (
            <div key={p.id} className="card">
              <div className="flex items-start justify-between mb-3">
                <div><h3 className="font-semibold text-dark-900">{p.name}</h3><p className="text-xs text-dark-400">{p.title}</p></div>
                <span className={`badge ${p.is_active ? 'bg-green-100 text-green-700' : 'bg-dark-100 text-dark-600'}`}>{p.is_active ? 'Active' : 'Inactive'}</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-dark-400 mb-3">
                <span>Views: {p.views || 0}</span><span>•</span><span>Submissions: {p.submissions || 0}</span>
              </div>
              <div className="flex gap-2">
                <button onClick={() => window.open(`/api/automations/lead-form/${p.form_key}`, '_blank')} className="btn btn-secondary text-sm flex items-center gap-1 flex-1"><ExternalLink size={14} /> View</button>
                <button onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/api/automations/lead-form/${p.form_key}`); toast.success('Link copied!'); }} className="btn btn-secondary text-sm p-2"><Copy size={14} /></button>
                <button onClick={() => { setEditing(p); setShowCreate(true); }} className="btn btn-secondary text-sm p-2"><Edit size={14} /></button>
                <button onClick={() => handleDelete(p.id)} className="btn btn-danger text-sm p-2"><Trash2 size={14} /></button>
              </div>
            </div>
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
  const [primaryColor, setPrimaryColor] = useState(page?.branding?.primary_color || '#2563eb');
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
    const payload = { name, title, description, thank_you_message: thankYou, redirect_url: redirectUrl, branding: { logo_url: logoUrl, primary_color: primaryColor }, fields };
    try {
      if (page) { await API.put(`/automations/lead-form-pages/${page.id}`, payload); toast.success('Form updated'); }
      else { await API.post('/automations/lead-form-pages', payload); toast.success('Form created'); }
      onSaved();
    } catch { toast.error('Failed'); }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4"><h2 className="text-xl font-bold">{page ? 'Edit Form' : 'New Lead Form'}</h2><button onClick={onClose}>✕</button></div>
        <div className="space-y-4">
          <div><label className="text-sm font-medium">Form Name *</label><input className="input mt-1" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Website Contact Form" /></div>
          <div><label className="text-sm font-medium">Form Title</label><input className="input mt-1" value={title} onChange={e => setTitle(e.target.value)} placeholder="Contact Us" /></div>
          <div><label className="text-sm font-medium">Description</label><textarea className="input mt-1" rows={2} value={description} onChange={e => setDescription(e.target.value)} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-sm font-medium">Logo URL</label><input className="input mt-1" value={logoUrl} onChange={e => setLogoUrl(e.target.value)} placeholder="https://..." /></div>
            <div><label className="text-sm font-medium">Primary Color</label><input type="color" className="input mt-1 h-10" value={primaryColor} onChange={e => setPrimaryColor(e.target.value)} /></div>
          </div>
          <div><label className="text-sm font-medium">Thank You Message</label><input className="input mt-1" value={thankYou} onChange={e => setThankYou(e.target.value)} /></div>
          <div><label className="text-sm font-medium">Redirect URL (optional)</label><input className="input mt-1" value={redirectUrl} onChange={e => setRedirectUrl(e.target.value)} placeholder="https://..." /></div>

          <div>
            <div className="flex items-center justify-between mb-2"><label className="text-sm font-medium">Form Fields</label><button onClick={addField} className="text-xs text-primary-600 flex items-center gap-1"><Plus size={14} /> Add Field</button></div>
            {fields.map((f, i) => (
              <div key={i} className="flex items-center gap-2 mb-2">
                <input className="input flex-1" placeholder="Field name" value={f.name} onChange={e => updateField(i, 'name', e.target.value)} />
                <input className="input flex-1" placeholder="Label" value={f.label} onChange={e => updateField(i, 'label', e.target.value)} />
                <select className="input w-32" value={f.type} onChange={e => updateField(i, 'type', e.target.value)}>{fieldTypes.map(t => <option key={t} value={t}>{t}</option>)}</select>
                <label className="flex items-center gap-1 text-xs"><input type="checkbox" checked={f.required} onChange={e => updateField(i, 'required', e.target.checked)} /> Req</label>
                <button onClick={() => removeField(i)} className="text-red-500 p-1"><Trash2 size={14} /></button>
              </div>
            ))}
          </div>

          <button onClick={handleSave} className="btn btn-primary w-full">{page ? 'Update Form' : 'Create Form'}</button>
        </div>
      </div>
    </div>
  );
}
