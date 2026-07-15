import { useState, useEffect } from 'react';
import API from '../lib/api';
import toast from 'react-hot-toast';
import { Plus, Trash2, X, Play, Copy } from 'lucide-react';
import ReactFlow, { Background, Controls, MiniMap, addEdge, Handle, Position } from 'reactflow';
import 'reactflow/dist/style.css';

export default function EmailFlows() {
  const [flows, setFlows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState(null);

  useEffect(() => { loadFlows(); }, []);

  const loadFlows = async () => {
    try { const res = await API.get('/emails/flows'); setFlows(res.data.flows); }
    catch { toast.error('Failed to load flows'); }
    finally { setLoading(false); }
  };

  const handleCreate = async (data) => {
    try { await API.post('/emails/flows', data); toast.success('Flow created'); setShowCreate(false); loadFlows(); }
    catch { toast.error('Create failed'); }
  };

  const handlePublish = async (id) => {
    try { await API.post(`/emails/flows/${id}/publish`); toast.success('Flow published'); loadFlows(); }
    catch { toast.error('Publish failed'); }
  };

  if (editing) return <FlowBuilder flow={editing} onBack={() => { setEditing(null); loadFlows(); }} />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-dark-900">Email Flows</h1>
        <button onClick={() => setShowCreate(true)} className="btn btn-primary flex items-center gap-2"><Plus size={16} /> New Flow</button>
      </div>

      {loading ? <div className="flex justify-center py-8"><div className="animate-spin w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full" /></div> :
        flows.length === 0 ? <div className="card text-center py-12 text-dark-400"><p>No flows yet. Create a visual email flow!</p></div> :
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {flows.map(f => (
            <div key={f.id} className="card">
              <h3 className="font-semibold text-dark-900">{f.name}</h3>
              <p className="text-sm text-dark-400 mt-1">{f.description || 'No description'}</p>
              <div className="flex gap-2 mt-3">
                {f.is_published ? <span className="badge bg-green-100 text-green-700">Published</span> : <span className="badge bg-amber-100 text-amber-700">Draft</span>}
                {f.is_active && <span className="badge bg-blue-100 text-blue-700">Active</span>}
              </div>
              <div className="flex gap-2 mt-4">
                <button onClick={() => setEditing(f)} className="btn btn-secondary flex-1 text-sm py-1.5">Edit Flow</button>
                {!f.is_published && <button onClick={() => handlePublish(f.id)} className="btn btn-primary flex-1 text-sm py-1.5"><Play size={14} /> Publish</button>}
              </div>
            </div>
          ))}
        </div>
      }

      {showCreate && <CreateFlowModal onClose={() => setShowCreate(false)} onSave={handleCreate} />}
    </div>
  );
}

function CreateFlowModal({ onClose, onSave }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl p-6 w-full max-w-md">
        <div className="flex items-center justify-between mb-4"><h2 className="text-xl font-bold">New Email Flow</h2><button onClick={onClose}><X size={20} /></button></div>
        <div className="space-y-3">
          <input className="input" placeholder="Flow name" value={name} onChange={(e) => setName(e.target.value)} />
          <textarea className="input" rows="2" placeholder="Description" value={description} onChange={(e) => setDescription(e.target.value)} />
          <div className="flex gap-2"><button onClick={onClose} className="btn btn-secondary flex-1">Cancel</button><button onClick={() => onSave({ name, description, nodes: [], edges: [] })} className="btn btn-primary flex-1">Create</button></div>
        </div>
      </div>
    </div>
  );
}

function FlowBuilder({ flow, onBack }) {
  const [nodes, setNodes] = useState([]);
  const [edges, setEdges] = useState([]);
  const [nodeType, setNodeType] = useState('send_email');

  useEffect(() => { loadFlow(); }, []);

  const loadFlow = async () => {
    try {
      const res = await API.get(`/emails/flows/${flow.id}`);
      const flowNodes = (res.data.nodes || []).map(n => ({
        id: n.node_key, type: 'default', position: { x: n.position_x, y: n.position_y },
        data: { label: `${n.node_type}` },
      }));
      const flowEdges = (res.data.edges || []).map(e => ({
        id: `${e.source_node_key}-${e.target_node_key}`, source: e.source_node_key, target: e.target_node_key, label: e.condition_label,
      }));
      if (flowNodes.length === 0) {
        flowNodes.push({ id: 'start', type: 'input', position: { x: 250, y: 50 }, data: { label: 'Start' } });
      }
      setNodes(flowNodes); setEdges(flowEdges);
    } catch { toast.error('Failed to load flow'); }
  };

  const onConnect = (params) => setEdges(addEdge(params, edges));

  const addNode = () => {
    const id = `node_${Date.now()}`;
    setNodes([...nodes, { id, type: 'default', position: { x: Math.random() * 400, y: Math.random() * 300 + 100 }, data: { label: nodeType } }]);
  };

  const save = async () => {
    try {
      const formattedNodes = nodes.map(n => ({ key: n.id, type: n.data.label, position: n.position, config: {} }));
      const formattedEdges = edges.map(e => ({ source: e.source, target: e.target, condition: e.label }));
      await API.put(`/emails/flows/${flow.id}`, { name: flow.name, nodes: formattedNodes, edges: formattedEdges, is_published: false });
      toast.success('Flow saved');
    } catch { toast.error('Save failed'); }
  };

  return (
    <div className="space-y-4 h-full flex flex-col">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="btn btn-secondary">Back</button>
          <h1 className="text-2xl font-bold">{flow.name}</h1>
        </div>
        <div className="flex gap-2">
          <select value={nodeType} onChange={(e) => setNodeType(e.target.value)} className="input w-auto">
            <option value="send_email">Send Email</option><option value="wait">Wait</option>
            <option value="add_tag">Add Tag</option><option value="change_stage">Change Stage</option>
            <option value="notify_agent">Notify Agent</option><option value="send_whatsapp">Send WhatsApp</option>
            <option value="send_sms">Send SMS</option><option value="condition">Condition (IF/ELSE)</option>
          </select>
          <button onClick={addNode} className="btn btn-secondary"><Plus size={16} /> Add Node</button>
          <button onClick={save} className="btn btn-primary">Save Flow</button>
        </div>
      </div>
      <div className="flex-1 bg-white rounded-xl border border-dark-100 overflow-hidden">
        <ReactFlow nodes={nodes} edges={edges} onConnect={onConnect} fitView>
          <Background /><Controls /><MiniMap />
        </ReactFlow>
      </div>
    </div>
  );
}
