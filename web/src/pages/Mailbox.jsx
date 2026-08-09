import { useState, useEffect, useRef } from 'react';
import API from '../lib/api';
import toast from 'react-hot-toast';
import {
  Inbox, Send, FileEdit, Trash2, Star, Archive, Search, Plus, X,
  Reply, Forward, Paperclip, ChevronLeft, Mail, AlertCircle
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
      const res = await API.get(`/zomic-mail/mailbox/${folder}`, { params });
      setMessages(res.data.messages || []);
    } catch {
      toast.error('Failed to load messages');
    } finally {
      setLoading(false);
    }
  };

  const loadUnreadCount = async () => {
    try {
      const res = await API.get('/zomic-mail/unread-count');
      setUnreadCount(res.data.unreadCount || 0);
    } catch {}
  };

  const loadTeamMembers = async () => {
    try {
      const res = await API.get('/zomic-mail/team-members');
      setTeamMembers(res.data.members || []);
    } catch {}
  };

  const handleSearch = (e) => {
    e.preventDefault();
    setSearch(searchInput);
  };

  const openThread = async (msg) => {
    try {
      const res = await API.get(`/zomic-mail/thread/${msg.thread_id}`);
      setThreadMessages(res.data.thread || []);
      setSelectedThread(msg.thread_id);
      // Mark unread messages as read
      const unread = (res.data.thread || []).filter(m => m.to_user_id && !m.is_read);
      for (const m of unread) {
        await API.put(`/zomic-mail/mark-read/${m.id}`);
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
      await API.put(`/zomic-mail/toggle-star/${msgId}`);
      loadMessages();
      if (selectedThread) {
        const res = await API.get(`/zomic-mail/thread/${selectedThread}`);
        setThreadMessages(res.data.thread || []);
      }
    } catch {
      toast.error('Failed to update star');
    }
  };

  const handleTrash = async (msgId, e) => {
    e.stopPropagation();
    try {
      await API.put(`/zomic-mail/trash/${msgId}`);
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
      await API.put(`/zomic-mail/archive/${msgId}`);
      loadMessages();
      toast.success('Archived');
    } catch {
      toast.error('Failed to archive');
    }
  };

  const handleRestore = async (msgId, e) => {
    e.stopPropagation();
    try {
      await API.put(`/zomic-mail/restore/${msgId}`);
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
      await API.delete(`/zomic-mail/${msgId}`);
      loadMessages();
      toast.success('Deleted');
    } catch {
      toast.error('Failed to delete');
    }
  };

  const folders = [
    { key: 'inbox', label: 'Inbox', icon: Inbox },
    { key: 'sent', label: 'Sent', icon: Send },
    { key: 'drafts', label: 'Drafts', icon: FileEdit },
    { key: 'starred', label: 'Starred', icon: Star },
    { key: 'archive', label: 'Archive', icon: Archive },
    { key: 'trash', label: 'Trash', icon: Trash2 },
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
      <div className="flex items-center justify-between flex-wrap gap-4">
        <h1 className="text-3xl font-extrabold text-ink-primary tracking-tight">Zomic Mail</h1>
        <button onClick={() => setShowCompose(true)} className="btn btn-primary">
          <Plus size={16} /> Compose
        </button>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Folder sidebar */}
        <div className="lg:w-56 flex-shrink-0">
          <div className="card" style={{ padding: '12px' }}>
            <div className="space-y-1">
              {folders.map(f => (
                <button
                  key={f.key}
                  onClick={() => { setFolder(f.key); setSearch(''); setSearchInput(''); }}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                    folder === f.key ? 'bg-accent-red text-white' : 'text-ink-secondary hover:bg-surface-hover'
                  }`}
                >
                  <f.icon size={16} />
                  <span className="flex-1 text-left">{f.label}</span>
                  {f.key === 'inbox' && unreadCount > 0 && (
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                      folder === 'inbox' ? 'bg-white/20 text-white' : 'bg-accent-red/10 text-accent-red'
                    }`}>
                      {unreadCount}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Message list */}
        <div className="flex-1 min-w-0">
          {/* Search bar */}
          <form onSubmit={handleSearch} className="mb-4">
            <div className="flex items-center gap-2">
              <div className="flex-1 relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-tertiary" />
                <input
                  type="text"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder="Search messages..."
                  className="input"
                  style={{ paddingLeft: '40px' }}
                />
              </div>
              {search && (
                <button type="button" onClick={() => { setSearch(''); setSearchInput(''); }} className="btn btn-ghost">
                  <X size={16} /> Clear
                </button>
              )}
            </div>
          </form>

          {/* Messages */}
          <div className="card overflow-hidden" style={{ padding: 0 }}>
            {loading ? (
              <div className="flex justify-center py-12">
                <div className="animate-spin w-8 h-8 border-4 border-accent-blue border-t-transparent rounded-full" />
              </div>
            ) : messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16">
                <div className="w-16 h-16 rounded-3xl bg-surface-page flex items-center justify-center mb-4">
                  <Mail size={32} className="text-ink-tertiary" />
                </div>
                <p className="text-ink-tertiary font-semibold">No messages in {folder}</p>
              </div>
            ) : (
              <div className="divide-y divide-surface-border">
                {messages.map(msg => (
                  <div
                    key={msg.id}
                    onClick={() => openThread(msg)}
                    className="flex items-start gap-3 p-4 hover:bg-surface-page cursor-pointer transition-colors group"
                  >
                    {/* Star button */}
                    <button
                      onClick={(e) => handleStar(msg.id, e)}
                      className="mt-0.5 flex-shrink-0 transition-colors"
                    >
                      <Star
                        size={18}
                        className={msg.is_starred ? 'text-accent-red fill-accent-red' : 'text-ink-tertiary hover:text-accent-red'}
                      />
                    </button>

                    {/* Avatar */}
                    <div
                      className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0"
                      style={{ background: 'linear-gradient(135deg, #0066FF, #AF52DE)' }}
                    >
                      {(msg.from_first_name || '?')[0]}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className={`text-sm truncate ${!msg.is_read ? 'font-bold text-ink-primary' : 'font-semibold text-ink-secondary'}`}>
                          {folder === 'sent' || folder === 'drafts'
                            ? `To: ${msg.to_first_name || ''} ${msg.to_last_name || ''}`
                            : `${msg.from_first_name || ''} ${msg.from_last_name || ''}`}
                        </p>
                        {!msg.is_read && folder === 'inbox' && (
                          <span className="w-2 h-2 rounded-full bg-accent-red flex-shrink-0" />
                        )}
                        <span className="text-xs text-ink-tertiary ml-auto flex-shrink-0">
                          {formatDate(msg.created_at)}
                        </span>
                      </div>
                      <p className={`text-sm truncate mt-0.5 ${!msg.is_read ? 'font-bold text-ink-primary' : 'text-ink-secondary'}`}>
                        {msg.subject || '(no subject)'}
                      </p>
                      <p className="text-xs text-ink-tertiary truncate mt-0.5">
                        {msg.body?.replace(/<[^>]*>/g, '').substring(0, 80) || ''}
                      </p>
                      {msg.attachments && msg.attachments.length > 0 && (
                        <div className="flex items-center gap-1 mt-1">
                          <Paperclip size={12} className="text-ink-tertiary" />
                          <span className="text-xs text-ink-tertiary">{msg.attachments.length} attachment(s)</span>
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                      {folder === 'trash' ? (
                        <>
                          <button onClick={(e) => handleRestore(msg.id, e)} className="p-1.5 rounded-lg hover:bg-surface-hover" title="Restore">
                            <Reply size={14} className="text-ink-secondary" />
                          </button>
                          <button onClick={(e) => handleDelete(msg.id, e)} className="p-1.5 rounded-lg hover:bg-red-50" title="Delete">
                            <Trash2 size={14} className="text-accent-red" />
                          </button>
                        </>
                      ) : (
                        <>
                          <button onClick={(e) => handleArchive(msg.id, e)} className="p-1.5 rounded-lg hover:bg-surface-hover" title="Archive">
                            <Archive size={14} className="text-ink-secondary" />
                          </button>
                          <button onClick={(e) => handleTrash(msg.id, e)} className="p-1.5 rounded-lg hover:bg-red-50" title="Trash">
                            <Trash2 size={14} className="text-accent-red" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
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
      {/* Header */}
      <div className="flex items-center gap-4">
        <button onClick={onBack} className="btn btn-ghost">
          <ChevronLeft size={16} /> Back
        </button>
        <h1 className="text-xl font-bold text-ink-primary truncate flex-1">{subject}</h1>
        <button onClick={(e) => onStar(lastMessage?.id, e)} className="p-2 rounded-xl hover:bg-surface-hover">
          <Star size={18} className={lastMessage?.is_starred ? 'text-accent-red fill-accent-red' : 'text-ink-tertiary'} />
        </button>
        <button onClick={(e) => onArchive(lastMessage?.id, e)} className="p-2 rounded-xl hover:bg-surface-hover">
          <Archive size={18} className="text-ink-secondary" />
        </button>
        <button onClick={(e) => onTrash(lastMessage?.id, e)} className="p-2 rounded-xl hover:bg-red-50">
          <Trash2 size={18} className="text-accent-red" />
        </button>
      </div>

      {/* Thread messages */}
      <div className="space-y-4">
        {messages.map((msg, idx) => (
          <div key={msg.id} className="card stagger-in" style={{ animationDelay: `${idx * 60}ms` }}>
            <div className="flex items-start gap-3 mb-4">
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0"
                style={{ background: 'linear-gradient(135deg, #0066FF, #AF52DE)' }}
              >
                {(msg.from_first_name || '?')[0]}
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <p className="font-bold text-ink-primary text-sm">
                    {msg.from_first_name} {msg.from_last_name}
                  </p>
                  <span className="text-xs text-ink-tertiary">
                    {new Date(msg.created_at).toLocaleString()}
                  </span>
                </div>
                <p className="text-xs text-ink-tertiary mt-0.5">
                  To: {msg.to_first_name} {msg.to_last_name}
                  <span className="text-ink-tertiary/60 ml-1">&lt;{(msg.to_first_name || '').toLowerCase()}.{(msg.to_last_name || '').toLowerCase()}@zomic.internal&gt;</span>
                </p>
              </div>
            </div>
            <div className="text-sm text-ink-secondary leading-relaxed whitespace-pre-wrap">
              {msg.body}
            </div>
            {msg.attachments && msg.attachments.length > 0 && (
              <div className="mt-4 pt-4 border-t border-surface-border space-y-2">
                {msg.attachments.map(att => (
                  <a
                    key={att.id}
                    href={att.file_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 p-2 rounded-xl bg-surface-page hover:bg-surface-hover transition-colors"
                  >
                    <Paperclip size={14} className="text-ink-tertiary" />
                    <span className="text-sm font-semibold text-accent-blue">{att.file_name}</span>
                    <span className="text-xs text-ink-tertiary ml-auto">
                      {(att.file_size / 1024).toFixed(1)} KB
                    </span>
                  </a>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Reply / Reply All / Forward buttons */}
      {!showReply && !showReplyAll && !showForward && (
        <div className="flex gap-3 flex-wrap">
          <button onClick={() => setShowReply(true)} className="btn btn-primary">
            <Reply size={16} /> Reply
          </button>
          <button onClick={() => setShowReplyAll(true)} className="btn btn-blue">
            <Reply size={16} /> Reply All
          </button>
          <button onClick={() => setShowForward(true)} className="btn btn-ghost">
            <Forward size={16} /> Forward
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
  const [isDraft, setIsDraft] = useState(false);
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
      const formData = new FormData();
      formData.append('to_user_id', toUserId || '');
      formData.append('cc_user_ids', JSON.stringify(ccUserIds));
      formData.append('bcc_user_ids', JSON.stringify(bccUserIds));
      formData.append('subject', subject);
      formData.append('body', body);
      formData.append('is_draft', saveAsDraft ? 'true' : 'false');
      if (attachments.length > 0) {
        formData.append('file', attachments[0]);
      }

      await API.post('/zomic-mail/compose', {
        to_user_id: toUserId || null,
        cc_user_ids: ccUserIds,
        bcc_user_ids: bccUserIds,
        subject,
        body,
        is_draft: saveAsDraft,
      });

      // Upload attachments if any
      if (attachments.length > 0 && !saveAsDraft) {
        for (const file of attachments) {
          const fd = new FormData();
          fd.append('file', file);
          await API.post('/zomic-mail/upload-attachment', fd, {
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
    <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white border border-surface-border rounded-3xl w-full max-w-2xl shadow-modal animate-slide-up max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-surface-border">
          <h2 className="text-lg font-bold text-ink-primary">New Message</h2>
          <button onClick={onClose} className="text-ink-tertiary hover:text-ink-primary transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Form */}
        <div className="flex-1 overflow-y-auto p-5 space-y-3">
          {/* To */}
          <div className="flex items-center gap-2">
            <label className="text-sm font-semibold text-ink-secondary w-12 flex-shrink-0">To</label>
            <select
              value={toUserId}
              onChange={(e) => setToUserId(e.target.value)}
              className="input flex-1"
            >
              <option value="">Select team member...</option>
              {teamMembers.map(m => (
                <option key={m.id} value={m.id}>
                  {m.first_name} {m.last_name} — {m.zomic_email || `${m.first_name?.toLowerCase()}.${m.last_name?.toLowerCase()}@zomic.internal`}
                </option>
              ))}
            </select>
            <button onClick={() => setShowCc(!showCc)} className="text-xs font-semibold text-accent-blue hover:underline">
              Cc/Bcc
            </button>
          </div>

          {/* CC / BCC */}
          {showCc && (
            <>
              <div className="flex items-center gap-2">
                <label className="text-sm font-semibold text-ink-secondary w-12 flex-shrink-0">Cc</label>
                <select
                  multiple
                  value={ccUserIds}
                  onChange={(e) => setCcUserIds(Array.from(e.target.selectedOptions, o => o.value))}
                  className="input flex-1"
                  style={{ height: 'auto', minHeight: '48px' }}
                >
                  {teamMembers.map(m => (
                    <option key={m.id} value={m.id}>{m.first_name} {m.last_name}</option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-2">
                <label className="text-sm font-semibold text-ink-secondary w-12 flex-shrink-0">Bcc</label>
                <select
                  multiple
                  value={bccUserIds}
                  onChange={(e) => setBccUserIds(Array.from(e.target.selectedOptions, o => o.value))}
                  className="input flex-1"
                  style={{ height: 'auto', minHeight: '48px' }}
                >
                  {teamMembers.map(m => (
                    <option key={m.id} value={m.id}>{m.first_name} {m.last_name}</option>
                  ))}
                </select>
              </div>
            </>
          )}

          {/* Subject */}
          <div className="flex items-center gap-2">
            <label className="text-sm font-semibold text-ink-secondary w-12 flex-shrink-0">Subject</label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Subject..."
              className="input flex-1"
            />
          </div>

          {/* Body */}
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Write your message..."
            className="input"
            style={{ height: '200px', padding: '12px 16px', resize: 'vertical' }}
          />

          {/* Attachments */}
          <div className="space-y-2">
            {attachments.map((file, idx) => (
              <div key={idx} className="flex items-center gap-2 p-2 rounded-xl bg-surface-page">
                <Paperclip size={14} className="text-ink-tertiary" />
                <span className="text-sm font-semibold text-ink-primary flex-1 truncate">{file.name}</span>
                <span className="text-xs text-ink-tertiary">{(file.size / 1024).toFixed(1)} KB</span>
                <button onClick={() => removeAttachment(idx)} className="text-ink-tertiary hover:text-accent-red">
                  <X size={14} />
                </button>
              </div>
            ))}
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-2 text-sm font-semibold text-accent-blue hover:underline"
            >
              <Paperclip size={14} /> Attach file
            </button>
            <input ref={fileInputRef} type="file" onChange={handleFileSelect} className="hidden" multiple />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-5 border-t border-surface-border">
          <button onClick={() => handleSend(true)} className="btn btn-ghost" disabled={sending}>
            Save Draft
          </button>
          <button onClick={() => handleSend(false)} className="btn btn-primary" disabled={sending}>
            {sending ? <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" /> : <Send size={16} />}
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
    if (!body.trim()) {
      toast.error('Reply cannot be empty');
      return;
    }
    setSending(true);
    try {
      await API.post(`/zomic-mail/reply/${messageId}`, { body });
      toast.success('Reply sent');
      onSent();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to reply');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="card space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-ink-primary">Reply</h3>
        <button onClick={onCancel} className="text-ink-tertiary hover:text-ink-primary">
          <X size={18} />
        </button>
      </div>
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Write your reply..."
        className="input"
        style={{ height: '120px', padding: '12px 16px', resize: 'vertical' }}
        autoFocus
      />
      <div className="flex justify-end">
        <button onClick={handleSend} className="btn btn-primary" disabled={sending}>
          {sending ? <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" /> : <Reply size={16} />}
          Send Reply
        </button>
      </div>
    </div>
  );
}

function ReplyAllForm({ messageId, onSent, onCancel }) {
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);

  const handleSend = async () => {
    if (!body.trim()) {
      toast.error('Reply cannot be empty');
      return;
    }
    setSending(true);
    try {
      await API.post(`/zomic-mail/reply-all/${messageId}`, { body });
      toast.success('Reply All sent');
      onSent();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to reply all');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="card space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-ink-primary">Reply All</h3>
        <button onClick={onCancel} className="text-ink-tertiary hover:text-ink-primary">
          <X size={18} />
        </button>
      </div>
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Write your reply to all..."
        className="input"
        style={{ height: '120px', padding: '12px 16px', resize: 'vertical' }}
        autoFocus
      />
      <div className="flex justify-end">
        <button onClick={handleSend} className="btn btn-blue" disabled={sending}>
          {sending ? <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" /> : <Reply size={16} />}
          Send Reply All
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
    if (!toUserId) {
      toast.error('Please select a recipient');
      return;
    }
    setSending(true);
    try {
      await API.post(`/zomic-mail/forward/${messageId}`, { to_user_id: toUserId, body });
      toast.success('Message forwarded');
      onSent();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to forward');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="card space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-ink-primary">Forward</h3>
        <button onClick={onCancel} className="text-ink-tertiary hover:text-ink-primary">
          <X size={18} />
        </button>
      </div>
      <select value={toUserId} onChange={(e) => setToUserId(e.target.value)} className="input">
        <option value="">Select team member...</option>
        {teamMembers.map(m => (
          <option key={m.id} value={m.id}>
            {m.first_name} {m.last_name} — {m.role?.replace('_', ' ')}
          </option>
        ))}
      </select>
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Add a note (optional)..."
        className="input"
        style={{ height: '100px', padding: '12px 16px', resize: 'vertical' }}
      />
      <div className="flex justify-end">
        <button onClick={handleSend} className="btn btn-primary" disabled={sending}>
          {sending ? <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" /> : <Forward size={16} />}
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
  return date.toLocaleDateString();
}
