import { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { Mic, Square, X, FileText, Upload, Sparkles, Loader2 } from 'lucide-react';
import API from '../lib/api';

/* Voice-to-CRM, meeting brief and call intelligence: small, self-contained tools
   used on the lead page. Recording happens in the browser (MediaRecorder). */

function useRecorder() {
  const [recording, setRecording] = useState(false);
  const [blob, setBlob] = useState(null);
  const [seconds, setSeconds] = useState(0);
  const rec = useRef(null);
  const timer = useRef(null);
  const start = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const chunks = [];
      const r = new MediaRecorder(stream);
      r.ondataavailable = (e) => e.data.size && chunks.push(e.data);
      r.onstop = () => { setBlob(new Blob(chunks, { type: r.mimeType || 'audio/webm' })); stream.getTracks().forEach((t) => t.stop()); };
      r.start();
      rec.current = r;
      setBlob(null); setSeconds(0); setRecording(true);
      timer.current = setInterval(() => setSeconds((s) => s + 1), 1000);
    } catch { toast.error('Microphone not available. Allow microphone access, or type the note.'); }
  };
  const stop = () => { rec.current?.stop(); setRecording(false); clearInterval(timer.current); };
  useEffect(() => () => { clearInterval(timer.current); if (rec.current?.state === 'recording') rec.current.stop(); }, []);
  return { recording, blob, seconds, start, stop, reset: () => setBlob(null) };
}

function Sheet({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(28,25,23,0.25)' }} onClick={onClose}>
      <div className="card-raised w-full" style={{ maxWidth: 520, maxHeight: '90vh', overflowY: 'auto' }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <p style={{ fontSize: 17, fontWeight: 700 }}>{title}</p>
          <button onClick={onClose} className="row-action"><X size={18} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ── 13. Voice-to-CRM ──
export function VoiceNoteButton({ leadId, onDone }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)} className="btn btn-secondary btn-sm"><Mic size={15} /> Voice note</button>
      {open && <VoiceNoteSheet leadId={leadId} onClose={() => setOpen(false)} onDone={onDone} />}
    </>
  );
}

function VoiceNoteSheet({ leadId, onClose, onDone }) {
  const { recording, blob, seconds, start, stop, reset } = useRecorder();
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const submit = async () => {
    setBusy(true);
    try {
      const form = new FormData();
      if (blob) form.append('audio', blob, 'note.webm'); else form.append('text', text);
      const r = await API.post(`/intel/leads/${leadId}/voice`, form, { timeout: 120000 });
      setResult(r.data);
      onDone?.();
    } catch (err) { toast.error(err.response?.data?.error || 'Could not save the note'); }
    finally { setBusy(false); }
  };
  return (
    <Sheet title="Voice note" onClose={onClose}>
      {result ? (
        <div>
          <p style={{ fontWeight: 600 }}>{result.summary}</p>
          {result.applied?.length > 0 && <ul className="mt-2">{result.applied.map((a) => <li key={a} style={{ fontSize: 13.5, color: '#047857' }}>✓ {a}</li>)}</ul>}
          {result.transcript && blob && <p className="mt-3" style={{ fontSize: 12.5, color: 'var(--ink-3)' }}>Heard: "{result.transcript}"</p>}
          <button onClick={onClose} className="btn btn-primary w-full mt-4">Done</button>
        </div>
      ) : (
        <>
          <p style={{ fontSize: 13.5, color: 'var(--ink-2)' }}>Say what happened, e.g. <i>"Spoke to Sara, she's keen, call her Thursday at 2pm, budget around 600k."</i> Flazyn updates the stage, budget and follow-up for you.</p>
          <div className="flex flex-col items-center my-5">
            <button onClick={recording ? stop : start} className="flex items-center justify-center" style={{ width: 76, height: 76, borderRadius: 999, background: recording ? '#F59E0B' : 'var(--brand)', color: '#fff', boxShadow: recording ? '0 0 0 8px rgba(245,158,11,0.18)' : '0 10px 24px -10px rgba(91,61,245,0.7)' }}>
              {recording ? <Square size={26} fill="#fff" /> : <Mic size={30} />}
            </button>
            <p style={{ fontSize: 13, marginTop: 10, color: 'var(--ink-2)' }}>{recording ? `Recording… ${seconds}s (tap to stop)` : blob ? `Recorded ${seconds}s` : 'Tap to record'}</p>
            {blob && !recording && <button onClick={reset} style={{ fontSize: 12.5, color: 'var(--ink-3)', marginTop: 4 }}>Record again</button>}
          </div>
          {!blob && (
            <textarea className="input" rows={3} placeholder="…or type the note here" value={text} onChange={(e) => setText(e.target.value)} />
          )}
          <button onClick={submit} disabled={busy || recording || (!blob && !text.trim())} className="btn btn-primary w-full mt-3">
            {busy ? <><Loader2 size={15} className="animate-spin" /> Updating lead…</> : 'Update lead'}
          </button>
        </>
      )}
    </Sheet>
  );
}

// ── 9. Meeting brief ──
export function BriefButton({ leadId, className = 'btn btn-secondary btn-sm' }) {
  const [brief, setBrief] = useState(null);
  const [busy, setBusy] = useState(false);
  const run = async () => {
    setBusy(true);
    try { const r = await API.post(`/intel/leads/${leadId}/brief`); setBrief(r.data); }
    catch { toast.error('Could not prepare a brief'); }
    finally { setBusy(false); }
  };
  return (
    <>
      <button onClick={run} disabled={busy} className={className}>{busy ? <Loader2 size={15} className="animate-spin" /> : <FileText size={15} />} Brief me</button>
      {brief && (
        <Sheet title="Before you call" onClose={() => setBrief(null)}>
          <p style={{ fontSize: 14.5, lineHeight: 1.6 }}>{brief.summary}</p>
          <div className="stat-tile mt-4"><p className="label">Likely objection</p><p style={{ fontWeight: 700, marginTop: 2 }}>{brief.likely_objection}</p><p style={{ fontSize: 13, color: 'var(--ink-2)', marginTop: 4 }}>{brief.how_to_handle}</p></div>
          {brief.opener && <div className="stat-tile mt-3"><p className="label">Open with</p><p style={{ marginTop: 2 }}>"{brief.opener}"</p></div>}
          {brief.personality?.tip && <div className="stat-tile mt-3"><p className="label">{brief.personality.label}</p><p style={{ fontSize: 13, marginTop: 2 }}>{brief.personality.tip}</p></div>}
          {brief.predicted_value && <p style={{ fontSize: 12.5, color: 'var(--ink-3)', marginTop: 12 }}>Likely deal size: ${Number(brief.predicted_value).toLocaleString('en-AU')}</p>}
        </Sheet>
      )}
    </>
  );
}

// ── 3. Call intelligence ──
export function CallAnalyzer({ leadId, onDone }) {
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState(null);
  const [transcript, setTranscript] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const { recording, blob, seconds, start, stop } = useRecorder();
  const submit = async () => {
    setBusy(true);
    try {
      const form = new FormData();
      if (file) form.append('audio', file);
      else if (blob) { form.append('audio', blob, 'call.webm'); form.append('duration', String(seconds)); }
      else form.append('transcript', transcript);
      const r = await API.post(`/intel/leads/${leadId}/calls/analyze`, form, { timeout: 180000 });
      setResult(r.data.analysis);
      onDone?.();
    } catch (err) { toast.error(err.response?.data?.error || 'Could not analyse the call'); }
    finally { setBusy(false); }
  };
  const close = () => { setOpen(false); setResult(null); setFile(null); setTranscript(''); };
  return (
    <>
      <button onClick={() => setOpen(true)} className="btn btn-secondary btn-sm"><Sparkles size={15} /> Analyse a call</button>
      {open && (
        <Sheet title="Call intelligence" onClose={close}>
          {result ? <CallAnalysis a={result} /> : (
            <>
              <p style={{ fontSize: 13.5, color: 'var(--ink-2)' }}>Upload the call recording, record it on speaker, or paste a transcript. You'll get talk time, objections and a one-line debrief.</p>
              <label className="flex items-center gap-2 btn btn-secondary w-full mt-4" style={{ cursor: 'pointer' }}>
                <Upload size={15} /> {file ? file.name : 'Upload recording (mp3, m4a, wav)'}
                <input type="file" accept="audio/*,.m4a,.mp3,.wav,.webm,.ogg" hidden onChange={(e) => setFile(e.target.files?.[0] || null)} />
              </label>
              <button onClick={recording ? stop : start} className="btn btn-secondary w-full mt-2">
                {recording ? <><Square size={14} /> Stop ({seconds}s)</> : blob ? `Recorded ${seconds}s · record again` : <><Mic size={15} /> Record call on speaker</>}
              </button>
              <textarea className="input mt-2" rows={4} placeholder={'…or paste a transcript\nAgent: Hi Sara…\nLead: It feels expensive…'} value={transcript} onChange={(e) => setTranscript(e.target.value)} />
              <button onClick={submit} disabled={busy || recording || (!file && !blob && !transcript.trim())} className="btn btn-primary w-full mt-3">
                {busy ? <><Loader2 size={15} className="animate-spin" /> Analysing…</> : 'Analyse call'}
              </button>
            </>
          )}
        </Sheet>
      )}
    </>
  );
}

export function CallAnalysis({ a }) {
  if (!a) return null;
  return (
    <div>
      <p style={{ fontWeight: 700, fontSize: 15 }}>{a.debrief}</p>
      {a.talk_ratio && (
        <div className="mt-3">
          <div className="flex justify-between" style={{ fontSize: 12.5, color: 'var(--ink-2)' }}><span>You {a.talk_ratio.agent}%</span><span>Lead {a.talk_ratio.lead}%</span></div>
          <div className="flex mt-1" style={{ height: 8, borderRadius: 99, overflow: 'hidden', background: 'var(--canvas-alt)' }}>
            <span style={{ width: `${a.talk_ratio.agent}%`, background: 'var(--brand)' }} />
            <span style={{ width: `${a.talk_ratio.lead}%`, background: '#10B981' }} />
          </div>
          {a.talk_ratio.agent > 65 && <p style={{ fontSize: 12.5, color: '#92400E', marginTop: 4 }}>You did most of the talking. Aim for under 60% and ask more questions.</p>}
        </div>
      )}
      {a.objections?.length > 0 && <p className="mt-3" style={{ fontSize: 13.5 }}><b>Objections:</b> {a.objections.join(', ')}</p>}
      {a.next_step && <p className="mt-1" style={{ fontSize: 13.5 }}><b>Next step:</b> {a.next_step}</p>}
      {a.coaching && <p className="mt-1" style={{ fontSize: 13.5 }}><b>Tip:</b> {a.coaching}</p>}
    </div>
  );
}
