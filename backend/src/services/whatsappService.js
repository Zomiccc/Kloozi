const config = require('../config');
const axios = require('axios');
const db = require('../config/database');
const logger = require('../utils/logger');
const twilio = require('twilio');

async function sendWhatsAppMessage({ to, message, templateName, mediaUrl, media_type }) {
  try {
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
    let url = '';
    if (!config.whatsapp.phoneNumberId || !config.whatsapp.accessToken) {
      logger.warn('WhatsApp not configured, skipping send');
      return { success: false, error: 'WhatsApp not configured. Set WHATSAPP_PHONE_NUMBER_ID and WHATSAPP_ACCESS_TOKEN in .env' };
    }

    const phoneNumber = to.replace(/\D/g, '');
    url = `${config.whatsapp.apiUrl}/${config.whatsapp.phoneNumberId}/messages`;

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
        Authorization: `Bearer ${config.whatsapp.accessToken}`,
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
        const { replaceVariables } = require('../utils/variables');
        const leadData = {
          first_name: lead.first_name,
          last_name: lead.last_name,
          phone: lead.phone,
          email: lead.email,
          city: lead.city,
          budget: lead.budget,
          lead_source: lead.lead_source,
        };
        messageText = replaceVariables(tplResult.rows[0].content, leadData);
        templateName = tplResult.rows[0].name;
      }
    }

    const result = await sendWhatsAppMessage({
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

async function handleWhatsAppWebhook(payload) {
  try {
    if (payload.object) {
      const entry = payload.entry?.[0];
      const changes = entry?.changes?.[0];
      const messages = changes?.value?.messages;

      if (messages && messages.length > 0) {
        const msg = messages[0];
        const fromPhone = msg.from;
        const text = msg.text?.body || '';

        const leadResult = await db.query(
          `SELECT l.id, l.workspace_id, l.first_name, l.last_name FROM leads l WHERE REPLACE(REPLACE(l.phone, '+', ''), ' ', '') LIKE $1`,
          [`%${fromPhone}%`]
        );

        let leadId;
        let workspaceId;

        if (leadResult.rows.length > 0) {
          const lead = leadResult.rows[0];
          leadId = lead.id;
          workspaceId = lead.workspace_id;

          await db.query(
            `INSERT INTO whatsapp_messages (workspace_id, lead_id, direction, message_text, status, wa_message_id, sent_at)
             VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
            [workspaceId, lead.id, 'inbound', text, 'delivered', msg.id]
          );

          await db.query(
            `INSERT INTO lead_activities (workspace_id, lead_id, type, description, metadata)
             VALUES ($1, $2, $3, $4, $5)`,
            [workspaceId, lead.id, 'whatsapp_received', `WhatsApp message received: ${text}`, JSON.stringify({ from: fromPhone })]
          );

          const { sendPushNotification } = require('../utils/notifications');
          const assigneeResult = await db.query('SELECT assigned_to FROM leads WHERE id = $1', [lead.id]);
          if (assigneeResult.rows[0]?.assigned_to) {
            await sendPushNotification(assigneeResult.rows[0].assigned_to, 'WhatsApp Reply', `New WhatsApp message from a lead`, {
              type: 'whatsapp_reply', leadId: lead.id
            });
          }

          // Stop sequences on reply
          const { stopSequenceOnReply } = require('../controllers/whatsappSequenceController');
          await stopSequenceOnReply(workspaceId, leadId);
        } else {
          // Check if auto-create is enabled
          const autoCreateResult = await db.query(
            'SELECT * FROM whatsapp_auto_create_config WHERE workspace_id = (SELECT id FROM workspaces LIMIT 1) AND is_enabled = true'
          );
          
          if (autoCreateResult.rows.length > 0) {
            const autoCreate = autoCreateResult.rows[0];
            const newLead = await importWhatsAppContactWithConfig(fromPhone, text, changes?.value?.contacts, autoCreate);
            if (newLead) {
              leadId = newLead.id;
              workspaceId = newLead.workspace_id;

              await db.query(
                `INSERT INTO whatsapp_messages (workspace_id, lead_id, direction, message_text, status, wa_message_id, sent_at)
                 VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
                [workspaceId, leadId, 'inbound', text, 'delivered', msg.id]
              );

              await db.query(
                `INSERT INTO lead_activities (workspace_id, lead_id, type, description, metadata)
                 VALUES ($1, $2, $3, $4, $5)`,
                [workspaceId, leadId, 'whatsapp_received', `First WhatsApp message: ${text}`, JSON.stringify({ from: fromPhone, auto_imported: true })]
              );

              await sendAutoResponder(workspaceId, leadId, fromPhone);
              
              // Process AI Agent for new lead
              await processAIAgent(workspaceId, leadId, fromPhone, text);
            }
          } else {
            const newLead = await importWhatsAppContact(fromPhone, text, changes?.value?.contacts);
            if (newLead) {
              leadId = newLead.id;
              workspaceId = newLead.workspace_id;

              await db.query(
                `INSERT INTO whatsapp_messages (workspace_id, lead_id, direction, message_text, status, wa_message_id, sent_at)
                 VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
                [workspaceId, leadId, 'inbound', text, 'delivered', msg.id]
              );

              await db.query(
                `INSERT INTO lead_activities (workspace_id, lead_id, type, description, metadata)
                 VALUES ($1, $2, $3, $4, $5)`,
                [workspaceId, leadId, 'whatsapp_received', `First WhatsApp message: ${text}`, JSON.stringify({ from: fromPhone, auto_imported: true })]
              );

              await sendAutoResponder(workspaceId, leadId, fromPhone);
            }
          }
        }

        if (leadId && workspaceId) {
          await processWhatsAppSequences(workspaceId, leadId, text);
        }
      }
    }
    return { success: true };
  } catch (err) {
    logger.error('WhatsApp webhook error:', err.message);
    return { success: false, error: err.message };
  }
}

async function importWhatsAppContact(fromPhone, messageText, contactsInfo) {
  try {
    const cleanPhone = fromPhone.replace(/\D/g, '');
    const name = contactsInfo?.[0]?.name;
    const firstName = name?.first_name || (messageText ? messageText.split(' ')[0] : 'WhatsApp');
    const lastName = name?.last_name || '';

    const wsResult = await db.query('SELECT id FROM workspaces LIMIT 1');
    if (wsResult.rows.length === 0) return null;
    const workspaceId = wsResult.rows[0].id;

    const stageResult = await db.query('SELECT id FROM lead_stages WHERE workspace_id = $1 AND is_default = true LIMIT 1', [workspaceId]);
    const stageId = stageResult.rows[0]?.id;

    const agentsResult = await db.query(
      `SELECT u.id FROM users u WHERE u.workspace_id = $1 AND u.role = $2 AND u.status = $3
       ORDER BY (SELECT COUNT(*) FROM leads WHERE assigned_to = u.id) ASC LIMIT 1`,
      [workspaceId, 'sales_agent', 'active']
    );

    const leadResult = await db.query(
      `INSERT INTO leads (workspace_id, first_name, last_name, phone, lead_source, notes, stage, stage_id, assigned_to)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id, workspace_id`,
      [workspaceId, firstName, lastName, '+' + cleanPhone, 'whatsapp', `Auto-imported from WhatsApp: "${messageText}"`, 'new', stageId, agentsResult.rows[0]?.id || null]
    );

    const lead = leadResult.rows[0];
    const { updateLeadScore } = require('../utils/activityLog');
    await updateLeadScore(lead.id);

    const { sendPushNotification } = require('../utils/notifications');
    if (agentsResult.rows[0]?.id) {
      await sendPushNotification(agentsResult.rows[0].id, 'New WhatsApp Lead', `Auto-imported: ${firstName} ${lastName}`, { type: 'new_lead', leadId: lead.id, source: 'whatsapp' });
    }

    return lead;
  } catch (err) {
    logger.error('WhatsApp contact import error:', err.message);
    return null;
  }
}

async function importWhatsAppContactWithConfig(fromPhone, messageText, contactsInfo, autoCreateConfig) {
  try {
    const cleanPhone = fromPhone.replace(/\D/g, '');
    const name = contactsInfo?.[0]?.name;
    const firstName = name?.first_name || (messageText ? messageText.split(' ')[0] : 'WhatsApp');
    const lastName = name?.last_name || '';

    const workspaceId = autoCreateConfig.workspace_id;

    const stageResult = await db.query(
      `SELECT id FROM lead_stages WHERE workspace_id = $1 AND name = $2 LIMIT 1`,
      [workspaceId, autoCreateConfig.default_stage || 'new']
    );
    const stageId = stageResult.rows[0]?.id;

    const assignedTo = autoCreateConfig.auto_assign_to;

    const leadResult = await db.query(
      `INSERT INTO leads (workspace_id, first_name, last_name, phone, lead_source, notes, stage, stage_id, assigned_to)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id, workspace_id`,
      [workspaceId, firstName, lastName, '+' + cleanPhone, 'whatsapp_auto', `Auto-created from WhatsApp: "${messageText}"`, autoCreateConfig.default_stage || 'new', stageId, assignedTo || null]
    );

    const lead = leadResult.rows[0];
    const { updateLeadScore } = require('../utils/activityLog');
    await updateLeadScore(lead.id);

    const { sendPushNotification } = require('../utils/notifications');
    if (assignedTo) {
      await sendPushNotification(assignedTo, 'New WhatsApp Lead', `Auto-created: ${firstName} ${lastName}`, { type: 'new_lead', leadId: lead.id, source: 'whatsapp_auto' });
    }

    return lead;
  } catch (err) {
    logger.error('WhatsApp contact import with config error:', err.message);
    return null;
  }
}

async function processAIAgent(workspaceId, leadId, fromPhone, messageText) {
  try {
    const configResult = await db.query(
      'SELECT * FROM whatsapp_ai_agent_config WHERE workspace_id = $1 AND is_enabled = true',
      [workspaceId]
    );

    if (configResult.rows.length === 0) return;

    const config = configResult.rows[0];
    const { extractLeadInfoFromMessage, generateAIReply } = require('./openaiService');

    // Extract lead info using AI
    const extractedInfo = await extractLeadInfoFromMessage(messageText, config.extract_fields, config.system_prompt);
    
    if (extractedInfo) {
      // Update lead with extracted info
      const updateFields = [];
      const updateValues = [];
      let paramIndex = 1;

      if (extractedInfo.name) {
        const nameParts = extractedInfo.name.split(' ');
        updateFields.push(`first_name = $${paramIndex++}`);
        updateValues.push(nameParts[0]);
        if (nameParts.length > 1) {
          updateFields.push(`last_name = $${paramIndex++}`);
          updateValues.push(nameParts.slice(1).join(' '));
        }
      }
      if (extractedInfo.budget) {
        updateFields.push(`budget = $${paramIndex++}`);
        updateValues.push(parseFloat(extractedInfo.budget));
      }
      if (extractedInfo.interest) {
        updateFields.push(`notes = COALESCE(notes, '') || $${paramIndex++}`);
        updateValues.push(` Interest: ${extractedInfo.interest}`);
      }

      if (updateFields.length > 0) {
        updateValues.push(leadId);
        await db.query(
          `UPDATE leads SET ${updateFields.join(', ')}, updated_at = NOW() WHERE id = $${paramIndex}`,
          updateValues
        );
      }
    }

    // Generate AI reply if enabled
    if (config.auto_reply) {
      const aiReply = await generateAIReply(messageText, extractedInfo, config.system_prompt);
      
      if (aiReply) {
        const result = await sendWhatsAppMessage({ to: fromPhone, message: aiReply });
        
        await db.query(
          `INSERT INTO whatsapp_messages (workspace_id, lead_id, direction, message_text, status, wa_message_id, sent_at)
           VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
          [workspaceId, leadId, 'outbound', aiReply, result.success ? 'sent' : 'failed', result.messageId || null]
        );

        await db.query(
          `INSERT INTO lead_activities (workspace_id, lead_id, type, description, metadata)
           VALUES ($1, $2, $3, $4, $5)`,
          [workspaceId, leadId, 'ai_reply_sent', `AI agent replied: ${aiReply}`, JSON.stringify({ ai_generated: true })]
        );
      }
    }
  } catch (err) {
    logger.error('AI Agent processing error:', err.message);
  }
}

async function processWhatsAppSequences(workspaceId, leadId, messageText) {
  try {
    // This is a placeholder - the actual sequence processing is handled by the BullMQ job
    // The job calls whatsappSequenceController.processDueSequenceSteps
    logger.info(`Sequence trigger for lead ${leadId} in workspace ${workspaceId}`);
  } catch (err) {
    logger.error('Sequence processing error:', err.message);
  }
}

async function sendAutoResponder(workspaceId, leadId, fromPhone) {
  try {
    const settingsResult = await db.query(
      'SELECT * FROM whatsapp_auto_responder WHERE workspace_id = $1 AND is_enabled = true',
      [workspaceId]
    );

    if (settingsResult.rows.length === 0) return;

    const settings = settingsResult.rows[0];
    const leadResult = await db.query('SELECT first_name, last_name FROM leads WHERE id = $1', [leadId]);
    const lead = leadResult.rows[0];
    if (!lead) return;

    const { replaceVariables } = require('../utils/variables');
    const messageText = replaceVariables(settings.message_template, {
      first_name: lead.first_name,
      last_name: lead.last_name,
    });

    const result = await sendWhatsAppMessage({ to: fromPhone, message: messageText });

    await db.query(
      `INSERT INTO whatsapp_messages (workspace_id, lead_id, direction, message_text, status, wa_message_id, sent_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
      [workspaceId, leadId, 'outbound', messageText, result.success ? 'sent' : 'failed', result.messageId || null]
    );

    await db.query(
      `INSERT INTO lead_activities (workspace_id, lead_id, type, description, metadata)
       VALUES ($1, $2, $3, $4, $5)`,
      [workspaceId, leadId, 'whatsapp_sent', 'Auto-responder sent', JSON.stringify({ auto_responder: true })]
    );
  } catch (err) {
    logger.error('Auto-responder error:', err.message);
  }
}

async function processWhatsAppSequences(workspaceId, leadId, incomingText) {
  try {
    const enrollments = await db.query(
      `SELECT se.*, s.name as sequence_name FROM whatsapp_sequence_enrollments se
       JOIN whatsapp_sequences s ON se.sequence_id = s.id
       WHERE se.lead_id = $1 AND se.workspace_id = $2 AND se.status = 'active'`,
      [leadId, workspaceId]
    );

    for (const enrollment of enrollments.rows) {
      const steps = await db.query(
        `SELECT * FROM whatsapp_sequence_steps WHERE sequence_id = $1 ORDER BY step_number`,
        [enrollment.sequence_id]
      );

      const currentStep = steps.rows.find(s => s.step_number === enrollment.current_step);
      if (currentStep && currentStep.trigger_type === 'inbound_reply') {
        const nextStepNumber = enrollment.current_step + 1;
        const nextStep = steps.rows.find(s => s.step_number === nextStepNumber);

        if (nextStep) {
          const leadResult = await db.query('SELECT * FROM leads WHERE id = $1', [leadId]);
          const lead = leadResult.rows[0];
          const { replaceVariables } = require('../utils/variables');

          let messageText = nextStep.message;
          if (nextStep.template_id) {
            const tplResult = await db.query('SELECT * FROM whatsapp_templates WHERE id = $1 AND workspace_id = $2', [nextStep.template_id, workspaceId]);
            if (tplResult.rows.length > 0) {
              messageText = replaceVariables(tplResult.rows[0].content, {
                first_name: lead.first_name, last_name: lead.last_name, phone: lead.phone, city: lead.city,
              });
            }
          }

          const sendResult = await sendWhatsAppMessage({ to: lead.phone, message: messageText });
          await db.query(
            `INSERT INTO whatsapp_messages (workspace_id, lead_id, direction, message_text, status, sent_at)
             VALUES ($1, $2, $3, $4, $5, NOW())`,
            [workspaceId, leadId, 'outbound', messageText, sendResult.success ? 'sent' : 'failed']
          );

          await db.query(
            'UPDATE whatsapp_sequence_enrollments SET current_step = $1 WHERE id = $2',
            [nextStepNumber, enrollment.id]
          );
        } else {
          await db.query(
            'UPDATE whatsapp_sequence_enrollments SET status = $1 WHERE id = $2',
            ['completed', enrollment.id]
          );
        }
      }
    }
  } catch (err) {
    logger.error('WhatsApp sequence processing error:', err.message);
  }
}

module.exports = { sendWhatsAppMessage, sendWhatsAppToLead, handleWhatsAppWebhook };
