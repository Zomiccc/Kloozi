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

const leadSourceCards = [
  { id: 'lead_forms', icon: FileText, title: 'CRM Final Forms', desc: 'Create lead forms using our form builder and receive instant alerts', route: '/automations/lead-forms', connected: true },
  { id: 'facebook', icon: Facebook, title: 'Facebook & Instagram', desc: 'Receive new leads from Facebook & Instagram Lead Ads', route: '/automations/facebook', oauth: true },
  { id: 'linkedin', icon: Linkedin, title: 'LinkedIn', desc: 'Receive new leads from LinkedIn Lead Gen Forms', route: '/automations/linkedin', oauth: true },
  { id: 'wordpress', icon: Globe, title: 'WordPress', desc: 'Receive new leads from WordPress contact forms', route: '/automations/wordpress' },
  { id: 'whatsapp_chats', icon: MessageSquare, title: 'WhatsApp Chats', desc: 'Auto create leads from WhatsApp conversations', route: '/automations/whatsapp-chats' },
  { id: 'google_forms', icon: FileText, title: 'Google Forms', desc: 'Receive leads from Google Forms', route: '/automations/google-forms' },
  { id: 'tiktok', icon: Music, title: 'TikTok', desc: 'Receive leads from TikTok Lead Generation', route: '/automations/tiktok', oauth: true },
  { id: 'google_ads', icon: Search, title: 'Google Ads', desc: 'Receive leads from Google Ads Lead Form Assets', route: '/automations/google-ads', oauth: true },
  { id: 'zapier', icon: Link2, title: 'Zapier / Webhook', desc: 'Connect any other lead source via webhook', route: '/automations/zapier' },
];

const leadAutomationCards = [
  { id: 'whatsapp_auto', icon: MessageSquare, title: 'WhatsApp Auto-Responder', desc: 'Instantly message new leads on WhatsApp from your own number', route: '/automations/whatsapp-auto-responder' },
  { id: 'meta_capi', icon: Zap, title: 'Meta Conversions API', desc: 'Optimise Facebook Lead Ad campaigns', route: '/automations/meta-capi' },
  { id: 'duplicate_merge', icon: GitBranch, title: 'Duplicate Lead Merging', desc: 'Auto merge leads with same phone/email', route: '/automations/duplicate-merge' },
  { id: 'automation_rules', icon: Filter, title: 'Lead Automation Rules', desc: 'Assign leads via rules or round robin', route: '/automations/rules' },
  { id: 'lead_distribution', icon: Send, title: 'Lead Distribution', desc: 'Forward leads to recipients via WhatsApp/email', route: '/automations/distribution' },
  { id: 'outgoing_webhooks', icon: Webhook, title: 'Outgoing Webhooks', desc: 'Trigger webhooks to any system that supports webhooks', route: '/automations/outgoing-webhooks' },
];

const whatsappAutomationCards = [
  { id: 'wa_campaigns', icon: Send, title: 'WhatsApp Campaigns', desc: 'Bulk message 1,000s from your own number', route: '/whatsapp-campaigns' },
  { id: 'wa_auto_responder', icon: MessageSquare, title: 'WhatsApp Auto-Responder', desc: 'Instantly message new leads', route: '/automations/whatsapp-auto-responder' },
  { id: 'wa_sequences', icon: Repeat, title: 'Automated WhatsApp Sequences', desc: 'Multi-step sequences over multiple days', route: '/automations/whatsapp-sequences' },
  { id: 'wa_chat_assistant', icon: Bot, title: 'WhatsApp Chat Assistant', desc: 'Configure automated response rules', route: '/automations/chat-assistant' },
  { id: 'wa_contact_import', icon: Users, title: 'WhatsApp Contact Import', desc: 'Create leads from WhatsApp chats', route: '/automations/whatsapp-contact-import' },
  { id: 'wa_lead_distribution', icon: Send, title: 'WhatsApp Lead Distribution', desc: 'Forward new leads via WhatsApp', route: '/automations/distribution' },
  { id: 'wa_chat_monitoring', icon: Monitor, title: 'WhatsApp Chat Monitoring', desc: 'View team WhatsApp conversations', route: '/automations/chat-monitoring' },
  { id: 'wa_widget', icon: Globe, title: 'WhatsApp Widget for Website', desc: 'Add chat button to website', route: '/automations/whatsapp-widget' },
  { id: 'wa_ai_agent', icon: Bot, title: 'WhatsApp AI Agent Lite', desc: 'Add AI to WhatsApp to capture details', route: '/automations/whatsapp-ai-agent' },
];

export default function Automations() {
  const [tab, setTab] = useState('all');
  const [integrations, setIntegrations] = useState([]);
  const [accountToken, setAccountToken] = useState('');
  const navigate = useNavigate();

  useEffect(() => { loadIntegrations(); loadToken(); }, []);

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

  const isConnected = (type) => integrations.some(i => i.type === type && i.is_connected);

  const renderCard = (card) => {
    const connected = card.connected || isConnected(card.id) || isConnected(card.oauth ? card.id : card.id);
    return (
      <div key={card.id} className="bg-white rounded-xl border border-dark-100 p-5 flex flex-col hover:shadow-md transition-shadow">
        <div className="flex items-start gap-3 mb-3">
          <div className="w-10 h-10 rounded-lg bg-primary-50 flex items-center justify-center flex-shrink-0">
            <card.icon size={20} className="text-primary-600" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-dark-900 text-sm">{card.title}</h3>
            <p className="text-xs text-dark-400 mt-1 leading-relaxed">{card.desc}</p>
          </div>
        </div>
        <div className="mt-auto flex items-center justify-between pt-3">
          {connected ? (
            <span className="flex items-center gap-1 text-xs text-green-600 font-medium">
              <CheckCircle2 size={14} /> Connected
            </span>
          ) : (
            <span className="flex items-center gap-1 text-xs text-dark-400 font-medium">
              <XCircle size={14} /> Not Connected
            </span>
          )}
          <button
            onClick={() => navigate(card.route)}
            className="text-xs font-medium text-primary-600 hover:text-primary-700 flex items-center gap-1"
          >
            {connected ? 'Configure' : card.oauth ? 'Connect' : 'Configure'}
            <ChevronRight size={14} />
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-dark-900">Automations</h1>

      <div className="flex gap-1 border-b border-dark-100">
        {['all', 'sources', 'automations', 'whatsapp', 'import'].map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2.5 text-sm font-medium capitalize transition-colors ${tab === t ? 'text-primary-600 border-b-2 border-primary-600' : 'text-dark-400 hover:text-dark-600'}`}
          >
            {t === 'all' ? 'All Automations' : t === 'sources' ? 'Lead Sources' : t === 'automations' ? 'Lead Automations' : t === 'whatsapp' ? 'WhatsApp' : 'Import/Export'}
          </button>
        ))}
      </div>

      {(tab === 'all' || tab === 'sources') && (
        <section>
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="text-lg font-semibold text-dark-900">Lead Source Integrations</h2>
              <p className="text-sm text-dark-400">Connect your website, lead ads, contact forms, and other sources for instant lead alerts and automatic importing of leads.</p>
            </div>
            {tab === 'all' && <button onClick={() => setTab('sources')} className="text-sm text-primary-600 font-medium hover:underline">View All →</button>}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {leadSourceCards.map(renderCard)}
          </div>
        </section>
      )}

      {(tab === 'all' || tab === 'automations') && (
        <section>
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="text-lg font-semibold text-dark-900">Lead Automations</h2>
              <p className="text-sm text-dark-400">Configure rules and automations that run whenever a lead is received from your connected lead sources.</p>
            </div>
            {tab === 'all' && <button onClick={() => setTab('automations')} className="text-sm text-primary-600 font-medium hover:underline">View All →</button>}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {leadAutomationCards.map(renderCard)}
          </div>
        </section>
      )}

      {(tab === 'all' || tab === 'whatsapp') && (
        <section>
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="text-lg font-semibold text-dark-900">WhatsApp Automations</h2>
              <p className="text-sm text-dark-400">Use your existing WhatsApp Business number to instantly message new leads, send bulk message campaigns, send multi-step automated sequences, and more.</p>
            </div>
            {tab === 'all' && <button onClick={() => setTab('whatsapp')} className="text-sm text-primary-600 font-medium hover:underline">View All →</button>}
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
      <h2 className="text-lg font-semibold text-dark-900 mb-1">Import & Export Data</h2>
      <p className="text-sm text-dark-400 mb-4">Bulk import clients from a spreadsheet, download your client and activity data, and more</p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl">
        <div className="bg-white rounded-xl border border-dark-100 p-5">
          <div className="flex items-start gap-3 mb-3">
            <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center"><Upload size={20} className="text-blue-600" /></div>
            <div><h3 className="font-semibold text-sm">Import Clients from CSV</h3><p className="text-xs text-dark-400 mt-1">Bulk import contacts from a CSV file</p></div>
          </div>
          <button onClick={() => navigate('/leads?import=true')} className="text-xs font-medium text-primary-600 flex items-center gap-1">Configure <ChevronRight size={14} /></button>
        </div>
        <div className="bg-white rounded-xl border border-dark-100 p-5">
          <div className="flex items-start gap-3 mb-3">
            <div className="w-10 h-10 rounded-lg bg-green-50 flex items-center justify-center"><Download size={20} className="text-green-600" /></div>
            <div><h3 className="font-semibold text-sm">Export Client List</h3><p className="text-xs text-dark-400 mt-1">Download client list in CSV format</p></div>
          </div>
          <button onClick={() => navigate('/leads?export=true')} className="text-xs font-medium text-primary-600 flex items-center gap-1">Configure <ChevronRight size={14} /></button>
        </div>
      </div>
    </section>
  );
}
