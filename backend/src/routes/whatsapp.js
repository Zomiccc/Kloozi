const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const whatsappController = require('../controllers/whatsappController');

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
router.get('/sequences', whatsappController.getWhatsAppSequences);
router.post('/sequences', whatsappController.createWhatsAppSequence);
router.post('/sequences/enroll', whatsappController.enrollWhatsAppSequence);
router.get('/chat-monitoring', whatsappController.getChatMonitoring);
router.get('/chat-monitoring/:lead_id', whatsappController.getConversationDetail);

module.exports = router;
