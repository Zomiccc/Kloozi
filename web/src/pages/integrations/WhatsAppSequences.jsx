import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import API from '../../lib/api';
import toast from 'react-hot-toast';
import { ArrowLeft, Plus, Trash2, Clock, CheckCircle2, XCircle, Square } from 'lucide-react';
import useCreateRegistry from '../../stores/createStore';

export default function WhatsAppSequences() {
  const navigate = useNavigate();
  const [sequences, setSequences] = useState([]);
  const [progress, setProgress] = useState([]);
  const [showBuilder, setShowBuilder] = useState(false);
  const [editingSequence, setEditingSequence] = useState(null);
  const [loading, setLoading] = useState(true);
  const register = useCreateRegistry((s) => s.register);
  const clearRegistry = useCreateRegistry((s) => s.clear);

  useEffect(() => {
    register([{ label: 'New sequence', icon: <Plus size={14} />, run: () => { setEditingSequence(null); setShowBuilder(true); } }]);
    return () => clearRegistry();
  }, [register, clearRegistry]);

  useEffect(() => { loadSequences(); loadProgress(); }, []);

  const loadSequences = async () => {
    try {
      const res = await API.get('/whatsapp/sequences');
      setSequences(res.data.sequences || []);
    } catch { toast.error('Failed to load sequences'); }
    finally { setLoading(false); }
  };

  const loadProgress = async () => {
    try {
      const res = await API.get('/whatsapp/sequences/progress');
      setProgress(res.data.progress || []);
    } catch {}
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this sequence?')) return;
    try {
      await API.delete(`/whatsapp/sequences/${id}`);
      toast.success('Sequence deleted');
      loadSequences();
    } catch { toast.error('Failed to delete'); }
  };

  const handleStopSequence = async (sequenceId, leadId) => {
    try {
      await API.post('/whatsapp/sequences/stop', { sequence_id: sequenceId, lead_id: leadId, reason: 'manual' });
      toast.success('Sequence stopped');
      loadProgress();
    } catch { toast.error('Failed to stop'); }
  };

  const getSequenceById = (id) => sequences.find((s) => s.id === id);

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <button onClick={() => navigate('/app/automations')} className="btn-ghost text-sm font-medium flex items-center gap-1.5">
        <ArrowLeft size={14} /> Automations
      </button>

      <div>
        <h1 style={{ fontSize: '32px', fontWeight: 650, letterSpacing: '-0.01em' }}>WhatsApp Sequences</h1>
        <p className="text-ink-secondary mt-1" style={{ fontSize: '15px' }}>
          Multi-step message cadences over days — written once, delivered on schedule.
        </p>
      </div>

      <div className="grid lg:grid-cols-[1.2fr_1fr] gap-10 items-start">
        {/* Sequences */}
        <div>
          <p className="meta-label mb-3">Sequences</p>
          {loading ? (
            <div className="space-y-2">{[1, 2].map((i) => <div key={i} className="skeleton h-16" />)}</div>
          ) : sequences.length === 0 ? (
            <div className="py-14 text-center">
              <p style={{ fontSize: '20px', fontWeight: 600 }}>No sequences yet.</p>
              <p className="text-ink-secondary mt-2" style={{ fontSize: '14px' }}>Step 1 today, step 2 tomorrow — you write it once.</p>
            </div>
          ) : (
            <div>
              {sequences.map((s, idx) => (
                <motion.div
                  key={s.id}
                  initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(idx * 0.04, 0.3), duration: 0.2 }}
                  className="group hairline-b py-4 flex items-center justify-between gap-4 hover-accent-left"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-3 flex-wrap">
                      <h3 className="font-semibold" style={{ fontSize: '15px' }}>{s.name}</h3>
                      <span className={`badge ${s.is_active ? 'badge-success' : 'badge-neutral'}`}>{s.is_active ? 'Active' : 'Off'}</span>
                    </div>
                    <p className="text-ink-secondary mt-0.5" style={{ fontSize: '13px' }}>
                      {s.steps?.length || 0} step{(s.steps?.length || 0) === 1 ? '' : 's'}
                      {s.description ? <> · {s.description}</> : null}
                    </p>
                  </div>
                  <div className="flex items-center gap-4 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity flex-shrink-0">
                    <button onClick={() => { setEditingSequence(s); setShowBuilder(true); }} className="btn-ghost text-sm font-medium">Edit</button>
                    <button onClick={() => handleDelete(s.id)} className="btn-danger text-sm font-medium"><Trash2 size={14} /></button>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>

        {/* Progress */}
        <div>
          <p className="meta-label mb-3">In progress</p>
          {progress.length === 0 ? (
            <div className="py-14 text-center">
              <p className="text-ink-secondary" style={{ fontSize: '15px' }}>Nobody is mid-sequence right now.</p>
            </div>
          ) : (
            <div className="space-y-0 max-h-[480px] overflow-y-auto">
              {progress.map((p) => {
                const seq = getSequenceById(p.sequence_id);
                if (!seq) return null;
                const totalSteps = seq.steps?.length || 0;
                const nextSendIn = p.next_send_at ? new Date(p.next_send_at) - new Date() : null;
                const hoursUntil = nextSendIn ? Math.floor(nextSendIn / (1000 * 60 * 60)) : 0;
                return (
                  <div key={p.id} className="hairline-b py-3 hover-accent-left">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-semibold truncate" style={{ fontSize: '14px' }}>{p.first_name} {p.last_name}</p>
                        <p className="text-ink-secondary truncate" style={{ fontSize: '13px' }}>{seq.name}</p>
                      </div>
                      {!p.is_completed && !p.is_stopped && <Clock size={15} className="text-ink-tertiary flex-shrink-0 mt-0.5" />}
                      {p.is_completed && <CheckCircle2 size={15} className="flex-shrink-0 mt-0.5" style={{ color: '#0E8A5F' }} />}
                      {p.is_stopped && <XCircle size={15} className="text-ink-tertiary flex-shrink-0 mt-0.5" />}
                    </div>
                    <div className="flex items-center justify-between gap-3 mt-2">
                      <span className="mono text-ink-secondary" style={{ fontSize: '12px' }}>
                        step {Math.min((p.current_step ?? 0) + 1, totalSteps)}/{totalSteps}
                        {!p.is_completed && !p.is_stopped && (hoursUntil > 0 ? ` · next in ${hoursUntil}h` : ' · due now')}
                      </span>
                      {!p.is_completed && !p.is_stopped && (
                        <button onClick={() => handleStopSequence(p.sequence_id, p.lead_id)} className="btn-danger flex items-center gap-1" style={{ fontSize: '12px', fontWeight: 500 }}>
                          <Square size={11} /> Stop
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {showBuilder && <SequenceBuilder sequence={editingSequence} onClose={() => setShowBuilder(false)} onSaved={() => { setShowBuilder(false); loadSequences(); }} />}
    </div>
  );
}

function SequenceBuilder({ sequence, onClose, onSaved }) {
  const [name, setName] = useState(sequence?.name || '');
  const [description, setDescription] = useState(sequence?.description || '');
  const [steps, setSteps] = useState(sequence?.steps?.length ? sequence.steps : [{ message: '', delay_hours: 24 }]);
  const [isActive, setIsActive] = useState(sequence?.is_active !== false);

  const addStep = () => setSteps([...steps, { message: '', delay_hours: 24 }]);
  const updateStep = (index, field, value) => {
    const newSteps = [...steps];
    newSteps[index] = { ...newSteps[index], [field]: value };
    setSteps(newSteps);
  };
  const removeStep = (index) => setSteps(steps.filter((_, i) => i !== index));

  const handleSave = async () => {
    if (!name) return toast.error('Name required');
    if (steps.length === 0) return toast.error('Add at least one step');
    if (steps.some((s) => !String(s.message).trim())) return toast.error('Every step needs a message');
    try {
      if (sequence) {
        await API.put(`/whatsapp/sequences/${sequence.id}`, { name, description, steps, is_active: isActive });
      } else {
        await API.post('/whatsapp/sequences', { name, description, steps, is_active: isActive });
      }
      toast.success('Sequence saved');
      onSaved();
    } catch { toast.error('Failed to save'); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-0 sm:p-6 overflow-y-auto" style={{ background: 'rgba(28,25,23,0.25)' }} onClick={onClose}>
      <div className="card-raised w-full max-w-2xl my-auto max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-6">
          <h2 style={{ fontSize: '18px', fontWeight: 600 }}>{sequence ? 'Edit sequence' : 'New sequence'}</h2>
          <button onClick={onClose} className="text-ink-tertiary hover:text-ink-primary transition-colors">✕</button>
        </div>

        <div className="space-y-5">
          <div>
            <p className="meta-label mb-1">Name *</p>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Welcome sequence" />
          </div>
          <div>
            <p className="meta-label mb-1">Description</p>
            <textarea className="input" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What this sequence achieves" />
          </div>

          <div className="hairline pt-5">
            <div className="flex items-center justify-between mb-3">
              <p className="meta-label">Steps</p>
              <button onClick={addStep} className="btn-ghost text-sm font-medium flex items-center gap-1"><Plus size={13} /> Add step</button>
            </div>
            <div className="space-y-4">
              {steps.map((step, i) => (
                <div key={i} className="hairline p-4">
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <span className="mono font-semibold" style={{ fontSize: '13px' }}>{String(i + 1).padStart(2, '0')}</span>
                    {steps.length > 1 && <button onClick={() => removeStep(i)} className="btn-danger"><Trash2 size={13} /></button>}
                  </div>
                  <textarea
                    className="input"
                    rows={2}
                    value={step.message}
                    onChange={(e) => updateStep(i, 'message', e.target.value)}
                    placeholder={'Hi {{first_name}}, here\'s more info…'}
                  />
                  <div className="mt-3 flex items-end gap-3">
                    <div style={{ width: '140px' }}>
                      <p className="meta-label mb-1">Send after (hours)</p>
                      <input type="number" min="0" className="input mono" value={step.delay_hours} onChange={(e) => updateStep(i, 'delay_hours', parseInt(e.target.value) || 0)} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
            <span className="text-sm text-ink-secondary">Sequence is active</span>
          </label>

          <button onClick={handleSave} className="btn btn-primary w-full">{sequence ? 'Save changes' : 'Create sequence'}</button>
        </div>
      </div>
    </div>
  );
}
