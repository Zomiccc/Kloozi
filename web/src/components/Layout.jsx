import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import {
  LayoutDashboard, Users, Mail, Send, Workflow, FileText, FolderOpen,
  Users2, Plug, BarChart3, Settings as SettingsIcon, CreditCard,
  Bell, LogOut, Menu, X, MessageSquare, Smartphone
} from 'lucide-react';
import useAuthStore from '../stores/authStore';
import API from '../lib/api';

const navItems = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/leads', label: 'Leads', icon: Users },
  { to: '/email-templates', label: 'Email Templates', icon: Mail },
  { to: '/email-sequences', label: 'Email Sequences', icon: Send },
  { to: '/email-flows', label: 'Email Flows', icon: Workflow },
  { to: '/email-campaigns', label: 'Email Campaigns', icon: FileText },
  { to: '/whatsapp-campaigns', label: 'WhatsApp Campaigns', icon: MessageSquare },
  { to: '/sms-campaigns', label: 'SMS Campaigns', icon: Smartphone },
  { to: '/content', label: 'Content Library', icon: FolderOpen },
  { to: '/team', label: 'Team Management', icon: Users2 },
  { to: '/automations', label: 'Automations', icon: Plug },
  { to: '/analytics', label: 'Analytics & Reports', icon: BarChart3 },
  { to: '/settings', label: 'Settings', icon: SettingsIcon },
  { to: '/billing', label: 'Billing', icon: CreditCard },
];

export default function Layout() {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [showNotif, setShowNotif] = useState(false);

  useEffect(() => {
    loadNotifications();
    const interval = setInterval(loadNotifications, 30000);
    return () => clearInterval(interval);
  }, []);

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

  return (
    <div className="flex h-screen bg-dark-50">
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/50 z-30 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={`fixed lg:static w-64 bg-white border-r border-dark-100 h-full flex flex-col z-40 transition-transform ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
        <div className="p-4 border-b border-dark-100">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center text-white font-bold">C</div>
            <span className="font-bold text-lg text-dark-900">CRM Final</span>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto p-3 space-y-1">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) => `sidebar-link ${isActive ? 'sidebar-link-active' : ''}`}
            >
              <item.icon size={20} />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="p-3 border-t border-dark-100">
          <div className="flex items-center gap-3 px-3 py-2">
            <div className="w-9 h-9 bg-primary-100 rounded-full flex items-center justify-center text-primary-700 font-medium">
              {user?.firstName?.[0] || 'U'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-dark-900 truncate">{user?.firstName} {user?.lastName}</p>
              <p className="text-xs text-dark-400 capitalize">{user?.role?.replace('_', ' ')}</p>
            </div>
            <button onClick={handleLogout} className="text-dark-400 hover:text-red-500 transition-colors">
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="bg-white border-b border-dark-100 px-4 py-3 flex items-center justify-between">
          <button className="lg:hidden" onClick={() => setSidebarOpen(!sidebarOpen)}>
            {sidebarOpen ? <X size={24} /> : <Menu size={24} />}
          </button>

          <div className="flex-1" />

          <div className="relative">
            <button
              onClick={() => setShowNotif(!showNotif)}
              className="relative p-2 hover:bg-dark-50 rounded-lg transition-colors"
            >
              <Bell size={20} className="text-dark-600" />
              {notifications.length > 0 && (
                <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                  {notifications.length}
                </span>
              )}
            </button>

            {showNotif && (
              <div className="absolute right-0 mt-2 w-80 bg-white rounded-xl shadow-lg border border-dark-100 z-50 max-h-96 overflow-y-auto">
                <div className="p-3 border-b border-dark-100 flex items-center justify-between">
                  <span className="font-medium text-dark-900">Notifications</span>
                  {notifications.length > 0 && (
                    <button onClick={markAllRead} className="text-xs text-primary-600 hover:underline">Mark all read</button>
                  )}
                </div>
                {notifications.length === 0 ? (
                  <div className="p-6 text-center text-dark-400 text-sm">No new notifications</div>
                ) : (
                  notifications.map((n) => (
                    <div key={n.id} className="p-3 border-b border-dark-50 hover:bg-dark-50 cursor-pointer">
                      <p className="text-sm font-medium text-dark-900">{n.title}</p>
                      <p className="text-xs text-dark-500 mt-0.5">{n.body}</p>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
