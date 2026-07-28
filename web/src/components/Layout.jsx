import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useState, useEffect, useRef } from 'react';
import {
  LayoutDashboard, Users, BarChart3, Plug, FolderOpen, Users2,
  Bell, LogOut, Search, Command, Plus, Settings as SettingsIcon,
  CreditCard, Mail, Send, Workflow, FileText, MessageSquare, Smartphone,
  Home, ChevronDown
} from 'lucide-react';
import useAuthStore from '../stores/authStore';
import API from '../lib/api';

const mainNav = [
  { to: '/app', label: 'Welcome', icon: Home, end: true },
  { to: '/app/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/app/leads', label: 'Leads', icon: Users },
  { to: '/app/email-templates', label: 'Emails', icon: Mail, dropdown: [
    { to: '/app/email-templates', label: 'Templates', icon: Mail },
    { to: '/app/email-sequences', label: 'Sequences', icon: Send },
    { to: '/app/email-campaigns', label: 'Campaigns', icon: FileText },
    { to: '/app/email-flows', label: 'Flows', icon: Workflow },
  ]},
  { to: '/app/content', label: 'Content', icon: FolderOpen },
  { to: '/app/team', label: 'Team', icon: Users2 },
  { to: '/app/analytics', label: 'Analytics', icon: BarChart3 },
  { to: '/app/automations', label: 'Automations', icon: Plug },
];

const mobileTabs = [
  { to: '/app', label: 'Home', icon: Home, end: true },
  { to: '/app/leads', label: 'Leads', icon: Users },
  { to: '/app/email-templates', label: 'Emails', icon: Mail },
  { to: '/app/team', label: 'Team', icon: Users2 },
  { to: '/app/analytics', label: 'Stats', icon: BarChart3 },
];

const allSearchablePages = [
  ...mainNav,
  { to: '/app/email-sequences', label: 'Email Sequences', icon: Send },
  { to: '/app/email-flows', label: 'Email Flows', icon: Workflow },
  { to: '/app/email-campaigns', label: 'Email Campaigns', icon: FileText },
  { to: '/app/whatsapp-campaigns', label: 'WhatsApp Campaigns', icon: MessageSquare },
  { to: '/app/sms-campaigns', label: 'SMS Campaigns', icon: Smartphone },
  { to: '/app/settings', label: 'Settings', icon: SettingsIcon },
  { to: '/app/billing', label: 'Billing', icon: CreditCard },
];

export default function Layout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuthStore();
  const [scrolled, setScrolled] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [showNotif, setShowNotif] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [paletteQuery, setPaletteQuery] = useState('');
  const [showEmailDropdown, setShowEmailDropdown] = useState(false);
  const paletteInputRef = useRef(null);
  const mainRef = useRef(null);

  useEffect(() => {
    loadNotifications();
    const interval = setInterval(loadNotifications, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const handler = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setPaletteOpen(true);
      }
      if (e.key === 'Escape') {
        setPaletteOpen(false);
        setShowNotif(false);
        setShowUserMenu(false);
        setShowEmailDropdown(false);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  useEffect(() => {
    if (paletteOpen) setTimeout(() => paletteInputRef.current?.focus(), 50);
    else setPaletteQuery('');
  }, [paletteOpen]);

  useEffect(() => {
    const el = mainRef.current;
    if (!el) return;
    const onScroll = () => setScrolled(el.scrollTop > 10);
    el.addEventListener('scroll', onScroll);
    return () => el.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    setShowNotif(false);
    setShowUserMenu(false);
    setShowEmailDropdown(false);
  }, [location.pathname]);

  const loadNotifications = async () => {
    try {
      const res = await API.get('/analytics/notifications?unread_only=true');
      setNotifications(res.data.notifications || []);
    } catch {}
  };

  const markAllRead = async () => {
    try {
      await API.put('/analytics/notifications/read-all');
      setNotifications([]);
    } catch {}
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const filteredPages = allSearchablePages.filter((i) =>
    i.label.toLowerCase().includes(paletteQuery.toLowerCase())
  );

  return (
    <div className="h-screen flex flex-col page-bg">
      {/* Top Navigation Bar */}
      <header
        className={`sticky top-0 z-40 bg-white border-b border-surface-border transition-all duration-200 ${
          scrolled ? 'shadow-card backdrop-blur-md bg-white/90' : ''
        }`}
        style={{ height: '64px' }}
      >
        <div className="max-w-[1200px] mx-auto h-full px-6 flex items-center justify-between gap-4">
          {/* Logo */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center text-white font-extrabold text-lg"
              style={{ background: 'linear-gradient(135deg, #FF3B5C, #FF9500)' }}
            >
              Z
            </div>
            <span className="font-extrabold text-xl text-ink-primary hidden sm:block">Zomic</span>
          </div>

          {/* Center Navigation */}
          <nav className="hidden lg:flex items-center gap-7">
            {mainNav.map((item) => (
              item.dropdown ? (
                <div key={item.to} className="relative">
                  <button
                    onClick={() => setShowEmailDropdown(!showEmailDropdown)}
                    className={`nav-link flex items-center gap-1 ${location.pathname.startsWith('/app/email') ? 'nav-link-active' : ''}`}
                  >
                    {item.label}
                    <ChevronDown size={14} className={`transition-transform ${showEmailDropdown ? 'rotate-180' : ''}`} />
                  </button>
                  {showEmailDropdown && (
                    <div className="absolute top-full left-0 mt-1 w-48 bg-white rounded-2xl shadow-modal border border-surface-border z-50 py-1.5 animate-slide-down">
                      {item.dropdown.map((sub) => (
                        <NavLink
                          key={sub.to}
                          to={sub.to}
                          onClick={() => setShowEmailDropdown(false)}
                          className={({ isActive }) => `flex items-center gap-2.5 px-3.5 py-2.5 text-sm font-medium transition-colors ${isActive ? 'text-accent-blue bg-surface-page' : 'text-ink-secondary hover:bg-surface-hover hover:text-ink-primary'}`}
                        >
                          <sub.icon size={16} />
                          {sub.label}
                        </NavLink>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) => `nav-link ${isActive ? 'nav-link-active' : ''}`}
                >
                  {item.label}
                </NavLink>
              )
            ))}
          </nav>

          {/* Right Actions */}
          <div className="flex items-center gap-2 sm:gap-3">
            <button
              onClick={() => setPaletteOpen(true)}
              className="hidden sm:flex items-center gap-2 px-3 py-2 rounded-xl bg-surface-page border border-surface-border text-ink-tertiary text-sm hover:border-ink-tertiary transition-all w-44"
            >
              <Search size={15} />
              <span className="flex-1 text-left">Search...</span>
              <span className="flex items-center gap-0.5 text-[10px] font-semibold bg-white border border-surface-border px-1.5 py-0.5 rounded-md text-ink-tertiary">
                <Command size={10} />K
              </span>
            </button>

            <button
              onClick={() => setPaletteOpen(true)}
              className="sm:hidden p-2 rounded-xl hover:bg-surface-hover transition-colors"
            >
              <Search size={20} className="text-ink-secondary" />
            </button>

            {/* Notifications */}
            <div className="relative">
              <button
                onClick={() => setShowNotif(!showNotif)}
                className="relative p-2.5 rounded-xl hover:bg-surface-hover transition-colors"
              >
                <Bell size={20} className="text-ink-secondary" />
                {notifications.length > 0 && (
                  <span className="absolute top-1 right-1 w-4 h-4 bg-accent-red text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                    {notifications.length}
                  </span>
                )}
              </button>

              {showNotif && (
                <div className="absolute right-0 mt-2 w-80 bg-white rounded-2xl shadow-modal border border-surface-border z-50 max-h-96 overflow-y-auto animate-slide-down">
                  <div className="p-4 border-b border-surface-border flex items-center justify-between">
                    <span className="font-bold text-ink-primary">Notifications</span>
                    {notifications.length > 0 && (
                      <button onClick={markAllRead} className="text-xs text-accent-blue hover:underline font-semibold">Mark all read</button>
                    )}
                  </div>
                  {notifications.length === 0 ? (
                    <div className="p-8 text-center text-ink-tertiary text-sm">No new notifications</div>
                  ) : (
                    notifications.map((n) => (
                      <div key={n.id} className="p-4 border-b border-surface-border hover:bg-surface-hover cursor-pointer transition-colors">
                        <p className="text-sm font-semibold text-ink-primary">{n.title}</p>
                        <p className="text-xs text-ink-secondary mt-0.5">{n.body}</p>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>

            {/* Add Lead Button */}
            <button
              onClick={() => navigate('/app/leads')}
              className="btn btn-primary hidden sm:flex"
              style={{ minHeight: '40px', padding: '0 16px' }}
            >
              <Plus size={16} /> Add Lead
            </button>

            {/* User Avatar */}
            <div className="relative">
              <button
                onClick={() => setShowUserMenu(!showUserMenu)}
                className="flex items-center gap-1.5 p-1 rounded-xl hover:bg-surface-hover transition-colors"
              >
                <div
                  className="w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-sm"
                  style={{ background: 'linear-gradient(135deg, #0066FF, #AF52DE)' }}
                >
                  {user?.firstName?.[0] || 'U'}
                </div>
                <ChevronDown size={14} className="text-ink-tertiary hidden sm:block" />
              </button>

              {showUserMenu && (
                <div className="absolute right-0 mt-2 w-56 bg-white rounded-2xl shadow-modal border border-surface-border z-50 overflow-hidden animate-slide-down">
                  <div className="p-4 border-b border-surface-border">
                    <p className="font-bold text-sm text-ink-primary">{user?.firstName} {user?.lastName}</p>
                    <p className="text-xs text-ink-secondary capitalize mt-0.5">{user?.role?.replace('_', ' ')}</p>
                  </div>
                  <div className="p-1.5">
                    <button
                      onClick={() => { navigate('/app/settings'); setShowUserMenu(false); }}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-ink-secondary hover:bg-surface-hover transition-colors"
                    >
                      <SettingsIcon size={16} /> Settings
                    </button>
                    <button
                      onClick={() => { navigate('/app/billing'); setShowUserMenu(false); }}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-ink-secondary hover:bg-surface-hover transition-colors"
                    >
                      <CreditCard size={16} /> Billing
                    </button>
                    <div className="h-px bg-surface-border my-1.5" />
                    <button
                      onClick={handleLogout}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-accent-red hover:bg-accent-red/5 transition-colors"
                    >
                      <LogOut size={16} /> Sign Out
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main ref={mainRef} className="flex-1 overflow-y-auto">
        <div className="max-w-[1200px] mx-auto px-6 py-8 animate-fade-in">
          <Outlet />
        </div>
      </main>

      {/* Mobile Bottom Tab Bar */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-surface-border z-40 px-2 pb-safe">
        <div className="flex items-center justify-around h-16">
          {mobileTabs.map((tab) => (
            <NavLink
              key={tab.to}
              to={tab.to}
              end={tab.end}
              className={({ isActive }) =>
                `flex flex-col items-center gap-1 py-2 px-3 rounded-xl transition-colors ${
                  isActive ? 'text-accent-red' : 'text-ink-tertiary'
                }`
              }
            >
              <tab.icon size={22} />
              <span className="text-[10px] font-semibold">{tab.label}</span>
            </NavLink>
          ))}
        </div>
      </nav>

      {/* Mobile Floating Add Button */}
      <button
        onClick={() => navigate('/app/leads')}
        className="lg:hidden fixed bottom-20 right-4 w-14 h-14 rounded-full bg-accent-red text-white shadow-button-red flex items-center justify-center z-40 active:scale-95 transition-transform"
      >
        <Plus size={24} />
      </button>

      {/* Mobile bottom padding spacer */}
      <div className="lg:hidden h-20" />

      {/* Command Palette / Spotlight Search */}
      {paletteOpen && (
        <div
          className="fixed inset-0 bg-black/20 backdrop-blur-sm z-50 flex items-start justify-center pt-24"
          onClick={() => setPaletteOpen(false)}
        >
          <div
            className="w-full max-w-lg bg-white rounded-2xl shadow-modal border border-surface-border overflow-hidden animate-scale-in"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 px-4 py-3.5 border-b border-surface-border">
              <Search size={18} className="text-ink-tertiary" />
              <input
                ref={paletteInputRef}
                value={paletteQuery}
                onChange={(e) => setPaletteQuery(e.target.value)}
                placeholder="Search pages, leads, actions..."
                className="flex-1 bg-transparent text-ink-primary placeholder-ink-tertiary outline-none text-sm font-medium"
              />
              <kbd className="text-[10px] font-semibold bg-surface-page border border-surface-border px-2 py-1 rounded-md text-ink-tertiary">ESC</kbd>
            </div>
            <div className="max-h-80 overflow-y-auto p-2">
              <p className="px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-ink-tertiary">Pages</p>
              {filteredPages.length === 0 && (
                <p className="px-3 py-8 text-center text-sm text-ink-tertiary">No results found</p>
              )}
              {filteredPages.map((item) => (
                <button
                  key={item.to}
                  onClick={() => { navigate(item.to); setPaletteOpen(false); }}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-ink-secondary hover:bg-surface-hover hover:text-ink-primary transition-all text-sm font-medium"
                >
                  <item.icon size={16} />
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

