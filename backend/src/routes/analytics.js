const express = require('express');
const router = express.Router();
const { authenticate, requireManagerOrAbove } = require('../middleware/auth');
const analyticsController = require('../controllers/analyticsController');

router.use(authenticate);

router.get('/dashboard', analyticsController.getDashboard);
router.get('/leads', analyticsController.getLeadAnalytics);
router.get('/conversion', analyticsController.getConversionAnalytics);
router.get('/pipeline', analyticsController.getPipelineAnalytics);
router.get('/agents', requireManagerOrAbove, analyticsController.getAgentPerformance);
router.get('/team-stats', analyticsController.getTeamStats);
router.get('/ai-insight', analyticsController.getAIInsight);
router.get('/engagement', analyticsController.getEngagementAnalytics);
router.get('/leads/:leadId/engagement', analyticsController.getLeadEngagement);
router.get('/workspace-settings', analyticsController.getWorkspaceSettings);
router.put('/workspace-settings', analyticsController.updateWorkspaceSettings);

router.get('/notifications', analyticsController.getNotifications);
router.put('/notifications/:id/read', analyticsController.markNotificationRead);
router.put('/notifications/read-all', analyticsController.markAllNotificationsRead);

module.exports = router;
