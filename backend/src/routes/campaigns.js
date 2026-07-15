const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const campaignController = require('../controllers/campaignController');

router.use(authenticate);

router.get('/', campaignController.getCampaigns);
router.get('/:id', campaignController.getCampaign);
router.post('/', campaignController.createCampaign);
router.post('/:id/send', campaignController.sendCampaign);
router.post('/:id/schedule', campaignController.scheduleCampaign);
router.post('/:id/cancel', campaignController.cancelCampaign);
router.get('/:id/stats', campaignController.getCampaignStats);

module.exports = router;
