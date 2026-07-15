import { useState, useEffect } from 'react';
import API from '../lib/api';
import toast from 'react-hot-toast';
import { Plus, Play, Pause, Copy, Trash2, X, ChevronRight, Users } from 'lucide-react';

export default function EmailSequences() {
  const [sequences, setSequences] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [selected, setSelected] = useState(null);

  useEffect(() => { loadSequences(); }, []);

  const loadSequences = async () => {
    try { const res = await API.get('/emails/sequences'); setSequences(res.data.sequences); }
    catch { toast.error('Failed to load sequences'); }
    finally { setLoading(false); }
  };

  const handleCreate = async (data) => {
    try { await API.post('/emails/sequences', data); toast.success('Sequence created'); setShowCreate(false); loadSequences(); }
    catch (err) { toast.error('Create failed'); }
  };

  const handleClone = async (id) => {
    try { await API.post(`/emails/sequences/${id}/clone`); toast.success('Cloned'); loadSequences(); }
    catch { toast.error('Clone failed'); }
  };

  const handlePause = async (seqId, leadId) => {
    try { await API.put(`/emails/sequences/${seqId}/lead/${leadId}/pause`); toast.success('Paused'); loadDetails(seqId); }
    catch { toast.error('Failed'); }
  };

  const handleResume = async (seqId, leadId) => {
    try { await API.put(`/emails/sequences/${seqId}/lead/${leadId}/resume`); toast.success('Resumed'); loadDetails(seqId); }
    catch { toast.error('Failed'); }
  };

  const handleRemove = async (seqId, leadId) => {
    try { await API.delete(`/emails/sequences/${seqId}/lead/${leadId}`); toast.success('Removed'); loadDetails(seqId); }
    catch { toast.error('Failed'); }
  };

  const loadDetails = async (id) => {
    try { const res = await API.get(`/emails/sequences/${id}`); setSelected(res.data); }
    catch { toast.error('Failed to load details'); }
  };

  if (selected) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-4">
          <button onClick={() => setSelected(null)} className="btn btn-secondary">Back</button>
          <h1 className="text-2xl font-bold">{selected.sequence.name}</h1>
        </div>

        <div className="card">
          <h3 className="font-semibold mb-4">Sequence Steps</h3>
          {selected.steps.map((step, i) => (
            <div key={step.id} className="flex items-center gap-3 py-3 border-b border-dark-50 last:border-0">
              <div className="w-8 h-8 bg-primary-100 text-primary-700 rounded-full flex items-center justify-center font-bold">{step.step_number}</div>
              <div className="flex-1"><p className="text-sm font-medium">{step.template_name || 'No template'}</p><p className="text-xs text-dark-400">Delay: {step.delay_days}d {step.delay_hours}h</p></div>
            </div>
          ))}
        </div>

        <div className="card">
          <h3 className="font-semibold mb-4 flex items-center gap-2"><Users size={18} /> Enrolled Leads ({selected.enrollments.length})</h3>
          {selected.enrollments.length === 0 ? <p className="text-dark-400 text-sm">No leads enrolled</p> :
            selected.enrollments.map(e => (
              <div key={e.id} className="flex items-center justify-between py-2 border-b border-dark-50 last:border-0">
                <div><p className="text-sm font-medium">{e.first_name} {e.last_name}</p><p className="text-xs text-dark-400">Step {e.current_step} • {e.status}</p></div>
                <div className="flex gap-1">
                  {e.status === 'active' && <button onClick={() => handlePause(selected.sequence.id, e.lead_id)} className="btn btn-secondary p-1.5"><Pause size={14} /></button>}
                  {e.status === 'paused' && <button onClick={() => handleResume(selected.sequence.id, e.lead_id)} className="btn btn-secondary p-1.5"><Play size={14} /></button>}
                  <button onClick={() => handleRemove(selected.sequence.id, e.lead_id)} className="btn btn-danger p-1.5"><Trash2 size={14} /></button>
                </div>
              </div>
            ))
          }
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-dark-900">Email Sequences</h1>
        <button onClick={() => setShowCreate(true)} className="btn btn-primary flex items-center gap-2"><Plus size={16} /> New Sequence</button>
      </div>

      {loading ? <div className="flex justify-center py-8"><div className="animate-spin w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full" /></div> :
        sequences.length === 0 ? <div className="card text-center py-12 text-dark-400"><p>No sequences yet</p></div> :
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {sequences.map(s => (
            <div key={s.id} className="card">
              <h3 className="font-semibold text-dark-900">{s.name}</h3>
              <p className="text-sm text-dark-400 mt-1 capitalize">{s.type}</p>
              <div className="flex gap-4 mt-3 text-sm">
                <span className="text-dark-600">{s.step_count} steps</span>
                <span className="text-dark-600">{s.active_enrollments} active</span>
              </div>
              <div className="flex gap-2 mt-4">
                <button onClick={() => loadDetails(s.id)} className="btn btn-secondary flex-1 text-sm py-1.5">View</button>
                <button onClick={() => handleClone(s.id)} className="btn btn-secondary flex-1 text-sm py-1.5"><Copy size={14} /></button>
              </div>
            </div>
          ))}
        </div>
      }

      {showCreate && <CreateSequenceModal onClose={() => setShowCreate(false)} onSave={handleCreate} />}
    </div>
  );
}

function CreateSequenceModal({ onClose, onSave }) {
  const [form, setForm] = useState({ name: '', type: 'custom', description: '', steps: [{ template_id: '', delay_hours: 0, delay_days: 0 }] });
  const [templates, setTemplates] = useState([]);

  useEffect(() => {
    API.get('/emails/templates').then(res => setTemplates(res.data.templates)).catch(() => {});
  }, []);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold">New Email Sequence</h2>
          <button onClick={onClose}><X size={20} /></button>
        </div>
        <div className="space-y-3">
          <input className="input" placeholder="Sequence name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <select className="input" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
            <option value="custom">Custom</option><option value="hot_lead">Hot Lead</option>
            <option value="cold_lead">Cold Lead</option><option value="post_meeting">Post-Meeting</option>
            <option value="proposal_sent">Proposal Sent</option><option value="re_engagement">Re-engagement</option>
          </select>
          <textarea className="input" rows="2" placeholder="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          {form.steps.map((step, i) => (
            <div key={i} className="border border-dark-200 rounded-lg p-3 space-y-2">
              <p className="text-sm font-medium">Step {i + 1}</p>
              <select className="input" value={step.template_id} onChange={(e) => { const s = [...form.steps]; s[i].template_id = e.target.value; setForm({ ...form, steps: s }); }}>
                <option value="">Select template</option>
                {templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
              <div className="grid grid-cols-2 gap-2">
                <input type="number" className="input" placeholder="Delay days" value={step.delay_days} onChange={(e) => { const s = [...form.steps]; s[i].delay_days = parseInt(e.target.value) || 0; setForm({ ...form, steps: s }); }} />
                <input type="number" className="input" placeholder="Delay hours" value={step.delay_hours} onChange={(e) => { const s = [...form.steps]; s[i].delay_hours = parseInt(e.target.value) || 0; setForm({ ...form, steps: s }); }} />
              </div>
            </div>
          ))}
          <button onClick={() => setForm({ ...form, steps: [...form.steps, { template_id: '', delay_hours: 0, delay_days: 0 }] })} className="btn btn-secondary w-full">Add Step</button>
          <div className="flex gap-2">
            <button onClick={onClose} className="btn btn-secondary flex-1">Cancel</button>
            <button onClick={() => onSave(form)} className="btn btn-primary flex-1">Create</button>
          </div>
        </div>
      </div>
    </div>
  );
}
