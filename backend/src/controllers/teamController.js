const db = require('../config/database');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const config = require('../config');
const { sendEmail } = require('../services/emailService');
const { logActivity } = require('../utils/activityLog');
const logger = require('../utils/logger');

exports.getTeamMembers = async (req, res, next) => {
  try {
    const result = await db.query(
      `SELECT u.id, u.email, u.first_name, u.last_name, u.phone, u.role, u.status, u.designation, u.profile_image,
              u.created_at, u.last_activity_at,
              (SELECT COUNT(*) FROM leads WHERE assigned_to = u.id) as lead_count,
              (SELECT COUNT(*) FROM leads WHERE assigned_to = u.id AND stage = 'won') as won_count,
              (SELECT COUNT(*) FROM calls WHERE user_id = u.id AND created_at > NOW() - INTERVAL '1 day') as calls_today,
              (SELECT COUNT(*) FROM follow_ups WHERE user_id = u.id AND status = 'completed' AND completed_at > NOW() - INTERVAL '1 day') as followups_done_today
       FROM users u WHERE u.workspace_id = $1 ORDER BY u.created_at DESC`,
      [req.workspaceId]
    );
    res.json({ members: result.rows });
  } catch (err) { next(err); }
};

exports.inviteMember = async (req, res, next) => {
  try {
    const { email, role, first_name, last_name, designation } = req.body;

    const existing = await db.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'A user with this email already exists' });
    }

    const subResult = await db.query('SELECT plan, agent_limit FROM subscriptions WHERE workspace_id = $1', [req.workspaceId]);
    if (subResult.rows.length > 0 && subResult.rows[0].agent_limit) {
      const memberCount = await db.query('SELECT COUNT(*) as count FROM users WHERE workspace_id = $1 AND status != $2', [req.workspaceId, 'invited']);
      if (parseInt(memberCount.rows[0].count) >= subResult.rows[0].agent_limit) {
        return res.status(403).json({ error: `Agent limit reached for ${subResult.rows[0].plan} plan. Please upgrade to add more agents.` });
      }
    }

    const token = crypto.randomBytes(32).toString('hex');
    const result = await db.query(
      `INSERT INTO users (workspace_id, email, role, first_name, last_name, designation, status, invitation_token)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
      [req.workspaceId, email, role || 'sales_agent', first_name, last_name, designation, 'invited', token]
    );

    const inviteUrl = `${config.webUrl}/accept-invitation?token=${token}`;
    try {
      await sendEmail({
        to: email,
        subject: `You're invited to join ${config.appName}`,
        text: `You've been invited to join the team. Click here: ${inviteUrl}`,
        html: `<h2>You're invited!</h2><p>${first_name || ''},</p><p>You've been invited to join the team on ${config.appName}.</p><p>Click <a href="${inviteUrl}">here</a> to accept the invitation and set your password.</p>`,
      });
    } catch (e) {
      logger.warn('Invitation email failed:', e.message);
    }

    res.status(201).json({ message: 'Invitation sent successfully', userId: result.rows[0].id });
  } catch (err) { next(err); }
};

exports.updateMember = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { role, status, designation } = req.body;

    const result = await db.query(
      `UPDATE users SET role = COALESCE($1, role), status = COALESCE($2, status), designation = COALESCE($3, designation), updated_at = NOW()
       WHERE id = $4 AND workspace_id = $5 RETURNING id, email, first_name, last_name, role, status`,
      [role, status, designation, id, req.workspaceId]
    );

    if (result.rows.length === 0) return res.status(404).json({ error: 'Member not found' });
    res.json({ message: 'Member updated', member: result.rows[0] });
  } catch (err) { next(err); }
};

exports.suspendMember = async (req, res, next) => {
  try {
    await db.query('UPDATE users SET status = $1 WHERE id = $2 AND workspace_id = $3', ['suspended', req.params.id, req.workspaceId]);
    res.json({ message: 'Member suspended' });
  } catch (err) { next(err); }
};

exports.reactivateMember = async (req, res, next) => {
  try {
    await db.query('UPDATE users SET status = $1 WHERE id = $2 AND workspace_id = $3', ['active', req.params.id, req.workspaceId]);
    res.json({ message: 'Member reactivated' });
  } catch (err) { next(err); }
};

exports.transferLeads = async (req, res, next) => {
  try {
    const { from_user_id, to_user_id } = req.body;
    const result = await db.query(
      'UPDATE leads SET assigned_to = $1 WHERE assigned_to = $2 AND workspace_id = $3 RETURNING id',
      [to_user_id, from_user_id, req.workspaceId]
    );
    await logActivity(req.workspaceId, null, req.user.id, 'lead_transfer', `Transferred ${result.rows.length} leads to another agent`, { from: from_user_id, to: to_user_id });
    res.json({ message: 'Leads transferred successfully', count: result.rows.length });
  } catch (err) { next(err); }
};

exports.getAgentPerformance = async (req, res, next) => {
  try {
    const { agent_id } = req.params;
    const { date_from, date_to } = req.query;

    let dateFilter = '';
    let params = [agent_id, req.workspaceId];
    if (date_from && date_to) {
      dateFilter = ' AND created_at BETWEEN $3 AND $4';
      params.push(date_from, date_to);
    }

    const callsResult = await db.query(`SELECT COUNT(*) as count FROM calls WHERE user_id = $1 AND workspace_id = $2${dateFilter}`, params);
    const emailsResult = await db.query(`SELECT COUNT(*) as count FROM emails WHERE user_id = $1 AND workspace_id = $2${dateFilter}`, params);
    const whatsappResult = await db.query(`SELECT COUNT(*) as count FROM whatsapp_messages WHERE user_id = $1 AND workspace_id = $2${dateFilter}`, params);
    const smsResult = await db.query(`SELECT COUNT(*) as count FROM sms_messages WHERE user_id = $1 AND workspace_id = $2${dateFilter}`, params);
    const followupsResult = await db.query(
      `SELECT COUNT(*) as total, COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed FROM follow_ups WHERE user_id = $1 AND workspace_id = $2${dateFilter}`,
      params
    );
    const leadsContacted = await db.query(
      `SELECT COUNT(DISTINCT lead_id) as count FROM lead_activities WHERE user_id = $1 AND workspace_id = $2${dateFilter}`,
      params
    );
    const wonResult = await db.query(
      `SELECT COUNT(*) as count FROM leads WHERE assigned_to = $1 AND workspace_id = $2 AND stage = 'won'${dateFilter ? dateFilter.replace('created_at', 'updated_at') : ''}`,
      params
    );
    const lostResult = await db.query(
      `SELECT COUNT(*) as count FROM leads WHERE assigned_to = $1 AND workspace_id = $2 AND stage = 'lost'${dateFilter ? dateFilter.replace('created_at', 'updated_at') : ''}`,
      params
    );

    const fu = followupsResult.rows[0];
    const fuTotal = parseInt(fu.total) || 1;

    res.json({
      calls: parseInt(callsResult.rows[0].count),
      emails: parseInt(emailsResult.rows[0].count),
      whatsapp: parseInt(whatsappResult.rows[0].count),
      sms: parseInt(smsResult.rows[0].count),
      leadsContacted: parseInt(leadsContacted.rows[0].count),
      followupsTotal: parseInt(fu.total),
      followupsCompleted: parseInt(fu.completed),
      followupCompletionRate: ((parseInt(fu.completed) / fuTotal) * 100).toFixed(1),
      won: parseInt(wonResult.rows[0].count),
      lost: parseInt(lostResult.rows[0].count),
    });
  } catch (err) { next(err); }
};

exports.getTeamActivityFeed = async (req, res, next) => {
  try {
    const result = await db.query(
      `SELECT la.*, u.first_name, u.last_name, l.first_name as lead_first_name, l.last_name as lead_last_name
       FROM lead_activities la
       LEFT JOIN users u ON la.user_id = u.id
       LEFT JOIN leads l ON la.lead_id = l.id
       WHERE la.workspace_id = $1 AND la.created_at > NOW() - INTERVAL '24 hours'
       ORDER BY la.created_at DESC LIMIT 100`,
      [req.workspaceId]
    );
    res.json({ activities: result.rows });
  } catch (err) { next(err); }
};

exports.getTerritories = async (req, res, next) => {
  try {
    const result = await db.query(
      `SELECT t.*, u.first_name, u.last_name FROM territories t JOIN users u ON t.user_id = u.id WHERE t.workspace_id = $1`,
      [req.workspaceId]
    );
    res.json({ territories: result.rows });
  } catch (err) { next(err); }
};

exports.assignTerritory = async (req, res, next) => {
  try {
    const { user_id, city } = req.body;
    const result = await db.query(
      'INSERT INTO territories (workspace_id, user_id, city) VALUES ($1, $2, $3) ON CONFLICT (workspace_id, user_id, city) DO NOTHING RETURNING *',
      [req.workspaceId, user_id, city]
    );
    res.status(201).json({ territory: result.rows[0] });
  } catch (err) { next(err); }
};

exports.removeTerritory = async (req, res, next) => {
  try {
    await db.query('DELETE FROM territories WHERE id = $1 AND workspace_id = $2', [req.params.id, req.workspaceId]);
    res.json({ message: 'Territory removed' });
  } catch (err) { next(err); }
};

exports.getAssignmentRules = async (req, res, next) => {
  try {
    const result = await db.query('SELECT * FROM lead_assignment_rules WHERE workspace_id = $1', [req.workspaceId]);
    res.json({ rules: result.rows });
  } catch (err) { next(err); }
};

exports.updateAssignmentRules = async (req, res, next) => {
  try {
    const { type, rules } = req.body;
    const existing = await db.query('SELECT id FROM lead_assignment_rules WHERE workspace_id = $1', [req.workspaceId]);
    if (existing.rows.length > 0) {
      await db.query('UPDATE lead_assignment_rules SET type = $1, rules = $2 WHERE workspace_id = $3', [type, JSON.stringify(rules), req.workspaceId]);
    } else {
      await db.query('INSERT INTO lead_assignment_rules (workspace_id, type, rules) VALUES ($1, $2, $3)', [req.workspaceId, type, JSON.stringify(rules)]);
    }
    res.json({ message: 'Assignment rules updated' });
  } catch (err) { next(err); }
};

exports.getProfile = async (req, res, next) => {
  try {
    const result = await db.query(
      'SELECT id, email, first_name, last_name, phone, role, designation, profile_image, notification_preferences, quiet_hours_start, quiet_hours_end, language, two_factor_enabled FROM users WHERE id = $1',
      [req.user.id]
    );
    res.json({ profile: result.rows[0] });
  } catch (err) { next(err); }
};

exports.updateProfile = async (req, res, next) => {
  try {
    const { first_name, last_name, phone, designation, profile_image, language, notification_preferences, quiet_hours_start, quiet_hours_end } = req.body;
    const result = await db.query(
      `UPDATE users SET first_name = COALESCE($1, first_name), last_name = COALESCE($2, last_name), phone = COALESCE($3, phone),
              designation = COALESCE($4, designation), profile_image = COALESCE($5, profile_image), language = COALESCE($6, language),
              notification_preferences = COALESCE($7, notification_preferences), quiet_hours_start = COALESCE($8, quiet_hours_start),
              quiet_hours_end = COALESCE($9, quiet_hours_end), updated_at = NOW()
       WHERE id = $10 RETURNING id, email, first_name, last_name, phone, role, designation, profile_image, language`,
      [first_name, last_name, phone, designation, profile_image, language, JSON.stringify(notification_preferences || {}), quiet_hours_start, quiet_hours_end, req.user.id]
    );
    res.json({ message: 'Profile updated', profile: result.rows[0] });
  } catch (err) { next(err); }
};

exports.registerDeviceToken = async (req, res, next) => {
  try {
    const { token, platform, device_info } = req.body;
    await db.query(
      `INSERT INTO device_tokens (user_id, token, platform, device_info) VALUES ($1, $2, $3, $4)
       ON CONFLICT (token) DO UPDATE SET user_id = $1, active = true, updated_at = NOW()`,
      [req.user.id, token, platform, JSON.stringify(device_info || {})]
    );
    res.json({ message: 'Device token registered' });
  } catch (err) { next(err); }
};

exports.deleteAccount = async (req, res, next) => {
  try {
    const { password } = req.body;
    const userResult = await db.query('SELECT password_hash FROM users WHERE id = $1', [req.user.id]);
    if (!userResult.rows[0].password_hash) {
      return res.status(400).json({ error: 'Cannot delete account' });
    }
    const isMatch = await bcrypt.compare(password, userResult.rows[0].password_hash);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid password' });
    }
    await db.query('UPDATE users SET status = $1 WHERE id = $2', ['deleted', req.user.id]);
    res.json({ message: 'Account deletion requested. Your data will be removed within 30 days.' });
  } catch (err) { next(err); }
};

exports.getSubteams = async (req, res, next) => {
  try {
    const result = await db.query(
      `SELECT st.id, st.name, st.parent_team_id, st.created_at,
              (SELECT COUNT(*) FROM users WHERE subteam_id = st.id AND status = 'active') as member_count,
              (SELECT COUNT(*) FROM leads l JOIN users u ON l.assigned_to = u.id WHERE u.subteam_id = st.id) as lead_count
       FROM subteams st WHERE st.workspace_id = $1 ORDER BY st.name`,
      [req.workspaceId]
    );

    const teams = result.rows;
    const tree = teams.filter(t => !t.parent_team_id).map(t => ({
      ...t,
      children: teams.filter(c => c.parent_team_id === t.id),
    }));

    res.json({ subteams: tree, all: teams });
  } catch (err) { next(err); }
};

exports.createSubteam = async (req, res, next) => {
  try {
    const { name, parent_team_id } = req.body;
    if (!name) return res.status(400).json({ error: 'Subteam name required' });

    if (parent_team_id) {
      const parentResult = await db.query('SELECT id FROM subteams WHERE id = $1 AND workspace_id = $2', [parent_team_id, req.workspaceId]);
      if (parentResult.rows.length === 0) return res.status(404).json({ error: 'Parent team not found' });
    }

    const result = await db.query(
      'INSERT INTO subteams (workspace_id, name, parent_team_id) VALUES ($1, $2, $3) RETURNING *',
      [req.workspaceId, name, parent_team_id || null]
    );
    res.status(201).json({ subteam: result.rows[0] });
  } catch (err) { next(err); }
};

exports.assignToSubteam = async (req, res, next) => {
  try {
    const { user_id, subteam_id } = req.body;

    const userResult = await db.query('SELECT id FROM users WHERE id = $1 AND workspace_id = $2', [user_id, req.workspaceId]);
    if (userResult.rows.length === 0) return res.status(404).json({ error: 'User not found' });

    if (subteam_id) {
      const teamResult = await db.query('SELECT id FROM subteams WHERE id = $1 AND workspace_id = $2', [subteam_id, req.workspaceId]);
      if (teamResult.rows.length === 0) return res.status(404).json({ error: 'Subteam not found' });
    }

    await db.query('UPDATE users SET subteam_id = $1 WHERE id = $2 AND workspace_id = $3', [subteam_id || null, user_id, req.workspaceId]);
    res.json({ message: 'User assigned to subteam' });
  } catch (err) { next(err); }
};

exports.getSubteamMembers = async (req, res, next) => {
  try {
    const { subteam_id } = req.params;
    const result = await db.query(
      `SELECT u.id, u.email, u.first_name, u.last_name, u.role, u.status, u.designation,
              (SELECT COUNT(*) FROM leads WHERE assigned_to = u.id) as lead_count,
              (SELECT COUNT(*) FROM leads WHERE assigned_to = u.id AND stage = 'won') as won_count
       FROM users u WHERE u.workspace_id = $1 AND u.subteam_id = $2 AND u.status != 'deleted'
       ORDER BY u.first_name`,
      [req.workspaceId, subteam_id]
    );
    res.json({ members: result.rows });
  } catch (err) { next(err); }
};
