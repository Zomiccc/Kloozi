import { useState, useEffect, useRef } from 'react';
import API from '../lib/api';
import toast from 'react-hot-toast';
import { Plus, Edit, Trash2, Copy, Eye, Send, Sparkles, X, BarChart3, Upload, FileCode } from 'lucide-react';

export default function EmailTemplates() {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showEditor, setShowEditor] = useState(false);
  const [editing, setEditing] = useState(null);
  const [showAI, setShowAI] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [stats, setStats] = useState(null);

  useEffect(() => { loadTemplates(); }, []);

  const handleSeedDefaults = async () => {
    try {
      await API.post('/emails/templates/seed-defaults');
      toast.success('Default templates seeded');
      loadTemplates();
    } catch { toast.error('Failed to seed templates'); }
  };

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
          <button onClick={handleSeedDefaults} className="btn btn-ghost"><FileCode size={16} /> Seed Defaults</button>
          <button onClick={() => setShowImport(true)} className="btn btn-ghost"><Upload size={16} /> Import Template</button>
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
      {showImport && <ImportTemplateModal onClose={() => setShowImport(false)} onImported={() => { setShowImport(false); loadTemplates(); }} />}
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
            <option value="welcome">Welcome</option>
            <option value="first_contact">First Contact</option>
            <option value="follow_up">Follow Up</option>
            <option value="sales">Sales</option>
            <option value="proposal">Proposal</option>
            <option value="meeting_reminder">Meeting Reminder</option>
            <option value="thank_you">Thank You</option>
            <option value="re_engagement">Re-engagement</option>
            <option value="customer_success">Customer Success</option>
            <option value="promotional">Promotional</option>
            <option value="intro">Intro</option>
            <option value="closing">Closing</option>
            <option value="imported">Imported</option>
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

function ImportTemplateModal({ onClose, onImported }) {
  const [mode, setMode] = useState('paste');
  const [htmlContent, setHtmlContent] = useState('');
  const [name, setName] = useState('');
  const [subject, setSubject] = useState('');
  const [category, setCategory] = useState('imported');
  const [showPreview, setShowPreview] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef(null);

  const validVariables = [
    'First_Name', 'Last_Name', 'Phone', 'Email', 'City', 'Budget', 'Lead_Source',
    'Agent_Name', 'Agent_Phone', 'Agent_Email', 'Company_Name', 'Designation',
    'Product_Name', 'Price', 'Location', 'Brochure_Link', 'Video_Link',
    'Today_Date', 'Day_of_Week', 'Time_Greeting', 'Last_Contacted',
    'Days_Since_Inquiry', 'Next_Followup_Date', 'Last_Email_Opened', 'Times_Opened',
  ];

  const detectedVars = () => {
    const matches = (htmlContent + ' ' + subject).match(/\{\{([^}]+)\}\}/g) || [];
    return [...new Set(matches.map(m => m.replace(/\{\{|}}/g, '')))];
  };

  const unknownVars = detectedVars().filter(v => !validVariables.includes(v) && !v.startsWith('Custom_Field_'));

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!file.name.endsWith('.html') && !file.name.endsWith('.htm')) {
      toast.error('Please upload an .html file');
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      setHtmlContent(ev.target.result);
      if (!name) setName(file.name.replace(/\.html?$/i, ''));
    };
    reader.readAsText(file);
  };

  const handleImport = async () => {
    if (!htmlContent.trim()) {
      toast.error('Please provide HTML content');
      return;
    }
    if (unknownVars.length > 0) {
      if (!confirm(`Unknown variables detected: {{${unknownVars.join('}}, {{')}}}\n\nThese will be left as-is when rendering. Continue?`)) return;
    }
    setSaving(true);
    try {
      await API.post('/emails/templates/import', { name: name || 'Imported Template', subject, body: htmlContent, category });
      toast.success('Template imported successfully');
      onImported();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Import failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white border border-surface-border rounded-3xl p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto shadow-modal animate-slide-up">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-ink-primary flex items-center gap-2"><Upload size={20} style={{ color: '#0066FF' }} /> Import Template</h2>
          <button onClick={onClose} className="text-ink-tertiary hover:text-ink-primary transition-colors"><X size={20} /></button>
        </div>

        <div className="space-y-4">
          <div className="flex gap-2">
            <button onClick={() => setMode('paste')} className={`btn ${mode === 'paste' ? 'btn-primary' : 'btn-ghost'}`} style={{ minHeight: '36px' }}>Paste HTML</button>
            <button onClick={() => setMode('upload')} className={`btn ${mode === 'upload' ? 'btn-primary' : 'btn-ghost'}`} style={{ minHeight: '36px' }}>Upload .html File</button>
          </div>

          {mode === 'upload' && (
            <div className="border-2 border-dashed border-surface-border rounded-2xl p-8 text-center">
              <input ref={fileInputRef} type="file" accept=".html,.htm" onChange={handleFileUpload} className="hidden" />
              <Upload size={32} className="text-ink-tertiary mx-auto mb-3" />
              <button onClick={() => fileInputRef.current?.click()} className="btn btn-blue">Choose HTML File</button>
              <p className="text-xs text-ink-tertiary mt-2">Supported: .html, .htm</p>
            </div>
          )}

          {mode === 'paste' && (
            <textarea
              className="input font-mono text-sm"
              rows={8}
              placeholder="Paste your HTML template here..."
              value={htmlContent}
              onChange={(e) => setHtmlContent(e.target.value)}
            />
          )}

          {htmlContent && (
            <div className="rounded-2xl border border-surface-border p-4 bg-surface-page">
              <p className="text-sm font-bold text-ink-primary mb-2">Detected Variables:</p>
              {detectedVars().length > 0 ? (
                <div className="flex gap-1 flex-wrap">
                  {detectedVars().map(v => (
                    <span key={v} className="badge" style={{
                      background: validVariables.includes(v) || v.startsWith('Custom_Field_') ? '#34C75910' : '#FF3B5C10',
                      color: validVariables.includes(v) || v.startsWith('Custom_Field_') ? '#34C759' : '#FF3B5C',
                    }}>{`{{${v}}}`}</span>
                  ))}
                </div>
              ) : <p className="text-xs text-ink-tertiary">No variables detected</p>}
              {unknownVars.length > 0 && (
                <p className="text-xs mt-2" style={{ color: '#FF3B5C' }}>Warning: {unknownVars.length} unknown variable(s) — they won't be replaced with data</p>
              )}
            </div>
          )}

          {htmlContent && (
            <div>
              <button onClick={() => setShowPreview(!showPreview)} className="text-sm font-semibold hover:underline" style={{ color: '#0066FF' }}>
                {showPreview ? 'Hide Preview' : 'Show Live Preview'}
              </button>
              {showPreview && (
                <div className="mt-2 border border-surface-border rounded-2xl overflow-hidden">
                  <div className="bg-surface-page p-2 border-b border-surface-border">
                    <p className="text-xs font-semibold text-ink-tertiary">Live HTML Preview</p>
                  </div>
                  <div className="p-4 max-h-64 overflow-y-auto bg-white" dangerouslySetInnerHTML={{ __html: htmlContent }} />
                </div>
              )}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <input className="input" placeholder="Template name" value={name} onChange={(e) => setName(e.target.value)} />
            <input className="input" placeholder="Subject line (optional)" value={subject} onChange={(e) => setSubject(e.target.value)} />
          </div>
          <select className="input" value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="imported">Imported</option>
            <option value="welcome">Welcome</option>
            <option value="first_contact">First Contact</option>
            <option value="follow_up">Follow Up</option>
            <option value="sales">Sales</option>
            <option value="proposal">Proposal</option>
            <option value="meeting_reminder">Meeting Reminder</option>
            <option value="thank_you">Thank You</option>
            <option value="re_engagement">Re-engagement</option>
            <option value="customer_success">Customer Success</option>
            <option value="promotional">Promotional</option>
          </select>

          <div className="flex gap-2">
            <button onClick={onClose} className="btn btn-ghost flex-1">Cancel</button>
            <button onClick={handleImport} disabled={!htmlContent.trim() || saving} className="btn btn-primary flex-1">
              {saving ? <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" /> : <Upload size={16} />}
              Import & Save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
