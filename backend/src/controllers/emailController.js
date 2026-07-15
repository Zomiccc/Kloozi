const db = require('../config/database');
const logger = require('../utils/logger');
const { sendTrackedEmail, handleEmailEvent } = require('../services/emailService');
const { logActivity } = require('../utils/activityLog');
const { enqueueJob } = require('../queues');
const { extractVariables } = require('../utils/variables');

exports.getTemplates = async (req, res, next) => {
  try {
    const result = await db.query(
      'SELECT * FROM email_templates WHERE workspace_id = $1 ORDER BY created_at DESC',
      [req.workspaceId]
    );
    res.json({ templates: result.rows });
  } catch (err) { next(err); }
};

exports.createTemplate = async (req, res, next) => {
  try {
    const { name, subject, body, category, is_draft } = req.body;
    const variables = extractVariables(subject + ' ' + body);
    const result = await db.query(
      `INSERT INTO email_templates (workspace_id, name, subject, body, category, variables, is_draft, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [req.workspaceId, name, subject, body, category || 'intro', JSON.stringify(variables), is_draft || false, req.user.id]
    );
    res.status(201).json({ template: result.rows[0] });
  } catch (err) { next(err); }
};

exports.updateTemplate = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, subject, body, category, is_draft } = req.body;
    const variables = extractVariables((subject || '') + ' ' + (body || ''));
    const result = await db.query(
      `UPDATE email_templates SET name = $1, subject = $2, body = $3, category = $4, variables = $5, is_draft = $6, updated_at = NOW()
       WHERE id = $7 AND workspace_id = $8 RETURNING *`,
      [name, subject, body, category, JSON.stringify(variables), is_draft || false, id, req.workspaceId]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Template not found' });
    res.json({ template: result.rows[0] });
  } catch (err) { next(err); }
};

exports.deleteTemplate = async (req, res, next) => {
  try {
    await db.query('DELETE FROM email_templates WHERE id = $1 AND workspace_id = $2', [req.params.id, req.workspaceId]);
    res.json({ message: 'Template deleted' });
  } catch (err) { next(err); }
};

exports.duplicateTemplate = async (req, res, next) => {
  try {
    const result = await db.query('SELECT * FROM email_templates WHERE id = $1 AND workspace_id = $2', [req.params.id, req.workspaceId]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Template not found' });
    const t = result.rows[0];
    const dup = await db.query(
      `INSERT INTO email_templates (workspace_id, name, subject, body, category, variables, is_draft, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [req.workspaceId, t.name + ' (Copy)', t.subject, t.body, t.category, t.variables, true, req.user.id]
    );
    res.status(201).json({ template: dup.rows[0] });
  } catch (err) { next(err); }
};

exports.previewTemplate = async (req, res, next) => {
  try {
    const { template_id, lead_id } = req.body;
    const tplResult = await db.query('SELECT * FROM email_templates WHERE id = $1 AND workspace_id = $2', [template_id, req.workspaceId]);
    if (tplResult.rows.length === 0) return res.status(404).json({ error: 'Template not found' });
    const leadResult = await db.query('SELECT * FROM leads WHERE id = $1 AND workspace_id = $2', [lead_id, req.workspaceId]);
    if (leadResult.rows.length === 0) return res.status(404).json({ error: 'Lead not found' });

    const { replaceVariables } = require('../utils/variables');
    const lead = leadResult.rows[0];
    const leadData = {
      first_name: lead.first_name, last_name: lead.last_name, phone: lead.phone, email: lead.email,
      city: lead.city, budget: lead.budget, lead_source: lead.lead_source,
    };
    res.json({
      subject: replaceVariables(tplResult.rows[0].subject, leadData),
      body: replaceVariables(tplResult.rows[0].body, leadData),
    });
  } catch (err) { next(err); }
};

exports.getTemplateStats = async (req, res, next) => {
  try {
    const { id } = req.params;
    const stats = await db.query(
      `SELECT
         COUNT(*) as total_sent,
         COUNT(CASE WHEN opened_at IS NOT NULL THEN 1 END) as total_opened,
         COUNT(CASE WHEN clicked_at IS NOT NULL THEN 1 END) as total_clicked,
         COUNT(CASE WHEN replied_at IS NOT NULL THEN 1 END) as total_replied
       FROM emails WHERE template_id = $1 AND workspace_id = $2`,
      [id, req.workspaceId]
    );
    const row = stats.rows[0];
    const total = parseInt(row.total_sent) || 1;
    res.json({
      totalSent: parseInt(row.total_sent),
      openRate: ((parseInt(row.total_opened) / total) * 100).toFixed(1),
      clickRate: ((parseInt(row.total_clicked) / total) * 100).toFixed(1),
      replyRate: ((parseInt(row.total_replied) / total) * 100).toFixed(1),
    });
  } catch (err) { next(err); }
};

exports.getSequences = async (req, res, next) => {
  try {
    const result = await db.query(
      `SELECT s.*, COUNT(ss.id) as step_count,
              (SELECT COUNT(*) FROM email_sequence_enrollments e WHERE e.sequence_id = s.id AND e.status = 'active') as active_enrollments
       FROM email_sequences s LEFT JOIN email_sequence_steps ss ON s.id = ss.sequence_id
       WHERE s.workspace_id = $1 GROUP BY s.id ORDER BY s.created_at DESC`,
      [req.workspaceId]
    );
    res.json({ sequences: result.rows });
  } catch (err) { next(err); }
};

exports.createSequence = async (req, res, next) => {
  try {
    const { name, type, description, steps } = req.body;
    const result = await db.transaction(async (client) => {
      const seqResult = await client.query(
        'INSERT INTO email_sequences (workspace_id, name, type, description, created_by) VALUES ($1, $2, $3, $4, $5) RETURNING *',
        [req.workspaceId, name, type || 'custom', description, req.user.id]
      );
      const seqId = seqResult.rows[0].id;
      if (steps && steps.length > 0) {
        for (let i = 0; i < steps.length; i++) {
          const step = steps[i];
          await client.query(
            `INSERT INTO email_sequence_steps (sequence_id, template_id, step_number, delay_hours, delay_days, condition_type, condition_value)
             VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [seqId, step.template_id, i + 1, step.delay_hours || 0, step.delay_days || 0, step.condition_type, JSON.stringify(step.condition_value || {})]
          );
        }
      }
      return seqResult.rows[0];
    });
    res.status(201).json({ sequence: result });
  } catch (err) { next(err); }
};

exports.getSequenceDetails = async (req, res, next) => {
  try {
    const seqResult = await db.query('SELECT * FROM email_sequences WHERE id = $1 AND workspace_id = $2', [req.params.id, req.workspaceId]);
    if (seqResult.rows.length === 0) return res.status(404).json({ error: 'Sequence not found' });
    const steps = await db.query(
      `SELECT ss.*, et.name as template_name, et.subject as template_subject
       FROM email_sequence_steps ss LEFT JOIN email_templates et ON ss.template_id = et.id
       WHERE ss.sequence_id = $1 ORDER BY ss.step_number`,
      [req.params.id]
    );
    const enrollments = await db.query(
      `SELECT e.*, l.first_name, l.last_name, l.email FROM email_sequence_enrollments e
       JOIN leads l ON e.lead_id = l.id WHERE e.sequence_id = $1 ORDER BY e.enrolled_at DESC`,
      [req.params.id]
    );
    res.json({ sequence: seqResult.rows[0], steps: steps.rows, enrollments: enrollments.rows });
  } catch (err) { next(err); }
};

exports.enrollInSequence = async (req, res, next) => {
  try {
    const { sequence_id, lead_ids } = req.body;
    for (const leadId of lead_ids) {
      await db.query(
        `INSERT INTO email_sequence_enrollments (sequence_id, lead_id, workspace_id, current_step, status, enrolled_at, next_step_at)
         VALUES ($1, $2, $3, 1, 'active', NOW(), NOW())
         ON CONFLICT (sequence_id, lead_id) DO UPDATE SET status = 'active', current_step = 1`,
        [sequence_id, leadId, req.workspaceId]
      );
    }
    await enqueueJob('email-sequence-processor', { sequence_id, workspace_id: req.workspaceId });
    res.json({ message: 'Leads enrolled in sequence', count: lead_ids.length });
  } catch (err) { next(err); }
};

exports.pauseSequenceForLead = async (req, res, next) => {
  try {
    await db.query(
      'UPDATE email_sequence_enrollments SET status = $1 WHERE sequence_id = $2 AND lead_id = $3 AND workspace_id = $4',
      ['paused', req.params.sequenceId, req.params.leadId, req.workspaceId]
    );
    res.json({ message: 'Sequence paused for this lead' });
  } catch (err) { next(err); }
};

exports.resumeSequenceForLead = async (req, res, next) => {
  try {
    await db.query(
      'UPDATE email_sequence_enrollments SET status = $1 WHERE sequence_id = $2 AND lead_id = $3 AND workspace_id = $4',
      ['active', req.params.sequenceId, req.params.leadId, req.workspaceId]
    );
    res.json({ message: 'Sequence resumed for this lead' });
  } catch (err) { next(err); }
};

exports.removeFromSequence = async (req, res, next) => {
  try {
    await db.query(
      'UPDATE email_sequence_enrollments SET status = $1 WHERE sequence_id = $2 AND lead_id = $3 AND workspace_id = $4',
      ['removed', req.params.sequenceId, req.params.leadId, req.workspaceId]
    );
    res.json({ message: 'Lead removed from sequence' });
  } catch (err) { next(err); }
};

exports.cloneSequence = async (req, res, next) => {
  try {
    const orig = await db.query('SELECT * FROM email_sequences WHERE id = $1 AND workspace_id = $2', [req.params.id, req.workspaceId]);
    if (orig.rows.length === 0) return res.status(404).json({ error: 'Sequence not found' });
    const steps = await db.query('SELECT * FROM email_sequence_steps WHERE sequence_id = $1', [req.params.id]);

    const cloned = await db.transaction(async (client) => {
      const newSeq = await client.query(
        'INSERT INTO email_sequences (workspace_id, name, type, description, created_by) VALUES ($1, $2, $3, $4, $5) RETURNING *',
        [req.workspaceId, orig.rows[0].name + ' (Clone)', orig.rows[0].type, orig.rows[0].description, req.user.id]
      );
      for (const step of steps.rows) {
        await client.query(
          'INSERT INTO email_sequence_steps (sequence_id, template_id, step_number, delay_hours, delay_days, condition_type, condition_value) VALUES ($1, $2, $3, $4, $5, $6, $7)',
          [newSeq.rows[0].id, step.template_id, step.step_number, step.delay_hours, step.delay_days, step.condition_type, step.condition_value]
        );
      }
      return newSeq.rows[0];
    });
    res.status(201).json({ sequence: cloned });
  } catch (err) { next(err); }
};

exports.getFlows = async (req, res, next) => {
  try {
    const result = await db.query('SELECT * FROM email_flows WHERE workspace_id = $1 ORDER BY created_at DESC', [req.workspaceId]);
    res.json({ flows: result.rows });
  } catch (err) { next(err); }
};

exports.createFlow = async (req, res, next) => {
  try {
    const { name, description, nodes, edges } = req.body;
    const result = await db.transaction(async (client) => {
      const flowResult = await client.query(
        'INSERT INTO email_flows (workspace_id, name, description, created_by) VALUES ($1, $2, $3, $4) RETURNING *',
        [req.workspaceId, name, description, req.user.id]
      );
      const flowId = flowResult.rows[0].id;
      if (nodes) {
        for (const node of nodes) {
          await client.query(
            'INSERT INTO email_flow_nodes (flow_id, node_type, node_key, position_x, position_y, config) VALUES ($1, $2, $3, $4, $5, $6)',
            [flowId, node.type, node.key, node.position?.x || 0, node.position?.y || 0, JSON.stringify(node.config || {})]
          );
        }
      }
      if (edges) {
        for (const edge of edges) {
          await client.query(
            'INSERT INTO email_flow_edges (flow_id, source_node_key, target_node_key, condition_label) VALUES ($1, $2, $3, $4)',
            [flowId, edge.source, edge.target, edge.condition || null]
          );
        }
      }
      return flowResult.rows[0];
    });
    res.status(201).json({ flow: result });
  } catch (err) { next(err); }
};

exports.getFlowDetails = async (req, res, next) => {
  try {
    const flow = await db.query('SELECT * FROM email_flows WHERE id = $1 AND workspace_id = $2', [req.params.id, req.workspaceId]);
    if (flow.rows.length === 0) return res.status(404).json({ error: 'Flow not found' });
    const nodes = await db.query('SELECT * FROM email_flow_nodes WHERE flow_id = $1', [req.params.id]);
    const edges = await db.query('SELECT * FROM email_flow_edges WHERE flow_id = $1', [req.params.id]);
    const enrollments = await db.query(
      `SELECT e.*, l.first_name, l.last_name FROM email_flow_enrollments e JOIN leads l ON e.lead_id = l.id WHERE e.flow_id = $1`,
      [req.params.id]
    );
    res.json({ flow: flow.rows[0], nodes: nodes.rows, edges: edges.rows, enrollments: enrollments.rows });
  } catch (err) { next(err); }
};

exports.updateFlow = async (req, res, next) => {
  try {
    const { name, description, nodes, edges, is_published } = req.body;
    await db.transaction(async (client) => {
      await client.query(
        'UPDATE email_flows SET name = $1, description = $2, is_published = $3, updated_at = NOW() WHERE id = $4 AND workspace_id = $5',
        [name, description, is_published || false, req.params.id, req.workspaceId]
      );
      if (nodes) {
        await client.query('DELETE FROM email_flow_nodes WHERE flow_id = $1', [req.params.id]);
        for (const node of nodes) {
          await client.query(
            'INSERT INTO email_flow_nodes (flow_id, node_type, node_key, position_x, position_y, config) VALUES ($1, $2, $3, $4, $5, $6)',
            [req.params.id, node.type, node.key, node.position?.x || 0, node.position?.y || 0, JSON.stringify(node.config || {})]
          );
        }
      }
      if (edges) {
        await client.query('DELETE FROM email_flow_edges WHERE flow_id = $1', [req.params.id]);
        for (const edge of edges) {
          await client.query(
            'INSERT INTO email_flow_edges (flow_id, source_node_key, target_node_key, condition_label) VALUES ($1, $2, $3, $4)',
            [req.params.id, edge.source, edge.target, edge.condition || null]
          );
        }
      }
    });
    res.json({ message: 'Flow updated successfully' });
  } catch (err) { next(err); }
};

exports.publishFlow = async (req, res, next) => {
  try {
    await db.query('UPDATE email_flows SET is_published = true, is_active = true WHERE id = $1 AND workspace_id = $2', [req.params.id, req.workspaceId]);
    res.json({ message: 'Flow published successfully' });
  } catch (err) { next(err); }
};

exports.getTriggers = async (req, res, next) => {
  try {
    const result = await db.query('SELECT * FROM email_triggers WHERE workspace_id = $1 ORDER BY created_at DESC', [req.workspaceId]);
    res.json({ triggers: result.rows });
  } catch (err) { next(err); }
};

exports.createTrigger = async (req, res, next) => {
  try {
    const { name, trigger_type, trigger_config, action_type, action_config } = req.body;
    const result = await db.query(
      `INSERT INTO email_triggers (workspace_id, name, trigger_type, trigger_config, action_type, action_config, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [req.workspaceId, name, trigger_type, JSON.stringify(trigger_config || {}), action_type, JSON.stringify(action_config || {}), req.user.id]
    );
    res.status(201).json({ trigger: result.rows[0] });
  } catch (err) { next(err); }
};

exports.toggleTrigger = async (req, res, next) => {
  try {
    const result = await db.query(
      'UPDATE email_triggers SET is_enabled = NOT is_enabled WHERE id = $1 AND workspace_id = $2 RETURNING is_enabled',
      [req.params.id, req.workspaceId]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Trigger not found' });
    res.json({ message: 'Trigger toggled', isEnabled: result.rows[0].is_enabled });
  } catch (err) { next(err); }
};

exports.getEmailAnalytics = async (req, res, next) => {
  try {
    const wsId = req.workspaceId;
    const { date_from, date_to } = req.query;
    let dateFilter = '';
    let params = [wsId];
    if (date_from && date_to) {
      dateFilter = ' AND sent_at BETWEEN $2 AND $3';
      params.push(date_from, date_to);
    }

    const overall = await db.query(
      `SELECT
         COUNT(*) as total_sent,
         COUNT(CASE WHEN opened_at IS NOT NULL THEN 1 END) as total_opened,
         COUNT(CASE WHEN clicked_at IS NOT NULL THEN 1 END) as total_clicked,
         COUNT(CASE WHEN replied_at IS NOT NULL THEN 1 END) as total_replied,
         COUNT(CASE WHEN status = 'bounced' THEN 1 END) as total_bounced,
         COUNT(CASE WHEN status = 'delivered' OR status = 'opened' OR status = 'clicked' THEN 1 END) as total_delivered
       FROM emails WHERE workspace_id = $1${dateFilter}`,
      params
    );

    const byTemplate = await db.query(
      `SELECT et.id, et.name, et.subject,
         COUNT(e.id) as sent,
         COUNT(CASE WHEN e.opened_at IS NOT NULL THEN 1 END) as opened,
         COUNT(CASE WHEN e.clicked_at IS NOT NULL THEN 1 END) as clicked
       FROM email_templates et LEFT JOIN emails e ON et.id = e.template_id
       WHERE et.workspace_id = $1 GROUP BY et.id, et.name, et.subject ORDER BY sent DESC`,
      [wsId]
    );

    const byAgent = await db.query(
      `SELECT u.id, u.first_name, u.last_name,
         COUNT(e.id) as sent,
         COUNT(CASE WHEN e.opened_at IS NOT NULL THEN 1 END) as opened,
         COUNT(CASE WHEN e.replied_at IS NOT NULL THEN 1 END) as replied
       FROM users u LEFT JOIN emails e ON u.id = e.user_id
       WHERE u.workspace_id = $1 GROUP BY u.id, u.first_name, u.last_name ORDER BY sent DESC`,
      [wsId]
    );

    const bestSubjectLines = await db.query(
      `SELECT subject, COUNT(*) as sent,
         COUNT(CASE WHEN opened_at IS NOT NULL THEN 1 END) as opened,
         ROUND(COUNT(CASE WHEN opened_at IS NOT NULL THEN 1 END)::numeric / NULLIF(COUNT(*), 0) * 100, 1) as open_rate
       FROM emails WHERE workspace_id = $1 AND subject IS NOT NULL
       GROUP BY subject ORDER BY open_rate DESC LIMIT 10`,
      [wsId]
    );

    const openHeatmap = await db.query(
      `SELECT EXTRACT(HOUR FROM opened_at) as hour, EXTRACT(DOW FROM opened_at) as day, COUNT(*) as count
       FROM emails WHERE workspace_id = $1 AND opened_at IS NOT NULL
       GROUP BY hour, day ORDER BY day, hour`,
      [wsId]
    );

    const stats = overall.rows[0];
    const totalSent = parseInt(stats.total_sent) || 1;
    const totalDelivered = parseInt(stats.total_delivered) || 1;

    res.json({
      overall: {
        totalSent: parseInt(stats.total_sent),
        totalOpened: parseInt(stats.total_opened),
        totalClicked: parseInt(stats.total_clicked),
        totalReplied: parseInt(stats.total_replied),
        totalBounced: parseInt(stats.total_bounced),
        deliveryRate: ((totalDelivered / totalSent) * 100).toFixed(1),
        openRate: ((parseInt(stats.total_opened) / totalSent) * 100).toFixed(1),
        clickRate: ((parseInt(stats.total_clicked) / totalSent) * 100).toFixed(1),
        replyRate: ((parseInt(stats.total_replied) / totalSent) * 100).toFixed(1),
      },
      byTemplate: byTemplate.rows,
      byAgent: byAgent.rows,
      bestSubjectLines: bestSubjectLines.rows,
      openHeatmap: openHeatmap.rows,
    });
  } catch (err) { next(err); }
};

exports.generateSubjectLines = async (req, res, next) => {
  try {
    const { topic, goal } = req.body;
    const OpenAI = require('openai');
    const openai = new OpenAI({ apiKey: require('../config').openai.apiKey });

    if (!openai.apiKey) {
      const fallback = [
        `${topic} - Quick Question`,
        `Re: ${topic}`,
        `Following up on ${topic}`,
        `${topic} - Any updates?`,
        `Quick thought about ${topic}`,
      ];
      return res.json({ subjectLines: fallback.map(s => ({ text: s, predictedOpenRate: 'N/A' })) });
    }

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: 'You are an email marketing expert. Generate 5 compelling email subject lines. Return as JSON array with "text" and "predictedOpenRate" fields.' },
        { role: 'user', content: `Topic: ${topic}. Goal: ${goal || 'get the lead to open and reply'}. Generate 5 subject lines.` },
      ],
      temperature: 0.8,
    });

    try {
      const parsed = JSON.parse(completion.choices[0].message.content);
      res.json({ subjectLines: parsed });
    } catch {
      const lines = completion.choices[0].message.content.split('\n').filter(l => l.trim()).slice(0, 5);
      res.json({ subjectLines: lines.map(l => ({ text: l.replace(/^\d+\.\s*/, ''), predictedOpenRate: 'N/A' })) });
    }
  } catch (err) {
    logger.error('AI subject line error:', err.message);
    res.json({ subjectLines: [{ text: `Re: ${req.body.topic}`, predictedOpenRate: 'N/A' }] });
  }
};

exports.trackOpen = async (req, res, next) => {
  try {
    const { trackingId } = req.params;
    await db.query(
      'UPDATE emails SET opened_at = COALESCE(opened_at, NOW()), open_count = open_count + 1 WHERE tracking_pixel_id = $1',
      [trackingId]
    );
    res.set('Content-Type', 'image/gif');
    res.send(Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64'));
  } catch (err) {
    res.set('Content-Type', 'image/gif');
    res.send(Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64'));
  }
};

exports.unsubscribe = async (req, res, next) => {
  try {
    const { trackingId } = req.params;
    const emailResult = await db.query('SELECT lead_id FROM emails WHERE tracking_pixel_id = $1', [trackingId]);
    if (emailResult.rows.length > 0) {
      await db.query('UPDATE leads SET is_unsubscribed = true WHERE id = $1', [emailResult.rows[0].lead_id]);
    }
    res.send('<html><body><h2>You have been unsubscribed.</h2><p>You will no longer receive emails from us.</p></body></html>');
  } catch (err) {
    res.status(500).send('Error processing unsubscribe');
  }
};

exports.handleWebhook = async (req, res, next) => {
  try {
    const events = Array.isArray(req.body) ? req.body : [req.body];
    for (const event of events) {
      await handleEmailEvent({
        tracking_id: event.tracking_id || event.custom_args?.tracking_id,
        event: event.event,
        timestamp: event.timestamp,
        reason: event.reason,
      });
    }
    res.json({ success: true });
  } catch (err) { next(err); }
};
