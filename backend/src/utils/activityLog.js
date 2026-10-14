const db = require('../config/database');
const { replaceVariables } = require('./variables');
const { sendPushNotification } = require('./notifications');
const logger = require('./logger');

async function logActivity(workspaceId, leadId, userId, type, description, metadata = {}) {
  try {
    const { latitude, longitude, attachments, ...restMetadata } = metadata;
    const fullMetadata = { ...restMetadata };
    if (latitude && longitude) {
      fullMetadata.geolocation = { latitude, longitude };
    }
    if (attachments && Array.isArray(attachments) && attachments.length > 0) {
      fullMetadata.attachments = attachments;
    }
    await db.query(
      `INSERT INTO lead_activities (workspace_id, lead_id, user_id, type, description, metadata, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
      [workspaceId, leadId, userId, type, description, JSON.stringify(fullMetadata)]
    );
  } catch (err) {
    logger.error('Activity log error:', err.message);
  }
}

async function addTimelineEntry(workspaceId, leadId, userId, type, description, attachments = [], latitude = null, longitude = null) {
  try {
    const metadata = {};
    if (attachments && attachments.length > 0) {
      metadata.attachments = attachments;
    }
    if (latitude && longitude) {
      metadata.geolocation = { latitude, longitude };
    }
    await db.query(
      `INSERT INTO lead_activities (workspace_id, lead_id, user_id, type, description, metadata, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
      [workspaceId, leadId, userId, type, description, JSON.stringify(metadata)]
    );
  } catch (err) {
    logger.error('Timeline entry error:', err.message);
  }
}

/** Lead score = interest score (behaviour-based, see services/interestService.js). */
async function updateLeadScore(leadId) {
  try {
    const { refreshLeadInterest } = require('../services/interestService');
    await refreshLeadInterest(leadId);
  } catch (err) {
    logger.error('Lead score update error:', err.message);
  }
}

module.exports = { logActivity, addTimelineEntry, updateLeadScore };
