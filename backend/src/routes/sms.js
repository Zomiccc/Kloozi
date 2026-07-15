const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const smsController = require('../controllers/smsController');

router.post('/webhook', smsController.webhook);

router.use(authenticate);

router.get('/templates', smsController.getTemplates);
router.post('/templates', smsController.createTemplate);
router.post('/send', smsController.sendSMS);
router.post('/bulk-send', smsController.bulkSend);
router.get('/inbox', smsController.getInbox);

module.exports = router;
