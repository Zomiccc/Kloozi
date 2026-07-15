const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const { validate } = require('../middleware/errorHandler');
const { authLimiter, passwordResetLimiter } = require('../middleware/rateLimiter');
const authController = require('../controllers/authController');

router.post('/signup', authLimiter, [
  body('email').isEmail().withMessage('Valid email required'),
  body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
  body('companyName').notEmpty().withMessage('Company name required'),
  body('firstName').notEmpty().withMessage('First name required'),
  body('lastName').notEmpty().withMessage('Last name required'),
], validate, authController.signup);

router.post('/login', authLimiter, [
  body('email').isEmail().withMessage('Valid email required'),
  body('password').notEmpty().withMessage('Password required'),
], validate, authController.login);

router.post('/refresh-token', authController.refreshToken);

router.post('/logout', authController.logout);

router.post('/forgot-password', passwordResetLimiter, [
  body('email').isEmail().withMessage('Valid email required'),
], validate, authController.forgotPassword);

router.post('/reset-password', passwordResetLimiter, [
  body('token').notEmpty().withMessage('Token required'),
  body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
], validate, authController.resetPassword);

router.get('/google', authController.googleAuth);
router.get('/google/callback', authController.googleCallback);

router.post('/accept-invitation', [
  body('token').notEmpty().withMessage('Invitation token required'),
  body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
], validate, authController.acceptInvitation);

router.post('/verify-2fa', authController.verify2FA);

router.post('/enable-2fa', authController.enable2FA);

router.post('/disable-2fa', authController.disable2FA);

module.exports = router;
