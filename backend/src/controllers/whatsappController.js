const db = require('../config/database');
const { sendWhatsAppMessage, sendWhatsAppToLead, handleWhatsAppWebhook } = require('../services/whatsappService');
const { enqueueJob } = require('../queues');
const crypto = require('crypto');

exports.getTemplates = async (req, res, next) => {
  try {
    const result = await db.query('SELECT * FROM whatsapp_templates WHERE workspace_id = $1 ORDER BY created_at DESC', [req.workspaceId]);
    res.json({ templates: result.rows });
  } catch (err) { next(err); }
};

exports.createTemplate = async (req, res, next) => {
  try {
    const { name, category, content } = req.body;
    const { extractVariables } = require('../utils/variables');
    const variables = extractVariables(content);
    const result = await db.query(
      'INSERT INTO whatsapp_templates (workspace_id, name, category, content, variables) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [req.workspaceId, name, category || 'intro', content, JSON.stringify(variables)]
    );
    res.status(201).json({ template: result.rows[0] });
  } catch (err) { next(err); }
};

exports.sendMessage = async (req, res, next) => {
  try {
    const { lead_id, message, template_id, media_url, media_type } = req.body;
    const result = await sendWhatsAppToLead({
      workspaceId: req.workspaceId, leadId: lead_id, userId: req.user.id,
      message, templateId: template_id, mediaUrl: media_url, mediaType: media_type,
    });
    if (!result.success) return res.status(400).json({ error: result.error || 'Failed to send WhatsApp message' });
    res.json({ message: 'WhatsApp message sent', messageId: result.messageId });
  } catch (err) { next(err); }
};

exports.getInbox = async (req, res, next) => {
  try {
    const { lead_id } = req.query;
    let query, params;
    if (lead_id) {
      query = 'SELECT * FROM whatsapp_messages WHERE workspace_id = $1 AND lead_id = $2 ORDER BY created_at ASC';
      params = [req.workspaceId, lead_id];
    } else {
      if (req.user.role === 'sales_agent') {
        query = `SELECT wm.* FROM whatsapp_messages wm JOIN leads l ON wm.lead_id = l.id WHERE wm.workspace_id = $1 AND l.assigned_to = $2 ORDER BY wm.created_at DESC LIMIT 100`;
        params = [req.workspaceId, req.user.id];
      } else {
        query = 'SELECT * FROM whatsapp_messages WHERE workspace_id = $1 ORDER BY created_at DESC LIMIT 100';
        params = [req.workspaceId];
      }
    }
    const result = await db.query(query, params);
    res.json({ messages: result.rows });
  } catch (err) { next(err); }
};

exports.getConversations = async (req, res, next) => {
  try {
    let query, params;
    if (req.user.role === 'sales_agent') {
      query = `SELECT l.id, l.first_name, l.last_name, l.phone,
                  (SELECT message_text FROM whatsapp_messages WHERE lead_id = l.id ORDER BY created_at DESC LIMIT 1) as last_message,
                  (SELECT created_at FROM whatsapp_messages WHERE lead_id = l.id ORDER BY created_at DESC LIMIT 1) as last_message_time,
                  (SELECT COUNT(*) FROM whatsapp_messages WHERE lead_id = l.id AND direction = 'inbound' AND status != 'read') as unread_count
               FROM leads l WHERE l.workspace_id = $1 AND l.assigned_to = $2 AND EXISTS (SELECT 1 FROM whatsapp_messages WHERE lead_id = l.id)
               ORDER BY last_message_time DESC NULLS LAST`;
      params = [req.workspaceId, req.user.id];
    } else {
      query = `SELECT l.id, l.first_name, l.last_name, l.phone, u.first_name as agent_first_name, u.last_name as agent_last_name,
                  (SELECT message_text FROM whatsapp_messages WHERE lead_id = l.id ORDER BY created_at DESC LIMIT 1) as last_message,
                  (SELECT created_at FROM whatsapp_messages WHERE lead_id = l.id ORDER BY created_at DESC LIMIT 1) as last_message_time,
                  (SELECT COUNT(*) FROM whatsapp_messages WHERE lead_id = l.id AND direction = 'inbound' AND status != 'read') as unread_count
               FROM leads l LEFT JOIN users u ON l.assigned_to = u.id
               WHERE l.workspace_id = $1 AND EXISTS (SELECT 1 FROM whatsapp_messages WHERE lead_id = l.id)
               ORDER BY last_message_time DESC NULLS LAST`;
      params = [req.workspaceId];
    }
    const result = await db.query(query, params);
    res.json({ conversations: result.rows });
  } catch (err) { next(err); }
};

exports.webhook = async (req, res, next) => {
  try {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];
    const config = require('../config');
    const expectedToken = config.whatsapp.verifyToken;

    // Log everything for debugging
    console.log('=== WHATSAPP WEBHOOK VERIFICATION ===');
    console.log('Method:', req.method);
    console.log('URL:', req.originalUrl);
    console.log('Query:', JSON.stringify(req.query));
    console.log('hub.mode:', mode);
    console.log('hub.verify_token:', token);
    console.log('hub.challenge:', challenge);
    console.log('Expected token:', expectedToken);
    console.log('Token match:', token === expectedToken);
    console.log('Mode is subscribe:', mode === 'subscribe');
    console.log('=====================================');

    // Handle GET verification from Meta
    if (req.method === 'GET' && mode) {
      if (mode === 'subscribe' && token === expectedToken) {
        console.log('✅ VERIFICATION SUCCESS - returning challenge:', challenge);
        return res.status(200).type('text/plain').send(String(challenge));
      }
      console.log('❌ VERIFICATION FAILED - mode:', mode, 'token match:', token === expectedToken);
      return res.status(403).type('text/plain').send('Forbidden');
    }

    // Handle POST webhook events from WhatsApp
    if (req.method === 'POST') {
      await handleWhatsAppWebhook(req.body);
      return res.status(200).json({ success: true });
    }

    res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('WhatsApp webhook error:', err);
    next(err);
  }
};

exports.bulkSend = async (req, res, next) => {
  try {
    const { lead_ids, template_id, message } = req.body;
    await enqueueJob('whatsapp-bulk-send', { workspaceId: req.workspaceId, userId: req.user.id, leadIds: lead_ids, templateId: template_id, message });
    res.json({ message: 'WhatsApp bulk send queued', count: lead_ids.length });
  } catch (err) { next(err); }
};

exports.getAutoResponder = async (req, res, next) => {
  try {
    const result = await db.query('SELECT * FROM whatsapp_auto_responder WHERE workspace_id = $1', [req.workspaceId]);
    res.json({ settings: result.rows[0] || null });
  } catch (err) { next(err); }
};

exports.updateAutoResponder = async (req, res, next) => {
  try {
    const { is_enabled, message_template, trigger_type } = req.body;
    const existing = await db.query('SELECT id FROM whatsapp_auto_responder WHERE workspace_id = $1', [req.workspaceId]);
    if (existing.rows.length > 0) {
      const result = await db.query(
        `UPDATE whatsapp_auto_responder SET is_enabled = $1, message_template = $2, trigger_type = $3, updated_at = NOW() WHERE workspace_id = $4 RETURNING *`,
        [is_enabled, message_template, trigger_type || 'new_lead', req.workspaceId]
      );
      res.json({ settings: result.rows[0] });
    } else {
      const result = await db.query(
        `INSERT INTO whatsapp_auto_responder (workspace_id, is_enabled, message_template, trigger_type) VALUES ($1, $2, $3, $4) RETURNING *`,
        [req.workspaceId, is_enabled, message_template, trigger_type || 'new_lead']
      );
      res.status(201).json({ settings: result.rows[0] });
    }
  } catch (err) { next(err); }
};

exports.getWhatsAppSequences = async (req, res, next) => {
  try {
    const result = await db.query(
      `SELECT s.*, COUNT(ss.id) as step_count,
              (SELECT COUNT(*) FROM whatsapp_sequence_enrollments e WHERE e.sequence_id = s.id AND e.status = 'active') as active_enrollments
       FROM whatsapp_sequences s LEFT JOIN whatsapp_sequence_steps ss ON s.id = ss.sequence_id
       WHERE s.workspace_id = $1 GROUP BY s.id ORDER BY s.created_at DESC`,
      [req.workspaceId]
    );
    res.json({ sequences: result.rows });
  } catch (err) { next(err); }
};

exports.createWhatsAppSequence = async (req, res, next) => {
  try {
    const { name, description, steps } = req.body;
    const seqResult = await db.query(
      'INSERT INTO whatsapp_sequences (workspace_id, name, description, created_by) VALUES ($1, $2, $3, $4) RETURNING *',
      [req.workspaceId, name, description, req.user.id]
    );
    const seqId = seqResult.rows[0].id;

    if (steps && steps.length > 0) {
      for (let i = 0; i < steps.length; i++) {
        const step = steps[i];
        await db.query(
          `INSERT INTO whatsapp_sequence_steps (sequence_id, step_number, template_id, message, delay_hours, trigger_type)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [seqId, i + 1, step.template_id || null, step.message || null, step.delay_hours || 0, step.trigger_type || 'immediate']
        );
      }
    }
    res.status(201).json({ sequence: seqResult.rows[0] });
  } catch (err) { next(err); }
};

exports.enrollWhatsAppSequence = async (req, res, next) => {
  try {
    const { sequence_id, lead_ids } = req.body;
    for (const leadId of lead_ids) {
      await db.query(
        `INSERT INTO whatsapp_sequence_enrollments (sequence_id, lead_id, workspace_id, current_step, status, enrolled_at)
         VALUES ($1, $2, $3, 1, 'active', NOW())
         ON CONFLICT (sequence_id, lead_id) DO UPDATE SET status = 'active', current_step = 1`,
        [sequence_id, leadId, req.workspaceId]
      );
    }
    res.json({ message: 'Leads enrolled in WhatsApp sequence', count: lead_ids.length });
  } catch (err) { next(err); }
};

exports.getChatMonitoring = async (req, res, next) => {
  try {
    const { agent_id, date_from, date_to } = req.query;
    let conditions = ['wm.workspace_id = $1'];
    let params = [req.workspaceId];
    let paramIdx = 2;

    if (agent_id) {
      conditions.push(`l.assigned_to = $${paramIdx++}`);
      params.push(agent_id);
    }
    if (date_from) {
      conditions.push(`wm.sent_at >= $${paramIdx++}`);
      params.push(date_from);
    }
    if (date_to) {
      conditions.push(`wm.sent_at <= $${paramIdx++}`);
      params.push(date_to);
    }

    const conversations = await db.query(
      `SELECT l.id as lead_id, l.first_name, l.last_name, l.phone, u.first_name as agent_first_name, u.last_name as agent_last_name, u.id as agent_id,
              COUNT(CASE WHEN wm.direction = 'outbound' THEN 1 END) as outbound_count,
              COUNT(CASE WHEN wm.direction = 'inbound' THEN 1 END) as inbound_count,
              MAX(wm.sent_at) as last_message_time
       FROM whatsapp_messages wm
       JOIN leads l ON wm.lead_id = l.id
       LEFT JOIN users u ON l.assigned_to = u.id
       WHERE ${conditions.join(' AND ')}
       GROUP BY l.id, l.first_name, l.last_name, l.phone, u.first_name, u.last_name, u.id
       ORDER BY last_message_time DESC LIMIT 200`,
      params
    );

    const agentStats = await db.query(
      `SELECT u.id, u.first_name, u.last_name,
              COUNT(DISTINCT wm.lead_id) as unique_leads_contacted,
              COUNT(CASE WHEN wm.direction = 'outbound' THEN 1 END) as outbound_messages,
              COUNT(CASE WHEN wm.direction = 'inbound' THEN 1 END) as inbound_messages,
              COUNT(CASE WHEN wm.direction = 'outbound' AND wm.sent_at > NOW() - INTERVAL '24 hours' THEN 1 END) as messages_today
       FROM users u LEFT JOIN whatsapp_messages wm ON u.id = wm.user_id AND wm.workspace_id = $1
       WHERE u.workspace_id = $1 AND u.role = 'sales_agent'
       GROUP BY u.id, u.first_name, u.last_name ORDER BY outbound_messages DESC`,
      [req.workspaceId]
    );

    res.json({ conversations: conversations.rows, agentStats: agentStats.rows });
  } catch (err) { next(err); }
};

exports.getConversationDetail = async (req, res, next) => {
  try {
    const { lead_id } = req.params;
    const leadResult = await db.query(
      `SELECT l.*, u.first_name as agent_first_name, u.last_name as agent_last_name FROM leads l LEFT JOIN users u ON l.assigned_to = u.id WHERE l.id = $1 AND l.workspace_id = $2`,
      [lead_id, req.workspaceId]
    );
    if (leadResult.rows.length === 0) return res.status(404).json({ error: 'Lead not found' });

    const messages = await db.query(
      `SELECT wm.*, u.first_name as sender_first_name, u.last_name as sender_last_name
       FROM whatsapp_messages wm LEFT JOIN users u ON wm.user_id = u.id
       WHERE wm.lead_id = $1 AND wm.workspace_id = $2 ORDER BY wm.sent_at ASC`,
      [lead_id, req.workspaceId]
    );

    res.json({ lead: leadResult.rows[0], messages: messages.rows });
  } catch (err) { next(err); }
};

const otpStore = {};
const resendCountStore = {};
const attemptStore = {};
const blockStore = {};

function normalizePhone(phone) {
  let cleaned = phone.replace(/[^\d+]/g, '');
  if (!cleaned.startsWith('+')) cleaned = '+' + cleaned.replace(/^0+/, '');
  return cleaned;
}

function isBlocked(phone) {
  const block = blockStore[phone];
  if (block && Date.now() < block) return true;
  if (block && Date.now() >= block) delete blockStore[phone];
  return false;
}

exports.sendOTP = async (req, res, next) => {
  try {
    const { phone_number } = req.body;
    if (!phone_number) return res.status(400).json({ error: 'Phone number required' });

    const normalizedPhone = normalizePhone(phone_number);

    if (isBlocked(normalizedPhone)) {
      const remaining = Math.ceil((blockStore[normalizedPhone] - Date.now()) / 60000);
      return res.status(429).json({ error: `Too many attempts. Try again in ${remaining} minute(s).` });
    }

    const resendCount = resendCountStore[normalizedPhone] || 0;
    if (resendCount >= 5) {
      return res.status(429).json({ error: 'Maximum resends reached. Please try again later.' });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expires = Date.now() + 10 * 60 * 1000;
    otpStore[normalizedPhone] = { otp, expires, verified: false };
    attemptStore[normalizedPhone] = 0;

    const result = await sendWhatsAppMessage({
      to: normalizedPhone,
      message: `Your Zomic verification code is: ${otp}\nThis code expires in 10 minutes.\nDo not share this code with anyone.`,
    });

    if (!result.success) {
      return res.status(400).json({ error: result.error || 'Failed to send OTP via WhatsApp. Make sure the phone number has WhatsApp and your WhatsApp Business API is configured.' });
    }

    resendCountStore[normalizedPhone] = resendCount + 1;
    setTimeout(() => { if (resendCountStore[normalizedPhone]) resendCountStore[normalizedPhone]--; }, 60 * 60 * 1000);

    res.json({ message: 'OTP sent to your WhatsApp' });
  } catch (err) { next(err); }
};

exports.resendOTP = async (req, res, next) => {
  try {
    const { phone_number } = req.body;
    if (!phone_number) return res.status(400).json({ error: 'Phone number required' });

    const normalizedPhone = normalizePhone(phone_number);

    if (isBlocked(normalizedPhone)) {
      return res.status(429).json({ error: 'Too many attempts. Please try again later.' });
    }

    const resendCount = resendCountStore[normalizedPhone] || 0;
    if (resendCount >= 5) {
      return res.status(429).json({ error: 'Maximum resends reached. Please try again later.' });
    }

    delete otpStore[normalizedPhone];

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expires = Date.now() + 10 * 60 * 1000;
    otpStore[normalizedPhone] = { otp, expires, verified: false };
    attemptStore[normalizedPhone] = 0;

    const result = await sendWhatsAppMessage({
      to: normalizedPhone,
      message: `Your Zomic verification code is: ${otp}\nThis code expires in 10 minutes.\nDo not share this code with anyone.`,
    });

    if (!result.success) {
      return res.status(400).json({ error: 'Failed to send OTP via WhatsApp.' });
    }

    resendCountStore[normalizedPhone] = resendCount + 1;

    res.json({ message: 'OTP resent to your WhatsApp' });
  } catch (err) { next(err); }
};

exports.verifyOTP = async (req, res, next) => {
  try {
    const { phone_number, otp } = req.body;
    if (!phone_number || !otp) return res.status(400).json({ error: 'Phone number and OTP required' });

    const normalizedPhone = normalizePhone(phone_number);

    if (isBlocked(normalizedPhone)) {
      return res.status(429).json({ error: 'Too many incorrect attempts. Please try again later.' });
    }

    const stored = otpStore[normalizedPhone];
    if (!stored) return res.status(400).json({ error: 'Code expired. Please request a new one.' });
    if (Date.now() > stored.expires) {
      delete otpStore[normalizedPhone];
      return res.status(400).json({ error: 'Code expired. Please request a new one.' });
    }

    if (stored.otp !== otp) {
      attemptStore[normalizedPhone] = (attemptStore[normalizedPhone] || 0) + 1;
      if (attemptStore[normalizedPhone] >= 3) {
        blockStore[normalizedPhone] = Date.now() + 5 * 60 * 1000;
        delete otpStore[normalizedPhone];
        return res.status(429).json({ error: 'Too many incorrect attempts. Blocked for 5 minutes.' });
      }
      return res.status(400).json({ error: 'Incorrect code. Please try again.' });
    }

    delete otpStore[normalizedPhone];
    delete attemptStore[normalizedPhone];

    const existingWs = await db.query('SELECT id FROM workspaces WHERE settings->>\'whatsapp_number\' = $1 AND id != $2', [normalizedPhone, req.workspaceId]);
    if (existingWs.rows.length > 0) {
      return res.status(409).json({ error: 'This number is already connected to another account' });
    }

    const wsResult = await db.query('SELECT settings FROM workspaces WHERE id = $1', [req.workspaceId]);
    const rawSettings = wsResult.rows[0]?.settings;
    const settings = typeof rawSettings === 'string' ? JSON.parse(rawSettings) : (rawSettings || {});
    settings.whatsapp_number = normalizedPhone;
    settings.whatsapp_connected = true;
    settings.whatsapp_connected_at = new Date().toISOString();

    await db.query('UPDATE workspaces SET settings = $1, updated_at = NOW() WHERE id = $2', [JSON.stringify(settings), req.workspaceId]);

    await db.query(
      `INSERT INTO integrations (workspace_id, type, is_connected, credentials, config)
       VALUES ($1, 'whatsapp', true, $2, $3)
       ON CONFLICT (workspace_id, type) DO UPDATE SET is_connected = true, credentials = $2, config = $3, updated_at = NOW()`,
      [req.workspaceId, JSON.stringify({ phone: normalizedPhone, mode: 'coexistence' }), JSON.stringify({})]
    );

    res.json({ message: 'WhatsApp verified and connected successfully', phone_number: normalizedPhone });
  } catch (err) { next(err); }
};

exports.getWhatsAppStatus = async (req, res, next) => {
  try {
    const wsResult = await db.query('SELECT settings FROM workspaces WHERE id = $1', [req.workspaceId]);
    const rawSettings = wsResult.rows[0]?.settings;
    const settings = typeof rawSettings === 'string' ? JSON.parse(rawSettings) : (rawSettings || {});
    res.json({
      connected: !!settings.whatsapp_connected,
      phone_number: settings.whatsapp_number || null,
      connected_at: settings.whatsapp_connected_at || null,
    });
  } catch (err) { next(err); }
};

exports.disconnectWhatsApp = async (req, res, next) => {
  try {
    const wsResult = await db.query('SELECT settings FROM workspaces WHERE id = $1', [req.workspaceId]);
    const rawSettings = wsResult.rows[0]?.settings;
    const settings = typeof rawSettings === 'string' ? JSON.parse(rawSettings) : (rawSettings || {});
    delete settings.whatsapp_number;
    delete settings.whatsapp_connected;
    delete settings.whatsapp_connected_at;

    await db.query('UPDATE workspaces SET settings = $1, updated_at = NOW() WHERE id = $2', [JSON.stringify(settings), req.workspaceId]);

    await db.query('UPDATE integrations SET is_connected = false WHERE workspace_id = $1 AND type = $2', [req.workspaceId, 'whatsapp']);

    res.json({ message: 'WhatsApp disconnected successfully' });
  } catch (err) { next(err); }
};

exports.getAutoResponderSettings = async (req, res, next) => {
  try {
    const wsResult = await db.query('SELECT settings FROM workspaces WHERE id = $1', [req.workspaceId]);
    const rawSettings = wsResult.rows[0]?.settings;
    const settings = typeof rawSettings === 'string' ? JSON.parse(rawSettings) : (rawSettings || {});
    const ar = settings.whatsapp_auto_responder || {
      is_enabled: false,
      message_template: "Hi {{First_Name}}! 👋\nThank you for reaching out to {{Company_Name}}. We have received your message and one of our team members will get back to you shortly.\n\nOur working hours are 9 AM – 6 PM, Mon–Sat.",
      trigger_type: 'all',
      working_hours_start: '09:00',
      working_hours_end: '18:00',
      working_days: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat'],
      delay_seconds: 0,
    };
    res.json({ settings: ar });
  } catch (err) { next(err); }
};

exports.updateAutoResponderSettings = async (req, res, next) => {
  try {
    const { is_enabled, message_template, trigger_type, working_hours_start, working_hours_end, working_days, delay_seconds } = req.body;
    const wsResult = await db.query('SELECT settings FROM workspaces WHERE id = $1', [req.workspaceId]);
    const rawSettings = wsResult.rows[0]?.settings;
    const settings = typeof rawSettings === 'string' ? JSON.parse(rawSettings) : (rawSettings || {});
    settings.whatsapp_auto_responder = {
      is_enabled: is_enabled ?? false,
      message_template: message_template || "Hi {{First_Name}}! 👋\nThank you for reaching out to {{Company_Name}}. We have received your message and one of our team members will get back to you shortly.\n\nOur working hours are 9 AM – 6 PM, Mon–Sat.",
      trigger_type: trigger_type || 'all',
      working_hours_start: working_hours_start || '09:00',
      working_hours_end: working_hours_end || '18:00',
      working_days: working_days || ['mon', 'tue', 'wed', 'thu', 'fri', 'sat'],
      delay_seconds: delay_seconds || 0,
    };

    await db.query('UPDATE workspaces SET settings = $1, updated_at = NOW() WHERE id = $2', [JSON.stringify(settings), req.workspaceId]);

    res.json({ settings: settings.whatsapp_auto_responder });
  } catch (err) { next(err); }
};
