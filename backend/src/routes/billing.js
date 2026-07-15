const express = require('express');
const router = express.Router();
const { authenticate, requireSuperAdmin } = require('../middleware/auth');
const billingController = require('../controllers/billingController');

router.get('/plans', billingController.getPlans);
router.post('/webhook', express.raw({ type: 'application/json' }), billingController.handleWebhook);

router.use(authenticate);

router.get('/subscription', billingController.getCurrentSubscription);
router.post('/checkout', billingController.createCheckoutSession);
router.post('/portal', billingController.createPortalSession);
router.get('/super-admin/stats', requireSuperAdmin, billingController.getSuperAdminStats);

module.exports = router;
