import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { useEffect } from 'react';
import useAuthStore from './stores/authStore';

import Login from './pages/Login';
import Signup from './pages/Signup';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import AcceptInvitation from './pages/AcceptInvitation';
import AuthCallback from './pages/AuthCallback';
import Landing from './pages/Landing';
import Pricing from './pages/Pricing';

import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Welcome from './pages/Welcome';
import Leads from './pages/Leads';
import LeadProfile from './pages/LeadProfile';
import WhatsAppCampaigns from './pages/WhatsAppCampaigns';
import SMSCampaigns from './pages/SMSCampaigns';
import Segments from './pages/marketing/Segments';
import Flows from './pages/marketing/Flows';
import FlowBuilder from './pages/marketing/FlowBuilder';
import MarketingCampaigns from './pages/marketing/Campaigns';
import Emails from './pages/marketing/Emails';
import EmailEditor from './pages/marketing/EmailEditor';
import MktAnalytics from './pages/marketing/MktAnalytics';
import ContentLibrary from './pages/ContentLibrary';
import TeamManagement from './pages/TeamManagement';
import Automations from './pages/Automations';
import Analytics from './pages/Analytics';
import Settings from './pages/Settings';
import Billing from './pages/Billing';
import Mailbox from './pages/Mailbox';
import EngagementDashboard from './pages/EngagementDashboard';

import FacebookIntegration from './pages/integrations/FacebookIntegration';
import WhatsAppIntegration from './pages/integrations/WhatsAppIntegration';
import WordPressIntegration from './pages/integrations/WordPressIntegration';
import GoogleFormsIntegration from './pages/integrations/GoogleFormsIntegration';
import GoogleAdsIntegration from './pages/integrations/GoogleAdsIntegration';
import Insights from './pages/Insights';
import AdminConnections from './pages/admin/Connections';
import AdminDemoQR from './pages/admin/DemoQR';
import Demo from './pages/Demo';
import TikTokIntegration from './pages/integrations/TikTokIntegration';
import LinkedInIntegration from './pages/integrations/LinkedInIntegration';
import ZapierIntegration from './pages/integrations/ZapierIntegration';
import LeadFormsBuilder from './pages/integrations/LeadFormsBuilder';
import MetaCAPIIntegration from './pages/integrations/MetaCAPIIntegration';
import ChatAssistantRules from './pages/integrations/ChatAssistantRules';
import AutomationRules from './pages/integrations/AutomationRules';
import LeadDistribution from './pages/integrations/LeadDistribution';
import OutgoingWebhooks from './pages/integrations/OutgoingWebhooks';
import DuplicateMerge from './pages/integrations/DuplicateMerge';
import WhatsAppSequences from './pages/integrations/WhatsAppSequences';
import WhatsAppChatMonitoring from './pages/integrations/WhatsAppChatMonitoring';
import WhatsAppContactImport from './pages/integrations/WhatsAppContactImport';
import WhatsAppAIAgent from './pages/integrations/WhatsAppAIAgent';
import WhatsAppChats from './pages/integrations/WhatsAppChats';
import Privacy from './pages/legal/Privacy';
import Terms from './pages/legal/Terms';
import DataDeletion from './pages/legal/DataDeletion';
import Templates from './pages/Templates';
import WebsiteTracking from './pages/integrations/WebsiteTracking';

function ProtectedRoute({ children }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  if (!isAuthenticated) return <Navigate to="/login" />;
  return children;
}

export default function App() {
  const getProfile = useAuthStore((s) => s.getProfile);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  useEffect(() => {
    if (isAuthenticated) {
      getProfile().catch(() => {});
    }
  }, [isAuthenticated, getProfile]);

  return (
    <BrowserRouter>
      <Toaster
        position="top-center"
        toastOptions={{
          duration: 3500,
          style: {
            background: 'linear-gradient(135deg, #7C5CFF 0%, #5B3DF5 100%)',
            color: '#FAFAF9',
            fontSize: '13px',
            fontWeight: 500,
            borderRadius: '8px',
            padding: '10px 16px 10px 26px',
            maxWidth: '360px',
          },
          classNames: {
            success: 'flazyn-toast flazyn-toast-success',
            error: 'flazyn-toast flazyn-toast-error',
          },
          success: { icon: '' },
          error: { icon: '' },
        }}
      />
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/accept-invitation" element={<AcceptInvitation />} />
        <Route path="/auth/callback" element={<AuthCallback />} />
        <Route path="/" element={<Landing />} />
        <Route path="/pricing" element={<Pricing />} />
        <Route path="/demo" element={<Demo />} />
        <Route path="/privacy" element={<Privacy />} />
        <Route path="/terms" element={<Terms />} />
        <Route path="/data-deletion" element={<DataDeletion />} />

        <Route path="/app" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
          <Route index element={<Welcome />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="leads" element={<Leads />} />
          <Route path="leads/:id" element={<LeadProfile />} />
          <Route path="marketing/segments" element={<Segments />} />
          <Route path="marketing/flows" element={<Flows />} />
          <Route path="marketing/flows/new" element={<FlowBuilder />} />
          <Route path="marketing/flows/:id" element={<FlowBuilder />} />
          <Route path="marketing/campaigns" element={<MarketingCampaigns />} />
          <Route path="marketing/emails" element={<Emails />} />
          <Route path="marketing/emails/new" element={<EmailEditor />} />
          <Route path="marketing/emails/:id" element={<EmailEditor />} />
          <Route path="marketing/analytics" element={<MktAnalytics />} />
          <Route path="whatsapp-campaigns" element={<WhatsAppCampaigns />} />
          <Route path="sms-campaigns" element={<SMSCampaigns />} />
          <Route path="content" element={<ContentLibrary />} />
          <Route path="templates" element={<Templates />} />
          <Route path="team" element={<TeamManagement />} />
          <Route path="automations" element={<Automations />} />
          <Route path="automations/facebook" element={<FacebookIntegration />} />
          <Route path="automations/whatsapp-chats" element={<WhatsAppChats />} />
          <Route path="automations/whatsapp-auto-responder" element={<WhatsAppIntegration />} />
          <Route path="automations/whatsapp-sequences" element={<WhatsAppSequences />} />
          <Route path="automations/whatsapp-contact-import" element={<WhatsAppContactImport />} />
          <Route path="automations/whatsapp-widget" element={<WhatsAppIntegration />} />
          <Route path="automations/whatsapp-ai-agent" element={<WhatsAppAIAgent />} />
          <Route path="automations/chat-monitoring" element={<WhatsAppChatMonitoring />} />
          <Route path="automations/wordpress" element={<WordPressIntegration />} />
          <Route path="automations/google-forms" element={<GoogleFormsIntegration />} />
          <Route path="automations/google-ads" element={<GoogleAdsIntegration />} />
          <Route path="insights" element={<Insights />} />
          <Route path="admin/connections" element={<AdminConnections />} />
          <Route path="admin/demo" element={<AdminDemoQR />} />
          <Route path="automations/tiktok" element={<TikTokIntegration />} />
          <Route path="automations/linkedin" element={<LinkedInIntegration />} />
          <Route path="automations/zapier" element={<ZapierIntegration />} />
          <Route path="automations/lead-forms" element={<LeadFormsBuilder />} />
          <Route path="automations/meta-capi" element={<MetaCAPIIntegration />} />
          <Route path="automations/chat-assistant" element={<ChatAssistantRules />} />
          <Route path="automations/rules" element={<AutomationRules />} />
          <Route path="automations/distribution" element={<LeadDistribution />} />
          <Route path="automations/outgoing-webhooks" element={<OutgoingWebhooks />} />
          <Route path="automations/duplicate-merge" element={<DuplicateMerge />} />
          <Route path="automations/tracking" element={<WebsiteTracking />} />
          <Route path="analytics" element={<Analytics />} />
          <Route path="engagement" element={<EngagementDashboard />} />
          <Route path="mailbox" element={<Mailbox />} />
          <Route path="settings" element={<Settings />} />
          <Route path="billing" element={<Billing />} />
        </Route>

        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </BrowserRouter>
  );
}
