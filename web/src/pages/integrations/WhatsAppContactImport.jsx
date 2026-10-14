import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import API from '../../lib/api';
import toast from 'react-hot-toast';
import { ArrowLeft, Download } from 'lucide-react';

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
    setSelected((prev) => prev.includes(phone) ? prev.filter((p) => p !== phone) : [...prev, phone]);
  };

  const toggleSelectAll = () => {
    setSelected(selected.length === contacts.length ? [] : contacts.map((c) => c.phone));
  };

  const handleImport = async () => {
    if (selected.length === 0) return toast.error('Select at least one contact');
    setImporting(true);
    try {
      const res = await API.post('/automations/whatsapp-contact-import', { phone_numbers: selected });
      toast.success(`Imported ${res.data.imported.length} contact${res.data.imported.length === 1 ? '' : 's'}`);
      if (res.data.errors?.length > 0) {
        toast.error(`${res.data.errors.length} failed to import`);
      }
      setSelected([]);
      loadContacts();
    } catch { toast.error('Import failed'); }
    finally { setImporting(false); }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <button onClick={() => navigate('/app/automations')} className="btn-ghost text-sm font-medium flex items-center gap-1.5">
        <ArrowLeft size={14} /> Automations
      </button>

      <div className="flex items-baseline justify-between gap-4 flex-wrap">
        <div>
          <h1 style={{ fontSize: '32px', fontWeight: 650, letterSpacing: '-0.01em' }}>Contact Import</h1>
          <p className="text-ink-secondary mt-1" style={{ fontSize: '15px' }}>
            Numbers that messaged you but aren't leads yet. Select, import, done — they become real lead records.
          </p>
        </div>
        {contacts.length > 0 && (
          <button onClick={handleImport} disabled={importing || selected.length === 0} className="btn btn-accent">
            <Download size={15} /> {importing ? 'Importing…' : `Import ${selected.length > 0 ? `${selected.length} selected` : ''}`}
          </button>
        )}
      </div>

      {loading ? (
        <div className="space-y-2">{[1, 2, 3].map((i) => <div key={i} className="skeleton h-12" />)}</div>
      ) : contacts.length === 0 ? (
        <div className="pt-16 max-w-[560px]">
          <p style={{ fontSize: '22px', fontWeight: 600 }}>Nothing to import.</p>
          <p className="text-ink-secondary mt-2" style={{ fontSize: '15px' }}>Every number that's messaged you already has a lead record.</p>
        </div>
      ) : (
        <>
          <label className="flex items-center gap-2 cursor-pointer select-none" style={{ fontSize: '14px' }}>
            <input
              type="checkbox"
              checked={selected.length === contacts.length && contacts.length > 0}
              onChange={toggleSelectAll}
            />
            <span className="text-ink-secondary">Select all</span>
            {selected.length > 0 && <span className="mono text-ink-primary">({selected.length})</span>}
          </label>

          <table className="flazyn-table">
            <thead>
              <tr>
                <th style={{ width: '40px' }}></th>
                <th>Phone</th>
                <th>First message</th>
                <th className="text-right!">Messages</th>
              </tr>
            </thead>
            <tbody>
              {contacts.map((contact, idx) => (
                <tr key={idx}>
                  <td><input type="checkbox" checked={selected.includes(contact.phone)} onChange={() => toggleSelect(contact.phone)} /></td>
                  <td className="mono">{contact.phone}</td>
                  <td className="text-ink-secondary max-w-xs truncate" style={{ fontSize: '13px' }}>{contact.first_message || '—'}</td>
                  <td className="text-right mono">{contact.message_count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}
