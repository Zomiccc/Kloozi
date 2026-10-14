import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import ReactFlow, {
  Background, Controls, Handle, Position,
  useNodesState, useEdgesState, addEdge, useReactFlow, ReactFlowProvider,
} from 'reactflow';
import 'reactflow/dist/style.css';
import API from '../../lib/api';
import toast from 'react-hot-toast';
import {
  X, Save, Play, Pause, Trash2, Users, BarChart3, PencilRuler, GripVertical, Send,
} from 'lucide-react';
import {
  NODE_TYPES, TRIGGER_TYPES, CONDITION_TYPES, STAGES, SOURCES, LEAD_VARIABLES, fmtDateTime,
} from '../../lib/marketingShared';

/* ───────────────────────── Custom node rendering ───────────────────────── */

function FlowNode({ data, selected }) {
  const meta = NODE_TYPES[data.ntype] || NODE_TYPES.send_email;
  const isCondition = data.ntype === 'condition';

  const summary = (() => {
    switch (data.ntype) {
      case 'send_email':
        return data.config?.subject ? String(data.config.subject).slice(0, 60)
          : data.config?.marketing_email_id ? 'Saved email' : 'Not configured';
      case 'wait': return `${data.config?.duration ?? 1} ${data.config?.unit ?? 'minutes'}`;
      case 'condition': return CONDITION_TYPES.find(c => c.value === data.config?.condition_type)?.label || 'Not configured';
      case 'add_tag': return data.config?.tag ? `#${data.config.tag}` : 'Not configured';
      case 'change_stage': return data.config?.stage ? `→ ${data.config.stage}` : 'Not configured';
      case 'notify_agent': return data.config?.message ? String(data.config.message).slice(0, 50) : 'Notify assigned agent';
      case 'whatsapp': case 'sms': return data.config?.message ? String(data.config.message).slice(0, 50) : 'Not configured';
      case 'exit': return 'End path';
      default: return '';
    }
  })();

  return (
    <div
      className="bg-white transition-shadow"
      style={{
        border: `1px solid ${selected ? meta.color : '#E7E5E4'}`,
        boxShadow: selected ? `0 0 0 2px ${meta.color}22` : 'none',
        borderRadius: '10px',
        minWidth: '210px',
      }}
    >
      <Handle type="target" position={Position.Top} style={{ background: '#A8A29E', width: 9, height: 9 }} />
      <div className="px-3 py-2 flex items-center gap-2.5">
        <span className="flex items-center justify-center text-white font-bold text-xs flex-shrink-0"
          style={{ background: meta.color, width: 26, height: 26, borderRadius: '8px' }}>
          {meta.glyph}
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-semibold leading-tight" style={{ fontSize: '13px' }}>{meta.label}</p>
          <p className="text-ink-tertiary truncate" style={{ fontSize: '11px' }}>{summary}</p>
        </div>
      </div>

      {isCondition ? (
        <>
          <Handle type="source" id="yes" position={Position.Bottom}
            style={{ background: '#0E8A5F', left: '30%' }} />
          <Handle type="source" id="no" position={Position.Bottom}
            style={{ background: '#B45309', left: '70%' }} />
        </>
      ) : (
        data.ntype !== 'exit' && (
          <Handle type="source" position={Position.Bottom} style={{ background: '#A8A29E', width: 9, height: 9 }} />
        )
      )}
    </div>
  );
}

const nodeTypes = { action: FlowNode };

const rfToGraph = (nodes, edges) => ({
  nodes: nodes.filter(n => n.type === 'action').map((n) => ({
    key: n.id, type: n.data.ntype, x: n.position.x, y: n.position.y, config: n.data.config || {},
  })),
  edges: edges.map((e) => ({ from: e.source, to: e.target, label: e.sourceHandle || e.label || null })),
});

const graphToRf = (graph) => ({
  nodes: (graph.nodes || []).filter(n => n.type !== 'trigger').map((n) => ({
    id: n.key, type: 'action', position: { x: Number(n.x) || 0, y: Number(n.y) || 0 },
    data: { ntype: n.type, config: n.config || {} },
  })),
  edges: (graph.edges || []).map((e, i) => ({
    id: `e${i}`, source: e.from, target: e.to,
    sourceHandle: ['yes', 'no'].includes(e.label) ? e.label : undefined,
    label: e.label && !['yes', 'no'].includes(e.label) ? e.label : undefined,
    type: 'smoothstep', animated: true,
    style: { stroke: ['yes'].includes(e.label) ? '#0E8A5F' : ['no'].includes(e.label) ? '#B45309' : '#A8A29E', strokeWidth: 1.5 },
    labelStyle: { fontSize: 10, fill: '#57534E' }, labelBgStyle: { fill: '#FAFAF9' },
  })),
});

/* ───────────────────────── Builder shell ───────────────────────── */

export default function FlowBuilder() {
  return (
    <ReactFlowProvider>
      <BuilderInner />
    </ReactFlowProvider>
  );
}

function BuilderInner() {
  const { id } = useParams();               // 'new' or flow uuid
  const navigate = useNavigate();
  const rfInstance = useReactFlow();

  const [flowMeta, setFlowMeta] = useState({ name: '', description: '', trigger_type: 'segment_entered', trigger_config: {}, status: 'draft' });
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [selectedKey, setSelectedKey] = useState(null);
  const [tab, setTab] = useState('build');
  const [segments, setSegments] = useState([]);
  const [savedEmails, setSavedEmails] = useState([]);
  const [saving, setSaving] = useState(false);
  const [showEnroll, setShowEnroll] = useState(false);
  const [analytics, setAnalytics] = useState(null);
  const [enrollments, setEnrollments] = useState(null);
  const wrapper = useRef(null);

  useEffect(() => {
    API.get('/marketing/segments').then((r) => setSegments(r.data.segments)).catch(() => {});
    API.get('/marketing/emails').then((r) => setSavedEmails(r.data.emails)).catch(() => {});
  }, []);

  useEffect(() => {
    if (!id || id === 'new') {
      // Start with a sensible skeleton
      const k1 = `n_${Date.now().toString(36)}`;
      setNodes([{ id: k1, type: 'action', position: { x: 40, y: 40 },
        data: { ntype: 'send_email', config: {} } }]);
      return;
    }
    API.get(`/marketing/flows/${id}`).then(({ data }) => {
      const f = data.flow;
      setFlowMeta({ name: f.name, description: f.description || '', trigger_type: f.trigger_type || 'manual', trigger_config: f.trigger_config || {}, status: f.status });
      const rf = graphToRf(f.graph || {});
      setNodes(rf.nodes); setEdges(rf.edges);
    }).catch(() => toast.error('Failed to load flow'));
  }, [id, setNodes, setEdges]);

  useEffect(() => {
    if (tab !== 'analytics' || !id || id === 'new') return;
    API.get(`/marketing/flows/${id}/analytics`).then((r) => setAnalytics(r.data)).catch(() => {});
  }, [tab, id]);
  useEffect(() => {
    if (tab !== 'people' || !id || id === 'new') return;
    API.get(`/marketing/flows/${id}/enrollments`).then((r) => setEnrollments(r.data.enrollments)).catch(() => {});
  }, [tab, id]);

  const onConnect = useCallback((params) => {
    setEdges((eds) => addEdge({
      ...params,
      label: params.sourceHandle && params.sourceHandle !== '__default__' ? params.sourceHandle : undefined,
      type: 'smoothstep', style: { stroke: '#A8A29E' },
      labelStyle: { fontSize: 10, fill: '#57534E' },
    }, eds));
  }, [setEdges]);

  const onDrop = useCallback((event) => {
    event.preventDefault();
    const ntype = event.dataTransfer.getData('application/flazyn-node');
    if (!ntype || !NODE_TYPES[ntype]) return;
    const position = rfInstance.screenToFlowPosition({ x: event.clientX, y: event.clientY });
    const nid = `n_${Date.now().toString(36)}${Math.floor(Math.random() * 1e4).toString(36)}`;
    setNodes((ns) => ns.concat({
      id: nid, type: 'action', position, data: { ntype, config: defaultConfig(ntype) },
    }));
    setSelectedKey(nid);
  }, [rfInstance, setNodes]);

  const selectedNode = useMemo(
    () => nodes.find((n) => n.id === selectedKey),
    [nodes, selectedKey]
  );

  const updateSelectedConfig = (patch) => {
    setNodes((ns) => ns.map((n) =>
      n.id === selectedKey ? { ...n, data: { ...n.data, config: { ...n.data.config, ...patch } } } : n));
  };
  const deleteSelected = () => {
    setNodes((ns) => ns.filter((n) => n.id !== selectedKey));
    setEdges((es) => es.filter((e) => e.source !== selectedKey && e.target !== selectedKey));
    setSelectedKey(null);
  };

  const save = async ({ silent } = {}) => {
    setSaving(true);
    try {
      const payload = {
        name: flowMeta.name.trim() || 'Untitled flow',
        description: flowMeta.description,
        trigger_type: flowMeta.trigger_type,
        trigger_config: flowMeta.trigger_config,
        graph: rfToGraph(nodes, edges),
      };
      if (id && id !== 'new') {
        await API.put(`/marketing/flows/${id}`, payload);
        return id;
      }
      const res = await API.post('/marketing/flows', payload);
      navigate(`/app/marketing/flows/${res.data.flow.id}`, { replace: true });
      return res.data.flow.id;
    } catch (err) {
      toast.error(err.response?.data?.error || 'Save failed');
      return null;
    } finally { setSaving(false); }
  };

  const setStatus = async (status) => {
    const savedId = await save({ silent: true });
    if (!savedId) return;
    try {
      await API.put(`/marketing/flows/${savedId}/status`, { status });
      setFlowMeta((m) => ({ ...m, status }));
      toast.success(status === 'live' ? 'Flow is live — it runs every minute' : `Flow ${status}`);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Could not change status');
    }
  };

  const removeFlow = async () => {
    if (!window.confirm('Delete this flow and all its enrollment history?')) return;
    try { await API.delete(`/marketing/flows/${id}`); toast.success('Deleted'); navigate('/app/marketing/flows'); }
    catch { toast.error('Delete failed'); }
  };

  const trigCfgInvalid = validateTrigger(flowMeta);

  return (
    <div className="-mx-6 -my-8 min-h-[calc(100vh-92px)] flex flex-col" style={{ background: '#FAFAF9' }}>
      {/* Top command strip */}
      <div className="hairline-b px-6 py-3 flex items-center gap-4 flex-wrap bg-white sticky top-0 z-20">
        <button onClick={() => navigate('/app/marketing/flows')} className="text-ink-tertiary hover:text-ink-primary"><X size={16} /></button>
        <input
          className="font-bold outline-none bg-transparent flex-1 min-w-[160px]"
          style={{ fontSize: '17px' }}
          placeholder="Name this flow…"
          value={flowMeta.name}
          onChange={(e) => setFlowMeta((m) => ({ ...m, name: e.target.value }))}
        />
        <span className={`badge ${flowMeta.status === 'live' ? 'badge-success' : flowMeta.status === 'paused' ? 'badge-warning' : 'badge-neutral'}`}>
          {(flowMeta.status || 'draft')}
        </span>
        <div className="flex items-center gap-2 ml-auto">
          {id !== 'new' && (
            <>
              <button onClick={() => setShowEnroll(true)} className="btn btn-secondary !min-h-0 py-1.5 text-sm">Add lead</button>
              {flowMeta.status === 'live'
                ? <button onClick={() => setStatus('paused')} className="btn btn-secondary !min-h-0 py-1.5 text-sm flex items-center gap-1.5"><Pause size={13} /> Pause</button>
                : <button onClick={() => setStatus('live')} disabled={!!trigCfgInvalid} title={trigCfgInvalid || ''}
                    className="btn !min-h-0 py-1.5 text-sm flex items-center gap-1.5 text-white" style={{ background: '#0E8A5F' }}>
                    <Play size={13} /> Go live
                  </button>}
              <button onClick={removeFlow} className="btn-danger px-2"><Trash2 size={15} /></button>
            </>
          )}
          <button onClick={() => save()} disabled={saving} className="btn btn-primary !min-h-0 py-1.5 text-sm flex items-center gap-1.5">
            <Save size={13} /> {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>

      {/* Trigger strip */}
      <div className="hairline-b px-6 py-3 flex items-start gap-4 flex-wrap" style={{ background: '#FFFFFF' }}>
        <div className="flex items-center gap-2 flex-shrink-0 mt-1">
          <span className="mono font-semibold" style={{ fontSize: '11px', color: '#4A2FD6', letterSpacing: '0.08em' }}>TRIGGER</span>
          <span className="text-ink-tertiary">when</span>
        </div>
        <select className="input sm:w-[240px]" value={flowMeta.trigger_type}
          onChange={(e) => setFlowMeta((m) => ({ ...m, trigger_type: e.target.value, trigger_config: {} }))}>
          {TRIGGER_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
        <TriggerConfig flowMeta={flowMeta} setFlowMeta={setFlowMeta} segments={segments} />
        {flowMeta.status === 'live' && (
          <span className="ml-auto self-center mono" style={{ fontSize: '12px', color: '#0E8A5F' }}>
            ● running — checks every minute
          </span>
        )}
      </div>

      {/* Tabs */}
      <div className="hairline-b px-6 flex items-center gap-5 bg-white">
        {[['build', 'Build', PencilRuler], ['people', 'People', Users], ['analytics', 'Analytics', BarChart3]].map(([v, l, Icon]) => (
          <button key={v} onClick={() => setTab(v)}
            className={`flex items-center gap-1.5 py-2.5 text-sm font-medium transition-colors ${tab === v ? 'text-ink-primary' : 'text-ink-tertiary hover:text-ink-secondary'}`}
            style={tab === v ? { borderBottom: '2px solid #EDE9FF' } : {}}>
            <Icon size={14} /> {l}
          </button>
        ))}
      </div>

      {/* Body */}
      {tab === 'build' && (
        <div className="flex-1 flex min-h-0">
          {/* Palette */}
          <div className="w-[190px] hairline-r p-3 space-y-1.5 overflow-y-auto hidden md:block flex-shrink-0">
            <p className="meta-label mb-2 px-1">Steps — drag in</p>
            {Object.entries(NODE_TYPES).map(([ntype, meta]) => (
              <div key={ntype} draggable
                onDragStart={(e) => e.dataTransfer.setData('application/flazyn-node', ntype)}
                className="flex items-center gap-2.5 p-2 bg-white cursor-grab active:cursor-grabbing hover:shadow-sm transition-shadow"
                style={{ border: '1px solid #E7E5E4', borderRadius: '8px' }}>
                <span className="flex items-center justify-center text-white font-bold text-[10px] flex-shrink-0"
                  style={{ background: meta.color, width: 22, height: 22, borderRadius: '8px' }}>{meta.glyph}</span>
                <div>
                  <p className="font-semibold leading-tight" style={{ fontSize: '12px' }}>{meta.label}</p>
                  <p className="text-ink-tertiary leading-tight" style={{ fontSize: '10px' }}>{meta.hint}</p>
                </div>
              </div>
            ))}
            <div className="pt-3 px-1">
              <p className="meta-label mb-1.5">Insert variable</p>
              <div className="flex flex-wrap gap-1">
                {LEAD_VARIABLES.slice(0, 6).map((v) => (
                  <code key={v} className="mono cursor-pointer hover:bg-canvas px-1"
                    style={{ fontSize: '10px', border: '1px solid #E7E5E4', borderRadius: '8px' }}
                    onClick={() => { navigator.clipboard.writeText(`{{${v}}}`); toast.success(`{{${v}}} copied`); }}>
                    {`{{${v}}}`}
                  </code>
                ))}
              </div>
            </div>
          </div>

          {/* Canvas */}
          <div className="flex-1 relative min-w-0" ref={wrapper}>
            <ReactFlow
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
              onDrop={onDrop}
              onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; }}
              nodeTypes={nodeTypes}
              onNodeClick={(_, n) => setSelectedKey(n.id)}
              onPaneClick={() => setSelectedKey(null)}
              fitView
              proOptions={{ hideAttribution: true }}
              defaultEdgeOptions={{ type: 'smoothstep', animated: true, style: { stroke: '#A8A29E', strokeWidth: 1.5 } }}
              deleteKeyCode={['Backspace', 'Delete']}
            >
              <Background color="#E7E5E4" gap={18} />
              <Controls showInteractive={false} />
            </ReactFlow>

            {nodes.length === 0 && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <p className="text-ink-tertiary" style={{ fontSize: '15px' }}>Drag steps from the left to build your flow</p>
              </div>
            )}

            {/* Config panel — springs in when a node is picked */}
            {selectedNode && (
              <motion.div
                initial={{ opacity: 0, x: 24, scale: 0.97 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{ opacity: 0, x: 16 }}
                transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                className="absolute top-3 right-3 w-[300px] card-raised !p-4 z-30 max-h-[80%] overflow-y-auto"
              >
                <div className="flex items-center justify-between mb-3">
                  <p className="font-bold" style={{ fontSize: '14px' }}>{NODE_TYPES[selectedNode.data.ntype]?.label}</p>
                  <div className="flex items-center gap-2">
                    <button onClick={deleteSelected} className="text-ink-tertiary hover:text-ember-deep"><Trash2 size={14} /></button>
                    <button onClick={() => setSelectedKey(null)} className="text-ink-tertiary hover:text-ink-primary"><X size={15} /></button>
                  </div>
                </div>
                <NodeConfigForm node={selectedNode} onChange={updateSelectedConfig}
                  savedEmails={savedEmails} segments={segments} />
                {selectedNode.data.ntype === 'condition' && (
                  <p className="mt-3 text-ink-tertiary" style={{ fontSize: '11px' }}>
                    Connect the green dot (yes) and red dot (no) to different paths.
                  </p>
                )}
              </motion.div>
            )}
          </div>
        </div>
      )}

      {tab === 'people' && <PeopleTab id={id} enrollments={enrollments} />}
      {tab === 'analytics' && <AnalyticsTab id={id} analytics={analytics} nodes={rfToGraph(nodes, edges).nodes} />}

      {showEnroll && <EnrollModal id={id} onClose={() => setShowEnroll(false)} onDone={() => { setShowEnroll(false); setTab('people'); }} />}
    </div>
  );
}

/* ───────────────────────── Config pieces ───────────────────────── */

function defaultConfig(ntype) {
  switch (ntype) {
    case 'wait': return { duration: 1, unit: 'days' };
    case 'condition': return { condition_type: 'email_opened' };
    case 'send_email': return {};
    default: return {};
  }
}

function validateTrigger(m) {
  switch (m.trigger_type) {
    case 'segment_entered': return m.trigger_config?.segment_id ? null : 'Pick a segment first';
    case 'stage_entered': return m.trigger_config?.stage ? null : 'Pick a stage';
    case 'tagged_with': return m.trigger_config?.tag ? null : 'Enter a tag';
    case 'days_inactive': return m.trigger_config?.days ? null : 'Set days';
    case 'source_is': return m.trigger_config?.source ? null : 'Pick a source';
    default: return null;
  }
}

function TriggerConfig({ flowMeta, setFlowMeta, segments }) {
  const cfg = flowMeta.trigger_config || {};
  const set = (patch) => setFlowMeta((m) => ({ ...m, trigger_config: { ...m.trigger_config, ...patch } }));
  switch (flowMeta.trigger_type) {
    case 'segment_entered':
      return (
        <select className="input sm:w-[260px]" value={cfg.segment_id || ''} onChange={(e) => set({ segment_id: e.target.value })}>
          <option value="">Choose segment…</option>
          {segments.map((s) => <option key={s.id} value={s.id}>{s.name}{s.live_count != null ? ` (${s.live_count})` : ''}</option>)}
        </select>
      );
    case 'stage_entered':
      return (
        <select className="input sm:w-[200px]" value={cfg.stage || ''} onChange={(e) => set({ stage: e.target.value })}>
          <option value="">Choose stage…</option>
          {STAGES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      );
    case 'tagged_with':
      return <input className="input sm:w-[200px]" placeholder="tag name" value={cfg.tag || ''} onChange={(e) => set({ tag: e.target.value })} />;
    case 'days_inactive':
      return (
        <div className="flex items-center gap-2">
          <input type="number" min="1" className="input w-[90px]" value={cfg.days ?? 7} onChange={(e) => set({ days: Number(e.target.value) })} />
          <span className="text-ink-secondary text-sm">idle days</span>
        </div>
      );
    case 'source_is':
      return (
        <select className="input sm:w-[200px]" value={cfg.source || ''} onChange={(e) => set({ source: e.target.value })}>
          <option value="">Choose source…</option>
          {SOURCES.map((s) => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
        </select>
      );
    default:
      return <span className="self-center text-ink-tertiary text-sm">— no configuration needed —</span>;
  }
}

function NodeConfigForm({ node, onChange, savedEmails, segments }) {
  const cfg = node.data.config || {};
  const t = node.data.ntype;

  if (t === 'send_email') {
    const usingSaved = !!cfg.marketing_email_id;
    return (
      <div className="space-y-3">
        <div className="flex" style={{ border: '1px solid #E7E5E4', borderRadius: '8px' }}>
          <button onClick={() => onChange({ marketing_email_id: usingSaved ? cfg.marketing_email_id : undefined })}
            className={`flex-1 py-1.5 text-xs font-semibold ${!usingSaved ? 'bg-brand text-white' : 'text-ink-secondary'}`}>Write here</button>
          <button onClick={() => onChange({ subject: usingSaved ? cfg.subject : '', body_html: undefined })}
            className={`flex-1 py-1.5 text-xs font-semibold ${usingSaved ? 'bg-brand text-white' : 'text-ink-secondary'}`}>Use saved email</button>
        </div>
        {usingSaved ? (
          <>
            <select className="input" value={cfg.marketing_email_id || ''}
              onChange={(e) => onChange({ marketing_email_id: e.target.value || undefined })}>
              <option value="">Choose a saved email…</option>
              {savedEmails.map((em) => <option key={em.id} value={em.id}>{em.name}</option>)}
            </select>
            {!savedEmails.length && <p className="text-ink-tertiary text-xs">No saved emails yet — create one under Marketing → Emails.</p>}
          </>
        ) : (
          <>
            <div>
              <p className="meta-label mb-1">Subject</p>
              <input className="input" placeholder="Hi {{First_Name}}…" value={cfg.subject || ''} onChange={(e) => onChange({ subject: e.target.value })} />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <p className="meta-label">Body (HTML)</p>
                <button className="text-xs font-semibold text-accent-deep hover:underline"
                  onClick={() => window.open('/app/marketing/emails', '_blank')}>Open builder ↗</button>
              </div>
              <textarea className="input" rows={5} placeholder="<p>Write your message…</p>"
                value={cfg.body_html || ''} onChange={(e) => onChange({ body_html: e.target.value })} />
            </div>
          </>
        )}
        <p className="text-ink-tertiary" style={{ fontSize: '11px' }}>Variables like {'{{First_Name}}'} are merged per lead at send time.</p>
      </div>
    );
  }

  if (t === 'wait') {
    return (
      <div className="space-y-3">
        <div>
          <p className="meta-label mb-1">Wait for</p>
          <div className="flex items-center gap-2">
            <input type="number" min="1" className="input w-[90px]" value={cfg.duration ?? 1}
              onChange={(e) => onChange({ duration: Math.max(1, Number(e.target.value)) })} />
            <select className="input flex-1" value={cfg.unit || 'days'} onChange={(e) => onChange({ unit: e.target.value })}>
              <option value="minutes">minutes</option><option value="hours">hours</option><option value="days">days</option>
            </select>
          </div>
        </div>
      </div>
    );
  }

  if (t === 'condition') {
    const def = CONDITION_TYPES.find((c) => c.value === cfg.condition_type);
    return (
      <div className="space-y-3">
        <div>
          <p className="meta-label mb-1">If…</p>
          <select className="input" value={cfg.condition_type || 'email_opened'}
            onChange={(e) => onChange({ condition_type: e.target.value })}>
            {CONDITION_TYPES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
        </div>
        {def?.options && (
          <select className="input" value={cfg.stage || ''} onChange={(e) => onChange({ stage: e.target.value })}>
            <option value="">Choose stage…</option>{def.options.map((s) => <option key={s}>{s}</option>)}
          </select>
        )}
        {def?.type === 'number' && (
          <input type="number" className="input" value={cfg.score ?? ''} onChange={(e) => onChange({ score: Number(e.target.value) })} placeholder="score threshold" />
        )}
        {def?.type === 'segment' && (
          <select className="input" value={cfg.segment_id || ''} onChange={(e) => onChange({ segment_id: e.target.value })}>
            <option value="">Choose segment…</option>
            {segments.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        )}
      </div>
    );
  }

  if (t === 'add_tag') return (
    <input className="input" placeholder="Tag name" value={cfg.tag || ''} onChange={(e) => onChange({ tag: e.target.value })} />
  );

  if (t === 'change_stage') return (
    <select className="input" value={cfg.stage || ''} onChange={(e) => onChange({ stage: e.target.value })}>
      <option value="">Move to stage…</option>
      {STAGES.map((s) => <option key={s} value={s}>{s}</option>)}
    </select>
  );

  if (t === 'notify_agent' || t === 'whatsapp' || t === 'sms') return (
    <textarea className="input" rows={4}
      placeholder={t === 'notify_agent' ? 'Heads up about {{First_Name}}…' : 'Hey {{First_Name}}, quick question…'}
      value={cfg.message || ''} onChange={(e) => onChange({ message: e.target.value })} />
  );

  if (t === 'exit') return <p className="text-ink-tertiary text-sm">Leads reaching this step leave the flow quietly.</p>;

  return null;
}

/* ───────────────────────── Tabs ───────────────────────── */

function PeopleTab({ id, enrollments }) {
  const nodeLabel = (key) => key || '—';
  if (!enrollments) return <div className="p-6 space-y-2">{[1,2,3,4].map(i => <div key={i} className="skeleton h-10" />)}</div>;
  if (enrollments.length === 0) return <div className="p-10 text-center text-ink-secondary">No leads have entered this flow yet.</div>;
  const badgeFor = (s) => s === 'active' ? 'badge-info' : s === 'completed' ? 'badge-success' : 'badge-neutral';
  return (
    <div className="flex-1 overflow-auto px-6 py-4">
      <table className="flazyn-table">
        <thead><tr><th>Lead</th><th>Status</th><th>Current step</th><th>Next action</th><th>Entered</th></tr></thead>
        <tbody>
          {enrollments.map((e) => (
            <tr key={e.id}>
              <td><span className="font-semibold">{e.first_name} {e.last_name}</span><br/>
                <span className="text-ink-tertiary text-xs">{e.email}</span></td>
              <td><span className={`badge ${badgeFor(e.status)}`}>{e.status}</span>
                {e.exit_reason && <span className="text-ink-tertiary text-xs block">{e.exit_reason}</span>}</td>
              <td className="mono text-xs">{nodeLabel(e.current_node_key)}</td>
              <td className="text-xs">{fmtDateTime(e.next_action_at)}</td>
              <td className="text-xs">{fmtDateTime(e.entered_at)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AnalyticsTab({ id, analytics, nodes }) {
  if (!analytics) return <div className="p-6 space-y-3">{[1,2,3].map(i => <div key={i} className="skeleton h-16" />)}</div>;
  const { totals, emails, conversion } = analytics;
  const stepCountByNode = {};
  analytics.steps.forEach((s) => {
    if (!stepCountByNode[s.node_key]) stepCountByNode[s.node_key] = { executed: 0, failed: 0 };
    if (['success', 'waiting', 'branch'].includes(s.status)) stepCountByNode[s.node_key].executed += s.count;
    if (s.status === 'failed') stepCountByNode[s.node_key].failed += s.count;
  });

  return (
    <div className="flex-1 overflow-auto px-6 py-5 space-y-8 max-w-4xl">
      <section className="grid grid-cols-2 md:grid-cols-4 gap-6">
        {[
          ['Entered', totals.entered],
          ['In progress', totals.active],
          ['Completed', totals.completed],
          ['Exited early', totals.exited],
        ].map(([l, v]) => (
          <div key={l}>
            <p className="mono" style={{ fontSize: '32px', fontWeight: 600 }}>{v ?? 0}</p>
            <p className="meta-label">{l}</p>
          </div>
        ))}
      </section>

      <section>
        <p className="meta-label mb-3">Step performance</p>
        {nodes.length === 0 ? <p className="text-ink-tertiary text-sm">Add steps to see them measured.</p> : (
          <div className="space-y-2">
            {nodes.map((n) => {
              const st = stepCountByNode[n.key] || { executed: 0, failed: 0 };
              const meta = NODE_TYPES[n.type];
              const pct = totals.entered ? Math.round((st.executed / totals.entered) * 100) : 0;
              return (
                <div key={n.key} className="flex items-center gap-4">
                  <span className="flex items-center justify-center text-white font-bold text-[10px] flex-shrink-0"
                    style={{ background: meta?.color || '#999', width: 24, height: 24, borderRadius: '8px' }}>{meta?.glyph}</span>
                  <div className="w-[130px] flex-shrink-0">
                    <p className="font-semibold truncate" style={{ fontSize: '13px' }}>{meta?.label || n.type}</p>
                    <p className="text-ink-tertiary mono" style={{ fontSize: '10px' }}>{n.key}</p>
                  </div>
                  <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: '#E7E5E4' }}>
                    <div style={{ width: `${pct}%`, height: '100%', background: '#EDE9FF' }} />
                  </div>
                  <span className="mono w-24 text-right" style={{ fontSize: '12px' }}>
                    {st.executed}/{totals.entered}
                    {st.failed > 0 && <span className="text-ember-deep"> ·{st.failed}✕</span>}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section className="grid grid-cols-3 gap-6">
        <div><p className="mono" style={{ fontSize: '26px', fontWeight: 600 }}>{emails.sent}</p><p className="meta-label">Emails sent</p></div>
        <div><p className="mono" style={{ fontSize: '26px', fontWeight: 600 }}>{emails.opened}</p><p className="meta-label">Opened</p></div>
        <div><p className="mono" style={{ fontSize: '26px', fontWeight: 600 }}>{emails.clicked}</p><p className="meta-label">Clicked</p></div>
      </section>

      <section className="hairline pt-5">
        <p className="meta-label mb-2">Conversion while in this flow</p>
        <p className="mono" style={{ fontSize: '26px', fontWeight: 600 }}>{conversion.won_leads} won · {Number(conversion.attributed_value).toLocaleString()} attributed value</p>
        <p className="text-ink-tertiary mt-1" style={{ fontSize: '12px' }}>{conversion.note}</p>
      </section>
    </div>
  );
}

/* ───────────────────────── Manual enroll ───────────────────────── */

function EnrollModal({ id, onClose, onDone }) {
  const [q, setQ] = useState('');
  const [leads, setLeads] = useState(null);
  const [picked, setPicked] = useState(new Set());

  useEffect(() => {
    const t = setTimeout(async () => {
      try {
        const r = await API.get(`/leads?search=${encodeURIComponent(q)}&limit=25`);
        setLeads(r.data.leads || r.data);
      } catch { setLeads([]); }
    }, 250);
    return () => clearTimeout(t);
  }, [q]);

  const enroll = async () => {
    try {
      await API.post(`/marketing/flows/${id}/enroll`, { lead_ids: [...picked] });
      toast.success(`${picked.size} lead(s) enrolled`);
      onDone();
    } catch (err) { toast.error(err.response?.data?.error || 'Enrollment failed'); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(28,25,23,0.25)' }} onClick={onClose}>
      <div className="card-raised w-full max-w-md animate-scale-in !p-0" onClick={(e) => e.stopPropagation()}>
        <div className="px-5 pt-4 pb-3 hairline-b">
          <h3 className="font-bold" style={{ fontSize: '16px' }}>Add leads to this flow</h3>
          <p className="text-ink-tertiary mt-0.5" style={{ fontSize: '12px' }}>They start from the first step immediately.</p>
        </div>
        <div className="px-5 py-3">
          <input autoFocus className="input" placeholder="Search leads…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div className="max-h-72 overflow-y-auto px-5 pb-3 space-y-1">
          {!leads ? <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="skeleton h-9" />)}</div> :
            leads.length === 0 ? <p className="text-sm text-ink-tertiary py-4 text-center">No matches.</p> :
            leads.map((l) => (
              <label key={l.id} className="flex items-center gap-3 py-1.5 cursor-pointer hover-accent-left px-1">
                <input type="checkbox" checked={picked.has(l.id)}
                  onChange={(e) => {
                    const next = new Set(picked);
                    e.target.checked ? next.add(l.id) : next.delete(l.id);
                    setPicked(next);
                  }} />
                <span className="flex-1 text-sm font-medium">{l.first_name} {l.last_name}</span>
                <span className="text-ink-tertiary text-xs capitalize">{l.stage}</span>
              </label>
            ))}
        </div>
        <div className="flex justify-end gap-3 px-5 py-3 hairline-t">
          <button onClick={onClose} className="btn-ghost text-sm font-medium">Cancel</button>
          <button onClick={enroll} disabled={picked.size === 0} className="btn btn-primary !py-1.5 text-sm flex items-center gap-1.5">
            <Send size={13} /> Enroll {picked.size || ''}
          </button>
        </div>
      </div>
    </div>
  );
}
