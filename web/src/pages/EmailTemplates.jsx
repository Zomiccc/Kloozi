import { useState, useEffect } from 'react';
import API from '../lib/api';
import toast from 'react-hot-toast';
import { Plus, Edit, Trash2, Copy, Eye, Send, Sparkles, X, BarChart3 } from 'lucide-react';

export default function EmailTemplates() {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showEditor, setShowEditor] = useState(false);
  const [editing, setEditing] = useState(null);
  const [showAI, setShowAI] = useState(false);
  const [stats, setStats] = useState(null);

  useEffect(() => { loadTemplates(); }, []);

  const loadTemplates = async () => {
    try {
      const res = await API.get('/emails/templates');
      setTemplates(res.data.templates);
    } catch { toast.error('Failed to load templates'); }
    finally { setLoading(false); }
  };

  const handleSave = async (data) => {
    try {
      if (editing) { await API.put(`/emails/templates/${editing.id}`, data); toast.success('Template updated'); }
      else { await API.post('/emails/templates', data); toast.success('Template created'); }
      setShowEditor(false); setEditing(null); loadTemplates();
    } catch (err) { toast.error(err.response?.data?.error || 'Save failed'); }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this template?')) return;
    try { await API.delete(`/emails/templates/${id}`); toast.success('Deleted'); loadTemplates(); }
    catch { toast.error('Delete failed'); }
  };

  const handleDuplicate = async (id) => {
    try { await API.post(`/emails/templates/${id}/duplicate`); toast.success('Duplicated'); loadTemplates(); }
    catch { toast.error('Duplicate failed'); }
  };

  const loadStats = async (id) => {
    try { const res = await API.get(`/emails/templates/${id}/stats`); setStats({ id, ...res.data }); }
    catch { toast.error('Failed to load stats'); }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <h1 className="text-3xl font-extrabold text-ink-primary tracking-tight">Email Templates</h1>
        <div className="flex gap-2">
          <button onClick={() => setShowAI(true)} className="btn btn-ghost"><Sparkles size={16} /> AI Subject Lines</button>
          <button onClick={() => { setEditing(null); setShowEditor(true); }} className="btn btn-primary"><Plus size={16} /> New Template</button>
        </div>
      </div>

      {loading ? <div className="flex justify-center py-8"><div className="animate-spin w-8 h-8 border-4 border-accent-blue border-t-transparent rounded-full" /></div> :
        templates.length === 0 ? <div className="card text-center" style={{ padding: '48px 24px' }}><p className="text-ink-tertiary">No templates yet. Create your first email template!</p></div> :
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {templates.map(t => (
            <div key={t.id} className="card card-hover stagger-in">
              <div className="flex items-start justify-between mb-2">
                <div><h3 className="font-bold text-ink-primary">{t.name}</h3><span className="badge mt-1" style={{ background: '#0066FF10', color: '#0066FF' }}>{t.category}</span></div>
                {t.is_draft && <span className="badge" style={{ background: '#FF950010', color: '#FF9500' }}>Draft</span>}
              </div>
              <p className="text-sm text-ink-tertiary mb-2 truncate"><strong className="text-ink-secondary">Subject:</strong> {t.subject}</p>
              <p className="text-sm text-ink-secondary line-clamp-2 mb-4" dangerouslySetInnerHTML={{ __html: t.body }} />
              <div className="flex gap-1.5">
                <button onClick={() => { setEditing(t); setShowEditor(true); }} className="btn btn-ghost flex-1" style={{ minHeight: '36px' }}><Edit size={14} /></button>
                <button onClick={() => handleDuplicate(t.id)} className="btn btn-ghost flex-1" style={{ minHeight: '36px' }}><Copy size={14} /></button>
                <button onClick={() => loadStats(t.id)} className="btn btn-ghost flex-1" style={{ minHeight: '36px' }}><BarChart3 size={14} /></button>
                <button onClick={() => handleDelete(t.id)} className="btn btn-ghost flex-1" style={{ minHeight: '36px', color: '#FF3B5C' }}><Trash2 size={14} /></button>
              </div>
              {stats?.id === t.id && stats && (
                <div className="mt-3 pt-3 border-t border-surface-border grid grid-cols-3 gap-2 text-center">
                  <div><p className="text-lg font-extrabold text-ink-primary">{stats?.totalSent ?? 0}</p><p className="text-xs text-ink-tertiary">Sent</p></div>
                  <div><p className="text-lg font-extrabold" style={{ color: '#34C759' }}>{stats?.openRate ?? 0}%</p><p className="text-xs text-ink-tertiary">Open</p></div>
                  <div><p className="text-lg font-extrabold" style={{ color: '#0066FF' }}>{stats?.clickRate ?? 0}%</p><p className="text-xs text-ink-tertiary">Click</p></div>
                </div>
              )}
            </div>
          ))}
        </div>
      }

      {showEditor && <TemplateEditor template={editing} onClose={() => { setShowEditor(false); setEditing(null); }} onSave={handleSave} />}
      {showAI && <AISubjectModal onClose={() => setShowAI(false)} />}
    </div>
  );
}

function TemplateEditor({ template, onClose, onSave }) {
  const [form, setForm] = useState({
    name: template?.name || '', subject: template?.subject || '', body: template?.body || '',
    category: template?.category || 'intro', is_draft: template?.is_draft || false,
  });
  const variables = ['{{First_Name}}', '{{Last_Name}}', '{{Phone}}', '{{Email}}', '{{City}}', '{{Budget}}', '{{Lead_Source}}', '{{Agent_Name}}', '{{Company_Name}}', '{{Today_Date}}', '{{Time_Greeting}}'];

  const insertVariable = (v) => { setForm({ ...form, body: form.body + ' ' + v }); };

  return (
    <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white border border-surface-border rounded-3xl p-6 w-full max-w-3xl max-h-[90vh] overflow-y-auto shadow-modal animate-slide-up">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-ink-primary">{template ? 'Edit Template' : 'New Template'}</h2>
          <button onClick={onClose} className="text-ink-tertiary hover:text-ink-primary transition-colors"><X size={20} /></button>
        </div>
        <div className="space-y-3">
          <input className="input" placeholder="Template name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <input className="input" placeholder="Subject line" value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} />
          <select className="input" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
            <option value="intro">Intro</option><option value="follow_up">Follow Up</option>
            <option value="proposal">Proposal</option><option value="closing">Closing</option>
            <option value="re_engagement">Re-engagement</option>
          </select>
          <div className="flex gap-1 flex-wrap mb-2">
            {variables.map(v => <button key={v} onClick={() => insertVariable(v)} className="text-xs font-semibold px-2 py-1 rounded-lg transition-colors" style={{ background: '#0066FF10', color: '#0066FF' }}>{v}</button>)}
          </div>
          <textarea className="input font-mono text-sm" rows="10" placeholder="Email body (HTML supported)" value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} />
          <label className="flex items-center gap-2 text-sm font-semibold text-ink-secondary"><input type="checkbox" checked={form.is_draft} onChange={(e) => setForm({ ...form, is_draft: e.target.checked })} className="accent-blue-500" /> Save as draft</label>
          <div className="flex gap-2">
            <button onClick={onClose} className="btn btn-ghost flex-1">Cancel</button>
            <button onClick={() => onSave(form)} className="btn btn-primary flex-1">Save Template</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function AISubjectModal({ onClose }) {
  const [topic, setTopic] = useState('');
  const [goal, setGoal] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);

  const generate = async () => {
    setLoading(true);
    try {
      const res = await API.post('/emails/ai/subject-lines', { topic, goal });
      setResults(res.data.subjectLines);
    } catch { toast.error('AI generation failed'); }
    finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white border border-surface-border rounded-3xl p-6 w-full max-w-lg shadow-modal animate-slide-up">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-ink-primary flex items-center gap-2"><Sparkles size={20} style={{ color: '#AF52DE' }} /> AI Subject Line Generator</h2>
          <button onClick={onClose} className="text-ink-tertiary hover:text-ink-primary transition-colors"><X size={20} /></button>
        </div>
        <div className="space-y-3">
          <input className="input" placeholder="Email topic (e.g. property follow-up)" value={topic} onChange={(e) => setTopic(e.target.value)} />
          <input className="input" placeholder="Goal (e.g. get them to reply)" value={goal} onChange={(e) => setGoal(e.target.value)} />
          <button onClick={generate} disabled={!topic || loading} className="btn btn-primary w-full">{loading ? 'Generating...' : 'Generate 5 Subject Lines'}</button>
          {results.length > 0 && (
            <div className="space-y-2">
              {results.map((r, i) => (
                <div key={i} className="flex items-center justify-between p-3 rounded-2xl border border-surface-border bg-surface-page">
                  <div><p className="text-sm font-bold text-ink-primary">{r.text}</p><p className="text-xs text-ink-tertiary">Predicted open rate: {r.predictedOpenRate}</p></div>
                  <button onClick={() => { navigator.clipboard.writeText(r.text); toast.success('Copied!'); }} style={{ color: '#0066FF' }}><Copy size={16} /></button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
