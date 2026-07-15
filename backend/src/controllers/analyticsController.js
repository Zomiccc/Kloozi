const db = require('../config/database');

exports.getDashboard = async (req, res, next) => {
  try {
    const wsId = req.workspaceId;
    const { date_from, date_to } = req.query;

    let dateFilter = '';
    let params = [wsId];
    if (date_from && date_to) {
      dateFilter = ' AND created_at BETWEEN $2 AND $3';
      params.push(date_from, date_to);
    }

    const leadStats = await db.query(
      `SELECT
         COUNT(*) as total_leads,
         COUNT(CASE WHEN created_at::date = CURRENT_DATE THEN 1 END) as leads_today,
         COUNT(CASE WHEN created_at::date = CURRENT_DATE - 1 THEN 1 END) as leads_yesterday,
         COUNT(CASE WHEN stage = 'won' THEN 1 END) as won,
         COUNT(CASE WHEN stage = 'lost' THEN 1 END) as lost,
         COUNT(CASE WHEN stage = 'new' THEN 1 END) as new_leads,
         COUNT(CASE WHEN stage = 'contacted' THEN 1 END) as contacted,
         COUNT(CASE WHEN stage = 'interested' THEN 1 END) as interested,
         COUNT(CASE WHEN stage = 'negotiating' THEN 1 END) as negotiating
       FROM leads WHERE workspace_id = $1`,
      [wsId]
    );

    const leadsBySource = await db.query(
      `SELECT lead_source, COUNT(*) as count FROM leads WHERE workspace_id = $1 GROUP BY lead_source ORDER BY count DESC`,
      [wsId]
    );

    const leadsByCity = await db.query(
      `SELECT city, COUNT(*) as count FROM leads WHERE workspace_id = $1 AND city IS NOT NULL GROUP BY city ORDER BY count DESC LIMIT 10`,
      [wsId]
    );

    const leadsByAgent = await db.query(
      `SELECT u.id, u.first_name, u.last_name, COUNT(l.id) as lead_count,
              COUNT(CASE WHEN l.stage = 'won' THEN 1 END) as won_count
       FROM users u LEFT JOIN leads l ON u.id = l.assigned_to
       WHERE u.workspace_id = $1 GROUP BY u.id, u.first_name, u.last_name ORDER BY lead_count DESC`,
      [wsId]
    );

    const conversionRate = await db.query(
      `SELECT
         COUNT(CASE WHEN stage IN ('won', 'lost') THEN 1 END) as total_closed,
         COUNT(CASE WHEN stage = 'won' THEN 1 END) as total_won
       FROM leads WHERE workspace_id = $1`,
      [wsId]
    );

    const stuckLeads = await db.query(
      `SELECT COUNT(*) as count FROM leads WHERE workspace_id = $1 AND last_activity_at < NOW() - INTERVAL '7 days' AND stage NOT IN ('won', 'lost')`,
      [wsId]
    );

    const callsToday = await db.query(
      `SELECT COUNT(*) as count FROM calls WHERE workspace_id = $1 AND created_at::date = CURRENT_DATE`,
      [wsId]
    );

    const followUpsToday = await db.query(
      `SELECT COUNT(*) as total, COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed
       FROM follow_ups WHERE workspace_id = $1 AND due_date::date = CURRENT_DATE`,
      [wsId]
    );

    const emailsToday = await db.query(
      `SELECT COUNT(*) as count FROM emails WHERE workspace_id = $1 AND sent_at::date = CURRENT_DATE`,
      [wsId]
    );

    const leadTrend = await db.query(
      `SELECT created_at::date as date, COUNT(*) as count FROM leads WHERE workspace_id = $1 AND created_at > NOW() - INTERVAL '30 days' GROUP BY date ORDER BY date`,
      [wsId]
    );

    const cr = conversionRate.rows[0];
    const totalClosed = parseInt(cr.total_closed) || 1;

    res.json({
      leadStats: {
        totalLeads: parseInt(leadStats.rows[0].total_leads),
        leadsToday: parseInt(leadStats.rows[0].leads_today),
        leadsYesterday: parseInt(leadStats.rows[0].leads_yesterday),
        won: parseInt(leadStats.rows[0].won),
        lost: parseInt(leadStats.rows[0].lost),
        newLeads: parseInt(leadStats.rows[0].new_leads),
        contacted: parseInt(leadStats.rows[0].contacted),
        interested: parseInt(leadStats.rows[0].interested),
        negotiating: parseInt(leadStats.rows[0].negotiating),
      },
      leadsBySource: leadsBySource.rows,
      leadsByCity: leadsByCity.rows,
      leadsByAgent: leadsByAgent.rows,
      conversionRate: ((parseInt(cr.total_won) / totalClosed) * 100).toFixed(1),
      stuckLeads: parseInt(stuckLeads.rows[0].count),
      callsToday: parseInt(callsToday.rows[0].count),
      followUpsToday: { total: parseInt(followUpsToday.rows[0].total), completed: parseInt(followUpsToday.rows[0].completed) },
      emailsToday: parseInt(emailsToday.rows[0].count),
      leadTrend: leadTrend.rows,
    });
  } catch (err) { next(err); }
};

exports.getLeadAnalytics = async (req, res, next) => {
  try {
    const wsId = req.workspaceId;
    const { date_from, date_to } = req.query;
    let dateFilter = '';
    let params = [wsId];
    if (date_from && date_to) {
      dateFilter = ' AND created_at BETWEEN $2 AND $3';
      params.push(date_from, date_to);
    }

    const bySource = await db.query(`SELECT lead_source, COUNT(*) as count FROM leads WHERE workspace_id = $1${dateFilter} GROUP BY lead_source ORDER BY count DESC`, params);
    const byCity = await db.query(`SELECT city, COUNT(*) as count FROM leads WHERE workspace_id = $1 AND city IS NOT NULL${dateFilter} GROUP BY city ORDER BY count DESC`, params);
    const byBudget = await db.query(`SELECT CASE WHEN budget < 10000 THEN '0-10k' WHEN budget < 50000 THEN '10k-50k' WHEN budget < 100000 THEN '50k-100k' WHEN budget >= 100000 THEN '100k+' END as range, COUNT(*) as count FROM leads WHERE workspace_id = $1 AND budget IS NOT NULL${dateFilter} GROUP BY range ORDER BY range`, params);
    const byAgent = await db.query(`SELECT u.first_name, u.last_name, COUNT(l.id) as count FROM users u LEFT JOIN leads l ON u.id = l.assigned_to WHERE u.workspace_id = $1 GROUP BY u.id ORDER BY count DESC`, [wsId]);
    const trend = await db.query(`SELECT created_at::date as date, COUNT(*) as count FROM leads WHERE workspace_id = $1${dateFilter} GROUP BY date ORDER BY date`, params);

    res.json({ bySource: bySource.rows, byCity: byCity.rows, byBudget: byBudget.rows, byAgent: byAgent.rows, trend: trend.rows });
  } catch (err) { next(err); }
};

exports.getConversionAnalytics = async (req, res, next) => {
  try {
    const wsId = req.workspaceId;
    const bySource = await db.query(
      `SELECT lead_source,
         COUNT(CASE WHEN stage = 'won' THEN 1 END) as won,
         COUNT(CASE WHEN stage = 'lost' THEN 1 END) as lost,
         COUNT(*) as total
       FROM leads WHERE workspace_id = $1 GROUP BY lead_source`,
      [wsId]
    );
    const byAgent = await db.query(
      `SELECT u.first_name, u.last_name,
         COUNT(CASE WHEN l.stage = 'won' THEN 1 END) as won,
         COUNT(CASE WHEN l.stage = 'lost' THEN 1 END) as lost,
         COUNT(l.id) as total
       FROM users u LEFT JOIN leads l ON u.id = l.assigned_to WHERE u.workspace_id = $1 GROUP BY u.id`,
      [wsId]
    );
    const avgTimeToClose = await db.query(
      `SELECT AVG(EXTRACT(EPOCH FROM (updated_at - created_at))/86400) as avg_days FROM leads WHERE workspace_id = $1 AND stage = 'won'`,
      [wsId]
    );

    res.json({
      bySource: bySource.rows.map(r => ({ ...r, conversionRate: ((parseInt(r.won) / (parseInt(r.total) || 1)) * 100).toFixed(1) })),
      byAgent: byAgent.rows.map(r => ({ ...r, conversionRate: ((parseInt(r.won) / (parseInt(r.total) || 1)) * 100).toFixed(1) })),
      avgTimeToClose: avgTimeToClose.rows[0].avg_days ? parseFloat(avgTimeToClose.rows[0].avg_days).toFixed(1) : 0,
    });
  } catch (err) { next(err); }
};

exports.getPipelineAnalytics = async (req, res, next) => {
  try {
    const wsId = req.workspaceId;
    const stages = await db.query(
      `SELECT s.name, s.color, COUNT(l.id) as count FROM lead_stages s LEFT JOIN leads l ON s.id = l.stage_id AND l.workspace_id = $1 WHERE s.workspace_id = $1 GROUP BY s.id, s.name, s.color ORDER BY s.sort_order`,
      [wsId]
    );
    const movedThisWeek = await db.query(
      `SELECT COUNT(DISTINCT lead_id) as count FROM lead_activities WHERE workspace_id = $1 AND type = 'stage_change' AND created_at > NOW() - INTERVAL '7 days'`,
      [wsId]
    );
    const stuck = await db.query(
      `SELECT COUNT(*) as count FROM leads WHERE workspace_id = $1 AND last_activity_at < NOW() - INTERVAL '7 days' AND stage NOT IN ('won', 'lost')`,
      [wsId]
    );
    res.json({ stages: stages.rows, movedThisWeek: parseInt(movedThisWeek.rows[0].count), stuckLeads: parseInt(stuck.rows[0].count) });
  } catch (err) { next(err); }
};

exports.getAgentPerformance = async (req, res, next) => {
  try {
    const wsId = req.workspaceId;
    const { date_from, date_to } = req.query;
    let dateFilter = '';
    let params = [wsId];
    if (date_from && date_to) {
      dateFilter = ' AND created_at BETWEEN $2 AND $3';
      params.push(date_from, date_to);
    }

    const result = await db.query(
      `SELECT u.id, u.first_name, u.last_name,
         (SELECT COUNT(*) FROM calls WHERE user_id = u.id AND workspace_id = $1${dateFilter}) as calls,
         (SELECT COUNT(*) FROM emails WHERE user_id = u.id AND workspace_id = $1${dateFilter}) as emails,
         (SELECT COUNT(*) FROM whatsapp_messages WHERE user_id = u.id AND workspace_id = $1${dateFilter}) as whatsapp,
         (SELECT COUNT(*) FROM sms_messages WHERE user_id = u.id AND workspace_id = $1${dateFilter}) as sms,
         (SELECT COUNT(*) FROM leads WHERE assigned_to = u.id AND workspace_id = $1 AND stage = 'won') as won,
         (SELECT COUNT(*) FROM leads WHERE assigned_to = u.id AND workspace_id = $1 AND stage = 'lost') as lost,
         (SELECT COUNT(*) FROM leads WHERE assigned_to = u.id AND workspace_id = $1) as total_leads
       FROM users u WHERE u.workspace_id = $1 ORDER BY total_leads DESC`,
      [wsId]
    );

    res.json({ agents: result.rows });
  } catch (err) { next(err); }
};

exports.getNotifications = async (req, res, next) => {
  try {
    const { unread_only } = req.query;
    let query = 'SELECT * FROM notifications WHERE user_id = $1';
    let params = [req.user.id];
    if (unread_only === 'true') {
      query += ' AND is_read = false';
    }
    query += ' ORDER BY created_at DESC LIMIT 50';
    const result = await db.query(query, params);
    res.json({ notifications: result.rows });
  } catch (err) { next(err); }
};

exports.markNotificationRead = async (req, res, next) => {
  try {
    await db.query('UPDATE notifications SET is_read = true WHERE id = $1 AND user_id = $2', [req.params.id, req.user.id]);
    res.json({ message: 'Notification marked as read' });
  } catch (err) { next(err); }
};

exports.markAllNotificationsRead = async (req, res, next) => {
  try {
    await db.query('UPDATE notifications SET is_read = true WHERE user_id = $1 AND is_read = false', [req.user.id]);
    res.json({ message: 'All notifications marked as read' });
  } catch (err) { next(err); }
};
