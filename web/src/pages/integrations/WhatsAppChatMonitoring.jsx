import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import API from '../../lib/api';
import toast from 'react-hot-toast';
import { ArrowLeft, Clock, MessageSquare } from 'lucide-react';

export default function WhatsAppChatMonitoring() {
  const navigate = useNavigate();
  const [conversations, setConversations] = useState([]);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadConversations(); }, []);

  const loadConversations = async () => {
    try {
      const res = await API.get('/automations/whatsapp-chat-monitoring');
      setConversations(res.data.conversations || []);
    } catch (err) {
      if (err.response?.status === 403) toast.error('Manager access required');
      else toast.error('Failed to load conversations');
    }
    finally { setLoading(false); }
  };

  const loadMessages = async (leadId) => {
    try {
      const res = await API.get(`/whatsapp/inbox?lead_id=${leadId}`);
      setMessages(res.data.messages || []);
    } catch { toast.error('Failed to load messages'); }
  };

  const selectConversation = (conv) => {
    setSelectedConversation(conv);
    setMessages([]);
    if (conv.lead_id) loadMessages(conv.lead_id);
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <button onClick={() => navigate('/app/automations')} className="btn-ghost text-sm font-medium flex items-center gap-1.5">
        <ArrowLeft size={14} /> Automations
      </button>

      <div className="flex items-baseline justify-between gap-4 flex-wrap">
        <div>
          <h1 style={{ fontSize: '32px', fontWeight: 650, letterSpacing: '-0.01em' }}>Chat Monitoring</h1>
          <p className="text-ink-secondary mt-1" style={{ fontSize: '15px' }}>
            Every WhatsApp conversation across the team, in one place.
          </p>
        </div>
        <span className="badge badge-warning flex-shrink-0">Manager access only</span>
      </div>

      {loading ? (
        <div className="space-y-2">{[1, 2, 3].map((i) => <div key={i} className="skeleton h-16" />)}</div>
      ) : conversations.length === 0 ? (
        <div className="pt-16 max-w-[560px]">
          <p style={{ fontSize: '22px', fontWeight: 600 }}>No conversations yet.</p>
          <p className="text-ink-secondary mt-2" style={{ fontSize: '15px' }}>Once your team chats on WhatsApp, transcripts appear here.</p>
        </div>
      ) : (
        <div className="grid lg:grid-cols-[340px_1fr] gap-8 items-start">
          {/* Conversation list */}
          <div className="space-y-0 max-h-[620px] overflow-y-auto lg:border-r lg:hairline-r lg:pr-4">
            {conversations.map((conv, idx) => {
              const name = conv.first_name || conv.last_name ? `${conv.first_name || ''} ${conv.last_name || ''}`.trim() : 'Unknown';
              const activeSel = selectedConversation?.phone === conv.phone;
              return (
                <button
                  key={idx}
                  onClick={() => selectConversation(conv)}
                  className="w-full text-left hairline-b py-3 px-2 -mx-2 transition-colors"
                  style={{
                    boxShadow: activeSel ? 'inset 2px 0 0 #EDE9FF' : 'none',
                    background: activeSel ? '#1C191708' : 'transparent',
                  }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold truncate" style={{ fontSize: '14px' }}>{name}</p>
                        {conv.unread_count > 0 && (
                          <span className="mono text-white flex-shrink-0" style={{ fontSize: '11px', background: '#EDE9FF', padding: '1px 7px', borderRadius: '999px' }}>{conv.unread_count}</span>
                        )}
                      </div>
                      <p className="mono text-ink-secondary mt-0.5 truncate" style={{ fontSize: '12px' }}>{conv.phone}</p>
                      <p className="text-ink-secondary truncate mt-1" style={{ fontSize: '13px' }}>{conv.last_message || 'No messages'}</p>
                      <div className="flex items-center justify-between gap-2 mt-1">
                        {conv.last_message_time && (
                          <span className="text-ink-tertiary flex items-center gap-1" style={{ fontSize: '12px' }}>
                            <Clock size={10} /> {new Date(conv.last_message_time).toLocaleString()}
                          </span>
                        )}
                        {conv.agent_first_name && (
                          <span className="text-ink-tertiary truncate" style={{ fontSize: '12px' }}>{conv.agent_first_name}</span>
                        )}
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Transcript */}
          <div className="min-h-[480px] max-h-[680px] flex flex-col">
            {selectedConversation ? (
              <>
                <div className="hairline-b pb-4 mb-4">
                  <h2 className="font-semibold" style={{ fontSize: '17px' }}>
                    {(selectedConversation.first_name || selectedConversation.last_name
                      ? `${selectedConversation.first_name || ''} ${selectedConversation.last_name || ''}`.trim()
                      : 'Unknown')}
                  </h2>
                  <p className="mono text-ink-secondary mt-0.5" style={{ fontSize: '13px' }}>{selectedConversation.phone}</p>
                </div>
                <div className="flex-1 overflow-y-auto pr-1 space-y-3 pb-4">
                  {messages.length === 0 ? (
                    <p className="text-ink-secondary py-10 text-center" style={{ fontSize: '14px' }}>Loading transcript…</p>
                  ) : (
                    messages.map((msg, idx) => (
                      <div key={idx} className={`flex ${msg.direction === 'outbound' ? 'justify-end' : 'justify-start'}`}>
                        <div
                          className="max-w-[75%]"
                          style={{
                            padding: '10px 14px',
                            borderRadius: msg.direction === 'outbound' ? '10px 10px 2px 10px' : '10px 10px 10px 2px',
                            background: msg.direction === 'outbound' ? '#1C1917' : '#FFFFFF',
                            border: msg.direction === 'outbound' ? 'none' : '1px solid #E7E5E4',
                          }}
                        >
                          <p className="text-sm" style={{ color: msg.direction === 'outbound' ? '#FAFAF9' : '#1C1917', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                            {msg.message_text}
                          </p>
                          <p className="mt-1" style={{ fontSize: '11px', color: msg.direction === 'outbound' ? '#A8A29E' : '#A8A29E' }}>
                            {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-center">
                <div>
                  <MessageSquare size={28} className="mx-auto mb-3 text-ink-tertiary" />
                  <p className="text-ink-secondary" style={{ fontSize: '15px' }}>Pick a conversation to read its full transcript.</p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
