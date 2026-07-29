import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import API from '../../lib/api';
import toast from 'react-hot-toast';
import { ArrowLeft, MessageSquare, User, Clock, AlertCircle } from 'lucide-react';
import BrandLogo from '../../components/BrandLogo';

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
      if (err.response?.status === 403) {
        toast.error('Manager access required');
      } else {
        toast.error('Failed to load conversations');
      }
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
    if (conv.lead_id) {
      loadMessages(conv.lead_id);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <button onClick={() => navigate('/app/automations')} className="flex items-center gap-2 text-sm text-ink-secondary hover:text-ink-primary"><ArrowLeft size={16} /> Back to Automations</button>

      <div className="flex items-center gap-3">
        <div className="w-12 h-12 bg-surface-page rounded-xl flex items-center justify-center"><BrandLogo brand="whatsapp" /></div>
        <div><h2 className="text-xl font-bold text-ink-primary">WhatsApp Chat Monitoring</h2><p className="text-sm text-ink-secondary">View all team WhatsApp conversations</p></div>
      </div>

      <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-4 flex items-start gap-3">
        <AlertCircle size={20} className="text-amber-400 flex-shrink-0 mt-0.5" />
        <div><p className="text-sm font-medium text-amber-400">Manager Access Only</p><p className="text-xs text-amber-500/80 mt-1">This feature requires admin or owner role to view all team conversations.</p></div>
      </div>

      {loading ? <div className="flex justify-center py-8"><div className="animate-spin w-8 h-8 border-4 border-surface-border border-t-accent-blue rounded-full" /></div> :
        conversations.length === 0 ? (
          <div className="card text-center py-12"><MessageSquare size={48} className="text-ink-tertiary mx-auto mb-3" /><p className="text-ink-secondary">No conversations found</p></div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-1 space-y-3 max-h-[600px] overflow-y-auto">
              {conversations.map((conv, idx) => (
                <div key={idx} onClick={() => selectConversation(conv)} className={`card cursor-pointer transition-colors ${selectedConversation?.phone === conv.phone ? 'ring-2 ring-accent-blue' : 'hover:bg-surface-hover'}`}>
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-ink-primary truncate">{conv.first_name || conv.last_name ? `${conv.first_name || ''} ${conv.last_name || ''}`.trim() : 'Unknown'}</p>
                      <p className="text-xs text-ink-secondary">{conv.phone}</p>
                    </div>
                    {conv.unread_count > 0 && <span className="bg-accent-blue text-white text-xs px-2 py-0.5 rounded-full">{conv.unread_count}</span>}
                  </div>
                  <p className="text-xs text-ink-tertiary truncate">{conv.last_message || 'No messages'}</p>
                  {conv.last_message_time && <p className="text-xs text-ink-tertiary mt-1 flex items-center gap-1"><Clock size={10} /> {new Date(conv.last_message_time).toLocaleString()}</p>}
                  {conv.agent_first_name && <p className="text-xs text-ink-secondary mt-1">Agent: {conv.agent_first_name} {conv.agent_last_name}</p>}
                </div>
              ))}
            </div>

            <div className="lg:col-span-2">
              {selectedConversation ? (
                <div className="card h-[600px] flex flex-col">
                  <div className="border-b border-surface-border p-4">
                    <h3 className="font-semibold text-ink-primary">{selectedConversation.first_name || selectedConversation.last_name ? `${selectedConversation.first_name || ''} ${selectedConversation.last_name || ''}`.trim() : 'Unknown'}</h3>
                    <p className="text-sm text-ink-secondary">{selectedConversation.phone}</p>
                  </div>
                  <div className="flex-1 overflow-y-auto p-4 space-y-3">
                    {messages.length === 0 ? (
                      <div className="text-center py-12 text-ink-secondary">No messages loaded</div>
                    ) : (
                      messages.map((msg, idx) => (
                        <div key={idx} className={`flex ${msg.direction === 'outbound' ? 'justify-end' : 'justify-start'}`}>
                          <div className={`max-w-[70%] rounded-lg p-3 ${msg.direction === 'outbound' ? 'bg-accent-blue text-white' : 'bg-surface-page text-ink-primary'}`}>
                            <p className="text-sm">{msg.message_text}</p>
                            <p className="text-xs mt-1 opacity-70">{new Date(msg.created_at).toLocaleString()}</p>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              ) : (
                <div className="card h-[600px] flex items-center justify-center text-ink-secondary">
                  <div className="text-center"><MessageSquare size={48} className="mx-auto mb-3 opacity-50" /><p>Select a conversation to view messages</p></div>
                </div>
              )}
            </div>
          </div>
        )}
    </div>
  );
}
