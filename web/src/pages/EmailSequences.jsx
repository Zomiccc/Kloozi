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
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <button onClick={() => setSelected(null)} className="btn btn-ghost">Back</button>
          <h1 className="text-3xl font-extrabold text-ink-primary tracking-tight">{selected.sequence.name}</h1>
        </div>

        <div className="card stagger-in">
          <h3 className="text-lg font-bold text-ink-primary mb-4">Sequence Steps</h3>
          {selected.steps.map((step, i) => (
            <div key={step.id} className="flex items-center gap-3 py-3 border-b border-surface-border last:border-0">
              <div className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-white" style={{ background: 'linear-gradient(135deg, #0066FF, #AF52DE)' }}>{step.step_number}</div>
              <div className="flex-1"><p className="text-sm font-bold text-ink-primary">{step.template_name || 'No template'}</p><p className="text-xs text-ink-tertiary">Delay: {step.delay_days}d {step.delay_hours}h</p></div>
            </div>
          ))}
        </div>

        <div className="card stagger-in">
          <h3 className="text-lg font-bold text-ink-primary mb-4 flex items-center gap-2"><Users size={18} /> Enrolled Leads ({selected.enrollments.length})</h3>
          {selected.enrollments.length === 0 ? <p className="text-ink-tertiary text-sm">No leads enrolled</p> :
            selected.enrollments.map(e => (
              <div key={e.id} className="flex items-center justify-between py-2 border-b border-surface-border last:border-0">
                <div><p className="text-sm font-bold text-ink-primary">{e.first_name} {e.last_name}</p><p className="text-xs text-ink-tertiary">Step {e.current_step} • {e.status}</p></div>
                <div className="flex gap-1">
                  {e.status === 'active' && <button onClick={() => handlePause(selected.sequence.id, e.lead_id)} className="btn btn-ghost" style={{ minHeight: '32px' }}><Pause size={14} /></button>}
                  {e.status === 'paused' && <button onClick={() => handleResume(selected.sequence.id, e.lead_id)} className="btn btn-ghost" style={{ minHeight: '32px' }}><Play size={14} /></button>}
                  <button onClick={() => handleRemove(selected.sequence.id, e.lead_id)} className="btn btn-ghost" style={{ minHeight: '32px', color: '#FF3B5C' }}><Trash2 size={14} /></button>
                </div>
              </div>
            ))
          }
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <h1 className="text-3xl font-extrabold text-ink-primary tracking-tight">Email Sequences</h1>
        <button onClick={() => setShowCreate(true)} className="btn btn-primary"><Plus size={16} /> New Sequence</button>
      </div>

      {loading ? <div className="flex justify-center py-8"><div className="animate-spin w-8 h-8 border-4 border-accent-blue border-t-transparent rounded-full" /></div> :
        sequences.length === 0 ? <div className="card text-center" style={{ padding: '48px 24px' }}><p className="text-ink-tertiary">No sequences yet</p></div> :
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {sequences.map((s, idx) => (
            <div key={s.id || `seq-${idx}`} className="card card-hover stagger-in">
              <h3 className="font-bold text-ink-primary">{s.name}</h3>
              <p className="text-sm text-ink-secondary mt-1 capitalize">{s.type}</p>
              <div className="flex gap-4 mt-3 text-sm">
                <span className="text-ink-secondary font-semibold">{s.step_count} steps</span>
                <span className="text-ink-secondary font-semibold">{s.active_enrollments} active</span>
              </div>
              <div className="flex gap-2 mt-4">
                <button onClick={() => loadDetails(s.id)} className="btn btn-ghost flex-1">View</button>
                <button onClick={() => handleClone(s.id)} className="btn btn-ghost flex-1" style={{ minHeight: '36px' }}><Copy size={14} /></button>
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
    <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white border border-surface-border rounded-3xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-modal animate-slide-up">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-ink-primary">New Email Sequence</h2>
          <button onClick={onClose} className="text-ink-tertiary hover:text-ink-primary transition-colors"><X size={20} /></button>
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
            <div key={i} className="border border-surface-border rounded-2xl p-3 space-y-2 bg-surface-page">
              <p className="text-sm font-bold text-ink-primary">Step {i + 1}</p>
              <select className="input" value={step.template_id} onChange={(e) => { const s = [...form.steps]; s[i].template_id = e.target.value; setForm({ ...form, steps: s }); }}>
                <option value="">Select template</option>
                {templates.map((t, idx) => <option key={t.id || idx} value={t.id}>{t.name}</option>)}
              </select>
              <div className="grid grid-cols-2 gap-2">
                <input type="number" className="input" placeholder="Delay days" value={step.delay_days} onChange={(e) => { const s = [...form.steps]; s[i].delay_days = parseInt(e.target.value) || 0; setForm({ ...form, steps: s }); }} />
                <input type="number" className="input" placeholder="Delay hours" value={step.delay_hours} onChange={(e) => { const s = [...form.steps]; s[i].delay_hours = parseInt(e.target.value) || 0; setForm({ ...form, steps: s }); }} />
              </div>
            </div>
          ))}
          <button onClick={() => setForm({ ...form, steps: [...form.steps, { template_id: '', delay_hours: 0, delay_days: 0 }] })} className="btn btn-ghost w-full">Add Step</button>
          <div className="flex gap-2">
            <button onClick={onClose} className="btn btn-ghost flex-1">Cancel</button>
            <button onClick={() => onSave(form)} className="btn btn-primary flex-1">Create</button>
          </div>
        </div>
      </div>
    </div>
  );
}
