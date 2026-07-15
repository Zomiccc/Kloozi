const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const config = require('../config');
const db = require('../config/database');
const logger = require('../utils/logger');
const { sendEmail } = require('../services/emailService');
const { sendPushNotification } = require('../utils/notifications');

function generateTokens(userId, workspaceId, role) {
  const accessToken = jwt.sign({ userId, workspaceId, role }, config.jwt.secret, {
    expiresIn: config.jwt.expiresIn,
  });
  const refreshToken = jwt.sign({ userId }, config.jwt.refreshSecret, {
    expiresIn: config.jwt.refreshExpiresIn,
  });
  return { accessToken, refreshToken };
}

async function generateAndStoreRefreshToken(userId) {
  const refreshToken = crypto.randomBytes(40).toString('hex');
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  await db.query(
    'INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES ($1, $2, $3)',
    [userId, refreshToken, expiresAt]
  );
  return refreshToken;
}

async function verifyRefreshToken(token) {
  const result = await db.query(
    'SELECT * FROM refresh_tokens WHERE token = $1 AND is_revoked = false AND expires_at > NOW()',
    [token]
  );
  if (result.rows.length === 0) return null;
  return result.rows[0];
}

exports.signup = async (req, res, next) => {
  try {
    const { email, password, companyName, firstName, lastName, phone } = req.body;

    const existing = await db.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'An account with this email already exists' });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const result = await db.transaction(async (client) => {
      const workspaceResult = await client.query(
        'INSERT INTO workspaces (name, slug, plan, subscription_status, trial_ends_at) VALUES ($1, $2, $3, $4, $5) RETURNING id',
        [companyName, companyName.toLowerCase().replace(/\s+/g, '-') + '-' + crypto.randomBytes(4).toString('hex'),
         'free', 'trial', new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)]
      );
      const workspaceId = workspaceResult.rows[0].id;

      const userResult = await client.query(
        `INSERT INTO users (workspace_id, email, password_hash, first_name, last_name, phone, role, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id, email, first_name, last_name, role, workspace_id`,
        [workspaceId, email, passwordHash, firstName, lastName, phone || null, 'admin', 'active']
      );

      await client.query(
        `INSERT INTO subscriptions (workspace_id, plan, status, trial_start, trial_end)
         VALUES ($1, $2, $3, NOW(), $4)`,
        [workspaceId, 'free', 'trial', new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)]
      );

      const stages = ['New', 'Contacted', 'Interested', 'Negotiating', 'Won', 'Lost'];
      for (let i = 0; i < stages.length; i++) {
        await client.query(
          `INSERT INTO lead_stages (workspace_id, name, sort_order, is_default, is_won, is_lost)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [workspaceId, stages[i], i, i === 0, stages[i] === 'Won', stages[i] === 'Lost']
        );
      }

      return userResult.rows[0];
    });

    const tokens = await generateAndStoreRefreshToken(result.id);
    const accessToken = jwt.sign({ userId: result.id, workspaceId: result.workspace_id, role: result.role }, config.jwt.secret, {
      expiresIn: config.jwt.expiresIn,
    });

    try {
      await sendEmail({
        to: email,
        subject: `Welcome to ${config.appName}`,
        text: `Hi ${firstName}, welcome to ${config.appName}! Your workspace is ready.`,
        html: `<h2>Welcome to ${config.appName}!</h2><p>Hi ${firstName},</p><p>Your workspace "${companyName}" is ready. Start managing your leads today!</p>`,
      });
    } catch (e) {
      logger.warn('Welcome email failed:', e.message);
    }

    res.status(201).json({
      message: 'Account created successfully',
      user: { id: result.id, email: result.email, firstName: result.first_name, lastName: result.last_name, role: result.role },
      accessToken,
      refreshToken: tokens,
    });
  } catch (err) {
    next(err);
  }
};

exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    const userResult = await db.query(
      `SELECT u.*, w.subscription_status, w.plan
       FROM users u JOIN workspaces w ON u.workspace_id = w.id
       WHERE u.email = $1`,
      [email]
    );

    if (userResult.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const user = userResult.rows[0];

    if (user.status === 'suspended') {
      return res.status(403).json({ error: 'Your account has been suspended. Please contact your administrator.' });
    }

    if (!user.password_hash) {
      return res.status(401).json({ error: 'Please use Google sign-in or set a password' });
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    if (user.two_factor_enabled) {
      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      const otpHash = await bcrypt.hash(otp, 10);
      await db.query(
        'UPDATE users SET two_factor_secret = $1 WHERE id = $2',
        [otpHash, user.id]
      );
      try {
        await sendEmail({
          to: email,
          subject: `${config.appName} - Login Verification Code`,
          text: `Your verification code is: ${otp}`,
          html: `<p>Your verification code is: <strong>${otp}</strong></p><p>This code expires in 10 minutes.</p>`,
        });
      } catch (e) {
        logger.warn('2FA email failed:', e.message);
      }
      return res.json({ requires2FA: true, userId: user.id });
    }

    const tokens = await generateAndStoreRefreshToken(user.id);
    const accessToken = jwt.sign({ userId: user.id, workspaceId: user.workspace_id, role: user.role }, config.jwt.secret, {
      expiresIn: config.jwt.expiresIn,
    });

    await db.query('UPDATE users SET last_activity_at = NOW() WHERE id = $1', [user.id]);

    res.json({
      message: 'Login successful',
      user: {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        role: user.role,
        workspaceId: user.workspace_id,
        phone: user.phone,
        profileImage: user.profile_image,
      },
      accessToken,
      refreshToken: tokens,
    });
  } catch (err) {
    next(err);
  }
};

exports.refreshToken = async (req, res, next) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      return res.status(400).json({ error: 'Refresh token required' });
    }

    const tokenRecord = await verifyRefreshToken(refreshToken);
    if (!tokenRecord) {
      return res.status(401).json({ error: 'Invalid or expired refresh token' });
    }

    await db.query('UPDATE refresh_tokens SET is_revoked = true WHERE id = $1', [tokenRecord.id]);

    const userResult = await db.query(
      'SELECT id, workspace_id, role, status FROM users WHERE id = $1 AND status = $2',
      [tokenRecord.user_id, 'active']
    );

    if (userResult.rows.length === 0) {
      return res.status(401).json({ error: 'User not found or inactive' });
    }

    const user = userResult.rows[0];
    const newRefreshToken = await generateAndStoreRefreshToken(user.id);
    const accessToken = jwt.sign({ userId: user.id, workspaceId: user.workspace_id, role: user.role }, config.jwt.secret, {
      expiresIn: config.jwt.expiresIn,
    });

    res.json({ accessToken, refreshToken: newRefreshToken });
  } catch (err) {
    next(err);
  }
};

exports.logout = async (req, res, next) => {
  try {
    const { refreshToken } = req.body;
    if (refreshToken) {
      await db.query('UPDATE refresh_tokens SET is_revoked = true WHERE token = $1', [refreshToken]);
    }
    res.json({ message: 'Logged out successfully' });
  } catch (err) {
    next(err);
  }
};

exports.forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;
    const userResult = await db.query('SELECT id, first_name FROM users WHERE email = $1', [email]);

    if (userResult.rows.length > 0) {
      const token = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

      await db.query(
        'INSERT INTO password_resets (email, token, expires_at) VALUES ($1, $2, $3)',
        [email, token, expiresAt]
      );

      const resetUrl = `${config.webUrl}/reset-password?token=${token}`;
      try {
        await sendEmail({
          to: email,
          subject: `${config.appName} - Password Reset`,
          text: `Click this link to reset your password: ${resetUrl}`,
          html: `<p>Hi ${userResult.rows[0].first_name || ''},</p><p>Click <a href="${resetUrl}">here</a> to reset your password.</p><p>This link expires in 1 hour.</p>`,
        });
      } catch (e) {
        logger.warn('Password reset email failed:', e.message);
      }
    }

    res.json({ message: 'If an account exists with that email, a reset link has been sent' });
  } catch (err) {
    next(err);
  }
};

exports.resetPassword = async (req, res, next) => {
  try {
    const { token, password } = req.body;

    const tokenResult = await db.query(
      'SELECT * FROM password_resets WHERE token = $1 AND used = false AND expires_at > NOW()',
      [token]
    );

    if (tokenResult.rows.length === 0) {
      return res.status(400).json({ error: 'Invalid or expired reset token' });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    await db.transaction(async (client) => {
      await client.query('UPDATE users SET password_hash = $1 WHERE email = $2', [passwordHash, tokenResult.rows[0].email]);
      await client.query('UPDATE password_resets SET used = true WHERE id = $1', [tokenResult.rows[0].id]);
    });

    res.json({ message: 'Password reset successfully. Please login with your new password.' });
  } catch (err) {
    next(err);
  }
};

exports.googleAuth = (req, res) => {
  const url = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${config.google.clientId}&redirect_uri=${config.google.callbackUrl}&response_type=code&scope=openid email profile&access_type=offline`;
  res.redirect(url);
};

exports.googleCallback = async (req, res, next) => {
  try {
    const { code } = req.query;
    if (!code) {
      return res.redirect(`${config.webUrl}/login?error=google_auth_failed`);
    }

    const tokenResponse = await axios.post('https://oauth2.googleapis.com/token', {
      client_id: config.google.clientId,
      client_secret: config.google.clientSecret,
      code,
      redirect_uri: config.google.callbackUrl,
      grant_type: 'authorization_code',
    });

    const { access_token } = tokenResponse.data;
    const userInfoResponse = await axios.get('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${access_token}` },
    });

    const { email, given_name, family_name, id: googleId } = userInfoResponse.data;

    let userResult = await db.query('SELECT * FROM users WHERE google_id = $1 OR email = $2', [googleId, email]);

    if (userResult.rows.length === 0) {
      return res.redirect(`${config.webUrl}/login?error=no_account&email=${email}`);
    }

    const user = userResult.rows[0];
    const tokens = await generateAndStoreRefreshToken(user.id);
    const accessToken = jwt.sign({ userId: user.id, workspaceId: user.workspace_id, role: user.role }, config.jwt.secret, {
      expiresIn: config.jwt.expiresIn,
    });

    res.redirect(`${config.webUrl}/auth/callback?token=${accessToken}&refresh=${tokens}`);
  } catch (err) {
    logger.error('Google OAuth error:', err.message);
    res.redirect(`${config.webUrl}/login?error=google_auth_failed`);
  }
};

exports.acceptInvitation = async (req, res, next) => {
  try {
    const { token, password, firstName, lastName } = req.body;

    const userResult = await db.query(
      'SELECT * FROM users WHERE invitation_token = $1 AND status = $2',
      [token, 'invited']
    );

    if (userResult.rows.length === 0) {
      return res.status(400).json({ error: 'Invalid or expired invitation' });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    await db.query(
      `UPDATE users SET password_hash = $1, first_name = $2, last_name = $3, status = $4, invitation_token = NULL, invitation_accepted_at = NOW()
       WHERE id = $5`,
      [passwordHash, firstName || userResult.rows[0].first_name, lastName || userResult.rows[0].last_name, 'active', userResult.rows[0].id]
    );

    const user = userResult.rows[0];
    const tokens = await generateAndStoreRefreshToken(user.id);
    const accessToken = jwt.sign({ userId: user.id, workspaceId: user.workspace_id, role: user.role }, config.jwt.secret, {
      expiresIn: config.jwt.expiresIn,
    });

    res.json({
      message: 'Invitation accepted successfully',
      accessToken,
      refreshToken: tokens,
    });
  } catch (err) {
    next(err);
  }
};

exports.verify2FA = async (req, res, next) => {
  try {
    const { userId, code } = req.body;

    const userResult = await db.query(
      'SELECT id, two_factor_secret, workspace_id, role, email, first_name, last_name FROM users WHERE id = $1',
      [userId]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = userResult.rows[0];
    const isValid = await bcrypt.compare(code, user.two_factor_secret);
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid verification code' });
    }

    await db.query('UPDATE users SET two_factor_secret = NULL, last_activity_at = NOW() WHERE id = $1', [userId]);

    const tokens = await generateAndStoreRefreshToken(user.id);
    const accessToken = jwt.sign({ userId: user.id, workspaceId: user.workspace_id, role: user.role }, config.jwt.secret, {
      expiresIn: config.jwt.expiresIn,
    });

    res.json({
      message: '2FA verified successfully',
      user: { id: user.id, email: user.email, firstName: user.first_name, lastName: user.last_name, role: user.role },
      accessToken,
      refreshToken: tokens,
    });
  } catch (err) {
    next(err);
  }
};

exports.enable2FA = async (req, res, next) => {
  try {
    await db.query('UPDATE users SET two_factor_enabled = true WHERE id = $1', [req.user.id]);
    res.json({ message: '2FA enabled successfully' });
  } catch (err) {
    next(err);
  }
};

exports.disable2FA = async (req, res, next) => {
  try {
    await db.query('UPDATE users SET two_factor_enabled = false WHERE id = $1', [req.user.id]);
    res.json({ message: '2FA disabled successfully' });
  } catch (err) {
    next(err);
  }
};
