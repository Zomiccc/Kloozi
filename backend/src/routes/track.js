const express = require('express');
const router = express.Router();
const tracking = require('../controllers/trackingController');

// Public, cross-origin: called from customers' websites and the tracked document viewer.
router.use(express.text({ type: '*/*', limit: '64kb' }));

router.get('/t.js', tracking.script);
router.post('/hit', tracking.hit);
router.post('/doc/:trackingId', tracking.docBeat);

module.exports = router;
