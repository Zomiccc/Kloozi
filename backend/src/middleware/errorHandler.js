const { validationResult } = require('express-validator');

function validate(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: 'Validation failed',
      details: errors.array().map((e) => ({ field: e.path, message: e.msg })),
    });
  }
  next();
}

function errorHandler(err, req, res, next) {
  const logger = require('../utils/logger');
  console.error('[ERROR]', req.method, req.originalUrl, err.message, err.stack);
  logger.error('Unhandled error:', err.message, { stack: err.stack });

  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Invalid JSON in request body' });
  }

  if (err.code === '23505') {
    return res.status(409).json({ error: 'A record with this information already exists' });
  }

  if (err.code === '23503') {
    return res.status(400).json({ error: 'Referenced record not found' });
  }

  if (err.code === '23502') {
    return res.status(400).json({ error: 'Missing required field' });
  }

  if (err.type === 'StripeError') {
    return res.status(400).json({ error: err.message });
  }

  res.status(err.status || 500).json({
    error: err.message || 'An unexpected error occurred. Please try again.',
  });
}

function notFound(req, res) {
  res.status(404).json({ error: 'Endpoint not found' });
}

module.exports = { validate, errorHandler, notFound };
