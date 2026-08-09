const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const emailController = require('../controllers/emailController');

router.use(authenticate);

router.get('/templates', emailController.getTemplates);
router.post('/templates', emailController.createTemplate);
router.post('/templates/import', emailController.importTemplate);
router.post('/templates/seed-defaults', emailController.seedDefaultTemplates);
router.put('/templates/:id', emailController.updateTemplate);
router.delete('/templates/:id', emailController.deleteTemplate);
router.post('/templates/:id/duplicate', emailController.duplicateTemplate);
router.post('/templates/preview', emailController.previewTemplate);
router.get('/templates/:id/stats', emailController.getTemplateStats);

router.get('/sequences', emailController.getSequences);
router.post('/sequences', emailController.createSequence);
router.get('/sequences/:id', emailController.getSequenceDetails);
router.post('/sequences/enroll', emailController.enrollInSequence);
router.put('/sequences/:sequenceId/lead/:leadId/pause', emailController.pauseSequenceForLead);
router.put('/sequences/:sequenceId/lead/:leadId/resume', emailController.resumeSequenceForLead);
router.delete('/sequences/:sequenceId/lead/:leadId', emailController.removeFromSequence);
router.post('/sequences/:id/clone', emailController.cloneSequence);

router.get('/flows', emailController.getFlows);
router.post('/flows', emailController.createFlow);
router.get('/flows/:id', emailController.getFlowDetails);
router.put('/flows/:id', emailController.updateFlow);
router.post('/flows/:id/publish', emailController.publishFlow);

router.get('/triggers', emailController.getTriggers);
router.post('/triggers', emailController.createTrigger);
router.put('/triggers/:id/toggle', emailController.toggleTrigger);

router.get('/analytics', emailController.getEmailAnalytics);
router.post('/ai/subject-lines', emailController.generateSubjectLines);

router.get('/track/open/:trackingId', emailController.trackOpen);
router.get('/unsubscribe/:trackingId', emailController.unsubscribe);

module.exports = router;
