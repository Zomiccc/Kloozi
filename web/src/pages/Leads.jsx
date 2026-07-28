import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import API from '../lib/api';
import toast from 'react-hot-toast';
import {
  Plus, Search, Download, Upload, Phone, Mail, MessageSquare,
  ChevronLeft, ChevronRight, X, Users, Copy, LayoutGrid, List,
  Kanban, MoreVertical, MapPin, DollarSign
} from 'lucide-react';

const sourceColors = {
  facebook: { bg: '#0066FF15', text: '#0066FF' },
  google: { bg: '#FF3B5C15', text: '#FF3B5C' },
  tiktok: { bg: '#1D1D1F15', text: '#1D1D1F' },
  instagram: { bg: '#AF52DE15', text: '#AF52DE' },
  manual: { bg: '#8E8E9315', text: '#8E8E93' },
  website: { bg: '#34C75915', text: '#34C759' },
  zapier: { bg: '#FF950015', text: '#FF9500' },
};

const stageConfig = {
  new: { color: '#0066FF', bg: '#0066FF10' },
  contacted: { color: '#FF9500', bg: '#FF950010' },
  interested: { color: '#AF52DE', bg: '#AF52DE10' },
  negotiating: { color: '#FF3B5C', bg: '#FF3B5C10' },
  won: { color: '#34C759', bg: '#34C75910' },
  lost: { color: '#8E8E93', bg: '#8E8E9310' },
};

const stageOrder = ['new', 'contacted', 'interested', 'negotiating', 'won', 'lost'];

function initials(lead) {
  return `${(lead.first_name || '?')[0]}${(lead.last_name || '')[0] || ''}`.toUpperCase();
}

function ScoreRing({ score = 0 }) {
  const color = score > 70 ? '#34C759' : score >= 40 ? '#FF9500' : '#FF3B5C';
  const pct = Math.min(Math.max(score, 0), 100);
  return (
    <div className="relative w-8 h-8">
      <svg viewBox="0 0 36 36" className="w-8 h-8 -rotate-90">
        <circle cx="18" cy="18" r="15" fill="none" stroke="#E5E5EA" strokeWidth="3" />
        <circle cx="18" cy="18" r="15" fill="none" stroke={color} strokeWidth="3" strokeDasharray={`${pct * 0.94} 100`} strokeLinecap="round" />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-ink-primary">{score}</span>
    </div>
  );
}

export default function Leads() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ page: 1, total: 0, totalPages: 0 });
  const [filters, setFilters] = useState({ search: '', stage: '', source: '', sort: '' });
  const [showAdd, setShowAdd] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [selected, setSelected] = useState([]);
  const [showBulk, setShowBulk] = useState(false);
  const [tab, setTab] = useState('all');
  const [viewMode, setViewMode] = useState('kanban');

  useEffect(() => { loadLeads(); }, [pagination.page, filters, tab]);

  useEffect(() => {
    if (searchParams.get('import') === 'true') setShowImport(true);
    if (searchParams.get('export') === 'true') handleExport();
  }, [searchParams]);

  const loadLeads = async () => {
    setLoading(true);
    try {
      const params = { page: pagination.page, limit: 50, ...filters };
      if (tab === 'uncontacted') params.stage = 'new';
      if (tab === 'follow_ups') params.follow_up_due = 'true';
      if (tab === 'viewed_content') params.recently_viewed = 'true';
      const res = await API.get('/leads', { params });
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

  const copyPhone = (e, phone) => {
    e.stopPropagation();
    navigator.clipboard.writeText(phone);
    toast.success('Phone copied');
  };

  const kanbanLeads = stageOrder.map(stage => ({
    stage,
    items: leads.filter(l => (l.stage || 'new') === stage),
  }));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <h1 className="text-3xl font-extrabold text-ink-primary tracking-tight">Leads</h1>
          <span className="badge bg-surface-page text-ink-secondary border border-surface-border" style={{ padding: '4px 12px' }}>
            {(pagination.total ?? 0).toLocaleString()} total
          </span>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowImport(true)} className="btn btn-ghost"><Upload size={16} /> Import</button>
          <button onClick={handleExport} className="btn btn-ghost"><Download size={16} /> Export</button>
          <button onClick={() => setShowAdd(true)} className="btn btn-primary"><Plus size={16} /> Add Lead</button>
        </div>
      </div>

      {/* View Toggle + Tab Bar */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex gap-1 bg-white border border-surface-border rounded-full p-1">
          {[
            { key: 'all', label: 'All Leads' },
            { key: 'uncontacted', label: 'Uncontacted' },
            { key: 'follow_ups', label: 'Follow Ups' },
            { key: 'viewed_content', label: 'Recently Active' },
          ].map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`tab-pill ${tab === t.key ? 'tab-pill-active bg-accent-red' : 'text-ink-secondary hover:text-ink-primary'}`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="flex gap-1 bg-white border border-surface-border rounded-xl p-1">
          <button
            onClick={() => setViewMode('kanban')}
            className={`p-2 rounded-lg transition-all ${viewMode === 'kanban' ? 'bg-accent-red text-white' : 'text-ink-tertiary hover:text-ink-primary'}`}
          >
            <Kanban size={18} />
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`p-2 rounded-lg transition-all ${viewMode === 'list' ? 'bg-accent-red text-white' : 'text-ink-tertiary hover:text-ink-primary'}`}
          >
            <List size={18} />
          </button>
        </div>
      </div>

      {/* Search & Filter bar */}
      <div className="flex gap-3 items-center flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-ink-tertiary" />
          <input
            value={filters.search}
            onChange={(e) => setFilters({ ...filters, search: e.target.value })}
            className="input pl-11"
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

      {/* Content */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => <div key={i} className="skeleton h-16" />)}
        </div>
      ) : leads.length === 0 ? (
        <div className="card text-center" style={{ padding: '64px 24px' }}>
          <div className="w-20 h-20 rounded-3xl bg-surface-page flex items-center justify-center mx-auto mb-6">
            <Users size={36} className="text-ink-tertiary" />
          </div>
          <p className="text-xl font-bold text-ink-primary">No leads yet</p>
          <p className="text-sm text-ink-secondary mt-2 max-w-md mx-auto">
            New leads from Facebook, Google, and your website will appear here, alongside contacts you add or import manually.
          </p>
          <div className="flex justify-center gap-2 mt-6">
            <button onClick={() => setShowImport(true)} className="btn btn-ghost">Import CSV</button>
            <button onClick={() => navigate('/app/automations')} className="btn btn-primary">Connect Lead Source</button>
          </div>
        </div>
      ) : viewMode === 'kanban' ? (
        <KanbanBoard kanbanLeads={kanbanLeads} onLeadClick={(id) => navigate(`/app/leads/${id}`)} onCopyPhone={copyPhone} />
      ) : (
        <div className="card overflow-hidden" style={{ padding: 0 }}>
          <table className="w-full">
            <thead className="bg-surface-page border-b border-surface-border">
              <tr>
                <th className="p-3 text-left"><input type="checkbox" onChange={(e) => setSelected(e.target.checked ? leads.map(l => l.id) : [])} checked={selected.length === leads.length && leads.length > 0} /></th>
                <th className="p-3 text-left text-xs font-bold text-ink-tertiary uppercase tracking-wider">Lead</th>
                <th className="p-3 text-left text-xs font-bold text-ink-tertiary uppercase tracking-wider">Contact</th>
                <th className="p-3 text-left text-xs font-bold text-ink-tertiary uppercase tracking-wider">Source</th>
                <th className="p-3 text-left text-xs font-bold text-ink-tertiary uppercase tracking-wider">Stage</th>
                <th className="p-3 text-left text-xs font-bold text-ink-tertiary uppercase tracking-wider">Score</th>
                <th className="p-3 text-left text-xs font-bold text-ink-tertiary uppercase tracking-wider">Last Activity</th>
                <th className="p-3 text-left text-xs font-bold text-ink-tertiary uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-border">
              {leads.map((lead, idx) => (
                <tr key={lead.id || idx} className="group hover:bg-surface-page cursor-pointer transition-colors" onClick={() => navigate(`/app/leads/${lead.id}`)}>
                  <td className="p-3" onClick={(e) => e.stopPropagation()}>
                    <input type="checkbox" checked={selected.includes(lead.id)} onChange={(e) => setSelected(e.target.checked ? [...selected, lead.id] : selected.filter(id => id !== lead.id))} />
                  </td>
                  <td className="p-3">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0" style={{ background: 'linear-gradient(135deg, #0066FF, #AF52DE)' }}>
                        {initials(lead)}
                      </div>
                      <div>
                        <div className="font-bold text-sm text-ink-primary flex items-center gap-2">
                          {lead.first_name} {lead.last_name}
                          {lead.stage === 'new' && <span className="badge text-[10px] text-white" style={{ background: '#0066FF', padding: '2px 6px' }}>NEW</span>}
                        </div>
                        <div className="text-xs text-ink-tertiary">{lead.email || '—'}</div>
                      </div>
                    </div>
                  </td>
                  <td className="p-3 text-sm text-ink-secondary" onClick={(e) => e.stopPropagation()}>
                    {lead.phone ? (
                      <button onClick={(e) => copyPhone(e, lead.phone)} className="flex items-center gap-1.5 hover:text-ink-primary font-medium">
                        {lead.phone} <Copy size={12} className="text-ink-tertiary" />
                      </button>
                    ) : '—'}
                  </td>
                  <td className="p-3">
                    <span className="badge capitalize" style={{ background: (sourceColors[lead.lead_source] || sourceColors.manual).bg, color: (sourceColors[lead.lead_source] || sourceColors.manual).text }}>
                      {lead.lead_source}
                    </span>
                  </td>
                  <td className="p-3">
                    <span className="badge capitalize" style={{ background: (stageConfig[lead.stage] || stageConfig.new).bg, color: (stageConfig[lead.stage] || stageConfig.new).color }}>
                      {lead.stage}
                    </span>
                  </td>
                  <td className="p-3"><ScoreRing score={lead.score || 0} /></td>
                  <td className="p-3 text-sm text-ink-secondary">{lead.last_activity ? new Date(lead.last_activity).toLocaleDateString() : '—'}</td>
                  <td className="p-3" onClick={(e) => e.stopPropagation()}>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      {lead.phone && <a href={`tel:${lead.phone}`} className="p-2 rounded-lg hover:bg-accent-green/10 text-accent-green"><Phone size={14} /></a>}
                      {lead.phone && <a href={`https://wa.me/${lead.phone.replace(/\D/g, '')}`} target="_blank" rel="noreferrer" className="p-2 rounded-lg hover:bg-accent-green/10 text-accent-green"><MessageSquare size={14} /></a>}
                      {lead.email && <a href={`mailto:${lead.email}`} className="p-2 rounded-lg hover:bg-accent-blue/10 text-accent-blue"><Mail size={14} /></a>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {pagination.totalPages > 1 && (
            <div className="flex items-center justify-between p-4 border-t border-surface-border">
              <span className="text-sm font-semibold text-ink-secondary">{pagination.total} leads total</span>
              <div className="flex gap-2">
                <button disabled={pagination.page === 1} onClick={() => setPagination({ ...pagination, page: pagination.page - 1 })} className="btn btn-ghost p-2"><ChevronLeft size={16} /></button>
                <span className="px-4 py-2 text-sm font-semibold text-ink-primary">{pagination.page} / {pagination.totalPages}</span>
                <button disabled={pagination.page === pagination.totalPages} onClick={() => setPagination({ ...pagination, page: pagination.page + 1 })} className="btn btn-ghost p-2"><ChevronRight size={16} /></button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Floating bulk action bar */}
      {selected.length > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-white border border-surface-border rounded-2xl shadow-modal px-5 py-3 flex items-center gap-4 animate-slide-up">
          <span className="text-sm font-bold text-ink-primary">{selected.length} leads selected</span>
          <button onClick={() => setShowBulk(true)} className="btn btn-primary text-sm" style={{ minHeight: '36px' }}>Bulk Actions</button>
          <button onClick={() => setSelected([])} className="text-ink-tertiary hover:text-ink-primary"><X size={16} /></button>
        </div>
      )}

      {showAdd && <AddLeadModal onClose={() => setShowAdd(false)} onSubmit={handleAdd} />}
      {showImport && <ImportModal onClose={() => setShowImport(false)} onSubmit={handleImport} />}
      {showBulk && <BulkActionsModal selected={selected.length} onClose={() => setShowBulk(false)} onAction={handleBulkAction} />}
    </div>
  );
}

function KanbanBoard({ kanbanLeads, onLeadClick, onCopyPhone }) {
  return (
    <div className="overflow-x-auto pb-4">
      <div className="flex gap-4 min-w-max">
        {kanbanLeads.map((col) => {
          const cfg = stageConfig[col.stage] || stageConfig.new;
          return (
            <div key={col.stage} className="w-72 flex-shrink-0">
              <div className="flex items-center justify-between mb-3 px-1">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ background: cfg.color }} />
                  <span className="text-sm font-bold text-ink-primary capitalize">{col.stage}</span>
                  <span className="text-xs font-bold text-ink-tertiary bg-surface-page rounded-full px-2 py-0.5">{col.items.length}</span>
                </div>
              </div>
              <div className="space-y-2.5 min-h-[100px]">
                {col.items.map((lead, idx) => (
                  <div
                    key={lead.id || idx}
                    onClick={() => onLeadClick(lead.id)}
                    className="bg-white border border-surface-border rounded-2xl p-4 cursor-pointer transition-all duration-200 hover:shadow-card-hover hover:-translate-y-px animate-slide-up"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0" style={{ background: 'linear-gradient(135deg, #0066FF, #AF52DE)' }}>
                          {initials(lead)}
                        </div>
                        <div className="min-w-0">
                          <p className="font-bold text-sm text-ink-primary truncate">{lead.first_name} {lead.last_name}</p>
                          <p className="text-xs text-ink-tertiary truncate">{lead.email || lead.phone || '—'}</p>
                        </div>
                      </div>
                      <ScoreRing score={lead.score || 0} />
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="badge capitalize text-[10px]" style={{ background: (sourceColors[lead.lead_source] || sourceColors.manual).bg, color: (sourceColors[lead.lead_source] || sourceColors.manual).text }}>
                        {lead.lead_source}
                      </span>
                      {lead.city && (
                        <span className="flex items-center gap-1 text-[10px] font-semibold text-ink-tertiary">
                          <MapPin size={10} /> {lead.city}
                        </span>
                      )}
                      {lead.budget > 0 && (
                        <span className="flex items-center gap-1 text-[10px] font-semibold text-ink-tertiary">
                          <DollarSign size={10} /> {Number(lead.budget).toLocaleString()}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
                {col.items.length === 0 && (
                  <div className="rounded-2xl border-2 border-dashed border-surface-border p-6 text-center">
                    <p className="text-xs text-ink-tertiary">No leads</p>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function AddLeadModal({ onClose, onSubmit }) {
  const [form, setForm] = useState({ first_name: '', last_name: '', phone: '', email: '', city: '', budget: '', lead_source: 'manual', notes: '' });
  return (
    <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white border border-surface-border rounded-3xl shadow-modal p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto animate-slide-up">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-ink-primary">Add New Lead</h2>
          <button onClick={onClose} className="text-ink-tertiary hover:text-ink-primary transition-colors"><X size={20} /></button>
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
          <div className="flex gap-3">
            <button type="button" onClick={onClose} className="btn btn-ghost flex-1">Cancel</button>
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

  const downloadTemplate = () => {
    const csv = 'first_name,last_name,phone,email,city,budget,lead_source,notes\nJohn,Doe,+1234567890,john@example.com,New York,500000,manual,Interested in 2BHK\n';
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'zomic_leads_template.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  const leadFields = ['first_name', 'last_name', 'phone', 'email', 'city', 'budget', 'lead_source', 'notes'];

  return (
    <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white border border-surface-border rounded-3xl shadow-modal p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto animate-slide-up">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-ink-primary">Import Leads from CSV</h2>
          <button onClick={onClose} className="text-ink-tertiary hover:text-ink-primary transition-colors"><X size={20} /></button>
        </div>
        <div className="space-y-4">
          <div className="bg-surface-page rounded-2xl p-4 border border-surface-border">
            <p className="text-sm font-bold text-ink-primary">Instructions:</p>
            <ul className="text-xs text-ink-secondary mt-1 space-y-1">
              <li>1. Download the CSV template (optional)</li>
              <li>2. Fill in your lead data following the template format</li>
              <li>3. Upload the CSV file below</li>
              <li>4. Map your columns to CRM fields</li>
              <li>5. Click Import — duplicates are auto-skipped</li>
            </ul>
            <button onClick={downloadTemplate} className="text-xs text-accent-blue font-bold mt-2 hover:underline flex items-center gap-1"><Download size={12} /> Download CSV Template</button>
          </div>
          <input type="file" accept=".csv" onChange={handleFile} className="input" />
          {headers.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-bold text-ink-primary">Map CSV columns to lead fields:</p>
              {headers.map((h, idx) => (
                <div key={h || idx} className="flex items-center gap-3">
                  <span className="text-sm text-ink-secondary w-32 truncate font-semibold">{h}</span>
                  <select className="input flex-1" value={mapping[h] || ''} onChange={(e) => setMapping({ ...mapping, [h]: e.target.value })}>
                    <option value="">-- Skip --</option>
                    {leadFields.map(f => <option key={f} value={f}>{f}</option>)}
                  </select>
                </div>
              ))}
            </div>
          )}
          <div className="flex gap-3">
            <button onClick={onClose} className="btn btn-ghost flex-1">Cancel</button>
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
    <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white border border-surface-border rounded-3xl shadow-modal p-6 w-full max-w-md animate-slide-up">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-ink-primary">Bulk Actions ({selected} leads)</h2>
          <button onClick={onClose} className="text-ink-tertiary hover:text-ink-primary transition-colors"><X size={20} /></button>
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

