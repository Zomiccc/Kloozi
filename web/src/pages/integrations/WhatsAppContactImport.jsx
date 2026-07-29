import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import API from '../../lib/api';
import toast from 'react-hot-toast';
import { ArrowLeft, Download, CheckCircle2, AlertCircle, MessageSquare } from 'lucide-react';
import BrandLogo from '../../components/BrandLogo';

export default function WhatsAppContactImport() {
  const navigate = useNavigate();
  const [contacts, setContacts] = useState([]);
  const [selected, setSelected] = useState([]);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);

  useEffect(() => { loadContacts(); }, []);

  const loadContacts = async () => {
    try {
      const res = await API.get('/automations/whatsapp-contact-import');
      setContacts(res.data.contacts || []);
    } catch { toast.error('Failed to load contacts'); }
    finally { setLoading(false); }
  };

  const toggleSelect = (phone) => {
    setSelected(prev => prev.includes(phone) ? prev.filter(p => p !== phone) : [...prev, phone]);
  };

  const toggleSelectAll = () => {
    setSelected(selected.length === contacts.length ? [] : contacts.map(c => c.phone));
  };

  const handleImport = async () => {
    if (selected.length === 0) return toast.error('Select at least one contact');
    setImporting(true);
    try {
      const res = await API.post('/automations/whatsapp-contact-import', { phone_numbers: selected });
      toast.success(`Imported ${res.data.imported.length} contacts`);
      if (res.data.errors.length > 0) {
        toast.error(`${res.data.errors.length} failed to import`);
      }
      setSelected([]);
      loadContacts();
    } catch { toast.error('Import failed'); }
    finally { setImporting(false); }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <button onClick={() => navigate('/app/automations')} className="flex items-center gap-2 text-sm text-ink-secondary hover:text-ink-primary"><ArrowLeft size={16} /> Back to Automations</button>

      <div className="flex items-center gap-3">
        <div className="w-12 h-12 bg-surface-page rounded-xl flex items-center justify-center"><BrandLogo brand="whatsapp" /></div>
        <div><h2 className="text-xl font-bold text-ink-primary">WhatsApp Contact Import</h2><p className="text-sm text-ink-secondary">Create leads from WhatsApp conversations</p></div>
      </div>

      <div className="bg-surface-page border border-surface-border rounded-lg p-4 flex items-start gap-3">
        <AlertCircle size={20} className="text-ink-secondary flex-shrink-0" />
        <div><p className="text-sm font-medium text-ink-secondary">How it works:</p><p className="text-xs text-ink-tertiary mt-1">This finds phone numbers from WhatsApp messages that don't have matching lead records. Import selected contacts to create new leads.</p></div>
      </div>

      {loading ? <div className="flex justify-center py-8"><div className="animate-spin w-8 h-8 border-4 border-surface-border border-t-accent-blue rounded-full" /></div> :
        contacts.length === 0 ? (
          <div className="card text-center py-12"><MessageSquare size={48} className="text-ink-tertiary mx-auto mb-3" /><p className="text-ink-secondary">No new contacts to import</p></div>
        ) : (
          <>
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 text-sm text-ink-secondary">
                <input type="checkbox" checked={selected.length === contacts.length && contacts.length > 0} onChange={toggleSelectAll} />
                Select All ({selected.length} selected)
              </label>
              <button onClick={handleImport} disabled={importing || selected.length === 0} className="px-4 py-2 rounded-lg btn btn-primary flex items-center gap-2 transition-colors disabled:opacity-50">
                <Download size={16} /> {importing ? 'Importing...' : 'Import Selected'}
              </button>
            </div>

            <div className="card">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-surface-border">
                      <th className="text-left p-3 text-sm font-medium text-ink-secondary">Select</th>
                      <th className="text-left p-3 text-sm font-medium text-ink-secondary">Phone</th>
                      <th className="text-left p-3 text-sm font-medium text-ink-secondary">First Message</th>
                      <th className="text-left p-3 text-sm font-medium text-ink-secondary">Message Count</th>
                    </tr>
                  </thead>
                  <tbody>
                    {contacts.map((contact, idx) => (
                      <tr key={idx} className="border-b border-surface-border hover:bg-surface-hover">
                        <td className="p-3">
                          <input type="checkbox" checked={selected.includes(contact.phone)} onChange={() => toggleSelect(contact.phone)} />
                        </td>
                        <td className="p-3 text-sm text-ink-primary">{contact.phone}</td>
                        <td className="p-3 text-sm text-ink-secondary truncate max-w-xs">{contact.first_message || 'N/A'}</td>
                        <td className="p-3 text-sm text-ink-secondary">{contact.message_count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
    </div>
  );
}
