import { useEffect, useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';

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

const heroItem = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] } },
};

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
          items: [
            { label: 'Blog', href: '#' },
            { label: 'Case Studies', href: '#' },
            { label: 'Product Updates', href: '#' },
            { label: 'Help Guide', href: '#' },
          ],
        },
        {
          title: 'Free Tools',
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
    },
    {
      title: 'Auto-Respond on WhatsApp',
      desc: 'Send personalised WhatsApp messages, SMS, or emails the moment a new lead is captured.',
      image: 'https://images.unsplash.com/photo-1611746872915-64382b5c76da?auto=format&fit=crop&w=800&q=80',
    },
    {
      title: 'Smart Lead Distribution',
      desc: 'Auto-assign leads to the right sales agents based on territory, workload, or custom rules.',
      image: 'https://images.unsplash.com/photo-1552664730-d307ca884978?auto=format&fit=crop&w=800&q=80',
    },
    {
      title: 'Mobile-First CRM',
      desc: 'Manage your entire pipeline, calls, and follow-ups from your phone — no desktop required.',
      image: 'https://images.unsplash.com/photo-1512941937669-90a1b58e7e9c?auto=format&fit=crop&w=800&q=80',
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

  const integrations = ['Facebook', 'TikTok', 'LinkedIn', 'WhatsApp', 'Google Forms', 'WordPress', 'Zapier', 'Stripe'];

  return (
    <div className="min-h-screen" style={{ background: '#FAFAF9', color: '#1C1917', fontFamily: 'Inter, system-ui, sans-serif' }}>
      {/* Navbar */}
      <nav className={`fixed top-0 inset-x-0 z-50 transition-all ${scrolled ? 'bg-white/95 backdrop-blur' : 'bg-transparent'}`} style={{ borderBottom: scrolled ? '1px solid #E7E5E4' : 'none' }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link to="/" className="flex items-center gap-2">
              <div className="w-8 h-8 flex items-center justify-center text-white font-bold" style={{ background: '#EDE9FF', borderRadius: '8px' }}>F</div>
              <span className="text-xl font-bold tracking-tight">Flazyn</span>
            </Link>

            <div className="hidden md:flex items-center gap-1" ref={dropdownRef}>
              {Object.entries(dropdowns).map(([key, data]) => (
                <div key={key} className="relative">
                  <button
                    onClick={() => toggle(key)}
                    className={`flex items-center gap-1 px-3 py-2 text-sm transition ${openDropdown === key ? 'text-accent-deep' : 'text-ink-secondary hover:text-ink-primary'}`}
                    style={{ fontWeight: 500 }}
                  >
                    {key.charAt(0).toUpperCase() + key.slice(1)} <span style={{ fontSize: '10px' }}>▾</span>
                  </button>
                  {openDropdown === key && (
                    <div className="absolute top-full left-0 mt-1 bg-white border border-surface-border p-5" style={{ width: '560px', borderRadius: '8px', boxShadow: '0 4px 24px rgba(0,0,0,0.06)' }}>
                      <div className={`grid gap-6 ${data.columns.length === 2 ? 'grid-cols-2' : 'grid-cols-3'}`}>
                        {data.columns.map((col) => (
                          <div key={col.title}>
                            <div className="mb-3 pb-2 border-b border-surface-border">
                              <span className="text-sm font-semibold text-ink-primary">{col.title}</span>
                            </div>
                            <ul className="space-y-1.5">
                              {col.items.map((item) => (
                                <li key={item.label}>
                                  <a
                                    href={item.href}
                                    onClick={() => setOpenDropdown(null)}
                                    className="block text-sm text-ink-secondary hover:text-accent-deep transition"
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
              <Link to="/pricing" className="px-3 py-2 text-sm text-ink-secondary hover:text-ink-primary transition" style={{ fontWeight: 500 }}>Pricing</Link>
            </div>

            <div className="hidden md:flex items-center gap-3">
              <Link to="/login" className="text-sm text-ink-secondary hover:text-ink-primary transition" style={{ fontWeight: 500 }}>Login</Link>
              <Link to="/signup" className="text-sm text-white px-4 py-2 transition" style={{ background: '#EDE9FF', fontWeight: 600, borderRadius: '8px' }}>
                Sign Up
              </Link>
            </div>
            <button className="md:hidden p-2 text-ink-primary" onClick={() => setMobileOpen(!mobileOpen)}>
              {mobileOpen ? '✕' : '☰'}
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {mobileOpen && (
          <div className="md:hidden bg-white border-t border-surface-border px-4 py-4 space-y-4 max-h-[80vh] overflow-y-auto">
            {Object.entries(dropdowns).map(([key, data]) => (
              <div key={key}>
                <div className="font-semibold text-ink-primary mb-2">{key.charAt(0).toUpperCase() + key.slice(1)}</div>
                <div className="pl-3 space-y-2">
                  {data.columns.map((col) => (
                    <div key={col.title}>
                      <div className="text-xs font-semibold text-ink-tertiary uppercase mb-1">{col.title}</div>
                      <ul className="space-y-1">
                        {col.items.map((item) => (
                          <li key={item.label}>
                            <a href={item.href} onClick={() => setMobileOpen(false)} className="text-sm text-ink-secondary hover:text-accent-deep">{item.label}</a>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </div>
            ))}
            <Link to="/pricing" onClick={() => setMobileOpen(false)} className="block text-sm font-semibold text-ink-primary">Pricing</Link>
            <Link to="/login" onClick={() => setMobileOpen(false)} className="block text-sm text-ink-secondary">Login</Link>
            <Link to="/signup" onClick={() => setMobileOpen(false)} className="block text-sm" style={{ color: '#4A2FD6', fontWeight: 600 }}>Sign Up</Link>
          </div>
        )}
      </nav>

      {/* Hero — the first impression moves */}
      <section className="relative pt-32 pb-20 lg:pt-40 lg:pb-28">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <motion.div
              className="max-w-2xl"
              initial="hidden"
              animate="show"
              variants={{ hidden: {}, show: { transition: { staggerChildren: 0.09, delayChildren: 0.05 } } }}
            >
              <motion.div variants={heroItem} className="inline-flex items-center gap-2 px-3 py-1 mb-6" style={{ background: '#F5F5F4', borderRadius: '8px' }}>
                <span style={{ color: '#4A2FD6', fontSize: '12px', fontWeight: 600 }}>★ Rated 4.9 by 10,000+ sales teams worldwide</span>
              </motion.div>
              <motion.h1 variants={heroItem} className="text-ink-primary leading-tight mb-6" style={{ fontSize: '48px', fontWeight: 700, letterSpacing: '-0.02em' }}>
                Turn every lead into a <span style={{ color: '#4A2FD6' }}>closed deal</span> — from your phone
              </motion.h1>
              <motion.p variants={heroItem} className="text-ink-secondary leading-relaxed mb-8" style={{ fontSize: '18px' }}>
                Capture leads from any platform, auto-respond on WhatsApp, and manage your entire sales pipeline without ever opening a laptop.
              </motion.p>
              <motion.div variants={heroItem} className="flex flex-col sm:flex-row gap-4 mb-8">
                <Link to="/signup" className="inline-flex items-center justify-center gap-2 text-white px-6 py-3.5 transition active:scale-[0.98]" style={{ background: '#EDE9FF', fontWeight: 600, borderRadius: '8px' }}>
                  Get Started Free →
                </Link>
                <button className="inline-flex items-center justify-center gap-2 bg-white text-ink-primary px-6 py-3.5 transition border border-surface-border active:scale-[0.98]" style={{ fontWeight: 600, borderRadius: '8px' }}>
                  Watch Demo
                </button>
              </motion.div>
              <motion.div variants={heroItem} className="flex items-center gap-4 text-sm text-ink-tertiary">
                <div className="flex -space-x-2">
                  {[1,2,3,4].map((i) => (
                    <img key={i} src={`https://i.pravatar.cc/100?img=${i + 10}`} alt="user" className="w-8 h-8 rounded-full border-2 border-white" />
                  ))}
                </div>
                <span>Trusted by 500,000+ businesses worldwide</span>
              </motion.div>
            </motion.div>
            <motion.div
              className="relative"
              initial={{ opacity: 0, y: 24, rotate: 1.5 }}
              animate={{ opacity: 1, y: 0, rotate: 0 }}
              transition={{ delay: 0.35, duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
            >
              <div className="relative z-10 bg-white border border-surface-border p-4 max-w-sm mx-auto lg:ml-auto" style={{ borderRadius: '8px', boxShadow: '0 4px 24px rgba(0,0,0,0.06)' }}>
                <div className="bg-surface-page p-3 mb-4" style={{ borderRadius: '8px' }}>
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold" style={{ background: '#EDE9FF' }}>K</div>
                    <div>
                      <div className="text-sm font-semibold text-ink-primary">Katherine Lim</div>
                      <div className="text-xs text-ink-tertiary">New Lead • 2m ago</div>
                    </div>
                    <span className="ml-auto text-xs font-semibold px-2 py-1" style={{ color: '#4A2FD6', background: '#FFF1C2' }}>Hot</span>
                  </div>
                  <div className="flex gap-2">
                    <button className="flex-1 text-white text-xs font-semibold py-2" style={{ background: '#EDE9FF', borderRadius: '8px' }}>WhatsApp</button>
                    <button className="flex-1 bg-white text-ink-primary text-xs font-semibold py-2 border border-surface-border" style={{ borderRadius: '8px' }}>Call</button>
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="flex items-center gap-3 text-sm text-ink-secondary">
                    <span className="text-ink-tertiary">⏱</span> Follow up in 3 days
                  </div>
                  <div className="flex items-center gap-3 text-sm text-ink-secondary">
                    <span className="text-ink-tertiary">✉</span> katherine@example.com
                  </div>
                  <div className="flex items-center gap-3 text-sm text-ink-secondary">
                    <span className="text-ink-tertiary">☎</span> +65 9123 4567
                  </div>
                </div>
                <div className="mt-4 pt-4 border-t border-surface-border">
                  <div className="text-xs font-semibold text-ink-tertiary mb-2 uppercase tracking-wider">Timeline</div>
                  <div className="flex gap-3">
                    <div className="w-2 h-2 rounded-full mt-1.5" style={{ background: '#EDE9FF' }} />
                    <div className="text-xs text-ink-secondary">
                      <div className="font-semibold text-ink-primary">Lead captured from Facebook</div>
                      <div className="text-ink-tertiary">10:26 AM</div>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="py-12 bg-white border-y border-surface-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            {stats.map((s) => (
              <div key={s.label}>
                <div className="mb-1 mono" style={{ fontSize: '32px', fontWeight: 700, color: '#4A2FD6' }}>{s.value}</div>
                <div className="text-sm text-ink-tertiary" style={{ fontWeight: 500 }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-20 lg:py-28">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-ink-primary mb-4" style={{ fontSize: '36px', fontWeight: 700, letterSpacing: '-0.01em' }}>The all-in-one lead engagement system</h2>
            <p className="text-ink-secondary" style={{ fontSize: '18px' }}>
              Stop copying leads between tools. Capture, respond, and close — everything in one place.
            </p>
          </div>
          <div className="grid md:grid-cols-2 gap-8">
            {features.map((f) => (
              <div key={f.title} className="group bg-white border border-surface-border overflow-hidden transition" style={{ borderRadius: '8px' }}>
                <div className="h-56 overflow-hidden">
                  <img src={f.image} alt={f.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                </div>
                <div className="p-6">
                  <h3 className="text-ink-primary mb-2" style={{ fontSize: '20px', fontWeight: 600 }}>{f.title}</h3>
                  <p className="text-ink-secondary leading-relaxed" style={{ fontSize: '15px' }}>{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Integrations */}
      <section id="integrations" className="py-20 bg-white border-y border-surface-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-ink-primary mb-4" style={{ fontSize: '36px', fontWeight: 700, letterSpacing: '-0.01em' }}>Connect every lead source you already use</h2>
              <p className="text-ink-secondary mb-8" style={{ fontSize: '18px' }}>
                One integration, zero manual entry. New leads from Facebook, TikTok, Google, or your website appear instantly in your pipeline.
              </p>
              <ul className="space-y-3">
                {['No-code setup in minutes', 'Real-time lead sync', 'Field mapping and deduplication', 'Custom webhook support'].map((item) => (
                  <li key={item} className="flex items-center gap-3 text-ink-secondary" style={{ fontSize: '15px' }}>
                    <span className="w-1.5 h-1.5 rounded-full" style={{ background: '#EDE9FF' }} /> {item}
                  </li>
                ))}
              </ul>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {integrations.map((name) => (
                <div key={name} className="bg-surface-page border border-surface-border p-4 text-center transition hover:border-ink-tertiary" style={{ borderRadius: '8px' }}>
                  <div className="w-12 h-12 mx-auto mb-3 flex items-center justify-center text-white font-bold" style={{ fontSize: '18px', background: '#F5F5F4', color: '#1C1917', borderRadius: '10px' }}>
                    {name[0]}
                  </div>
                  <div className="text-sm font-semibold text-ink-primary">{name}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-20 lg:py-28">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-ink-primary mb-4" style={{ fontSize: '36px', fontWeight: 700, letterSpacing: '-0.01em' }}>From first contact to final close</h2>
            <p className="text-ink-secondary" style={{ fontSize: '18px' }}>A simple workflow that keeps your sales team moving fast.</p>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            {[
              { step: '1', title: 'Capture', desc: 'Leads flow in automatically from Facebook, TikTok, LinkedIn, Google Forms, WordPress, and Zapier.' },
              { step: '2', title: 'Engage', desc: 'Auto-send WhatsApp, SMS, or email. Schedule follow-ups and track every response.' },
              { step: '3', title: 'Convert', desc: 'Move leads through your pipeline, assign to agents, and close deals from anywhere.' },
            ].map((item) => (
              <div key={item.step}>
                <div className="mono text-ink-primary mb-4" style={{ fontSize: '24px', fontWeight: 700, color: '#4A2FD6' }}>{item.step}</div>
                <h3 className="text-ink-primary mb-2" style={{ fontSize: '20px', fontWeight: 600 }}>{item.title}</h3>
                <p className="text-ink-secondary" style={{ fontSize: '15px' }}>{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section id="testimonials" className="py-20 bg-white border-y border-surface-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-ink-primary mb-4" style={{ fontSize: '36px', fontWeight: 700, letterSpacing: '-0.01em' }}>Loved by high-performing sales teams</h2>
            <p className="text-ink-secondary" style={{ fontSize: '18px' }}>See why businesses trust Flazyn to power their lead engagement.</p>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            {testimonials.map((t) => (
              <div key={t.name} className="bg-surface-page border border-surface-border p-6" style={{ borderRadius: '8px' }}>
                <div className="mb-4" style={{ color: '#4A2FD6', fontSize: '14px' }}>★★★★★</div>
                <p className="text-ink-secondary mb-6 leading-relaxed" style={{ fontSize: '15px' }}>"{t.quote}"</p>
                <div className="flex items-center gap-3">
                  <img src={t.image} alt={t.name} className="w-12 h-12 rounded-full object-cover" />
                  <div>
                    <div className="font-semibold text-sm text-ink-primary">{t.name}</div>
                    <div className="text-xs text-ink-tertiary">{t.role}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Mobile app */}
      <section className="py-20 lg:py-28">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="order-2 lg:order-1">
              <img src="https://images.unsplash.com/photo-1611162617474-5b21e879e113?auto=format&fit=crop&w=700&q=80" alt="Mobile app" className="mx-auto" style={{ borderRadius: '8px' }} />
            </div>
            <div className="order-1 lg:order-2">
              <h2 className="text-ink-primary mb-4" style={{ fontSize: '36px', fontWeight: 700, letterSpacing: '-0.01em' }}>Run your entire sales process from your pocket</h2>
              <p className="text-ink-secondary mb-8" style={{ fontSize: '18px' }}>
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
                    <span className="w-1.5 h-1.5 rounded-full" style={{ background: '#EDE9FF' }} />
                    <span className="text-ink-secondary" style={{ fontSize: '15px' }}>{item}</span>
                  </div>
                ))}
              </div>
              <div className="flex gap-4">
                <button className="bg-brand text-white px-5 py-3 transition" style={{ fontSize: '14px', fontWeight: 600, borderRadius: '8px' }}>
                  App Store
                </button>
                <button className="bg-brand text-white px-5 py-3 transition" style={{ fontSize: '14px', fontWeight: 600, borderRadius: '8px' }}>
                  Google Play
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing teaser */}
      <section id="pricing" className="py-20 bg-white border-y border-surface-border">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-ink-primary mb-4" style={{ fontSize: '36px', fontWeight: 700, letterSpacing: '-0.01em' }}>Start free. Scale as you grow.</h2>
          <p className="text-ink-secondary mb-8" style={{ fontSize: '18px' }}>
            No credit card required. Get full access to core features on the free plan.
          </p>
          <div className="grid sm:grid-cols-3 gap-6 text-left">
            {[
              { name: 'Starter', price: '$0', desc: 'For solo salespeople', features: ['100 leads/mo', 'WhatsApp & SMS', 'Basic automations', 'Email support'] },
              { name: 'Pro', price: '$29', desc: 'For growing teams', features: ['Unlimited leads', 'All integrations', 'Team assignment', 'Priority support'] },
              { name: 'Business', price: '$99', desc: 'For sales organisations', features: ['White-label forms', 'Advanced analytics', 'API access', 'Dedicated manager'] },
            ].map((plan) => (
              <div key={plan.name} className={`bg-surface-page border p-6 ${plan.name === 'Pro' ? 'border-accent' : 'border-surface-border'}`} style={{ borderRadius: '8px' }}>
                <div className="text-sm font-semibold text-ink-tertiary mb-1">{plan.name}</div>
                <div className="mono text-ink-primary mb-1" style={{ fontSize: '32px', fontWeight: 700 }}>{plan.price}<span className="text-ink-tertiary" style={{ fontSize: '14px', fontWeight: 400 }}>/mo</span></div>
                <div className="text-sm text-ink-tertiary mb-4">{plan.desc}</div>
                <ul className="space-y-2 mb-6">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-center gap-2 text-sm text-ink-secondary">
                      <span className="w-1 h-1 rounded-full" style={{ background: '#EDE9FF' }} /> {f}
                    </li>
                  ))}
                </ul>
                <Link to="/signup" className={`block text-center py-2.5 transition ${plan.name === 'Pro' ? 'text-white' : 'bg-white border border-surface-border text-ink-primary hover:border-ink-tertiary'}`} style={{ fontSize: '14px', fontWeight: 600, borderRadius: '8px', ...(plan.name === 'Pro' ? { background: '#EDE9FF' } : {}) }}>
                  Get Started
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20" style={{ background: 'linear-gradient(135deg, #7C5CFF 0%, #5B3DF5 100%)' }}>
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-white mb-4" style={{ fontSize: '36px', fontWeight: 700, letterSpacing: '-0.01em' }}>Ready to stop losing leads?</h2>
          <p className="mb-8" style={{ fontSize: '18px', color: 'rgba(255,255,255,0.7)' }}>
            Join 500,000+ sales teams using Flazyn to capture and convert leads faster.
          </p>
          <Link to="/signup" className="inline-flex items-center gap-2 text-white px-8 py-4 transition" style={{ background: '#EDE9FF', fontWeight: 600, borderRadius: '8px' }}>
            Start Free Today →
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-white border-t border-surface-border py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-4 gap-8 mb-12">
            <div>
              <div className="flex items-center gap-2 text-ink-primary mb-4">
                <div className="w-8 h-8 flex items-center justify-center text-white" style={{ background: '#EDE9FF', borderRadius: '8px' }}>F</div>
                <span className="text-xl font-bold">Flazyn</span>
              </div>
              <p className="text-sm text-ink-tertiary">
                The mobile-first CRM that captures leads, automates follow-ups, and closes more deals — powered by Flazyn.
              </p>
            </div>
            <div>
              <div className="font-semibold text-ink-primary mb-4">Product</div>
              <ul className="space-y-2 text-sm">
                <li><a href="#features" className="text-ink-tertiary hover:text-accent-deep transition">Features</a></li>
                <li><a href="#integrations" className="text-ink-tertiary hover:text-accent-deep transition">Integrations</a></li>
                <li><a href="#pricing" className="text-ink-tertiary hover:text-accent-deep transition">Pricing</a></li>
                <li><a href="#" className="text-ink-tertiary hover:text-accent-deep transition">Mobile App</a></li>
              </ul>
            </div>
            <div>
              <div className="font-semibold text-ink-primary mb-4">Resources</div>
              <ul className="space-y-2 text-sm">
                <li><a href="#" className="text-ink-tertiary hover:text-accent-deep transition">Help Center</a></li>
                <li><a href="#" className="text-ink-tertiary hover:text-accent-deep transition">Blog</a></li>
                <li><a href="#" className="text-ink-tertiary hover:text-accent-deep transition">API Docs</a></li>
                <li><a href="#" className="text-ink-tertiary hover:text-accent-deep transition">Status</a></li>
              </ul>
            </div>
            <div>
              <div className="font-semibold text-ink-primary mb-4">Company</div>
              <ul className="space-y-2 text-sm">
                <li><a href="#" className="text-ink-tertiary hover:text-accent-deep transition">About</a></li>
                <li><a href="#" className="text-ink-tertiary hover:text-accent-deep transition">Careers</a></li>
                <li><Link to="/privacy" className="text-ink-tertiary hover:text-accent-deep transition">Privacy</Link></li>
                <li><Link to="/terms" className="text-ink-tertiary hover:text-accent-deep transition">Terms</Link></li>
                <li><Link to="/data-deletion" className="text-ink-tertiary hover:text-accent-deep transition">Data deletion</Link></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-surface-border pt-8">
            <div className="text-sm text-ink-tertiary">© 2026 Flazyn. All rights reserved.</div>
          </div>
        </div>
      </footer>
    </div>
  );
}
