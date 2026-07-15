const express = require('express');
const router = express.Router();
const { authenticate, requireAdminOrAbove } = require('../middleware/auth');
const integrationController = require('../controllers/integrationController');

router.get('/embed/:formKey', integrationController.handleEmbedForm);
router.post('/embed/:formKey', integrationController.handleEmbedForm);
router.post('/webhook/:workspaceId/:type/:secret', integrationController.handleWebhook);

router.use(authenticate);

router.get('/', integrationController.getIntegrations);
router.post('/connect', requireAdminOrAbove, integrationController.connectIntegration);
router.delete('/:id/disconnect', requireAdminOrAbove, integrationController.disconnectIntegration);

router.get('/webhooks', requireAdminOrAbove, integrationController.getWebhooks);
router.post('/webhooks', requireAdminOrAbove, integrationController.createWebhook);

router.get('/embed-forms', requireAdminOrAbove, integrationController.getEmbedForms);
router.post('/embed-forms', requireAdminOrAbove, integrationController.createEmbedForm);
router.get('/embed-forms/:id/code', requireAdminOrAbove, integrationController.getEmbedCode);

module.exports = router;
