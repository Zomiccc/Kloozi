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
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-dark-900">Email Templates</h1>
        <div className="flex gap-2">
          <button onClick={() => setShowAI(true)} className="btn btn-secondary flex items-center gap-2"><Sparkles size={16} /> AI Subject Lines</button>
          <button onClick={() => { setEditing(null); setShowEditor(true); }} className="btn btn-primary flex items-center gap-2"><Plus size={16} /> New Template</button>
        </div>
      </div>

      {loading ? <div className="flex justify-center py-8"><div className="animate-spin w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full" /></div> :
        templates.length === 0 ? <div className="card text-center py-12 text-dark-400"><p>No templates yet. Create your first email template!</p></div> :
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {templates.map(t => (
            <div key={t.id} className="card">
              <div className="flex items-start justify-between mb-2">
                <div><h3 className="font-semibold text-dark-900">{t.name}</h3><span className="badge bg-primary-100 text-primary-700 mt-1">{t.category}</span></div>
                {t.is_draft && <span className="badge bg-amber-100 text-amber-700">Draft</span>}
              </div>
              <p className="text-sm text-dark-500 mb-2 truncate"><strong>Subject:</strong> {t.subject}</p>
              <p className="text-sm text-dark-400 line-clamp-2 mb-4" dangerouslySetInnerHTML={{ __html: t.body }} />
              <div className="flex gap-2">
                <button onClick={() => { setEditing(t); setShowEditor(true); }} className="btn btn-secondary flex-1 text-sm py-1.5"><Edit size={14} /></button>
                <button onClick={() => handleDuplicate(t.id)} className="btn btn-secondary flex-1 text-sm py-1.5"><Copy size={14} /></button>
                <button onClick={() => loadStats(t.id)} className="btn btn-secondary flex-1 text-sm py-1.5"><BarChart3 size={14} /></button>
                <button onClick={() => handleDelete(t.id)} className="btn btn-danger flex-1 text-sm py-1.5"><Trash2 size={14} /></button>
              </div>
              {stats?.id === t.id && (
                <div className="mt-3 pt-3 border-t border-dark-100 grid grid-cols-3 gap-2 text-center">
                  <div><p className="text-lg font-bold text-dark-900">{stats.totalSent}</p><p className="text-xs text-dark-400">Sent</p></div>
                  <div><p className="text-lg font-bold text-green-600">{stats.openRate}%</p><p className="text-xs text-dark-400">Open</p></div>
                  <div><p className="text-lg font-bold text-blue-600">{stats.clickRate}%</p><p className="text-xs text-dark-400">Click</p></div>
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
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl p-6 w-full max-w-3xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold">{template ? 'Edit Template' : 'New Template'}</h2>
          <button onClick={onClose}><X size={20} /></button>
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
            {variables.map(v => <button key={v} onClick={() => insertVariable(v)} className="text-xs bg-primary-50 text-primary-600 px-2 py-1 rounded hover:bg-primary-100">{v}</button>)}
          </div>
          <textarea className="input font-mono text-sm" rows="10" placeholder="Email body (HTML supported)" value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} />
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.is_draft} onChange={(e) => setForm({ ...form, is_draft: e.target.checked })} /> Save as draft</label>
          <div className="flex gap-2">
            <button onClick={onClose} className="btn btn-secondary flex-1">Cancel</button>
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
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl p-6 w-full max-w-lg">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold flex items-center gap-2"><Sparkles size={20} className="text-primary-600" /> AI Subject Line Generator</h2>
          <button onClick={onClose}><X size={20} /></button>
        </div>
        <div className="space-y-3">
          <input className="input" placeholder="Email topic (e.g. property follow-up)" value={topic} onChange={(e) => setTopic(e.target.value)} />
          <input className="input" placeholder="Goal (e.g. get them to reply)" value={goal} onChange={(e) => setGoal(e.target.value)} />
          <button onClick={generate} disabled={!topic || loading} className="btn btn-primary w-full">{loading ? 'Generating...' : 'Generate 5 Subject Lines'}</button>
          {results.length > 0 && (
            <div className="space-y-2">
              {results.map((r, i) => (
                <div key={i} className="flex items-center justify-between p-3 bg-dark-50 rounded-lg">
                  <div><p className="text-sm font-medium text-dark-900">{r.text}</p><p className="text-xs text-dark-400">Predicted open rate: {r.predictedOpenRate}</p></div>
                  <button onClick={() => { navigator.clipboard.writeText(r.text); toast.success('Copied!'); }} className="text-primary-600 hover:text-primary-700"><Copy size={16} /></button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
