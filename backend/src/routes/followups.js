const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const followUpController = require('../controllers/followUpController');

router.use(authenticate);

router.get('/', followUpController.getFollowUps);
router.post('/', followUpController.createFollowUp);
router.put('/:id/complete', followUpController.completeFollowUp);
router.put('/:id/snooze', followUpController.snoozeFollowUp);
router.delete('/:id', followUpController.deleteFollowUp);

module.exports = router;
