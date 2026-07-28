import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import API from '../lib/api';
import toast from 'react-hot-toast';
import useAuthStore from '../stores/authStore';
import {
  Bell, User, Clock, AlertCircle, Copy, Users, FileText, Code, MessageSquare,
  CreditCard, BookOpen, Save, Plus, Trash2
} from 'lucide-react';

const tabs = [
  { key: 'notifications', label: 'Notifications', icon: Bell },
  { key: 'personalisation', label: 'Personalisation', icon: User },
  { key: 'follow_ups', label: 'Follow Ups', icon: Clock },
  { key: 'uncontacted', label: 'Uncontacted Leads', icon: AlertCircle },
  { key: 'duplicate_leads', label: 'Duplicate Leads', icon: Copy },
  { key: 'client_groups', label: 'Client Groups', icon: Users },
  { key: 'custom_fields', label: 'Custom Client Fields', icon: FileText },
  { key: 'pixel', label: 'Facebook Pixel & Google Tag ID', icon: Code },
  { key: 'meta_capi', label: 'Meta Conversions API', icon: Code },
  { key: 'whatsapp', label: 'WhatsApp Business', icon: MessageSquare },
  { key: 'subscription', label: 'Subscription', icon: CreditCard },
  { key: 'user_guide', label: 'User Guide', icon: BookOpen },
];

const notifTypes = [
  { key: 'new_lead', label: 'New Lead Arrived' }, { key: 'follow_up_due', label: 'Follow-up Due' },
  { key: 'follow_up_overdue', label: 'Follow-up Overdue' }, { key: 'whatsapp_reply', label: 'WhatsApp Reply' },
  { key: 'sms_reply', label: 'SMS Reply' }, { key: 'email_opened', label: 'Email Opened' },
  { key: 'email_clicked', label: 'Email Link Clicked' }, { key: 'content_opened', label: 'Content/File Opened' },
  { key: 'lead_won', label: 'Lead Won' }, { key: 'lead_lost', label: 'Lead Lost' },
];

export default function Settings() {
  const navigate = useNavigate();
  const { user, getProfile } = useAuthStore();
  const [tab, setTab] = useState('notifications');
  const [form, setForm] = useState({ first_name: '', last_name: '', phone: '', designation: '', language: 'en', quiet_hours_start: '22:00', quiet_hours_end: '08:00' });
  const [notifPrefs, setNotifPrefs] = useState({});
  const [saving, setSaving] = useState(false);
  const [wsSettings, setWsSettings] = useState({});
  const [groups, setGroups] = useState([]);
  const [customFields, setCustomFields] = useState([]);
  const [newGroup, setNewGroup] = useState('');
  const [newField, setNewField] = useState({ name: '', type: 'text' });

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

  useEffect(() => {
    loadWorkspaceSettings();
    loadGroups();
    loadCustomFields();
  }, []);

  const loadWorkspaceSettings = async () => {
    try {
      const res = await API.get('/analytics/workspace-settings');
      setWsSettings(res.data.settings || {});
    } catch {}
  };

  const loadGroups = async () => {
    try {
      const res = await API.get('/leads/groups');
      setGroups(res.data.groups || []);
    } catch {}
  };

  const loadCustomFields = async () => {
    try {
      const res = await API.get('/leads/custom-fields');
      setCustomFields(res.data.customFields || []);
    } catch {}
  };

  const handleSaveProfile = async () => {
    setSaving(true);
    try {
      await API.put('/team/profile', { ...form, notification_preferences: notifPrefs });
      toast.success('Settings saved');
      getProfile();
    } catch { toast.error('Save failed'); }
    finally { setSaving(false); }
  };

  const handleSaveWsSettings = async () => {
    setSaving(true);
    try {
      await API.put('/analytics/workspace-settings', wsSettings);
      toast.success('Settings saved');
    } catch { toast.error('Save failed'); }
    finally { setSaving(false); }
  };

  const handleCreateGroup = async () => {
    if (!newGroup.trim()) return;
    try {
      await API.post('/leads/groups', { name: newGroup, type: 'static' });
      toast.success('Group created');
      setNewGroup('');
      loadGroups();
    } catch { toast.error('Failed to create group'); }
  };

  const handleCreateField = async () => {
    if (!newField.name.trim()) return;
    try {
      await API.post('/leads/custom-fields', newField);
      toast.success('Custom field created');
      setNewField({ name: '', type: 'text' });
      loadCustomFields();
    } catch { toast.error('Failed to create field'); }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-extrabold text-ink-primary tracking-tight">Settings</h1>

      {/* Tab sidebar */}
      <div className="flex gap-6">
        <div className="w-56 flex-shrink-0 hidden md:block">
          <div className="space-y-1">
            {tabs.map(t => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-semibold transition-colors ${tab === t.key ? 'bg-surface-page text-ink-primary' : 'text-ink-secondary hover:bg-surface-hover'}`}
              >
                <t.icon size={16} /> {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Mobile tab select */}
        <div className="md:hidden w-full">
          <select className="input mb-4" value={tab} onChange={(e) => setTab(e.target.value)}>
            {tabs.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
          </select>
        </div>

        {/* Tab content */}
        <div className="flex-1 min-w-0 max-w-2xl">
          {/* Notifications */}
          {tab === 'notifications' && (
            <div className="card stagger-in space-y-4">
              <h3 className="text-lg font-bold text-ink-primary">Notification Preferences</h3>
              <p className="text-sm text-ink-secondary">Choose which events trigger notifications.</p>
              <div className="space-y-1">
                {notifTypes.map(n => (
                  <label key={n.key} className="flex items-center justify-between py-2.5 border-b border-surface-border last:border-0 cursor-pointer">
                    <span className="text-sm font-semibold text-ink-secondary">{n.label}</span>
                    <input type="checkbox" checked={notifPrefs[n.key] !== false} onChange={(e) => setNotifPrefs({ ...notifPrefs, [n.key]: e.target.checked })} className="w-5 h-5 accent-blue-500" />
                  </label>
                ))}
              </div>
              <button onClick={handleSaveProfile} disabled={saving} className="btn btn-primary w-full"><Save size={16} /> {saving ? 'Saving...' : 'Save Notifications'}</button>
            </div>
          )}

          {/* Personalisation */}
          {tab === 'personalisation' && (
            <div className="card stagger-in space-y-4">
              <h3 className="text-lg font-bold text-ink-primary">Profile & Personalisation</h3>
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="block text-xs font-bold text-ink-tertiary mb-1.5 uppercase">First Name</label><input className="input" placeholder="First Name" value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} /></div>
                  <div><label className="block text-xs font-bold text-ink-tertiary mb-1.5 uppercase">Last Name</label><input className="input" placeholder="Last Name" value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} /></div>
                </div>
                <div><label className="block text-xs font-bold text-ink-tertiary mb-1.5 uppercase">Phone</label><input className="input" placeholder="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
                <div><label className="block text-xs font-bold text-ink-tertiary mb-1.5 uppercase">Designation</label><input className="input" placeholder="Designation" value={form.designation} onChange={(e) => setForm({ ...form, designation: e.target.value })} /></div>
                <div><label className="block text-xs font-bold text-ink-tertiary mb-1.5 uppercase">Language</label><select className="input" value={form.language} onChange={(e) => setForm({ ...form, language: e.target.value })}><option value="en">English</option><option value="ur">Urdu</option><option value="ar">Arabic</option></select></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="block text-xs font-bold text-ink-tertiary mb-1.5 uppercase">Quiet Hours Start</label><input type="time" className="input" value={form.quiet_hours_start} onChange={(e) => setForm({ ...form, quiet_hours_start: e.target.value })} /></div>
                  <div><label className="block text-xs font-bold text-ink-tertiary mb-1.5 uppercase">Quiet Hours End</label><input type="time" className="input" value={form.quiet_hours_end} onChange={(e) => setForm({ ...form, quiet_hours_end: e.target.value })} /></div>
                </div>
              </div>
              <button onClick={handleSaveProfile} disabled={saving} className="btn btn-primary w-full"><Save size={16} /> {saving ? 'Saving...' : 'Save Profile'}</button>
            </div>
          )}

          {/* Follow Ups */}
          {tab === 'follow_ups' && (
            <div className="card stagger-in space-y-4">
              <h3 className="text-lg font-bold text-ink-primary">Follow Up Settings</h3>
              <p className="text-sm text-ink-secondary">Configure default follow-up timing and reminders.</p>
              <div className="space-y-3">
                <div><label className="block text-xs font-bold text-ink-tertiary mb-1.5 uppercase">Default Follow-up Delay (hours)</label><input type="number" className="input" value={wsSettings.follow_up_delay_hours || 24} onChange={(e) => setWsSettings({ ...wsSettings, follow_up_delay_hours: parseInt(e.target.value) })} /></div>
                <div><label className="block text-xs font-bold text-ink-tertiary mb-1.5 uppercase">Overdue Reminder (hours)</label><input type="number" className="input" value={wsSettings.follow_up_overdue_hours || 48} onChange={(e) => setWsSettings({ ...wsSettings, follow_up_overdue_hours: parseInt(e.target.value) })} /></div>
                <label className="flex items-center justify-between py-2.5 border-b border-surface-border cursor-pointer">
                  <span className="text-sm font-semibold text-ink-secondary">Auto-create follow-up for new leads</span>
                  <input type="checkbox" checked={wsSettings.auto_follow_up !== false} onChange={(e) => setWsSettings({ ...wsSettings, auto_follow_up: e.target.checked })} className="w-5 h-5 accent-blue-500" />
                </label>
              </div>
              <button onClick={handleSaveWsSettings} disabled={saving} className="btn btn-primary w-full"><Save size={16} /> {saving ? 'Saving...' : 'Save Follow Up Settings'}</button>
            </div>
          )}

          {/* Uncontacted Leads */}
          {tab === 'uncontacted' && (
            <div className="card stagger-in space-y-4">
              <h3 className="text-lg font-bold text-ink-primary">Uncontacted Leads</h3>
              <p className="text-sm text-ink-secondary">Set rules for leads that haven't been contacted yet.</p>
              <div className="space-y-3">
                <div><label className="block text-xs font-bold text-ink-tertiary mb-1.5 uppercase">Alert after (hours uncontacted)</label><input type="number" className="input" value={wsSettings.uncontacted_alert_hours || 2} onChange={(e) => setWsSettings({ ...wsSettings, uncontacted_alert_hours: parseInt(e.target.value) })} /></div>
                <div><label className="block text-xs font-bold text-ink-tertiary mb-1.5 uppercase">Escalate after (hours uncontacted)</label><input type="number" className="input" value={wsSettings.uncontacted_escalate_hours || 6} onChange={(e) => setWsSettings({ ...wsSettings, uncontacted_escalate_hours: parseInt(e.target.value) })} /></div>
                <label className="flex items-center justify-between py-2.5 border-b border-surface-border cursor-pointer">
                  <span className="text-sm font-semibold text-ink-secondary">Send push notification for uncontacted leads</span>
                  <input type="checkbox" checked={wsSettings.uncontacted_push !== false} onChange={(e) => setWsSettings({ ...wsSettings, uncontacted_push: e.target.checked })} className="w-5 h-5 accent-blue-500" />
                </label>
              </div>
              <button onClick={handleSaveWsSettings} disabled={saving} className="btn btn-primary w-full"><Save size={16} /> {saving ? 'Saving...' : 'Save Settings'}</button>
            </div>
          )}

          {/* Duplicate Leads */}
          {tab === 'duplicate_leads' && (
            <div className="card stagger-in space-y-4">
              <h3 className="text-lg font-bold text-ink-primary">Duplicate Lead Handling</h3>
              <p className="text-sm text-ink-secondary">When a new lead is received via external lead source integrations and their phone number and/or email matches an existing client:</p>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-ink-tertiary mb-1.5 uppercase">Duplicate Handling Mode</label>
                  <select className="input" value={wsSettings.duplicate_mode || 'warn'} onChange={(e) => setWsSettings({ ...wsSettings, duplicate_mode: e.target.value })}>
                    <option value="warn">Warn only (show duplicate alert)</option>
                    <option value="auto_merge">Auto-merge with existing lead</option>
                    <option value="allow">Allow duplicates (create new lead)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-ink-tertiary mb-1.5 uppercase">Match by</label>
                  <div className="space-y-2">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={wsSettings.duplicate_match_phone !== false} onChange={(e) => setWsSettings({ ...wsSettings, duplicate_match_phone: e.target.checked })} className="w-5 h-5 accent-blue-500" />
                      <span className="text-sm font-semibold text-ink-secondary">Phone number</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={wsSettings.duplicate_match_email !== false} onChange={(e) => setWsSettings({ ...wsSettings, duplicate_match_email: e.target.checked })} className="w-5 h-5 accent-blue-500" />
                      <span className="text-sm font-semibold text-ink-secondary">Email address</span>
                    </label>
                  </div>
                </div>
                <div className="rounded-2xl p-4 border border-surface-border bg-surface-page">
                  <p className="text-xs text-ink-secondary">
                    <strong className="text-ink-primary">Auto-merge</strong> will update the existing lead with any new information from the duplicate submission (e.g. new source, additional notes) and log the merge in the lead's activity timeline.
                  </p>
                </div>
              </div>
              <button onClick={handleSaveWsSettings} disabled={saving} className="btn btn-primary w-full"><Save size={16} /> {saving ? 'Saving...' : 'Save Duplicate Settings'}</button>
            </div>
          )}

          {/* Client Groups */}
          {tab === 'client_groups' && (
            <div className="card stagger-in space-y-4">
              <h3 className="text-lg font-bold text-ink-primary">Client Groups</h3>
              <p className="text-sm text-ink-secondary">Organize leads into groups for bulk actions and campaigns.</p>
              <div className="flex gap-2">
                <input className="input flex-1" placeholder="Group name" value={newGroup} onChange={(e) => setNewGroup(e.target.value)} />
                <button onClick={handleCreateGroup} className="btn btn-primary"><Plus size={16} /> Add</button>
              </div>
              <div className="space-y-2">
                {groups.length === 0 ? <p className="text-sm text-ink-tertiary text-center py-4">No groups yet</p> :
                  groups.map(g => (
                    <div key={g.id} className="flex items-center justify-between p-3 rounded-xl border border-surface-border">
                      <div><p className="font-bold text-ink-primary">{g.name}</p><p className="text-xs text-ink-tertiary capitalize">{g.type}</p></div>
                    </div>
                  ))
                }
              </div>
            </div>
          )}

          {/* Custom Client Fields */}
          {tab === 'custom_fields' && (
            <div className="card stagger-in space-y-4">
              <h3 className="text-lg font-bold text-ink-primary">Custom Client Fields</h3>
              <p className="text-sm text-ink-secondary">Add custom fields to capture additional lead information.</p>
              <div className="flex gap-2">
                <input className="input flex-1" placeholder="Field name" value={newField.name} onChange={(e) => setNewField({ ...newField, name: e.target.value })} />
                <select className="input w-32" value={newField.type} onChange={(e) => setNewField({ ...newField, type: e.target.value })}>
                  <option value="text">Text</option><option value="number">Number</option><option value="date">Date</option><option value="select">Select</option>
                </select>
                <button onClick={handleCreateField} className="btn btn-primary"><Plus size={16} /> Add</button>
              </div>
              <div className="space-y-2">
                {customFields.length === 0 ? <p className="text-sm text-ink-tertiary text-center py-4">No custom fields yet</p> :
                  customFields.map(f => (
                    <div key={f.id} className="flex items-center justify-between p-3 rounded-xl border border-surface-border">
                      <div><p className="font-bold text-ink-primary">{f.name}</p><p className="text-xs text-ink-tertiary capitalize">{f.type}</p></div>
                    </div>
                  ))
                }
              </div>
            </div>
          )}

          {/* Facebook Pixel & Google Tag */}
          {tab === 'pixel' && (
            <div className="card stagger-in space-y-4">
              <h3 className="text-lg font-bold text-ink-primary">Facebook Pixel & Google Tag ID</h3>
              <p className="text-sm text-ink-secondary">Track conversions from your landing pages and lead forms.</p>
              <div className="space-y-3">
                <div><label className="block text-xs font-bold text-ink-tertiary mb-1.5 uppercase">Facebook Pixel ID</label><input className="input" placeholder="e.g. 123456789012345" value={wsSettings.facebook_pixel_id || ''} onChange={(e) => setWsSettings({ ...wsSettings, facebook_pixel_id: e.target.value })} /></div>
                <div><label className="block text-xs font-bold text-ink-tertiary mb-1.5 uppercase">Google Tag Manager ID</label><input className="input" placeholder="e.g. GTM-XXXXXXX" value={wsSettings.google_tag_id || ''} onChange={(e) => setWsSettings({ ...wsSettings, google_tag_id: e.target.value })} /></div>
                <div><label className="block text-xs font-bold text-ink-tertiary mb-1.5 uppercase">Google Analytics ID</label><input className="input" placeholder="e.g. G-XXXXXXXXXX" value={wsSettings.google_analytics_id || ''} onChange={(e) => setWsSettings({ ...wsSettings, google_analytics_id: e.target.value })} /></div>
              </div>
              <button onClick={handleSaveWsSettings} disabled={saving} className="btn btn-primary w-full"><Save size={16} /> {saving ? 'Saving...' : 'Save Tracking IDs'}</button>
            </div>
          )}

          {/* Meta Conversions API */}
          {tab === 'meta_capi' && (
            <div className="card stagger-in space-y-4">
              <h3 className="text-lg font-bold text-ink-primary">Meta Conversions API</h3>
              <p className="text-sm text-ink-secondary">Send conversion events directly to Meta via server-side API.</p>
              <div className="space-y-3">
                <div><label className="block text-xs font-bold text-ink-tertiary mb-1.5 uppercase">Meta Pixel ID</label><input className="input" placeholder="Pixel ID" value={wsSettings.meta_capi_pixel_id || ''} onChange={(e) => setWsSettings({ ...wsSettings, meta_capi_pixel_id: e.target.value })} /></div>
                <div><label className="block text-xs font-bold text-ink-tertiary mb-1.5 uppercase">Access Token</label><input className="input" placeholder="Conversions API access token" value={wsSettings.meta_capi_token || ''} onChange={(e) => setWsSettings({ ...wsSettings, meta_capi_token: e.target.value })} /></div>
                <label className="flex items-center justify-between py-2.5 border-b border-surface-border cursor-pointer">
                  <span className="text-sm font-semibold text-ink-secondary">Enable server-side event tracking</span>
                  <input type="checkbox" checked={wsSettings.meta_capi_enabled === true} onChange={(e) => setWsSettings({ ...wsSettings, meta_capi_enabled: e.target.checked })} className="w-5 h-5 accent-blue-500" />
                </label>
              </div>
              <button onClick={handleSaveWsSettings} disabled={saving} className="btn btn-primary w-full"><Save size={16} /> {saving ? 'Saving...' : 'Save Meta CAPI Settings'}</button>
            </div>
          )}

          {/* WhatsApp Business */}
          {tab === 'whatsapp' && (
            <div className="card stagger-in space-y-4">
              <h3 className="text-lg font-bold text-ink-primary">WhatsApp Business</h3>
              <p className="text-sm text-ink-secondary">Configure your WhatsApp Business number for automated messaging.</p>
              <div className="space-y-3">
                <div><label className="block text-xs font-bold text-ink-tertiary mb-1.5 uppercase">WhatsApp Number</label><input className="input" placeholder="+1234567890" value={wsSettings.whatsapp_number || ''} onChange={(e) => setWsSettings({ ...wsSettings, whatsapp_number: e.target.value })} /></div>
                <label className="flex items-center justify-between py-2.5 border-b border-surface-border cursor-pointer">
                  <span className="text-sm font-semibold text-ink-secondary">Enable WhatsApp auto-responder</span>
                  <input type="checkbox" checked={wsSettings.whatsapp_auto_responder_enabled === true} onChange={(e) => setWsSettings({ ...wsSettings, whatsapp_auto_responder_enabled: e.target.checked })} className="w-5 h-5 accent-blue-500" />
                </label>
                <div className="rounded-2xl p-4 border border-surface-border bg-surface-page">
                  <p className="text-xs text-ink-secondary">To connect your WhatsApp Business number, go to <strong className="text-ink-primary">Automations → WhatsApp</strong> and follow the setup guide.</p>
                </div>
              </div>
              <button onClick={handleSaveWsSettings} disabled={saving} className="btn btn-primary w-full"><Save size={16} /> {saving ? 'Saving...' : 'Save WhatsApp Settings'}</button>
            </div>
          )}

          {/* Subscription */}
          {tab === 'subscription' && (
            <div className="card stagger-in space-y-4 text-center">
              <h3 className="text-lg font-bold text-ink-primary">Subscription</h3>
              <p className="text-sm text-ink-secondary">Manage your Zomic subscription and billing.</p>
              <button onClick={() => navigate('/app/billing')} className="btn btn-primary mx-auto">Manage Subscription</button>
            </div>
          )}

          {/* User Guide */}
          {tab === 'user_guide' && (
            <div className="card stagger-in space-y-4">
              <h3 className="text-lg font-bold text-ink-primary">User Guide</h3>
              <div className="space-y-3 text-sm text-ink-secondary">
                <div><strong className="text-ink-primary">Getting Started:</strong> Visit the Welcome page to set up your lead sources, WhatsApp auto-responder, and team.</div>
                <div><strong className="text-ink-primary">Leads:</strong> Add leads manually or receive them automatically from Facebook, Google Forms, WordPress, and more via Automations.</div>
                <div><strong className="text-ink-primary">Email Sequences:</strong> Create multi-step email sequences to automatically follow up with leads.</div>
                <div><strong className="text-ink-primary">WhatsApp:</strong> Send bulk WhatsApp campaigns and set up auto-responders for new leads.</div>
                <div><strong className="text-ink-primary">Team:</strong> Invite team members and set up automatic lead assignment rules.</div>
                <div><strong className="text-ink-primary">Analytics:</strong> Track conversion rates, lead sources, and team performance in real-time.</div>
                <div><strong className="text-ink-primary">Duplicate Leads:</strong> Configure how the system handles duplicate leads from external sources in the Duplicate Leads tab.</div>
              </div>
              <button onClick={() => navigate('/app')} className="btn btn-ghost">Go to Welcome Page</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
