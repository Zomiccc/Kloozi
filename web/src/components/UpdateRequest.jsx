import { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { BellRing } from 'lucide-react';
import API from '../lib/api';
import useAuthStore from '../stores/authStore';

/* "Request an update" — a manager nudges the assigned member about a lead.
   The lead shows a thin "Update requested" banner until the member logs a
   call, note, message or stage change (cleared by the server). */

const MANAGER_ROLES = ['super_admin', 'admin', 'sales_manager'];
export const canRequestUpdates = (user) => MANAGER_ROLES.includes(user?.role);

function ago(ts) {
  const mins = Math.max(0, Math.round((Date.now() - new Date(ts).getTime()) / 60000));
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const h = Math.round(mins / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

/** Loads the open request for a lead and refreshes on live notifications. */
export function useUpdateRequest(leadId, refreshKey) {
  const [request, setRequest] = useState(null);
  const load = () => API.get(`/leads/${leadId}/update-request`).then((r) => setRequest(r.data.request)).catch(() => {});
  useEffect(() => { if (leadId) load(); }, [leadId, refreshKey]);
  useEffect(() => {
    const onNote = (e) => {
      const d = e.detail?.data || {};
      if ((d.leadId || d.lead_id) === leadId) load();
    };
    window.addEventListener('flazyn:notification', onNote);
    return () => window.removeEventListener('flazyn:notification', onNote);
  }, [leadId]);
  return [request, load];
}

export function UpdateRequestBanner({ leadId, request, onChange }) {
  const { user } = useAuthStore();
  if (!request) return null;
  const mine = request.assigned_to === user?.id;
  const withdraw = async () => {
    try { await API.delete(`/leads/${leadId}/update-request`); toast.success('Request withdrawn'); onChange?.(); }
    catch (err) { toast.error(err.response?.data?.error || 'Could not withdraw'); }
  };
  return (
    <div
      role="status"
      className="flex items-center gap-2.5 flex-wrap"
      style={{ padding: '7px 24px', background: 'linear-gradient(90deg, #FFFBEB, #FFFDF7)', borderBottom: '1px solid #FDECC8', fontSize: 12.5, color: '#78350F' }}
    >
      <span className="ur-dot" aria-hidden />
      <span style={{ fontWeight: 650, letterSpacing: '0.01em' }}>Update requested</span>
      <span style={{ color: '#A16207' }}>
        by {request.requested_by_name} · {ago(request.created_at)}
        {request.note && !request.auto && <> · “{request.note}”</>}
      </span>
      <span className="flex-1" />
      {mine
        ? <span style={{ color: '#A16207' }}>Log a call, note or message to clear it</span>
        : canRequestUpdates(user) && <button onClick={withdraw} className="hover:underline" style={{ color: '#92400E', fontWeight: 600 }}>Withdraw</button>}
    </div>
  );
}

export function RequestUpdateButton({ leadId, lead, request, onDone }) {
  const { user } = useAuthStore();
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState('');
  const [sending, setSending] = useState(false);
  const box = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const close = (e) => { if (box.current && !box.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  if (!canRequestUpdates(user) || !lead?.assigned_to || lead.assigned_to === user?.id) return null;
  const agent = lead.agent_first_name || 'the assigned member';

  const send = async () => {
    setSending(true);
    try {
      const r = await API.post(`/leads/${leadId}/update-request`, { note });
      toast.success(r.data.already ? 'An update is already requested' : `${agent} has been notified`);
      setOpen(false); setNote(''); onDone?.();
    } catch (err) { toast.error(err.response?.data?.error || 'Could not send the request'); }
    finally { setSending(false); }
  };

  return (
    <div className="relative flex-shrink-0" ref={box}>
      <button
        onClick={() => setOpen((v) => !v)}
        disabled={!!request}
        title={request ? 'An update is already requested' : `Ask ${agent} for an update`}
        className="flex items-center gap-2 transition-colors disabled:opacity-60"
        style={{ fontSize: 13, fontWeight: 600, padding: '9px 14px', borderRadius: 10, background: '#FFFFFF', color: '#1C1917', border: '1px solid #E7E5E4' }}
      >
        <BellRing size={14} /> {request ? 'Update requested' : 'Request an update'}
      </button>
      {open && (
        <div className="absolute right-0 z-30 bg-white" style={{ top: 'calc(100% + 8px)', width: 300, borderRadius: 12, border: '1px solid #E7E5E4', boxShadow: '0 12px 32px rgba(28,25,23,0.16)', padding: 14 }}>
          <p style={{ fontWeight: 650, fontSize: 14 }}>Ask {agent} for an update</p>
          <p style={{ fontSize: 12.5, color: 'var(--ink-3, #78716C)', marginTop: 2 }}>They get a notification now, and a reminder if nothing is logged in 4 hours.</p>
          <textarea
            className="input mt-3" rows={2} maxLength={500} autoFocus
            placeholder="Optional note, e.g. “Did they confirm the visit?”"
            value={note} onChange={(e) => setNote(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) send(); }}
          />
          <div className="flex justify-end gap-2 mt-3">
            <button onClick={() => setOpen(false)} className="btn btn-secondary btn-sm">Cancel</button>
            <button onClick={send} disabled={sending} className="btn btn-primary btn-sm">{sending ? 'Sending…' : 'Send request'}</button>
          </div>
        </div>
      )}
    </div>
  );
}

/** Small pill for lists and pipeline cards. */
export function UpdateRequestedPill() {
  return (
    <span className="inline-flex items-center gap-1" style={{ fontSize: 11, fontWeight: 650, color: '#92400E', background: '#FFFBEB', border: '1px solid #FDECC8', borderRadius: 999, padding: '1px 7px', whiteSpace: 'nowrap' }}>
      <span className="ur-dot" aria-hidden style={{ width: 5, height: 5 }} /> Update requested
    </span>
  );
}
