const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { upload } = require('../middleware/upload');
const contentController = require('../controllers/contentController');

router.get('/track/:trackingId', contentController.trackFile);

router.use(authenticate);

router.get('/', contentController.getFiles);
router.post('/', upload.single('file'), contentController.uploadFile);
router.delete('/:id', contentController.deleteFile);
router.post('/send', contentController.sendFile);
router.get('/:file_id/analytics', contentController.getFileAnalytics);
router.get('/folders', contentController.getFolders);
router.post('/folders', contentController.createFolder);

module.exports = router;
