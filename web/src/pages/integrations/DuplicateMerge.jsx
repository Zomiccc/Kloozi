import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import API from '../../lib/api';
import toast from 'react-hot-toast';
import { ArrowLeft, GitMerge, Phone, Mail } from 'lucide-react';

export default function DuplicateMerge() {
  const navigate = useNavigate();
  const [duplicates, setDuplicates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyPair, setBusyPair] = useState(null);

  useEffect(() => { loadDuplicates(); }, []);

  const loadDuplicates = async () => {
    try {
      const res = await API.get('/automations/duplicates');
      setDuplicates(res.data.duplicates || []);
    } catch { toast.error('Failed to load duplicates'); }
    finally { setLoading(false); }
  };

  const handleMerge = async (leadAId, leadBId) => {
    setBusyPair(`${leadAId}:${leadBId}`);
    try {
      await API.post('/leads/merge', { primary_id: leadAId, secondary_id: leadBId });
      toast.success('Leads merged');
      loadDuplicates();
    } catch { toast.error('Merge failed'); }
    finally { setBusyPair(null); }
  };

  const handleDismiss = (pair) => {
    setDuplicates(duplicates.filter((d) => !(d.lead_a_id === pair.lead_a_id && d.lead_b_id === pair.lead_b_id)));
    toast.success('Dismissed');
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <button onClick={() => navigate('/app/automations')} className="btn-ghost text-sm font-medium flex items-center gap-1.5">
        <ArrowLeft size={14} /> Automations
      </button>

      <div>
        <h1 style={{ fontSize: '32px', fontWeight: 650, letterSpacing: '-0.01em' }}>Duplicate Merging</h1>
        <p className="text-ink-secondary mt-1" style={{ fontSize: '15px' }}>
          Leads that share a phone number or email. Merging keeps everything — history, files, activities.
        </p>
      </div>

      {loading ? (
        <div className="space-y-2">{[1, 2].map((i) => <div key={i} className="skeleton h-28" />)}</div>
      ) : duplicates.length === 0 ? (
        <div className="pt-16 max-w-[560px]">
          <p style={{ fontSize: '22px', fontWeight: 600 }}>Your leads are clean.</p>
          <p className="text-ink-secondary mt-2" style={{ fontSize: '15px' }}>No shared phones or emails — nothing to merge.</p>
        </div>
      ) : (
        <div className="space-y-6">
          <p className="meta-label">{duplicates.length} suspected pair{duplicates.length === 1 ? '' : 's'}</p>
          {duplicates.map((d, i) => (
            <div key={i} className="hairline-b pb-6">
              <div className="grid sm:grid-cols-[1fr_auto_1fr] gap-4 items-stretch">
                {[{ id: d.lead_a_id, name: d.lead_a_name, phone: d.lead_a_phone, email: d.lead_a_email, created: d.lead_a_created },
                  null,
                  { id: d.lead_b_id, name: d.lead_b_name, phone: d.lead_b_phone, email: d.lead_b_email, created: d.lead_b_created }].map((lead, idx) =>
                  lead === null ? (
                    <div key={idx} className="hidden sm:flex items-center justify-center">
                      <span className="mono text-ink-tertiary" style={{ fontSize: '12px' }}>same contact?</span>
                    </div>
                  ) : (
                    <div key={idx} className="hairline p-4 min-w-0">
                      <p className="font-semibold truncate" style={{ fontSize: '15px' }}>{lead.name || 'Unknown'}</p>
                      <div className="mt-2 space-y-1">
                        {lead.phone && (
                          <p className="text-ink-secondary flex items-center gap-2 truncate" style={{ fontSize: '13px' }}><Phone size={12} /> <span className="mono">{lead.phone}</span></p>
                        )}
                        {lead.email && (
                          <p className="text-ink-secondary flex items-center gap-2 truncate" style={{ fontSize: '13px' }}><Mail size={12} /> <span className="mono">{lead.email}</span></p>
                        )}
                      </div>
                      <p className="meta-label mt-3">added {new Date(lead.created).toLocaleDateString()}</p>
                    </div>
                  )
                )}
              </div>
              <div className="flex gap-3 mt-4">
                <button
                  onClick={() => handleMerge(d.lead_a_id, d.lead_b_id)}
                  disabled={busyPair === `${d.lead_a_id}:${d.lead_b_id}`}
                  className="btn btn-primary text-sm flex-1"
                >
                  <GitMerge size={15} /> {busyPair === `${d.lead_a_id}:${d.lead_b_id}` ? 'Merging…' : `Merge into "${d.lead_a_name || 'first lead'}"`}
                </button>
                <button onClick={() => handleDismiss(d)} className="btn btn-secondary text-sm">Not duplicates</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
