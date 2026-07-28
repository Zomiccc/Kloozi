import { useNavigate } from 'react-router-dom';
import useAuthStore from '../stores/authStore';
import {
  Plug, MessageSquare, Send, Users, Repeat, Zap, Settings, ArrowRight,
  Smartphone, Bell, Phone, BarChart3, UserPlus, GitBranch, Crown, CheckCircle2
} from 'lucide-react';

export default function Welcome() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const firstName = user?.firstName || user?.first_name || 'there';

  const sections = [
    {
      title: 'New Lead Automations',
      subtitle: 'Instantly receive, contact, and follow up with new leads. Automatically receive leads from your lead sources, and engage them with automated sequences across WhatsApp, text message, phone calls, and more.',
      cards: [
        { icon: Plug, title: 'Connect Your Lead Sources', desc: 'Receive new leads from your website, Google, & other sources', route: '/app/automations', color: '#0066FF' },
        { icon: MessageSquare, title: 'WhatsApp Auto-Responder', desc: 'Automatically message new leads on WhatsApp, from your number', route: '/app/automations/whatsapp-auto-responder', color: '#34C759' },
      ],
    },
    {
      title: 'Bulk Lead Engagement',
      subtitle: 'Re-engage existing leads at scale. Bulk call or message thousands of leads at a time with auto-personalisation, multi-step sequences, view tracking, and one-click WhatsApp campaigns.',
      cards: [
        { icon: Repeat, title: 'Set your Default Sequence', desc: 'Configure a multi-step intro sequence to engage new leads', route: '/app/email-sequences', color: '#FF9500' },
        { icon: Send, title: 'Send a WhatsApp Campaign', desc: 'Instantly message thousands of leads via WhatsApp in one click', route: '/app/whatsapp-campaigns', color: '#34C759' },
      ],
    },
    {
      title: 'Easy Lead Management',
      subtitle: 'Track every lead & sales activity. View and manage your leads, playbooks, and sales pipeline right from your phone. Track your team\'s performance with high-level dashboards and detailed activity timelines.',
      cards: [
        { icon: Settings, title: 'Create Custom Client Fields', desc: 'Customise client fields to capture key details about every lead', route: '/app/settings', color: '#AF52DE' },
        { icon: BarChart3, title: 'View Analytics Dashboard', desc: 'Track your pipeline, conversion rates, and team performance', route: '/app/analytics', color: '#0066FF' },
      ],
    },
    {
      title: 'Official WhatsApp Automations',
      subtitle: 'Use your existing WhatsApp Business number to instantly message new leads, automatically follow up, bulk message thousands, import new contacts to the CRM, and much more.',
      cards: [
        { icon: MessageSquare, title: 'WhatsApp Auto-Responder', desc: 'Automatically message new leads on WhatsApp, from your number', route: '/app/automations/whatsapp-auto-responder', color: '#34C759' },
        { icon: Send, title: 'Send a WhatsApp Campaign', desc: 'Instantly message thousands of leads via WhatsApp in one click', route: '/app/whatsapp-campaigns', color: '#34C759' },
      ],
    },
    {
      title: 'Use Zomic as a Team',
      subtitle: 'Gain full control and visibility over your sales team. Automatically assign leads and get real-time insights into the pipelines and progress of every team member.',
      cards: [
        { icon: UserPlus, title: 'Invite Your Team Members', desc: 'Add your team to coordinate on leads and track progress', route: '/app/team', color: '#0066FF' },
        { icon: GitBranch, title: 'Set up Lead Assignment', desc: 'Create rules to automatically assign new leads to your team', route: '/app/automations/rules', color: '#FF9500' },
      ],
    },
  ];

  return (
    <div className="space-y-8 pb-12">
      {/* Hero Header */}
      <div className="text-center py-10 px-4">
        <div
          className="w-16 h-16 rounded-2xl flex items-center justify-center text-white font-extrabold text-2xl mx-auto mb-5 shadow-card"
          style={{ background: 'linear-gradient(135deg, #FF3B5C, #FF9500)' }}
        >
          Z
        </div>
        <h1 className="text-4xl font-extrabold text-ink-primary tracking-tight">
          Welcome to Zomic
        </h1>
        <p className="text-lg text-ink-secondary mt-3 max-w-xl mx-auto">
          Hi {firstName}, let's get you set up. Explore the features below to start capturing and converting leads.
        </p>
        <button
          onClick={() => navigate('/app/dashboard')}
          className="btn btn-primary mt-6 px-8 py-3 text-base font-bold"
          style={{ background: 'linear-gradient(135deg, #FF3B5C, #FF9500)', border: 'none' }}
        >
          Go to Dashboard <ArrowRight size={18} className="inline ml-1" />
        </button>
      </div>

      {/* Feature Sections */}
      {sections.map((section, sIdx) => (
        <div key={sIdx} className="space-y-4">
          <div>
            <h2 className="text-xl font-extrabold text-ink-primary">{section.title}</h2>
            <p className="text-sm text-ink-secondary mt-1 max-w-2xl">{section.subtitle}</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {section.cards.map((card, cIdx) => (
              <button
                key={cIdx}
                onClick={() => navigate(card.route)}
                className="card card-hover text-left flex items-start gap-4 group"
              >
                <div
                  className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0"
                  style={{ background: `${card.color}15` }}
                >
                  <card.icon size={24} style={{ color: card.color }} />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-ink-primary group-hover:text-accent-red transition-colors">
                    {card.title}
                  </h3>
                  <p className="text-sm text-ink-secondary mt-1">{card.desc}</p>
                </div>
                <ArrowRight size={18} className="text-ink-tertiary group-hover:text-accent-red group-hover:translate-x-1 transition-all flex-shrink-0 mt-1" />
              </button>
            ))}
          </div>
        </div>
      ))}

      {/* Mobile App Banner */}
      <div
        className="rounded-3xl p-6 flex flex-col sm:flex-row items-center gap-6 text-white"
        style={{ background: 'linear-gradient(135deg, #FF3B5C, #FF9500)' }}
      >
        <Smartphone size={48} className="flex-shrink-0" />
        <div className="flex-1 text-center sm:text-left">
          <h3 className="text-lg font-extrabold">Download the Zomic App</h3>
          <p className="text-sm text-white/90 mt-1">
            Get instant new lead alerts, one-touch calls / WhatsApp / SMS, phonebook integration, view tracking, and more
          </p>
        </div>
        <div className="flex gap-3 flex-shrink-0">
          <div className="bg-white/20 backdrop-blur-sm rounded-xl px-4 py-2.5 text-center cursor-pointer hover:bg-white/30 transition-colors">
            <p className="text-xs font-semibold">App Store</p>
            <p className="text-[10px] text-white/80">Download on the</p>
          </div>
          <div className="bg-white/20 backdrop-blur-sm rounded-xl px-4 py-2.5 text-center cursor-pointer hover:bg-white/30 transition-colors">
            <p className="text-xs font-semibold">Google Play</p>
            <p className="text-[10px] text-white/80">Get it on</p>
          </div>
        </div>
      </div>

      {/* Unlock Full Access Banner */}
      <div className="card text-center" style={{ padding: '40px 24px' }}>
        <Crown size={32} style={{ color: '#FF9500' }} className="mx-auto mb-3" />
        <h3 className="text-xl font-extrabold text-ink-primary">Unlock Full Access</h3>
        <p className="text-sm text-ink-secondary mt-2 max-w-md mx-auto">
          Please subscribe to unlock unlimited access to the full functionality of Zomic.
        </p>
        <button
          onClick={() => navigate('/app/billing')}
          className="btn btn-primary mt-5 px-8 py-3 font-bold"
          style={{ background: 'linear-gradient(135deg, #FF3B5C, #FF9500)', border: 'none' }}
        >
          View Plans <ArrowRight size={16} className="inline ml-1" />
        </button>
      </div>

      {/* Quick Links Footer */}
      <div className="flex flex-wrap justify-center gap-3 pt-4">
        {[
          { label: 'Leads', route: '/app/leads', icon: Users },
          { label: 'Automations', route: '/app/automations', icon: Zap },
          { label: 'Analytics', route: '/app/analytics', icon: BarChart3 },
          { label: 'Settings', route: '/app/settings', icon: Settings },
        ].map((link, i) => (
          <button
            key={i}
            onClick={() => navigate(link.route)}
            className="flex items-center gap-2 px-4 py-2 rounded-full bg-surface-page border border-surface-border text-sm font-semibold text-ink-secondary hover:text-ink-primary hover:border-ink-tertiary transition-all"
          >
            <link.icon size={14} /> {link.label}
          </button>
        ))}
      </div>
    </div>
  );
}
