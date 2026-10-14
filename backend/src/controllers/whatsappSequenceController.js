const db = require('../config/database');
const { sendWhatsAppToLead } = require('../services/whatsappService');
const { logActivity } = require('../utils/activityLog');
const logger = require('../utils/logger');

exports.getSequences = async (req, res, next) => {
  try {
    const result = await db.query('SELECT * FROM whatsapp_sequences WHERE workspace_id = $1 ORDER BY created_at DESC', [req.workspaceId]);
    res.json({ sequences: result.rows });
  } catch (err) { next(err); }
};

exports.createSequence = async (req, res, next) => {
  try {
    const { name, description, steps, is_active } = req.body;
    const result = await db.query(
      'INSERT INTO whatsapp_sequences (workspace_id, name, description, steps, is_active) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [req.workspaceId, name, description, JSON.stringify(steps || []), is_active !== false]
    );
    res.status(201).json({ sequence: result.rows[0] });
  } catch (err) { next(err); }
};

exports.updateSequence = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, description, steps, is_active } = req.body;
    const result = await db.query(
      'UPDATE whatsapp_sequences SET name = COALESCE($1, name), description = COALESCE($2, description), steps = COALESCE($3, steps), is_active = COALESCE($4, is_active), updated_at = NOW() WHERE id = $5 AND workspace_id = $6 RETURNING *',
      [name, description, steps ? JSON.stringify(steps) : null, is_active, id, req.workspaceId]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Sequence not found' });
    res.json({ sequence: result.rows[0] });
  } catch (err) { next(err); }
};

exports.deleteSequence = async (req, res, next) => {
  try {
    await db.query('DELETE FROM whatsapp_sequences WHERE id = $1 AND workspace_id = $2', [req.params.id, req.workspaceId]);
    res.json({ message: 'Sequence deleted' });
  } catch (err) { next(err); }
};

exports.getSequenceProgress = async (req, res, next) => {
  try {
    const result = await db.query(
      'SELECT wsp.*, l.first_name, l.last_name, l.phone FROM whatsapp_sequence_progress wsp JOIN leads l ON wsp.lead_id = l.id WHERE wsp.workspace_id = $1 ORDER BY wsp.next_send_at ASC',
      [req.workspaceId]
    );
    res.json({ progress: result.rows });
  } catch (err) { next(err); }
};

const MAX_STEP_ATTEMPTS = 3;
const RETRY_MINUTES = 5;

/**
 * Put a lead into a WhatsApp sequence. Used by the API, bulk actions and
 * automation rules. Returns { started, reason?, next_send_at? }.
 */
async function startSequence(workspaceId, sequenceId, leadId, actorId = null) {
  const seq = (await db.query('SELECT * FROM whatsapp_sequences WHERE id = $1 AND workspace_id = $2', [sequenceId, workspaceId])).rows[0];
  if (!seq) return { started: false, reason: 'Sequence not found' };
  if (seq.is_active === false) return { started: false, reason: 'Sequence is paused' };
  const steps = Array.isArray(seq.steps) ? seq.steps.filter((st) => st && String(st.message || '').trim()) : [];
  if (steps.length === 0) return { started: false, reason: 'Sequence has no steps' };
  const lead = (await db.query('SELECT id, phone, first_name FROM leads WHERE id = $1 AND workspace_id = $2', [leadId, workspaceId])).rows[0];
  if (!lead) return { started: false, reason: 'Lead not found' };
  if (!lead.phone) return { started: false, reason: 'Lead has no phone number' };

  const existing = (await db.query(
    'SELECT * FROM whatsapp_sequence_progress WHERE sequence_id = $1 AND lead_id = $2', [sequenceId, leadId]
  )).rows[0];
  if (existing && !existing.is_completed && !existing.is_stopped) return { started: false, reason: 'Lead is already in this sequence' };

  const nextSendAt = new Date(Date.now() + (Number(steps[0].delay_hours) || 0) * 3600000);
  if (existing) {
    // Finished or stopped before — restart from the first step.
    await db.query(
      `UPDATE whatsapp_sequence_progress SET current_step = 0, next_send_at = $1, is_completed = FALSE, is_stopped = FALSE,
         stop_reason = NULL, failed_attempts = 0, updated_at = NOW() WHERE id = $2`,
      [nextSendAt, existing.id]
    );
  } else {
    await db.query(
      'INSERT INTO whatsapp_sequence_progress (workspace_id, sequence_id, lead_id, current_step, next_send_at) VALUES ($1, $2, $3, 0, $4)',
      [workspaceId, sequenceId, leadId, nextSendAt]
    );
  }
  await logActivity(workspaceId, leadId, actorId, 'sequence_started', `WhatsApp sequence started: ${seq.name}`, { sequence_id: sequenceId });
  return { started: true, next_send_at: nextSendAt };
}
exports.startSequence = startSequence;

exports.startSequenceForLead = async (req, res, next) => {
  try {
    const { sequence_id, lead_id, lead_ids } = req.body;
    const ids = Array.isArray(lead_ids) && lead_ids.length ? lead_ids : [lead_id];
    if (req.user.role === 'sales_agent') {
      // Agents may only start sequences for their own leads.
      const own = await db.query('SELECT id FROM leads WHERE workspace_id = $1 AND assigned_to = $2 AND id = ANY($3::uuid[])', [req.workspaceId, req.user.id, ids]);
      if (own.rows.length !== ids.length) return res.status(403).json({ error: 'You can only start sequences for your own leads' });
    }
    const results = [];
    for (const id of ids.filter(Boolean)) results.push({ lead_id: id, ...(await startSequence(req.workspaceId, sequence_id, id, req.user.id)) });
    const started = results.filter((r) => r.started).length;
    if (ids.length === 1 && !started) return res.status(400).json({ error: results[0].reason });
    res.json({ message: `Sequence started for ${started} lead${started === 1 ? '' : 's'}`, started, results });
  } catch (err) { next(err); }
};


exports.stopSequenceForLead = async (req, res, next) => {
  try {
    const { sequence_id, lead_id, reason } = req.body;
    
    await db.query(
      'UPDATE whatsapp_sequence_progress SET is_stopped = TRUE, stop_reason = $1, updated_at = NOW() WHERE sequence_id = $2 AND lead_id = $3 AND workspace_id = $4',
      [reason || 'manual', sequence_id, lead_id, req.workspaceId]
    );

    res.json({ message: 'Sequence stopped for lead' });
  } catch (err) { next(err); }
};

// Process due sequence steps (called by BullMQ job)
exports.processDueSequenceSteps = async () => {
  try {
    const result = await db.query(
      `SELECT wsp.*, ws.steps, l.phone 
       FROM whatsapp_sequence_progress wsp 
       JOIN whatsapp_sequences ws ON wsp.sequence_id = ws.id 
       JOIN leads l ON wsp.lead_id = l.id 
       WHERE wsp.next_send_at <= NOW() 
       AND wsp.is_completed = FALSE 
       AND wsp.is_stopped = FALSE 
       AND ws.is_active = TRUE`
    );

    for (const progress of result.rows) {
      try {
        // Claim the step so overlapping ticks/workers never send it twice (a crash retries after 5 min).
        const claim = await db.query(
          `UPDATE whatsapp_sequence_progress SET next_send_at = NOW() + INTERVAL '5 minutes'
           WHERE id = $1 AND next_send_at <= NOW() AND is_completed = FALSE AND is_stopped = FALSE RETURNING id`,
          [progress.id]
        );
        if (!claim.rows.length) continue;
        const steps = progress.steps || [];
        const currentStepIndex = progress.current_step;
        
        if (currentStepIndex >= steps.length) {
          // Mark as completed
          await db.query(
            'UPDATE whatsapp_sequence_progress SET is_completed = TRUE, updated_at = NOW() WHERE id = $1',
            [progress.id]
          );
          continue;
        }

        const step = steps[currentStepIndex];
        
        // Send WhatsApp message
        const sendResult = await sendWhatsAppToLead({
          workspaceId: progress.workspace_id,
          leadId: progress.lead_id,
          message: step.message,
        });

        if (!sendResult.success) {
          const attempts = (progress.failed_attempts || 0) + 1;
          logger.error(`Sequence step failed for lead ${progress.lead_id} (attempt ${attempts}):`, sendResult.error);
          if (attempts >= MAX_STEP_ATTEMPTS) {
            await db.query(
              "UPDATE whatsapp_sequence_progress SET is_stopped = TRUE, stop_reason = 'send_failed', failed_attempts = $1, updated_at = NOW() WHERE id = $2",
              [attempts, progress.id]
            );
            await logActivity(progress.workspace_id, progress.lead_id, null, 'sequence_stopped', `WhatsApp sequence stopped: step ${currentStepIndex + 1} failed to send (${sendResult.error})`);
          } else {
            await db.query(
              'UPDATE whatsapp_sequence_progress SET failed_attempts = $1, next_send_at = NOW() + ($2 || \' minutes\')::interval, updated_at = NOW() WHERE id = $3',
              [attempts, String(RETRY_MINUTES), progress.id]
            );
          }
          continue;
        }

        // Calculate next step time
        const nextStepIndex = currentStepIndex + 1;
        let nextSendAt = null;
        
        if (nextStepIndex < steps.length) {
          const nextStep = steps[nextStepIndex];
          const delayHours = nextStep.delay_hours || 0;
          nextSendAt = new Date(Date.now() + delayHours * 60 * 60 * 1000);
        } else {
          // That was the last step — record it and mark the sequence complete
          await db.query(
            'UPDATE whatsapp_sequence_progress SET is_completed = TRUE, current_step = $2, failed_attempts = 0, updated_at = NOW() WHERE id = $1',
            [progress.id, nextStepIndex]
          );
          await logActivity(progress.workspace_id, progress.lead_id, null, 'sequence_step_sent', `WhatsApp sequence step ${currentStepIndex + 1} sent (last step)`);
          continue;
        }

        // Update progress
        await db.query(
          'UPDATE whatsapp_sequence_progress SET current_step = $1, next_send_at = $2, failed_attempts = 0, updated_at = NOW() WHERE id = $3',
          [nextStepIndex, nextSendAt, progress.id]
        );

        await logActivity(progress.workspace_id, progress.lead_id, null, 'sequence_step_sent', `WhatsApp sequence step ${currentStepIndex + 1} sent`);
        
        logger.info(`Sequence step ${currentStepIndex + 1} sent for lead ${progress.lead_id}`);
      } catch (err) {
        logger.error(`Error processing sequence progress ${progress.id}:`, err.message);
      }
    }
  } catch (err) {
    logger.error('Error in processDueSequenceSteps:', err.message);
  }
};

// Stop sequence when lead replies (called from WhatsApp webhook)
exports.stopSequenceOnReply = async (workspaceId, leadId) => {
  try {
    await db.query(
      'UPDATE whatsapp_sequence_progress SET is_stopped = TRUE, stop_reason = $1, updated_at = NOW() WHERE lead_id = $2 AND workspace_id = $3 AND is_completed = FALSE',
      ['lead_replied', leadId, workspaceId]
    );
    logger.info(`Sequence stopped for lead ${leadId} due to reply`);
  } catch (err) {
    logger.error('Error stopping sequence on reply:', err.message);
  }
};
