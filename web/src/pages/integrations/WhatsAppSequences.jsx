import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import API from '../../lib/api';
import toast from 'react-hot-toast';
import { ArrowLeft, Plus, Trash2, Edit, Play, Square, Clock, CheckCircle2, XCircle, MessageSquare } from 'lucide-react';
import BrandLogo from '../../components/BrandLogo';

export default function WhatsAppSequences() {
  const navigate = useNavigate();
  const [sequences, setSequences] = useState([]);
  const [progress, setProgress] = useState([]);
  const [showBuilder, setShowBuilder] = useState(false);
  const [editingSequence, setEditingSequence] = useState(null);
  const [loading, setLoading] = useState(true);

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

  const handleStartSequence = async (sequenceId, leadId) => {
    try {
      await API.post('/whatsapp/sequences/start', { sequence_id: sequenceId, lead_id });
      toast.success('Sequence started');
      loadProgress();
    } catch { toast.error('Failed to start sequence'); }
  };

  const handleStopSequence = async (sequenceId, leadId) => {
    try {
      await API.post('/whatsapp/sequences/stop', { sequence_id: sequenceId, lead_id, reason: 'manual' });
      toast.success('Sequence stopped');
      loadProgress();
    } catch { toast.error('Failed to stop sequence'); }
  };

  const getSequenceById = (id) => sequences.find(s => s.id === id);

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <button onClick={() => navigate('/app/automations')} className="flex items-center gap-2 text-sm text-ink-secondary hover:text-ink-primary"><ArrowLeft size={16} /> Back to Automations</button>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-surface-page rounded-xl flex items-center justify-center"><BrandLogo brand="whatsapp" /></div>
          <div><h2 className="text-xl font-bold text-ink-primary">Automated WhatsApp Sequences</h2><p className="text-sm text-ink-secondary">Multi-step sequences over multiple days</p></div>
        </div>
        <button onClick={() => { setEditingSequence(null); setShowBuilder(true); }} className="px-4 py-2 rounded-lg btn btn-primary flex items-center gap-2 transition-colors"><Plus size={16} /> New Sequence</button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div>
          <h3 className="font-semibold text-ink-primary mb-4">Sequences</h3>
          {loading ? <div className="flex justify-center py-8"><div className="animate-spin w-8 h-8 border-4 border-surface-border border-t-accent-blue rounded-full" /></div> :
            sequences.length === 0 ? (
              <div className="card text-center py-12"><MessageSquare size={48} className="text-ink-tertiary mx-auto mb-3" /><p className="text-ink-secondary">No sequences yet</p></div>
            ) : (
              <div className="space-y-3">
                {sequences.map(s => (
                  <div key={s.id} className="card flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2"><span className="font-medium text-ink-primary">{s.name}</span><span className={`badge ${s.is_active ? 'bg-surface-page text-ink-secondary' : 'bg-surface-hover text-ink-secondary'}`}>{s.is_active ? 'Active' : 'Inactive'}</span></div>
                      <p className="text-xs text-ink-tertiary mt-1">{s.steps?.length || 0} steps</p>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => { setEditingSequence(s); setShowBuilder(true); }} className="text-ink-secondary p-2 hover:text-accent-blue transition-colors"><Edit size={16} /></button>
                      <button onClick={() => handleDelete(s.id)} className="text-ink-secondary p-2 hover:text-red-300 transition-colors"><Trash2 size={16} /></button>
                    </div>
                  </div>
                ))}
              </div>
            )}
        </div>

        <div>
          <h3 className="font-semibold text-ink-primary mb-4">Active Progress</h3>
          {progress.length === 0 ? (
            <div className="card text-center py-12"><Clock size={48} className="text-ink-tertiary mx-auto mb-3" /><p className="text-ink-secondary">No active sequences</p></div>
          ) : (
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {progress.map(p => {
                const seq = getSequenceById(p.sequence_id);
                if (!seq) return null;
                const totalSteps = seq.steps?.length || 0;
                const nextSendIn = p.next_send_at ? new Date(p.next_send_at) - new Date() : null;
                const hoursUntil = nextSendIn ? Math.floor(nextSendIn / (1000 * 60 * 60)) : 0;
                return (
                  <div key={p.id} className="card">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <p className="font-medium text-ink-primary">{p.first_name} {p.last_name}</p>
                        <p className="text-xs text-ink-secondary">{seq.name}</p>
                      </div>
                      <div className="flex items-center gap-1">
                        {p.is_completed ? <CheckCircle2 size={16} className="text-emerald-500" /> : p.is_stopped ? <XCircle size={16} className="text-red-400" /> : <Clock size={16} className="text-amber-400" />}
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-ink-secondary">Step {p.current_step + 1} of {totalSteps}</span>
                      {!p.is_completed && !p.is_stopped && <span className="text-ink-tertiary">{hoursUntil > 0 ? `Next in ${hoursUntil}h` : 'Due now'}</span>}
                    </div>
                    {!p.is_completed && !p.is_stopped && (
                      <button onClick={() => handleStopSequence(p.sequence_id, p.lead_id)} className="mt-2 text-xs text-red-400 hover:text-red-300 flex items-center gap-1"><Square size={12} /> Stop</button>
                    )}
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
  const [steps, setSteps] = useState(sequence?.steps || []);
  const [isActive, setIsActive] = useState(sequence?.is_active !== false);

  const addStep = () => {
    setSteps([...steps, { message: '', delay_hours: 24 }]);
  };

  const updateStep = (index, field, value) => {
    const newSteps = [...steps];
    newSteps[index][field] = value;
    setSteps(newSteps);
  };

  const removeStep = (index) => {
    setSteps(steps.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    if (!name) return toast.error('Name required');
    if (steps.length === 0) return toast.error('Add at least one step');
    
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
    <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white border border-surface-border rounded-2xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-modal">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-ink-primary">{sequence ? 'Edit Sequence' : 'New Sequence'}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors"><XCircle size={20} /></button>
        </div>

        <div className="space-y-4">
          <div><label className="text-sm font-medium text-slate-300">Sequence Name *</label><input className="input mt-1" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Welcome Sequence" /></div>
          <div><label className="text-sm font-medium text-slate-300">Description</label><textarea className="input mt-1" rows={2} value={description} onChange={e => setDescription(e.target.value)} placeholder="Describe what this sequence does" /></div>
          
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-slate-300">Steps</label>
              <button onClick={addStep} className="text-xs text-accent-blue hover:underline flex items-center gap-1"><Plus size={12} /> Add Step</button>
            </div>
            <div className="space-y-3">
              {steps.map((step, i) => (
                <div key={i} className="bg-surface-page border border-surface-border rounded-lg p-4">
                  <div className="flex items-start justify-between mb-2">
                    <span className="text-sm font-medium text-ink-primary">Step {i + 1}</span>
                    <button onClick={() => removeStep(i)} className="text-red-400 hover:text-red-300"><Trash2 size={14} /></button>
                  </div>
                  <div className="space-y-2">
                    <div><label className="text-xs text-ink-secondary">Message *</label><textarea className="input mt-1" rows={2} value={step.message} onChange={e => updateStep(i, 'message', e.target.value)} placeholder="Hi {{first_name}, here's more info..." /></div>
                    <div><label className="text-xs text-ink-secondary">Delay (hours) *</label><input type="number" className="input mt-1" value={step.delay_hours} onChange={e => updateStep(i, 'delay_hours', parseInt(e.target.value) || 0)} placeholder="24" /></div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <label className="flex items-center gap-2"><input type="checkbox" checked={isActive} onChange={e => setIsActive(e.target.checked)} /> <span className="text-sm text-ink-secondary">Active</span></label>

          <button onClick={handleSave} className="w-full px-4 py-2.5 rounded-lg btn btn-primary transition-colors">{sequence ? 'Update Sequence' : 'Create Sequence'}</button>
        </div>
      </div>
    </div>
  );
}
