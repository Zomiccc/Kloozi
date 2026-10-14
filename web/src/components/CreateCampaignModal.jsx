import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import API from '../lib/api';
import { X } from 'lucide-react';

// Shared campaign creation modal for the WhatsApp / SMS campaign pages.
// (Email campaigns live in the rebuilt Marketing module.)
export function CreateCampaignModal({ channel, onClose, onSave }) {
  const [form, setForm] = useState({ name: '', type: 'bulk', channel, template_id: '', subject: '', body: '', filter_config: {}, scheduled_at: '' });
  const [templates, setTemplates] = useState([]);
  const [audience, setAudience] = useState(null);

  useEffect(() => {
    const t = setTimeout(() => {
      API.post('/campaigns/preview-audience', { channel, filter_config: form.filter_config })
        .then((r) => setAudience(r.data.count)).catch(() => setAudience(null));
    }, 300);
    return () => clearTimeout(t);
  }, [channel, form.filter_config]);

  const submit = () => {
    if (!form.name.trim()) return toast.error('Name is required');
    if (!form.template_id && !form.body.trim()) return toast.error('Pick a template or write a message');
    onSave(form);
  };

  useEffect(() => {
    const endpoint = channel === 'email' ? '/emails/templates' : channel === 'whatsapp' ? '/whatsapp/templates' : '/sms/templates';
    API.get(endpoint).then(res => setTemplates(res.data.templates || res.data)).catch(() => {});
  }, [channel]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(28,25,23,0.25)' }} onClick={onClose}>
      <div className="card-raised w-full max-w-lg max-h-[90vh] overflow-y-auto animate-scale-in" style={{ borderRadius: '10px' }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between hairline-b pb-4 mb-4">
          <h2 className="text-ink-primary capitalize" style={{ fontSize: '22px', fontWeight: 600 }}>New {channel} campaign</h2>
          <button onClick={onClose} className="text-ink-tertiary hover:text-ink-primary transition-colors"><X size={18} /></button>
        </div>
        <div className="space-y-4">
          <div>
            <p className="meta-label mb-1">Name</p>
            <input className="input" placeholder="Campaign name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div>
            <p className="meta-label mb-1">Template</p>
            <select className="input" value={form.template_id} onChange={(e) => setForm({ ...form, template_id: e.target.value })}>
              <option value="">Select template</option>
              {templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
          {channel === 'email' && (
            <div>
              <p className="meta-label mb-1">Subject (optional override)</p>
              <input className="input" value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} />
            </div>
          )}
          <div>
            <p className="meta-label mb-1">{form.template_id ? 'Message (optional, replaces the template)' : 'Message'}</p>
            <textarea className="input" rows="3" value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} />
          </div>
          <div className="hairline pt-3 space-y-3">
            <p className="meta-label">Filters (optional)</p>
            <div>
              <p className="meta-label mb-1">Stage</p>
              <select className="input" value={form.filter_config.stage || ''} onChange={(e) => setForm({ ...form, filter_config: { ...form.filter_config, stage: e.target.value } })}>
                <option value="">All stages</option><option value="new">New</option><option value="contacted">Contacted</option><option value="interested">Interested</option><option value="negotiating">Negotiating</option><option value="won">Won</option><option value="lost">Lost</option>
              </select>
            </div>
            <div>
              <p className="meta-label mb-1">City</p>
              <input className="input" placeholder="City filter" value={form.filter_config.city || ''} onChange={(e) => setForm({ ...form, filter_config: { ...form.filter_config, city: e.target.value } })} />
            </div>
          </div>
          <p className="text-ink-primary mono" style={{ fontSize: '14px', fontWeight: 500 }}>
            {audience === null ? '…' : `${audience} lead${audience === 1 ? '' : 's'} with a phone number`}
          </p>
          <div>
            <p className="meta-label mb-1">Schedule</p>
            <input type="datetime-local" className="input" value={form.scheduled_at} onChange={(e) => setForm({ ...form, scheduled_at: e.target.value })} />
            <p className="text-ink-tertiary mt-1" style={{ fontSize: '13px' }}>{form.scheduled_at ? 'Will be scheduled for selected time' : 'Will be created as draft'}</p>
          </div>
          <div className="flex justify-end gap-3 hairline pt-4">
            <button onClick={onClose} className="text-ink-secondary hover:text-ink-primary underline underline-offset-4 transition-colors" style={{ fontSize: '14px' }}>Cancel</button>
            <button onClick={submit} className="btn btn-primary">Create</button>
          </div>
        </div>
      </div>
    </div>
  );
}
