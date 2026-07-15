const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const callController = require('../controllers/callController');

router.use(authenticate);

router.post('/log', callController.logCall);
router.get('/', callController.getCalls);
router.get('/call-list', callController.getCallList);
router.post('/bulk/start', callController.startBulkCall);
router.post('/bulk/log', callController.logBulkCall);

module.exports = router;
