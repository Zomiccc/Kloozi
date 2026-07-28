const db = require('../config/database');

exports.getDashboard = async (req, res, next) => {
  try {
    const wsId = req.workspaceId;

    const leadsRes = await db.query('SELECT * FROM leads WHERE workspace_id = $1', [wsId]);
    const leads = leadsRes.rows || [];
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    const yesterday = new Date(now.getTime() - 86400000);
    const yesterdayStr = yesterday.toISOString().split('T')[0];
    const sevenDaysAgo = new Date(now.getTime() - 7 * 86400000);

    const stats = {
      total: leads.length,
      today: leads.filter(l => l.created_at && l.created_at.split('T')[0] === todayStr).length,
      yesterday: leads.filter(l => l.created_at && l.created_at.split('T')[0] === yesterdayStr).length,
      won: leads.filter(l => l.stage === 'won').length,
      lost: leads.filter(l => l.stage === 'lost').length,
      new: leads.filter(l => l.stage === 'new').length,
      contacted: leads.filter(l => l.stage === 'contacted').length,
      interested: leads.filter(l => l.stage === 'interested').length,
      negotiating: leads.filter(l => l.stage === 'negotiating').length,
    };

    const sourceMap = {};
    leads.forEach(l => {
      const src = l.lead_source || 'unknown';
      sourceMap[src] = (sourceMap[src] || 0) + 1;
    });
    const leadsBySource = Object.entries(sourceMap).map(([lead_source, count]) => ({ lead_source, count })).sort((a, b) => b.count - a.count);

    const cityMap = {};
    leads.forEach(l => {
      if (l.city) {
        cityMap[l.city] = (cityMap[l.city] || 0) + 1;
      }
    });
    const leadsByCity = Object.entries(cityMap).map(([city, count]) => ({ city, count })).sort((a, b) => b.count - a.count).slice(0, 10);

    const usersRes = await db.query('SELECT * FROM users WHERE workspace_id = $1', [wsId]);
    const users = usersRes.rows || [];
    const agentMap = {};
    users.forEach(u => {
      agentMap[u.id] = { id: u.id, first_name: u.first_name, last_name: u.last_name, lead_count: 0, won_count: 0 };
    });
    leads.forEach(l => {
      if (l.assigned_to && agentMap[l.assigned_to]) {
        agentMap[l.assigned_to].lead_count++;
        if (l.stage === 'won') agentMap[l.assigned_to].won_count++;
      }
    });
    const leadsByAgent = Object.values(agentMap).sort((a, b) => b.lead_count - a.lead_count);

    const totalClosed = stats.won + stats.lost;
    const conversionRate = totalClosed > 0 ? ((stats.won / totalClosed) * 100).toFixed(1) : '0.0';

    const stuckLeads = leads.filter(l => {
      if (l.stage === 'won' || l.stage === 'lost') return false;
      if (!l.last_activity_at) return true;
      return new Date(l.last_activity_at) < sevenDaysAgo;
    }).length;

    let callsToday = 0;
    try {
      const callsRes = await db.query('SELECT * FROM calls WHERE workspace_id = $1', [wsId]);
      callsToday = (callsRes.rows || []).filter(c => c.created_at && c.created_at.split('T')[0] === todayStr).length;
    } catch {}

    let followUpsToday = { total: 0, completed: 0 };
    try {
      const fuRes = await db.query('SELECT * FROM follow_ups WHERE workspace_id = $1', [wsId]);
      const fus = (fuRes.rows || []).filter(f => f.due_date && f.due_date.split('T')[0] === todayStr);
      followUpsToday = { total: fus.length, completed: fus.filter(f => f.status === 'completed').length };
    } catch {}

    let emailsToday = 0;
    try {
      const emRes = await db.query('SELECT * FROM emails WHERE workspace_id = $1', [wsId]);
      emailsToday = (emRes.rows || []).filter(e => e.sent_at && e.sent_at.split('T')[0] === todayStr).length;
    } catch {}

    const thirtyDaysAgo = new Date(now.getTime() - 30 * 86400000);
    const trendMap = {};
    leads.filter(l => l.created_at && new Date(l.created_at) > thirtyDaysAgo).forEach(l => {
      const d = l.created_at.split('T')[0];
      trendMap[d] = (trendMap[d] || 0) + 1;
    });
    const leadTrend = Object.entries(trendMap).map(([date, count]) => ({ date, count })).sort((a, b) => a.date.localeCompare(b.date));

    res.json({
      leadStats: {
        totalLeads: stats.total,
        leadsToday: stats.today,
        leadsYesterday: stats.yesterday,
        won: stats.won,
        lost: stats.lost,
        newLeads: stats.new,
        contacted: stats.contacted,
        interested: stats.interested,
        negotiating: stats.negotiating,
      },
      leadsBySource,
      leadsByCity,
      leadsByAgent,
      conversionRate,
      stuckLeads,
      callsToday,
      followUpsToday,
      emailsToday,
      leadTrend,
    });
  } catch (err) { next(err); }
};

exports.getLeadAnalytics = async (req, res, next) => {
  try {
    const wsId = req.workspaceId;
    const leadsRes = await db.query('SELECT * FROM leads WHERE workspace_id = $1', [wsId]);
    const leads = leadsRes.rows || [];

    const sourceMap = {};
    leads.forEach(l => { const s = l.lead_source || 'unknown'; sourceMap[s] = (sourceMap[s] || 0) + 1; });
    const bySource = Object.entries(sourceMap).map(([lead_source, count]) => ({ lead_source, count })).sort((a, b) => b.count - a.count);

    const cityMap = {};
    leads.forEach(l => { if (l.city) { cityMap[l.city] = (cityMap[l.city] || 0) + 1; } });
    const byCity = Object.entries(cityMap).map(([city, count]) => ({ city, count })).sort((a, b) => b.count - a.count);

    const budgetMap = { '0-10k': 0, '10k-50k': 0, '50k-100k': 0, '100k+': 0 };
    leads.forEach(l => {
      const b = Number(l.budget);
      if (!b) return;
      if (b < 10000) budgetMap['0-10k']++;
      else if (b < 50000) budgetMap['10k-50k']++;
      else if (b < 100000) budgetMap['50k-100k']++;
      else budgetMap['100k+']++;
    });
    const byBudget = Object.entries(budgetMap).map(([range, count]) => ({ range, count }));

    const usersRes = await db.query('SELECT * FROM users WHERE workspace_id = $1', [wsId]);
    const agentMap = {};
    (usersRes.rows || []).forEach(u => { agentMap[u.id] = { first_name: u.first_name, last_name: u.last_name, count: 0 }; });
    leads.forEach(l => { if (l.assigned_to && agentMap[l.assigned_to]) agentMap[l.assigned_to].count++; });
    const byAgent = Object.values(agentMap).sort((a, b) => b.count - a.count);

    const trendMap = {};
    leads.forEach(l => { if (l.created_at) { const d = l.created_at.split('T')[0]; trendMap[d] = (trendMap[d] || 0) + 1; } });
    const trend = Object.entries(trendMap).map(([date, count]) => ({ date, count })).sort((a, b) => a.date.localeCompare(b.date));

    res.json({ bySource, byCity, byBudget, byAgent, trend });
  } catch (err) { next(err); }
};

exports.getConversionAnalytics = async (req, res, next) => {
  try {
    const wsId = req.workspaceId;
    const leadsRes = await db.query('SELECT * FROM leads WHERE workspace_id = $1', [wsId]);
    const leads = leadsRes.rows || [];
    const usersRes = await db.query('SELECT * FROM users WHERE workspace_id = $1', [wsId]);
    const users = usersRes.rows || [];

    const srcMap = {};
    leads.forEach(l => {
      const s = l.lead_source || 'unknown';
      if (!srcMap[s]) srcMap[s] = { won: 0, lost: 0, total: 0 };
      srcMap[s].total++;
      if (l.stage === 'won') srcMap[s].won++;
      if (l.stage === 'lost') srcMap[s].lost++;
    });
    const bySource = Object.entries(srcMap).map(([lead_source, v]) => ({
      lead_source, ...v,
      conversionRate: ((v.won / (v.total || 1)) * 100).toFixed(1)
    }));

    const agentMap = {};
    users.forEach(u => { agentMap[u.id] = { first_name: u.first_name, last_name: u.last_name, won: 0, lost: 0, total: 0 }; });
    leads.forEach(l => {
      if (l.assigned_to && agentMap[l.assigned_to]) {
        agentMap[l.assigned_to].total++;
        if (l.stage === 'won') agentMap[l.assigned_to].won++;
        if (l.stage === 'lost') agentMap[l.assigned_to].lost++;
      }
    });
    const byAgent = Object.values(agentMap).map(v => ({
      ...v, conversionRate: ((v.won / (v.total || 1)) * 100).toFixed(1)
    }));

    const wonLeads = leads.filter(l => l.stage === 'won');
    let avgDays = 0;
    if (wonLeads.length > 0) {
      const totalDays = wonLeads.reduce((sum, l) => {
        if (l.created_at && l.updated_at) {
          return sum + (new Date(l.updated_at) - new Date(l.created_at)) / 86400000;
        }
        return sum;
      }, 0);
      avgDays = (totalDays / wonLeads.length).toFixed(1);
    }

    res.json({ bySource, byAgent, avgTimeToClose: parseFloat(avgDays) });
  } catch (err) { next(err); }
};

exports.getPipelineAnalytics = async (req, res, next) => {
  try {
    const wsId = req.workspaceId;
    const stagesRes = await db.query('SELECT * FROM lead_stages WHERE workspace_id = $1', [wsId]);
    const stages = stagesRes.rows || [];
    const leadsRes = await db.query('SELECT * FROM leads WHERE workspace_id = $1', [wsId]);
    const leads = leadsRes.rows || [];
    const sevenDaysAgo = new Date(Date.now() - 7 * 86400000);

    const stageData = stages.map(s => ({
      name: s.name, color: s.color,
      count: leads.filter(l => l.stage_id === s.id).length
    }));

    let movedThisWeek = 0;
    try {
      const actRes = await db.query('SELECT * FROM lead_activities WHERE workspace_id = $1', [wsId]);
      movedThisWeek = (actRes.rows || []).filter(a => a.type === 'stage_change' && a.created_at && new Date(a.created_at) > sevenDaysAgo).length;
    } catch {}

    const stuckLeads = leads.filter(l => {
      if (l.stage === 'won' || l.stage === 'lost') return false;
      if (!l.last_activity_at) return true;
      return new Date(l.last_activity_at) < sevenDaysAgo;
    }).length;

    res.json({ stages: stageData, movedThisWeek, stuckLeads });
  } catch (err) { next(err); }
};

exports.getAgentPerformance = async (req, res, next) => {
  try {
    const wsId = req.workspaceId;
    const usersRes = await db.query('SELECT * FROM users WHERE workspace_id = $1', [wsId]);
    const users = usersRes.rows || [];
    const leadsRes = await db.query('SELECT * FROM leads WHERE workspace_id = $1', [wsId]);
    const leads = leadsRes.rows || [];

    let calls = [], emails = [], whatsapp = [], sms = [];
    try { calls = (await db.query('SELECT * FROM calls WHERE workspace_id = $1', [wsId])).rows || []; } catch {}
    try { emails = (await db.query('SELECT * FROM emails WHERE workspace_id = $1', [wsId])).rows || []; } catch {}
    try { whatsapp = (await db.query('SELECT * FROM whatsapp_messages WHERE workspace_id = $1', [wsId])).rows || []; } catch {}
    try { sms = (await db.query('SELECT * FROM sms_messages WHERE workspace_id = $1', [wsId])).rows || []; } catch {}

    const agents = users.map(u => {
      const userLeads = leads.filter(l => l.assigned_to === u.id);
      return {
        id: u.id,
        first_name: u.first_name,
        last_name: u.last_name,
        calls: calls.filter(c => c.user_id === u.id).length,
        emails: emails.filter(e => e.user_id === u.id).length,
        whatsapp: whatsapp.filter(w => w.user_id === u.id).length,
        sms: sms.filter(s => s.user_id === u.id).length,
        won: userLeads.filter(l => l.stage === 'won').length,
        lost: userLeads.filter(l => l.stage === 'lost').length,
        total_leads: userLeads.length,
      };
    }).sort((a, b) => b.total_leads - a.total_leads);

    res.json({ agents });
  } catch (err) { next(err); }
};

exports.getAIInsight = async (req, res, next) => {
  try {
    const wsId = req.workspaceId;
    const leadsRes = await db.query('SELECT * FROM leads WHERE workspace_id = $1', [wsId]);
    const leads = leadsRes.rows || [];
    const todayStr = new Date().toISOString().split('T')[0];
    const yesterdayStr = new Date(Date.now() - 86400000).toISOString().split('T')[0];

    const totalLeads = leads.length;
    const newLeads = leads.filter(l => l.stage === 'new').length;
    const wonLeads = leads.filter(l => l.stage === 'won').length;
    const lostLeads = leads.filter(l => l.stage === 'lost').length;
    const leadsToday = leads.filter(l => l.created_at && l.created_at.split('T')[0] === todayStr).length;
    const leadsYesterday = leads.filter(l => l.created_at && l.created_at.split('T')[0] === yesterdayStr).length;
    const stuckLeads = leads.filter(l => {
      if (l.stage === 'won' || l.stage === 'lost') return false;
      if (!l.last_activity_at) return true;
      return new Date(l.last_activity_at) < new Date(Date.now() - 7 * 86400000);
    }).length;

    const sourceMap = {};
    leads.forEach(l => { const s = l.lead_source || 'unknown'; sourceMap[s] = (sourceMap[s] || 0) + 1; });
    const topSource = Object.entries(sourceMap).sort((a, b) => b[1] - a[1])[0];

    const totalClosed = wonLeads + lostLeads;
    const conversionRate = totalClosed > 0 ? ((wonLeads / totalClosed) * 100).toFixed(1) : '0.0';

    const insights = [];

    if (stuckLeads > 0) {
      insights.push({
        type: 'warning',
        title: 'Stuck Leads Need Attention',
        text: `${stuckLeads} leads have been stuck for 7+ days with no activity. Consider launching a re-engagement campaign or assigning follow-up tasks.`,
      });
    }

    if (leadsToday > 0 && leadsYesterday > 0) {
      const change = ((leadsToday - leadsYesterday) / leadsYesterday * 100).toFixed(0);
      if (change > 0) {
        insights.push({
          type: 'positive',
          title: 'Lead Intake Rising',
          text: `Lead intake is up ${change}% compared to yesterday. Keep the momentum going by increasing ad spend on top sources.`,
        });
      } else {
        insights.push({
          type: 'warning',
          title: 'Lead Intake Declining',
          text: `Lead intake is down ${Math.abs(change)}% compared to yesterday. Review your ad campaigns and lead sources.`,
        });
      }
    }

    if (topSource) {
      insights.push({
        type: 'info',
        title: 'Top Performing Source',
        text: `${topSource[0]} is your top lead source with ${topSource[1]} leads (${((topSource[1] / totalLeads) * 100).toFixed(0)}% of total).`,
      });
    }

    if (conversionRate > 0) {
      insights.push({
        type: conversionRate > 20 ? 'positive' : 'info',
        title: 'Conversion Rate',
        text: `Your conversion rate is ${conversionRate}%. ${conversionRate > 20 ? 'Great performance!' : 'There\'s room for improvement — focus on lead quality and follow-up speed.'}`,
      });
    }

    if (newLeads > totalLeads * 0.3) {
      insights.push({
        type: 'warning',
        title: 'Many New Leads Uncontacted',
        text: `${newLeads} leads (${((newLeads / totalLeads) * 100).toFixed(0)}%) are still in "New" stage. Contact them promptly before they go cold.`,
      });
    }

    if (insights.length === 0) {
      insights.push({
        type: 'info',
        title: 'Get Started',
        text: 'Start adding leads to see AI-powered insights about your sales pipeline.',
      });
    }

    let aiPowered = false;
    try {
      const config = require('../config');
      if (config.openai.apiKey && totalLeads > 0) {
        const OpenAI = require('openai');
        const openai = new OpenAI({ apiKey: config.openai.apiKey });
        const completion = await openai.chat.completions.create({
          model: 'gpt-4o',
          messages: [
            { role: 'system', content: 'You are a sales analytics expert. Given lead data, provide 3 actionable insights as JSON array with "type" (positive/warning/info), "title", and "text" fields.' },
            { role: 'user', content: `Total leads: ${totalLeads}, New: ${newLeads}, Won: ${wonLeads}, Lost: ${lostLeads}, Today: ${leadsToday}, Yesterday: ${leadsYesterday}, Stuck: ${stuckLeads}, Top source: ${topSource ? topSource[0] : 'N/A'}, Conversion: ${conversionRate}%` },
          ],
          temperature: 0.7,
        });
        const parsed = JSON.parse(completion.choices[0].message.content);
        if (Array.isArray(parsed) && parsed.length > 0) {
          aiPowered = true;
          return res.json({ insights: parsed, aiPowered });
        }
      }
    } catch (e) {
      // Fall back to rule-based insights
    }

    res.json({ insights, aiPowered: false });
  } catch (err) { next(err); }
};

exports.getTeamStats = async (req, res, next) => {
  try {
    const wsId = req.workspaceId;
    const leadsRes = await db.query('SELECT * FROM leads WHERE workspace_id = $1', [wsId]);
    const leads = leadsRes.rows || [];
    const usersRes = await db.query('SELECT * FROM users WHERE workspace_id = $1', [wsId]);
    const users = usersRes.rows || [];
    const todayStr = new Date().toISOString().split('T')[0];

    let callsToday = 0, totalMessages = 0;
    try {
      const callsRes = await db.query('SELECT * FROM calls WHERE workspace_id = $1', [wsId]);
      callsToday = (callsRes.rows || []).filter(c => c.created_at && c.created_at.split('T')[0] === todayStr).length;
    } catch {}
    try {
      const waRes = await db.query('SELECT * FROM whatsapp_messages WHERE workspace_id = $1', [wsId]);
      totalMessages += (waRes.rows || []).length;
    } catch {}
    try {
      const smsRes = await db.query('SELECT * FROM sms_messages WHERE workspace_id = $1', [wsId]);
      totalMessages += (smsRes.rows || []).length;
    } catch {}

    res.json({
      totalLeads: leads.length,
      newLeads: leads.filter(l => l.stage === 'new').length,
      wonLeads: leads.filter(l => l.stage === 'won').length,
      totalCalls: callsToday,
      totalMessages,
      activeAgents: users.filter(u => u.status === 'active').length,
    });
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

exports.getWorkspaceSettings = async (req, res, next) => {
  try {
    const wsRes = await db.query('SELECT settings FROM workspaces WHERE id = $1', [req.workspaceId]);
    const settings = wsRes.rows[0]?.settings || {};
    res.json({ settings });
  } catch (err) { next(err); }
};

exports.updateWorkspaceSettings = async (req, res, next) => {
  try {
    const wsRes = await db.query('SELECT settings FROM workspaces WHERE id = $1', [req.workspaceId]);
    const current = wsRes.rows[0]?.settings || {};
    const updated = { ...current, ...req.body };
    await db.query('UPDATE workspaces SET settings = $1, updated_at = NOW() WHERE id = $2', [JSON.stringify(updated), req.workspaceId]);
    res.json({ settings: updated });
  } catch (err) { next(err); }
};
