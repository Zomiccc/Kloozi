const db = require('../config/database');
const logger = require('./logger');
const config = require('../config');

let firebaseApp = null;

try {
  if (config.firebase.projectId && config.firebase.privateKey) {
    const admin = require('firebase-admin');
    firebaseApp = admin.initializeApp({
      credential: admin.credential.cert({
        projectId: config.firebase.projectId,
        clientEmail: config.firebase.clientEmail,
        privateKey: config.firebase.privateKey,
      }),
    });
  }
} catch (err) {
  logger.warn('Firebase not initialized:', err.message);
}

async function sendPushNotification(userId, title, body, data = {}) {
  try {
    const tokensResult = await db.query(
      'SELECT token FROM device_tokens WHERE user_id = $1 AND active = true',
      [userId]
    );

    if (tokensResult.rows.length === 0) return;

    const tokens = tokensResult.rows.map((r) => r.token);

    if (firebaseApp) {
      const admin = require('firebase-admin');
      const message = {
        notification: { title, body },
        data: Object.keys(data).reduce((acc, k) => ({ ...acc, [k]: String(data[k]) }), {}),
        tokens,
      };
      const response = await admin.messaging().sendMulticast(message);
      logger.info(`Push sent: ${response.successCount} success, ${response.failureCount} failed`);
    } else {
      logger.info(`Push notification (no Firebase): ${title} -> ${tokens.length} devices`);
    }

    await db.query(
      `INSERT INTO notifications (user_id, workspace_id, type, title, body, data, created_at)
       SELECT $1, workspace_id, $2, $3, $4, $5, NOW()
       FROM users WHERE id = $1`,
      [userId, data.type || 'general', title, body, JSON.stringify(data)]
    );
  } catch (err) {
    logger.error('Push notification error:', err.message);
  }
}

async function sendWorkspaceNotification(workspaceId, type, title, body, data = {}, roles = null) {
  try {
    let query = 'SELECT id FROM users WHERE workspace_id = $1 AND status = $2';
    let params = [workspaceId, 'active'];
    if (roles) {
      query += ` AND role = ANY($3)`;
      params.push(roles);
    }
    const usersResult = await db.query(query, params);

    for (const user of usersResult.rows) {
      await sendPushNotification(user.id, title, body, { ...data, type });
    }
  } catch (err) {
    logger.error('Workspace notification error:', err.message);
  }
}

async function notifyManagers(workspaceId, type, title, body, data = {}) {
  await sendWorkspaceNotification(workspaceId, type, title, body, data, ['super_admin', 'admin', 'sales_manager']);
}

module.exports = { sendPushNotification, sendWorkspaceNotification, notifyManagers };
