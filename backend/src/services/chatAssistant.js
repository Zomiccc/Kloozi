const crypto = require('crypto');
const db = require('../config/database');
const logger = require('../utils/logger');
const config = require('../config');
const { logActivity } = require('../utils/activityLog');
const { replaceVariables } = require('../utils/variables');

// ─── WhatsApp chat assistant ────────────────────────────────────────────────
// Rules: IF <trigger> THEN <action>, checked against every inbound message.
//   triggers: contains (comma-separated keywords) | new_number | no_reply_5min
//   actions:  send_template (reply text) | send_file (content library file)
//             create_lead | assign_agent | add_tag | change_stage
// no_reply_5min is evaluated by the scheduler (processNoReplyRules).

const NO_REPLY_MINUTES = 5;

async function activeRules(workspaceId) {
  const r = await db.query(
    `SELECT * FROM whatsapp_chat_assistant_rules
     WHERE workspace_id = $1 AND COALESCE(is_active, is_enabled, true) = true
     ORDER BY priority ASC, created_at ASC`,
    [workspaceId]
  );
  return r.rows;
}

function triggerOf(rule) {
  return rule.trigger_condition || 'contains';
}

function keywordsOf(rule) {
  const fromValue = String(rule.trigger_value || '').split(',');
  let fromLegacy = rule.trigger_keywords;
  if (typeof fromLegacy === 'string') {
    try { fromLegacy = JSON.parse(fromLegacy); } catch { fromLegacy = []; }
  }
  return [...fromValue, ...(Array.isArray(fromLegacy) ? fromLegacy : [])]
    .map((k) => String(k).trim().toLowerCase())
    .filter(Boolean);
}

function textMatches(rule, text) {
  const body = String(text || '').toLowerCase();
  if (!body) return false;
  const keywords = keywordsOf(rule);
  if (keywords.length === 0) return false;
  return keywords.some((k) => body.includes(k));
}

async function sendFileToLead(workspaceId, lead, fileRef) {
  const r = await db.query(
    `SELECT * FROM content_files WHERE workspace_id = $1 AND (id::text = $2 OR LOWER(name) = LOWER($2))
     ORDER BY created_at DESC LIMIT 1`,
    [workspaceId, String(fileRef || '').trim()]
  );
  const file = r.rows[0];
  if (!file) return { ok: false, note: `file not found: ${fileRef}` };
  const trackingId = crypto.randomUUID();
  const url = `${config.apiUrl}/api/content/track/${trackingId}`;
  await db.query(
    'INSERT INTO content_tracking (workspace_id, file_id, lead_id, tracking_id) VALUES ($1,$2,$3,$4)',
    [workspaceId, file.id, lead.id, trackingId]
  );
  const { sendWhatsAppToLead } = require('./whatsappService');
  const sent = await sendWhatsAppToLead({ workspaceId, leadId: lead.id, userId: null, message: `${file.name}: ${url}` });
  await logActivity(workspaceId, lead.id, null, 'file_sent', `File sent by chat assistant: ${file.name}`, { file_id: file.id, tracking_id: trackingId, channel: 'whatsapp' });
  return { ok: !!sent.success, note: sent.error };
}

/**
 * Run one rule's action. `lead` may be null when the sender is not a lead yet
 * (only create_lead can act then). Returns the (possibly new) lead.
 */
async function executeAction(workspaceId, rule, lead, { fromPhone, text, contactName }) {
  const pipeline = require('./leadPipeline');
  const value = rule.action_value || rule.response_message || '';

  if (rule.action_type === 'create_lead') {
    if (lead) return { lead, note: 'already a lead' };
    const created = await pipeline.createLead(workspaceId, {
      first_name: contactName?.first_name || null, last_name: contactName?.last_name || null,
      phone: `+${String(fromPhone).replace(/\D/g, '')}`, lead_source: 'whatsapp',
      notes: `First WhatsApp message: "${text}"`, stage: value || undefined,
    }, { source: 'whatsapp', duplicateMode: 'skip', activityText: `Lead created by chat assistant rule "${rule.name}"` });
    return { lead: created.lead || null };
  }
  if (!lead) return { lead, note: 'sender is not a lead' };

  switch (rule.action_type) {
    case 'send_template': {
      if (!value) return { lead, note: 'empty reply' };
      const message = replaceVariables(value, {
        first_name: lead.first_name || '', last_name: lead.last_name || '', phone: lead.phone || '', city: lead.city || '',
      });
      const { sendWhatsAppToLead } = require('./whatsappService');
      const sent = await sendWhatsAppToLead({ workspaceId, leadId: lead.id, userId: null, message });
      return { lead, note: sent.success ? undefined : sent.error };
    }
    case 'send_file': {
      const r = await sendFileToLead(workspaceId, lead, value);
      return { lead, note: r.note };
    }
    case 'assign_agent': {
      const user = await pipeline.resolveUser(workspaceId, value);
      if (!user) return { lead, note: `agent not found: ${value}` };
      return { lead: await pipeline.assignLead(workspaceId, lead, user.id, 'chat assistant') };
    }
    case 'add_tag':
      return { lead: await pipeline.addTag(workspaceId, lead, value) };
    case 'change_stage':
      return { lead: await pipeline.changeStage(workspaceId, lead, value, null, 'chat assistant') };
    default:
      return { lead, note: `unknown action ${rule.action_type}` };
  }
}

async function logRun(workspaceId, lead, rule, extra = {}) {
  if (!lead) return;
  await logActivity(workspaceId, lead.id, null, 'chat_assistant', `Chat assistant rule fired: ${rule.name}`, {
    rule_id: rule.id, action: rule.action_type, ...extra,
  });
}

/** Called for every inbound WhatsApp message. Returns the lead (created if a rule did so). */
async function runChatAssistant(workspaceId, lead, { text, fromPhone, isNewContact, contactName, messageId }) {
  let current = lead;
  try {
    const rules = await activeRules(workspaceId);
    for (const rule of rules) {
      const trigger = triggerOf(rule);
      const fires = (trigger === 'contains' && textMatches(rule, text))
        || (trigger === 'new_number' && isNewContact);
      if (!fires) continue;
      try {
        const r = await executeAction(workspaceId, rule, current, { fromPhone, text, contactName });
        current = r.lead || current;
        await logRun(workspaceId, current, rule, { message_id: messageId, note: r.note });
      } catch (err) {
        logger.error(`Chat assistant rule "${rule.name}" failed:`, err.message);
      }
    }
  } catch (err) {
    logger.error('Chat assistant error:', err.message);
  }
  return current;
}

/** Scheduler: fire no_reply_5min rules for leads whose last message is an unanswered inbound one. */
async function processNoReplyRules() {
  const rules = await db.query(
    `SELECT * FROM whatsapp_chat_assistant_rules
     WHERE trigger_condition = 'no_reply_5min' AND COALESCE(is_active, is_enabled, true) = true`
  );
  for (const rule of rules.rows) {
    const due = await db.query(
      `SELECT DISTINCT ON (m.lead_id) m.id AS message_id, m.lead_id, m.created_at, m.direction
       FROM whatsapp_messages m
       WHERE m.workspace_id = $1 AND m.lead_id IS NOT NULL AND m.created_at > NOW() - INTERVAL '2 hours'
       ORDER BY m.lead_id, m.created_at DESC`,
      [rule.workspace_id]
    );
    for (const row of due.rows) {
      if (row.direction !== 'inbound') continue;
      if (new Date(row.created_at) > new Date(Date.now() - NO_REPLY_MINUTES * 60000)) continue;
      const already = await db.query(
        `SELECT 1 FROM lead_activities WHERE lead_id = $1 AND type = 'chat_assistant'
           AND metadata->>'rule_id' = $2 AND metadata->>'message_id' = $3 LIMIT 1`,
        [row.lead_id, rule.id, String(row.message_id)]
      );
      if (already.rows.length) continue;
      const lead = (await db.query('SELECT * FROM leads WHERE id = $1', [row.lead_id])).rows[0];
      if (!lead) continue;
      try {
        const r = await executeAction(rule.workspace_id, rule, lead, { fromPhone: lead.phone, text: '' });
        await logRun(rule.workspace_id, r.lead || lead, rule, { message_id: String(row.message_id), note: r.note });
      } catch (err) {
        logger.error(`No-reply rule "${rule.name}" failed:`, err.message);
      }
    }
  }
}

module.exports = { runChatAssistant, processNoReplyRules };
