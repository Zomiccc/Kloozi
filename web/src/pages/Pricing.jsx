import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';

export default function Pricing() {
  const [billing, setBilling] = useState('monthly');
  const [openFaq, setOpenFaq] = useState(null);
  const [form, setForm] = useState({ name: '', email: '', phone: '', teamSize: '', business: '', method: '' });

  const plans = [
    {
      name: 'Free Forever',
      price: billing === 'monthly' ? '$0' : '$0',
      sub: 'No payment or credit card needed',
      highlight: 'Up to 3 team members',
      desc: 'Basic access with limitations on the number of leads you can engage.',
      cta: 'Get Started',
      ctaStyle: 'outline',
      features: [
        'Unlimited Lead Source integrations',
        'Unlimited Instant Lead Alerts (app only)',
        'Up to 2 Lead Distribution Recipients',
        'Up to 10 Message, File & Page Templates',
        'Engage your most recent lead',
        'Mobile app & web access',
      ],
    },
    {
      name: 'Flazyn Pro',
      price: billing === 'monthly' ? '$19' : '$15',
      sub: 'per user, per month (billed annually)',
      highlight: 'Up to 20 team members',
      desc: 'Unlimited pro features for salespeople, marketers, and growing teams.',
      cta: 'Start Free Trial',
      ctaStyle: 'primary',
      badge: 'Most Popular',
      features: [
        'Everything in Free Forever, plus:',
        'Unlimited Follow Up Sequences',
        'Unlimited Lead Engagement & Management',
        'Unlimited Email Lead Alerts & Distribution',
        'Unlimited Templates & View Tracking',
        'Custom Branding on Files & Pages',
        'Bulk Calling & Messaging',
        'Custom Fields, Geolocation & Attachments',
      ],
    },
    {
      name: 'Flazyn Business',
      price: 'Custom',
      sub: 'Contact sales for pricing',
      highlight: 'For 20+ team members',
      desc: 'Unlock the full power of Flazyn for larger teams and agencies.',
      cta: 'Contact Sales',
      ctaStyle: 'outline',
      features: [
        'Everything in Pro, plus:',
        'Advanced Team Management & Permissions',
        'Subteam Hierarchy',
        'More Custom Fields & Options',
        'Advanced Analytics & Team Dashboard',
        'Custom Mobile & Web Branding',
        'Personalised Onboarding & Training',
        'Dedicated Account Manager',
      ],
    },
  ];

  const comparison = [
    { feature: 'Lead Source Integrations', free: 'Unlimited', pro: 'Unlimited', business: 'Unlimited' },
    { feature: 'Instant Lead Alerts (App)', free: 'Unlimited', pro: 'Unlimited', business: 'Unlimited' },
    { feature: 'Instant Lead Alerts (Email)', free: '—', pro: 'Unlimited', business: 'Unlimited' },
    { feature: 'Auto-Merge Duplicate Leads', free: 'Unlimited', pro: 'Unlimited', business: 'Unlimited' },
    { feature: 'WhatsApp Auto-Responder', free: '—', pro: 'Add-on', business: 'Add-on' },
    { feature: 'WhatsApp Campaigns', free: '—', pro: 'Add-on', business: 'Add-on' },
    { feature: 'Automated WhatsApp Sequences', free: '—', pro: 'Add-on', business: 'Add-on' },
    { feature: 'Lead Forms', free: 'Up to 3', pro: 'Unlimited', business: 'Unlimited' },
    { feature: 'Lead Distribution Recipients', free: 'Up to 2', pro: 'Unlimited', business: 'Unlimited' },
    { feature: 'AI Lead Parsing from Email', free: 'Unlimited', pro: 'Unlimited', business: 'Unlimited' },
    { feature: 'Meta Conversions API', free: 'Unlimited', pro: 'Unlimited', business: 'Unlimited' },
    { feature: 'Contactable Leads', free: 'Most recent', pro: 'Unlimited', business: 'Unlimited' },
    { feature: 'Follow Up Sequences', free: 'Most recent', pro: 'Unlimited', business: 'Unlimited' },
    { feature: 'Message Templates', free: 'Up to 10', pro: 'Unlimited', business: 'Unlimited' },
    { feature: 'File & Page Tracking', free: 'Most recent', pro: 'Unlimited', business: 'Unlimited' },
    { feature: 'Client Groups', free: '10', pro: '100', business: 'Unlimited' },
    { feature: 'Team Members', free: '1–3', pro: '1–20', business: 'Unlimited' },
    { feature: 'Subteam Hierarchy', free: '—', pro: '—', business: 'Unlimited' },
    { feature: 'Advanced Analytics', free: '—', pro: '—', business: 'Included' },
    { feature: 'Custom Mobile & Web Branding', free: '—', pro: '—', business: 'Included' },
  ];

  const faqs = [
    { q: 'Do I need a credit card to start?', a: 'No. Flazyn is free to try forever. No credit card or payment is required to create an account.' },
    { q: 'Is the Free Forever plan just a trial?', a: 'No. The Free Forever plan is not a trial. After a 14-day Pro trial, you automatically switch to the free plan and can keep using it.' },
    { q: 'What happens when I upgrade?', a: 'You unlock unlimited templates, sequences, view tracking, team assignment, bulk calling, and more.' },
    { q: 'Can I cancel anytime?', a: 'Yes. You can cancel your subscription anytime with no penalty. You keep access until the end of your billing period.' },
    { q: 'Is my lead data safe?', a: 'Yes. All data is encrypted in transit (TLS 1.2) and at rest. We never sell or share your leads.' },
  ];

  const handleSalesSubmit = (e) => {
    e.preventDefault();
    alert('Thanks! Our sales team will contact you shortly.');
  };

  return (
    <div className="min-h-screen" style={{ background: '#FAFAF9', color: '#1C1917', fontFamily: 'Inter, system-ui, sans-serif' }}>
      {/* Nav */}
      <nav className="bg-white border-b border-surface-border sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-8 h-8 flex items-center justify-center text-white font-bold" style={{ background: '#EDE9FF', borderRadius: '8px' }}>F</div>
            <span className="text-xl font-bold tracking-tight">Flazyn</span>
          </Link>
          <div className="flex items-center gap-3">
            <Link to="/login" className="text-sm text-ink-secondary hover:text-ink-primary transition" style={{ fontWeight: 500 }}>Login</Link>
            <Link to="/signup" className="text-sm text-white px-4 py-2 transition" style={{ background: '#EDE9FF', fontWeight: 600, borderRadius: '8px' }}>Sign Up</Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-20 pb-12 text-center">
        <div className="max-w-4xl mx-auto px-4">
          <h1 className="text-ink-primary mb-4" style={{ fontSize: '48px', fontWeight: 700, letterSpacing: '-0.02em' }}>Flexible plans for teams of all sizes</h1>
          <p className="text-ink-secondary mb-2" style={{ fontSize: '18px' }}>Skyrocket your sales and productivity today</p>
          <p className="text-ink-tertiary mb-8" style={{ fontSize: '15px' }}>Capture, engage, and manage every lead from your phone with Flazyn.</p>

          <div className="inline-flex items-center bg-white border border-surface-border p-1 mb-12" style={{ borderRadius: '8px' }}>
            <button
              onClick={() => setBilling('monthly')}
              className={`px-6 py-2 text-sm transition ${billing === 'monthly' ? 'text-white' : 'text-ink-secondary'}`}
              style={{ fontWeight: 600, borderRadius: '8px', ...(billing === 'monthly' ? { background: '#EDE9FF' } : {}) }}
            >
              Monthly
            </button>
            <button
              onClick={() => setBilling('yearly')}
              className={`px-6 py-2 text-sm transition flex items-center gap-2 ${billing === 'yearly' ? 'text-white' : 'text-ink-secondary'}`}
              style={{ fontWeight: 600, borderRadius: '8px', ...(billing === 'yearly' ? { background: '#EDE9FF' } : {}) }}
            >
              Yearly
              <span className="text-xs px-2 py-0.5" style={{ background: billing === 'yearly' ? 'rgba(255,255,255,0.2)' : '#F5F5F4', color: billing === 'yearly' ? '#fff' : '#EDE9FF', borderRadius: '8px' }}>2 months free</span>
            </button>
          </div>
        </div>
      </section>

      {/* Plans */}
      <section className="pb-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-3 gap-6">
            {plans.map((plan, i) => (
              <motion.div key={plan.name} initial={{ opacity: 0, y: 8, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ delay: Math.min(i * 0.08, 0.3), duration: 0.2 }} className={`relative bg-white border p-6 flex flex-col ${plan.ctaStyle === 'primary' ? 'border-accent' : 'border-surface-border'}`} style={{ borderRadius: '8px' }}>
                {plan.badge && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 text-white text-xs px-3 py-1" style={{ background: '#EDE9FF', fontWeight: 600, borderRadius: '8px' }}>
                    {plan.badge}
                  </div>
                )}
                <div className="text-sm font-semibold text-ink-tertiary mb-4">{plan.name}</div>
                <div className="mono text-ink-primary mb-1" style={{ fontSize: '36px', fontWeight: 700 }}>{plan.price} {plan.price !== 'Custom' && <span className="text-ink-tertiary" style={{ fontSize: '14px', fontWeight: 400 }}>/mo</span>}</div>
                <div className="text-sm text-ink-tertiary mb-4">{plan.sub}</div>
                <div className="bg-surface-page p-3 mb-4" style={{ borderRadius: '8px' }}>
                  <div className="text-sm font-semibold text-ink-primary">{plan.highlight}</div>
                </div>
                <p className="text-sm text-ink-secondary mb-6">{plan.desc}</p>
                <Link
                  to="/signup"
                  className={`block text-center py-3 mb-6 transition ${plan.ctaStyle === 'primary' ? 'text-white' : 'bg-white border border-surface-border text-ink-primary hover:border-ink-tertiary'}`}
                  style={{ fontSize: '14px', fontWeight: 600, borderRadius: '8px', ...(plan.ctaStyle === 'primary' ? { background: '#EDE9FF' } : {}) }}
                >
                  {plan.cta}
                </Link>
                <div className="text-xs text-ink-tertiary mb-4">
                  {plan.name === 'Free Forever' ? 'Free forever. No credit card required.' : plan.name === 'Flazyn Pro' ? '14 day free trial. No credit card required.' : 'Get a custom demo based on your requirements.'}
                </div>
                <div className="mt-auto">
                  <div className="text-xs font-semibold text-ink-tertiary uppercase mb-3" style={{ letterSpacing: '0.05em' }}>Key Features</div>
                  <ul className="space-y-2">
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-start gap-2 text-sm text-ink-secondary">
                        <span className="w-1 h-1 rounded-full mt-2 shrink-0" style={{ background: '#EDE9FF' }} /> {f}
                      </li>
                    ))}
                  </ul>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Comparison */}
      <section className="py-20 bg-white border-y border-surface-border">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-ink-primary text-center mb-12" style={{ fontSize: '36px', fontWeight: 700, letterSpacing: '-0.01em' }}>Compare plans</h2>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-surface-border">
                  <th className="text-left py-4 pr-4 font-semibold text-ink-primary" style={{ fontSize: '14px' }}>Feature</th>
                  <th className="py-4 px-4 text-center font-semibold text-ink-primary" style={{ fontSize: '14px' }}>Free Forever</th>
                  <th className="py-4 px-4 text-center font-semibold" style={{ fontSize: '14px', color: '#4A2FD6' }}>Flazyn Pro</th>
                  <th className="py-4 px-4 text-center font-semibold text-ink-primary" style={{ fontSize: '14px' }}>Flazyn Business</th>
                </tr>
              </thead>
              <tbody>
                {comparison.map((row, idx) => (
                  <tr key={row.feature} className="border-b border-surface-border">
                    <td className="py-3 pr-4 text-sm font-medium text-ink-primary">{row.feature}</td>
                    <td className="py-3 px-4 text-center text-sm text-ink-tertiary">{row.free}</td>
                    <td className="py-3 px-4 text-center text-sm text-ink-primary" style={{ fontWeight: 500 }}>{row.pro}</td>
                    <td className="py-3 px-4 text-center text-sm text-ink-primary" style={{ fontWeight: 500 }}>{row.business}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Sales contact form */}
      <section className="py-20">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 items-start">
            <div>
              <h2 className="text-ink-primary mb-4" style={{ fontSize: '36px', fontWeight: 700, letterSpacing: '-0.01em' }}>Talk to our sales team</h2>
              <p className="text-ink-secondary mb-6" style={{ fontSize: '18px' }}>Book your personalised consultation with our experts to:</p>
              <ul className="space-y-3 mb-8">
                {[
                  'Explore how Flazyn solves your most critical business challenges',
                  'Discover the best setup and tailored pricing for your team',
                  'Boost your team sales and productivity',
                ].map((item) => (
                  <li key={item} className="flex items-start gap-3 text-ink-secondary" style={{ fontSize: '15px' }}>
                    <span className="w-1.5 h-1.5 rounded-full mt-2 shrink-0" style={{ background: '#EDE9FF' }} /> {item}
                  </li>
                ))}
              </ul>
              <div className="text-sm text-ink-tertiary">
                Trusted by 500,000+ businesses worldwide
              </div>
            </div>
            <form onSubmit={handleSalesSubmit} className="bg-white border border-surface-border p-6" style={{ borderRadius: '8px' }}>
              <div className="space-y-4">
                <div>
                  <p className="meta-label mb-1">Name</p>
                  <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="input" placeholder="Your name" />
                </div>
                <div>
                  <p className="meta-label mb-1">Email</p>
                  <input type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="input" placeholder="name@company.com" />
                </div>
                <div>
                  <p className="meta-label mb-1">Phone number</p>
                  <input type="tel" required value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="input mono" placeholder="+1 201-555-0123" />
                </div>
                <div>
                  <p className="meta-label mb-1">How big is your sales team?</p>
                  <select required value={form.teamSize} onChange={(e) => setForm({ ...form, teamSize: e.target.value })} className="input">
                    <option value="">Select option...</option>
                    <option>Just me</option>
                    <option>2–5</option>
                    <option>6–20</option>
                    <option>21–50</option>
                    <option>50+</option>
                  </select>
                </div>
                <div>
                  <p className="meta-label mb-1">Which best describes your business?</p>
                  <select required value={form.business} onChange={(e) => setForm({ ...form, business: e.target.value })} className="input">
                    <option value="">Select option...</option>
                    <option>Real Estate</option>
                    <option>Marketing Agency</option>
                    <option>Insurance</option>
                    <option>E-commerce</option>
                    <option>Education</option>
                    <option>Other</option>
                  </select>
                </div>
                <div>
                  <p className="meta-label mb-1">How do you primarily engage leads?</p>
                  <select required value={form.method} onChange={(e) => setForm({ ...form, method: e.target.value })} className="input">
                    <option value="">Select option...</option>
                    <option>WhatsApp</option>
                    <option>Email</option>
                    <option>SMS</option>
                    <option>Phone Calls</option>
                    <option>Multiple channels</option>
                  </select>
                </div>
                <button type="submit" className="btn btn-primary w-full">
                  Submit
                </button>
              </div>
            </form>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-20 bg-white border-y border-surface-border">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-ink-primary text-center mb-10" style={{ fontSize: '36px', fontWeight: 700, letterSpacing: '-0.01em' }}>FAQ: Free vs Pro</h2>
          <div className="space-y-0">
            {faqs.map((faq, idx) => (
              <motion.div key={idx} initial={{ opacity: 0, y: 8 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-20px' }} transition={{ delay: Math.min(idx * 0.04, 0.3), duration: 0.2 }} className="border-b border-surface-border">
                <button onClick={() => setOpenFaq(openFaq === idx ? null : idx)} className="w-full flex items-center justify-between py-4 text-left text-ink-primary transition" style={{ fontSize: '15px', fontWeight: 600 }}>
                  {faq.q}
                  <span className="text-ink-tertiary ml-4" style={{ fontSize: '14px' }}>{openFaq === idx ? '−' : '+'}</span>
                </button>
                {openFaq === idx && (
                  <div className="pb-4 text-ink-secondary leading-relaxed" style={{ fontSize: '14px' }}>{faq.a}</div>
                )}
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 text-center" style={{ background: 'linear-gradient(135deg, #7C5CFF 0%, #5B3DF5 100%)' }}>
        <div className="max-w-3xl mx-auto px-4">
          <h2 className="text-white mb-4" style={{ fontSize: '36px', fontWeight: 700, letterSpacing: '-0.01em' }}>Ready to try?</h2>
          <p className="mb-6" style={{ fontSize: '18px', color: 'rgba(255,255,255,0.7)' }}>Start using Flazyn for free. No credit card required.</p>
          <Link to="/signup" className="inline-flex items-center gap-2 text-white px-8 py-4 transition" style={{ background: '#EDE9FF', fontWeight: 600, borderRadius: '8px' }}>
            Get Started Free →
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-white border-t border-surface-border py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-4 gap-8 mb-8">
            <div>
              <div className="flex items-center gap-2 text-ink-primary mb-3">
                <div className="w-8 h-8 flex items-center justify-center text-white" style={{ background: '#EDE9FF', borderRadius: '8px' }}>F</div>
                <span className="text-xl font-bold">Flazyn</span>
              </div>
              <p className="text-sm text-ink-tertiary">The mobile-first CRM for modern sales teams.</p>
            </div>
            <div>
              <div className="font-semibold text-ink-primary mb-3">Product</div>
              <ul className="space-y-2 text-sm">
                <li><Link to="/landing#features" className="text-ink-tertiary hover:text-accent-deep transition">Features</Link></li>
                <li><Link to="/landing#integrations" className="text-ink-tertiary hover:text-accent-deep transition">Integrations</Link></li>
                <li><Link to="/pricing" className="text-ink-tertiary hover:text-accent-deep transition">Pricing</Link></li>
                <li><Link to="/" className="text-ink-tertiary hover:text-accent-deep transition">Mobile App</Link></li>
              </ul>
            </div>
            <div>
              <div className="font-semibold text-ink-primary mb-3">Resources</div>
              <ul className="space-y-2 text-sm">
                <li><a href="#" className="text-ink-tertiary hover:text-accent-deep transition">Help Center</a></li>
                <li><a href="#" className="text-ink-tertiary hover:text-accent-deep transition">Blog</a></li>
                <li><a href="#" className="text-ink-tertiary hover:text-accent-deep transition">API Docs</a></li>
                <li><a href="#" className="text-ink-tertiary hover:text-accent-deep transition">Status</a></li>
              </ul>
            </div>
            <div>
              <div className="font-semibold text-ink-primary mb-3">Company</div>
              <ul className="space-y-2 text-sm">
                <li><a href="#" className="text-ink-tertiary hover:text-accent-deep transition">About</a></li>
                <li><a href="#" className="text-ink-tertiary hover:text-accent-deep transition">Careers</a></li>
                <li><Link to="/privacy" className="text-ink-tertiary hover:text-accent-deep transition">Privacy</Link></li>
                <li><Link to="/terms" className="text-ink-tertiary hover:text-accent-deep transition">Terms</Link></li>
                <li><Link to="/data-deletion" className="text-ink-tertiary hover:text-accent-deep transition">Data deletion</Link></li>
              </ul>
            </div>
          </div>
          <div className="text-sm text-ink-tertiary">© 2026 Flazyn. All rights reserved.</div>
        </div>
      </footer>
    </div>
  );
}
