import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bell, LogOut, Search, Plus, Settings as SettingsIcon, CreditCard, X, HelpCircle,
  Users, Inbox, FolderOpen, UsersRound, BarChart3, Zap, LayoutGrid, Megaphone,
  Flame, Home, PanelLeftClose, PanelLeftOpen, ChevronRight, Mail, Workflow, BarChart2, Shapes, MessageCircle, Sparkles,
} from 'lucide-react';
import useAuthStore from '../stores/authStore';
import useCreateRegistry from '../stores/createStore';
import API from '../lib/api';
import { WinBurst, EASE_SOFT } from '../lib/motion';
import { avatarTone } from '../lib/avatar';
import { formatWait, useNow } from './ui';
import { useLiveAlerts } from '../lib/liveAlerts';

/* ═══════════════════════════════════════════════════════════════
   WORKSPACE SHELL
   Top bar: logo, one big search, Create, help, alerts, you.
   Left: a light sidebar of plain-language places, each with a small
   colour tile so it's easy to find again. A sunshine card shows how
   many new leads are waiting. Phones get a light bottom bar.
   ═══════════════════════════════════════════════════════════════ */

const NAV = [
  {
    group: 'Sell',
    items: [
      { to: '/app/dashboard', label: 'Overview', hint: 'Your day at a glance', icon: LayoutGrid, tone: 'violet' },
      { to: '/app/leads', label: 'Pipeline', hint: 'Everyone who enquired', icon: Users, tone: 'sky' },
      { to: '/app/engagement', label: 'Hot leads', hint: 'Who is reading & clicking', icon: Flame, tone: 'sun' },
      { to: '/app/insights', label: 'AI insights', hint: 'Risks, comebacks, ad returns', icon: Sparkles, tone: 'violet' },
      { to: '/app/mailbox', label: 'Inbox', hint: 'Messages between your team', icon: MessageCircle, tone: 'teal', badge: 'mail' },
    ],
  },
  {
    group: 'Grow',
    items: [
      {
        to: '/app/marketing/flows', label: 'Campaigns', hint: 'Campaigns & follow-up flows', icon: Mail, tone: 'peach',
        match: (p) => p.startsWith('/app/marketing'),
        subNav: [
          { to: '/app/marketing/flows', label: 'Flows' },
          { to: '/app/marketing/campaigns', label: 'Campaigns' },
          { to: '/app/marketing/emails', label: 'Email designs' },
          { to: '/app/marketing/segments', label: 'Lead lists' },
          { to: '/app/marketing/analytics', label: 'Results' },
        ],
      },
      { to: '/app/templates', label: 'Templates', hint: 'Ready-made forms & messages', icon: Shapes, tone: 'lilac' },
      { to: '/app/content', label: 'Files', hint: 'Brochures you can track', icon: FolderOpen, tone: 'mint' },
    ],
  },
  {
    group: 'Set up',
    items: [
      { to: '/app/automations', label: 'Automations', hint: 'Let Flazyn do the busywork', icon: Workflow, tone: 'violet' },
      { to: '/app/analytics', label: 'Reports', hint: 'How the team is doing', icon: BarChart2, tone: 'sky' },
      { to: '/app/team', label: 'Team', hint: 'Invite & manage people', icon: UsersRound, tone: 'mint' },
    ],
  },
];

const ALL_ITEMS = NAV.flatMap((g) => g.items);

const MOBILE_TABS = [
  { to: '/app/dashboard', label: 'Overview', icon: LayoutGrid },
  { to: '/app/leads', label: 'Pipeline', icon: Users },
  null,
  { to: '/app/engagement', label: 'Hot', icon: Flame },
  { to: '/app/automations', label: 'More', icon: Zap },
];

const SEARCHABLE = [
  ...ALL_ITEMS.flatMap((i) => [{ to: i.to, label: i.label }, ...(i.subNav || [])]),
  { to: '/app', label: 'Getting started' },
  { to: '/app/settings', label: 'Settings' },
  { to: '/app/billing', label: 'Billing' },
];

const isOn = (item, path) => (item.match ? item.match(path) : path === item.to || path.startsWith(item.to + '/'));

export default function Layout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuthStore();
  const createActions = useCreateRegistry((s) => s.actions);
  const [notifications, setNotifications] = useState([]);
  const [showNotif, setShowNotif] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showCreateMenu, setShowCreateMenu] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [paletteQuery, setPaletteQuery] = useState('');
  const [mailUnread, setMailUnread] = useState(0);
  const [isTeam, setIsTeam] = useState(false);
  const [demo, setDemo] = useState(null);
  useEffect(() => { API.get('/demo/me').then((r) => setDemo(r.data.demo ? r.data : null)).catch(() => {}); }, []);
  useEffect(() => { API.get('/connections').then((r) => setIsTeam(!!r.data.is_platform_admin)).catch(() => {}); }, []);
  const [leadResults, setLeadResults] = useState([]);
  const [waiting, setWaiting] = useState({ count: 0, oldest: null, loaded: false });
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem('flazyn:console') === 'collapsed'; } catch { return false; }
  });
  const paletteInputRef = useRef(null);
  const now = useNow(30000);
  const openLead = useCallback((id) => navigate(`/app/leads/${id}`), [navigate]);
  useLiveAlerts(openLead);

  useEffect(() => {
    const load = () => { loadNotifications(); loadMailUnread(); loadWaiting(); };
    load();
    const t = setInterval(load, 30000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const handler = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); setPaletteOpen(true); }
      if (e.key === 'Escape') { setPaletteOpen(false); setShowNotif(false); setShowUserMenu(false); setShowCreateMenu(false); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  useEffect(() => {
    if (paletteOpen) setTimeout(() => paletteInputRef.current?.focus(), 50);
    else setPaletteQuery('');
  }, [paletteOpen]);

  useEffect(() => { setShowNotif(false); setShowUserMenu(false); setShowCreateMenu(false); loadWaiting(); }, [location.pathname]);

  useEffect(() => {
    const close = () => { setShowCreateMenu(false); setShowUserMenu(false); };
    window.addEventListener('click', close);
    return () => window.removeEventListener('click', close);
  }, []);

  useEffect(() => {
    if (!paletteOpen || paletteQuery.trim().length < 2) { setLeadResults([]); return; }
    const t = setTimeout(async () => {
      try {
        const res = await API.get(`/leads?search=${encodeURIComponent(paletteQuery)}&limit=5`);
        setLeadResults(res.data.leads || []);
      } catch { setLeadResults([]); }
    }, 200);
    return () => clearTimeout(t);
  }, [paletteQuery, paletteOpen]);

  const loadNotifications = async () => {
    try { const res = await API.get('/analytics/notifications?unread_only=true'); setNotifications(res.data.notifications || []); } catch {}
  };
  const markAllRead = async () => {
    try { await API.put('/analytics/notifications/read-all'); setNotifications([]); } catch {}
  };
  const loadMailUnread = async () => {
    try { const res = await API.get('/flazyn-mail/unread-count'); setMailUnread(res.data.unreadCount || 0); } catch {}
  };
  const loadWaiting = async () => {
    try {
      const res = await API.get('/leads', { params: { stage: 'new', sort: 'oldest', limit: 1 } });
      setWaiting({ count: res.data.pagination?.total || 0, oldest: res.data.leads?.[0]?.created_at || null, loaded: true });
    } catch {}
  };

  const toggleCollapsed = () => {
    const next = !collapsed;
    setCollapsed(next);
    try { localStorage.setItem('flazyn:console', next ? 'collapsed' : 'open'); } catch {}
  };

  const handleLogout = async () => { await logout(); navigate('/login'); };

  const filteredPages = SEARCHABLE.filter((i) => i.label.toLowerCase().includes(paletteQuery.toLowerCase()));
  const activeItem = ALL_ITEMS.find((i) => isOn(i, location.pathname));
  const subNav = activeItem?.subNav || null;

  const userTone = avatarTone(`${user?.firstName || ''}${user?.lastName || ''}`);
  const userInitials = `${(user?.firstName || 'U')[0]}${(user?.lastName || '')[0] || ''}`.toUpperCase();
  const oldestMins = waiting.oldest ? (now - new Date(waiting.oldest).getTime()) / 60000 : 0;
  const urgent = waiting.count > 0 && oldestMins > 15;
  const width = collapsed ? 76 : 248;

  return (
    <div className="h-screen flex flex-col" style={{ background: 'var(--canvas)' }}>

      {/* ───────────── TOP BAR ───────────── */}
      <header className="flex-shrink-0 flex items-center" style={{ height: 64, padding: '0 16px 0 14px', gap: 12, background: '#FFFFFF', borderBottom: '1px solid var(--hairline)', zIndex: 30 }}>
        <button onClick={() => navigate('/app/dashboard')} className="flex items-center flex-shrink-0" style={{ gap: 10, width: collapsed ? 'auto' : 220 }} title="Flazyn home">
          <span className="flex items-center justify-center" style={{ width: 30, height: 30, borderRadius: 9, background: 'linear-gradient(135deg, #7C5CFF 0%, #5B3DF5 55%, #E255C9 130%)', color: '#fff', boxShadow: '0 4px 10px -4px rgba(91,61,245,0.6)' }}><FlazynMark size={16} /></span>
          <span className="hidden sm:inline" style={{ fontSize: 17, fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--ink)' }}>
            Flazyn
          </span>
        </button>

        <button onClick={toggleCollapsed} className="hidden lg:flex items-center justify-center flex-shrink-0 row-action" style={{ width: 36, height: 36, borderRadius: 10 }} title={collapsed ? 'Show menu labels' : 'Hide menu labels'}>
          {collapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
        </button>

        <div className="flex-1 flex justify-center min-w-0">
          <button onClick={() => setPaletteOpen(true)} className="flex items-center w-full" style={{ maxWidth: 560, height: 42, gap: 10, padding: '0 14px', background: '#FAFAF9', border: '1px solid var(--hairline)', borderRadius: 10, color: 'var(--ink-3)', fontSize: 13.5 }}>
            <Search size={17} />
            <span className="flex-1 text-left truncate">Search leads, phone numbers or pages…</span>
            <kbd className="hidden md:inline" style={{ fontSize: 11, fontWeight: 700, background: '#fff', border: '1px solid var(--hairline-strong)', borderRadius: 6, padding: '1px 6px', color: 'var(--ink-2)' }}>Ctrl K</kbd>
          </button>
        </div>

        <div className="relative flex-shrink-0 hidden md:block" onClick={(e) => e.stopPropagation()}>
          <button onClick={() => setShowCreateMenu(!showCreateMenu)} className="btn btn-primary" style={{ height: 40 }}>
            <motion.span animate={{ rotate: showCreateMenu ? 45 : 0 }} transition={{ duration: 0.2 }} className="flex"><Plus size={17} strokeWidth={2.6} /></motion.span>
            Create
          </button>
          <CreateMenu open={showCreateMenu} actions={createActions} onClose={() => setShowCreateMenu(false)} style={{ right: 0, top: 48 }} />
        </div>

        <TopIcon title="Help & guides" onClick={() => navigate('/app')}><HelpCircle size={19} /></TopIcon>
        <TopIcon title="Alerts" onClick={() => setShowNotif(!showNotif)}>
          <Bell size={19} />
          {notifications.length > 0 && (
            <span className="absolute" style={{ top: 4, right: 4, minWidth: 17, height: 17, padding: '0 4px', borderRadius: 999, background: 'var(--ember)', color: '#fff', fontSize: 10.5, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {notifications.length > 9 ? '9+' : notifications.length}
            </span>
          )}
        </TopIcon>

        <div className="relative flex-shrink-0" onClick={(e) => e.stopPropagation()}>
          <button onClick={() => setShowUserMenu(!showUserMenu)} className="flex items-center" style={{ gap: 8 }} title="Your account">
            <span className="flex items-center justify-center" style={{ width: 38, height: 38, borderRadius: 999, background: userTone.bg, color: userTone.fg, fontSize: 14, fontWeight: 800, boxShadow: '0 0 0 2px #fff, 0 0 0 4px var(--hairline)' }}>{userInitials}</span>
          </button>
          <AnimatePresence>
            {showUserMenu && (
              <motion.div
                initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.16, ease: EASE_SOFT }}
                className="absolute z-50 popover popover-flush"
                style={{ top: 48, right: 0, width: 240 }}
              >
                <div style={{ padding: '10px 12px 12px' }}>
                  <p style={{ fontWeight: 800, fontSize: 14.5 }}>{user?.firstName} {user?.lastName}</p>
                  <p className="capitalize" style={{ fontSize: 12.5, color: 'var(--ink-3)' }}>{user?.role?.replace('_', ' ')}</p>
                </div>
                <div className="hairline" style={{ margin: '0 0 4px' }} />
                {[
                  { icon: SettingsIcon, label: 'Settings', to: '/app/settings' },
                  { icon: CreditCard, label: 'Plan & billing', to: '/app/billing' },
                  { icon: HelpCircle, label: 'Getting started', to: '/app' },
                  ...(isTeam ? [{ icon: Workflow, label: 'Flazyn team · Connections', to: '/app/admin/connections' }, { icon: Zap, label: 'Flazyn team · Demo QR', to: '/app/admin/demo' }] : []),
                ].map((m) => (
                  <MenuItem key={m.to} icon={m.icon} onClick={() => { navigate(m.to); setShowUserMenu(false); }}>{m.label}</MenuItem>
                ))}
                <div className="hairline" style={{ margin: '4px 0' }} />
                <MenuItem icon={LogOut} onClick={handleLogout}>Sign out</MenuItem>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </header>

      <div className="flex-1 flex min-h-0">
        {/* ───────────── SIDEBAR ───────────── */}
        <aside
          className="hidden lg:flex flex-col flex-shrink-0"
          style={{ width, background: '#FAFAF9', borderRight: '1px solid var(--hairline)', transition: 'width 220ms cubic-bezier(0.22,1,0.36,1)' }}
        >
          {/* waiting-on-you card */}
          <button
            onClick={() => navigate('/app/leads?tab=uncontacted')}
            className="text-left"
            style={{
              margin: collapsed ? '14px 12px 8px' : '14px 14px 8px', padding: collapsed ? '10px 0' : '14px 16px', borderRadius: 14,
              background: '#FFFFFF', border: '1px solid var(--hairline)', boxShadow: '0 1px 2px rgba(28,25,23,0.04)',
            }}
            title="New leads nobody has contacted yet"
          >
            {collapsed ? (
              <span className="flex flex-col items-center" style={{ gap: 2 }}>
                <span style={{ fontSize: 18, fontWeight: 800, color: waiting.count ? '#8A5A00' : 'var(--ink-3)' }}>{waiting.count}</span>
                <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--ink-3)' }}>waiting</span>
              </span>
            ) : (
              <>
                <span className="flex items-center justify-between">
                  <span style={{ fontSize: 12.5, fontWeight: 700, color: waiting.count ? '#8A5A00' : 'var(--ink-3)' }}>
                    {!waiting.loaded ? 'Checking new leads…' : waiting.count ? 'New leads waiting for you' : 'Everyone has been contacted'}
                  </span>
                  {waiting.count > 0 && <span className={`heat-dot ${urgent ? 'heat-live' : ''}`} style={{ background: 'var(--ember)' }} />}
                </span>
                <span className="flex items-baseline" style={{ gap: 8, marginTop: 4 }}>
                  <span style={{ fontSize: 30, fontWeight: 800, lineHeight: 1.05, letterSpacing: '-0.03em', color: waiting.count ? 'var(--ink)' : 'var(--ink-3)' }}>{waiting.loaded ? waiting.count : '…'}</span>
                  <span style={{ fontSize: 12.5, fontWeight: 600, color: urgent ? '#8A5A00' : 'var(--ink-3)' }}>
                    {!waiting.loaded ? '' : waiting.count ? `oldest ${formatWait(oldestMins)} ago` : 'all done'}
                  </span>
                </span>
                {waiting.count > 0 && <span className="flex items-center" style={{ marginTop: 8, fontSize: 12.5, fontWeight: 800, color: 'var(--brand-deep)' }}>Contact them now <ChevronRight size={14} /></span>}
              </>
            )}
          </button>

          <nav className="flex-1 overflow-y-auto no-scrollbar" style={{ padding: '6px 12px 12px' }}>
            {NAV.map((g) => (
              <div key={g.group} style={{ marginBottom: 14 }}>
                {!collapsed && <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--ink-3)', padding: '8px 10px 6px', letterSpacing: '0.06em', textTransform: 'uppercase' }}>{g.group}</p>}
                {collapsed && <div className="hairline" style={{ margin: '8px 6px' }} />}
                {g.items.map((item) => {
                  const on = isOn(item, location.pathname);
                  return (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      title={collapsed ? `${item.label} — ${item.hint}` : item.hint}
                      className={`console-link relative ${on ? 'console-link-active' : ''}`}
                      style={collapsed ? { justifyContent: 'center', padding: '4px 0' } : { marginBottom: 2 }}
                    >
                      <item.icon size={17} strokeWidth={1.8} className="flex-shrink-0" />
                      {!collapsed && <span className="flex-1 truncate">{item.label}</span>}
                      {(() => {
                        const n = item.badge === 'mail' ? mailUnread : item.to === '/app/leads' ? waiting.count : 0;
                        if (!n) return null;
                        return <span className="count-pill" style={collapsed ? { position: 'absolute', top: -2, right: -2 } : undefined}>{n > 99 ? '99+' : n}</span>;
                      })()}
                    </NavLink>
                  );
                })}
              </div>
            ))}
          </nav>

          <div style={{ padding: 12, borderTop: '1px solid var(--hairline)' }}>
            <NavLink to="/app/settings" className={`console-link ${location.pathname.startsWith('/app/settings') ? 'console-link-active' : ''}`} style={collapsed ? { justifyContent: 'center' } : undefined} title="Settings">
              <SettingsIcon size={17} strokeWidth={1.8} />
              {!collapsed && <span>Settings</span>}
            </NavLink>
          </div>
        </aside>

        {/* ───────────── WORKSPACE ───────────── */}
        <div className="flex-1 flex flex-col min-w-0">
          {subNav && (
            <div className="flex-shrink-0 no-scrollbar overflow-x-auto flex items-center" style={{ gap: 4, padding: '10px 24px', background: '#FFFFFF', borderBottom: '1px solid var(--hairline)' }}>
              {subNav.map((sub) => {
                const on = location.pathname === sub.to || location.pathname.startsWith(sub.to + '/');
                return <NavLink key={sub.to} to={sub.to} className={`nav-link ${on ? 'nav-link-active' : ''}`}>{sub.label}</NavLink>;
              })}
            </div>
          )}

          {demo && (
            <div className="flex-shrink-0 flex items-center gap-3 flex-wrap" style={{ padding: '10px 24px', background: '#F3F0FF', borderBottom: '1px solid #DDD6FE', fontSize: 13.5 }}>
              <span>✨ <b>Demo workspace</b>: nothing is really sent, and it deletes itself {demo.expires_at ? `in ${Math.max(1, Math.round((new Date(demo.expires_at) - Date.now()) / 3600000))}h` : 'tomorrow'}.</span>
              <button onClick={() => navigate('/demo')} style={{ fontWeight: 700, color: 'var(--brand-deep)' }}>Send a test lead</button>
              <button onClick={() => navigate('/signup')} className="btn btn-primary btn-sm ml-auto">Start free trial</button>
            </div>
          )}
          <main className="flex-1 overflow-y-auto">
            <div className="px-4 sm:px-6 lg:px-8" style={{ maxWidth: 1360, margin: '0 auto', paddingTop: 26, paddingBottom: 64 }}>
              <motion.div key={location.pathname} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2, ease: EASE_SOFT }}>
                <Outlet />
              </motion.div>
            </div>
            <div className="lg:hidden" style={{ height: 90 }} />
          </main>
        </div>
      </div>

      {/* ───────────── ALERTS ───────────── */}
      <AnimatePresence>
        {showNotif && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-40" style={{ background: 'rgba(28,25,23,0.18)' }} onClick={() => setShowNotif(false)} />
            <motion.div
              initial={{ x: 400 }} animate={{ x: 0 }} exit={{ x: 400 }} transition={{ duration: 0.25, ease: EASE_SOFT }}
              className="fixed z-50 overflow-y-auto"
              style={{ top: 0, right: 0, bottom: 0, width: 'min(400px, 100vw)', background: '#FFFFFF', boxShadow: 'var(--sh-modal)' }}
            >
              <div className="sticky top-0 flex items-center justify-between" style={{ background: '#FFFFFF', padding: '20px 20px 14px', borderBottom: '1px solid var(--hairline)' }}>
                <p style={{ fontSize: 20, fontWeight: 800 }}>Alerts</p>
                <div className="flex items-center" style={{ gap: 12 }}>
                  {notifications.length > 0 && <button onClick={markAllRead} style={{ fontSize: 13, fontWeight: 700, color: 'var(--brand-deep)' }}>Mark all as read</button>}
                  <button onClick={() => setShowNotif(false)} className="row-action"><X size={18} /></button>
                </div>
              </div>
              {notifications.length === 0 ? (
                <div className="text-center" style={{ padding: '64px 24px' }}>
                  <p style={{ fontSize: 34 }}>🔔</p>
                  <p style={{ fontSize: 18, fontWeight: 800, marginTop: 8 }}>You're all caught up</p>
                  <p className="t-body-sm" style={{ color: 'var(--ink-2)', marginTop: 4 }}>New leads, replies and follow-up reminders show up here.</p>
                </div>
              ) : (
                notifications.map((n) => {
                  const data = typeof n.data === 'string' ? (() => { try { return JSON.parse(n.data); } catch { return {}; } })() : (n.data || {});
                  return (
                    <button
                      key={n.id}
                      onClick={() => { if (data.leadId) { navigate(`/app/leads/${data.leadId}`); setShowNotif(false); } }}
                      className="w-full text-left flex"
                      style={{ gap: 12, padding: '14px 20px', borderBottom: '1px solid var(--hairline)' }}
                    >
                      <span className="heat-dot" style={{ marginTop: 6, background: /lead|read|view|follow/.test(n.type) ? 'var(--ember)' : 'var(--brand)' }} />
                      <span className="min-w-0 flex-1">
                        <span className="block" style={{ fontSize: 14, fontWeight: 700 }}>{n.title}</span>
                        <span className="block t-body-sm" style={{ color: 'var(--ink-2)' }}>{n.body}</span>
                        {n.created_at && <span className="block" style={{ color: 'var(--ink-3)', fontSize: 12, marginTop: 4 }}>{formatWait((now - new Date(n.created_at).getTime()) / 60000)} ago</span>}
                      </span>
                    </button>
                  );
                })
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <WinBurst />

      {/* ───────────── PHONE BAR ───────────── */}
      <nav
        className="lg:hidden fixed z-40 flex items-center justify-around"
        style={{ left: 10, right: 10, bottom: 'calc(10px + env(safe-area-inset-bottom))', height: 66, background: '#FFFFFF', borderRadius: 18, border: '1px solid var(--hairline)', boxShadow: '0 18px 40px -18px rgba(28,25,23,0.35)' }}
      >
        {MOBILE_TABS.map((tab, i) => {
          if (!tab) {
            return (
              <div key="create" className="relative" onClick={(e) => e.stopPropagation()}>
                <button onClick={() => setShowCreateMenu(!showCreateMenu)} className="flex items-center justify-center" style={{ width: 50, height: 50, borderRadius: 16, background: 'var(--brand)', color: '#fff', boxShadow: '0 8px 18px -8px rgba(91,61,245,0.7)' }} aria-label="Create">
                  <motion.span animate={{ rotate: showCreateMenu ? 45 : 0 }} className="flex"><Plus size={24} strokeWidth={2.6} /></motion.span>
                </button>
                <CreateMenu open={showCreateMenu} actions={createActions} onClose={() => setShowCreateMenu(false)} style={{ bottom: 62, left: -100 }} />
              </div>
            );
          }
          const on = location.pathname.startsWith(tab.to);
          return (
            <NavLink key={tab.to + i} to={tab.to} className="flex flex-col items-center justify-center relative" style={{ gap: 3, width: 60, color: on ? 'var(--brand-deep)' : 'var(--ink-3)' }}>
              <tab.icon size={21} strokeWidth={on ? 2.5 : 2} />
              <span style={{ fontSize: 11, fontWeight: 700 }}>{tab.label}</span>
              {tab.to === '/app/leads' && waiting.count > 0 && (
                <span className="absolute" style={{ top: -2, right: 8, fontSize: 10, fontWeight: 800, background: 'var(--ember)', color: '#fff', borderRadius: 999, padding: '0 5px' }}>{waiting.count}</span>
              )}
            </NavLink>
          );
        })}
      </nav>

      {/* ───────────── SEARCH ───────────── */}
      <AnimatePresence>
        {paletteOpen && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}
            className="fixed inset-0 z-50 flex items-start justify-center"
            style={{ background: 'rgba(28,25,23,0.25)', paddingTop: '12vh' }}
            onClick={() => setPaletteOpen(false)}
          >
            <motion.div
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.18, ease: EASE_SOFT }}
              className="w-full overflow-hidden"
              style={{ maxWidth: 600, background: '#FFFFFF', borderRadius: 18, boxShadow: 'var(--sh-modal)', margin: '0 16px' }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center" style={{ gap: 12, padding: '16px 20px', borderBottom: '1px solid var(--hairline)' }}>
                <Search size={19} style={{ color: 'var(--brand)' }} />
                <input ref={paletteInputRef} value={paletteQuery} onChange={(e) => setPaletteQuery(e.target.value)} placeholder="Type a name, phone number or page…" className="flex-1 outline-none" style={{ background: 'transparent', border: 'none', fontSize: 16, fontWeight: 600 }} />
                <kbd style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-3)', border: '1px solid var(--hairline-strong)', borderRadius: 6, padding: '1px 6px' }}>Esc</kbd>
              </div>
              <div className="overflow-y-auto" style={{ maxHeight: 400, padding: 8 }}>
                {leadResults.length > 0 && (
                  <>
                    <p className="meta-label" style={{ padding: '8px 12px' }}>Leads</p>
                    {leadResults.map((l) => {
                      const tone = avatarTone(`${l.first_name || ''}${l.last_name || ''}`);
                      return (
                        <PaletteRow key={l.id} onClick={() => { navigate(`/app/leads/${l.id}`); setPaletteOpen(false); }}>
                          <span className="flex items-center justify-center flex-shrink-0" style={{ background: tone.bg, color: tone.fg, width: 30, height: 30, borderRadius: 999, fontSize: 13, fontWeight: 800 }}>{(l.first_name || '?')[0]?.toUpperCase()}</span>
                          <span className="truncate" style={{ fontWeight: 700 }}>{l.first_name} {l.last_name}</span>
                          <span className="ml-auto flex-shrink-0" style={{ color: 'var(--ink-3)', fontSize: 13 }}>{l.phone || l.email || ''}</span>
                        </PaletteRow>
                      );
                    })}
                  </>
                )}
                <p className="meta-label" style={{ padding: '8px 12px' }}>Go to</p>
                {filteredPages.length === 0 && leadResults.length === 0 && <p className="t-body-sm text-center" style={{ color: 'var(--ink-3)', padding: '28px 12px' }}>Nothing matches that.</p>}
                {filteredPages.map((item) => (
                  <PaletteRow key={item.to + item.label} onClick={() => { navigate(item.to); setPaletteOpen(false); }}>
                    <span style={{ color: 'var(--ink)', fontWeight: 600 }}>{item.label}</span>
                    <ChevronRight size={15} className="ml-auto" style={{ color: 'var(--ink-3)' }} />
                  </PaletteRow>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* The mark: a lightning-cut F — a flash, for speed-to-lead. */
export function FlazynMark({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M6 3h12v4h-7.2l-.8 3.2H16l-1 4h-6l-1.4 6.8H3.6L6 3z" fill="currentColor" />
    </svg>
  );
}

function TopIcon({ children, title, onClick }) {
  return (
    <button onClick={onClick} title={title} className="relative flex items-center justify-center flex-shrink-0" style={{ width: 40, height: 40, borderRadius: 12, color: 'var(--ink-2)' }}
      onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--canvas)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}>
      {children}
    </button>
  );
}

function MenuItem({ icon: Icon, children, onClick }) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center text-left"
      style={{ gap: 10, padding: '9px 12px', borderRadius: 10, fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}
      onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--canvas)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
    >
      <Icon size={16} style={{ color: 'var(--ink-3)' }} /> {children}
    </button>
  );
}

function PaletteRow({ children, onClick }) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center text-left"
      style={{ gap: 12, padding: '10px 12px', borderRadius: 10, fontSize: 14 }}
      onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--canvas)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
    >
      {children}
    </button>
  );
}

function CreateMenu({ open, actions, onClose, style }) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.16 }}
          className="absolute z-50 popover popover-flush"
          style={{ width: 260, ...style }}
        >
          {actions.length === 0 ? (
            <p className="t-body-sm" style={{ color: 'var(--ink-3)', padding: 12 }}>Nothing to create on this page.</p>
          ) : actions.map((a) => (
            <button
              key={a.label}
              onClick={() => { onClose(); a.run(); }}
              className="w-full flex items-center text-left"
              style={{ gap: 10, padding: '10px 12px', borderRadius: 10, fontSize: 14, fontWeight: 600 }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--canvas)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
            >
              {a.icon || <Plus size={15} />} {a.label}
            </button>
          ))}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
