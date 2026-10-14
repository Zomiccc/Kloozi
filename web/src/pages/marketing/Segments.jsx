import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import API from '../../lib/api';
import toast from 'react-hot-toast';
import { X, Plus, Trash2, Users } from 'lucide-react';
import {
  SEGMENT_FIELDS, SEGMENT_PRESETS,
  describeSegmentConditions, fmtDate,
} from '../../lib/marketingShared';
import useCreateRegistry from '../../stores/createStore';

const emptyCondition = () => ({ field: 'stage', operator: 'eq', value: '' });

export default function Segments() {
  const [segments, setSegments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);   // null | {segment?} opens editor
  const [membersOf, setMembersOf] = useState(null);
  const register = useCreateRegistry((s) => s.register);
  const clearRegistry = useCreateRegistry((s) => s.clear);

  useEffect(() => {
    register([{ label: 'New segment', icon: <Plus size={14} />, run: () => setEditing({}) }]);
    return () => clearRegistry();
  }, [register, clearRegistry]);

  useEffect(() => { load(); }, []);
  const load = async () => {
    try { setSegments((await API.get('/marketing/segments')).data.segments); }
    catch { toast.error('Failed to load segments'); }
    finally { setLoading(false); }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 style={{ fontSize: '32px', fontWeight: 650, letterSpacing: '-0.01em' }}>Segments</h1>
        <p className="text-ink-secondary mt-1" style={{ fontSize: '15px' }}>
          Living audiences defined by conditions — they update themselves as your leads change.
        </p>
      </div>

      {loading ? (
        <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="skeleton h-16" />)}</div>
      ) : segments.length === 0 ? (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="pt-16 max-w-[560px]">
          <p style={{ fontSize: '22px', fontWeight: 600 }}>No segments yet.</p>
          <p className="text-ink-secondary mt-2" style={{ fontSize: '15px' }}>Define an audience once — campaigns and flows can use it forever.</p>
          <button onClick={() => setEditing({})} className="btn btn-primary mt-5">Create the first one</button>
        </motion.div>
      ) : (
        <div>
          {segments.map((s, idx) => (
            <motion.div
              key={s.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(idx * 0.04, 0.3), duration: 0.2, ease: 'easeOut' }}
              className="group hairline-b py-4 flex items-center justify-between gap-4 hover-accent-left"
            >
              <div className="min-w-0">
                <h3 className="font-semibold" style={{ fontSize: '15px' }}>{s.name}</h3>
                <p className="text-ink-secondary mt-0.5 truncate" style={{ fontSize: '13px' }}>
                  Match {s.match_type === 'any' ? 'ANY' : 'ALL'} · {describeSegmentConditions(s)}
                </p>
              </div>
              <div className="flex items-center gap-6 flex-shrink-0">
                <div className="text-right">
                  {/* Live membership — flashes when it changes */}
                  <motion.span
                    key={s.live_count}
                    initial={{ opacity: 0.4, scale: 0.96 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                    className="mono inline-block"
                    style={{ fontSize: '22px', fontWeight: 600 }}
                  >
                    {s.live_count ?? '—'}
                  </motion.span>
                  <p className="meta-label">leads</p>
                </div>
                <div className="flex items-center gap-4 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => setMembersOf(s)} className="btn-ghost text-sm font-medium flex items-center gap-1.5"><Users size={14} /> Members</button>
                  <button onClick={() => setEditing({ segment: s })} className="btn-ghost text-sm font-medium">Edit</button>
                  <button
                    onClick={async () => {
                      if (!window.confirm(`Delete segment "${s.name}"?`)) return;
                      try { await API.delete(`/marketing/segments/${s.id}`); toast.success('Deleted'); load(); }
                      catch { toast.error('Delete failed'); }
                    }}
                    className="btn-danger text-sm font-medium"
                  >Delete</button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {editing && <SegmentEditor draft={editing.segment} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load(); }} />}
      {membersOf && <MembersDrawer segment={membersOf} onClose={() => setMembersOf(null)} />}
    </div>
  );
}

/* ───────────────────────── Editor ───────────────────────── */

function SegmentEditor({ draft, onClose, onSaved }) {
  const [name, setName] = useState(draft?.name || '');
  const [description, setDescription] = useState(draft?.description || '');
  const [matchType, setMatchType] = useState(draft?.match_type || 'all');
  const [conditions, setConditions] = useState(
    Array.isArray(draft?.conditions) && draft.conditions.length ? draft.conditions : [emptyCondition()]
  );
  const [preview, setPreview] = useState(null);
  const previewTimer = useRef(null);
  const debouncePreview = useCallback((payload) => {
    clearTimeout(previewTimer.current);
    previewTimer.current = setTimeout(async () => {
      try { setPreview((await API.post('/marketing/segments/preview', payload)).data); }
      catch { setPreview(null); }
    }, 350);
  }, []);

  useEffect(() => {
    if (name.trim()) debouncePreview({ match_type: matchType, conditions });
    return () => clearTimeout(previewTimer.current);
  }, [matchType, conditions, name, debouncePreview]);

  const setCond = (idx, patch) =>
    setConditions(conditions.map((c, i) => (i === idx ? patch : c)));

  const changeField = (idx, field) => {
    const f = SEGMENT_FIELDS.find((x) => x.value === field);
    setCond(idx, { field, operator: f?.operators?.[0]?.value || 'eq',
      value: f?.valueType === 'bool' ? true : f?.valueType === 'number' || f?.valueType === 'days' ? (f.unit === 'days' ? 7 : '') : '' });
  };

  const save = async () => {
    if (!name.trim()) return toast.error('Name required');
    const payload = { name, description, match_type: matchType, conditions };
    try {
      if (draft?.id) await API.put(`/marketing/segments/${draft.id}`, payload);
      else await API.post('/marketing/segments', payload);
      toast.success('Segment saved');
      onSaved();
    } catch (err) { toast.error(err.response?.data?.error || 'Save failed'); }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
      className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-0 sm:p-6 overflow-y-auto"
      style={{ background: 'rgba(28,25,23,0.2)' }}
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.97, y: 8 }}
        transition={{ type: 'spring', stiffness: 360, damping: 30 }}
        className="card-raised w-full max-w-4xl my-0 sm:my-8 !p-0"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 pt-5 pb-4 hairline-b sticky top-0 bg-white z-10 rounded-t-lg">
          <h2 style={{ fontSize: '22px', fontWeight: 600 }}>{draft?.id ? 'Edit segment' : 'New segment'}</h2>
          <button onClick={onClose} className="text-ink-tertiary hover:text-ink-primary transition-colors"><X size={18} /></button>
        </div>

        {!draft?.id && (
          <div className="px-6 py-3 hairline-b flex flex-wrap gap-2 items-center">
            <span className="meta-label mr-1">Start from:</span>
            {SEGMENT_PRESETS.map((p) => (
              <button key={p.label}
                onClick={() => { setName((n) => n || p.label); setMatchType(p.match_type); setConditions(p.conditions.map(c => ({ ...c }))); }}
                className="text-xs font-medium text-ink-secondary hover:text-ink-primary transition-colors"
                style={{ border: '1px solid #E7E5E4', borderRadius: '999px', padding: '3px 10px' }}>
                {p.label}
              </button>
            ))}
          </div>
        )}

        <div className="grid md:grid-cols-[1fr_260px]">
          {/* Left: builder */}
          <div className="px-6 py-5 space-y-4">
            <div>
              <p className="meta-label mb-1">Name</p>
              <input className="input" placeholder='e.g. "Warm leads gone quiet"' value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div>
              <p className="meta-label mb-1">Description (optional)</p>
              <input className="input" value={description} onChange={(e) => setDescription(e.target.value)} />
            </div>

            <div className="flex items-center gap-3">
              <p className="meta-label">Lead must match</p>
              <div className="flex" style={{ border: '1px solid #E7E5E4', borderRadius: '8px' }}>
                {[['all', 'ALL'], ['any', 'ANY']].map(([v, l]) => (
                  <button key={v} onClick={() => setMatchType(v)}
                    className={`px-3 py-1 text-sm font-semibold ${matchType === v ? 'bg-brand text-white' : 'text-ink-secondary'}`}
                    style={{ borderRadius: matchType === v ? '3px' : 0 }}>
                    {l}
                  </button>
                ))}
              </div>
              <span className="text-ink-tertiary" style={{ fontSize: '13px' }}>of these conditions:</span>
            </div>

            <div className="space-y-2">
              {conditions.map((c, idx) => (
                <ConditionRow key={idx} cond={c}
                  onChange={(patch) => setCond(idx, patch)}
                  onFieldChange={(field) => changeField(idx, field)}
                  onRemove={() => setConditions(conditions.filter((_, i) => i !== idx))}
                  canRemove={conditions.length > 1}
                />
              ))}
              <button onClick={() => setConditions([...conditions, emptyCondition()])}
                className="flex items-center gap-1.5 text-sm font-semibold text-ink-primary hover:text-accent-deep transition-colors mt-1">
                <Plus size={15} /> Add condition
              </button>
            </div>
          </div>

          {/* Right: live preview */}
          <div className="hairline-l md:border-t-0 border-t px-5 py-5" style={{ background: '#FAFAF9' }}>
            <p className="meta-label mb-2">Live preview</p>
            {name.trim() === '' ? (
              <p className="text-ink-tertiary text-sm">Name the segment to see who matches.</p>
            ) : preview == null ? (
              <div className="skeleton h-10" />
            ) : (
              <>
                <motion.p
                  key={preview.count}
                  initial={{ scale: 0.94, opacity: 0.5 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 26 }}
                  className="mono inline-block"
                  style={{ fontSize: '34px', fontWeight: 600 }}
                >
                  {preview.count}
                </motion.p>
                <p className="text-ink-secondary -mt-1 mb-3" style={{ fontSize: '13px' }}>leads match right now</p>
                <div className="space-y-1.5 max-h-64 overflow-y-auto">
                  {preview.sample.map((l) => (
                    <div key={l.id} className="flex items-baseline justify-between gap-2">
                      <span className="truncate text-sm">{l.first_name} {l.last_name}</span>
                      <span className="text-ink-tertiary mono flex-shrink-0" style={{ fontSize: '11px' }}>{l.stage}</span>
                    </div>
                  ))}
                  {preview.count > preview.sample.length && (
                    <p className="text-ink-tertiary text-xs pt-1">+{preview.count - preview.sample.length} more…</p>
                  )}
                </div>
              </>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-3 px-6 py-4 hairline-t sticky bottom-0 bg-white rounded-b-lg">
          <button onClick={onClose} className="btn-ghost font-medium">Cancel</button>
          <motion.button whileTap={{ scale: 0.97 }} onClick={save} className="btn btn-primary">Save segment</motion.button>
        </div>
      </motion.div>
    </motion.div>
  );
}

function ConditionRow({ cond, onChange, onFieldChange, onRemove, canRemove }) {
  const fieldDef = SEGMENT_FIELDS.find((f) => f.value === cond.field);
  const [agents, setAgents] = useState([]);

  useEffect(() => {
    if (fieldDef?.valueType !== 'agent') return;
    API.get('/users?role=sales_agent').then((r) => setAgents(r.data.users || r.data)).catch(() => {});
  }, [fieldDef?.valueType]);

  const valueInput = (() => {
    switch (fieldDef?.valueType) {
      case 'none': return null;
      case 'select':
        return (
          <select className="input flex-1 min-w-[120px]" value={cond.value ?? ''}
            onChange={(e) => onChange({ value: e.target.value })}>
            <option value="">Choose…</option>
            {fieldDef.options.map((o) => <option key={o} value={o}>{o.replace(/_/g, ' ')}</option>)}
          </select>
        );
      case 'number': case 'days':
        return (
          <input type="number" className="input flex-1 min-w-[90px]" placeholder={fieldDef.valueType === 'days' ? 'days' : 'amount'}
            value={cond.value ?? ''} onChange={(e) => onChange({ value: e.target.value === '' ? '' : Number(e.target.value) })} />
        );
      case 'bool':
        return (
          <select className="input flex-1 min-w-[100px]" value={String(cond.value ?? true)}
            onChange={(e) => onChange({ value: e.target.value === 'true' })}>
            <option value="true">Yes</option><option value="false">No</option>
          </select>
        );
      case 'tags':
        return (
          <input className="input flex-1 min-w-[140px]" placeholder="tag1, tag2"
            value={Array.isArray(cond.value) ? cond.value.join(', ') : (cond.value ?? '')}
            onChange={(e) => onChange({ value: e.target.value.split(',').map((t) => t.trim()).filter(Boolean) })} />
        );
      case 'agent':
        return (
          <select className="input flex-1 min-w-[140px]" value={cond.value ?? ''}
            onChange={(e) => onChange({ value: e.target.value })}>
            <option value="">Choose agent…</option>
            {agents.map((a) => <option key={a.id} value={a.id}>{a.first_name} {a.last_name}</option>)}
          </select>
        );
      default:
        return <input className="input flex-1 min-w-[140px]" value={cond.value ?? ''} onChange={(e) => onChange({ value: e.target.value })} />;
    }
  })();

  const opOptions = fieldDef?.operators?.length
    ? fieldDef.operators
    : [{ value: 'eq', label: 'is' }];

  return (
    <div className="flex flex-wrap sm:flex-nowrap items-end gap-2">
      <select className="input sm:w-[210px] flex-shrink-0" value={cond.field} onChange={(e) => onFieldChange(e.target.value)}>
        {SEGMENT_FIELDS.map((f) => <option key={f.value} value={f.value}>{f.label}{f.unit ? ` (${f.unit})` : ''}</option>)}
      </select>
      {opOptions[0]?.label && opOptions.length > 0 && (
        <select className="input sm:w-[110px] flex-shrink-0 hidden sm:block" value={cond.operator}
          onChange={(e) => onChange({ operator: e.target.value })}
          disabled={opOptions.length === 1}>
          {opOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      )}
      {valueInput}
      {canRemove && (
        <button onClick={onRemove} className="text-ink-tertiary hover:text-ember-deep transition-colors pb-2 px-1">
          <Trash2 size={15} />
        </button>
      )}
    </div>
  );
}

/* ───────────────────────── Members drawer ───────────────────────── */

function MembersDrawer({ segment, onClose }) {
  const [data, setData] = useState(null);
  useEffect(() => {
    API.get(`/marketing/segments/${segment.id}/members`).then((r) => setData(r.data)).catch(() => setData({ count: 0, members: [] }));
  }, [segment.id]);

  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div className="fixed top-0 right-0 bottom-0 z-50 animate-slide-right overflow-y-auto w-full max-w-md bg-white border-l hairline-l">
        <div className="sticky top-0 bg-white hairline-b px-5 py-4 flex items-center justify-between">
          <div>
            <p className="font-bold" style={{ fontSize: '16px' }}>{segment.name}</p>
            <p className="text-ink-secondary mono" style={{ fontSize: '12px' }}>{data ? `${data.count} leads` : 'loading…'}</p>
          </div>
          <button onClick={onClose} className="text-ink-tertiary hover:text-ink-primary transition-colors"><X size={18} /></button>
        </div>
        {!data ? <div className="p-5 space-y-2">{[1,2,3,4,5].map(i => <div key={i} className="skeleton h-10" />)}</div> : (
          data.members.length === 0 ? <p className="p-6 text-sm text-ink-tertiary">No leads currently match.</p> : (
            <div>
              {data.members.map((m) => (
                <div key={m.id} className="px-5 py-3 hairline-b hover:bg-canvas transition-colors">
                  <p className="font-semibold text-sm">{m.first_name} {m.last_name}</p>
                  <p className="text-ink-secondary text-xs mt-0.5 flex flex-wrap gap-x-3">
                    <span>{m.email || '—'}</span>
                    <span className="badge badge-neutral capitalize">{m.stage}</span>
                  </p>
                </div>
              ))}
            </div>
          )
        )}
        <div className="px-5 py-3 text-ink-tertiary" style={{ fontSize: '12px' }}>
          Membership is live — it updates as lead data changes. Last checked just now.
        </div>
      </div>
    </>
  );
}
