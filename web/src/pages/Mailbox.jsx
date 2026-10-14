import { useState, useEffect, useRef } from 'react';
import API from '../lib/api';
import { SectionTabs } from '../lib/motion';
import toast from 'react-hot-toast';
import {
  Star, Archive, Search, Plus, X,
  Reply, Forward, Paperclip, ChevronLeft, Mail, Send, FileEdit, Trash2, Inbox
} from 'lucide-react';

export default function Mailbox() {
  const [folder, setFolder] = useState('inbox');
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [selectedThread, setSelectedThread] = useState(null);
  const [threadMessages, setThreadMessages] = useState([]);
  const [showCompose, setShowCompose] = useState(false);
  const [teamMembers, setTeamMembers] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    loadMessages();
    loadUnreadCount();
  }, [folder, search]);

  useEffect(() => {
    loadTeamMembers();
  }, []);

  const loadMessages = async () => {
    setLoading(true);
    try {
      const params = search ? { search } : {};
      const res = await API.get(`/flazyn-mail/mailbox/${folder}`, { params });
      setMessages(res.data.messages || []);
    } catch {
      toast.error('Failed to load messages');
    } finally {
      setLoading(false);
    }
  };

  const loadUnreadCount = async () => {
    try {
      const res = await API.get('/flazyn-mail/unread-count');
      setUnreadCount(res.data.unreadCount || 0);
    } catch {}
  };

  const loadTeamMembers = async () => {
    try {
      const res = await API.get('/flazyn-mail/team-members');
      setTeamMembers(res.data.members || []);
    } catch {}
  };

  const handleSearch = (e) => {
    e.preventDefault();
    setSearch(searchInput);
  };

  const openThread = async (msg) => {
    try {
      const res = await API.get(`/flazyn-mail/thread/${msg.thread_id}`);
      setThreadMessages(res.data.thread || []);
      setSelectedThread(msg.thread_id);
      const unread = (res.data.thread || []).filter(m => m.to_user_id && !m.is_read);
      for (const m of unread) {
        await API.put(`/flazyn-mail/mark-read/${m.id}`);
      }
      loadUnreadCount();
      loadMessages();
    } catch {
      toast.error('Failed to load thread');
    }
  };

  const handleStar = async (msgId, e) => {
    e.stopPropagation();
    try {
      await API.put(`/flazyn-mail/toggle-star/${msgId}`);
      loadMessages();
      if (selectedThread) {
        const res = await API.get(`/flazyn-mail/thread/${selectedThread}`);
        setThreadMessages(res.data.thread || []);
      }
    } catch {
      toast.error('Failed to update star');
    }
  };

  const handleTrash = async (msgId, e) => {
    e.stopPropagation();
    try {
      await API.put(`/flazyn-mail/trash/${msgId}`);
      loadMessages();
      loadUnreadCount();
      toast.success('Moved to trash');
    } catch {
      toast.error('Failed to move to trash');
    }
  };

  const handleArchive = async (msgId, e) => {
    e.stopPropagation();
    try {
      await API.put(`/flazyn-mail/archive/${msgId}`);
      loadMessages();
      toast.success('Archived');
    } catch {
      toast.error('Failed to archive');
    }
  };

  const handleRestore = async (msgId, e) => {
    e.stopPropagation();
    try {
      await API.put(`/flazyn-mail/restore/${msgId}`);
      loadMessages();
      toast.success('Restored');
    } catch {
      toast.error('Failed to restore');
    }
  };

  const handleDelete = async (msgId, e) => {
    e.stopPropagation();
    if (!confirm('Permanently delete this message?')) return;
    try {
      await API.delete(`/flazyn-mail/${msgId}`);
      loadMessages();
      toast.success('Deleted');
    } catch {
      toast.error('Failed to delete');
    }
  };

  const folders = [
    { key: 'inbox', label: 'Inbox' },
    { key: 'sent', label: 'Sent' },
    { key: 'drafts', label: 'Drafts' },
    { key: 'starred', label: 'Starred' },
    { key: 'archive', label: 'Archive' },
    { key: 'trash', label: 'Trash' },
  ];

  if (selectedThread) {
    return (
      <ThreadView
        threadId={selectedThread}
        messages={threadMessages}
        onBack={() => { setSelectedThread(null); setThreadMessages([]); loadMessages(); }}
        onStar={handleStar}
        onTrash={handleTrash}
        onArchive={handleArchive}
        teamMembers={teamMembers}
        onSent={() => { setSelectedThread(null); setThreadMessages([]); loadMessages(); loadUnreadCount(); }}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Header — editorial */}
      <div className="flex items-baseline justify-between flex-wrap gap-4">
        <div className="flex items-baseline gap-3">
          <h1 className="text-ink-primary" style={{ fontSize: '32px', fontWeight: 650, letterSpacing: '-0.01em' }}>Mail</h1>
          {unreadCount > 0 && <span className="mono text-ink-secondary" style={{ fontSize: '14px' }}>{unreadCount} unread</span>}
        </div>
        <button onClick={() => setShowCompose(true)} className="text-ink-primary hover:text-accent-deep underline underline-offset-4 transition-colors" style={{ fontSize: '15px', fontWeight: 600 }}>
          Compose
        </button>
      </div>

      {/* Folder tabs — pinned secondary bar with scoped search on the right */}
      <SectionTabs
        layoutId="mail-tabs"
        tabs={folders.map((f) => ({ key: f.key, label: f.key === 'inbox' && unreadCount > 0 ? `${f.label}  ${unreadCount}` : f.label }))}
        active={folder}
        onChange={(k) => { setFolder(k); setSearch(''); setSearchInput(''); }}
        right={
          <form onSubmit={handleSearch} className="flex items-center gap-2">
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search mail…"
              className="input"
              style={{ fontSize: '13px', width: '180px', height: '30px' }}
            />
          </form>
        }
      />

      {/* Messages — hairline rows, no card */}
      <div>
        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3, 4, 5].map((i) => <div key={i} className="skeleton h-12" />)}
          </div>
        ) : messages.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-ink-primary" style={{ fontSize: '22px', fontWeight: 600 }}>No messages in {folder}.</p>
            <p className="text-ink-secondary mt-2" style={{ fontSize: '15px' }}>Messages from your team will appear here.</p>
          </div>
        ) : (
          <div>
            {messages.map(msg => (
              <div
                key={msg.id}
                onClick={() => openThread(msg)}
                className="group hairline-b py-3 flex items-start gap-3 cursor-pointer hover-accent-left transition-all"
              >
                {/* Star */}
                <button
                  onClick={(e) => handleStar(msg.id, e)}
                  className="mt-1 flex-shrink-0 transition-colors"
                >
                  <Star
                    size={14}
                    className={msg.is_starred ? 'text-accent-deep fill-accent-orange' : 'text-ink-tertiary hover:text-accent-deep'}
                  />
                </button>

                {/* Unread dot */}
                {!msg.is_read && folder === 'inbox' && (
                  <span className="mt-1.5 w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: '#EDE9FF' }} />
                )}

                {/* Monogram square */}
                <span
                  className="flex items-center justify-center  flex-shrink-0"
                  style={{ background: '#F5F5F4', color: '#1C1917', width: '28px', height: '28px', borderRadius: '10px', fontSize: '11px', fontWeight: 700 }}
                >
                  {(msg.from_first_name || '?')[0]}
                </span>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2">
                    <p
                      className="truncate"
                      style={{
                        fontSize: '14px',
                        fontWeight: !msg.is_read ? 600 : 400,
                        color: !msg.is_read ? '#1C1917' : '#57534E',
                      }}
                    >
                      {folder === 'sent' || folder === 'drafts'
                        ? `To: ${msg.to_first_name || ''} ${msg.to_last_name || ''}`
                        : `${msg.from_first_name || ''} ${msg.from_last_name || ''}`}
                    </p>
                    <span className="text-ink-tertiary mono ml-auto flex-shrink-0" style={{ fontSize: '12px' }}>
                      {formatDate(msg.created_at)}
                    </span>
                  </div>
                  <p
                    className="truncate mt-0.5"
                    style={{
                      fontSize: '14px',
                      fontWeight: !msg.is_read ? 600 : 400,
                      color: !msg.is_read ? '#1C1917' : '#57534E',
                    }}
                  >
                    {msg.subject || '(no subject)'}
                  </p>
                  <p className="text-ink-tertiary truncate mt-0.5" style={{ fontSize: '13px' }}>
                    {msg.body?.replace(/<[^>]*>/g, '').substring(0, 80) || ''}
                  </p>
                  {msg.attachments && msg.attachments.length > 0 && (
                    <div className="flex items-center gap-1 mt-1">
                      <Paperclip size={11} className="text-ink-tertiary" />
                      <span className="text-ink-tertiary" style={{ fontSize: '12px' }}>{msg.attachments.length} attachment{msg.attachments.length > 1 ? 's' : ''}</span>
                    </div>
                  )}
                </div>

                {/* Hover actions — text links, no buttons */}
                <div className="flex items-center gap-3 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 mt-1">
                  {folder === 'trash' ? (
                    <>
                      <button onClick={(e) => handleRestore(msg.id, e)} className="text-ink-tertiary hover:text-ink-primary transition-colors" style={{ fontSize: '13px' }}>Restore</button>
                      <button onClick={(e) => handleDelete(msg.id, e)} className="text-ink-tertiary hover:text-ink-primary transition-colors" style={{ fontSize: '13px' }}>Delete</button>
                    </>
                  ) : (
                    <>
                      <button onClick={(e) => handleArchive(msg.id, e)} className="text-ink-tertiary hover:text-ink-primary transition-colors" style={{ fontSize: '13px' }}>Archive</button>
                      <button onClick={(e) => handleTrash(msg.id, e)} className="text-ink-tertiary hover:text-ink-primary transition-colors" style={{ fontSize: '13px' }}>Trash</button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showCompose && (
        <ComposeModal
          onClose={() => setShowCompose(false)}
          teamMembers={teamMembers}
          onSent={() => { setShowCompose(false); loadMessages(); loadUnreadCount(); }}
          prefillRecipient={null}
        />
      )}
    </div>
  );
}

function ThreadView({ threadId, messages, onBack, onStar, onTrash, onArchive, teamMembers, onSent }) {
  const [showReply, setShowReply] = useState(false);
  const [showReplyAll, setShowReplyAll] = useState(false);
  const [showForward, setShowForward] = useState(false);

  const lastMessage = messages[messages.length - 1];
  const subject = messages[0]?.subject || '(no subject)';

  return (
    <div className="space-y-6">
      {/* Header — text links, no card */}
      <div className="hairline pb-4 flex items-center gap-4">
        <button onClick={onBack} className="text-ink-secondary hover:text-ink-primary transition-colors flex items-center gap-1.5" style={{ fontSize: '14px' }}>
          <ChevronLeft size={14} /> Mail
        </button>
        <h1 className="text-ink-primary truncate flex-1" style={{ fontSize: '22px', fontWeight: 600 }}>{subject}</h1>
        <div className="flex items-center gap-4">
          <button onClick={(e) => onStar(lastMessage?.id, e)} className="text-ink-tertiary hover:text-ink-primary transition-colors">
            <Star size={16} className={lastMessage?.is_starred ? 'text-accent-deep fill-accent-orange' : ''} />
          </button>
          <button onClick={(e) => onArchive(lastMessage?.id, e)} className="text-ink-tertiary hover:text-ink-primary transition-colors" style={{ fontSize: '14px' }}>Archive</button>
          <button onClick={(e) => onTrash(lastMessage?.id, e)} className="text-ink-tertiary hover:text-ink-primary transition-colors" style={{ fontSize: '14px' }}>Trash</button>
        </div>
      </div>

      {/* Thread messages — hairline separated, no cards */}
      <div className="space-y-0">
        {messages.map((msg, idx) => (
          <div key={msg.id} className="hairline-b py-5">
            <div className="flex items-start gap-3 mb-3">
              {/* Monogram square */}
              <span
                className="flex items-center justify-center  flex-shrink-0"
                style={{ background: '#F5F5F4', color: '#1C1917', width: '32px', height: '32px', borderRadius: '10px', fontSize: '13px', fontWeight: 700 }}
              >
                {(msg.from_first_name || '?')[0]}
              </span>
              <div className="flex-1">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <p className="text-ink-primary font-semibold" style={{ fontSize: '15px' }}>
                    {msg.from_first_name} {msg.from_last_name}
                  </p>
                  <span className="text-ink-tertiary mono" style={{ fontSize: '12px' }}>
                    {new Date(msg.created_at).toLocaleString()}
                  </span>
                </div>
                <p className="text-ink-tertiary mt-0.5" style={{ fontSize: '13px' }}>
                  To: {msg.to_first_name} {msg.to_last_name}
                  <span className="ml-1">&lt;{(msg.to_first_name || '').toLowerCase()}.{(msg.to_last_name || '').toLowerCase()}@flazyn.internal&gt;</span>
                </p>
              </div>
            </div>
            <div className="text-ink-secondary leading-relaxed whitespace-pre-wrap pl-11" style={{ fontSize: '14px' }}>
              {msg.body}
            </div>
            {msg.attachments && msg.attachments.length > 0 && (
              <div className="mt-4 pl-11 space-y-2">
                {msg.attachments.map(att => (
                  <a
                    key={att.id}
                    href={att.file_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hairline-b py-2 flex items-center gap-2 hover:text-ink-primary transition-colors"
                  >
                    <Paperclip size={12} className="text-ink-tertiary" />
                    <span className="text-ink-primary" style={{ fontSize: '14px', fontWeight: 500 }}>{att.file_name}</span>
                    <span className="text-ink-tertiary mono ml-auto" style={{ fontSize: '12px' }}>
                      {(att.file_size / 1024).toFixed(1)} KB
                    </span>
                  </a>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Reply actions — text links */}
      {!showReply && !showReplyAll && !showForward && (
        <div className="flex gap-5 pt-2">
          <button onClick={() => setShowReply(true)} className="text-ink-primary hover:text-accent-deep underline underline-offset-4 transition-colors flex items-center gap-1.5" style={{ fontSize: '15px', fontWeight: 600 }}>
            <Reply size={14} /> Reply
          </button>
          <button onClick={() => setShowReplyAll(true)} className="text-ink-secondary hover:text-ink-primary underline underline-offset-4 transition-colors flex items-center gap-1.5" style={{ fontSize: '15px' }}>
            <Reply size={14} /> Reply all
          </button>
          <button onClick={() => setShowForward(true)} className="text-ink-secondary hover:text-ink-primary underline underline-offset-4 transition-colors flex items-center gap-1.5" style={{ fontSize: '15px' }}>
            <Forward size={14} /> Forward
          </button>
        </div>
      )}

      {showReply && (
        <ReplyForm
          messageId={lastMessage.id}
          onSent={() => { setShowReply(false); onSent(); }}
          onCancel={() => setShowReply(false)}
        />
      )}

      {showReplyAll && (
        <ReplyAllForm
          messageId={lastMessage.id}
          onSent={() => { setShowReplyAll(false); onSent(); }}
          onCancel={() => setShowReplyAll(false)}
        />
      )}

      {showForward && (
        <ForwardForm
          messageId={lastMessage.id}
          teamMembers={teamMembers}
          onSent={() => { setShowForward(false); onSent(); }}
          onCancel={() => setShowForward(false)}
        />
      )}
    </div>
  );
}

function ComposeModal({ onClose, teamMembers, onSent, prefillRecipient }) {
  const [toUserId, setToUserId] = useState(prefillRecipient || '');
  const [ccUserIds, setCcUserIds] = useState([]);
  const [bccUserIds, setBccUserIds] = useState([]);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [showCc, setShowCc] = useState(false);
  const [attachments, setAttachments] = useState([]);
  const fileInputRef = useRef(null);

  const handleSend = async (saveAsDraft = false) => {
    if (!saveAsDraft && !toUserId) {
      toast.error('Please select a recipient');
      return;
    }
    setSending(true);
    try {
      await API.post('/flazyn-mail/compose', {
        to_user_id: toUserId || null,
        cc_user_ids: ccUserIds,
        bcc_user_ids: bccUserIds,
        subject,
        body,
        is_draft: saveAsDraft,
      });

      if (attachments.length > 0 && !saveAsDraft) {
        for (const file of attachments) {
          const fd = new FormData();
          fd.append('file', file);
          await API.post('/flazyn-mail/upload-attachment', fd, {
            headers: { 'Content-Type': 'multipart/form-data' },
          });
        }
      }

      toast.success(saveAsDraft ? 'Saved as draft' : 'Message sent');
      onSent();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to send');
    } finally {
      setSending(false);
    }
  };

  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files);
    setAttachments(prev => [...prev, ...files]);
  };

  const removeAttachment = (idx) => {
    setAttachments(prev => prev.filter((_, i) => i !== idx));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(28,25,23,0.25)' }} onClick={onClose}>
      <div className="card-raised w-full max-w-2xl max-h-[90vh] flex flex-col animate-scale-in" style={{ borderRadius: '10px' }} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between hairline-b pb-4 mb-4">
          <h2 className="text-ink-primary" style={{ fontSize: '22px', fontWeight: 600 }}>New message</h2>
          <button onClick={onClose} className="text-ink-tertiary hover:text-ink-primary transition-colors"><X size={18} /></button>
        </div>

        {/* Form */}
        <div className="flex-1 overflow-y-auto space-y-4">
          <div className="flex items-center gap-3">
            <label className="meta-label w-12 flex-shrink-0">To</label>
            <select value={toUserId} onChange={(e) => setToUserId(e.target.value)} className="input flex-1">
              <option value="">Select team member...</option>
              {teamMembers.map(m => (
                <option key={m.id} value={m.id}>
                  {m.first_name} {m.last_name} — {m.flazyn_email || `${m.first_name?.toLowerCase()}.${m.last_name?.toLowerCase()}@flazyn.internal`}
                </option>
              ))}
            </select>
            <button onClick={() => setShowCc(!showCc)} className="text-ink-secondary hover:text-ink-primary underline underline-offset-4 transition-colors" style={{ fontSize: '14px' }}>
              Cc/Bcc
            </button>
          </div>

          {showCc && (
            <>
              <div className="flex items-center gap-3">
                <label className="meta-label w-12 flex-shrink-0">Cc</label>
                <select
                  multiple
                  value={ccUserIds}
                  onChange={(e) => setCcUserIds(Array.from(e.target.selectedOptions, o => o.value))}
                  className="input flex-1"
                  style={{ height: 'auto', minHeight: '48px' }}
                >
                  {teamMembers.map(m => <option key={m.id} value={m.id}>{m.first_name} {m.last_name}</option>)}
                </select>
              </div>
              <div className="flex items-center gap-3">
                <label className="meta-label w-12 flex-shrink-0">Bcc</label>
                <select
                  multiple
                  value={bccUserIds}
                  onChange={(e) => setBccUserIds(Array.from(e.target.selectedOptions, o => o.value))}
                  className="input flex-1"
                  style={{ height: 'auto', minHeight: '48px' }}
                >
                  {teamMembers.map(m => <option key={m.id} value={m.id}>{m.first_name} {m.last_name}</option>)}
                </select>
              </div>
            </>
          )}

          <div className="flex items-center gap-3">
            <label className="meta-label w-12 flex-shrink-0">Subject</label>
            <input type="text" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Subject..." className="input flex-1" />
          </div>

          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Write your message..."
            className="input"
            style={{ height: '200px', resize: 'vertical' }}
          />

          <div className="space-y-2">
            {attachments.map((file, idx) => (
              <div key={idx} className="hairline-b py-2 flex items-center gap-2">
                <Paperclip size={12} className="text-ink-tertiary" />
                <span className="text-ink-primary flex-1 truncate" style={{ fontSize: '14px' }}>{file.name}</span>
                <span className="text-ink-tertiary mono" style={{ fontSize: '12px' }}>{(file.size / 1024).toFixed(1)} KB</span>
                <button onClick={() => removeAttachment(idx)} className="text-ink-tertiary hover:text-ink-primary"><X size={14} /></button>
              </div>
            ))}
            <button onClick={() => fileInputRef.current?.click()} className="text-ink-secondary hover:text-ink-primary underline underline-offset-4 transition-colors flex items-center gap-1.5" style={{ fontSize: '14px' }}>
              <Paperclip size={12} /> Attach file
            </button>
            <input ref={fileInputRef} type="file" onChange={handleFileSelect} className="hidden" multiple />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between hairline pt-4 mt-4">
          <button onClick={() => handleSend(true)} className="text-ink-secondary hover:text-ink-primary underline underline-offset-4 transition-colors" style={{ fontSize: '14px' }} disabled={sending}>
            Save draft
          </button>
          <button onClick={() => handleSend(false)} className="btn btn-primary" disabled={sending}>
            {sending ? <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" /> : <Send size={14} />}
            Send
          </button>
        </div>
      </div>
    </div>
  );
}

function ReplyForm({ messageId, onSent, onCancel }) {
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);

  const handleSend = async () => {
    if (!body.trim()) { toast.error('Reply cannot be empty'); return; }
    setSending(true);
    try {
      await API.post(`/flazyn-mail/reply/${messageId}`, { body });
      toast.success('Reply sent');
      onSent();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to reply');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="hairline pt-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="meta-label">Reply</p>
        <button onClick={onCancel} className="text-ink-tertiary hover:text-ink-primary"><X size={16} /></button>
      </div>
      <textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="Write your reply..." className="input" style={{ height: '120px', resize: 'vertical' }} autoFocus />
      <div className="flex justify-end">
        <button onClick={handleSend} className="btn btn-primary" disabled={sending}>
          {sending ? <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" /> : <Reply size={14} />}
          Send reply
        </button>
      </div>
    </div>
  );
}

function ReplyAllForm({ messageId, onSent, onCancel }) {
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);

  const handleSend = async () => {
    if (!body.trim()) { toast.error('Reply cannot be empty'); return; }
    setSending(true);
    try {
      await API.post(`/flazyn-mail/reply-all/${messageId}`, { body });
      toast.success('Reply all sent');
      onSent();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to reply all');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="hairline pt-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="meta-label">Reply all</p>
        <button onClick={onCancel} className="text-ink-tertiary hover:text-ink-primary"><X size={16} /></button>
      </div>
      <textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="Write your reply to all..." className="input" style={{ height: '120px', resize: 'vertical' }} autoFocus />
      <div className="flex justify-end">
        <button onClick={handleSend} className="btn btn-primary" disabled={sending}>
          {sending ? <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" /> : <Reply size={14} />}
          Send reply all
        </button>
      </div>
    </div>
  );
}

function ForwardForm({ messageId, teamMembers, onSent, onCancel }) {
  const [toUserId, setToUserId] = useState('');
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);

  const handleSend = async () => {
    if (!toUserId) { toast.error('Please select a recipient'); return; }
    setSending(true);
    try {
      await API.post(`/flazyn-mail/forward/${messageId}`, { to_user_id: toUserId, body });
      toast.success('Message forwarded');
      onSent();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to forward');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="hairline pt-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="meta-label">Forward</p>
        <button onClick={onCancel} className="text-ink-tertiary hover:text-ink-primary"><X size={16} /></button>
      </div>
      <select value={toUserId} onChange={(e) => setToUserId(e.target.value)} className="input">
        <option value="">Select team member...</option>
        {teamMembers.map(m => (
          <option key={m.id} value={m.id}>{m.first_name} {m.last_name} — {m.role?.replace('_', ' ')}</option>
        ))}
      </select>
      <textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="Add a note (optional)..." className="input" style={{ height: '100px', resize: 'vertical' }} />
      <div className="flex justify-end">
        <button onClick={handleSend} className="btn btn-primary" disabled={sending}>
          {sending ? <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" /> : <Forward size={14} />}
          Forward
        </button>
      </div>
    </div>
  );
}

function formatDate(dateStr) {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now - date;
  const diffHours = diffMs / (1000 * 60 * 60);
  const diffDays = diffHours / 24;

  if (diffHours < 1) return 'Just now';
  if (diffHours < 24) return `${Math.floor(diffHours)}h ago`;
  if (diffDays < 7) return `${Math.floor(diffDays)}d ago`;
  return date.toLocaleDateString('en', { month: 'short', day: 'numeric' });
}
