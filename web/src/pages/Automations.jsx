import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import API from '../lib/api';
import toast from 'react-hot-toast';
import {
  Zap, Facebook, MessageSquare, Globe, FileText, Music, Linkedin,
  Link2, GitBranch, Filter, Send, Users, Webhook, Download, Upload,
  Settings, CheckCircle2, XCircle, ChevronRight, Bot, Repeat, Copy,
  Monitor, Search, Phone, RefreshCw, X
} from 'lucide-react';
import BrandLogo from '../components/BrandLogo';

const leadSourceCards = [
  { id: 'lead_forms', icon: FileText, title: 'CRM Final Forms', desc: 'Create lead forms using our form builder and receive instant alerts', route: '/app/automations/lead-forms', connected: true },
  { id: 'facebook', icon: Facebook, title: 'Facebook & Instagram', desc: 'Receive new leads from Facebook & Instagram Lead Ads', route: '/app/automations/facebook', oauth: true, logo: 'facebook' },
  { id: 'linkedin', icon: Linkedin, title: 'LinkedIn', desc: 'Receive new leads from LinkedIn Lead Gen Forms', route: '/app/automations/linkedin', oauth: true, logo: 'linkedin' },
  { id: 'wordpress', icon: Globe, title: 'WordPress', desc: 'Receive new leads from WordPress contact forms', route: '/app/automations/wordpress', logo: 'wordpress' },
  { id: 'whatsapp_chats', icon: MessageSquare, title: 'WhatsApp Chats', desc: 'Auto create leads from WhatsApp conversations', route: '/app/automations/whatsapp-chats', logo: 'whatsapp' },
  { id: 'google_forms', icon: FileText, title: 'Google Forms', desc: 'Receive leads from Google Forms', route: '/app/automations/google-forms', logo: 'google' },
  { id: 'tiktok', icon: Music, title: 'TikTok', desc: 'Receive leads from TikTok Lead Generation', route: '/app/automations/tiktok', oauth: true, logo: 'tiktok' },
  { id: 'google_ads', icon: Search, title: 'Google Ads', desc: 'Receive leads from Google Ads Lead Form Assets', route: '/app/automations/google-ads', oauth: true, logo: 'google' },
  { id: 'zapier', icon: Link2, title: 'Zapier / Webhook', desc: 'Connect any other lead source via webhook', route: '/app/automations/zapier', logo: 'zapier' },
];

const leadAutomationCards = [
  { id: 'whatsapp_auto', icon: MessageSquare, title: 'WhatsApp Auto-Responder', desc: 'Instantly message new leads on WhatsApp from your own number', route: '/app/automations/whatsapp-auto-responder', logo: 'whatsapp' },
  { id: 'meta_capi', icon: Zap, title: 'Meta Conversions API', desc: 'Optimise Facebook Lead Ad campaigns', route: '/app/automations/meta-capi', logo: 'meta', checkEnv: true },
  { id: 'duplicate_merge', icon: GitBranch, title: 'Duplicate Lead Merging', desc: 'Auto merge leads with same phone/email', route: '/app/automations/duplicate-merge' },
  { id: 'automation_rules', icon: Filter, title: 'Lead Automation Rules', desc: 'Assign leads via rules or round robin', route: '/app/automations/rules' },
  { id: 'lead_distribution', icon: Send, title: 'Lead Distribution', desc: 'Forward leads to recipients via WhatsApp/email', route: '/app/automations/distribution' },
  { id: 'outgoing_webhooks', icon: Webhook, title: 'Outgoing Webhooks', desc: 'Trigger webhooks to any system that supports webhooks', route: '/app/automations/outgoing-webhooks' },
];

const whatsappAutomationCards = [
  { id: 'wa_campaigns', icon: Send, title: 'WhatsApp Campaigns', desc: 'Bulk message 1,000s from your own number', route: '/app/whatsapp-campaigns', logo: 'whatsapp' },
  { id: 'wa_auto_responder', icon: MessageSquare, title: 'WhatsApp Auto-Responder', desc: 'Instantly message new leads', route: '/app/automations/whatsapp-auto-responder', logo: 'whatsapp' },
  { id: 'wa_sequences', icon: Repeat, title: 'Automated WhatsApp Sequences', desc: 'Multi-step sequences over multiple days', route: '/app/automations/whatsapp-sequences', logo: 'whatsapp' },
  { id: 'wa_chat_assistant', icon: Bot, title: 'WhatsApp Chat Assistant', desc: 'Configure automated response rules', route: '/app/automations/chat-assistant', logo: 'whatsapp' },
  { id: 'wa_contact_import', icon: Users, title: 'WhatsApp Contact Import', desc: 'Create leads from WhatsApp chats', route: '/app/automations/whatsapp-contact-import', logo: 'whatsapp' },
  { id: 'wa_lead_distribution', icon: Send, title: 'WhatsApp Lead Distribution', desc: 'Forward new leads via WhatsApp', route: '/app/automations/distribution', logo: 'whatsapp' },
  { id: 'wa_chat_monitoring', icon: Monitor, title: 'WhatsApp Chat Monitoring', desc: 'View team WhatsApp conversations', route: '/app/automations/chat-monitoring', logo: 'whatsapp' },
  { id: 'wa_widget', icon: Globe, title: 'WhatsApp Widget for Website', desc: 'Add chat button to website', route: '/app/automations/whatsapp-widget', logo: 'whatsapp' },
  { id: 'wa_ai_agent', icon: Bot, title: 'WhatsApp AI Agent Lite', desc: 'Add AI to WhatsApp to capture details', route: '/app/automations/whatsapp-ai-agent', logo: 'whatsapp' },
];

export default function Automations() {
  const [tab, setTab] = useState('all');
  const [integrations, setIntegrations] = useState([]);
  const [accountToken, setAccountToken] = useState('');
  const [metaCapiConfigured, setMetaCapiConfigured] = useState(false);
  const navigate = useNavigate();

  useEffect(() => { loadIntegrations(); loadToken(); loadMetaCAPIStatus(); }, []);

  const loadIntegrations = async () => {
    try {
      const res = await API.get('/integrations');
      setIntegrations(res.data.integrations || []);
    } catch {}
  };

  const loadToken = async () => {
    try {
      const res = await API.get('/automations/account-token');
      setAccountToken(res.data.account_token);
    } catch {}
  };

  const loadMetaCAPIStatus = async () => {
    try {
      const res = await API.get('/automations/meta-capi');
      setMetaCapiConfigured(res.data.is_configured || false);
    } catch {}
  };

  const isConnected = (type) => {
    if (type === 'meta_capi') {
      return metaCapiConfigured;
    }
    return integrations.some(i => i.type === type && i.is_connected);
  };

  const renderCard = (card) => {
    const connected = card.connected || isConnected(card.id) || isConnected(card.oauth ? card.id : card.id);
    return (
      <div key={card.id} className="card card-hover stagger-in flex flex-col transition-all duration-200 hover:shadow-card-hover">
        <div className="flex items-start gap-3 mb-3">
          <div className="w-11 h-11 rounded-2xl bg-surface-page flex items-center justify-center flex-shrink-0">
            {card.logo ? <BrandLogo brand={card.logo} /> : <card.icon size={20} className="text-accent-blue" />}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-ink-primary text-sm">{card.title}</h3>
            <p className="text-xs text-ink-secondary mt-1 leading-relaxed">{card.desc}</p>
          </div>
        </div>
        <div className="mt-auto flex items-center justify-between pt-3 border-t border-surface-border">
          {connected ? (
            <span className="flex items-center gap-1.5 text-xs font-bold" style={{ color: '#34C759' }}>
              <span className="w-2 h-2 rounded-full" style={{ background: '#34C759' }} /> Connected
            </span>
          ) : (
            <span className="flex items-center gap-1.5 text-xs font-bold text-ink-tertiary">
              <span className="w-2 h-2 rounded-full bg-surface-border" /> Not Connected
            </span>
          )}
          <button
            onClick={() => navigate(card.route)}
            className="text-xs font-bold text-accent-blue hover:underline flex items-center gap-1"
          >
            {connected ? 'Configure' : 'Connect'}
            <ChevronRight size={14} />
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-extrabold text-ink-primary tracking-tight">Automations</h1>
        <p className="text-sm font-semibold text-ink-secondary mt-1">Connect your lead sources and configure automated workflows</p>
      </div>

      {/* WhatsApp Hero Banner */}
      <div className="rounded-3xl p-8 stagger-in" style={{ background: 'linear-gradient(135deg, #34C759, #0066FF)' }}>
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-white/20 flex items-center justify-center flex-shrink-0">
              <MessageSquare size={28} className="text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">WhatsApp Business Suite</h2>
              <p className="text-sm text-white/80 mt-1">Auto-respond, send campaigns, build sequences, and more — all from your own number</p>
            </div>
          </div>
          <button onClick={() => setTab('whatsapp')} className="bg-white/20 hover:bg-white/30 rounded-xl px-5 py-2.5 text-sm font-bold text-white transition-all backdrop-blur-sm whitespace-nowrap">
            Explore WhatsApp →
          </button>
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 bg-white border border-surface-border rounded-full p-1 flex-wrap">
        {['all', 'sources', 'automations', 'whatsapp', 'import'].map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`tab-pill ${tab === t ? 'tab-pill-active bg-accent-red' : 'text-ink-secondary hover:text-ink-primary'}`}
          >
            {t === 'all' ? 'All Automations' : t === 'sources' ? 'Lead Sources' : t === 'automations' ? 'Lead Automations' : t === 'whatsapp' ? 'WhatsApp' : 'Import/Export'}
          </button>
        ))}
      </div>

      {(tab === 'all' || tab === 'sources') && (
        <section>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-bold text-ink-primary">Lead Source Integrations</h2>
              <p className="text-sm text-ink-secondary mt-0.5">Connect your website, lead ads, contact forms, and other sources for instant lead alerts and automatic importing of leads.</p>
            </div>
            {tab === 'all' && <button onClick={() => setTab('sources')} className="text-sm font-bold text-accent-blue hover:underline whitespace-nowrap">View All →</button>}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {leadSourceCards.map(renderCard)}
          </div>
        </section>
      )}

      {(tab === 'all' || tab === 'automations') && (
        <section>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-bold text-ink-primary">Lead Automations</h2>
              <p className="text-sm text-ink-secondary mt-0.5">Configure rules and automations that run whenever a lead is received from your connected lead sources.</p>
            </div>
            {tab === 'all' && <button onClick={() => setTab('automations')} className="text-sm font-bold text-accent-blue hover:underline whitespace-nowrap">View All →</button>}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {leadAutomationCards.map(renderCard)}
          </div>
        </section>
      )}

      {(tab === 'all' || tab === 'whatsapp') && (
        <section>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-bold text-ink-primary">WhatsApp Automations</h2>
              <p className="text-sm text-ink-secondary mt-0.5">Use your existing WhatsApp Business number to instantly message new leads, send bulk message campaigns, send multi-step automated sequences, and more.</p>
            </div>
            {tab === 'all' && <button onClick={() => setTab('whatsapp')} className="text-sm font-bold text-accent-blue hover:underline whitespace-nowrap">View All →</button>}
          </div>

          {/* Sandbox Mode Banner */}
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 flex items-start gap-3 mb-4">
            <div className="text-yellow-600 mt-0.5">⚠️</div>
            <div>
              <p className="text-sm font-medium text-yellow-800">Running in Sandbox Mode</p>
              <p className="text-xs text-yellow-700 mt-1">Contacts must join sandbox before receiving messages. Go live after Meta business verification.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {whatsappAutomationCards.map(renderCard)}
          </div>
        </section>
      )}

      {tab === 'import' && <ImportExportSection />}
    </div>
  );
}

function ImportExportSection() {
  const navigate = useNavigate();
  return (
    <section>
      <h2 className="text-lg font-bold text-ink-primary mb-1">Import & Export Data</h2>
      <p className="text-sm text-ink-secondary mb-4">Bulk import leads from a spreadsheet, download your lead and activity data, and more</p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl">
        <div className="card card-hover stagger-in">
          <div className="flex items-start gap-3 mb-3">
            <div className="w-11 h-11 rounded-2xl bg-surface-page flex items-center justify-center"><Upload size={20} className="text-accent-blue" /></div>
            <div><h3 className="font-bold text-sm text-ink-primary">Import Leads from CSV</h3><p className="text-xs text-ink-secondary mt-1">Bulk import contacts from a CSV file</p></div>
          </div>
          <button onClick={() => navigate('/app/leads?import=true')} className="text-xs font-bold text-accent-blue flex items-center gap-1 hover:underline">Configure <ChevronRight size={14} /></button>
        </div>
        <div className="card card-hover stagger-in" style={{ animationDelay: '80ms' }}>
          <div className="flex items-start gap-3 mb-3">
            <div className="w-11 h-11 rounded-2xl flex items-center justify-center" style={{ background: '#34C75910' }}><Download size={20} style={{ color: '#34C759' }} /></div>
            <div><h3 className="font-bold text-sm text-ink-primary">Export Lead List</h3><p className="text-xs text-ink-secondary mt-1">Download lead list in CSV format</p></div>
          </div>
          <button onClick={() => navigate('/app/leads?export=true')} className="text-xs font-bold text-accent-blue flex items-center gap-1 hover:underline">Configure <ChevronRight size={14} /></button>
        </div>
      </div>
    </section>
  );
}
