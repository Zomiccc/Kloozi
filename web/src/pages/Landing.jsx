import { useEffect, useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight, Check, Star, MessageCircle, Phone, Mail, Smartphone,
  Users, Zap, TrendingUp, Shield, Clock, Globe, Menu, X, ChevronRight,
  Play, ChevronDown, LayoutGrid, Cpu, BarChart3, Building2, Layers,
  FileText, Briefcase, HelpCircle, Gift, PhoneCall, MousePointer2
} from 'lucide-react';

function useClickOutside(ref, handler) {
  useEffect(() => {
    function listener(e) {
      if (!ref.current || ref.current.contains(e.target)) return;
      handler();
    }
    document.addEventListener('mousedown', listener);
    return () => document.removeEventListener('mousedown', listener);
  }, [ref, handler]);
}

export default function Landing() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [openDropdown, setOpenDropdown] = useState(null);
  const dropdownRef = useRef(null);
  useClickOutside(dropdownRef, () => setOpenDropdown(null));

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 60);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const dropdowns = {
    product: {
      columns: [
        {
          title: 'Features',
          icon: LayoutGrid,
          items: [
            { label: 'New Lead Automations', href: '#features' },
            { label: 'Bulk Lead Engagement', href: '#features' },
            { label: 'Easy Lead Management', href: '#features' },
            { label: 'WhatsApp Automations', href: '#features' },
            { label: 'Lead Distribution', href: '#features' },
            { label: 'File Tracking', href: '#features' },
          ],
        },
        {
          title: 'CRM',
          icon: Cpu,
          items: [
            { label: 'Mobile CRM', href: '#features' },
            { label: 'CRM for Sales Teams', href: '#features' },
            { label: 'CRM for WhatsApp', href: '#features' },
            { label: 'CRM for Facebook Leads', href: '#features' },
            { label: 'CRM for Meta Conversions API', href: '#features' },
          ],
        },
        {
          title: 'Solutions',
          icon: Building2,
          items: [
            { label: 'For Marketing Agencies', href: '#features' },
            { label: 'For Real Estate', href: '#features' },
            { label: 'For Sales Managers', href: '#features' },
            { label: 'For Insurance Agents', href: '#features' },
          ],
        },
      ],
    },
    integrations: {
      columns: [
        {
          title: 'Lead Sources',
          icon: MousePointer2,
          items: [
            { label: 'Facebook Lead Ads CRM', href: '#integrations' },
            { label: 'WordPress CRM', href: '#integrations' },
            { label: 'TikTok CRM', href: '#integrations' },
            { label: 'LinkedIn Lead Gen CRM', href: '#integrations' },
            { label: 'Google Forms CRM', href: '#integrations' },
            { label: 'Zapier CRM', href: '#integrations' },
          ],
        },
        {
          title: 'Partner Tools',
          icon: Layers,
          items: [
            { label: 'Meta Conversions API', href: '#integrations' },
            { label: 'WhatsApp Auto-Responder', href: '#integrations' },
            { label: 'WhatsApp Campaigns', href: '#integrations' },
            { label: 'WhatsApp Chat Monitoring', href: '#integrations' },
            { label: 'Outgoing Webhooks', href: '#integrations' },
          ],
        },
      ],
    },
    resources: {
      columns: [
        {
          title: 'Knowledge Hub',
          icon: HelpCircle,
          items: [
            { label: 'Blog', href: '#' },
            { label: 'Case Studies', href: '#' },
            { label: 'Product Updates', href: '#' },
            { label: 'Help Guide', href: '#' },
          ],
        },
        {
          title: 'Free Tools',
          icon: Gift,
          items: [
            { label: 'Free Facebook Leads Viewer', href: '#' },
            { label: 'Free Privacy Policy Generator', href: '#' },
            { label: 'Free WhatsApp Bulk Sender', href: '#' },
            { label: 'Free Lead Capture Form', href: '#' },
            { label: 'Free Lead Distribution Tool', href: '#' },
          ],
        },
        {
          title: 'Company',
          icon: Briefcase,
          items: [
            { label: 'Reviews', href: '#testimonials' },
            { label: 'About Us', href: '#' },
            { label: 'Careers', href: '#' },
          ],
        },
      ],
    },
  };

  const toggle = (name) => setOpenDropdown(openDropdown === name ? null : name);

  const stats = [
    { value: '100M+', label: 'Leads Captured' },
    { value: '500K+', label: 'Sales Teams' },
    { value: '125', label: 'Countries' },
    { value: '80%', label: 'Time Saved' },
  ];

  const features = [
    {
      title: 'Instant Lead Capture',
      desc: 'Pull leads from Facebook, TikTok, LinkedIn, Google Forms, WordPress, and Zapier in real time.',
      image: 'https://images.unsplash.com/photo-1556761175-5973dc0f32e7?auto=format&fit=crop&w=800&q=80',
      icon: Zap,
    },
    {
      title: 'Auto-Respond on WhatsApp',
      desc: 'Send personalised WhatsApp messages, SMS, or emails the moment a new lead is captured.',
      image: 'https://images.unsplash.com/photo-1611746872915-64382b5c76da?auto=format&fit=crop&w=800&q=80',
      icon: MessageCircle,
    },
    {
      title: 'Smart Lead Distribution',
      desc: 'Auto-assign leads to the right sales agents based on territory, workload, or custom rules.',
      image: 'https://images.unsplash.com/photo-1552664730-d307ca884978?auto=format&fit=crop&w=800&q=80',
      icon: Users,
    },
    {
      title: 'Mobile-First CRM',
      desc: 'Manage your entire pipeline, calls, and follow-ups from your phone — no desktop required.',
      image: 'https://images.unsplash.com/photo-1512941937669-90a1b58e7e9c?auto=format&fit=crop&w=800&q=80',
      icon: Smartphone,
    },
  ];

  const testimonials = [
    {
      name: 'Nadia Rahman',
      role: 'Broker, Horizon Realty',
      quote: 'We stopped losing leads the same week we installed it. Everything flows straight to WhatsApp now.',
      image: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?auto=format&fit=crop&w=200&q=80',
    },
    {
      name: 'Paul Tan',
      role: 'Sales Director, Apex Group',
      quote: 'My team calls leads 3x faster. Auto-assignment and follow-up reminders changed our game.',
      image: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=200&q=80',
    },
    {
      name: 'Arihant Mehta',
      role: 'Founder, BuildRight Projects',
      quote: 'One dashboard for all our lead sources. I finally have visibility into what my team is doing.',
      image: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=200&q=80',
    },
  ];

  const integrations = [
    { name: 'Facebook', color: 'bg-blue-600' },
    { name: 'TikTok', color: 'bg-pink-600' },
    { name: 'LinkedIn', color: 'bg-blue-700' },
    { name: 'WhatsApp', color: 'bg-green-600' },
    { name: 'Google Forms', color: 'bg-purple-600' },
    { name: 'WordPress', color: 'bg-blue-600' },
    { name: 'Zapier', color: 'bg-orange-600' },
    { name: 'Stripe', color: 'bg-slate-700' },
  ];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">
      {/* Navbar with dropdown menus */}
      <nav className={`fixed top-0 inset-x-0 z-50 transition-all ${scrolled ? 'bg-white/95 backdrop-blur shadow-sm' : 'bg-white/80 backdrop-blur'}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link to="/" className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #FF3B5C, #FF9500)' }}>
                <TrendingUp className="text-white" size={20} />
              </div>
              <span className="text-xl font-bold tracking-tight">Zomic</span>
            </Link>

            <div className="hidden md:flex items-center gap-1" ref={dropdownRef}>
              {Object.entries(dropdowns).map(([key, data]) => (
                <div key={key} className="relative">
                  <button
                    onClick={() => toggle(key)}
                    className={`flex items-center gap-1 px-3 py-2 text-sm font-medium rounded-lg transition ${openDropdown === key ? 'text-[#FF3B5C] bg-red-50' : 'text-slate-600 hover:text-[#FF3B5C] hover:bg-slate-50'}`}
                  >
                    {key.charAt(0).toUpperCase() + key.slice(1)} <ChevronDown size={14} />
                  </button>
                  {openDropdown === key && (
                    <div className="absolute top-full left-0 mt-2 w-[560px] bg-white rounded-2xl shadow-xl border border-slate-200 p-5">
                      <div className={`grid gap-6 ${data.columns.length === 2 ? 'grid-cols-2' : 'grid-cols-3'}`}>
                        {data.columns.map((col) => (
                          <div key={col.title}>
                            <div className="flex items-center gap-2 mb-3 pb-2 border-b border-slate-100">
                              <col.icon size={16} style={{ color: '#FF3B5C' }} />
                              <span className="text-sm font-bold text-slate-900">{col.title}</span>
                            </div>
                            <ul className="space-y-1.5">
                              {col.items.map((item) => (
                                <li key={item.label}>
                                  <a
                                    href={item.href}
                                    onClick={() => setOpenDropdown(null)}
                                    className="block text-sm text-slate-600 hover:text-[#FF3B5C] hover:bg-slate-50 px-2 py-1.5 rounded transition"
                                  >
                                    {item.label}
                                  </a>
                                </li>
                              ))}
                            </ul>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
              <Link to="/pricing" className="px-3 py-2 text-sm font-medium text-slate-600 hover:text-[#FF3B5C] hover:bg-slate-50 rounded-lg transition">Pricing</Link>
            </div>

            <div className="hidden md:flex items-center gap-3">
              <Link to="/login" className="text-sm font-medium text-slate-600 hover:text-[#FF3B5C] px-3 py-2">Login</Link>
              <Link to="/signup" className="text-sm font-semibold text-white px-4 py-2 rounded-lg transition" style={{ background: 'linear-gradient(135deg, #FF3B5C, #FF9500)' }}>
                Sign Up
              </Link>
            </div>
            <button className="md:hidden p-2" onClick={() => setMobileOpen(!mobileOpen)}>
              {mobileOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {mobileOpen && (
          <div className="md:hidden bg-white border-b border-slate-200 px-4 py-4 space-y-4 max-h-[80vh] overflow-y-auto">
            {Object.entries(dropdowns).map(([key, data]) => (
              <div key={key}>
                <div className="font-semibold text-slate-900 mb-2">{key.charAt(0).toUpperCase() + key.slice(1)}</div>
                <div className="pl-3 space-y-2">
                  {data.columns.map((col) => (
                    <div key={col.title}>
                      <div className="text-xs font-bold text-slate-500 uppercase mb-1">{col.title}</div>
                      <ul className="space-y-1">
                        {col.items.map((item) => (
                          <li key={item.label}>
                            <a href={item.href} onClick={() => setMobileOpen(false)} className="text-sm text-slate-600 hover:text-[#FF3B5C]">{item.label}</a>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </div>
            ))}
            <Link to="/pricing" onClick={() => setMobileOpen(false)} className="block text-sm font-semibold text-slate-900">Pricing</Link>
            <Link to="/login" onClick={() => setMobileOpen(false)} className="block text-sm font-medium text-slate-600">Login</Link>
            <Link to="/signup" onClick={() => setMobileOpen(false)} className="block text-sm font-semibold" style={{ color: '#FF3B5C' }}>Sign Up</Link>
          </div>
        )}
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden pt-32 pb-20 lg:pt-40 lg:pb-28">
        <div className="absolute inset-0 -z-10">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[600px] bg-red-300/20 rounded-full blur-3xl" />
          <div className="absolute bottom-0 right-0 w-[700px] h-[500px] bg-orange-300/20 rounded-full blur-3xl" />
        </div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="max-w-2xl">
              <div className="inline-flex items-center gap-2 bg-red-50 border border-red-100 rounded-full px-3 py-1 text-xs font-semibold mb-6" style={{ color: '#FF3B5C' }}>
                <Star size={12} fill="currentColor" />
                Rated 4.9 by 10,000+ sales teams worldwide
              </div>
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold leading-tight tracking-tight mb-6">
                Turn every lead into a <span style={{ color: '#FF3B5C' }}>closed deal</span> — from your phone
              </h1>
              <p className="text-lg sm:text-xl text-slate-600 mb-8 leading-relaxed">
                Capture leads from any platform, auto-respond on WhatsApp, and manage your entire sales pipeline without ever opening a laptop.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 mb-8">
                <Link to="/signup" className="inline-flex items-center justify-center gap-2 text-white font-semibold px-6 py-3.5 rounded-xl transition" style={{ background: 'linear-gradient(135deg, #FF3B5C, #FF9500)' }}>
                  Get Started Free <ArrowRight size={18} />
                </Link>
                <button className="inline-flex items-center justify-center gap-2 bg-white hover:bg-slate-50 text-slate-700 font-semibold border border-slate-200 px-6 py-3.5 rounded-xl transition">
                  <Play size={18} fill="currentColor" style={{ color: '#FF3B5C' }} /> Watch Demo
                </button>
              </div>
              <div className="flex items-center gap-4 text-sm text-slate-500">
                <div className="flex -space-x-2">
                  {[1,2,3,4].map((i) => (
                    <img key={i} src={`https://i.pravatar.cc/100?img=${i + 10}`} alt="user" className="w-8 h-8 rounded-full border-2 border-white" />
                  ))}
                </div>
                <span>Trusted by 500,000+ businesses worldwide</span>
              </div>
            </div>
            <div className="relative">
              <div className="relative z-10 bg-white rounded-3xl shadow-2xl border border-slate-100 p-4 max-w-sm mx-auto lg:ml-auto">
                <div className="bg-slate-100 rounded-2xl p-3 mb-4">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold" style={{ background: 'linear-gradient(135deg, #FF3B5C, #FF9500)' }}>K</div>
                    <div>
                      <div className="text-sm font-semibold">Katherine Lim</div>
                      <div className="text-xs text-slate-500">New Lead • 2m ago</div>
                    </div>
                    <span className="ml-auto text-xs font-semibold text-amber-600 bg-amber-50 px-2 py-1 rounded">Hot</span>
                  </div>
                  <div className="flex gap-2">
                    <button className="flex-1 text-white text-xs font-semibold py-2 rounded-lg" style={{ background: 'linear-gradient(135deg, #FF3B5C, #FF9500)' }}>WhatsApp</button>
                    <button className="flex-1 bg-white text-slate-700 text-xs font-semibold py-2 rounded-lg border border-slate-200">Call</button>
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="flex items-center gap-3 text-sm">
                    <Clock size={16} className="text-slate-400" />
                    <span>Follow up in 3 days</span>
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    <Mail size={16} className="text-slate-400" />
                    <span>katherine@example.com</span>
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    <Phone size={16} className="text-slate-400" />
                    <span>+65 9123 4567</span>
                  </div>
                </div>
                <div className="mt-4 pt-4 border-t border-slate-100">
                  <div className="text-xs font-semibold text-slate-500 mb-2">TIMELINE</div>
                  <div className="flex gap-3">
                    <div className="w-2 h-2 rounded-full mt-1.5" style={{ background: '#FF3B5C' }} />
                    <div className="text-xs text-slate-600">
                      <div className="font-semibold">Lead captured from Facebook</div>
                      <div className="text-slate-400">10:26 AM</div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="absolute -top-6 -right-6 w-24 h-24 bg-orange-500 rounded-2xl rotate-12 opacity-20" />
              <div className="absolute -bottom-8 -left-8 w-32 h-32 bg-red-500 rounded-full opacity-20" />
            </div>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="py-12 bg-white border-y border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            {stats.map((s) => (
              <div key={s.label}>
                <div className="text-3xl sm:text-4xl font-bold mb-1" style={{ color: '#FF3B5C' }}>{s.value}</div>
                <div className="text-sm text-slate-500 font-medium">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-20 lg:py-28">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">The all-in-one lead engagement system</h2>
            <p className="text-lg text-slate-600">
              Stop copying leads between tools. Capture, respond, and close — everything in one place.
            </p>
          </div>
          <div className="grid md:grid-cols-2 gap-8">
            {features.map((f) => (
              <div key={f.title} className="group bg-white rounded-2xl border border-slate-200 overflow-hidden hover:shadow-xl transition-shadow">
                <div className="h-56 overflow-hidden">
                  <img src={f.image} alt={f.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                </div>
                <div className="p-6">
                  <div className="w-12 h-12 rounded-xl bg-red-50 flex items-center justify-center mb-4" style={{ color: '#FF3B5C' }}>
                    <f.icon size={24} />
                  </div>
                  <h3 className="text-xl font-bold mb-2">{f.title}</h3>
                  <p className="text-slate-600 leading-relaxed">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Integrations */}
      <section id="integrations" className="py-20 bg-slate-900 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-3xl sm:text-4xl font-bold mb-4">Connect every lead source you already use</h2>
              <p className="text-lg text-slate-300 mb-8">
                One integration, zero manual entry. New leads from Facebook, TikTok, Google, or your website appear instantly in your pipeline.
              </p>
              <ul className="space-y-3">
                {['No-code setup in minutes', 'Real-time lead sync', 'Field mapping and deduplication', 'Custom webhook support'].map((item) => (
                  <li key={item} className="flex items-center gap-3 text-slate-200">
                    <Check size={18} className="text-green-400" /> {item}
                  </li>
                ))}
              </ul>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {integrations.map((i) => (
                <div key={i.name} className="bg-white/10 backdrop-blur rounded-xl p-4 text-center hover:bg-white/20 transition">
                  <div className={`w-12 h-12 rounded-xl ${i.color} mx-auto mb-3 flex items-center justify-center text-white font-bold text-lg`}>
                    {i.name[0]}
                  </div>
                  <div className="text-sm font-semibold">{i.name}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-20 lg:py-28 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">From first contact to final close</h2>
            <p className="text-lg text-slate-600">A simple workflow that keeps your sales team moving fast.</p>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            {[
              { step: '1', title: 'Capture', desc: 'Leads flow in automatically from Facebook, TikTok, LinkedIn, Google Forms, WordPress, and Zapier.' },
              { step: '2', title: 'Engage', desc: 'Auto-send WhatsApp, SMS, or email. Schedule follow-ups and track every response.' },
              { step: '3', title: 'Convert', desc: 'Move leads through your pipeline, assign to agents, and close deals from anywhere.' },
            ].map((item) => (
              <div key={item.step} className="relative">
                <div className="w-14 h-14 rounded-2xl text-white flex items-center justify-center text-2xl font-bold mb-4" style={{ background: 'linear-gradient(135deg, #FF3B5C, #FF9500)' }}>
                  {item.step}
                </div>
                <h3 className="text-xl font-bold mb-2">{item.title}</h3>
                <p className="text-slate-600">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section id="testimonials" className="py-20 lg:py-28 bg-red-50/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">Loved by high-performing sales teams</h2>
            <p className="text-lg text-slate-600">See why businesses trust Zomic to power their lead engagement.</p>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            {testimonials.map((t) => (
              <div key={t.name} className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
                <div className="flex gap-1 text-amber-400 mb-4">
                  {[1,2,3,4,5].map((i) => <Star key={i} size={16} fill="currentColor" />)}
                </div>
                <p className="text-slate-700 mb-6 leading-relaxed">"{t.quote}"</p>
                <div className="flex items-center gap-3">
                  <img src={t.image} alt={t.name} className="w-12 h-12 rounded-full object-cover" />
                  <div>
                    <div className="font-semibold text-sm">{t.name}</div>
                    <div className="text-xs text-slate-500">{t.role}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Mobile app */}
      <section className="py-20 lg:py-28 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="order-2 lg:order-1">
              <img src="https://images.unsplash.com/photo-1611162617474-5b21e879e113?auto=format&fit=crop&w=700&q=80" alt="Mobile app" className="rounded-3xl shadow-2xl mx-auto" />
            </div>
            <div className="order-1 lg:order-2">
              <h2 className="text-3xl sm:text-4xl font-bold mb-4">Run your entire sales process from your pocket</h2>
              <p className="text-lg text-slate-600 mb-8">
                Get instant alerts, respond to leads, view timelines, and manage your team — all from the mobile app.
              </p>
              <div className="space-y-4 mb-8">
                {[
                  'Instant push notifications for new leads',
                  'One-tap WhatsApp, SMS, and calling',
                  'Offline access to lead profiles',
                  'Team dashboards and activity tracking',
                ].map((item) => (
                  <div key={item} className="flex items-center gap-3">
                    <div className="w-6 h-6 rounded-full bg-green-100 text-green-600 flex items-center justify-center">
                      <Check size={14} strokeWidth={3} />
                    </div>
                    <span className="text-slate-700">{item}</span>
                  </div>
                ))}
              </div>
              <div className="flex gap-4">
                <button className="bg-slate-900 text-white px-5 py-3 rounded-xl text-sm font-semibold hover:bg-slate-800 transition">
                  App Store
                </button>
                <button className="bg-slate-900 text-white px-5 py-3 rounded-xl text-sm font-semibold hover:bg-slate-800 transition">
                  Google Play
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing teaser */}
      <section id="pricing" className="py-20 lg:py-28 bg-slate-50">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">Start free. Scale as you grow.</h2>
          <p className="text-lg text-slate-600 mb-8">
            No credit card required. Get full access to core features on the free plan.
          </p>
          <div className="grid sm:grid-cols-3 gap-6 text-left">
            {[
              { name: 'Starter', price: '$0', desc: 'For solo salespeople', features: ['100 leads/mo', 'WhatsApp & SMS', 'Basic automations', 'Email support'] },
              { name: 'Pro', price: '$29', desc: 'For growing teams', features: ['Unlimited leads', 'All integrations', 'Team assignment', 'Priority support'] },
              { name: 'Business', price: '$99', desc: 'For sales organisations', features: ['White-label forms', 'Advanced analytics', 'API access', 'Dedicated manager'] },
            ].map((plan) => (
              <div key={plan.name} className={`bg-white rounded-2xl p-6 border ${plan.name === 'Pro' ? 'border-[#FF3B5C] shadow-lg' : 'border-slate-200'}`}>
                <div className="text-sm font-semibold text-slate-500 mb-1">{plan.name}</div>
                <div className="text-3xl font-bold mb-1">{plan.price}<span className="text-sm font-normal text-slate-400">/mo</span></div>
                <div className="text-sm text-slate-500 mb-4">{plan.desc}</div>
                <ul className="space-y-2 mb-6">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-center gap-2 text-sm text-slate-600">
                      <Check size={14} className="text-green-500" /> {f}
                    </li>
                  ))}
                </ul>
                <Link to="/signup" className={`block text-center text-sm font-semibold py-2.5 rounded-lg transition ${plan.name === 'Pro' ? 'text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`} style={plan.name === 'Pro' ? { background: 'linear-gradient(135deg, #FF3B5C, #FF9500)' } : {}}>
                  Get Started
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20" style={{ background: 'linear-gradient(135deg, #FF3B5C, #FF9500)' }}>
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">Ready to stop losing leads?</h2>
          <p className="text-lg mb-8" style={{ color: 'rgba(255,255,255,0.85)' }}>
            Join 500,000+ sales teams using Zomic to capture and convert leads faster.
          </p>
          <Link to="/signup" className="inline-flex items-center gap-2 bg-white font-bold px-8 py-4 rounded-xl transition hover:bg-slate-50" style={{ color: '#FF3B5C' }}>
            Start Free Today <ChevronRight size={20} />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-900 text-slate-300 py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-4 gap-8 mb-12">
            <div>
              <div className="flex items-center gap-2 text-white mb-4">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #FF3B5C, #FF9500)' }}>
                  <TrendingUp size={18} className="text-white" />
                </div>
                <span className="text-xl font-bold">Zomic</span>
              </div>
              <p className="text-sm text-slate-400">
                The mobile-first CRM that captures leads, automates follow-ups, and closes more deals — powered by Zomic.
              </p>
            </div>
            <div>
              <div className="font-semibold text-white mb-4">Product</div>
              <ul className="space-y-2 text-sm">
                <li><a href="#features" className="hover:text-white transition">Features</a></li>
                <li><a href="#integrations" className="hover:text-white transition">Integrations</a></li>
                <li><a href="#pricing" className="hover:text-white transition">Pricing</a></li>
                <li><a href="#" className="hover:text-white transition">Mobile App</a></li>
              </ul>
            </div>
            <div>
              <div className="font-semibold text-white mb-4">Resources</div>
              <ul className="space-y-2 text-sm">
                <li><a href="#" className="hover:text-white transition">Help Center</a></li>
                <li><a href="#" className="hover:text-white transition">Blog</a></li>
                <li><a href="#" className="hover:text-white transition">API Docs</a></li>
                <li><a href="#" className="hover:text-white transition">Status</a></li>
              </ul>
            </div>
            <div>
              <div className="font-semibold text-white mb-4">Company</div>
              <ul className="space-y-2 text-sm">
                <li><a href="#" className="hover:text-white transition">About</a></li>
                <li><a href="#" className="hover:text-white transition">Careers</a></li>
                <li><a href="#" className="hover:text-white transition">Privacy</a></li>
                <li><a href="#" className="hover:text-white transition">Terms</a></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-slate-800 pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="text-sm text-slate-400">© 2026 Zomic. All rights reserved.</div>
            <div className="flex gap-4">
              <Globe size={18} />
              <Smartphone size={18} />
              <Mail size={18} />
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
