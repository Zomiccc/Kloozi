import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import API from '../lib/api';
import { CountUp, SectionTabs } from '../lib/motion';
import toast from 'react-hot-toast';
import { Upload, Trash2, FileText, Image, Video, Send, X, BarChart3, Plus, Repeat } from 'lucide-react';
import { pillStyle } from '../components/ui';

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
    if (type?.startsWith('image')) return <Image size={16} className="text-ink-tertiary" />;
    if (type?.startsWith('video')) return <Video size={16} className="text-ink-tertiary" />;
    return <FileText size={16} className="text-ink-tertiary" />;
  };

  const tabs = [
    { key: 'sequences', label: 'Sequences' },
    { key: 'messages', label: 'Messages' },
    { key: 'files', label: 'Files' },
    { key: 'pages', label: 'Pages' },
  ];

  return (
    <div className="space-y-6">
      {/* Header — editorial */}
      <div className="flex items-baseline justify-between flex-wrap gap-4">
        <h1 className="text-ink-primary" style={{ fontSize: '32px', fontWeight: 650, letterSpacing: '-0.01em' }}>Content</h1>
        <div className="flex items-center gap-4">
          {tab === 'sequences' && <button onClick={() => setShowNewSeq(true)} className="text-ink-primary hover:text-accent-deep underline underline-offset-4 transition-colors" style={{ fontSize: '15px', fontWeight: 600 }}>New sequence</button>}
          {tab === 'messages' && <button onClick={() => toast.success('New message editor')} className="text-ink-primary hover:text-accent-deep underline underline-offset-4 transition-colors" style={{ fontSize: '15px', fontWeight: 600 }}>New message</button>}
          {tab === 'files' && <button onClick={() => fileRef.current?.click()} className="text-ink-primary hover:text-accent-deep underline underline-offset-4 transition-colors" style={{ fontSize: '15px', fontWeight: 600 }}>Upload file</button>}
          {tab === 'pages' && <button onClick={() => toast.success('New page builder')} className="text-ink-primary hover:text-accent-deep underline underline-offset-4 transition-colors" style={{ fontSize: '15px', fontWeight: 600 }}>New page</button>}
          <input ref={fileRef} type="file" className="hidden" onChange={handleUpload} />
        </div>
      </div>

      {/* Tab rail — pinned secondary bar, never under the title */}
      <SectionTabs
        layoutId="content-tabs"
        tabs={tabs}
        active={tab}
        onChange={setTab}
      />

      {/* Sequences tab */}
      {tab === 'sequences' && (
        <div className="space-y-4">
          {loading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => <div key={i} className="skeleton h-12" />)}
            </div>
          ) : sequences.length === 0 ? (
            <div className="text-center py-20">
              <Repeat size={28} className="text-ink-tertiary mx-auto mb-4" />
              <p className="text-ink-primary" style={{ fontSize: '22px', fontWeight: 600 }}>No sequences yet.</p>
              <p className="text-ink-secondary mt-2" style={{ fontSize: '15px' }}>Create sequences to automate your outreach at the right time.</p>
            </div>
          ) : (
            <div>
              {sequences.map((seq, idx) => (
                <motion.div key={seq.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(idx * 0.04, 0.3), duration: 0.2 }} className="hairline-b py-4">
                  <div className="flex items-baseline gap-3">
                    <h3 className="text-ink-primary font-semibold" style={{ fontSize: '15px' }}>{seq.name}</h3>
                    <span className="capitalize flex-shrink-0" style={pillStyle(seq.trigger_type === 'automatic' ? '#0E8A5F' : '#2F6FDB')}>
                      {seq.trigger_type || 'manual'}
                    </span>
                    <span className=" flex-shrink-0" style={pillStyle('#0E8A5F')}>
                      Active
                    </span>
                  </div>
                  {seq.description && <p className="text-ink-secondary mt-1" style={{ fontSize: '14px' }}>{seq.description}</p>}
                  <p className="text-ink-tertiary mono mt-1" style={{ fontSize: '12px' }}>{seq.steps_count || 0} steps · {seq.duration_days || 0} days · {seq.enrolled_count || 0} enrolled</p>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Messages tab */}
      {tab === 'messages' && (
        <div>
          {messages.length === 0 ? (
            <div className="text-center py-20">
              <p className="text-ink-primary" style={{ fontSize: '22px', fontWeight: 600 }}>No message templates yet.</p>
              <p className="text-ink-secondary mt-2" style={{ fontSize: '15px' }}>Create WhatsApp message templates to reuse in your campaigns.</p>
            </div>
          ) : (
            <div>
              {messages.map((msg, idx) => (
                <motion.div key={msg.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(idx * 0.04, 0.3), duration: 0.2 }} className="hairline-b py-4">
                  <div className="flex items-baseline gap-3">
                    <h3 className="text-ink-primary font-semibold" style={{ fontSize: '15px' }}>{msg.name}</h3>
                    <span className=" flex-shrink-0" style={pillStyle('#0E8A5F')}>
                      WhatsApp
                    </span>
                  </div>
                  <p className="text-ink-secondary truncate mt-1" style={{ fontSize: '14px' }}>{msg.content?.substring(0, 100)}</p>
                  <p className="text-ink-tertiary mono mt-1" style={{ fontSize: '12px' }}>Sent {msg.send_count || 0} times</p>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Files tab */}
      {tab === 'files' && (
        <div>
          {loading ? (
            <div className="space-y-2">
              {[1, 2, 3, 4].map((i) => <div key={i} className="skeleton h-12" />)}
            </div>
          ) : files.length === 0 ? (
            <div className="text-center py-20">
              <FileText size={28} className="text-ink-tertiary mx-auto mb-4" />
              <p className="text-ink-primary" style={{ fontSize: '22px', fontWeight: 600 }}>No files uploaded yet.</p>
              <p className="text-ink-secondary mt-2" style={{ fontSize: '15px' }}>Upload brochures, images, and documents to share with leads.</p>
            </div>
          ) : (
            <div>
              {files.map((f, idx) => (
                <motion.div key={f.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(idx * 0.04, 0.3), duration: 0.2 }} className="group hairline-b py-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      {fileIcon(f.mime_type)}
                      <div className="flex-1 min-w-0">
                        <p className="text-ink-primary truncate" style={{ fontSize: '14px', fontWeight: 500 }}>{f.name}</p>
                        <p className="text-ink-tertiary mono" style={{ fontSize: '12px' }}>{(f.size_bytes / 1024 / 1024).toFixed(2)} MB</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                      <button onClick={() => setShowSend(f)} className="text-ink-tertiary hover:text-ink-primary transition-colors" style={{ fontSize: '13px' }}>Send</button>
                      <button onClick={() => loadStats(f.id)} className="text-ink-tertiary hover:text-ink-primary transition-colors" style={{ fontSize: '13px' }}>Stats</button>
                      <button onClick={() => handleDelete(f.id)} className="text-ink-tertiary hover:text-ink-primary transition-colors" style={{ fontSize: '13px' }}>Delete</button>
                    </div>
                  </div>
                  {stats?.id === f.id && (
                    <div className="mt-3 grid grid-cols-3 gap-0">
                      <div className="pr-4">
                        <p className="meta-label mb-1">Sends</p>
                        <p className="mono text-ink-primary" style={{ fontSize: '22px', fontWeight: 600 }}><CountUp value={Number(stats.total_sends) || 0} /></p>
                      </div>
                      <div className="hairline-l pl-4 pr-4">
                        <p className="meta-label mb-1">Opens</p>
                        <p className="mono text-ink-primary" style={{ fontSize: '22px', fontWeight: 600 }}><CountUp value={Number(stats.total_opens) || 0} /></p>
                      </div>
                      <div className="hairline-l pl-4">
                        <p className="meta-label mb-1">Open rate</p>
                        <p className="mono text-ink-primary" style={{ fontSize: '22px', fontWeight: 600 }}><CountUp value={Number(stats.open_rate) || 0} suffix="%" /></p>
                      </div>
                    </div>
                  )}
                </motion.div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Pages tab */}
      {tab === 'pages' && (
        <div>
          {pages.length === 0 ? (
            <div className="text-center py-20">
              <FileText size={28} className="text-ink-tertiary mx-auto mb-4" />
              <p className="text-ink-primary" style={{ fontSize: '22px', fontWeight: 600 }}>No lead form pages yet.</p>
              <p className="text-ink-secondary mt-2" style={{ fontSize: '15px' }}>Create landing pages to capture leads from your campaigns.</p>
            </div>
          ) : (
            <div>
              {pages.map((p, idx) => (
                <motion.div key={p.id || `page-${idx}`} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(idx * 0.04, 0.3), duration: 0.2 }} className="group hairline-b py-4 flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-ink-primary font-semibold" style={{ fontSize: '15px' }}>{p.name}</h3>
                    <p className="text-ink-tertiary mono mt-1" style={{ fontSize: '12px' }}>{p.views || 0} views · {p.submissions || 0} submissions · {p.views > 0 ? Math.round((p.submissions / p.views) * 100) : 0}% rate</p>
                  </div>
                  <div className="flex items-center gap-3 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                    <button onClick={() => window.open(`/api/automations/lead-form/${p.form_key}`, '_blank')} className="text-ink-tertiary hover:text-ink-primary transition-colors" style={{ fontSize: '13px' }}>View page</button>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(28,25,23,0.25)' }} onClick={onClose}>
      <div className="card-raised w-full max-w-md animate-scale-in" style={{ borderRadius: '10px' }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between hairline-b pb-4 mb-4">
          <h2 className="text-ink-primary" style={{ fontSize: '22px', fontWeight: 600 }}>Send: {file.name}</h2>
          <button onClick={onClose} className="text-ink-tertiary hover:text-ink-primary transition-colors"><X size={18} /></button>
        </div>
        <div className="space-y-4">
          <div>
            <p className="meta-label mb-1">Lead ID</p>
            <input className="input" value={leadId} onChange={(e) => setLeadId(e.target.value)} />
          </div>
          <div>
            <p className="meta-label mb-1">Channel</p>
            <select className="input" value={channel} onChange={(e) => setChannel(e.target.value)}>
              <option value="email">Email</option><option value="whatsapp">WhatsApp</option><option value="sms">SMS</option>
            </select>
          </div>
          <div className="flex justify-end gap-3 hairline pt-4">
            <button onClick={onClose} className="text-ink-secondary hover:text-ink-primary underline underline-offset-4 transition-colors" style={{ fontSize: '14px' }}>Cancel</button>
            <button onClick={() => onSend(file.id, leadId, channel)} className="btn btn-primary">Send file</button>
          </div>
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(28,25,23,0.25)' }} onClick={onClose}>
      <div className="card-raised w-full max-w-lg max-h-[90vh] overflow-y-auto animate-scale-in" style={{ borderRadius: '10px' }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between hairline-b pb-4 mb-4">
          <h2 className="text-ink-primary" style={{ fontSize: '22px', fontWeight: 600 }}>New sequence</h2>
          <button onClick={onClose} className="text-ink-tertiary hover:text-ink-primary transition-colors"><X size={18} /></button>
        </div>
        <div className="space-y-4">
          <div>
            <p className="meta-label mb-1">Name</p>
            <input className="input" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. New Lead Follow-up" />
          </div>
          <div>
            <p className="meta-label mb-1">Description</p>
            <textarea className="input" rows={2} value={description} onChange={e => setDescription(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="meta-label mb-1">Trigger</p>
              <select className="input" value={triggerType} onChange={e => setTriggerType(e.target.value)}><option value="manual">Manual</option><option value="automatic">Automatic</option></select>
            </div>
            <div>
              <p className="meta-label mb-1">Channel</p>
              <select className="input" value={channel} onChange={e => setChannel(e.target.value)}><option value="whatsapp">WhatsApp</option><option value="email">Email</option><option value="sms">SMS</option></select>
            </div>
          </div>
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="meta-label">Steps</p>
              <button onClick={addStep} className="text-ink-secondary hover:text-ink-primary underline underline-offset-4 transition-colors flex items-center gap-1" style={{ fontSize: '14px' }}><Plus size={12} /> Add step</button>
            </div>
            {steps.map((s, i) => (
              <div key={i} className="hairline-b py-2 flex items-center gap-3">
                <span className="text-ink-tertiary mono flex-shrink-0" style={{ fontSize: '12px' }}>Day {s.day}</span>
                <input className="input flex-1" placeholder="Message content" value={s.message} onChange={e => updateStep(i, 'message', e.target.value)} />
                <button onClick={() => removeStep(i)} className="text-ink-tertiary hover:text-ink-primary transition-colors"><Trash2 size={14} /></button>
              </div>
            ))}
          </div>
          <div className="flex justify-end gap-3 hairline pt-4">
            <button onClick={onClose} className="text-ink-secondary hover:text-ink-primary underline underline-offset-4 transition-colors" style={{ fontSize: '14px' }}>Cancel</button>
            <button onClick={handleCreate} className="btn btn-primary">Create sequence</button>
          </div>
        </div>
      </div>
    </div>
  );
}
