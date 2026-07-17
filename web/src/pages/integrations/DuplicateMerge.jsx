import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import API from '../../lib/api';
import toast from 'react-hot-toast';
import { ArrowLeft, GitBranch, Users, Phone, Mail, ArrowRight, CheckCircle2 } from 'lucide-react';

export default function DuplicateMerge() {
  const navigate = useNavigate();
  const [duplicates, setDuplicates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [merging, setMerging] = useState(null);

  useEffect(() => { loadDuplicates(); }, []);

  const loadDuplicates = async () => {
    try { const res = await API.get('/automations/duplicates'); setDuplicates(res.data.duplicates || []); } catch { toast.error('Failed'); } finally { setLoading(false); }
  };

  const handleMerge = async (leadAId, leadBId) => {
    try { await API.post('/leads/merge', { source_lead_id: leadBId, target_lead_id: leadAId, merge_strategy: 'keep_both' }); toast.success('Leads merged'); setMerging(null); loadDuplicates(); } catch { toast.error('Merge failed'); }
  };

  const handleDismiss = (pair) => {
    setDuplicates(duplicates.filter(d => !(d.lead_a_id === pair.lead_a_id && d.lead_b_id === pair.lead_b_id)));
    toast.success('Dismissed');
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <button onClick={() => navigate('/automations')} className="flex items-center gap-2 text-sm text-dark-400 hover:text-dark-600"><ArrowLeft size={16} /> Back to Automations</button>

      <div className="flex items-center gap-3">
        <div className="w-12 h-12 bg-primary-100 rounded-xl flex items-center justify-center"><GitBranch size={24} className="text-primary-600" /></div>
        <div><h2 className="text-xl font-bold text-dark-900">Duplicate Lead Merging</h2><p className="text-sm text-dark-400">Auto merge leads with same phone/email</p></div>
      </div>

      {loading ? <div className="flex justify-center py-8"><div className="animate-spin w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full" /></div> :
       duplicates.length === 0 ? (
        <div className="card text-center py-12"><CheckCircle2 size={48} className="text-green-500 mx-auto mb-3" /><p className="text-dark-600 font-medium">No duplicates found!</p><p className="text-sm text-dark-400">Your leads are clean.</p></div>
       ) : (
        <div className="space-y-4">
          <p className="text-sm text-dark-600">{duplicates.length} duplicate pair(s) detected</p>
          {duplicates.map((d, i) => (
            <div key={i} className="card">
              <div className="grid grid-cols-2 gap-4">
                {[{ id: d.lead_a_id, name: d.lead_a_name, phone: d.lead_a_phone, email: d.lead_a_email, created: d.lead_a_created }, { id: d.lead_b_id, name: d.lead_b_name, phone: d.lead_b_phone, email: d.lead_b_email, created: d.lead_b_created }].map((lead, idx) => (
                  <div key={idx} className="border border-dark-100 rounded-lg p-4">
                    <p className="font-medium text-dark-900">{lead.name || 'Unknown'}</p>
                    <p className="text-xs text-dark-400 mt-1">{lead.phone || 'No phone'}</p>
                    <p className="text-xs text-dark-400">{lead.email || 'No email'}</p>
                    <p className="text-xs text-dark-400 mt-1">Added: {new Date(lead.created).toLocaleDateString()}</p>
                  </div>
                ))}
              </div>
              <div className="flex gap-2 mt-4">
                <button onClick={() => handleMerge(d.lead_a_id, d.lead_b_id)} className="btn btn-primary flex-1 flex items-center justify-center gap-2"><GitBranch size={16} /> Merge</button>
                <button onClick={() => handleDismiss(d)} className="btn btn-secondary">Dismiss</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
