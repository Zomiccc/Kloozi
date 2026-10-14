const express = require('express');
const router = express.Router();
const { authenticate, requireAdminOrAbove } = require('../middleware/auth');
const integrationController = require('../controllers/integrationController');
const oauthService = require('../services/oauthService');

// Public webhook endpoints (no auth)
router.get('/embed/:formKey', integrationController.serveEmbedForm);
router.post('/embed/:formKey', integrationController.handleEmbedForm);
router.post('/webhook/:workspaceId/:type/:secret', integrationController.handleWebhook);
router.post('/lead/:token', integrationController.handleTokenWebhook);
router.post('/lead/:token/:type', integrationController.handleTokenWebhook);

// OAuth callbacks (no auth — authenticated via OAuth code)
router.get('/oauth/facebook/callback', oauthService.facebookCallback);
router.get('/oauth/tiktok/callback', oauthService.tiktokCallback);
router.get('/oauth/linkedin/callback', oauthService.linkedinCallback);

// Public OAuth config (returns app IDs for frontend redirect)
router.get('/oauth/config', (req, res) => {
  const config = require('../config');
  res.json({
    facebook: { appId: config.facebook.appId, graphVersion: config.facebook.graphVersion, scopes: oauthService.FACEBOOK_SCOPES, configId: config.facebook.loginConfigId },
    linkedin: { clientId: config.linkedin.clientId, scopes: oauthService.LINKEDIN_SCOPES },
    tiktok: { appId: config.tiktok.appId },
    apiUrl: config.apiUrl,
  });
});

// Platform webhooks (no auth — verified by platform tokens)
router.get('/webhook/facebook', oauthService.facebookWebhookVerify);
router.post('/webhook/facebook', oauthService.facebookWebhook);
router.post('/webhook/tiktok', oauthService.tiktokWebhook);
router.get('/webhook/linkedin', oauthService.linkedinWebhookVerify);
router.post('/webhook/linkedin', oauthService.linkedinWebhook);
const googleAds = require('../services/googleAdsService');
router.post('/google-ads/:webhookId([a-f0-9]{24})', googleAds.webhook);
const connectors = require('../services/connectorService');
router.get('/connect/:token/ping', connectors.ping);
router.post('/connect/:token/:source', connectors.receive);

router.use(authenticate);

router.get('/google-ads/setup', requireAdminOrAbove, googleAds.getSetup);
router.post('/google-ads/rotate-key', requireAdminOrAbove, googleAds.rotateKey);
router.get('/connectors/:source', connectors.setup);
router.post('/connectors/:source/test', connectors.sendTest);

router.get('/oauth/state', requireAdminOrAbove, oauthService.getOAuthState);
router.get('/', integrationController.getIntegrations);
router.post('/connect', requireAdminOrAbove, integrationController.connectIntegration);
router.delete('/:id/disconnect', requireAdminOrAbove, integrationController.disconnectIntegration);

router.get('/webhooks', requireAdminOrAbove, integrationController.getWebhooks);
router.post('/webhooks', requireAdminOrAbove, integrationController.createWebhook);

router.get('/embed-forms', requireAdminOrAbove, integrationController.getEmbedForms);
router.post('/embed-forms', requireAdminOrAbove, integrationController.createEmbedForm);
router.get('/embed-forms/:id/code', requireAdminOrAbove, integrationController.getEmbedCode);
router.post('/parse-lead-from-email', integrationController.parseLeadFromEmail);

module.exports = router;
