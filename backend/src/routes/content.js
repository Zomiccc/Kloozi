const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { upload } = require('../middleware/upload');
const contentController = require('../controllers/contentController');

const tracking = require('../controllers/trackingController');
router.get('/track/:trackingId', tracking.viewer);
router.get('/track/:trackingId/file', tracking.file);

router.use(authenticate);

router.get('/', contentController.getFiles);
router.post('/', upload.single('file'), contentController.uploadFile);
router.delete('/:id', contentController.deleteFile);
router.post('/send', contentController.sendFile);
router.get('/:file_id/analytics', contentController.getFileAnalytics);
router.get('/folders', contentController.getFolders);
router.post('/folders', contentController.createFolder);
router.get('/branding', contentController.getBranding);
router.put('/branding', contentController.updateBranding);

module.exports = router;
