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

exports.startSequenceForLead = async (req, res, next) => {
  try {
    const { sequence_id, lead_id } = req.body;
    
    // Check if already in progress
    const existing = await db.query(
      'SELECT * FROM whatsapp_sequence_progress WHERE sequence_id = $1 AND lead_id = $2',
      [sequence_id, lead_id]
    );
    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'Lead already in this sequence' });
    }

    // Get sequence steps
    const seqResult = await db.query('SELECT * FROM whatsapp_sequences WHERE id = $1 AND workspace_id = $2', [sequence_id, req.workspaceId]);
    if (seqResult.rows.length === 0) return res.status(404).json({ error: 'Sequence not found' });
    
    const sequence = seqResult.rows[0];
    const steps = sequence.steps || [];
    
    if (steps.length === 0) {
      return res.status(400).json({ error: 'Sequence has no steps' });
    }

    const firstStep = steps[0];
    const delayHours = firstStep.delay_hours || 0;
    const nextSendAt = new Date(Date.now() + delayHours * 60 * 60 * 1000);

    await db.query(
      'INSERT INTO whatsapp_sequence_progress (workspace_id, sequence_id, lead_id, current_step, next_send_at) VALUES ($1, $2, $3, $4, $5)',
      [req.workspaceId, sequence_id, lead_id, 0, nextSendAt]
    );

    res.json({ message: 'Sequence started for lead', next_send_at: nextSendAt });
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
          logger.error(`Failed to send sequence step for lead ${progress.lead_id}:`, sendResult.error);
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
          // No more steps, mark as completed
          await db.query(
            'UPDATE whatsapp_sequence_progress SET is_completed = TRUE, updated_at = NOW() WHERE id = $1',
            [progress.id]
          );
          continue;
        }

        // Update progress
        await db.query(
          'UPDATE whatsapp_sequence_progress SET current_step = $1, next_send_at = $2, updated_at = NOW() WHERE id = $3',
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
