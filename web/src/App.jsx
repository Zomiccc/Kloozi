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

import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Leads from './pages/Leads';
import LeadProfile from './pages/LeadProfile';
import EmailTemplates from './pages/EmailTemplates';
import EmailSequences from './pages/EmailSequences';
import EmailFlows from './pages/EmailFlows';
import EmailCampaigns from './pages/EmailCampaigns';
import WhatsAppCampaigns from './pages/WhatsAppCampaigns';
import SMSCampaigns from './pages/SMSCampaigns';
import ContentLibrary from './pages/ContentLibrary';
import TeamManagement from './pages/TeamManagement';
import Automations from './pages/Automations';
import Analytics from './pages/Analytics';
import Settings from './pages/Settings';
import Billing from './pages/Billing';

import FacebookIntegration from './pages/integrations/FacebookIntegration';
import WhatsAppIntegration from './pages/integrations/WhatsAppIntegration';
import WordPressIntegration from './pages/integrations/WordPressIntegration';
import GoogleFormsIntegration from './pages/integrations/GoogleFormsIntegration';
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
      <Toaster position="top-right" />
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/accept-invitation" element={<AcceptInvitation />} />
        <Route path="/auth/callback" element={<AuthCallback />} />

        <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
          <Route index element={<Dashboard />} />
          <Route path="leads" element={<Leads />} />
          <Route path="leads/:id" element={<LeadProfile />} />
          <Route path="email-templates" element={<EmailTemplates />} />
          <Route path="email-sequences" element={<EmailSequences />} />
          <Route path="email-flows" element={<EmailFlows />} />
          <Route path="email-campaigns" element={<EmailCampaigns />} />
          <Route path="whatsapp-campaigns" element={<WhatsAppCampaigns />} />
          <Route path="sms-campaigns" element={<SMSCampaigns />} />
          <Route path="content" element={<ContentLibrary />} />
          <Route path="team" element={<TeamManagement />} />
          <Route path="automations" element={<Automations />} />
          <Route path="automations/facebook" element={<FacebookIntegration />} />
          <Route path="automations/whatsapp-chats" element={<WhatsAppIntegration />} />
          <Route path="automations/whatsapp-auto-responder" element={<WhatsAppIntegration />} />
          <Route path="automations/whatsapp-sequences" element={<WhatsAppIntegration />} />
          <Route path="automations/whatsapp-contact-import" element={<WhatsAppIntegration />} />
          <Route path="automations/whatsapp-widget" element={<WhatsAppIntegration />} />
          <Route path="automations/whatsapp-ai-agent" element={<WhatsAppIntegration />} />
          <Route path="automations/chat-monitoring" element={<WhatsAppIntegration />} />
          <Route path="automations/wordpress" element={<WordPressIntegration />} />
          <Route path="automations/google-forms" element={<GoogleFormsIntegration />} />
          <Route path="automations/google-ads" element={<GoogleFormsIntegration />} />
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
          <Route path="analytics" element={<Analytics />} />
          <Route path="settings" element={<Settings />} />
          <Route path="billing" element={<Billing />} />
        </Route>

        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </BrowserRouter>
  );
}
