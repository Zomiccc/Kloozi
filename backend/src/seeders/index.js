const db = require('../config/database');
const bcrypt = require('bcryptjs');
const logger = require('../utils/logger');

async function seed() {
  logger.info('Starting database seed...');

  try {
    const passwordHash = await bcrypt.hash('password123', 12);

    const workspaceResult = await db.query(
      `INSERT INTO workspaces (name, slug, plan, subscription_status)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name
       RETURNING id`,
      ['Demo Company', 'demo-company', 'business', 'active']
    );
    const workspaceId = workspaceResult.rows[0].id;

    const adminResult = await db.query(
      `INSERT INTO users (workspace_id, email, password_hash, first_name, last_name, role, status, phone)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (email) DO UPDATE SET first_name = EXCLUDED.first_name
       RETURNING id`,
      [workspaceId, 'admin@demo.com', passwordHash, 'John', 'Admin', 'admin', 'active', '+1234567890']
    );
    const adminId = adminResult.rows[0].id;

    const managerResult = await db.query(
      `INSERT INTO users (workspace_id, email, password_hash, first_name, last_name, role, status, phone)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (email) DO UPDATE SET first_name = EXCLUDED.first_name
       RETURNING id`,
      [workspaceId, 'manager@demo.com', passwordHash, 'Sarah', 'Manager', 'sales_manager', 'active', '+1234567891']
    );
    const managerId = managerResult.rows[0].id;

    const agent1Result = await db.query(
      `INSERT INTO users (workspace_id, email, password_hash, first_name, last_name, role, status, phone)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (email) DO UPDATE SET first_name = EXCLUDED.first_name
       RETURNING id`,
      [workspaceId, 'agent1@demo.com', passwordHash, 'Mike', 'Agent', 'sales_agent', 'active', '+1234567892']
    );
    const agent1Id = agent1Result.rows[0].id;

    const agent2Result = await db.query(
      `INSERT INTO users (workspace_id, email, password_hash, first_name, last_name, role, status, phone)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (email) DO UPDATE SET first_name = EXCLUDED.first_name
       RETURNING id`,
      [workspaceId, 'agent2@demo.com', passwordHash, 'Lisa', 'Agent', 'sales_agent', 'active', '+1234567893']
    );
    const agent2Id = agent2Result.rows[0].id;

    await db.query(
      `INSERT INTO subscriptions (workspace_id, plan, status, agent_limit)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (workspace_id) DO UPDATE SET plan = EXCLUDED.plan`,
      [workspaceId, 'business', 'active', 20]
    );

    const stages = ['New', 'Contacted', 'Interested', 'Negotiating', 'Won', 'Lost'];
    const stageIds = [];
    for (let i = 0; i < stages.length; i++) {
      const result = await db.query(
        `INSERT INTO lead_stages (workspace_id, name, sort_order, is_default, is_won, is_lost)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT DO NOTHING
         RETURNING id`,
        [workspaceId, stages[i], i, i === 0, stages[i] === 'Won', stages[i] === 'Lost']
      );
      if (result.rows.length > 0) stageIds.push(result.rows[0].id);
    }

    const defaultStageId = stageIds[0] || null;

    const sampleLeads = [
      { first_name: 'Alice', last_name: 'Cooper', phone: '+15550001', email: 'alice@example.com', city: 'New York', budget: 75000, lead_source: 'facebook', stage: 'new', assigned_to: agent1Id },
      { first_name: 'Bob', last_name: 'Smith', phone: '+15550002', email: 'bob@example.com', city: 'Los Angeles', budget: 120000, lead_source: 'google', stage: 'contacted', assigned_to: agent1Id },
      { first_name: 'Carol', last_name: 'Jones', phone: '+15550003', email: 'carol@example.com', city: 'Chicago', budget: 50000, lead_source: 'website', stage: 'interested', assigned_to: agent2Id },
      { first_name: 'David', last_name: 'Wilson', phone: '+15550004', email: 'david@example.com', city: 'Houston', budget: 200000, lead_source: 'tiktok', stage: 'negotiating', assigned_to: agent1Id },
      { first_name: 'Eve', last_name: 'Brown', phone: '+15550005', email: 'eve@example.com', city: 'Phoenix', budget: 95000, lead_source: 'instagram', stage: 'won', assigned_to: agent2Id },
      { first_name: 'Frank', last_name: 'Miller', phone: '+15550006', email: 'frank@example.com', city: 'Philadelphia', budget: 30000, lead_source: 'manual', stage: 'lost', assigned_to: agent1Id },
      { first_name: 'Grace', last_name: 'Davis', phone: '+15550007', email: 'grace@example.com', city: 'San Antonio', budget: 80000, lead_source: 'facebook', stage: 'new', assigned_to: agent2Id },
      { first_name: 'Henry', last_name: 'Garcia', phone: '+15550008', email: 'henry@example.com', city: 'San Diego', budget: 150000, lead_source: 'google', stage: 'contacted', assigned_to: agent1Id },
      { first_name: 'Ivy', last_name: 'Rodriguez', phone: '+15550009', email: 'ivy@example.com', city: 'Dallas', budget: 65000, lead_source: 'website', stage: 'interested', assigned_to: agent2Id },
      { first_name: 'Jack', last_name: 'Martinez', phone: '+15550010', email: 'jack@example.com', city: 'San Jose', budget: 110000, lead_source: 'zapier', stage: 'negotiating', assigned_to: agent1Id },
    ];

    for (const lead of sampleLeads) {
      await db.query(
        `INSERT INTO leads (workspace_id, first_name, last_name, phone, email, city, budget, lead_source, stage, assigned_to, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
        [workspaceId, lead.first_name, lead.last_name, lead.phone, lead.email, lead.city, lead.budget, lead.lead_source, lead.stage, lead.assigned_to, adminId]
      );
    }

    await db.query(
      `INSERT INTO email_templates (workspace_id, name, subject, body, category, created_by)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [workspaceId, 'Welcome Email', 'Welcome to Demo Company, {{First_Name}}!', '<h2>Hello {{First_Name}}!</h2><p>Thank you for your interest. {{Agent_Name}} will be in touch with you shortly.</p><p>Best regards,<br>{{Company_Name}}</p>', 'intro', adminId]
    );

    await db.query(
      `INSERT INTO email_templates (workspace_id, name, subject, body, category, created_by)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [workspaceId, 'Follow Up Email', 'Following up on your inquiry, {{First_Name}}', '<p>Hi {{First_Name}},</p><p>I wanted to follow up on your recent inquiry. Do you have any questions I can answer?</p><p>Best,<br>{{Agent_Name}}</p>', 'follow_up', adminId]
    );

    await db.query(
      `INSERT INTO whatsapp_templates (workspace_id, name, category, content)
       VALUES ($1, $2, $3, $4)`,
      [workspaceId, 'Welcome WhatsApp', 'intro', 'Hi {{First_Name}}! Thank you for your interest. This is {{Agent_Name}} from {{Company_Name}}. How can I help you today?']
    );

    await db.query(
      `INSERT INTO sms_templates (workspace_id, name, content)
       VALUES ($1, $2, $3)`,
      [workspaceId, 'Welcome SMS', 'Hi {{First_Name}}, thanks for your interest! {{Agent_Name}} from {{Company_Name}} will contact you soon.']
    );

    await db.query(
      `INSERT INTO lead_tags (workspace_id, name, color) VALUES ($1, $2, $3)`,
      [workspaceId, 'VIP', '#ef4444']
    );
    await db.query(
      `INSERT INTO lead_tags (workspace_id, name, color) VALUES ($1, $2, $3)`,
      [workspaceId, 'Hot Lead', '#f97316']
    );
    await db.query(
      `INSERT INTO lead_tags (workspace_id, name, color) VALUES ($1, $2, $3)`,
      [workspaceId, 'Cold Lead', '#3b82f6']
    );

    logger.info('Seed completed successfully!');
    logger.info('Demo accounts:');
    logger.info('  Admin: admin@demo.com / password123');
    logger.info('  Manager: manager@demo.com / password123');
    logger.info('  Agent 1: agent1@demo.com / password123');
    logger.info('  Agent 2: agent2@demo.com / password123');
  } catch (err) {
    logger.error('Seed error:', err.message);
    throw err;
  }
}

if (require.main === module) {
  seed().then(() => process.exit(0)).catch((err) => { console.error(err); process.exit(1); });
}

module.exports = { seed };
