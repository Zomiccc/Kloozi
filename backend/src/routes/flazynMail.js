const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const flazynMailController = require('../controllers/flazynMailController');
const { upload } = require('../middleware/upload');

router.use(authenticate);

router.get('/mailbox/:folder', flazynMailController.getMailbox);
router.get('/unread-count', flazynMailController.getUnreadCount);
router.get('/thread/:threadId', flazynMailController.getThread);
router.get('/team-members', flazynMailController.getTeamMembers);
router.post('/compose', flazynMailController.compose);
router.post('/reply/:messageId', flazynMailController.reply);
router.post('/reply-all/:messageId', flazynMailController.replyAll);
router.post('/forward/:messageId', flazynMailController.forward);
router.put('/mark-read/:messageId', flazynMailController.markAsRead);
router.put('/toggle-star/:messageId', flazynMailController.toggleStar);
router.put('/trash/:messageId', flazynMailController.moveToTrash);
router.put('/restore/:messageId', flazynMailController.restoreFromTrash);
router.put('/archive/:messageId', flazynMailController.archive);
router.delete('/:messageId', flazynMailController.deleteMessage);
router.post('/upload-attachment', upload.single('file'), flazynMailController.uploadAttachment);

module.exports = router;
