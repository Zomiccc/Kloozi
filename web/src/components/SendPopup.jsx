import { useState } from 'react';
import { Mail, Link2, X, AlertCircle } from 'lucide-react';

export default function SendPopup({ onClose, onZomicMail, recipientName }) {
  const [selected, setSelected] = useState(null);

  const handleChoose = (method) => {
    if (method === 'zomic') {
      onZomicMail();
    } else if (method === 'connected') {
      // Check if user has a connected personal email (Gmail/Outlook OAuth)
      // This would require a separate personal email OAuth integration
      // For now, we flag this to the user
      setSelected('connected');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white border border-surface-border rounded-3xl w-full max-w-md shadow-modal animate-slide-up overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-surface-border">
          <h2 className="text-lg font-bold text-ink-primary">Send Message</h2>
          <button onClick={onClose} className="text-ink-tertiary hover:text-ink-primary transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Recipient info */}
        {recipientName && (
          <div className="px-5 pt-4">
            <p className="text-sm text-ink-secondary">
              To: <span className="font-bold text-ink-primary">{recipientName}</span>
            </p>
          </div>
        )}

        {/* Options */}
        <div className="p-5 space-y-3">
          <p className="text-sm font-semibold text-ink-secondary mb-2">How would you like to send this?</p>

          {/* Zomic Mail */}
          <button
            onClick={() => handleChoose('zomic')}
            className="w-full flex items-center gap-4 p-4 rounded-2xl border-2 border-surface-border hover:border-accent-red transition-all text-left group"
          >
            <div
              className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0"
              style={{ background: 'linear-gradient(135deg, #FF3B5C, #FF9500)' }}
            >
              <Mail size={24} className="text-white" />
            </div>
            <div className="flex-1">
              <p className="font-bold text-ink-primary text-sm">Zomic Mail</p>
              <p className="text-xs text-ink-tertiary mt-0.5">Send using your internal CRM mailbox</p>
            </div>
          </button>

          {/* Connected Email */}
          <button
            onClick={() => handleChoose('connected')}
            className="w-full flex items-center gap-4 p-4 rounded-2xl border-2 border-surface-border hover:border-accent-blue transition-all text-left group"
          >
            <div
              className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0"
              style={{ background: '#0066FF15' }}
            >
              <Link2 size={24} className="text-accent-blue" />
            </div>
            <div className="flex-1">
              <p className="font-bold text-ink-primary text-sm">Connected Email</p>
              <p className="text-xs text-ink-tertiary mt-0.5">Send using your connected Gmail/Outlook</p>
            </div>
          </button>

          {/* Connected email not available notice */}
          {selected === 'connected' && (
            <div className="flex items-start gap-2 p-3 rounded-xl bg-accent-red/5 border border-accent-red/20">
              <AlertCircle size={16} className="text-accent-red flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-semibold text-accent-red">Not yet available</p>
                <p className="text-xs text-ink-secondary mt-1">
                  Personal Gmail/Outlook OAuth integration for team messaging hasn't been set up yet.
                  Please use Zomic Mail for internal team communication.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-5 border-t border-surface-border">
          <p className="text-xs text-ink-tertiary text-center">
            Zomic Mail is for internal team communication only.
            Lead emails continue through SendGrid as normal.
          </p>
        </div>
      </div>
    </div>
  );
}
