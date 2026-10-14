import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import API from '../../lib/api';
import toast from 'react-hot-toast';
import {
  X, Save, Eye, Pencil, ChevronUp, ChevronDown, Trash2, Type,
  MousePointerClick, ImageIcon, Minus, MoveVertical, Columns, Plus, Code2,
} from 'lucide-react';
import { LEAD_VARIABLES, renderBlocksToHtml } from '../../lib/marketingShared';

let idCounter = 0;
const nid = () => `b${Date.now().toString(36)}${(idCounter++).toString(36)}`;

const PALETTE = [
  { type: 'text', label: 'Text', Icon: Type },
  { type: 'button', label: 'Button', Icon: MousePointerClick },
  { type: 'image', label: 'Image', Icon: ImageIcon },
  { type: 'divider', label: 'Divider', Icon: Minus },
  { type: 'spacer', label: 'Spacer', Icon: MoveVertical },
  { type: 'columns', label: 'Columns', Icon: Columns },
  { type: 'html', label: 'HTML', Icon: Code2 },
];

const newBlock = (type) => {
  switch (type) {
    case 'text': return { id: nid(), type, text: 'Write something worth reading…', align: 'left', size: 'normal', weight: 'normal' };
    case 'button': return { id: nid(), type, label: 'Call to action', url: 'https://', bgColor: '#1C1917', align: 'center', size: 'normal' };
    case 'image': return { id: nid(), type, url: '', alt: '' };
    case 'divider': return { id: nid(), type };
    case 'spacer': return { id: nid(), type, height: 24 };
    case 'html': return { id: nid(), type, html: '<p style="font-family:Arial,sans-serif">Your HTML here — {{First_Name}} works too.</p>' };
    case 'columns': return { id: nid(), type, columns: [[newBlock('text')], [newBlock('text')]] };
    default: return { id: nid(), type };
  }
};

export default function EmailEditor() {
  const { id } = useParams();               // uuid or 'new'
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [subject, setSubject] = useState('');
  const [blocks, setBlocks] = useState([newBlock('text'), newBlock('button')]);
  const [selectedId, setSelectedId] = useState(null);
  const [previewMode, setPreviewMode] = useState(false);
  const [mobileView, setMobileView] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dragOverIdx, setDragOverIdx] = useState(null);
  const dragPayload = useRef(null);

  useEffect(() => {
    if (!id || id === 'new') {
      setName('Untitled email');
      return;
    }
    API.get(`/marketing/emails/${id}`).then(({ data }) => {
      setName(data.email.name);
      setSubject(data.email.subject || '');
      if (Array.isArray(data.email.design) && data.email.design.length) {
        setBlocks(data.email.design);
      }
    }).catch(() => toast.error('Failed to load email'));
  }, [id]);

  const selected = findBlock(blocks, selectedId)?.block;

  /* ── mutations ── */
  const addBlock = (type, targetPath = null) => {
    const b = newBlock(type);
    setBlocks((prev) => {
      if (targetPath && targetPath.col != null) {
        return prev.map((row, i) => i === targetPath.row
          ? { ...row, columns: row.columns.map((col, ci) => ci === targetPath.col ? [...col, b] : col) }
          : row);
      }
      return [...prev, b];
    });
    setSelectedId(b.id);
  };

  const updateSelected = (patch) =>
    setBlocks((prev) => mapBlock(prev, selectedId, (blk) => ({ ...blk, ...patch })));

  const removeSelected = () => {
    setBlocks((prev) => stripBlock(prev, selectedId));
    setSelectedId(null);
  };

  const moveSelected = (dir) =>
    setBlocks((prev) => shiftBlock(prev, selectedId, dir));

  /* ── drag & drop ── */
  const onDragStartRow = (e, index) => {
    dragPayload.current = { kind: 'row', index };
    e.dataTransfer.effectAllowed = 'move';
  };
  const onDropOnZone = (e, targetIndex) => {
    e.preventDefault();
    e.stopPropagation();
    const payload = dragPayload.current;
    setDragOverIdx(null);
    if (!payload) {
      // dropped from palette
      const type = e.dataTransfer.getData('application/flazyn-block');
      if (type) addBlock(type, null); // palette drops append; zone drop handled below
      return;
    }
    setBlocks((prev) => {
      const next = [...prev];
      const [moved] = next.splice(payload.index, 1);
      const adjusted = targetIndex > payload.index ? targetIndex - 1 : targetIndex;
      next.splice(Math.max(0, Math.min(next.length, adjusted)), 0, moved);
      return next;
    });
  };

  const onDropInColumn = (e, rowIndex, colIndex) => {
    e.preventDefault();
    e.stopPropagation();
    const type = e.dataTransfer.getData('application/flazyn-block');
    if (type) addBlock(type, { row: rowIndex, col: colIndex });
  };

  const save = async () => {
    setSaving(true);
    try {
      const html = renderBlocksToHtml(blocks);
      const payload = { name: name.trim() || 'Untitled email', subject, design: blocks, html };
      if (id && id !== 'new') await API.put(`/marketing/emails/${id}`, payload);
      else {
        const res = await API.post('/marketing/emails', payload);
        navigate(`/app/marketing/emails/${res.data.email.id}`, { replace: true });
      }
      toast.success('Email saved');
    } catch (err) { toast.error(err.response?.data?.error || 'Save failed'); }
    finally { setSaving(false); }
  };

  const html = renderBlocksToHtml(blocks);

  return (
    <div className="-mx-6 -my-8 min-h-[calc(100vh-92px)] flex flex-col" style={{ background: '#FAFAF9' }}>
      {/* Top bar */}
      <div className="hairline-b px-6 py-3 flex items-center gap-4 flex-wrap bg-white sticky top-0 z-20">
        <button onClick={() => navigate('/app/marketing/emails')} className="text-ink-tertiary hover:text-ink-primary"><X size={16} /></button>
        <input className="font-bold outline-none bg-transparent min-w-[140px]" style={{ fontSize: '17px' }}
          placeholder="Name…" value={name} onChange={(e) => setName(e.target.value)} />
        <input className="input !h-8 flex-1 min-w-[180px] max-w-sm" placeholder="Subject line…"
          value={subject} onChange={(e) => setSubject(e.target.value)} />

        {/* Variable inserter */}
        <select className="input !h-8 w-[150px] text-xs" value=""
          onChange={(e) => {
            if (!e.target.value) return;
            navigator.clipboard.writeText(`{{${e.target.value}}}`);
            toast.success(`{{${e.target.value}}} copied`);
            setSelected(null);
          }}>
          <option value="">Copy variable…</option>
          {LEAD_VARIABLES.map((v) => <option key={v} value={v}>{`{{${v}}}`}</option>)}
        </select>

        <div className="flex items-center gap-2 ml-auto">
          <div className="flex" style={{ border: '1px solid #E7E5E4', borderRadius: '8px' }}>
            <button onClick={() => setPreviewMode(false)}
              className={`flex items-center gap-1 px-3 py-1 text-xs font-semibold ${!previewMode ? 'bg-brand text-white' : 'text-ink-secondary'}`}>
              <Pencil size={12} /> Edit
            </button>
            <button onClick={() => setPreviewMode(true)}
              className={`flex items-center gap-1 px-3 py-1 text-xs font-semibold ${previewMode ? 'bg-brand text-white' : 'text-ink-secondary'}`}>
              <Eye size={12} /> Preview
            </button>
          </div>
          {previewMode && (
            <div className="flex" style={{ border: '1px solid #E7E5E4', borderRadius: '8px' }}>
              {[['desktop', false], ['mobile', true]].map(([l, v]) => (
                <button key={l} onClick={() => setMobileView(v)}
                  className={`px-3 py-1 text-xs font-semibold capitalize ${mobileView === v ? 'bg-canvas text-ink-primary' : 'text-ink-tertiary'}`}>{l}</button>
              ))}
            </div>
          )}
          <button onClick={save} disabled={saving} className="btn btn-primary !min-h-0 py-1.5 text-sm flex items-center gap-1.5">
            <Save size={13} /> {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>

      {previewMode ? (
        <div className="flex-1 overflow-auto py-8 px-4">
          <iframe title="email preview" srcDoc={html}
            className="mx-auto bg-white shadow-sm"
            style={{
              width: mobileView ? '375px' : '100%',
              maxWidth: mobileView ? '375px' : '640px',
              height: 'calc(100vh - 200px)',
              border: '1px solid #E7E5E4', borderRadius: '10px',
            }} />
          <p className="text-center meta-label mt-3">Rendered HTML preview · variables shown raw until sent</p>
        </div>
      ) : (
        <div className="flex-1 flex min-h-0">
          {/* Palette */}
          <div className="w-[170px] hairline-r p-3 space-y-1.5 hidden md:block flex-shrink-0">
            <p className="meta-label mb-2 px-1">Blocks — drag in</p>
            {PALETTE.map(({ type, label, Icon }) => (
              <div key={type} draggable
                onDragStart={(e) => e.dataTransfer.setData('application/flazyn-block', type)}
                className="flex items-center gap-2 p-2 bg-white cursor-grab active:cursor-grabbing hover:shadow-sm"
                style={{ border: '1px solid #E7E5E4', borderRadius: '8px' }}
                onClick={() => addBlock(type)}>
                <Icon size={14} className="text-ink-secondary" />
                <span className="font-semibold" style={{ fontSize: '12px' }}>{label}</span>
              </div>
            ))}
            <p className="text-ink-tertiary pt-3 px-1 leading-snug" style={{ fontSize: '11px' }}>
              Click a block to also append it. Select any block to edit its content →
            </p>
          </div>

          {/* Canvas */}
          <div className="flex-1 overflow-auto py-8 px-4 min-w-0"
            onDragOver={(e) => { e.preventDefault(); }}>
            <div className="mx-auto bg-white"
              style={{
                width: '100%', maxWidth: '620px',
                border: '1px solid #E7E5E4', borderRadius: '10px', padding: '28px',
              }}
              onDragOver={(e) => { e.preventDefault(); setDragOverIdx(blocks.length); }}
              onDrop={(e) => onDropOnZone(e, blocks.length)}>
              {blocks.length === 0 && (
                <p className="text-center text-ink-tertiary py-14">Drag blocks here</p>
              )}

              {blocks.map((row, idx) => (
                <div key={row.id}
                  onDragOver={(e) => { e.preventDefault(); setDragOverIdx(idx); }}
                  onDrop={(e) => onDropOnZone(e, idx)}
                  className={`relative transition-colors ${dragOverIdx === idx ? 'border-t-2 border-accent' : ''}`}
                  style={{ minHeight: '24px' }}>
                  <BlockRow row={row}
                    onSelect={() => setSelectedId(row.id)}
                    isSelected={selectedId === row.id}
                    selectedId={selectedId}
                    onSelectNested={setSelectedId}
                    onColumnDrop={onDropInColumn}
                    onDragStart={(e) => onDragStartRow(e, idx)} />
                  {/* hover controls */}
                  {selectedId === row.id && (
                    <div className="absolute -top-3 right-0 flex items-center gap-1 bg-white px-1 z-10"
                      style={{ border: '1px solid #E7E5E4', borderRadius: '8px' }}>
                      <button onClick={() => moveSelected(-1)} disabled={idx === 0} className="p-1 text-ink-tertiary hover:text-ink-primary disabled:opacity-30"><ChevronUp size={13} /></button>
                      <button onClick={() => moveSelected(1)} disabled={idx === blocks.length - 1} className="p-1 text-ink-tertiary hover:text-ink-primary disabled:opacity-30"><ChevronDown size={13} /></button>
                      <button onClick={removeSelected} className="p-1 text-ink-tertiary hover:text-ember-deep"><Trash2 size={13} /></button>
                    </div>
                  )}
                  <div className="h-4" />
                </div>
              ))}

              {dragOverIdx == null && (
                <button onClick={() => addBlock('text')}
                  className="w-full mt-2 py-2 text-xs font-semibold text-ink-tertiary hover:text-ink-primary transition-colors"
                  style={{ border: '1px dashed #E7E5E4', borderRadius: '8px' }}>
                  + add text block
                </button>
              )}
            </div>
          </div>

          {/* Properties */}
          <div className="w-[260px] hairline-l p-4 overflow-y-auto hidden lg:block flex-shrink-0 bg-white">
            <p className="meta-label mb-3">Block settings</p>
            {!selected ? (
              <p className="text-ink-tertiary text-sm">Select a block on the canvas.</p>
            ) : (
              <PropertiesOf block={selected} onChange={updateSelected}
                onAddColumn={() => updateSelected({ columns: [...(selected.columns || []), []] })}
                onRemoveColumn={(ci) => updateSelected({ columns: (selected.columns || []).filter((_, i) => i !== ci) })}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function setSelected() {} // no-op helper kept minimal

/* ─────────── tree helpers (top-level rows + nested column children) ─────────── */

function mapBlock(rows, id, fn) {
  return rows.map((r) => {
    if (r.id === id) return fn(r);
    if (r.type === 'columns') {
      let changed = false;
      const columns = r.columns.map((col) => col.map((c) => {
        if (c.id === id) { changed = true; return fn(c); }
        return c;
      }));
      return changed ? { ...r, columns } : r;
    }
    return r;
  });
}

function findBlock(rows, id) {
  for (const r of rows) {
    if (r.id === id) return { block: r, parent: null };
    if (r.type === 'columns') {
      for (const col of r.columns) {
        const hit = col.find((c) => c.id === id);
        if (hit) return { block: hit, parent: r.id };
      }
    }
  }
  return {};
}

function stripBlock(rows, id) {
  return rows
    .filter((r) => r.id !== id)
    .map((r) => r.type === 'columns'
      ? { ...r, columns: r.columns.map((col) => col.filter((c) => c.id !== id)) }
      : r);
}

function shiftBlock(rows, id, dir) {
  const idx = rows.findIndex((r) => r.id === id);
  if (idx === -1) return rows;
  const j = idx + dir;
  if (j < 0 || j >= rows.length) return rows;
  const next = [...rows];
  [next[idx], next[j]] = [next[j], next[idx]];
  return next;
}

/* ─────────── rendering ─────────── */

const esc = (s = '') => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function BlockPreviewInner({ b }) {
  switch (b.type) {
    case 'text': {
      const size = b.size === 'large' ? '22px' : b.size === 'small' ? '13px' : '15px';
      return (
        <div style={{ textAlign: b.align || 'left', fontSize: size, fontWeight: b.weight === 'bold' ? 700 : 400, lineHeight: 1.65, color: '#222' }}>
          {String(b.text || '').split('\n').map((ln, i) => <span key={i}>{esc(ln)}<br /></span>)}
        </div>
      );
    }
    case 'button':
      return (
        <div style={{ textAlign: b.align || 'center' }}>
          <span style={{ display: 'inline-block', background: b.bgColor || '#1C1917', color: '#fff', padding: '12px 28px', borderRadius: '8px', fontSize: b.size === 'large' ? '17px' : '15px', fontWeight: 600 }}>
            {esc(b.label || 'Button')}
          </span>
        </div>
      );
    case 'image':
      return b.url
        ? <img src={b.url} alt={b.alt || ''} style={{ width: '100%', borderRadius: '8px', display: 'block' }} />
        : <div className="text-center text-ink-tertiary py-8" style={{ border: '1px dashed #E7E5E4', borderRadius: '8px', fontSize: '12px' }}>Paste an image URL in the right panel</div>;
    case 'divider':
      return <div style={{ borderTop: '1px solid #e5e5e5' }} />;
    case 'spacer':
      return <div style={{ height: Number(b.height) || 24 }} />;
    case 'html':
      return (
        <iframe
          title="HTML block"
          sandbox=""
          srcDoc={b.html || ''}
          style={{ width: '100%', minHeight: /<html[\s>]/i.test(b.html || '') ? 520 : 120, border: '1px dashed #D6D3D1', borderRadius: 8, background: '#fff', pointerEvents: 'none' }}
        />
      );
    default: return null;
  }
}

function BlockRow({ row, onSelect, isSelected, selectedId, onSelectNested, onColumnDrop, onDragStart }) {
  const ring = isSelected ? '0 0 0 2px rgba(91,61,245,0.35)' : 'none';
  const commonProps = {
    draggable: true,
    onDragStart: onDragStart,
    onMouseDown: onSelect,
    style: { boxShadow: ring, borderRadius: '8px', cursor: 'grab' },
  };

  if (row.type === 'columns') {
    return (
      <div {...commonProps} className="grid gap-3" style={{ gridTemplateColumns: `repeat(${Math.max(1, row.columns?.length || 1)}, 1fr)` }}>
        {(row.columns || []).map((col, ci) => (
          <div key={ci}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => onColumnDrop(e, -1, ci)}
            className="min-h-[60px]"
            style={{ outline: '1px dashed transparent' }}
            data-col={ci}>
            {col.map((c) => (
              <div key={c.id} onMouseDown={(e) => { e.stopPropagation(); onSelectNested(c.id); }}
                draggable onDragStart={onDragStart}
                className="mb-3 cursor-grab"
                style={{ boxShadow: selectedId === c.id ? '0 0 0 2px rgba(91,61,245,0.35)' : 'none', borderRadius: '8px' }}>
                <BlockPreviewInner b={c} />
              </div>
            ))}
          </div>
        ))}
      </div>
    );
  }

  return (
    <div {...commonProps}>
      <BlockPreviewInner b={row} />
    </div>
  );
}

/* ─────────── properties panel ─────────── */

function PropertiesOf({ block, onChange, onAddColumn, onRemoveColumn }) {
  switch (block.type) {
    case 'text': return (
      <div className="space-y-3">
        <div><p className="meta-label mb-1">Content</p>
          <textarea className="input" rows={5} value={block.text || ''} onChange={(e) => onChange({ text: e.target.value })} /></div>
        <PropRow label="Align">
          <select className="input" value={block.align || 'left'} onChange={(e) => onChange({ align: e.target.value })}>
            <option value="left">Left</option><option value="center">Center</option><option value="right">Right</option>
          </select></PropRow>
        <PropRow label="Size">
          <select className="input" value={block.size || 'normal'} onChange={(e) => onChange({ size: e.target.value })}>
            <option value="small">Small</option><option value="normal">Normal</option><option value="large">Large</option>
          </select></PropRow>
        <PropRow label="Weight">
          <select className="input" value={block.weight || 'normal'} onChange={(e) => onChange({ weight: e.target.value })}>
            <option value="normal">Normal</option><option value="bold">Bold</option>
          </select></PropRow>
      </div>);
    case 'button': return (
      <div className="space-y-3">
        <div><p className="meta-label mb-1">Label</p><input className="input" value={block.label || ''} onChange={(e) => onChange({ label: e.target.value })} /></div>
        <div><p className="meta-label mb-1">Link URL</p><input className="input" value={block.url || ''} onChange={(e) => onChange({ url: e.target.value })} placeholder="https://…" /></div>
        <PropRow label="Color"><input type="color" className="input !h-9 w-full" value={block.bgColor || '#1C1917'} onChange={(e) => onChange({ bgColor: e.target.value })} /></PropRow>
        <PropRow label="Align">
          <select className="input" value={block.align || 'center'} onChange={(e) => onChange({ align: e.target.value })}>
            <option value="left">Left</option><option value="center">Center</option><option value="right">Right</option>
          </select></PropRow>
        <PropRow label="Size">
          <select className="input" value={block.size || 'normal'} onChange={(e) => onChange({ size: e.target.value })}>
            <option value="normal">Normal</option><option value="large">Large</option>
          </select></PropRow>
      </div>);
    case 'image': return (
      <div className="space-y-3">
        <div><p className="meta-label mb-1">Image URL</p><input className="input" value={block.url || ''} onChange={(e) => onChange({ url: e.target.value })} placeholder="https://…" /></div>
        <div><p className="meta-label mb-1">Alt text</p><input className="input" value={block.alt || ''} onChange={(e) => onChange({ alt: e.target.value })} /></div>
      </div>);
    case 'spacer': return (
      <PropRow label="Height (px)"><input type="number" min="4" className="input" value={block.height ?? 24} onChange={(e) => onChange({ height: Number(e.target.value) })} /></PropRow>);
    case 'divider': return <p className="text-ink-tertiary text-sm">A thin horizontal rule.</p>;
    case 'html': return (
      <div className="space-y-2">
        <p className="meta-label">Raw HTML</p>
        <textarea className="input mono" rows={16} style={{ fontSize: 12 }} value={block.html || ''} onChange={(e) => onChange({ html: e.target.value })} spellCheck={false} />
        <p className="text-ink-tertiary text-xs">Paste a full email (&lt;html&gt;…) to send it exactly as written, or a fragment to drop between other blocks. Variables like {'{{First_Name}}'} are filled in on send.</p>
      </div>);
    case 'columns': return (
      <div className="space-y-3">
        <p className="text-ink-secondary text-sm">{(block.columns || []).length} columns — drag Text/Button/Image onto a column.</p>
        <div className="flex items-center gap-2">
          <button onClick={onAddColumn} className="btn btn-secondary !py-1 !min-h-0 text-xs flex items-center gap-1"><Plus size={11} /> Add column</button>
          {(block.columns || []).length > 1 && (
            <button onClick={() => onRemoveColumn(block.columns.length - 1)} className="btn-danger !py-1 text-xs">Remove last</button>
          )}
        </div>
      </div>);
    default: return null;
  }
}

function PropRow({ label, children }) {
  return (
    <div>
      {label && <p className="meta-label mb-1">{label}</p>}
      {children}
    </div>
  );
}
