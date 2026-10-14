const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const mc = require('../controllers/marketingController');

// ─── Public endpoints (email recipients & SendGrid) — no auth ───
router.get('/track/open/:trackingId', mc.trackOpen);
router.get('/track/click/:trackingId', mc.trackClick);
router.get('/unsubscribe/:trackingId', mc.unsubscribe);
router.post('/unsubscribe/:trackingId', express.urlencoded({ extended: false }), mc.unsubscribeConfirm);
router.post('/webhooks/sendgrid', mc.sendgridWebhook);

// ─── Authenticated marketing API ───
router.use(authenticate);

// Segments
router.get('/segments', mc.getSegments);
router.post('/segments', mc.createSegment);
router.post('/segments/preview', mc.previewSegment);
router.get('/segments/:id', mc.getSegment);
router.put('/segments/:id', mc.updateSegment);
router.delete('/segments/:id', mc.deleteSegment);
router.get('/segments/:id/members', mc.getSegmentMembers);

// Flows
router.get('/flows', mc.getFlows);
router.post('/flows', mc.createFlow);
router.get('/flows/:id', mc.getFlow);
router.put('/flows/:id', mc.updateFlow);
router.put('/flows/:id/status', mc.setFlowStatus);
router.delete('/flows/:id', mc.deleteFlow);
router.post('/flows/:id/enroll', mc.enrollInFlow);
router.get('/flows/:id/enrollments', mc.getFlowEnrollments);
router.get('/flows/:id/analytics', mc.getFlowAnalytics);

// Builder email documents
router.get('/emails', mc.getEmails);
router.post('/emails', mc.createEmail);
router.get('/emails/:id', mc.getEmail);
router.put('/emails/:id', mc.updateEmail);
router.delete('/emails/:id', mc.deleteEmail);

// Overview analytics
router.get('/analytics/overview', mc.getOverview);

module.exports = router;
