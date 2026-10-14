import { useState, useEffect } from 'react';
import WhatsAppConnect from '../components/WhatsAppConnect';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import API from '../lib/api';
import toast from 'react-hot-toast';
import useAuthStore from '../stores/authStore';

const tabs = [
  { key: 'notifications', label: 'Notifications' },
  { key: 'personalisation', label: 'Personalisation' },
  { key: 'follow_ups', label: 'Follow Ups' },
  { key: 'uncontacted', label: 'Uncontacted Leads' },
  { key: 'duplicate_leads', label: 'Duplicate Leads' },
  { key: 'client_groups', label: 'Client Groups' },
  { key: 'custom_fields', label: 'Custom Fields' },
  { key: 'pixel', label: 'Pixel & Tags' },
  { key: 'meta_capi', label: 'Meta CAPI' },
  { key: 'whatsapp', label: 'WhatsApp' },
  { key: 'subscription', label: 'Subscription' },
  { key: 'account', label: 'Account' },
  { key: 'user_guide', label: 'User Guide' },
];

const notifTypes = [
  { key: 'new_lead', label: 'New Lead Arrived' }, { key: 'follow_up_due', label: 'Follow-up Due' },
  { key: 'follow_up_overdue', label: 'Follow-up Overdue' }, { key: 'whatsapp_reply', label: 'WhatsApp Reply' },
  { key: 'sms_reply', label: 'SMS Reply' }, { key: 'email_opened', label: 'Email Opened' },
  { key: 'email_clicked', label: 'Email Link Clicked' }, { key: 'content_opened', label: 'Content/File Opened' },
  { key: 'lead_won', label: 'Lead Won' }, { key: 'lead_lost', label: 'Lead Lost' },
  { key: 'update_requested', label: 'Update Requested on My Lead' }, { key: 'update_received', label: 'Update Received (requests I sent)' },
];

export default function Settings() {
  const navigate = useNavigate();
  const { user, getProfile, logout } = useAuthStore();
  const [deleteForm, setDeleteForm] = useState({ password: '', confirm: '' });
  const [deleting, setDeleting] = useState(false);
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

  const handleSaveProfile = async (overrides = {}) => {
    setSaving(true);
    try {
      await API.put('/team/profile', { ...form, notification_preferences: { ...notifPrefs, ...overrides } });
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
      <div>
        <h1 className="text-ink-primary" style={{ fontSize: '32px', fontWeight: 650, letterSpacing: '-0.01em' }}>Settings</h1>
        <p className="text-ink-secondary mt-1" style={{ fontSize: '15px' }}>Workspace configuration, your profile, and integrations.</p>
      </div>

      {/* Vertical rail (desktop) / select (mobile) — not tabs-under-title */}
      <div className="grid lg:grid-cols-[190px_1fr] gap-8 items-start">
        <nav className="hidden lg:flex flex-col sticky top-20">
          {tabs.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className="text-left transition-colors"
              style={{
                fontSize: '14px',
                fontWeight: tab === t.key ? 600 : 400,
                color: tab === t.key ? '#1C1917' : '#57534E',
                borderLeft: tab === t.key ? '2px solid #EDE9FF' : '2px solid transparent',
                paddingLeft: '12px',
                paddingBlock: '7px',
              }}
            >
              {t.label}
            </button>
          ))}
        </nav>
        <select className="input lg:hidden" value={tab} onChange={(e) => setTab(e.target.value)}>
          {tabs.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
        </select>

      {/* Tab content — crossfades between panels */}
        <div className="max-w-2xl space-y-4 min-w-0">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={tab}
              initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.16, ease: 'easeOut' }}
            >
        {/* Notifications */}
        {tab === 'notifications' && (
          <div className="space-y-4">
            <div className="space-y-1">
              <h3 className="text-ink-primary" style={{ fontSize: '18px', fontWeight: 600 }}>Notification preferences</h3>
              <p className="text-ink-secondary" style={{ fontSize: '14px' }}>Toggles save instantly — no button to hunt for.</p>
            </div>
            <div className="hairline pt-2">
              {notifTypes.map(n => (
                <label key={n.key} className="flex items-center justify-between py-2.5 hairline-row cursor-pointer group">
                  <span className="text-ink-secondary group-hover:text-ink-primary transition-colors" style={{ fontSize: '14px' }}>{n.label}</span>
                  <input type="checkbox" checked={notifPrefs[n.key] !== false} onChange={(e) => { setNotifPrefs({ ...notifPrefs, [n.key]: e.target.checked }); handleSaveProfile({ [n.key]: e.target.checked }); }} className="w-4 h-4 accent-accent-orange" />
                </label>
              ))}
            </div>
            <div className="hairline pt-4 space-y-2">
              <p className="text-ink-primary" style={{ fontSize: '15px', fontWeight: 600 }}>Ask for updates automatically</p>
              <p className="text-ink-secondary" style={{ fontSize: '13.5px' }}>If an assigned lead has no call, note, message or stage change for this long, Flazyn sends the member an “Update requested” nudge. Managers can also tap <b>Request an update</b> on any lead.</p>
              <select
                className="input" style={{ maxWidth: 240 }}
                value={wsSettings.auto_update_request_days ?? 3}
                onChange={async (e) => {
                  const v = Number(e.target.value);
                  setWsSettings({ ...wsSettings, auto_update_request_days: v });
                  try { await API.put('/analytics/workspace-settings', { auto_update_request_days: v }); toast.success(v ? `Nudges after ${v} day${v > 1 ? 's' : ''} without activity` : 'Automatic nudges off'); }
                  catch { toast.error('Save failed'); }
                }}
              >
                <option value={0}>Off</option>
                {[1, 2, 3, 5, 7, 14].map((d) => <option key={d} value={d}>After {d} day{d > 1 ? 's' : ''} without activity</option>)}
              </select>
            </div>
          </div>
        )}

        {/* Personalisation */}
        {tab === 'personalisation' && (
          <div className="space-y-4">
            <h3 className="text-ink-primary" style={{ fontSize: '18px', fontWeight: 600 }}>Profile & personalisation</h3>
            <div className="hairline pt-4 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div><p className="meta-label mb-1">First name</p><input className="input" placeholder="First name" value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} /></div>
                <div><p className="meta-label mb-1">Last name</p><input className="input" placeholder="Last name" value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} /></div>
              </div>
              <div><p className="meta-label mb-1">Phone</p><input className="input" placeholder="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
              <div><p className="meta-label mb-1">Designation</p><input className="input" placeholder="Designation" value={form.designation} onChange={(e) => setForm({ ...form, designation: e.target.value })} /></div>
              <div><p className="meta-label mb-1">Language</p><select className="input" value={form.language} onChange={(e) => setForm({ ...form, language: e.target.value })}><option value="en">English</option><option value="ur">Urdu</option><option value="ar">Arabic</option></select></div>
              <div className="grid grid-cols-2 gap-4">
                <div><p className="meta-label mb-1">Quiet hours start</p><input type="time" className="input" value={form.quiet_hours_start} onChange={(e) => setForm({ ...form, quiet_hours_start: e.target.value })} /></div>
                <div><p className="meta-label mb-1">Quiet hours end</p><input type="time" className="input" value={form.quiet_hours_end} onChange={(e) => setForm({ ...form, quiet_hours_end: e.target.value })} /></div>
              </div>
            </div>
            <button onClick={handleSaveProfile} disabled={saving} className="btn btn-primary disabled:opacity-50 transition-opacity">{saving ? 'Saving...' : 'Save profile'}</button>
          </div>
        )}

        {/* Follow Ups */}
        {tab === 'follow_ups' && (
          <div className="space-y-4">
            <div className="space-y-1">
              <h3 className="text-ink-primary" style={{ fontSize: '18px', fontWeight: 600 }}>Follow up settings</h3>
              <p className="text-ink-secondary" style={{ fontSize: '14px' }}>Configure default follow-up timing and reminders.</p>
            </div>
            <div className="hairline pt-4 space-y-4">
              <div><p className="meta-label mb-1">Default follow-up delay (hours)</p><input type="number" className="input mono" value={wsSettings.follow_up_delay_hours || 24} onChange={(e) => setWsSettings({ ...wsSettings, follow_up_delay_hours: parseInt(e.target.value) })} /></div>
              <div><p className="meta-label mb-1">Overdue reminder (hours)</p><input type="number" className="input mono" value={wsSettings.follow_up_overdue_hours || 48} onChange={(e) => setWsSettings({ ...wsSettings, follow_up_overdue_hours: parseInt(e.target.value) })} /></div>
              <label className="flex items-center justify-between py-2.5 hairline-row cursor-pointer">
                <span className="text-ink-secondary" style={{ fontSize: '14px' }}>Auto-create follow-up for new leads</span>
                <input type="checkbox" checked={wsSettings.auto_follow_up !== false} onChange={(e) => setWsSettings({ ...wsSettings, auto_follow_up: e.target.checked })} className="w-4 h-4 accent-accent-orange" />
              </label>
            </div>
            <button onClick={handleSaveWsSettings} disabled={saving} className="btn btn-primary disabled:opacity-50 transition-opacity">{saving ? 'Saving...' : 'Save follow up settings'}</button>
          </div>
        )}

        {/* Uncontacted Leads */}
        {tab === 'uncontacted' && (
          <div className="space-y-4">
            <div className="space-y-1">
              <h3 className="text-ink-primary" style={{ fontSize: '18px', fontWeight: 600 }}>Uncontacted leads</h3>
              <p className="text-ink-secondary" style={{ fontSize: '14px' }}>Set rules for leads that haven't been contacted yet.</p>
            </div>
            <div className="hairline pt-4 space-y-4">
              <div><p className="meta-label mb-1">Alert after (hours uncontacted)</p><input type="number" className="input mono" value={wsSettings.uncontacted_alert_hours || 2} onChange={(e) => setWsSettings({ ...wsSettings, uncontacted_alert_hours: parseInt(e.target.value) })} /></div>
              <div><p className="meta-label mb-1">Escalate after (hours uncontacted)</p><input type="number" className="input mono" value={wsSettings.uncontacted_escalate_hours || 6} onChange={(e) => setWsSettings({ ...wsSettings, uncontacted_escalate_hours: parseInt(e.target.value) })} /></div>
              <label className="flex items-center justify-between py-2.5 hairline-row cursor-pointer">
                <span className="text-ink-secondary" style={{ fontSize: '14px' }}>Send push notification for uncontacted leads</span>
                <input type="checkbox" checked={wsSettings.uncontacted_push !== false} onChange={(e) => setWsSettings({ ...wsSettings, uncontacted_push: e.target.checked })} className="w-4 h-4 accent-accent-orange" />
              </label>
            </div>
            <button onClick={handleSaveWsSettings} disabled={saving} className="btn btn-primary disabled:opacity-50 transition-opacity">{saving ? 'Saving...' : 'Save settings'}</button>
          </div>
        )}

        {/* Duplicate Leads */}
        {tab === 'duplicate_leads' && (
          <div className="space-y-4">
            <div className="space-y-1">
              <h3 className="text-ink-primary" style={{ fontSize: '18px', fontWeight: 600 }}>Duplicate lead handling</h3>
              <p className="text-ink-secondary" style={{ fontSize: '14px' }}>When a new lead is received via external lead source integrations and their phone number and/or email matches an existing client:</p>
            </div>
            <div className="hairline pt-4 space-y-4">
              <div>
                <p className="meta-label mb-1">Duplicate handling mode</p>
                <select className="input" value={wsSettings.duplicate_mode || 'warn'} onChange={(e) => setWsSettings({ ...wsSettings, duplicate_mode: e.target.value })}>
                  <option value="warn">Warn only (show duplicate alert)</option>
                  <option value="auto_merge">Auto-merge with existing lead</option>
                  <option value="allow">Allow duplicates (create new lead)</option>
                </select>
              </div>
              <div>
                <p className="meta-label mb-2">Match by</p>
                <div className="space-y-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={wsSettings.duplicate_match_phone !== false} onChange={(e) => setWsSettings({ ...wsSettings, duplicate_match_phone: e.target.checked })} className="w-4 h-4 accent-accent-orange" />
                    <span className="text-ink-secondary" style={{ fontSize: '14px' }}>Phone number</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={wsSettings.duplicate_match_email !== false} onChange={(e) => setWsSettings({ ...wsSettings, duplicate_match_email: e.target.checked })} className="w-4 h-4 accent-accent-orange" />
                    <span className="text-ink-secondary" style={{ fontSize: '14px' }}>Email address</span>
                  </label>
                </div>
              </div>
              <p className="text-ink-tertiary" style={{ fontSize: '12px' }}><span className="text-ink-primary font-medium">Auto-merge</span> will update the existing lead with any new information from the duplicate submission (e.g. new source, additional notes) and log the merge in the lead's activity timeline.</p>
            </div>
            <button onClick={handleSaveWsSettings} disabled={saving} className="btn btn-primary disabled:opacity-50 transition-opacity">{saving ? 'Saving...' : 'Save duplicate settings'}</button>
          </div>
        )}

        {/* Client Groups */}
        {tab === 'client_groups' && (
          <div className="space-y-4">
            <div className="space-y-1">
              <h3 className="text-ink-primary" style={{ fontSize: '18px', fontWeight: 600 }}>Client groups</h3>
              <p className="text-ink-secondary" style={{ fontSize: '14px' }}>Organize leads into groups for bulk actions and campaigns.</p>
            </div>
            <div className="hairline pt-4 flex gap-2">
              <input className="input flex-1" placeholder="Group name" value={newGroup} onChange={(e) => setNewGroup(e.target.value)} />
              <button onClick={handleCreateGroup} className="btn btn-primary">Add</button>
            </div>
            <div className="hairline pt-2">
              {groups.length === 0 ? <p className="text-ink-tertiary py-4 text-center" style={{ fontSize: '13px' }}>No groups yet</p> :
                groups.map(g => (
                  <div key={g.id} className="flex items-center justify-between py-2.5 hairline-row">
                    <div><p className="text-ink-primary" style={{ fontSize: '14px', fontWeight: 500 }}>{g.name}</p><p className="text-ink-tertiary capitalize" style={{ fontSize: '12px' }}>{g.type}</p></div>
                  </div>
                ))
              }
            </div>
          </div>
        )}

        {/* Custom Fields */}
        {tab === 'custom_fields' && (
          <div className="space-y-4">
            <div className="space-y-1">
              <h3 className="text-ink-primary" style={{ fontSize: '18px', fontWeight: 600 }}>Custom fields</h3>
              <p className="text-ink-secondary" style={{ fontSize: '14px' }}>Add custom fields to capture additional lead information.</p>
            </div>
            <div className="hairline pt-4 flex gap-2">
              <input className="input flex-1" placeholder="Field name" value={newField.name} onChange={(e) => setNewField({ ...newField, name: e.target.value })} />
              <select className="input w-32" value={newField.type} onChange={(e) => setNewField({ ...newField, type: e.target.value })}>
                <option value="text">Text</option><option value="number">Number</option><option value="date">Date</option><option value="select">Select</option>
              </select>
              <button onClick={handleCreateField} className="btn btn-primary">Add</button>
            </div>
            <div className="hairline pt-2">
              {customFields.length === 0 ? <p className="text-ink-tertiary py-4 text-center" style={{ fontSize: '13px' }}>No custom fields yet</p> :
                customFields.map(f => (
                  <div key={f.id} className="flex items-center justify-between py-2.5 hairline-row">
                    <div><p className="text-ink-primary" style={{ fontSize: '14px', fontWeight: 500 }}>{f.name}</p><p className="text-ink-tertiary capitalize" style={{ fontSize: '12px' }}>{f.type}</p></div>
                  </div>
                ))
              }
            </div>
          </div>
        )}

        {/* Pixel & Tags */}
        {tab === 'pixel' && (
          <div className="space-y-4">
            <div className="space-y-1">
              <h3 className="text-ink-primary" style={{ fontSize: '18px', fontWeight: 600 }}>Pixel & tags</h3>
              <p className="text-ink-secondary" style={{ fontSize: '14px' }}>Track conversions from your landing pages and lead forms.</p>
            </div>
            <div className="hairline pt-4 space-y-4">
              <div><p className="meta-label mb-1">Facebook Pixel ID</p><input className="input mono" placeholder="e.g. 123456789012345" value={wsSettings.facebook_pixel_id || ''} onChange={(e) => setWsSettings({ ...wsSettings, facebook_pixel_id: e.target.value })} /></div>
              <div><p className="meta-label mb-1">Google Tag Manager ID</p><input className="input mono" placeholder="e.g. GTM-XXXXXXX" value={wsSettings.google_tag_id || ''} onChange={(e) => setWsSettings({ ...wsSettings, google_tag_id: e.target.value })} /></div>
              <div><p className="meta-label mb-1">Google Analytics ID</p><input className="input mono" placeholder="e.g. G-XXXXXXXXXX" value={wsSettings.google_analytics_id || ''} onChange={(e) => setWsSettings({ ...wsSettings, google_analytics_id: e.target.value })} /></div>
            </div>
            <button onClick={handleSaveWsSettings} disabled={saving} className="btn btn-primary disabled:opacity-50 transition-opacity">{saving ? 'Saving...' : 'Save tracking IDs'}</button>
          </div>
        )}

        {/* Meta CAPI */}
        {tab === 'meta_capi' && (
          <div className="space-y-4">
            <div className="space-y-1">
              <h3 className="text-ink-primary" style={{ fontSize: '18px', fontWeight: 600 }}>Meta Conversions API</h3>
              <p className="text-ink-secondary" style={{ fontSize: '14px' }}>Send conversion events directly to Meta via server-side API.</p>
            </div>
            <div className="hairline pt-4 space-y-4">
              <div><p className="meta-label mb-1">Meta Pixel ID</p><input className="input mono" placeholder="Pixel ID" value={wsSettings.meta_capi_pixel_id || ''} onChange={(e) => setWsSettings({ ...wsSettings, meta_capi_pixel_id: e.target.value })} /></div>
              <div><p className="meta-label mb-1">Access token</p><input className="input mono" placeholder="Conversions API access token" value={wsSettings.meta_capi_token || ''} onChange={(e) => setWsSettings({ ...wsSettings, meta_capi_token: e.target.value })} /></div>
              <label className="flex items-center justify-between py-2.5 hairline-row cursor-pointer">
                <span className="text-ink-secondary" style={{ fontSize: '14px' }}>Enable server-side event tracking</span>
                <input type="checkbox" checked={wsSettings.meta_capi_enabled === true} onChange={(e) => setWsSettings({ ...wsSettings, meta_capi_enabled: e.target.checked })} className="w-4 h-4 accent-accent-orange" />
              </label>
            </div>
            <button onClick={handleSaveWsSettings} disabled={saving} className="btn btn-primary disabled:opacity-50 transition-opacity">{saving ? 'Saving...' : 'Save Meta CAPI settings'}</button>
          </div>
        )}

        {/* WhatsApp */}
        {tab === 'whatsapp' && (
          <div className="space-y-4">
            <div className="space-y-1">
              <h3 className="text-ink-primary" style={{ fontSize: '18px', fontWeight: 600 }}>WhatsApp Business</h3>
              <p className="text-ink-secondary" style={{ fontSize: '14px' }}>Connect the number your team messages leads from.</p>
            </div>
            <WhatsAppConnect />
            <div className="hairline pt-4 space-y-4">
              <button type="button" onClick={() => navigate('/app/automations/whatsapp-auto-responder')} className="w-full flex items-center justify-between py-2.5 hairline-row text-ink-secondary hover:text-ink-primary" style={{ fontSize: '14px' }}>
                <span>Auto-responder, working hours and away message</span>
                <span className="text-ink-primary font-medium">Open →</span>
              </button>
            </div>
          </div>
        )}

        {/* Subscription */}
        {tab === 'subscription' && (
          <div className="space-y-4">
            <div className="space-y-1">
              <h3 className="text-ink-primary" style={{ fontSize: '18px', fontWeight: 600 }}>Subscription</h3>
              <p className="text-ink-secondary" style={{ fontSize: '14px' }}>Manage your Flazyn subscription and billing.</p>
            </div>
            <div className="hairline pt-4">
              <button onClick={() => navigate('/app/billing')} className="text-ink-primary hover:text-accent-deep underline underline-offset-4 transition-colors" style={{ fontSize: '14px' }}>Manage subscription →</button>
            </div>
          </div>
        )}

        {/* Account */}
        {tab === 'account' && (
          <div className="space-y-4">
            <div className="space-y-1">
              <h3 className="text-ink-primary" style={{ fontSize: '18px', fontWeight: 600 }}>Delete account</h3>
              <p className="text-ink-secondary" style={{ fontSize: '14px' }}>
                Your login is disabled immediately. If you are the last member of this workspace, the workspace and all of its leads,
                messages and files are permanently deleted after 30 days. Otherwise your leads stay with your team.
              </p>
            </div>
            <div className="hairline pt-4 space-y-3 max-w-sm">
              <div>
                <p className="meta-label mb-1">Password (leave empty if you sign in with Google)</p>
                <input type="password" className="input" value={deleteForm.password} onChange={(e) => setDeleteForm({ ...deleteForm, password: e.target.value })} />
              </div>
              <div>
                <p className="meta-label mb-1">Type DELETE to confirm</p>
                <input className="input" value={deleteForm.confirm} onChange={(e) => setDeleteForm({ ...deleteForm, confirm: e.target.value })} />
              </div>
              <button
                disabled={deleting || deleteForm.confirm !== 'DELETE'}
                onClick={async () => {
                  setDeleting(true);
                  try {
                    const res = await API.delete('/team/account', { data: { password: deleteForm.password, confirm: deleteForm.confirm } });
                    toast.success(res.data.message);
                    await logout();
                    navigate('/');
                  } catch (err) {
                    toast.error(err.response?.data?.error || 'Could not delete account');
                  } finally {
                    setDeleting(false);
                  }
                }}
                className="btn disabled:opacity-50"
                style={{ background: 'var(--coral-deep)', color: '#fff' }}
              >
                {deleting ? 'Deleting…' : 'Delete my account'}
              </button>
            </div>
          </div>
        )}

        {/* User Guide */}
        {tab === 'user_guide' && (
          <div className="space-y-4">
            <h3 className="text-ink-primary" style={{ fontSize: '18px', fontWeight: 600 }}>User guide</h3>
            <div className="hairline pt-4 space-y-3">
              {[
                { label: 'Getting Started', text: 'Visit the Welcome page to set up your lead sources, WhatsApp auto-responder, and team.' },
                { label: 'Leads', text: 'Add leads manually or receive them automatically from Facebook, Google Forms, WordPress, and more via Automations.' },
                { label: 'Email Sequences', text: 'Create multi-step email sequences to automatically follow up with leads.' },
                { label: 'WhatsApp', text: 'Send bulk WhatsApp campaigns and set up auto-responders for new leads.' },
                { label: 'Team', text: 'Invite team members and set up automatic lead assignment rules.' },
                { label: 'Analytics', text: 'Track conversion rates, lead sources, and team performance in real-time.' },
                { label: 'Duplicate Leads', text: 'Configure how the system handles duplicate leads from external sources in the Duplicate Leads tab.' },
              ].map(item => (
                <div key={item.label} className="text-ink-secondary" style={{ fontSize: '14px' }}>
                  <span className="text-ink-primary font-medium">{item.label}:</span> {item.text}
                </div>
              ))}
            </div>
            <button onClick={() => navigate('/app')} className="text-ink-primary hover:text-accent-deep underline underline-offset-4 transition-colors" style={{ fontSize: '14px' }}>Go to welcome page →</button>
          </div>
        )}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
