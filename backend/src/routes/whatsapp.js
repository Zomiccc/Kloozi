const express = require('express');
const router = express.Router();
const { authenticate, requireAdminOrAbove } = require('../middleware/auth');
const whatsappController = require('../controllers/whatsappController');
const whatsappSequenceController = require('../controllers/whatsappSequenceController');

router.get('/webhook', whatsappController.webhook);
router.post('/webhook', whatsappController.webhook);

router.use(authenticate);

router.get('/templates', whatsappController.getTemplates);
router.post('/templates', whatsappController.createTemplate);
router.post('/send', whatsappController.sendMessage);
router.post('/bulk-send', whatsappController.bulkSend);
router.get('/inbox', whatsappController.getInbox);
router.get('/conversations', whatsappController.getConversations);
router.get('/auto-responder', whatsappController.getAutoResponder);
router.put('/auto-responder', whatsappController.updateAutoResponder);
router.get('/sequences', whatsappSequenceController.getSequences);
router.post('/sequences', requireAdminOrAbove, whatsappSequenceController.createSequence);
router.put('/sequences/:id', requireAdminOrAbove, whatsappSequenceController.updateSequence);
router.delete('/sequences/:id', requireAdminOrAbove, whatsappSequenceController.deleteSequence);
router.get('/sequences/progress', whatsappSequenceController.getSequenceProgress);
router.post('/sequences/start', requireAdminOrAbove, whatsappSequenceController.startSequenceForLead);
router.post('/sequences/stop', requireAdminOrAbove, whatsappSequenceController.stopSequenceForLead);
router.get('/chat-monitoring', whatsappController.getChatMonitoring);
router.get('/chat-monitoring/:lead_id', whatsappController.getConversationDetail);
router.post('/send-otp', whatsappController.sendOTP);
router.post('/verify-otp', whatsappController.verifyOTP);
router.post('/resend-otp', whatsappController.resendOTP);
router.get('/status', whatsappController.getWhatsAppStatus);
router.delete('/disconnect', whatsappController.disconnectWhatsApp);
router.get('/auto-responder-settings', whatsappController.getAutoResponderSettings);
router.put('/auto-responder-settings', whatsappController.updateAutoResponderSettings);

module.exports = router;
