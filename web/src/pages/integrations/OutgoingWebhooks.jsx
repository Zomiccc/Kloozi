import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import API from '../../lib/api';
import toast from 'react-hot-toast';
import { ArrowLeft, Plus, Trash2, Send, Activity, X } from 'lucide-react';
import useCreateRegistry from '../../stores/createStore';

export default function OutgoingWebhooks() {
  const navigate = useNavigate();
  const [webhooks, setWebhooks] = useState([]);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [showLogs, setShowLogs] = useState(false);
  const register = useCreateRegistry((s) => s.register);
  const clearRegistry = useCreateRegistry((s) => s.clear);

  useEffect(() => {
    register([{ label: 'New webhook', icon: <Plus size={14} />, run: () => setShowCreate(true) }]);
    return () => clearRegistry();
  }, [register, clearRegistry]);

  useEffect(() => { loadWebhooks(); }, []);
  const loadWebhooks = async () => {
    try { const res = await API.get('/automations/outgoing-webhooks'); setWebhooks(res.data.webhooks || []); }
    catch {}
    finally { setLoading(false); }
  };
  const loadLogs = async () => {
    try { const res = await API.get('/automations/outgoing-webhooks/logs'); setLogs(res.data.logs || []); setShowLogs(true); } catch {}
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this webhook?')) return;
    try { await API.delete(`/automations/outgoing-webhooks/${id}`); toast.success('Deleted'); loadWebhooks(); } catch {}
  };
  const handleTest = async (id) => {
    try {
      const res = await API.post(`/automations/outgoing-webhooks/${id}/test`);
      toast[res.data.success ? 'success' : 'error'](res.data.success ? 'Test delivered' : 'Test failed');
    } catch {}
  };

  const events = ['new_lead', 'stage_changed', 'follow_up_completed', 'deal_won', 'deal_lost'];

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <button onClick={() => navigate('/app/automations')} className="btn-ghost text-sm font-medium flex items-center gap-1.5">
        <ArrowLeft size={14} /> Automations
      </button>

      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 style={{ fontSize: '32px', fontWeight: 650, letterSpacing: '-0.01em' }}>Outgoing Webhooks</h1>
          <p className="text-ink-secondary mt-1" style={{ fontSize: '15px' }}>
            When something happens here, tell any other system — instantly.
          </p>
        </div>
        <button onClick={loadLogs} className="btn btn-secondary text-sm"><Activity size={15} /> Logs</button>
      </div>

      {loading ? (
        <div className="space-y-2">{[1, 2, 3].map((i) => <div key={i} className="skeleton h-16" />)}</div>
      ) : webhooks.length === 0 ? (
        <div className="pt-16 max-w-[560px]">
          <p style={{ fontSize: '22px', fontWeight: 600 }}>No webhooks yet.</p>
          <p className="text-ink-secondary mt-2" style={{ fontSize: '15px' }}>
            Point Flazyn events at any URL — Zapier, Make, your own backend, anything that accepts a POST.
          </p>
        </div>
      ) : (
        <div>
          {webhooks.map((w, idx) => {
            let evts = [];
            try { evts = typeof w.events === 'string' ? JSON.parse(w.events) : (w.events || []); } catch {}
            return (
              <motion.div
                key={w.id}
                initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(idx * 0.04, 0.3), duration: 0.2 }}
                className="group hairline-b py-4 flex items-start justify-between gap-4 hover-accent-left"
              >
                <div className="min-w-0">
                  <h3 className="font-semibold" style={{ fontSize: '15px' }}>{w.name}</h3>
                  <p className="mono text-ink-secondary mt-0.5 truncate" style={{ fontSize: '12px' }}>{w.url}</p>
                  <p className="text-ink-secondary mt-1" style={{ fontSize: '13px' }}>
                    {evts.length ? evts.join(' · ') : 'No events selected'}
                  </p>
                </div>
                <div className="flex items-center gap-3 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                  <button onClick={() => handleTest(w.id)} className="btn-ghost text-sm font-medium flex items-center gap-1.5"><Send size={13} /> Test</button>
                  <button onClick={() => handleDelete(w.id)} className="btn-danger text-sm font-medium"><Trash2 size={14} /></button>
                </div>
              </motion.div>
            );
          })}
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
      if (!selectedEvents.length) return toast.error('Pick at least one event');
      try { await API.post('/automations/outgoing-webhooks', { name, url, events: selectedEvents }); toast.success('Webhook created'); onCreated(); } catch { toast.error('Failed'); }
    };
    return (
      <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-0 sm:p-6 overflow-y-auto" style={{ background: 'rgba(28,25,23,0.25)' }} onClick={onClose}>
        <div className="card-raised w-full max-w-md my-auto" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center justify-between mb-5">
            <h2 style={{ fontSize: '18px', fontWeight: 600 }}>New outgoing webhook</h2>
            <button onClick={onClose} className="text-ink-tertiary hover:text-ink-primary transition-colors">✕</button>
          </div>
          <div className="space-y-4">
            <div>
              <p className="meta-label mb-1">Name</p>
              <input className="input" placeholder="e.g. Notify operations" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div>
              <p className="meta-label mb-1">Endpoint URL</p>
              <input className="input mono" style={{ fontSize: '13px' }} placeholder="https://example.com/webhook" value={url} onChange={(e) => setUrl(e.target.value)} />
            </div>
            <div>
              <p className="meta-label mb-2">Fire on</p>
              <div className="space-y-2">
                {events.map((ev) => (
                  <label key={ev} className="flex items-center gap-2 cursor-pointer select-none">
                    <input type="checkbox" checked={selectedEvents.includes(ev)} onChange={(e) => setSelectedEvents(e.target.checked ? [...selectedEvents, ev] : selectedEvents.filter((x) => x !== ev))} />
                    <span className="mono" style={{ fontSize: '13px' }}>{ev}</span>
                  </label>
                ))}
              </div>
            </div>
            <button onClick={handleCreate} className="btn btn-primary w-full">Create webhook</button>
          </div>
        </div>
      </div>
    );
  }

  function LogsModal({ logs, onClose }) {
    return (
      <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-0 sm:p-6 overflow-y-auto" style={{ background: 'rgba(28,25,23,0.25)' }} onClick={onClose}>
        <div className="card-raised w-full max-w-lg my-auto max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center justify-between mb-5">
            <h2 style={{ fontSize: '18px', fontWeight: 600 }}>Delivery log</h2>
            <button onClick={onClose} className="text-ink-tertiary hover:text-ink-primary transition-colors"><X size={18} /></button>
          </div>
          {logs.length === 0 ? (
            <p className="text-ink-secondary" style={{ fontSize: '14px' }}>Nothing fired yet.</p>
          ) : (
            <div>
              {logs.map((l) => (
                <div key={l.id} className="hairline-b py-3">
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-medium" style={{ fontSize: '14px' }}>{l.webhook_name}</span>
                    <span className={`badge ${String(l.status) === 'success' ? 'badge-success' : 'badge-danger'}`}>{l.response_code ?? l.status}</span>
                  </div>
                  <p className="text-ink-secondary mono mt-1" style={{ fontSize: '12px' }}>{l.event} · {new Date(l.created_at).toLocaleString()}</p>
                  {l.error_message && <p className="text-ink-secondary mt-1" style={{ fontSize: '13px' }}>{l.error_message}</p>}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }
}
