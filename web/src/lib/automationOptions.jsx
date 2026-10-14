import { useEffect, useState } from 'react';
import API from './api';

// Option lists shared by the automation editors (rules, distribution, chat assistant),
// so users pick real agents / stages / files instead of typing IDs.

export function useAutomationOptions() {
  const [members, setMembers] = useState([]);
  const [stages, setStages] = useState([]);
  const [files, setFiles] = useState([]);
  const [sequences, setSequences] = useState([]);

  useEffect(() => {
    let alive = true;
    // /team includes the current user; agents without manager rights fall back to the mail directory.
    API.get('/team')
      .then((r) => alive && setMembers((r.data.members || []).filter((m) => m.status === 'active')))
      .catch(() => API.get('/flazyn-mail/team-members')
        .then((r) => alive && setMembers(r.data.members || []))
        .catch(() => {}));
    API.get('/leads/stages')
      .then((r) => alive && setStages(r.data.stages || []))
      .catch(() => {});
    API.get('/content')
      .then((r) => alive && setFiles(r.data.files || []))
      .catch(() => {});
    API.get('/whatsapp/sequences')
      .then((r) => alive && setSequences((r.data.sequences || []).filter((sq) => sq.is_active !== false)))
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  return { members, stages, files, sequences };
}

export function memberLabel(m) {
  const name = [m.first_name, m.last_name].filter(Boolean).join(' ');
  return name ? `${name} · ${m.email}` : m.email;
}

/** Value input that adapts to the action: agent picker, stage picker, file picker or free text. */
export function ActionValueField({ kind, value, onChange, options, placeholder }) {
  const { members, stages, files, sequences = [] } = options;
  if (kind === 'agent') {
    return (
      <select className="input flex-1" value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">Choose a team member…</option>
        {members.map((m) => <option key={m.id} value={m.email}>{memberLabel(m)}</option>)}
      </select>
    );
  }
  if (kind === 'stage') {
    return (
      <select className="input flex-1" value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">Choose a stage…</option>
        {stages.map((s) => <option key={s.id} value={s.name}>{s.name}</option>)}
      </select>
    );
  }
  if (kind === 'file') {
    return (
      <select className="input flex-1" value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">Choose a file…</option>
        {files.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
      </select>
    );
  }
  if (kind === 'sequence') {
    return (
      <select className="input flex-1" value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">{sequences.length ? 'Choose a WhatsApp sequence…' : 'No active sequences yet'}</option>
        {sequences.map((sq) => <option key={sq.id} value={sq.id}>{sq.name}</option>)}
      </select>
    );
  }
  if (kind === 'message') {
    return (
      <textarea className="input flex-1" rows={3} placeholder={placeholder || 'Hi {{First_Name}}, thanks for reaching out!'}
        value={value} onChange={(e) => onChange(e.target.value)} />
    );
  }
  return <input className="input flex-1" placeholder={placeholder || 'Value'} value={value} onChange={(e) => onChange(e.target.value)} />;
}
