const express = require('express');
const router = express.Router();
const { authenticate, requireAdminOrAbove } = require('../middleware/auth');
const auto = require('../controllers/automationController');

router.use(authenticate);

// Lead Automation Rules
router.get('/rules', auto.getAutomationRules);
router.post('/rules', auto.createAutomationRule);
router.put('/rules/:id', auto.updateAutomationRule);
router.delete('/rules/:id', auto.deleteAutomationRule);
router.post('/rules/:id/test', auto.testAutomationRule);

// Lead Distribution
router.get('/distribution', auto.getDistributionConfig);
router.put('/distribution', auto.updateDistributionConfig);

// WhatsApp Chat Assistant Rules
router.get('/chat-assistant', auto.getChatAssistantRules);
router.post('/chat-assistant', auto.createChatAssistantRule);
router.delete('/chat-assistant/:id', auto.deleteChatAssistantRule);

// Outgoing Webhooks
router.get('/outgoing-webhooks', auto.getOutgoingWebhooks);
router.post('/outgoing-webhooks', auto.createOutgoingWebhook);
router.delete('/outgoing-webhooks/:id', auto.deleteOutgoingWebhook);
router.post('/outgoing-webhooks/:id/test', auto.testOutgoingWebhook);
router.get('/outgoing-webhooks/logs', auto.getWebhookLogs);

// Lead Form Pages
router.get('/lead-form-pages', auto.getLeadFormPages);
router.post('/lead-form-pages', auto.createLeadFormPage);
router.put('/lead-form-pages/:id', auto.updateLeadFormPage);
router.delete('/lead-form-pages/:id', auto.deleteLeadFormPage);

// Lead Form public endpoints (no auth)
router.get('/lead-form/:formKey', auto.serveLeadFormPage);
router.post('/lead-form/:formKey', auto.handleLeadFormSubmission);

// Meta CAPI
router.get('/meta-capi', auto.getMetaCAPIConfig);
router.put('/meta-capi', auto.updateMetaCAPIConfig);
router.post('/meta-capi/lead/:id/qualified', auto.markLeadQualified);

// Account Token
router.get('/account-token', auto.getAccountToken);
router.post('/account-token/regenerate', requireAdminOrAbove, auto.regenerateAccountToken);

// Duplicate Report
router.get('/duplicates', auto.getDuplicateReport);

module.exports = router;
