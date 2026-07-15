import { useState, useEffect, useRef } from 'react';
import API from '../lib/api';
import toast from 'react-hot-toast';
import { Upload, Trash2, FolderPlus, FileText, Image, Video, Send, X, BarChart3 } from 'lucide-react';

export default function ContentLibrary() {
  const [files, setFiles] = useState([]);
  const [folders, setFolders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showSend, setShowSend] = useState(null);
  const [stats, setStats] = useState(null);
  const fileRef = useRef();

  useEffect(() => { loadFiles(); loadFolders(); }, []);

  const loadFiles = async () => {
    try { const res = await API.get('/content'); setFiles(res.data.files); }
    catch { toast.error('Failed to load files'); }
    finally { setLoading(false); }
  };

  const loadFolders = async () => {
    try { const res = await API.get('/content/folders'); setFolders(res.data.folders); }
    catch {}
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
        <h1 className="text-2xl font-bold text-dark-900">Content Library</h1>
        <button onClick={() => fileRef.current?.click()} className="btn btn-primary flex items-center gap-2"><Upload size={16} /> Upload File</button>
        <input ref={fileRef} type="file" className="hidden" onChange={handleUpload} />
      </div>

      {loading ? <div className="flex justify-center py-8"><div className="animate-spin w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full" /></div> :
        files.length === 0 ? <div className="card text-center py-12 text-dark-400"><p>No files uploaded yet</p></div> :
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

      {showSend && <SendFileModal file={showSend} onClose={() => setShowSend(null)} onSend={handleSend} />}
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
