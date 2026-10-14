const config = require('../config');
const axios = require('axios');
const db = require('../config/database');
const logger = require('../utils/logger');
const twilio = require('twilio');

// MESSAGING_DRY_RUN=true: everything is processed and recorded exactly as normal, but
// nothing leaves the server (used for automated tests and staging).
const DRY_RUN = () => process.env.MESSAGING_DRY_RUN === 'true';

async function sendWhatsAppMessage({ to, message, templateName, mediaUrl, media_type, workspaceId }) {
  try {
    if (DRY_RUN() || await require('../utils/demo').isDemoWorkspace(workspaceId)) {
      logger.info(`[dry-run] WhatsApp to ${to}: ${String(message || templateName || '').slice(0, 80)}`);
      return { success: true, messageId: `dryrun-wa-${Date.now()}` };
    }
    // Use Twilio Sandbox mode
    if (config.whatsapp.mode === 'sandbox') {
      if (!config.twilio.accountSid || !config.twilio.authToken) {
        logger.warn('Twilio not configured, skipping send');
        return { success: false, error: 'Twilio not configured. Set TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN in .env' };
      }

      const client = twilio(config.twilio.accountSid, config.twilio.authToken);
      const fromNumber = config.twilio.whatsappFrom || 'whatsapp:+14155238886';
      
      // Format phone number for Twilio: whatsapp:+[country_code][number]
      const cleanPhone = to.replace(/\D/g, '');
      const toNumber = `whatsapp:+${cleanPhone}`;

      const messageParams = {
        from: fromNumber,
        to: toNumber,
        body: message,
      };

      const response = await client.messages.create(messageParams);
      return { success: true, messageId: response.sid };
    }

    // Use Meta API for production mode
    // The workspace's own number when it connected one, else Flazyn's platform number.
    const creds = await require('./whatsappConnection').credentialsFor(workspaceId);
    if (!creds.phoneNumberId || !creds.accessToken) {
      logger.warn('WhatsApp not configured, skipping send');
      return { success: false, error: 'WhatsApp is not connected. Connect it in Settings → WhatsApp.' };
    }

    const phoneNumber = to.replace(/\D/g, '');
    const url = `${config.whatsapp.apiUrl}/${creds.phoneNumberId}/messages`;

    const body = {
      messaging_product: 'whatsapp',
      to: phoneNumber,
      type: 'text',
      text: { body: message },
    };

    if (mediaUrl && media_type) {
      body.type = media_type;
      body[media_type] = { link: mediaUrl };
    }

    if (templateName) {
      body.type = 'template';
      body.template = { name: templateName, language: { code: 'en' } };
    }

    const response = await axios.post(url, body, {
      headers: {
        Authorization: `Bearer ${creds.accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    return { success: true, messageId: response.data.messages?.[0]?.id };
  } catch (err) {
    const apiError = err.response?.data?.error || err.message;
    const errorMsg = apiError ? `${apiError.message || apiError.type || 'WhatsApp API error'} (code ${apiError.code || 'unknown'})` : err.message;
    console.error('[WHATSAPP ERROR]', JSON.stringify({
      status: err.response?.status,
      statusText: err.response?.statusText,
      error: err.message,
      apiError: apiError || err.response?.data,
    }, null, 2));
    return { success: false, error: errorMsg };
  }
}

async function sendWhatsAppToLead({ workspaceId, leadId, userId, message, templateId, mediaUrl, mediaType }) {
  try {
    const leadResult = await db.query('SELECT * FROM leads WHERE id = $1 AND workspace_id = $2', [leadId, workspaceId]);
    if (leadResult.rows.length === 0) {
      return { success: false, error: 'Lead not found' };
    }

    const lead = leadResult.rows[0];
    if (!lead.phone) {
      return { success: false, error: 'Lead has no phone number' };
    }

    let templateName = null;
    let messageText = message;

    if (templateId) {
      const tplResult = await db.query('SELECT * FROM whatsapp_templates WHERE id = $1 AND workspace_id = $2', [templateId, workspaceId]);
      if (tplResult.rows.length > 0) {
        messageText = tplResult.rows[0].content;
        templateName = tplResult.rows[0].name;
      }
    }
    // Fill {{First_Name}}, {{Agent_Name}}, … in every message — templates and free text alike.
    if (messageText) {
      const { replaceVariables } = require('../utils/variables');
      const { loadLeadVariables } = require('../utils/leadVariables');
      messageText = replaceVariables(messageText, (await loadLeadVariables(workspaceId, leadId)) || {});
    }

    const result = await sendWhatsAppMessage({
      workspaceId,
      to: lead.phone,
      message: messageText,
      templateName,
      mediaUrl,
      media_type: mediaType,
    });

    const msgInsert = await db.query(
      `INSERT INTO whatsapp_messages (workspace_id, lead_id, user_id, direction, message_text, template_name, media_url, media_type, status, wa_message_id, sent_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW()) RETURNING id`,
      [workspaceId, leadId, userId, 'outbound', messageText, templateName, mediaUrl, mediaType,
       result.success ? 'sent' : 'failed', result.messageId || null]
    );

    if (result.success) {
      await db.query(
        `INSERT INTO lead_activities (workspace_id, lead_id, user_id, type, description, metadata)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [workspaceId, leadId, userId, 'whatsapp_sent', `WhatsApp message sent`, JSON.stringify({ message_id: msgInsert.rows[0].id })]
      );
    }

    return { success: result.success, messageId: msgInsert.rows[0].id, error: result.error };
  } catch (err) {
    logger.error('WhatsApp to lead error:', err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Twilio (sandbox) posts form fields { From: 'whatsapp:+92…', Body, MessageSid, ProfileName, To }.
 * Convert that into the Meta Cloud API shape so one handler serves both.
 */
function normalizeInboundPayload(payload) {
  if (payload && payload.object) return payload;
  if (payload && typeof payload.From === 'string' && payload.From.startsWith('whatsapp:') && payload.Body !== undefined) {
    const profile = String(payload.ProfileName || '').trim().split(/\s+/);
    return {
      object: 'whatsapp_business_account',
      entry: [{
        changes: [{
          value: {
            metadata: { display_phone_number: String(payload.To || '').replace(/\D/g, '') },
            contacts: payload.ProfileName ? [{ profile: { name: payload.ProfileName }, name: { first_name: profile[0], last_name: profile.slice(1).join(' ') } }] : [],
            messages: [{ from: payload.From.replace(/\D/g, ''), id: payload.MessageSid, text: { body: payload.Body } }],
          },
        }],
      }],
    };
  }
  return null;
}

/**
 * Which workspace owns this inbound message? Matched on the receiving
 * WhatsApp number; falls back to the only workspace when there is just one.
 */
async function resolveInboundWorkspace(metadata, fromPhone = null) {
  const phoneNumberId = metadata?.phone_number_id ? String(metadata.phone_number_id) : null;
  const display = String(metadata?.display_phone_number || '').replace(/\D/g, '');
  // Flazyn's shared number serves many workspaces: route by who has been talking to this person.
  if (fromPhone && (!phoneNumberId || phoneNumberId === String(config.whatsapp.phoneNumberId || ''))) {
    const shared = await require('./whatsappConnection').sharedNumberWorkspace(fromPhone);
    if (shared) return shared;
  }
  // A workspace's own number (exact phone number ID first, display number as a fallback).
  const r = await db.query(
    `SELECT id FROM workspaces
     WHERE ($1::text IS NOT NULL AND settings->>'whatsapp_phone_number_id' = $1)
        OR ($2 <> '' AND COALESCE(settings->>'whatsapp_connection', '') <> 'shared'
            AND REGEXP_REPLACE(COALESCE(settings->>'whatsapp_number', ''), '\\D', '', 'g') = $2)
     ORDER BY (settings->>'whatsapp_phone_number_id' = $1) DESC NULLS LAST
     LIMIT 1`,
    [phoneNumberId, display]
  );
  if (r.rows[0]) return r.rows[0].id;
  const all = await db.query('SELECT id FROM workspaces ORDER BY created_at ASC LIMIT 2');
  if (all.rows.length === 1) return all.rows[0].id;
  // Several workspaces share the platform number: use the one that connected WhatsApp.
  const connected = await db.query(
    "SELECT id FROM workspaces WHERE settings->>'whatsapp_connected' = 'true' ORDER BY updated_at DESC LIMIT 1"
  );
  return connected.rows[0]?.id || null;
}

async function recordInbound(workspaceId, leadId, fromPhone, text, waMessageId) {
  const r = await db.query(
    `INSERT INTO whatsapp_messages (workspace_id, lead_id, phone, direction, message_text, status, wa_message_id, sent_at)
     VALUES ($1, $2, $3, 'inbound', $4, 'delivered', $5, NOW()) RETURNING id`,
    [workspaceId, leadId, `+${fromPhone}`, text, waMessageId || null]
  );
  return r.rows[0].id;
}

async function handleWhatsAppWebhook(rawPayload) {
  try {
    const payload = normalizeInboundPayload(rawPayload);
    if (!payload) return { success: true, ignored: true };

    for (const entry of payload.entry || []) {
      for (const change of entry.changes || []) {
        const value = change.value || {};
        for (const msg of value.messages || []) {
          await handleInboundMessage(msg, value);
        }
      }
    }
    return { success: true };
  } catch (err) {
    logger.error('WhatsApp webhook error:', err.message);
    return { success: false, error: err.message };
  }
}

async function handleInboundMessage(msg, value) {
  const fromPhone = String(msg.from || '').replace(/\D/g, '');
  if (!fromPhone) return;
  const text = msg.text?.body || msg.button?.text || msg.interactive?.button_reply?.title || '';
  const workspaceId = await resolveInboundWorkspace(value.metadata, fromPhone);
  if (!workspaceId) {
    logger.warn(`Inbound WhatsApp from +${fromPhone} could not be matched to a workspace`);
    return;
  }

  // Replays from Meta/Twilio must not double-log.
  if (msg.id) {
    const seen = await db.query('SELECT 1 FROM whatsapp_messages WHERE wa_message_id = $1 LIMIT 1', [msg.id]);
    if (seen.rows.length) return;
  }

  const contact = value.contacts?.[0] || {};
  const contactName = contact.name || (contact.profile?.name
    ? { first_name: contact.profile.name.split(' ')[0], last_name: contact.profile.name.split(' ').slice(1).join(' ') }
    : null);

  const leadResult = await db.query(
    `SELECT * FROM leads WHERE workspace_id = $1 AND RIGHT(REGEXP_REPLACE(COALESCE(phone,''), '\\D', '', 'g'), 10) = RIGHT($2, 10)
     ORDER BY created_at ASC LIMIT 1`,
    [workspaceId, fromPhone]
  );
  let lead = leadResult.rows[0] || null;
  const isNewContact = !lead;

  if (!lead) {
    const autoCreate = await db.query('SELECT * FROM whatsapp_auto_create_config WHERE workspace_id = $1', [workspaceId]);
    const cfg = autoCreate.rows[0];
    // No config row = default on; an explicit "off" leaves the number for manual import.
    if (!cfg || cfg.is_enabled) {
      const { createLead } = require('./leadPipeline');
      const created = await createLead(workspaceId, {
        first_name: contactName?.first_name || null, last_name: contactName?.last_name || null,
        phone: `+${fromPhone}`, lead_source: 'whatsapp', notes: text ? `First WhatsApp message: "${text}"` : null,
        stage: cfg?.default_stage || undefined, assigned_to: cfg?.auto_assign_to || undefined,
      }, { source: 'whatsapp', duplicateMode: 'skip', activityText: 'Lead created from incoming WhatsApp message' });
      lead = created.lead || null;
    }
  }

  const messageId = await recordInbound(workspaceId, lead?.id || null, fromPhone, text, msg.id);
  if (!lead) {
    const { runChatAssistant } = require('./chatAssistant');
    await runChatAssistant(workspaceId, null, { text, fromPhone, isNewContact, contactName, messageId });
    return;
  }

  await db.query(
    `INSERT INTO lead_activities (workspace_id, lead_id, type, description, metadata) VALUES ($1, $2, 'whatsapp_received', $3, $4)`,
    [workspaceId, lead.id, `WhatsApp message received: ${text}`, JSON.stringify({ from: `+${fromPhone}`, message_id: messageId })]
  );
  await db.query('UPDATE leads SET last_activity_at = NOW() WHERE id = $1', [lead.id]);

  if (!isNewContact && lead.assigned_to) {
    const { sendPushNotification } = require('../utils/notifications');
    await sendPushNotification(lead.assigned_to, 'WhatsApp reply', `${[lead.first_name, lead.last_name].filter(Boolean).join(' ') || `+${fromPhone}`}: ${text.slice(0, 80)}`, {
      type: 'whatsapp_reply', leadId: lead.id,
    });
  }
  const { emitToWorkspace } = require('../utils/realtime');
  emitToWorkspace(workspaceId, 'whatsapp:message', { leadId: lead.id, direction: 'inbound', text });

  require('./intelOps').onInboundMessage(workspaceId, lead, text).catch(() => {});

  if (!isNewContact) {
    const { stopSequenceOnReply } = require('../controllers/whatsappSequenceController');
    await stopSequenceOnReply(workspaceId, lead.id);
  }
  await sendAutoResponder(workspaceId, lead.id, fromPhone, { isNewContact });

  const { runChatAssistant } = require('./chatAssistant');
  lead = await runChatAssistant(workspaceId, lead, { text, fromPhone, isNewContact, contactName, messageId }) || lead;
  await processAIAgent(workspaceId, lead.id, fromPhone, text, messageId);
  const { updateLeadScore } = require('../utils/activityLog');
  await updateLeadScore(lead.id);
}

async function processAIAgent(workspaceId, leadId, fromPhone, messageText, inboundMessageId = null) {
  try {
    const configResult = await db.query(
      'SELECT * FROM whatsapp_ai_agent_config WHERE workspace_id = $1 AND is_enabled = true',
      [workspaceId]
    );
    if (configResult.rows.length === 0) return;
    const config = configResult.rows[0];
    const { extractLeadInfoFromMessage, generateAIReply } = require('./openaiService');

    // Fill in details the lead hasn't given yet. Existing values are never overwritten.
    const extractedInfo = await extractLeadInfoFromMessage(messageText, config.extract_fields, config.system_prompt);
    const lead = (await db.query('SELECT * FROM leads WHERE id = $1', [leadId])).rows[0];
    if (!lead) return;
    if (extractedInfo) {
      const sets = [];
      const vals = [];
      const add = (col, val) => { vals.push(val); sets.push(`${col} = $${vals.length}`); };
      if (extractedInfo.name && !lead.first_name) {
        const parts = String(extractedInfo.name).trim().split(/\s+/);
        add('first_name', parts[0]);
        if (parts.length > 1 && !lead.last_name) add('last_name', parts.slice(1).join(' '));
      }
      const budget = parseFloat(String(extractedInfo.budget ?? '').replace(/[^0-9.]/g, ''));
      if (Number.isFinite(budget) && budget > 0 && !lead.budget) add('budget', budget);
      if (extractedInfo.city && !lead.city) add('city', String(extractedInfo.city).slice(0, 100));
      if (extractedInfo.email && !lead.email && /\S+@\S+\.\S+/.test(extractedInfo.email)) add('email', String(extractedInfo.email).toLowerCase());
      const interest = extractedInfo.interest || extractedInfo.product;
      if (interest && !String(lead.notes || '').includes(String(interest))) {
        vals.push(`${lead.notes ? '\n' : ''}Interest (AI): ${interest}`);
        sets.push(`notes = COALESCE(notes, '') || $${vals.length}`);
      }
      if (sets.length) {
        vals.push(leadId);
        await db.query(`UPDATE leads SET ${sets.join(', ')}, updated_at = NOW() WHERE id = $${vals.length}`, vals);
        await db.query(
          `INSERT INTO lead_activities (workspace_id, lead_id, type, description, metadata) VALUES ($1, $2, 'ai_extracted', $3, $4)`,
          [workspaceId, leadId, 'AI agent updated lead details from WhatsApp', JSON.stringify({ ai_generated: true, extracted: extractedInfo })]
        );
      }
    }

    if (!config.auto_reply) return;
    // One reply per message: if the auto-responder or a chat-assistant rule already answered, stay quiet.
    if (inboundMessageId) {
      const answered = await db.query(
        `SELECT 1 FROM whatsapp_messages o, whatsapp_messages i
         WHERE i.id = $1 AND o.lead_id = $2 AND o.direction = 'outbound' AND o.created_at >= i.created_at LIMIT 1`,
        [inboundMessageId, leadId]
      );
      if (answered.rows.length) return;
    }
    const history = (await db.query(
      `SELECT direction, message_text AS text FROM whatsapp_messages WHERE lead_id = $1 ORDER BY created_at DESC LIMIT 10`,
      [leadId]
    )).rows.reverse();
    const aiReply = await generateAIReply(messageText, extractedInfo, config.system_prompt, history);
    if (!aiReply) return;
    const result = await sendWhatsAppMessage({ to: fromPhone, message: aiReply, workspaceId });
    await db.query(
      `INSERT INTO whatsapp_messages (workspace_id, lead_id, phone, direction, message_text, status, wa_message_id, sent_at)
       VALUES ($1, $2, $3, 'outbound', $4, $5, $6, NOW())`,
      [workspaceId, leadId, `+${String(fromPhone).replace(/\D/g, '')}`, aiReply, result.success ? 'sent' : 'failed', result.messageId || null]
    );
    await db.query(
      `INSERT INTO lead_activities (workspace_id, lead_id, type, description, metadata) VALUES ($1, $2, 'ai_reply_sent', $3, $4)`,
      [workspaceId, leadId, result.success ? `AI agent replied: ${aiReply}` : `AI agent reply failed: ${result.error}`, JSON.stringify({ ai_generated: true, success: result.success })]
    );
  } catch (err) {
    logger.error('AI Agent processing error:', err.message);
  }
}

const AUTO_REPLY_COOLDOWN_MINUTES = 60;

/** Day + minutes-past-midnight in a timezone (falls back to UTC on a bad zone name). */
function localClock(now, timeZone) {
  let parts;
  try {
    parts = new Intl.DateTimeFormat('en-US', { timeZone: timeZone || 'UTC', weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(now);
  } catch {
    parts = new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(now);
  }
  const get = (t) => parts.find((p) => p.type === t)?.value;
  return { day: String(get('weekday')).slice(0, 3).toLowerCase(), minutes: Number(get('hour')) * 60 + Number(get('minute')) };
}

function withinWorkingHours(ar, now = new Date()) {
  const days = Array.isArray(ar.working_days) ? ar.working_days : [];
  const clock = localClock(now, ar.timezone || process.env.DEFAULT_TIMEZONE || 'Australia/Sydney');
  if (!days.includes(clock.day)) return false;
  const minutes = clock.minutes;
  const toMin = (hhmm, dflt) => {
    const [h, m] = String(hhmm || dflt).split(':').map(Number);
    return (h || 0) * 60 + (m || 0);
  };
  return minutes >= toMin(ar.working_hours_start, '09:00') && minutes < toMin(ar.working_hours_end, '18:00');
}

/** Auto-responder configured on the WhatsApp page (stored in workspace settings). */
async function sendAutoResponder(workspaceId, leadId, fromPhone, { isNewContact = false } = {}) {
  try {
    const ws = await db.query('SELECT name, settings FROM workspaces WHERE id = $1', [workspaceId]);
    const raw = ws.rows[0]?.settings;
    const settings = typeof raw === 'string' ? JSON.parse(raw) : (raw || {});
    let ar = settings.whatsapp_auto_responder;
    if (!ar) {
      const legacy = await db.query('SELECT * FROM whatsapp_auto_responder WHERE workspace_id = $1 AND is_enabled = true LIMIT 1', [workspaceId]);
      if (legacy.rows[0]) ar = { is_enabled: true, trigger_type: 'new_contacts', message_template: legacy.rows[0].message_template || legacy.rows[0].response_message };
    }
    if (!ar || !ar.is_enabled || !ar.message_template) return;

    const trigger = ar.trigger_type || 'all';
    if ((trigger === 'new_contacts' || trigger === 'new_lead') && !isNewContact) return;
    if (trigger === 'outside_hours' && withinWorkingHours(ar)) return;

    // Never auto-reply in a loop with another bot.
    const recent = await db.query(
      `SELECT 1 FROM lead_activities WHERE lead_id = $1 AND type = 'whatsapp_sent'
         AND metadata->>'auto_responder' = 'true' AND created_at > NOW() - ($2 || ' minutes')::interval LIMIT 1`,
      [leadId, String(AUTO_REPLY_COOLDOWN_MINUTES)]
    );
    if (recent.rows.length) return;

    const { loadLeadVariables } = require('../utils/leadVariables');
    const vars = await loadLeadVariables(workspaceId, leadId);
    if (!vars) return;
    const { replaceVariables } = require('../utils/variables');
    const messageText = replaceVariables(ar.message_template, vars);

    const send = async () => {
      const result = await sendWhatsAppMessage({ to: fromPhone, message: messageText, workspaceId });
      await db.query(
        `INSERT INTO whatsapp_messages (workspace_id, lead_id, phone, direction, message_text, status, wa_message_id, sent_at)
         VALUES ($1, $2, $3, 'outbound', $4, $5, $6, NOW())`,
        [workspaceId, leadId, `+${String(fromPhone).replace(/\D/g, '')}`, messageText, result.success ? 'sent' : 'failed', result.messageId || null]
      );
      await db.query(
        `INSERT INTO lead_activities (workspace_id, lead_id, type, description, metadata) VALUES ($1, $2, 'whatsapp_sent', $3, $4)`,
        [workspaceId, leadId, result.success ? 'Auto-responder sent' : `Auto-responder failed: ${result.error}`,
         JSON.stringify({ auto_responder: true, success: result.success })]
      );
    };
    const delay = Number(ar.delay_seconds) || 0;
    if (delay > 0) setTimeout(() => send().catch((e) => logger.error('Auto-responder error:', e.message)), delay * 1000);
    else await send();
  } catch (err) {
    logger.error('Auto-responder error:', err.message);
  }
}

module.exports = { sendWhatsAppMessage, sendWhatsAppToLead, handleWhatsAppWebhook, withinWorkingHours };
