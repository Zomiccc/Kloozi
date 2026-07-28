import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Check, ChevronDown, ChevronUp, Star, ArrowRight, MessageCircle, Zap, Shield,
  Smartphone, Users, Globe, Clock, Mail, BarChart3
} from 'lucide-react';

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
      name: 'Zomic Pro',
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
      name: 'Zomic Business',
      price: 'Custom',
      sub: 'Contact sales for pricing',
      highlight: 'For 20+ team members',
      desc: 'Unlock the full power of Zomic for larger teams and agencies.',
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
    { q: 'Do I need a credit card to start?', a: 'No. Zomic is free to try forever. No credit card or payment is required to create an account.' },
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
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">
      {/* Simple nav */}
      <nav className="bg-white border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #FF3B5C, #FF9500)' }}>
              <Zap className="text-white" size={18} />
            </div>
            <span className="text-xl font-bold">Zomic</span>
          </Link>
          <div className="flex items-center gap-3">
            <Link to="/login" className="text-sm font-medium text-slate-600 hover:text-[#FF3B5C] px-3 py-2">Login</Link>
            <Link to="/signup" className="text-sm font-semibold text-white px-4 py-2 rounded-lg transition" style={{ background: 'linear-gradient(135deg, #FF3B5C, #FF9500)' }}>Sign Up</Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-20 pb-12 text-center bg-white">
        <div className="max-w-4xl mx-auto px-4">
          <h1 className="text-4xl sm:text-5xl font-bold mb-4">Flexible plans for teams of all sizes</h1>
          <p className="text-lg text-slate-600 mb-2">Skyrocket your sales and productivity today 🚀</p>
          <p className="text-slate-500 mb-8">Capture, engage, and manage every lead from your phone with Zomic.</p>

          <div className="inline-flex items-center bg-slate-900 rounded-xl p-1 mb-12">
            <button
              onClick={() => setBilling('monthly')}
              className={`px-6 py-2 rounded-lg text-sm font-semibold transition ${billing === 'monthly' ? 'bg-white text-slate-900' : 'text-slate-300'}`}
            >
              Monthly
            </button>
            <button
              onClick={() => setBilling('yearly')}
              className={`px-6 py-2 rounded-lg text-sm font-semibold transition flex items-center gap-2 ${billing === 'yearly' ? 'bg-white text-slate-900' : 'text-slate-300'}`}
            >
              Yearly
              <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">🎁 2 months free</span>
            </button>
          </div>
        </div>
      </section>

      {/* Plans */}
      <section className="pb-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-3 gap-6">
            {plans.map((plan) => (
              <div key={plan.name} className={`relative rounded-2xl border p-6 flex flex-col ${plan.ctaStyle === 'primary' ? 'border-[#FF3B5C] shadow-xl bg-white' : 'border-slate-200 bg-white'}`}>
                {plan.badge && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 text-white text-xs font-bold px-3 py-1 rounded-full" style={{ background: 'linear-gradient(135deg, #FF3B5C, #FF9500)' }}>
                    {plan.badge}
                  </div>
                )}
                <div className={`text-xs font-bold inline-block px-3 py-1 rounded-full mb-4 w-fit ${plan.name === 'Free Forever' ? 'bg-blue-100 text-blue-700' : plan.name === 'Zomic Pro' ? 'bg-red-100 text-red-700' : 'bg-orange-100 text-orange-700'}`}>
                  {plan.name}
                </div>
                <div className="text-4xl font-bold mb-1">{plan.price} <span className="text-lg font-normal text-slate-500">USD</span></div>
                <div className="text-sm text-slate-500 mb-4">{plan.sub}</div>
                <div className="bg-slate-50 rounded-lg p-3 mb-4">
                  <div className="text-sm font-semibold text-slate-900">{plan.highlight}</div>
                </div>
                <p className="text-sm text-slate-600 mb-6">{plan.desc}</p>
                <Link
                  to="/signup"
                  className={`block text-center font-semibold py-3 rounded-lg mb-6 transition ${plan.ctaStyle === 'primary' ? 'text-white' : 'bg-white border-2 border-[#FF3B5C] text-[#FF3B5C] hover:bg-red-50'}`}
                  style={plan.ctaStyle === 'primary' ? { background: 'linear-gradient(135deg, #FF3B5C, #FF9500)' } : {}}
                >
                  {plan.cta}
                </Link>
                <div className="text-xs text-slate-500 mb-4">
                  {plan.name === 'Free Forever' ? 'Free forever. No credit card required.' : plan.name === 'Zomic Pro' ? '14 day free trial. No credit card required.' : 'Get a custom demo based on your requirements.'}
                </div>
                <div className="mt-auto">
                  <div className="text-xs font-bold text-slate-500 uppercase mb-3">Key Features</div>
                  <ul className="space-y-2">
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-start gap-2 text-sm text-slate-700">
                        <Check size={16} className="text-green-500 mt-0.5 shrink-0" /> {f}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Comparison */}
      <section className="py-20 bg-slate-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-center mb-12">Compare plans</h2>
          <div className="overflow-x-auto">
            <table className="w-full bg-white rounded-2xl shadow-sm border border-slate-200">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="text-left p-4 font-semibold text-slate-900">Feature</th>
                  <th className="p-4 text-center font-semibold text-slate-900">Free Forever</th>
                  <th className="p-4 text-center font-semibold" style={{ color: '#FF3B5C' }}>Zomic Pro</th>
                  <th className="p-4 text-center font-semibold text-orange-600">Zomic Business</th>
                </tr>
              </thead>
              <tbody>
                {comparison.map((row, idx) => (
                  <tr key={row.feature} className={idx % 2 === 0 ? 'bg-slate-50/50' : ''}>
                    <td className="p-4 text-sm font-medium text-slate-700">{row.feature}</td>
                    <td className="p-4 text-center text-sm text-slate-600">{row.free}</td>
                    <td className="p-4 text-center text-sm text-slate-900 font-medium">{row.pro}</td>
                    <td className="p-4 text-center text-sm text-slate-900 font-medium">{row.business}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Sales contact form */}
      <section className="py-20" style={{ background: 'linear-gradient(135deg, #FF3B5C, #FF9500)' }}>
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="text-white">
              <h2 className="text-3xl font-bold mb-4">Talk to our Sales Team</h2>
              <p className="mb-6" style={{ color: 'rgba(255,255,255,0.85)' }}>Book your personalised consultation with our experts to:</p>
              <ul className="space-y-3">
                {[
                  'Explore how Zomic solves your most critical business challenges',
                  'Discover the best setup and tailored pricing for your team',
                  'Boost your team sales and productivity',
                ].map((item) => (
                  <li key={item} className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center shrink-0 mt-0.5"><Check size={14} /></div>
                    <span style={{ color: 'rgba(255,255,255,0.9)' }}>{item}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-8 flex items-center gap-2 text-sm" style={{ color: 'rgba(255,255,255,0.7)' }}>
                <Star size={16} fill="currentColor" /> Trusted by 500,000+ businesses worldwide
              </div>
            </div>
            <form onSubmit={handleSalesSubmit} className="bg-white rounded-2xl p-6 shadow-lg">
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Name *</label>
                  <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400" placeholder="Your name" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Email *</label>
                  <input type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400" placeholder="name@company.com" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Phone Number *</label>
                  <input type="tel" required value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400" placeholder="+1 201-555-0123" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">How big is your sales team? *</label>
                  <select required value={form.teamSize} onChange={(e) => setForm({ ...form, teamSize: e.target.value })} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400">
                    <option value="">Select option...</option>
                    <option>Just me</option>
                    <option>2–5</option>
                    <option>6–20</option>
                    <option>21–50</option>
                    <option>50+</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Which best describes your business? *</label>
                  <select required value={form.business} onChange={(e) => setForm({ ...form, business: e.target.value })} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400">
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
                  <label className="block text-xs font-semibold text-slate-700 mb-1">How do you primarily engage leads? *</label>
                  <select required value={form.method} onChange={(e) => setForm({ ...form, method: e.target.value })} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400">
                    <option value="">Select option...</option>
                    <option>WhatsApp</option>
                    <option>Email</option>
                    <option>SMS</option>
                    <option>Phone Calls</option>
                    <option>Multiple channels</option>
                  </select>
                </div>
                <button type="submit" className="w-full text-white font-semibold py-3 rounded-lg transition" style={{ background: 'linear-gradient(135deg, #FF3B5C, #FF9500)' }}>
                  Submit
                </button>
              </div>
            </form>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-20 bg-white">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-center mb-10">FAQ: Free vs Pro</h2>
          <div className="space-y-3">
            {faqs.map((faq, idx) => (
              <div key={idx} className="border border-slate-200 rounded-xl overflow-hidden">
                <button onClick={() => setOpenFaq(openFaq === idx ? null : idx)} className="w-full flex items-center justify-between p-4 text-left font-semibold text-slate-900 bg-slate-50 hover:bg-slate-100 transition">
                  {faq.q}
                  {openFaq === idx ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                </button>
                {openFaq === idx && (
                  <div className="p-4 text-sm text-slate-600 leading-relaxed">{faq.a}</div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 bg-slate-900 text-white text-center">
        <div className="max-w-3xl mx-auto px-4">
          <h2 className="text-3xl font-bold mb-4">Ready to try?</h2>
          <p className="text-slate-300 mb-6">Start using Zomic for free. No credit card required.</p>
          <Link to="/signup" className="inline-flex items-center gap-2 text-white font-bold px-6 py-3 rounded-xl transition" style={{ background: 'linear-gradient(135deg, #FF3B5C, #FF9500)' }}>
            Get Started Free <ArrowRight size={18} />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-900 text-slate-400 py-12 border-t border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-4 gap-8 mb-8">
            <div>
              <div className="flex items-center gap-2 text-white mb-3">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #FF3B5C, #FF9500)' }}><Zap size={18} className="text-white" /></div>
                <span className="text-xl font-bold">Zomic</span>
              </div>
              <p className="text-sm">The mobile-first CRM for modern sales teams.</p>
            </div>
            <div>
              <div className="font-semibold text-white mb-3">Product</div>
              <ul className="space-y-2 text-sm">
                <li><Link to="/landing#features" className="hover:text-white">Features</Link></li>
                <li><Link to="/landing#integrations" className="hover:text-white">Integrations</Link></li>
                <li><Link to="/pricing" className="hover:text-white">Pricing</Link></li>
                <li><Link to="/" className="hover:text-white">Mobile App</Link></li>
              </ul>
            </div>
            <div>
              <div className="font-semibold text-white mb-3">Resources</div>
              <ul className="space-y-2 text-sm">
                <li><a href="#" className="hover:text-white">Help Center</a></li>
                <li><a href="#" className="hover:text-white">Blog</a></li>
                <li><a href="#" className="hover:text-white">API Docs</a></li>
                <li><a href="#" className="hover:text-white">Status</a></li>
              </ul>
            </div>
            <div>
              <div className="font-semibold text-white mb-3">Company</div>
              <ul className="space-y-2 text-sm">
                <li><a href="#" className="hover:text-white">About</a></li>
                <li><a href="#" className="hover:text-white">Careers</a></li>
                <li><a href="#" className="hover:text-white">Privacy</a></li>
                <li><a href="#" className="hover:text-white">Terms</a></li>
              </ul>
            </div>
          </div>
          <div className="text-sm text-slate-500">© 2026 Zomic. All rights reserved.</div>
        </div>
      </footer>
    </div>
  );
}
