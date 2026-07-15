import { useState, useEffect } from 'react';
import API from '../lib/api';
import toast from 'react-hot-toast';
import useAuthStore from '../stores/authStore';

export default function Settings() {
  const { user, getProfile } = useAuthStore();
  const [form, setForm] = useState({ first_name: '', last_name: '', phone: '', designation: '', language: 'en', quiet_hours_start: '22:00', quiet_hours_end: '08:00' });
  const [notifPrefs, setNotifPrefs] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (user) {
      setForm({
        first_name: user.first_name || '', last_name: user.last_name || '', phone: user.phone || '',
        designation: user.designation || '', language: user.language || 'en',
        quiet_hours_start: user.quiet_hours_start || '22:00', quiet_hours_end: user.quiet_hours_end || '08:00',
      });
      setNotifPrefs(user.notification_preferences || {});
    }
  }, [user]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await API.put('/team/profile', { ...form, notification_preferences: notifPrefs });
      toast.success('Settings saved');
      getProfile();
    } catch { toast.error('Save failed'); }
    finally { setSaving(false); }
  };

  const notifTypes = [
    { key: 'new_lead', label: 'New Lead Arrived' }, { key: 'follow_up_due', label: 'Follow-up Due' },
    { key: 'follow_up_overdue', label: 'Follow-up Overdue' }, { key: 'whatsapp_reply', label: 'WhatsApp Reply' },
    { key: 'sms_reply', label: 'SMS Reply' }, { key: 'email_opened', label: 'Email Opened' },
    { key: 'email_clicked', label: 'Email Link Clicked' }, { key: 'content_opened', label: 'Content/File Opened' },
    { key: 'lead_won', label: 'Lead Won' }, { key: 'lead_lost', label: 'Lead Lost' },
  ];

  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="text-2xl font-bold text-dark-900">Settings</h1>

      <div className="card">
        <h3 className="font-semibold text-dark-900 mb-4">Profile</h3>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <input className="input" placeholder="First Name" value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} />
            <input className="input" placeholder="Last Name" value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} />
          </div>
          <input className="input" placeholder="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          <input className="input" placeholder="Designation" value={form.designation} onChange={(e) => setForm({ ...form, designation: e.target.value })} />
        </div>
      </div>

      <div className="card">
        <h3 className="font-semibold text-dark-900 mb-4">Preferences</h3>
        <div className="space-y-3">
          <div><label className="block text-sm font-medium mb-1">Language</label><select className="input" value={form.language} onChange={(e) => setForm({ ...form, language: e.target.value })}><option value="en">English</option><option value="ur">Urdu</option><option value="ar">Arabic</option></select></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="block text-sm font-medium mb-1">Quiet Hours Start</label><input type="time" className="input" value={form.quiet_hours_start} onChange={(e) => setForm({ ...form, quiet_hours_start: e.target.value })} /></div>
            <div><label className="block text-sm font-medium mb-1">Quiet Hours End</label><input type="time" className="input" value={form.quiet_hours_end} onChange={(e) => setForm({ ...form, quiet_hours_end: e.target.value })} /></div>
          </div>
        </div>
      </div>

      <div className="card">
        <h3 className="font-semibold text-dark-900 mb-4">Notification Preferences</h3>
        <div className="space-y-2">
          {notifTypes.map(n => (
            <label key={n.key} className="flex items-center justify-between py-2 border-b border-dark-50 last:border-0">
              <span className="text-sm text-dark-700">{n.label}</span>
              <input type="checkbox" checked={notifPrefs[n.key] !== false} onChange={(e) => setNotifPrefs({ ...notifPrefs, [n.key]: e.target.checked })} className="w-5 h-5" />
            </label>
          ))}
        </div>
      </div>

      <button onClick={handleSave} disabled={saving} className="btn btn-primary w-full">{saving ? 'Saving...' : 'Save Settings'}</button>
    </div>
  );
}
