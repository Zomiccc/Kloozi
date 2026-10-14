const db = require('../config/database');

/**
 * Everything a message template can reference about a lead: the lead, its
 * assigned agent and the workspace. Used by every sender (email, WhatsApp,
 * SMS, flows, sequences, rules, chat assistant) so {{Agent_Name}},
 * {{Company_Name}}, {{Custom_Field_X}} and friends work everywhere.
 */
async function loadLeadVariables(workspaceId, leadId) {
  const r = await db.query(
    `SELECT l.*, u.first_name AS agent_first_name, u.last_name AS agent_last_name,
            u.phone AS agent_phone, u.email AS agent_email, u.designation AS agent_designation,
            w.name AS workspace_name, w.settings AS workspace_settings
     FROM leads l
     LEFT JOIN users u ON u.id = l.assigned_to
     LEFT JOIN workspaces w ON w.id = l.workspace_id
     WHERE l.id = $1 AND l.workspace_id = $2`,
    [leadId, workspaceId]
  );
  const lead = r.rows[0];
  if (!lead) return null;
  const settings = typeof lead.workspace_settings === 'string'
    ? JSON.parse(lead.workspace_settings || '{}') : (lead.workspace_settings || {});
  const daysSince = lead.created_at ? Math.floor((Date.now() - new Date(lead.created_at).getTime()) / 86400000) : '';
  return {
    first_name: lead.first_name || '',
    last_name: lead.last_name || '',
    phone: lead.phone || '',
    email: lead.email || '',
    city: lead.city || '',
    budget: lead.budget ?? '',
    lead_source: String(lead.lead_source || '').replace(/_/g, ' '),
    agent_name: [lead.agent_first_name, lead.agent_last_name].filter(Boolean).join(' '),
    agent_phone: lead.agent_phone || '',
    agent_email: lead.agent_email || '',
    designation: lead.agent_designation || '',
    company_name: settings.company_name || lead.workspace_name || '',
    brochure_link: settings.brochure_link || '',
    days_since_inquiry: daysSince,
    custom_fields: Array.isArray(lead.custom_fields) ? lead.custom_fields : [],
  };
}

module.exports = { loadLeadVariables };
