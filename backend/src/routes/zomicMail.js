const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const zomicMailController = require('../controllers/zomicMailController');
const { upload } = require('../middleware/upload');

router.use(authenticate);

router.get('/mailbox/:folder', zomicMailController.getMailbox);
router.get('/unread-count', zomicMailController.getUnreadCount);
router.get('/thread/:threadId', zomicMailController.getThread);
router.get('/team-members', zomicMailController.getTeamMembers);
router.post('/compose', zomicMailController.compose);
router.post('/reply/:messageId', zomicMailController.reply);
router.post('/forward/:messageId', zomicMailController.forward);
router.put('/mark-read/:messageId', zomicMailController.markAsRead);
router.put('/toggle-star/:messageId', zomicMailController.toggleStar);
router.put('/trash/:messageId', zomicMailController.moveToTrash);
router.put('/restore/:messageId', zomicMailController.restoreFromTrash);
router.put('/archive/:messageId', zomicMailController.archive);
router.delete('/:messageId', zomicMailController.deleteMessage);
router.post('/upload-attachment', upload.single('file'), zomicMailController.uploadAttachment);

module.exports = router;
