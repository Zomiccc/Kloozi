import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import API from '../../lib/api';
import toast from 'react-hot-toast';
import { ArrowLeft, Webhook, Plus, Trash2, Send, Activity } from 'lucide-react';

export default function OutgoingWebhooks() {
  const navigate = useNavigate();
  const [webhooks, setWebhooks] = useState([]);
  const [logs, setLogs] = useState([]);
  const [showCreate, setShowCreate] = useState(false);
  const [showLogs, setShowLogs] = useState(false);

  useEffect(() => { loadWebhooks(); }, []);
  const loadWebhooks = async () => { try { const res = await API.get('/automations/outgoing-webhooks'); setWebhooks(res.data.webhooks || []); } catch {} };
  const loadLogs = async () => { try { const res = await API.get('/automations/outgoing-webhooks/logs'); setLogs(res.data.logs || []); setShowLogs(true); } catch {} };

  const handleDelete = async (id) => { if (!confirm('Delete?')) return; try { await API.delete(`/automations/outgoing-webhooks/${id}`); toast.success('Deleted'); loadWebhooks(); } catch {} };
  const handleTest = async (id) => { try { const res = await API.post(`/automations/outgoing-webhooks/${id}/test`); toast[res.data.success ? 'success' : 'error'](res.data.success ? 'Test successful' : 'Test failed'); } catch {} };

  const events = ['new_lead', 'stage_changed', 'follow_up_completed', 'deal_won', 'deal_lost'];

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <button onClick={() => navigate('/automations')} className="flex items-center gap-2 text-sm text-dark-400 hover:text-dark-600"><ArrowLeft size={16} /> Back to Automations</button>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center"><Webhook size={24} className="text-purple-600" /></div>
          <div><h2 className="text-xl font-bold text-dark-900">Outgoing Webhooks</h2><p className="text-sm text-dark-400">Trigger webhooks to any system</p></div>
        </div>
        <div className="flex gap-2">
          <button onClick={loadLogs} className="btn btn-secondary flex items-center gap-2 text-sm"><Activity size={16} /> Logs</button>
          <button onClick={() => setShowCreate(true)} className="btn btn-primary flex items-center gap-2"><Plus size={16} /> New Webhook</button>
        </div>
      </div>

      {webhooks.length === 0 ? (
        <div className="card text-center py-12"><Webhook size={48} className="text-dark-300 mx-auto mb-3" /><p className="text-dark-400">No outgoing webhooks yet</p></div>
      ) : (
        <div className="space-y-3">
          {webhooks.map(w => (
            <div key={w.id} className="card flex items-center justify-between">
              <div className="flex-1"><p className="font-medium text-dark-900">{w.name}</p><p className="text-xs text-dark-400 font-mono">{w.url}</p><p className="text-xs text-dark-400 mt-1">Events: {typeof w.events === 'string' ? JSON.parse(w.events).join(', ') : w.events?.join(', ')}</p></div>
              <div className="flex gap-2">
                <button onClick={() => handleTest(w.id)} className="btn btn-secondary text-sm p-2"><Send size={14} /></button>
                <button onClick={() => handleDelete(w.id)} className="btn btn-danger text-sm p-2"><Trash2 size={14} /></button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showCreate && <CreateWebhookModal events={events} onClose={() => setShowCreate(false)} onCreated={() => { setShowCreate(false); loadWebhooks(); }} />}
      {showLogs && <LogsModal logs={logs} onClose={() => setShowLogs(false)} />}
    </div>
  );

  function CreateWebhookModal({ events, onClose, onCreated }) {
    const [name, setName] = useState('');
    const [url, setUrl] = useState('');
    const [selectedEvents, setSelectedEvents] = useState([]);
    const handleCreate = async () => {
      if (!name || !url) return toast.error('Fill all fields');
      try { await API.post('/automations/outgoing-webhooks', { name, url, events: selectedEvents }); toast.success('Webhook created'); onCreated(); } catch { toast.error('Failed'); }
    };
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl p-6 w-full max-w-md">
          <div className="flex items-center justify-between mb-4"><h2 className="text-xl font-bold">New Outgoing Webhook</h2><button onClick={onClose}>✕</button></div>
          <div className="space-y-3">
            <input className="input" placeholder="Webhook name" value={name} onChange={e => setName(e.target.value)} />
            <input className="input" placeholder="https://example.com/webhook" value={url} onChange={e => setUrl(e.target.value)} />
            <div>
              <label className="text-sm font-medium">Events:</label>
              <div className="space-y-1 mt-2">
                {events.map(ev => (
                  <label key={ev} className="flex items-center gap-2"><input type="checkbox" checked={selectedEvents.includes(ev)} onChange={e => setSelectedEvents(e.target.checked ? [...selectedEvents, ev] : selectedEvents.filter(x => x !== ev))} /> <span className="text-sm">{ev}</span></label>
                ))}
              </div>
            </div>
            <button onClick={handleCreate} className="btn btn-primary w-full">Create Webhook</button>
          </div>
        </div>
      </div>
    );
  }

  function LogsModal({ logs, onClose }) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl p-6 w-full max-w-lg max-h-[80vh] overflow-y-auto">
          <div className="flex items-center justify-between mb-4"><h2 className="text-xl font-bold">Webhook Logs</h2><button onClick={onClose}>✕</button></div>
          {logs.length === 0 ? <p className="text-dark-400 text-sm">No logs yet</p> : (
            <div className="space-y-2">
              {logs.map(l => (
                <div key={l.id} className="border border-dark-100 rounded-lg p-3">
                  <div className="flex items-center justify-between"><span className="text-sm font-medium">{l.webhook_name}</span><span className={`badge ${l.status === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{l.response_code}</span></div>
                  <p className="text-xs text-dark-400 mt-1">Event: {l.event} | {new Date(l.created_at).toLocaleString()}</p>
                  {l.error_message && <p className="text-xs text-red-500 mt-1">{l.error_message}</p>}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }
}
