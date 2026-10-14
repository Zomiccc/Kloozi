import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import API from '../lib/api';
import { Upload, Download, ArrowUpRight } from 'lucide-react';
import BrandLogo from '../components/BrandLogo';
import { Segmented } from '../components/ui';

const leadSourceCards = [
  { id: 'lead_forms', title: 'Lead Forms', desc: 'Build forms, share a link, leads arrive instantly', route: '/app/automations/lead-forms', connected: true },
  { id: 'facebook', title: 'Facebook & Instagram', desc: 'Lead Ads delivered the second they are submitted', route: '/app/automations/facebook', oauth: true, logo: 'facebook' },
  { id: 'linkedin', title: 'LinkedIn', desc: 'Lead Gen Forms straight into your pipeline', route: '/app/automations/linkedin', oauth: true, logo: 'linkedin' },
  { id: 'wordpress', title: 'WordPress', desc: 'Contact form submissions become leads', route: '/app/automations/wordpress', logo: 'wordpress' },
  { id: 'whatsapp_chats', title: 'WhatsApp Chats', desc: 'Unknown numbers auto-become lead records', route: '/app/automations/whatsapp-chats', logo: 'whatsapp' },
  { id: 'google_forms', title: 'Google Forms', desc: 'Responses imported with alerts in real time', route: '/app/automations/google-forms', logo: 'google' },
  { id: 'tiktok', title: 'TikTok', desc: 'Instant Lead Generation captures', route: '/app/automations/tiktok', oauth: true, logo: 'tiktok' },
  { id: 'google_ads', title: 'Google Ads', desc: 'Lead form leads arrive in seconds', route: '/app/automations/google-ads', logo: 'google' },
  { id: 'zapier', title: 'Zapier / Webhook', desc: 'Any source that can POST, can feed Flazyn', route: '/app/automations/zapier', logo: 'zapier' },
];

const leadAutomationCards = [
  { id: 'website_tracking', title: 'Website & Document Tracking', desc: 'Time on site and pages read feed the Interest score', route: '/app/automations/tracking' },
  { id: 'automation_rules', title: 'Assignment Rules', desc: 'Route every lead by rule or round-robin', route: '/app/automations/rules' },
  { id: 'lead_distribution', title: 'Lead Distribution', desc: 'Relay new leads to the right people', route: '/app/automations/distribution' },
  { id: 'whatsapp_auto', title: 'WhatsApp Auto-Responder', desc: 'First message sent before you even look', route: '/app/automations/whatsapp-auto-responder', logo: 'whatsapp' },
  { id: 'meta_capi', title: 'Meta Conversions API', desc: 'Send qualified-lead signals back to Meta', route: '/app/automations/meta-capi', logo: 'meta' },
  { id: 'duplicate_merge', title: 'Duplicate Merging', desc: 'Same phone or email collapses into one lead', route: '/app/automations/duplicate-merge' },
  { id: 'outgoing_webhooks', title: 'Outgoing Webhooks', desc: 'Flazyn events fired to any endpoint you own', route: '/app/automations/outgoing-webhooks' },
];

const whatsappAutomationCards = [
  { id: 'wa_sequences', title: 'Sequences', desc: 'Multi-step cadences over days, hands-free', route: '/app/automations/whatsapp-sequences' },
  { id: 'wa_campaigns', title: 'Bulk Campaigns', desc: 'Message thousands from your own number', route: '/app/whatsapp-campaigns' },
  { id: 'wa_chat_assistant', title: 'Chat Assistant Rules', desc: 'IF a message matches X, then do Y — 24/7', route: '/app/automations/chat-assistant' },
  { id: 'wa_ai_agent', title: 'AI Agent Lite', desc: 'Reads messages, extracts details, replies', route: '/app/automations/whatsapp-ai-agent' },
  { id: 'wa_contact_import', title: 'Contact Import', desc: 'Turn messaged numbers into real leads', route: '/app/automations/whatsapp-contact-import' },
  { id: 'wa_chat_monitoring', title: 'Chat Monitoring', desc: 'Every team conversation in one place', route: '/app/automations/chat-monitoring' },
];

const TABS = [
  { key: 'all', label: 'All' },
  { key: 'sources', label: 'Sources' },
  { key: 'automations', label: 'Automations' },
  { key: 'whatsapp', label: 'WhatsApp' },
  { key: 'data', label: 'Data' },
];

export default function Automations() {
  const [tab, setTab] = useState('all');
  const [integrations, setIntegrations] = useState([]);
  const [metaCapiConfigured, setMetaCapiConfigured] = useState(false);
  const navigate = useNavigate();

  useEffect(() => { loadIntegrations(); loadMetaCAPIStatus(); }, []);

  const loadIntegrations = async () => {
    try { const res = await API.get('/integrations'); setIntegrations(res.data.integrations || []); } catch {}
  };

  const loadMetaCAPIStatus = async () => {
    try { const res = await API.get('/automations/meta-capi'); setMetaCapiConfigured(res.data.is_configured || false); } catch {}
  };

  const isConnected = (type) => {
    if (type === 'meta_capi') return metaCapiConfigured;
    return integrations.some(i => (i.type === type || i.type === `${type}_connector`) && i.is_connected);
  };

  return (
    <div className="-mx-6 -mt-8">
      {/* Scope switch — segmented pill control (Section 7) */}
      <div className="px-6 pt-2" style={{ marginBottom: '8px' }}>
        <Segmented layoutId="auto-tab" options={TABS} value={tab} onChange={setTab} />
      </div>

      <div className="px-6 pt-10 pb-4 max-w-[1100px]">
        {/* Editorial header */}
        <h1 className="text-ink-primary" style={{ fontSize: '32px', fontWeight: 650, letterSpacing: '-0.01em' }}>Automations</h1>
        <p className="text-ink-secondary mt-1 max-w-[520px]" style={{ fontSize: '15px' }}>
          Wire up your lead sources once — everything after that happens on its own.
        </p>
      </div>

      <div className="px-6 pb-12 space-y-10 max-w-[1100px]">
        {(tab === 'all' || tab === 'sources') && (
          <CardSection
            eyebrow="Lead sources"
            blurb="Where leads come from. Connect one, and new arrivals alert you instantly."
            items={leadSourceCards}
            isConnected={isConnected}
            navigate={navigate}
          />
        )}

        {(tab === 'all' || tab === 'automations') && (
          <CardSection
            eyebrow="What happens next"
            blurb="Rules that run the moment a lead lands — routing, replying, deduping, notifying."
            items={leadAutomationCards}
            isConnected={isConnected}
            navigate={navigate}
          />
        )}

        {(tab === 'all' || tab === 'whatsapp') && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: '#B45309' }} />
              <span className="text-ink-secondary" style={{ fontSize: '13px' }}>
                WhatsApp runs in sandbox mode until Meta business verification — contacts must join the sandbox first.
              </span>
            </div>
            <CardSection
              eyebrow="WhatsApp engine"
              blurb="Your WhatsApp Business number becomes a full automation channel."
              items={whatsappAutomationCards}
              isConnected={isConnected}
              navigate={navigate}
            />
          </div>
        )}

        {tab === 'data' && <ImportExportSection />}
      </div>
    </div>
  );
}

/* Card grid — integrations are distinct objects, so they earn real cards
   (white, hairline, 8px radius, Shadow-sm on hover — never on rest). */
function CardSection({ eyebrow, blurb, items, isConnected, navigate }) {
  return (
    <section className="space-y-4">
      <div>
        <p className="meta-label mb-1">{eyebrow}</p>
        <p className="text-ink-secondary" style={{ fontSize: '14px', maxWidth: '560px' }}>{blurb}</p>
      </div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {items.map((card, idx) => {
          const connected = card.connected || isConnected(card.id);
          return (
            <motion.button
              key={card.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(idx * 0.05, 0.35), duration: 0.22, ease: [0.25, 0.1, 0.25, 1] }}
              whileHover={{ y: -2 }}
              onClick={() => navigate(card.route)}
              className="group relative text-left bg-white p-5 transition-shadow hover:elev-sm"
              style={{ border: '1px solid #E7E5E4', borderRadius: '10px' }}
            >
              {/* connected dot — the ONLY color on the card besides the logo */}
              <span
                className="absolute top-4 right-4 w-2 h-2 rounded-full transition-transform duration-150 group-hover:scale-125"
                style={{ background: connected ? '#0E8A5F' : '#D6D3D1' }}
                title={connected ? 'Connected' : 'Not connected'}
              />
              <div className="flex items-center gap-3 mb-3">
                <span className="flex-shrink-0">
                  {card.logo ? <BrandLogo brand={card.logo} /> : (
                    <span className="mono flex items-center justify-center text-ink-secondary"
                      style={{ width: '28px', height: '28px', border: '1px solid #E7E5E4', borderRadius: '10px', fontSize: '12px' }}>
                      {card.title.slice(0, 1)}
                    </span>
                  )}
                </span>
                <p className="font-semibold text-ink-primary truncate" style={{ fontSize: '15px' }}>{card.title}</p>
              </div>
              <p className="text-ink-secondary pr-4" style={{ fontSize: '13px', lineHeight: 1.5 }}>{card.desc}</p>
              <div className="flex items-center justify-between mt-4 pt-3" style={{ borderTop: '1px solid #F5F5F4' }}>
                <span style={{ fontSize: '12px', fontWeight: 600, color: connected ? '#0E8A5F' : '#A8A29E' }}>
                  {connected ? 'Connected' : 'Not connected'}
                </span>
                <span className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
                  style={{ fontSize: '12px', fontWeight: 600, color: '#1C1917' }}>
                  {connected ? 'Configure' : 'Connect'} <ArrowUpRight size={13} />
                </span>
              </div>
            </motion.button>
          );
        })}
      </div>
    </section>
  );
}

function ImportExportSection() {
  const navigate = useNavigate();
  const rows = [
    { icon: <Upload size={18} />, title: 'Import leads from CSV', desc: 'Bulk import contacts from a spreadsheet', action: () => navigate('/app/leads?import=true'), cta: 'Import' },
    { icon: <Download size={18} />, title: 'Export lead list', desc: 'Download your leads with activity data as CSV', action: () => navigate('/app/leads?export=true'), cta: 'Export' },
  ];
  return (
    <section className="space-y-4 max-w-[640px]">
      <p className="meta-label">Your data, in and out</p>
      {rows.map((r, idx) => (
        <motion.button
          key={r.title}
          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: idx * 0.06, duration: 0.22 }}
          onClick={r.action}
          className="group w-full flex items-center gap-4 bg-white p-5 text-left transition-shadow hover:elev-sm"
          style={{ border: '1px solid #E7E5E4', borderRadius: '10px' }}
        >
          <span className="text-ink-secondary flex-shrink-0">{r.icon}</span>
          <span className="flex-1 min-w-0">
            <span className="block font-semibold text-ink-primary" style={{ fontSize: '15px' }}>{r.title}</span>
            <span className="block text-ink-secondary mt-0.5" style={{ fontSize: '13px' }}>{r.desc}</span>
          </span>
          <span className="font-semibold flex-shrink-0 group-hover:text-accent-deep transition-colors" style={{ fontSize: '13px' }}>
            {r.cta} →
          </span>
        </motion.button>
      ))}
    </section>
  );
}
