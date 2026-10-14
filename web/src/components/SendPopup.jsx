import { useState } from 'react';
import { Mail, Link2, X, AlertCircle } from 'lucide-react';

export default function SendPopup({ onClose, onFlazynMail, recipientName }) {
  const [selected, setSelected] = useState(null);

  const handleChoose = (method) => {
    if (method === 'flazyn') {
      onFlazynMail();
    } else if (method === 'connected') {
      // Personal Gmail/Outlook OAuth isn't wired up yet — surface that honestly.
      setSelected('connected');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(28,25,23,0.25)' }} onClick={onClose}>
      <div className="card-raised w-full max-w-md overflow-hidden !p-0" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6">
          <h2 style={{ fontSize: '18px', fontWeight: 600 }}>Send message</h2>
          <button onClick={onClose} className="text-ink-tertiary hover:text-ink-primary transition-colors"><X size={18} /></button>
        </div>

        {/* Recipient */}
        {recipientName && (
          <p className="px-6 pt-1 text-ink-secondary" style={{ fontSize: '14px' }}>
            To <span className="font-semibold text-ink-primary">{recipientName}</span>
          </p>
        )}

        {/* Options */}
        <div className="px-6 py-5 space-y-3">
          <button
            onClick={() => handleChoose('flazyn')}
            className="w-full flex items-center gap-4 p-4 text-left transition-colors hairline hover:bg-[#1C191708]"
            style={{ borderRadius: '8px' }}
          >
            <span className="w-10 h-10 flex items-center justify-center flex-shrink-0 text-white" style={{ background: '#EDE9FF', borderRadius: '8px' }}>
              <Mail size={18} />
            </span>
            <span className="flex-1 min-w-0">
              <span className="font-semibold block" style={{ fontSize: '14px' }}>Flazyn Mail</span>
              <span className="text-ink-secondary block mt-0.5" style={{ fontSize: '13px' }}>Send from your internal CRM mailbox</span>
            </span>
          </button>

          <button
            onClick={() => handleChoose('connected')}
            className="w-full flex items-center gap-4 p-4 text-left transition-colors hairline hover:bg-[#1C191708]"
            style={{ borderRadius: '8px' }}
          >
            <span className="w-10 h-10 flex items-center justify-center flex-shrink-0 text-ink-secondary" style={{ border: '1px solid #E7E5E4', borderRadius: '8px' }}>
              <Link2 size={18} />
            </span>
            <span className="flex-1 min-w-0">
              <span className="font-semibold block" style={{ fontSize: '14px' }}>Connected email</span>
              <span className="text-ink-secondary block mt-0.5" style={{ fontSize: '13px' }}>Your own Gmail / Outlook</span>
            </span>
          </button>

          {selected === 'connected' && (
            <div className="hairline p-3 flex items-start gap-2" style={{ borderLeft: '2px solid #B45309' }}>
              <AlertCircle size={14} className="flex-shrink-0 mt-0.5" style={{ color: '#B45309' }} />
              <p className="text-ink-secondary" style={{ fontSize: '13px' }}>
                Personal Gmail/Outlook OAuth isn't connected yet — use Flazyn Mail for now.
                Lead-facing email keeps flowing through SendGrid as usual.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
