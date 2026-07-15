const jwt = require('jsonwebtoken');
const config = require('../config');
const db = require('../config/database');
const logger = require('../utils/logger');

async function authenticate(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, config.jwt.secret);

    const userResult = await db.query(
      `SELECT u.id, u.email, u.first_name, u.last_name, u.role, u.workspace_id, u.status,
              u.phone, u.profile_image, u.last_activity_at,
              w.name as workspace_name, w.plan, w.subscription_status
       FROM users u
       JOIN workspaces w ON u.workspace_id = w.id
       WHERE u.id = $1 AND u.status = 'active'`,
      [decoded.userId]
    );

    if (userResult.rows.length === 0) {
      return res.status(401).json({ error: 'User not found or inactive' });
    }

    const user = userResult.rows[0];

    if (user.workspace_id && user.subscription_status === 'suspended') {
      return res.status(403).json({ error: 'Workspace suspended. Please contact support.' });
    }

    await db.query(
      'UPDATE users SET last_activity_at = NOW() WHERE id = $1',
      [user.id]
    );

    req.user = user;
    req.workspaceId = user.workspace_id;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired', code: 'TOKEN_EXPIRED' });
    }
    logger.error('Auth error:', err.message);
    return res.status(401).json({ error: 'Invalid token' });
  }
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
  };
}

function requireManagerOrAbove(req, res, next) {
  const managerRoles = ['super_admin', 'admin', 'sales_manager'];
  if (!req.user || !managerRoles.includes(req.user.role)) {
    return res.status(403).json({ error: 'Manager or admin access required' });
  }
  next();
}

function requireAdminOrAbove(req, res, next) {
  const adminRoles = ['super_admin', 'admin'];
  if (!req.user || !adminRoles.includes(req.user.role)) {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
}

function requireSuperAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'super_admin') {
    return res.status(403).json({ error: 'Super admin access required' });
  }
  next();
}

module.exports = { authenticate, requireRole, requireManagerOrAbove, requireAdminOrAbove, requireSuperAdmin };
