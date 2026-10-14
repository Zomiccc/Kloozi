import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import API from '../../lib/api';
import toast from 'react-hot-toast';
import { Plus, Mail } from 'lucide-react';
import { fmtDateTime } from '../../lib/marketingShared';
import useCreateRegistry from '../../stores/createStore';

export default function Emails() {
  const [emails, setEmails] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const register = useCreateRegistry((s) => s.register);
  const clearRegistry = useCreateRegistry((s) => s.clear);

  useEffect(() => {
    register([{ label: 'New email design', icon: <Mail size={14} />, run: () => navigate('/app/marketing/emails/new') }]);
    return () => clearRegistry();
  }, [register, clearRegistry, navigate]);

  useEffect(() => { load(); }, []);
  const load = async () => {
    try { setEmails((await API.get('/marketing/emails')).data.emails); }
    catch { toast.error('Failed to load emails'); }
    finally { setLoading(false); }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 style={{ fontSize: '32px', fontWeight: 650, letterSpacing: '-0.01em' }}>Emails</h1>
        <p className="text-ink-secondary mt-1" style={{ fontSize: '15px' }}>
          Designs built once, reused across campaigns and flows.
        </p>
      </div>

      {loading ? (
        <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="skeleton h-14" />)}</div>
      ) : emails.length === 0 ? (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="pt-16 max-w-[560px]">
          <p style={{ fontSize: '22px', fontWeight: 600 }}>No saved emails yet.</p>
          <p className="text-ink-secondary mt-2" style={{ fontSize: '15px' }}>
            Build one with drag-and-drop blocks — responsive on any inbox. Use the + in the top bar.
          </p>
        </motion.div>
      ) : (
        <div>
          {emails.map((em, idx) => (
            <motion.div
              key={em.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(idx * 0.04, 0.3), duration: 0.2 }}
              onClick={() => navigate(`/app/marketing/emails/${em.id}`)}
              className="group hairline-b py-4 flex items-center justify-between gap-4 cursor-pointer hover-accent-left"
            >
              <div className="min-w-0">
                <h3 className="font-semibold" style={{ fontSize: '15px' }}>{em.name}</h3>
                <p className="text-ink-secondary truncate mt-0.5" style={{ fontSize: '13px' }}>{em.subject || '(no subject)'}</p>
              </div>
              <div className="flex items-center gap-6 flex-shrink-0">
                <span className="text-ink-tertiary hidden sm:block" style={{ fontSize: '12px' }}>Updated {fmtDateTime(em.updated_at)}</span>
                <button onClick={(e) => { e.stopPropagation(); navigate(`/app/marketing/emails/${em.id}`); }}
                  className="opacity-0 group-hover:opacity-100 transition-opacity btn-ghost text-sm font-medium">Edit</button>
                <button onClick={async (e) => {
                  e.stopPropagation();
                  if (!window.confirm(`Delete "${em.name}"?`)) return;
                  try { await API.delete(`/marketing/emails/${em.id}`); toast.success('Deleted'); load(); }
                  catch { toast.error('Delete failed'); }
                }} className="opacity-0 group-hover:opacity-100 transition-opacity btn-danger text-sm font-medium">Delete</button>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
