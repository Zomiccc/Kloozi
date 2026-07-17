import { useState, useEffect, useRef } from 'react';
import API from '../lib/api';
import toast from 'react-hot-toast';
import { Upload, Trash2, FolderPlus, FileText, Image, Video, Send, X, BarChart3, Plus, Repeat } from 'lucide-react';

export default function ContentLibrary() {
  const [files, setFiles] = useState([]);
  const [folders, setFolders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showSend, setShowSend] = useState(null);
  const [stats, setStats] = useState(null);
  const [tab, setTab] = useState('sequences');
  const [sequences, setSequences] = useState([]);
  const [messages, setMessages] = useState([]);
  const [pages, setPages] = useState([]);
  const [showNewSeq, setShowNewSeq] = useState(false);
  const fileRef = useRef();

  useEffect(() => { loadFiles(); loadFolders(); loadSequences(); loadMessages(); loadPages(); }, []);

  const loadFiles = async () => {
    try { const res = await API.get('/content'); setFiles(res.data.files); }
    catch { toast.error('Failed to load files'); }
    finally { setLoading(false); }
  };

  const loadFolders = async () => {
    try { const res = await API.get('/content/folders'); setFolders(res.data.folders); }
    catch {}
  };

  const loadSequences = async () => {
    try { const res = await API.get('/whatsapp/sequences'); setSequences(res.data.sequences || []); } catch {}
  };

  const loadMessages = async () => {
    try { const res = await API.get('/whatsapp/templates'); setMessages(res.data.templates || []); } catch {}
  };

  const loadPages = async () => {
    try { const res = await API.get('/automations/lead-form-pages'); setPages(res.data.pages || []); } catch {}
  };

  const handleUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('file', file);
    formData.append('name', file.name);
    try {
      await API.post('/content', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      toast.success('File uploaded');
      loadFiles();
    } catch { toast.error('Upload failed'); }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this file?')) return;
    try { await API.delete(`/content/${id}`); toast.success('Deleted'); loadFiles(); }
    catch { toast.error('Delete failed'); }
  };

  const handleSend = async (fileId, leadId, channel) => {
    try { await API.post('/content/send', { file_id: fileId, lead_id: leadId, channel }); toast.success('File sent'); setShowSend(null); }
    catch { toast.error('Send failed'); }
  };

  const loadStats = async (id) => {
    try { const res = await API.get(`/content/${id}/analytics`); setStats({ id, ...res.data.analytics }); }
    catch { toast.error('Failed'); }
  };

  const fileIcon = (type) => {
    if (type?.startsWith('image')) return <Image size={20} className="text-blue-500" />;
    if (type?.startsWith('video')) return <Video size={20} className="text-purple-500" />;
    return <FileText size={20} className="text-dark-500" />;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-dark-900">Content</h1>
        {tab === 'sequences' && <button onClick={() => setShowNewSeq(true)} className="btn btn-primary flex items-center gap-2"><Plus size={16} /> New Sequence</button>}
        {tab === 'messages' && <button onClick={() => toast.success('New message editor')} className="btn btn-primary flex items-center gap-2"><Plus size={16} /> New Message</button>}
        {tab === 'files' && <button onClick={() => fileRef.current?.click()} className="btn btn-primary flex items-center gap-2"><Upload size={16} /> Upload File</button>}
        {tab === 'pages' && <button onClick={() => toast.success('New page builder')} className="btn btn-primary flex items-center gap-2"><Plus size={16} /> New Page</button>}
        <input ref={fileRef} type="file" className="hidden" onChange={handleUpload} />
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 border-b border-dark-100">
        {['sequences', 'messages', 'files', 'pages'].map(t => (
          <button key={t} onClick={() => setTab(t)} className={`px-4 py-2.5 text-sm font-medium capitalize ${tab === t ? 'text-primary-600 border-b-2 border-primary-600' : 'text-dark-400 hover:text-dark-600'}`}>{t}</button>
        ))}
      </div>

      {/* Sequences tab */}
      {tab === 'sequences' && (
        <div className="space-y-4">
          <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
            <p className="text-sm font-medium text-purple-800">⚡ MANAGE AUTOMATED SEQUENCE TRIGGERS</p>
            <p className="text-xs text-purple-700 mt-1">Configure lead automation rules to automatically add new leads to specific sequences.</p>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-dark-400">{sequences.length} TOTAL SEQUENCE(S)</span>
            <select className="input w-auto text-sm"><option>SORT BY: TITLE (A-Z)</option><option>SORT BY: DATE (NEWEST)</option></select>
          </div>
          {loading ? <div className="flex justify-center py-8"><div className="animate-spin w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full" /></div> :
           sequences.length === 0 ? (
            <div className="card text-center py-12">
              <Repeat size={48} className="text-dark-300 mx-auto mb-3" />
              <p className="text-lg font-medium text-dark-700">Welcome to your Sequences</p>
              <p className="text-sm text-dark-400 mt-1 max-w-md mx-auto">Create sequences that prompt you to contact clients and share content at the right time, helping you stay on track and streamline your workflow.</p>
              <button className="text-sm text-primary-600 font-medium mt-3 hover:underline">LEARN MORE</button>
            </div>
          ) : (
            <div className="space-y-3">
              {sequences.map(seq => (
                <div key={seq.id} className="card">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className={`badge ${seq.trigger_type === 'automatic' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>{seq.trigger_type === 'automatic' ? 'Auto' : 'Manual'}</span>
                      <h3 className="font-semibold text-dark-900">{seq.name}</h3>
                    </div>
                    <span className="flex items-center gap-1 text-xs text-green-600"><span className="w-2 h-2 bg-green-500 rounded-full" /> Active</span>
                  </div>
                  {seq.description && <p className="text-sm text-dark-400 mb-2">{seq.description}</p>}
                  <p className="text-xs text-dark-400">{seq.steps_count || 0} steps over {seq.duration_days || 0} days | {seq.enrolled_count || 0} clients in sequence</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Messages tab */}
      {tab === 'messages' && (
        <div className="space-y-3">
          {messages.length === 0 ? <div className="card text-center py-12"><p className="text-dark-400">No message templates yet</p></div> :
            messages.map(msg => (
              <div key={msg.id} className="card flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2"><h3 className="font-medium text-dark-900">{msg.name}</h3><span className="badge bg-green-100 text-green-700">WhatsApp</span></div>
                  <p className="text-xs text-dark-400 mt-1 truncate">{msg.content?.substring(0, 100)}...</p>
                  <p className="text-xs text-dark-400 mt-1">Sent: {msg.send_count || 0} times</p>
                </div>
              </div>
            ))
          }
        </div>
      )}

      {/* Files tab */}
      {tab === 'files' && (
        <div>
          {loading ? <div className="flex justify-center py-8"><div className="animate-spin w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full" /></div> :
           files.length === 0 ? <div className="card text-center py-12"><FileText size={48} className="text-dark-300 mx-auto mb-3" /><p className="text-dark-400">No files uploaded yet</p></div> :
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {files.map(f => (
                <div key={f.id} className="card">
                  <div className="flex items-center gap-3 mb-3">
                    {fileIcon(f.mime_type)}
                    <div className="flex-1 min-w-0"><p className="text-sm font-medium truncate">{f.name}</p><p className="text-xs text-dark-400">{(f.size_bytes / 1024 / 1024).toFixed(2)} MB</p></div>
                  </div>
                  <div className="flex gap-1">
                    <button onClick={() => setShowSend(f)} className="btn btn-secondary flex-1 text-sm py-1.5"><Send size={14} /></button>
                    <button onClick={() => loadStats(f.id)} className="btn btn-secondary flex-1 text-sm py-1.5"><BarChart3 size={14} /></button>
                    <button onClick={() => handleDelete(f.id)} className="btn btn-danger flex-1 text-sm py-1.5"><Trash2 size={14} /></button>
                  </div>
                  {stats?.id === f.id && (
                    <div className="mt-3 pt-3 border-t border-dark-100 grid grid-cols-3 gap-2 text-center text-xs">
                      <div><p className="font-bold">{stats.total_sends}</p><p className="text-dark-400">Sends</p></div>
                      <div><p className="font-bold">{stats.total_opens}</p><p className="text-dark-400">Opens</p></div>
                      <div><p className="font-bold">{stats.open_rate}%</p><p className="text-dark-400">Open Rate</p></div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          }
        </div>
      )}

      {/* Pages tab */}
      {tab === 'pages' && (
        <div className="space-y-3">
          {pages.length === 0 ? <div className="card text-center py-12"><FileText size={48} className="text-dark-300 mx-auto mb-3" /><p className="text-dark-400">No lead form pages yet</p></div> :
            pages.map(p => (
              <div key={p.id} className="card flex items-center justify-between">
                <div className="flex-1">
                  <h3 className="font-medium text-dark-900">{p.name}</h3>
                  <p className="text-xs text-dark-400 mt-1">Views: {p.views || 0} | Submissions: {p.submissions || 0} | Rate: {p.views > 0 ? Math.round((p.submissions / p.views) * 100) : 0}%</p>
                </div>
                <button onClick={() => window.open(`/api/automations/lead-form/${p.form_key}`, '_blank')} className="btn btn-secondary text-sm">View Page</button>
              </div>
            ))
          }
        </div>
      )}

      {showSend && <SendFileModal file={showSend} onClose={() => setShowSend(null)} onSend={handleSend} />}
      {showNewSeq && <NewSequenceModal onClose={() => setShowNewSeq(false)} onCreated={() => { setShowNewSeq(false); loadSequences(); }} />}
    </div>
  );
}

function SendFileModal({ file, onClose, onSend }) {
  const [leadId, setLeadId] = useState('');
  const [channel, setChannel] = useState('email');
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl p-6 w-full max-w-md">
        <div className="flex items-center justify-between mb-4"><h2 className="text-xl font-bold">Send: {file.name}</h2><button onClick={onClose}><X size={20} /></button></div>
        <div className="space-y-3">
          <input className="input" placeholder="Lead ID" value={leadId} onChange={(e) => setLeadId(e.target.value)} />
          <select className="input" value={channel} onChange={(e) => setChannel(e.target.value)}>
            <option value="email">Email</option><option value="whatsapp">WhatsApp</option><option value="sms">SMS</option>
          </select>
          <button onClick={() => onSend(file.id, leadId, channel)} className="btn btn-primary w-full">Send File</button>
        </div>
      </div>
    </div>
  );
}

function NewSequenceModal({ onClose, onCreated }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [triggerType, setTriggerType] = useState('manual');
  const [channel, setChannel] = useState('whatsapp');
  const [steps, setSteps] = useState([{ day: 1, action: 'send_message', message: '' }]);

  const addStep = () => setSteps([...steps, { day: steps[steps.length - 1]?.day + 1 || 1, action: 'send_message', message: '' }]);
  const updateStep = (i, key, val) => setSteps(steps.map((s, idx) => idx === i ? { ...s, [key]: val } : s));
  const removeStep = (i) => setSteps(steps.filter((_, idx) => idx !== i));

  const handleCreate = async () => {
    if (!name) return toast.error('Sequence name required');
    try {
      await API.post('/whatsapp/sequences', { name, description, trigger_type: triggerType, channel, steps });
      toast.success('Sequence created');
      onCreated();
    } catch { toast.error('Failed to create sequence'); }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4"><h2 className="text-xl font-bold">New Sequence</h2><button onClick={onClose}><X size={20} /></button></div>
        <div className="space-y-4">
          <div><label className="text-sm font-medium">Sequence Name *</label><input className="input mt-1" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. New Lead Follow-up" /></div>
          <div><label className="text-sm font-medium">Description</label><textarea className="input mt-1" rows={2} value={description} onChange={e => setDescription(e.target.value)} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-sm font-medium">Trigger</label><select className="input mt-1" value={triggerType} onChange={e => setTriggerType(e.target.value)}><option value="manual">Manual</option><option value="automatic">Automatic</option></select></div>
            <div><label className="text-sm font-medium">Channel</label><select className="input mt-1" value={channel} onChange={e => setChannel(e.target.value)}><option value="whatsapp">WhatsApp</option><option value="email">Email</option><option value="sms">SMS</option></select></div>
          </div>
          <div>
            <div className="flex items-center justify-between mb-2"><label className="text-sm font-medium">Steps</label><button onClick={addStep} className="text-xs text-primary-600 flex items-center gap-1"><Plus size={14} /> Add Step</button></div>
            {steps.map((s, i) => (
              <div key={i} className="flex items-center gap-2 mb-2">
                <span className="text-xs text-dark-400 w-16">Day {s.day}</span>
                <input className="input flex-1" placeholder="Message content" value={s.message} onChange={e => updateStep(i, 'message', e.target.value)} />
                <button onClick={() => removeStep(i)} className="text-red-500 p-1"><Trash2 size={14} /></button>
              </div>
            ))}
          </div>
          <button onClick={handleCreate} className="btn btn-primary w-full">Create Sequence</button>
        </div>
      </div>
    </div>
  );
}
