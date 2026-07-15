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

async function updateLeadScore(leadId) {
  try {
    const leadResult = await db.query(
      `SELECT l.id, l.created_at, l.stage, l.last_activity_at,
              (SELECT COUNT(*) FROM lead_activities WHERE lead_id = l.id AND type = 'call') as call_count,
              (SELECT COUNT(*) FROM lead_activities WHERE lead_id = l.id AND type = 'whatsapp_sent') as whatsapp_count,
              (SELECT COUNT(*) FROM lead_activities WHERE lead_id = l.id AND type = 'email_sent') as email_count,
              (SELECT COUNT(*) FROM lead_activities WHERE lead_id = l.id AND type IN ('whatsapp_received', 'sms_received', 'email_replied')) as response_count,
              (SELECT COUNT(*) FROM lead_activities WHERE lead_id = l.id) as total_activities
       FROM leads l WHERE l.id = $1`,
      [leadId]
    );

    if (leadResult.rows.length === 0) return;

    const lead = leadResult.rows[0];
    let score = 0;

    const daysSinceCreation = (Date.now() - new Date(lead.created_at).getTime()) / (1000 * 60 * 60 * 24);
    if (daysSinceCreation < 1) score += 20;
    else if (daysSinceCreation < 7) score += 15;
    else if (daysSinceCreation < 30) score += 10;
    else score += 5;

    const stageScores = { new: 10, contacted: 20, interested: 40, negotiating: 60, won: 100, lost: 0 };
    score += stageScores[lead.stage] || 0;

    const totalMessages = parseInt(lead.call_count) + parseInt(lead.whatsapp_count) + parseInt(lead.email_count);
    if (totalMessages > 0) {
      const responseRate = parseInt(lead.response_count) / totalMessages;
      score += Math.round(responseRate * 20);
    }

    if (lead.last_activity_at) {
      const daysSinceActivity = (Date.now() - new Date(lead.last_activity_at).getTime()) / (1000 * 60 * 60 * 24);
      if (daysSinceActivity < 1) score += 15;
      else if (daysSinceActivity < 3) score += 10;
      else if (daysSinceActivity < 7) score += 5;
    }

    score = Math.min(100, Math.max(0, score));

    await db.query('UPDATE leads SET score = $1 WHERE id = $2', [score, leadId]);
    return score;
  } catch (err) {
    logger.error('Score update error:', err.message);
  }
}

module.exports = { logActivity, addTimelineEntry, updateLeadScore };
