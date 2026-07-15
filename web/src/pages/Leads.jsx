import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import API from '../lib/api';
import toast from 'react-hot-toast';
import {
  Plus, Search, Filter, Download, Upload, Trash2, Phone, Mail, MessageSquare,
  ChevronLeft, ChevronRight, Tag, X
} from 'lucide-react';

export default function Leads() {
  const navigate = useNavigate();
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ page: 1, total: 0, totalPages: 0 });
  const [filters, setFilters] = useState({ search: '', stage: '', source: '', sort: '' });
  const [showFilters, setShowFilters] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [selected, setSelected] = useState([]);
  const [showBulk, setShowBulk] = useState(false);

  useEffect(() => { loadLeads(); }, [pagination.page, filters]);

  const loadLeads = async () => {
    setLoading(true);
    try {
      const res = await API.get('/leads', { params: { page: pagination.page, limit: 50, ...filters } });
      setLeads(res.data.leads);
      setPagination({ page: res.data.pagination.page, total: res.data.pagination.total, totalPages: res.data.pagination.totalPages });
    } catch (err) {
      toast.error('Failed to load leads');
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = async (formData) => {
    try {
      await API.post('/leads', formData);
      toast.success('Lead created');
      setShowAdd(false);
      loadLeads();
    } catch (err) {
      if (err.response?.status === 409) {
        toast.error('Duplicate lead found: ' + err.response.data.duplicate?.first_name);
      } else {
        toast.error(err.response?.data?.error || 'Failed to create lead');
      }
    }
  };

  const handleExport = async () => {
    try {
      const res = await API.post('/leads/export', { fields: ['first_name', 'last_name', 'phone', 'email', 'city', 'budget', 'lead_source', 'stage', 'created_at'] }, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a');
      a.href = url; a.download = 'leads_export.csv'; a.click();
      window.URL.revokeObjectURL(url);
      toast.success('Export downloaded');
    } catch (err) { toast.error('Export failed'); }
  };

  const handleBulkAction = async (action, value) => {
    try {
      await API.post('/leads/bulk', { lead_ids: selected, action, value });
      toast.success(`Bulk ${action} completed`);
      setSelected([]); setShowBulk(false); loadLeads();
    } catch (err) { toast.error(err.response?.data?.error || 'Bulk action failed'); }
  };

  const handleImport = async (csvData, mapping) => {
    try {
      const res = await API.post('/leads/import', { csv_data: csvData, field_mapping: mapping });
      toast.success(`Imported ${res.data.successCount} leads${res.data.failedCount > 0 ? `, ${res.data.failedCount} failed` : ''}`);
      setShowImport(false); loadLeads();
    } catch (err) { toast.error('Import failed'); }
  };

  const stageColors = { new: 'bg-blue-100 text-blue-700', contacted: 'bg-purple-100 text-purple-700', interested: 'bg-amber-100 text-amber-700', negotiating: 'bg-orange-100 text-orange-700', won: 'bg-green-100 text-green-700', lost: 'bg-red-100 text-red-700' };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <h1 className="text-2xl font-bold text-dark-900">Leads</h1>
        <div className="flex gap-2">
          <button onClick={() => setShowImport(true)} className="btn btn-secondary flex items-center gap-2"><Upload size={16} /> Import</button>
          <button onClick={handleExport} className="btn btn-secondary flex items-center gap-2"><Download size={16} /> Export</button>
          <button onClick={() => setShowAdd(true)} className="btn btn-primary flex items-center gap-2"><Plus size={16} /> Add Lead</button>
        </div>
      </div>

      {/* Search & Filter bar */}
      <div className="flex gap-2 items-center">
        <div className="relative flex-1">
          <Search size={18} className="absolute left-3 top-2.5 text-dark-400" />
          <input
            value={filters.search}
            onChange={(e) => setFilters({ ...filters, search: e.target.value })}
            className="input pl-10"
            placeholder="Search by name, phone, email, city..."
          />
        </div>
        <select value={filters.stage} onChange={(e) => setFilters({ ...filters, stage: e.target.value })} className="input w-auto">
          <option value="">All Stages</option>
          <option value="new">New</option><option value="contacted">Contacted</option>
          <option value="interested">Interested</option><option value="negotiating">Negotiating</option>
          <option value="won">Won</option><option value="lost">Lost</option>
        </select>
        <select value={filters.sort} onChange={(e) => setFilters({ ...filters, sort: e.target.value })} className="input w-auto">
          <option value="">Newest First</option>
          <option value="oldest">Oldest First</option>
          <option value="last_activity">Last Activity</option>
          <option value="follow_up">Follow-up Date</option>
          <option value="budget_high">Budget: High to Low</option>
          <option value="score">Score</option>
        </select>
      </div>

      {/* Bulk actions bar */}
      {selected.length > 0 && (
        <div className="bg-primary-50 border border-primary-200 rounded-lg p-3 flex items-center gap-3">
          <span className="text-sm font-medium text-primary-700">{selected.length} selected</span>
          <button onClick={() => setShowBulk(true)} className="btn btn-secondary text-sm py-1">Bulk Actions</button>
          <button onClick={() => setSelected([])} className="text-dark-400 hover:text-dark-600"><X size={16} /></button>
        </div>
      )}

      {/* Leads table */}
      <div className="bg-white rounded-xl shadow-sm border border-dark-100 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-64"><div className="animate-spin w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full" /></div>
        ) : leads.length === 0 ? (
          <div className="text-center py-16 text-dark-400">
            <p className="text-lg">No leads found</p>
            <p className="text-sm mt-1">Add a lead or adjust your filters</p>
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-dark-50 border-b border-dark-100">
              <tr>
                <th className="p-3 text-left"><input type="checkbox" onChange={(e) => setSelected(e.target.checked ? leads.map(l => l.id) : [])} checked={selected.length === leads.length && leads.length > 0} /></th>
                <th className="p-3 text-left text-xs font-medium text-dark-500 uppercase">Name</th>
                <th className="p-3 text-left text-xs font-medium text-dark-500 uppercase">Phone</th>
                <th className="p-3 text-left text-xs font-medium text-dark-500 uppercase">Stage</th>
                <th className="p-3 text-left text-xs font-medium text-dark-500 uppercase">Source</th>
                <th className="p-3 text-left text-xs font-medium text-dark-500 uppercase">Budget</th>
                <th className="p-3 text-left text-xs font-medium text-dark-500 uppercase">Score</th>
                <th className="p-3 text-left text-xs font-medium text-dark-500 uppercase">Agent</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-dark-50">
              {leads.map((lead) => (
                <tr key={lead.id} className="hover:bg-dark-50 cursor-pointer" onClick={() => navigate(`/leads/${lead.id}`)}>
                  <td className="p-3" onClick={(e) => e.stopPropagation()}>
                    <input type="checkbox" checked={selected.includes(lead.id)} onChange={(e) => setSelected(e.target.checked ? [...selected, lead.id] : selected.filter(id => id !== lead.id))} />
                  </td>
                  <td className="p-3"><div className="font-medium text-dark-900">{lead.first_name} {lead.last_name}</div><div className="text-xs text-dark-400">{lead.city}</div></td>
                  <td className="p-3 text-sm text-dark-600">{lead.phone || '-'}</td>
                  <td className="p-3"><span className={`badge ${stageColors[lead.stage] || 'bg-dark-100 text-dark-600'}`}>{lead.stage}</span></td>
                  <td className="p-3 text-sm text-dark-600 capitalize">{lead.lead_source}</td>
                  <td className="p-3 text-sm text-dark-600">{lead.budget ? `$${parseInt(lead.budget).toLocaleString()}` : '-'}</td>
                  <td className="p-3"><span className={`badge ${lead.score >= 70 ? 'bg-green-100 text-green-700' : lead.score >= 40 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>{lead.score}</span></td>
                  <td className="p-3 text-sm text-dark-600">{lead.agent_first_name ? `${lead.agent_first_name} ${lead.agent_last_name}` : 'Unassigned'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div className="flex items-center justify-between p-4 border-t border-dark-100">
            <span className="text-sm text-dark-400">{pagination.total} leads total</span>
            <div className="flex gap-2">
              <button disabled={pagination.page === 1} onClick={() => setPagination({ ...pagination, page: pagination.page - 1 })} className="btn btn-secondary p-2"><ChevronLeft size={16} /></button>
              <span className="px-4 py-2 text-sm">{pagination.page} / {pagination.totalPages}</span>
              <button disabled={pagination.page === pagination.totalPages} onClick={() => setPagination({ ...pagination, page: pagination.page + 1 })} className="btn btn-secondary p-2"><ChevronRight size={16} /></button>
            </div>
          </div>
        )}
      </div>

      {showAdd && <AddLeadModal onClose={() => setShowAdd(false)} onSubmit={handleAdd} />}
      {showImport && <ImportModal onClose={() => setShowImport(false)} onSubmit={handleImport} />}
      {showBulk && <BulkActionsModal selected={selected.length} onClose={() => setShowBulk(false)} onAction={handleBulkAction} />}
    </div>
  );
}

function AddLeadModal({ onClose, onSubmit }) {
  const [form, setForm] = useState({ first_name: '', last_name: '', phone: '', email: '', city: '', budget: '', lead_source: 'manual', notes: '' });
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold">Add New Lead</h2>
          <button onClick={onClose}><X size={20} /></button>
        </div>
        <form onSubmit={(e) => { e.preventDefault(); onSubmit(form); }} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <input className="input" placeholder="First Name *" value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} required />
            <input className="input" placeholder="Last Name" value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <input className="input" placeholder="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            <input className="input" placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <input className="input" placeholder="City" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
            <input type="number" className="input" placeholder="Budget" value={form.budget} onChange={(e) => setForm({ ...form, budget: e.target.value })} />
          </div>
          <select className="input" value={form.lead_source} onChange={(e) => setForm({ ...form, lead_source: e.target.value })}>
            <option value="manual">Manual</option><option value="facebook">Facebook</option>
            <option value="google">Google</option><option value="website">Website</option>
            <option value="tiktok">TikTok</option><option value="instagram">Instagram</option>
            <option value="zapier">Zapier</option>
          </select>
          <textarea className="input" rows="3" placeholder="Notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="btn btn-secondary flex-1">Cancel</button>
            <button type="submit" className="btn btn-primary flex-1">Create Lead</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ImportModal({ onClose, onSubmit }) {
  const [csvText, setCsvText] = useState('');
  const [mapping, setMapping] = useState({});
  const [headers, setHeaders] = useState([]);

  const handleFile = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target.result;
      setCsvText(text);
      const lines = text.split('\n');
      if (lines.length > 0) {
        const hdrs = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
        setHeaders(hdrs);
        const autoMap = {};
        hdrs.forEach(h => {
          const lower = h.toLowerCase();
          if (lower.includes('first')) autoMap[h] = 'first_name';
          else if (lower.includes('last')) autoMap[h] = 'last_name';
          else if (lower.includes('phone') || lower.includes('mobile')) autoMap[h] = 'phone';
          else if (lower.includes('email')) autoMap[h] = 'email';
          else if (lower.includes('city')) autoMap[h] = 'city';
          else if (lower.includes('budget') || lower.includes('price')) autoMap[h] = 'budget';
          else if (lower.includes('source')) autoMap[h] = 'lead_source';
          else if (lower.includes('note')) autoMap[h] = 'notes';
        });
        setMapping(autoMap);
      }
    };
    reader.readAsText(file);
  };

  const leadFields = ['first_name', 'last_name', 'phone', 'email', 'city', 'budget', 'lead_source', 'notes'];

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold">Import Leads from CSV</h2>
          <button onClick={onClose}><X size={20} /></button>
        </div>
        <div className="space-y-4">
          <input type="file" accept=".csv" onChange={handleFile} className="input" />
          {headers.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium text-dark-700">Map CSV columns to lead fields:</p>
              {headers.map(h => (
                <div key={h} className="flex items-center gap-3">
                  <span className="text-sm text-dark-600 w-32 truncate">{h}</span>
                  <select className="input flex-1" value={mapping[h] || ''} onChange={(e) => setMapping({ ...mapping, [h]: e.target.value })}>
                    <option value="">-- Skip --</option>
                    {leadFields.map(f => <option key={f} value={f}>{f}</option>)}
                  </select>
                </div>
              ))}
            </div>
          )}
          <div className="flex gap-2">
            <button onClick={onClose} className="btn btn-secondary flex-1">Cancel</button>
            <button disabled={!csvText} onClick={() => onSubmit(csvText, mapping)} className="btn btn-primary flex-1">Import</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function BulkActionsModal({ selected, onClose, onAction }) {
  const [action, setAction] = useState('add_tag');
  const [value, setValue] = useState('');
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl p-6 w-full max-w-md">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold">Bulk Actions ({selected} leads)</h2>
          <button onClick={onClose}><X size={20} /></button>
        </div>
        <div className="space-y-3">
          <select className="input" value={action} onChange={(e) => setAction(e.target.value)}>
            <option value="add_tag">Add Tag</option>
            <option value="change_stage">Change Stage</option>
            <option value="assign">Assign to Agent</option>
            <option value="delete">Delete Leads</option>
          </select>
          {(action === 'add_tag' || action === 'change_stage') && (
            <input className="input" placeholder={action === 'add_tag' ? 'Tag name' : 'Stage name'} value={value} onChange={(e) => setValue(e.target.value)} />
          )}
          {action === 'assign' && (
            <input className="input" placeholder="Agent user ID" value={value} onChange={(e) => setValue(e.target.value)} />
          )}
          <button onClick={() => onAction(action, value)} className="btn btn-primary w-full">Apply to {selected} leads</button>
        </div>
      </div>
    </div>
  );
}
