const express = require('express');
const router = express.Router();
const { authenticate, requireManagerOrAbove } = require('../middleware/auth');
const teamController = require('../controllers/teamController');

router.use(authenticate);

router.get('/', requireManagerOrAbove, teamController.getTeamMembers);
router.post('/invite', requireManagerOrAbove, teamController.inviteMember);
router.put('/:id', requireManagerOrAbove, teamController.updateMember);
router.post('/:id/suspend', requireManagerOrAbove, teamController.suspendMember);
router.post('/:id/reactivate', requireManagerOrAbove, teamController.reactivateMember);
router.post('/transfer-leads', requireManagerOrAbove, teamController.transferLeads);
router.get('/:agent_id/performance', teamController.getAgentPerformance);
router.get('/activity-feed', requireManagerOrAbove, teamController.getTeamActivityFeed);

router.get('/territories', requireManagerOrAbove, teamController.getTerritories);
router.post('/territories', requireManagerOrAbove, teamController.assignTerritory);
router.delete('/territories/:id', requireManagerOrAbove, teamController.removeTerritory);

router.get('/assignment-rules', requireManagerOrAbove, teamController.getAssignmentRules);
router.put('/assignment-rules', requireManagerOrAbove, teamController.updateAssignmentRules);

router.get('/profile', teamController.getProfile);
router.put('/profile', teamController.updateProfile);
router.post('/device-token', teamController.registerDeviceToken);
router.delete('/account', teamController.deleteAccount);

module.exports = router;
