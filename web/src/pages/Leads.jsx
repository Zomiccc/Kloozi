import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import API from '../lib/api';
import toast from 'react-hot-toast';
import useCreateRegistry from '../stores/createStore';
import { CountUp, celebrateWin, Modal, EASE_SOFT, SPRING_DROP } from '../lib/motion';
import { initialsOf } from '../lib/avatar';
import { useAutomationOptions, memberLabel } from '../lib/automationOptions';
import {
  Avatar, Badge, StageBadge, StatCard, Segmented, FilterPill, ChipGroup,
  SignalChip, EmptyState, SkeletonRows, stageTone, TOKENS,
  leadHeat, HeatDot, formatWait, useNow, StatusCell, ContactButtons, Clay,
} from '../components/ui';
import { UpdateRequestedPill } from '../components/UpdateRequest';
import {
  Download, Phone, Mail, MessageSquare, ChevronLeft, ChevronRight,
  X, Copy, GripHorizontal, Users, Upload, Plus, Search,
} from 'lucide-react';

/* ═══════════════════════════════════════════════════════════════
   SECTION 8 — THE LEAD LIST, THE SIGNATURE PAGE

   Default view is the rounded white row-card list with 8px gaps.
   A three-card hero stat strip sits above it, the first card
   carrying the one gradient the system permits. Creation lives
   only in the top-bar "+"; filters live only behind a pill.
   ═══════════════════════════════════════════════════════════════ */

const STAGE_ORDER = ['new', 'contacted', 'interested', 'negotiating', 'won', 'lost'];

const SOURCE_OPTIONS = ['facebook', 'google_ads', 'tiktok', 'linkedin', 'website', 'lead_form', 'whatsapp', 'wordpress', 'zapier', 'import', 'manual'];

const GROUP_COLOR = { new: '#3B8BF6', contacted: '#22B8CF', interested: '#F5A524', negotiating: '#8E7CF0', won: '#17B26A', lost: '#98A2B3' };

/* Click the coloured status to change it — like a work board. */
function StagePicker({ value, onPick }) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return undefined;
    const close = () => setOpen(false);
    window.addEventListener('click', close);
    return () => window.removeEventListener('click', close);
  }, [open]);
  return (
    <div className="relative" onClick={(e) => e.stopPropagation()}>
      <StatusCell stage={value} onClick={() => setOpen(!open)} title="Change status" />
      {open && (
        <div className="absolute z-30 popover popover-flush" style={{ top: 36, left: 0, width: 170 }}>
          {STAGE_ORDER.map((s) => (
            <button key={s} onClick={() => { setOpen(false); onPick(s); }} className="w-full flex items-center" style={{ padding: 4 }}>
              <StatusCell stage={s} style={{ width: '100%', outline: s === value ? '2px solid var(--ink)' : 'none', outlineOffset: 1 }} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

const SORT_OPTIONS = [
  { value: '', label: 'Newest' },
  { value: 'oldest', label: 'Oldest' },
  { value: 'last_activity', label: 'Activity' },
  { value: 'follow_up', label: 'Follow-up' },
  { value: 'budget_high', label: 'Budget' },
  { value: 'score', label: 'Signal' },
];

function money(n) {
  return Number(n || 0).toLocaleString('en-AU', { maximumFractionDigits: 0 });
}

function relativeTime(value) {
  if (!value) return '—';
  const then = new Date(value).getTime();
  if (Number.isNaN(then)) return '—';
  const mins = Math.round((Date.now() - then) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(value).toLocaleDateString('en', { month: 'short', day: 'numeric' });
}

export default function Leads() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const register = useCreateRegistry((s) => s.register);
  const clearRegistry = useCreateRegistry((s) => s.clear);

  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ page: 1, total: 0, totalPages: 0 });
  const [filters, setFilters] = useState({ search: '', stage: searchParams.get('stage') || '', source: '', sort: '' });
  const [stats, setStats] = useState({ waiting: 0, newToday: 0, followUps: 0, wonThisWeek: 0 });
  const [showAdd, setShowAdd] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [showBulk, setShowBulk] = useState(false);
  const [selected, setSelected] = useState([]);
  const [tab, setTab] = useState(searchParams.get('tab') || 'all');
  const now = useNow(30000);
  const [viewMode, setViewMode] = useState(() => { try { return localStorage.getItem('flazyn:leads-view') || 'board'; } catch { return 'board'; } });
  useEffect(() => { try { localStorage.setItem('flazyn:leads-view', viewMode); } catch {} }, [viewMode]);

  /* Section 10: the ONE creation trigger is the top-bar "+". */
  useEffect(() => {
    register([
      { label: 'Add lead manually', run: () => setShowAdd(true) },
      { label: 'Import leads (CSV)', run: () => setShowImport(true) },
    ]);
    return () => clearRegistry();
  }, [register, clearRegistry]);

  useEffect(() => { loadLeads(); }, [pagination.page, filters, tab]);

  useEffect(() => {
    if (searchParams.get('import') === 'true') setShowImport(true);
    if (searchParams.get('new') === 'true') setShowAdd(true);
    if (searchParams.get('stage')) setFilters((f) => ({ ...f, stage: searchParams.get('stage') }));
    if (searchParams.get('tab')) setTab(searchParams.get('tab'));
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
      const rows = res.data.leads || [];
      setLeads(rows);
      setPagination({
        page: res.data.pagination.page,
        total: res.data.pagination.total,
        totalPages: res.data.pagination.totalPages,
      });
      computeStats(rows);
    } catch {
      toast.error('Failed to load leads');
    } finally {
      setLoading(false);
    }
  };

  /* The hero strip reads off the current page when the API gives no
     dedicated summary endpoint — cheap, and always consistent with
     what the user can actually see. */
  const computeStats = (rows) => {
    const dayAgo = Date.now() - 86400000;
    const weekAgo = Date.now() - 7 * 86400000;
    setStats({
      waiting: rows.filter((l) => (l.stage || 'new') === 'new').length,
      newToday: rows.filter((l) => new Date(l.created_at).getTime() > dayAgo).length,
      followUps: rows.filter((l) => l.follow_up_date && new Date(l.follow_up_date).getTime() <= Date.now()).length,
      wonThisWeek: rows.filter((l) => l.stage === 'won' && new Date(l.updated_at || l.created_at).getTime() > weekAgo).length,
    });
  };

  const handleExport = async () => {
    try {
      const res = await API.post(
        '/leads/export',
        { fields: ['first_name', 'last_name', 'phone', 'email', 'city', 'budget', 'lead_source', 'stage', 'created_at'] },
        { responseType: 'blob' }
      );
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a');
      a.href = url; a.download = 'leads_export.csv'; a.click();
      window.URL.revokeObjectURL(url);
      toast.success('Export downloaded');
    } catch { toast.error('Export failed'); }
  };

  const handleBulkAction = async (action, value) => {
    try {
      const res = await API.post('/leads/bulk', { lead_ids: selected, action, value });
      if (action === 'change_stage' && String(value).toLowerCase() === 'won') celebrateWin();
      toast.success(res.data?.message || `Bulk ${action.replace('_', ' ')} completed`);
      setSelected([]); setShowBulk(false); loadLeads();
    } catch (err) { toast.error(err.response?.data?.error || 'Bulk action failed'); }
  };

  const handleImport = async (csvData, mapping) => {
    try {
      const res = await API.post('/leads/import', { csv_data: csvData, field_mapping: mapping });
      toast.success(`Imported ${res.data.successCount} leads${res.data.failedCount > 0 ? `, ${res.data.failedCount} failed` : ''}`);
      setShowImport(false); loadLeads();
    } catch { toast.error('Import failed'); }
  };

  const moveLeadToStage = async (leadId, stage) => {
    const lead = leads.find((l) => l.id === leadId);
    if (!lead || (lead.stage || 'new') === stage) return;
    setLeads((prev) => prev.map((l) => (l.id === leadId ? { ...l, stage } : l)));
    try {
      await API.put(`/leads/${leadId}`, { stage });
      if (stage === 'won') celebrateWin();
      else toast.success(`${lead.first_name} moved to ${stage}`);
    } catch {
      setLeads((prev) => prev.map((l) => (l.id === leadId ? { ...l, stage: lead.stage } : l)));
      toast.error('Could not move lead');
    }
  };

  const copyPhone = (e, phone) => {
    e.stopPropagation();
    navigator.clipboard.writeText(phone);
    toast.success('Phone copied');
  };

  const kanbanLeads = STAGE_ORDER.map((stage) => ({
    stage,
    items: leads.filter((l) => (l.stage || 'new') === stage),
  }));

  const activeFilterCount = Object.entries(filters).filter(([, v]) => v).length;

  const tabs = [
    { key: 'all', label: 'All leads' },
    { key: 'uncontacted', label: 'Waiting for a reply' },
    { key: 'follow_ups', label: 'Follow-ups due' },
    { key: 'viewed_content', label: 'Interested lately' },
  ];

  return (
    <div>
      {/* ───── PAGE HEADER ───── */}
      <div className="flex flex-wrap items-center justify-between" style={{ gap: 16, marginBottom: 18 }}>
        <div className="flex items-center" style={{ gap: 14 }}>
                    <div>
            <h1 className="t-h1">Sales pipeline</h1>
            <p style={{ fontSize: 13.5, color: 'var(--ink-2)', marginTop: 2 }}>
              <b style={{ color: 'var(--ink)' }}><CountUp value={pagination.total ?? 0} /></b> {tab === 'all' ? 'in total' : 'in this view'}
              {stats.newToday > 0 && <> · <b style={{ color: 'var(--brand-deep)' }}>{stats.newToday}</b> new today</>}
              {stats.followUps > 0 && <> · <b style={{ color: '#8A5A00' }}>{stats.followUps}</b> follow-ups due</>}
            </p>
          </div>
        </div>
        <div className="flex items-center" style={{ gap: 10 }}>
          <button onClick={() => setShowImport(true)} className="btn btn-secondary"><Upload size={16} /> Import</button>
          <button onClick={() => setShowAdd(true)} className="btn btn-primary"><Plus size={17} strokeWidth={2.6} /> Add lead</button>
        </div>
      </div>

      {/* ───── NUMBERS ───── */}
      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 18 }}>
        <div className="stat-tile"><p className="label">Open pipeline</p><p className="value">${money(leads.filter((l) => !['won', 'lost'].includes(l.stage)).reduce((a, l) => a + (Number(l.budget) || 0), 0))}</p></div>
        <div className="stat-tile"><p className="label">Waiting for a first reply</p><p className="value">{leads.filter((l) => (l.stage || 'new') === 'new').length || '—'}</p></div>
        <div className="stat-tile"><p className="label">Won</p><p className="value">${money(leads.filter((l) => l.stage === 'won').reduce((a, l) => a + (Number(l.budget) || 0), 0))}</p></div>
      </div>

      {/* ───── VIEW TABS ───── */}
      <div className="flex items-end no-scrollbar overflow-x-auto" style={{ gap: 4, borderBottom: '1px solid var(--hairline)', marginBottom: 14 }}>
        {tabs.map((t) => {
          const on = tab === t.key;
          return (
            <button key={t.key} onClick={() => setTab(t.key)} className="relative flex items-center whitespace-nowrap"
              style={{ gap: 8, padding: '10px 14px', fontSize: 14, fontWeight: on ? 800 : 600, color: on ? 'var(--ink)' : 'var(--ink-2)' }}>
              {t.label}
              {on && <motion.span layoutId="lead-view-tab" className="absolute" style={{ left: 8, right: 8, bottom: -1, height: 3, borderRadius: 3, background: 'var(--brand)' }} />}
            </button>
          );
        })}
      </div>

      {/* ───── TOOLBAR ───── */}
      <div className="flex items-center flex-wrap" style={{ gap: 10, marginBottom: 14 }}>
        <div className="flex items-center" style={{ gap: 8, height: 38, padding: '0 12px', background: '#fff', border: '1.5px solid var(--hairline-strong)', borderRadius: 10, minWidth: 240, flex: '0 1 320px' }}>
          <Search size={16} style={{ color: 'var(--ink-3)' }} />
          <input value={filters.search} onChange={(e) => setFilters({ ...filters, search: e.target.value })} placeholder="Search name, phone or email"
            className="flex-1 outline-none" style={{ border: 'none', background: 'transparent', fontSize: 14, fontWeight: 600 }} />
          {filters.search && <button onClick={() => setFilters({ ...filters, search: '' })} className="row-action"><X size={15} /></button>}
        </div>

        <FilterPill activeCount={activeFilterCount - (filters.search ? 1 : 0)} align="left">
          <ChipGroup label="Stage" options={STAGE_ORDER.map((s) => ({ value: s, label: s }))} value={filters.stage} onChange={(v) => setFilters({ ...filters, stage: v })} />
          <ChipGroup label="Came from" options={SOURCE_OPTIONS.map((s) => ({ value: s, label: s.replace(/_/g, ' ') }))} value={filters.source} onChange={(v) => setFilters({ ...filters, source: v })} />
          <ChipGroup label="Sort by" options={SORT_OPTIONS} value={filters.sort} onChange={(v) => setFilters({ ...filters, sort: v })} />
          <div className="flex items-center justify-between" style={{ paddingTop: 8, borderTop: '1px solid var(--hairline)' }}>
            <button onClick={() => setFilters({ search: '', stage: '', source: '', sort: '' })} className="t-body-sm" style={{ color: 'var(--brand-deep)', fontWeight: 800 }}>Clear all</button>
          </div>
        </FilterPill>

        {filters.stage && (
          <button onClick={() => setFilters({ ...filters, stage: '' })} className="flex items-center" style={{ gap: 6 }} title="Remove stage filter">
            <StatusCell stage={filters.stage} style={{ minWidth: 0, height: 28 }} /> <X size={14} style={{ color: 'var(--ink-3)' }} />
          </button>
        )}

        <div className="flex-1" />
        <Segmented layoutId="leads-view" options={[{ key: 'board', label: 'Board' }, { key: 'list', label: 'Table' }]} value={viewMode} onChange={setViewMode} size="sm" />
      </div>

      {/* ───── CONTENT ───── */}
      {loading ? (
        <SkeletonRows count={7} height={56} />
      ) : leads.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={<Users size={26} />}
            title={tab === 'all' && !activeFilterCount ? 'No leads yet' : 'Nobody matches this view'}
            body={tab === 'all' && !activeFilterCount ? 'Connect Facebook, Google or your website in Automations and new leads appear here by themselves. Or add one by hand.' : 'Try another tab or clear your filters.'}
            action={
              <div className="flex items-center justify-center flex-wrap" style={{ gap: 12 }}>
                <button onClick={() => setShowAdd(true)} className="btn btn-primary">Add a lead</button>
                <button onClick={() => navigate('/app/automations')} className="btn btn-secondary">Connect a lead source</button>
              </div>
            }
          />
        </div>
      ) : viewMode === 'board' ? (
        <KanbanBoard kanbanLeads={kanbanLeads} onLeadClick={(id) => navigate(`/app/leads/${id}`)} onDropToStage={moveLeadToStage} />
      ) : (
        <>
          <div className="flex flex-col" style={{ gap: 18 }}>
            {STAGE_ORDER.map((stage) => ({ stage, rows: leads.filter((l) => (l.stage || 'new') === stage) }))
              .concat([{ stage: 'other', rows: leads.filter((l) => !STAGE_ORDER.includes(l.stage || 'new')) }])
              .filter((g) => g.rows.length)
              .map((group) => (
                <section key={group.stage}>
                  <div className="flex items-center" style={{ gap: 10, marginBottom: 8, paddingLeft: 4 }}>
                    <span className={`st-${group.stage}`} style={{ width: 12, height: 12, borderRadius: 4, background: group.stage === 'other' ? '#98A2B3' : undefined }} />
                    <h3 className="capitalize" style={{ fontSize: 15, fontWeight: 800, color: 'var(--ink)' }}>{group.stage === 'other' ? 'Other stages' : group.stage}</h3>
                    <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink-3)' }}>{group.rows.length}</span>
                  </div>
                  <div className={`row-list group-bar st-border-${group.stage}`} style={{ '--gb': GROUP_COLOR[group.stage] || '#98A2B3' }}>
                    <div className="hidden md:flex items-center" style={{ gap: 16, padding: '8px 18px', background: '#FAFAF9', borderBottom: '1px solid var(--hairline)', fontSize: 12, fontWeight: 700, color: 'var(--ink-3)' }}>
                      <span style={{ width: 17 }} />
                      <span style={{ flex: '1 1 220px' }}>Lead</span>
                      <span style={{ width: 130 }}>Status</span>
                      <span style={{ width: 70 }} className="hidden lg:block">Interest</span>
                      <span style={{ width: 110 }} className="hidden lg:block">Came from</span>
                      <span style={{ width: 130 }} className="hidden xl:block">Waiting / last touch</span>
                      <span style={{ width: 160 }} className="text-right">Contact</span>
                    </div>
                    {group.rows.map((lead) => {
                      const h = leadHeat(lead, now);
                      return (
                        <div key={lead.id} className="row-card group cursor-pointer" onClick={() => navigate(`/app/leads/${lead.id}`)}>
                          <input type="checkbox" className="flex-shrink-0" checked={selected.includes(lead.id)} onClick={(e) => e.stopPropagation()}
                            onChange={(e) => setSelected(e.target.checked ? [...selected, lead.id] : selected.filter((id) => id !== lead.id))} />
                          <div className="flex items-center min-w-0" style={{ gap: 12, flex: '1 1 220px' }}>
                            <Avatar first={lead.first_name} last={lead.last_name} size={38} radius={999} />
                            <div className="min-w-0">
                              <div className="flex items-center min-w-0" style={{ gap: 8 }}><span className="truncate" style={{ fontSize: 14.5, fontWeight: 800 }}>{`${lead.first_name || ''} ${lead.last_name || ''}`.trim() || 'Unnamed lead'}</span>{lead.update_requested && <UpdateRequestedPill />}</div>
                              {lead.phone ? (
                                <button onClick={(e) => copyPhone(e, lead.phone)} className="truncate flex items-center" style={{ gap: 5, fontSize: 13, color: 'var(--ink-2)', fontWeight: 600 }} title="Copy number">
                                  {lead.phone} <Copy size={11} className="row-action" />
                                </button>
                              ) : <span style={{ fontSize: 13, color: 'var(--ink-3)' }}>{lead.email || 'No phone'}</span>}
                            </div>
                          </div>
                          <div style={{ width: 130 }} className="flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                            <StagePicker value={lead.stage || 'new'} onPick={(s) => moveLeadToStage(lead.id, s)} />
                          </div>
                          <div style={{ width: 70 }} className="hidden lg:block flex-shrink-0"><SignalChip score={lead.score || 0} /></div>
                          <div style={{ width: 110, fontSize: 13, color: 'var(--ink-2)', fontWeight: 600 }} className="hidden lg:block capitalize truncate flex-shrink-0">
                            {(lead.lead_source || '—').replace(/_/g, ' ')}
                          </div>
                          <div style={{ width: 130 }} className="hidden xl:flex items-center flex-shrink-0">
                            {h.level === 'handled'
                              ? <span style={{ fontSize: 13, color: 'var(--ink-3)' }}>{relativeTime(lead.last_activity_at || lead.updated_at || lead.created_at)}</span>
                              : <span className="flex items-center" style={{ gap: 6, fontSize: 13, fontWeight: 700, color: h.level === 'cold' ? 'var(--ink-3)' : '#8A5A00' }}><HeatDot heat={h} /> {formatWait(h.mins)}</span>}
                          </div>
                          <div style={{ width: 160 }} className="flex justify-end flex-shrink-0 hidden sm:flex">
                            <ContactButtons compact phone={lead.phone} email={lead.email} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>
              ))}
          </div>

          {pagination.totalPages > 1 && (
            <div className="flex items-center justify-between" style={{ marginTop: 24 }}>
              <span className="t-body-sm" style={{ color: 'var(--ink-2)' }}>{pagination.total} leads total</span>
              <div className="flex items-center" style={{ gap: 12 }}>
                <button disabled={pagination.page === 1} onClick={() => setPagination({ ...pagination, page: pagination.page - 1 })} className="btn btn-secondary btn-sm"><ChevronLeft size={16} /> Back</button>
                <span style={{ fontWeight: 700 }}>Page {pagination.page} of {pagination.totalPages}</span>
                <button disabled={pagination.page === pagination.totalPages} onClick={() => setPagination({ ...pagination, page: pagination.page + 1 })} className="btn btn-secondary btn-sm">Next <ChevronRight size={16} /></button>
              </div>
            </div>
          )}
        </>
      )}

      {/* ───── FLOATING BULK BAR ───── */}
      <AnimatePresence>
        {selected.length > 0 && (
          <motion.div
            initial={{ y: 60, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 60, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 350, damping: 28 }}
            className="fixed z-40 flex items-center"
            style={{
              bottom: '24px', left: '50%', translateX: '-50%',
              gap: '16px', padding: '12px 12px 12px 24px',
              background: '#FFFFFF', borderRadius: '10px', boxShadow: TOKENS.shDropdown,
            }}
          >
            <span className="t-body" style={{ fontWeight: 700 }}>{selected.length} selected</span>
            <button onClick={() => setShowBulk(true)} className="btn btn-primary btn-sm">Bulk actions</button>
            <button onClick={() => setSelected([])} className="row-action" style={{ padding: '4px' }}><X size={17} /></button>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showAdd && (
          <AddLeadModal
            onClose={() => setShowAdd(false)}
            onSubmit={async (f) => {
              try {
                await API.post('/leads', f);
                toast.success('Lead created'); setShowAdd(false); loadLeads();
              } catch (err) {
                if (err.response?.status === 409) toast.error('Duplicate lead found');
                else toast.error(err.response?.data?.error || 'Failed to create lead');
              }
            }}
          />
        )}
        {showImport && <ImportModal onClose={() => setShowImport(false)} onSubmit={handleImport} onExport={handleExport} />}
        {showBulk && <BulkActionsModal selected={selected.length} onClose={() => setShowBulk(false)} onAction={handleBulkAction} />}
      </AnimatePresence>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   KANBAN — soft cards, spring drop (Section 9)
   ═══════════════════════════════════════════════════════════════ */
const STAGE_DOT = { new: '#A8A29E', contacted: '#3B82F6', interested: '#F59E0B', negotiating: '#A855F7', won: '#10B981', lost: '#D6D3D1' };
const AVATAR_GRADIENTS = [
  ['#A78BFA', '#EC4899'], ['#60A5FA', '#2563EB'], ['#FBBF24', '#F59E0B'], ['#34D399', '#059669'],
  ['#C084FC', '#7C3AED'], ['#F9A8D4', '#DB2777'], ['#67E8F9', '#0891B2'],
];
export function GradientAvatar({ first, last, size = 34 }) {
  const key = `${first || ''}${last || ''}`;
  let h = 0;
  for (let i = 0; i < key.length; i += 1) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  const [a, b] = AVATAR_GRADIENTS[h % AVATAR_GRADIENTS.length];
  return (
    <span className="flex items-center justify-center flex-shrink-0"
      style={{ width: size, height: size, borderRadius: 999, background: `linear-gradient(135deg, ${a}, ${b})`, color: '#fff', fontSize: Math.round(size * 0.34), fontWeight: 700 }}>
      {initialsOf(first, last)}
    </span>
  );
}
const SOURCE_LABEL = { facebook: 'Facebook ad', google_ads: 'Google ad', tiktok: 'TikTok ad', linkedin: 'LinkedIn form', website: 'website', lead_form: 'website form', whatsapp: 'WhatsApp', wordpress: 'WordPress form', zapier: 'Zapier', import: 'import', manual: 'added by hand' };

function KanbanBoard({ kanbanLeads, onLeadClick, onDropToStage }) {
  const [dragOver, setDragOver] = useState(null);
  const [dragging, setDragging] = useState(null);

  return (
    <div className="overflow-x-auto no-scrollbar" style={{ paddingBottom: 16 }}>
      <div className="flex" style={{ gap: 12, minWidth: 'max-content' }}>
        {kanbanLeads.map((col, colIdx) => {
          const isTarget = dragOver === col.stage;
          return (
            <motion.div
              key={col.stage}
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: colIdx * 0.05, duration: 0.22, ease: EASE_SOFT }}
              className={`tray ${isTarget ? 'tray-active' : ''}`}
              style={{ width: 262, flexShrink: 0, minHeight: 360, transition: 'background 160ms ease, border-color 160ms ease' }}
              onDragOver={(e) => { e.preventDefault(); setDragOver(col.stage); }}
              onDragLeave={() => setDragOver(null)}
              onDrop={(e) => { e.preventDefault(); setDragOver(null); if (dragging) onDropToStage(dragging, col.stage); setDragging(null); }}
            >
              <div className="flex items-center justify-between" style={{ padding: '2px 4px 10px' }}>
                <span className="flex items-center capitalize" style={{ gap: 7, fontSize: 13, fontWeight: 600 }}>
                  <span style={{ width: 7, height: 7, borderRadius: 999, background: STAGE_DOT[col.stage] || '#A8A29E' }} />
                  {col.stage === 'new' ? 'New lead' : col.stage}
                </span>
                <span style={{ fontSize: 12.5, color: 'var(--ink-3)', fontWeight: 600 }}>{col.items.length}</span>
              </div>

              <div className="flex flex-col" style={{ gap: 8 }}>
                {col.items.map((lead, idx) => (
                  <motion.div
                    key={lead.id || idx}
                    layout
                    draggable
                    onDragStart={(e) => { setDragging(lead.id); e.dataTransfer.effectAllowed = 'move'; }}
                    onDragEnd={() => { setDragging(null); setDragOver(null); }}
                    whileDrag={{ scale: 1.03, rotate: 1.5, zIndex: 50 }}
                    transition={SPRING_DROP}
                    onClick={() => onLeadClick(lead.id)}
                    className="lead-tile cursor-grab active:cursor-grabbing"
                    style={{ opacity: dragging === lead.id ? 0.4 : 1 }}
                  >
                    <div className="flex items-start" style={{ gap: 10 }}>
                      <GradientAvatar first={lead.first_name} last={lead.last_name} />
                      <div className="min-w-0 flex-1">
                        <p style={{ fontSize: 14, fontWeight: 600, lineHeight: 1.25 }}>{`${lead.first_name || ''} ${lead.last_name || ''}`.trim() || 'Unnamed lead'}</p>
                        {lead.update_requested && <div style={{ marginTop: 4 }}><UpdateRequestedPill /></div>}
                        <p className="truncate" style={{ fontSize: 12.5, color: 'var(--ink-3)', marginTop: 1 }}>{lead.city || lead.phone || lead.email || '—'}</p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between" style={{ marginTop: 12, gap: 8 }}>
                      <span style={{ fontSize: 14, fontWeight: 700 }}>{Number(lead.budget) > 0 ? `$${Number(lead.budget).toLocaleString()}` : <span style={{ color: 'var(--ink-3)', fontWeight: 500, fontSize: 12.5 }}>No budget yet</span>}</span>
                      {Number(lead.score) > 0 && (
                        <span className="flex items-center" title="Interest score" style={{ gap: 4, fontSize: 12, fontWeight: 600, color: '#4A2FD6', background: '#F3F0FF', borderRadius: 999, padding: '2px 8px' }}>
                          ◎ {lead.score}
                        </span>
                      )}
                    </div>
                    {(lead.stage || 'new') === 'new' && (
                      <p style={{ marginTop: 10, paddingTop: 8, borderTop: '1px dashed var(--hairline-strong)', fontSize: 12, color: 'var(--ink-3)' }}>
                        Captured from {SOURCE_LABEL[lead.lead_source] || String(lead.lead_source || 'a form').replace(/_/g, ' ')}
                        {' · '}{formatWait(leadHeat(lead).mins)} ago
                      </p>
                    )}
                  </motion.div>
                ))}

                {col.items.length === 0 && (
                  <div className="text-center" style={{ padding: '28px 8px', border: '1px dashed var(--hairline-strong)', borderRadius: 12 }}>
                    <p className="t-body-sm" style={{ color: 'var(--ink-3)' }}>{isTarget ? 'Drop here' : 'Drag a lead here'}</p>
                  </div>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   MODALS — 24px radius, modal shadow, plum backdrop (Section 7)
   ═══════════════════════════════════════════════════════════════ */

function ModalHeader({ title, onClose }) {
  return (
    <div className="flex items-center justify-between" style={{ marginBottom: '24px' }}>
      <h2 className="t-h2">{title}</h2>
      <button onClick={onClose} className="row-action"><X size={19} /></button>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <p className="meta-label" style={{ marginBottom: '8px' }}>{label}</p>
      {children}
    </div>
  );
}

function AddLeadModal({ onClose, onSubmit }) {
  const [form, setForm] = useState({
    first_name: '', last_name: '', phone: '', email: '',
    city: '', budget: '', lead_source: 'manual', notes: '',
  });
  return (
    <Modal open onClose={onClose} maxWidth="lg">
      <div style={{ padding: '24px' }}>
        <ModalHeader title="Add new lead" onClose={onClose} />
        <form onSubmit={(e) => { e.preventDefault(); onSubmit(form); }} className="flex flex-col" style={{ gap: '16px' }}>
          <div className="grid grid-cols-2" style={{ gap: '16px' }}>
            <Field label="First name *">
              <input autoFocus className="input" value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} required />
            </Field>
            <Field label="Last name">
              <input className="input" value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} />
            </Field>
          </div>
          <div className="grid grid-cols-2" style={{ gap: '16px' }}>
            <Field label="Phone">
              <input className="input mono" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </Field>
            <Field label="Email">
              <input className="input" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </Field>
          </div>
          <div className="grid grid-cols-2" style={{ gap: '16px' }}>
            <Field label="City">
              <input className="input" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
            </Field>
            <Field label="Budget">
              <input type="number" className="input mono" value={form.budget} onChange={(e) => setForm({ ...form, budget: e.target.value })} />
            </Field>
          </div>
          <Field label="Source">
            <select className="input" value={form.lead_source} onChange={(e) => setForm({ ...form, lead_source: e.target.value })}>
              {SOURCE_OPTIONS.map((s) => <option key={s} value={s} style={{ textTransform: 'capitalize' }}>{s}</option>)}
            </select>
          </Field>
          <Field label="Notes">
            <textarea className="input" rows="3" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </Field>
          <div className="flex" style={{ gap: '12px', paddingTop: '8px' }}>
            <button type="button" onClick={onClose} className="btn btn-secondary flex-1">Cancel</button>
            <button type="submit" className="btn btn-primary flex-1">Create lead</button>
          </div>
        </form>
      </div>
    </Modal>
  );
}

function ImportModal({ onClose, onSubmit, onExport }) {
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
        const hdrs = lines[0].split(',').map((h) => h.trim().replace(/"/g, ''));
        setHeaders(hdrs);
        const autoMap = {};
        hdrs.forEach((h) => {
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
    a.href = url; a.download = 'flazyn_leads_template.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  const leadFields = ['first_name', 'last_name', 'phone', 'email', 'city', 'budget', 'lead_source', 'notes'];

  return (
    <Modal open onClose={onClose} maxWidth="lg">
      <div style={{ padding: '24px' }}>
        <ModalHeader title="Import from CSV" onClose={onClose} />
        <div className="flex flex-col" style={{ gap: '16px' }}>
          <p className="t-body-sm read-col" style={{ color: '#57534E' }}>
            Download the template, fill it in, upload it, map the columns, import. Duplicates are skipped automatically.
          </p>

          <div className="flex flex-wrap" style={{ gap: '12px' }}>
            <button onClick={downloadTemplate} className="btn btn-secondary btn-sm">
              <Download size={14} /> CSV template
            </button>
            <button onClick={onExport} className="btn btn-ghost btn-sm">
              <Upload size={14} /> Export current leads
            </button>
          </div>

          <Field label="CSV file">
            <input type="file" accept=".csv" onChange={handleFile} className="input" style={{ paddingTop: '10px' }} />
          </Field>

          <AnimatePresence>
            {headers.length > 0 && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.22, ease: EASE_SOFT }}
                className="overflow-hidden flex flex-col"
                style={{ gap: '12px' }}
              >
                <p className="meta-label">Map columns</p>
                {headers.map((h, idx) => (
                  <motion.div
                    key={h || idx}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: Math.min(idx * 0.06, 0.36) }}
                    className="flex items-center"
                    style={{ gap: '12px' }}
                  >
                    <span className="mono truncate" style={{ width: '128px', color: '#57534E' }}>{h}</span>
                    <select
                      className="input flex-1"
                      value={mapping[h] || ''}
                      onChange={(e) => setMapping({ ...mapping, [h]: e.target.value })}
                    >
                      <option value="">— Skip —</option>
                      {leadFields.map((f) => <option key={f} value={f}>{f}</option>)}
                    </select>
                  </motion.div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>

          <div className="flex" style={{ gap: '12px', paddingTop: '8px' }}>
            <button onClick={onClose} className="btn btn-secondary flex-1">Cancel</button>
            <button disabled={!csvText} onClick={() => onSubmit(csvText, mapping)} className="btn btn-primary flex-1">Import</button>
          </div>
        </div>
      </div>
    </Modal>
  );
}

function BulkActionsModal({ selected, onClose, onAction }) {
  const [action, setAction] = useState('add_tag');
  const [value, setValue] = useState('');
  const destructive = action === 'delete';
  const { members, stages, sequences } = useAutomationOptions();

  return (
    <Modal open onClose={onClose} maxWidth="md">
      <div style={{ padding: '24px' }}>
        <ModalHeader title="Bulk actions" onClose={onClose} />
        <Badge tone="lavender" style={{ marginBottom: '16px' }}>{selected} leads selected</Badge>

        <div className="flex flex-col" style={{ gap: '16px' }}>
          <Field label="Action">
            <select className="input" value={action} onChange={(e) => { setAction(e.target.value); setValue(''); }}>
              <option value="add_tag">Add tag</option>
              <option value="change_stage">Change stage</option>
              <option value="assign">Assign to agent</option>
              <option value="start_sequence">Start WhatsApp sequence</option>
              <option value="delete">Delete leads</option>
            </select>
          </Field>

          {!destructive && (
            <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
              <Field label={action === 'add_tag' ? 'Tag name' : action === 'change_stage' ? 'Stage' : action === 'assign' ? 'Agent' : 'Sequence'}>
                {action === 'add_tag' ? (
                  <input className="input" value={value} onChange={(e) => setValue(e.target.value)} placeholder="e.g. hot" />
                ) : action === 'change_stage' ? (
                  <select className="input" value={value} onChange={(e) => setValue(e.target.value)}>
                    <option value="">Choose a stage…</option>
                    {stages.map((st) => <option key={st.id} value={st.name}>{st.name}</option>)}
                  </select>
                ) : action === 'assign' ? (
                  <select className="input" value={value} onChange={(e) => setValue(e.target.value)}>
                    <option value="">Choose a team member…</option>
                    {members.map((m) => <option key={m.id} value={m.id}>{memberLabel(m)}</option>)}
                  </select>
                ) : (
                  <select className="input" value={value} onChange={(e) => setValue(e.target.value)}>
                    <option value="">{sequences.length ? 'Choose a WhatsApp sequence…' : 'No active sequences yet'}</option>
                    {sequences.map((sq) => <option key={sq.id} value={sq.id}>{sq.name}</option>)}
                  </select>
                )}
              </Field>
            </motion.div>
          )}

          <button
            onClick={() => onAction(action, value)}
            disabled={!destructive && !value}
            className={`btn w-full ${destructive ? 'btn-danger' : 'btn-primary'}`}
          >
            Apply to {selected} lead{selected === 1 ? '' : 's'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
