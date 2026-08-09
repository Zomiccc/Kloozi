const db = require('../config/database');

// Conversion Signal scoring module
// This is a rule-based scoring system (NOT AI/ML) that can be swapped out later
// for a real ML model without touching the rest of the app.

const RULES = {
  PROPOSAL_OPEN: { points: 20, label: 'Opened proposal' },
  PRICING_VIEW: { points: 15, label: 'Viewed pricing page' },
  BOOKING_CLICK: { points: 25, label: 'Clicked booking link' },
  RECENT_REPLY: { points: 10, label: 'Replied to email recently' },
  EMAIL_OPEN: { points: 5, label: 'Opened email' },
  DOCUMENT_VIEW: { points: 8, label: 'Viewed shared document' },
  MULTIPLE_OPENS: { points: 10, label: 'Opened document multiple times' },
  STAGE_ADVANCE: { points: 15, label: 'Advanced to next stage' },
  NO_ACTIVITY_14D: { points: -10, label: 'No activity for 14+ days' },
  NO_ACTIVITY_30D: { points: -20, label: 'No activity for 30+ days' },
};

async function calculateConversionSignal(leadId, workspaceId) {
  try {
    // Get lead info
    const leadRes = await db.query('SELECT * FROM leads WHERE id = $1 AND workspace_id = $2', [leadId, workspaceId]);
    if (leadRes.rows.length === 0) return null;
    const lead = leadRes.rows[0];

    let score = 0;
    const reasons = [];

    // 1. Check content tracking (document/file views)
    const trackingRes = await db.query(
      `SELECT ct.*, cf.name as file_name FROM content_tracking ct
       LEFT JOIN content_files cf ON ct.file_id = cf.id
       WHERE ct.lead_id = $1 AND ct.workspace_id = $2`,
      [leadId, workspaceId]
    );
    const trackingRows = trackingRes.rows || [];

    let totalDocViews = 0;
    let proposalOpens = 0;
    let pricingViews = 0;

    for (const t of trackingRows) {
      if (t.first_opened_at) {
        totalDocViews++;
        const fileName = (t.file_name || '').toLowerCase();
        if (fileName.includes('proposal') || fileName.includes('quote')) {
          proposalOpens += t.open_count || 1;
          reasons.push({ rule: 'PROPOSAL_OPEN', label: `Opened proposal "${t.file_name}" ${t.open_count || 1} time(s)`, points: RULES.PROPOSAL_OPEN.points });
          score += RULES.PROPOSAL_OPEN.points;
          if (t.open_count > 1) {
            reasons.push({ rule: 'MULTIPLE_OPENS', label: `Opened "${t.file_name}" multiple times (${t.open_count}x)`, points: RULES.MULTIPLE_OPENS.points });
            score += RULES.MULTIPLE_OPENS.points;
          }
        }
        if (fileName.includes('pricing') || fileName.includes('price')) {
          pricingViews++;
          reasons.push({ rule: 'PRICING_VIEW', label: `Viewed pricing document "${t.file_name}"`, points: RULES.PRICING_VIEW.points });
          score += RULES.PRICING_VIEW.points;
        }
        if (!fileName.includes('proposal') && !fileName.includes('pricing') && !fileName.includes('price')) {
          reasons.push({ rule: 'DOCUMENT_VIEW', label: `Viewed document "${t.file_name}"`, points: RULES.DOCUMENT_VIEW.points });
          score += RULES.DOCUMENT_VIEW.points;
        }
      }
    }

    // 2. Check email engagement
    const emailRes = await db.query(
      `SELECT * FROM emails WHERE lead_id = $1 AND workspace_id = $2 ORDER BY sent_at DESC`,
      [leadId, workspaceId]
    );
    const emails = emailRes.rows || [];
    let emailOpens = 0;
    let emailClicks = 0;
    let recentReply = false;

    const now = Date.now();
    for (const e of emails) {
      if (e.opened_at) emailOpens += (e.open_count || 1);
      if (e.clicked_at) emailClicks += (e.click_count || 1);
      if (e.replied_at && (now - new Date(e.replied_at).getTime()) < 7 * 86400000) {
        recentReply = true;
      }
    }

    if (emailOpens > 0) {
      reasons.push({ rule: 'EMAIL_OPEN', label: `Opened ${emailOpens} email(s)`, points: RULES.EMAIL_OPEN.points });
      score += RULES.EMAIL_OPEN.points;
    }
    if (recentReply) {
      reasons.push({ rule: 'RECENT_REPLY', label: 'Replied to an email within the last 7 days', points: RULES.RECENT_REPLY.points });
      score += RULES.RECENT_REPLY.points;
    }

    // 3. Check for booking link clicks (from email click tracking)
    if (emailClicks > 0) {
      const clickEmails = emails.filter(e => e.clicked_at);
      for (const ce of clickEmails) {
        if (ce.subject && ce.subject.toLowerCase().includes('book')) {
          reasons.push({ rule: 'BOOKING_CLICK', label: 'Clicked booking link in email', points: RULES.BOOKING_CLICK.points });
          score += RULES.BOOKING_CLICK.points;
          break;
        }
      }
    }

    // 4. Check stage advancement
    if (lead.stage === 'interested' || lead.stage === 'negotiating') {
      reasons.push({ rule: 'STAGE_ADVANCE', label: `Lead is in "${lead.stage}" stage`, points: RULES.STAGE_ADVANCE.points });
      score += RULES.STAGE_ADVANCE.points;
    }
    if (lead.stage === 'won') {
      score = 100;
      reasons.length = 0;
      reasons.push({ rule: 'STAGE_ADVANCE', label: 'Lead is won', points: 100 });
    }

    // 5. Check for inactivity
    const lastActivity = lead.last_activity_at || lead.updated_at || lead.created_at;
    const daysSinceActivity = Math.floor((now - new Date(lastActivity).getTime()) / 86400000);
    if (daysSinceActivity >= 30) {
      reasons.push({ rule: 'NO_ACTIVITY_30D', label: `No activity for ${daysSinceActivity} days`, points: RULES.NO_ACTIVITY_30D.points });
      score += RULES.NO_ACTIVITY_30D.points;
    } else if (daysSinceActivity >= 14) {
      reasons.push({ rule: 'NO_ACTIVITY_14D', label: `No activity for ${daysSinceActivity} days`, points: RULES.NO_ACTIVITY_14D.points });
      score += RULES.NO_ACTIVITY_14D.points;
    }

    // Clamp score to 0-100
    score = Math.max(0, Math.min(100, score));

    // Get total time spent on documents
    const totalTimeRes = await db.query(
      `SELECT COALESCE(SUM(time_spent_seconds), 0) as total_time FROM content_tracking WHERE lead_id = $1 AND workspace_id = $2`,
      [leadId, workspaceId]
    );
    const totalTimeSpent = parseInt(totalTimeRes.rows[0]?.total_time || 0);

    // Get all activities for timeline
    const activitiesRes = await db.query(
      `SELECT * FROM lead_activities WHERE lead_id = $1 AND workspace_id = $2 ORDER BY created_at DESC LIMIT 50`,
      [leadId, workspaceId]
    );
    const activities = activitiesRes.rows || [];

    return {
      score,
      reasons,
      metrics: {
        totalDocViews,
        proposalOpens,
        pricingViews,
        emailOpens,
        emailClicks,
        totalTimeSpent,
        totalActivities: activities.length,
        daysSinceActivity,
        emailSent: emails.length,
      },
      activities,
    };
  } catch (err) {
    console.error('Conversion signal error:', err);
    return null;
  }
}

module.exports = { calculateConversionSignal, RULES };
