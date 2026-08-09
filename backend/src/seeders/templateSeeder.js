const db = require('../config/database');
const { extractVariables } = require('../utils/variables');
const logger = require('../utils/logger');

const templates = [
  // Welcome
  {
    name: 'Welcome New Lead',
    subject: 'Welcome to {{Company_Name}}, {{First_Name}}!',
    body: '<h2>Hello {{First_Name}}!</h2><p>Thank you for your interest in {{Company_Name}}. We\'re excited to help you find the perfect solution.</p><p>Your dedicated agent, {{Agent_Name}}, will be in touch with you shortly to answer any questions you may have.</p><p>Best regards,<br>The {{Company_Name}} Team</p>',
    category: 'welcome',
  },
  {
    name: 'Welcome Onboarding',
    subject: 'Getting started with {{Company_Name}} — your next steps',
    body: '<p>Hi {{First_Name}},</p><p>Welcome aboard! Here\'s what happens next:</p><ol><li>Your agent {{Agent_Name}} will reach out within 24 hours</li><li>We\'ll schedule a consultation call</li><li>You\'ll receive a personalized proposal</li></ol><p>Feel free to reach out anytime at {{Agent_Email}} or {{Agent_Phone}}.</p><p>Welcome aboard!<br>{{Company_Name}}</p>',
    category: 'welcome',
  },
  // First Contact
  {
    name: 'First Contact Introduction',
    subject: 'Reaching out regarding your inquiry, {{First_Name}}',
    body: '<p>Hi {{First_Name}},</p><p>I\'m {{Agent_Name}} from {{Company_Name}}. I noticed your interest and wanted to reach out personally.</p><p>I\'d love to learn more about what you\'re looking for and how we can help. Are you available for a quick call this week?</p><p>Looking forward to hearing from you!<br>Best,<br>{{Agent_Name}}<br>{{Agent_Phone}} | {{Agent_Email}}</p>',
    category: 'first_contact',
  },
  {
    name: 'First Contact Quick Follow',
    subject: 'Quick question about your interest, {{First_Name}}',
    body: '<p>Hi {{First_Name}},</p><p>Thanks for showing interest in {{Company_Name}}! I wanted to quickly introduce myself as your point of contact.</p><p>What\'s the best time to reach you for a 10-minute chat?</p><p>Best,<br>{{Agent_Name}}</p>',
    category: 'first_contact',
  },
  // Follow-up
  {
    name: 'Follow-up After No Response',
    subject: 'Just checking in, {{First_Name}}',
    body: '<p>Hi {{First_Name}},</p><p>I reached out a few days ago and wanted to follow up — I know things can get busy!</p><p>Whenever you have a moment, I\'d love to connect. Even a quick reply would help me understand how best to assist you.</p><p>Best,<br>{{Agent_Name}}</p>',
    category: 'follow_up',
  },
  {
    name: 'Follow-up After Initial Call',
    subject: 'Great speaking with you, {{First_Name}}!',
    body: '<p>Hi {{First_Name}},</p><p>It was great speaking with you earlier. As discussed, I\'ve attached some additional information that I think you\'ll find helpful.</p><p>If you have any questions or need further clarification, don\'t hesitate to reach out.</p><p>Best regards,<br>{{Agent_Name}}</p>',
    category: 'follow_up',
  },
  // Sales
  {
    name: 'Sales Pitch with Benefits',
    subject: 'How {{Company_Name}} can help you, {{First_Name}}',
    body: '<p>Hi {{First_Name}},</p><p>Based on your interest, I wanted to share how {{Company_Name}} can specifically help you:</p><ul><li>Tailored solutions to fit your needs</li><li>Expert guidance every step of the way</li><li>Competitive pricing and flexible options</li></ul><p>Would you like to schedule a demo? I\'m available at {{Agent_Phone}} or {{Agent_Email}}.</p><p>Best,<br>{{Agent_Name}}</p>',
    category: 'sales',
  },
  {
    name: 'Sales Special Offer',
    subject: 'Special offer for {{First_Name}} — limited time',
    body: '<p>Hi {{First_Name}},</p><p>As a valued prospect, I wanted to let you know about a special offer we\'re currently running.</p><p>For a limited time, we\'re offering exclusive pricing on our premium packages. This won\'t last long!</p><p>Would you like to learn more? Reply to this email or call me at {{Agent_Phone}}.</p><p>Best,<br>{{Agent_Name}}<br>{{Company_Name}}</p>',
    category: 'sales',
  },
  // Proposal
  {
    name: 'Proposal Submission',
    subject: 'Your personalized proposal from {{Company_Name}}',
    body: '<p>Dear {{First_Name}},</p><p>Thank you for your patience. I\'m pleased to share your personalized proposal with you.</p><p>The proposal includes detailed pricing, timelines, and deliverables tailored to your specific requirements.</p><p>Please review it at your convenience, and I\'m happy to discuss any questions or adjustments.</p><p>Best regards,<br>{{Agent_Name}}<br>{{Agent_Phone}} | {{Agent_Email}}</p>',
    category: 'proposal',
  },
  // Meeting Reminder
  {
    name: 'Meeting Reminder',
    subject: 'Reminder: Your meeting with {{Agent_Name}} tomorrow',
    body: '<p>Hi {{First_Name}},</p><p>This is a friendly reminder about our scheduled meeting tomorrow.</p><p>If you need to reschedule, please let me know as soon as possible. I\'m happy to accommodate your schedule.</p><p>Looking forward to our conversation!</p><p>Best,<br>{{Agent_Name}}<br>{{Company_Name}}</p>',
    category: 'meeting_reminder',
  },
  // Thank You
  {
    name: 'Thank You After Meeting',
    subject: 'Thank you for your time, {{First_Name}}',
    body: '<p>Hi {{First_Name}},</p><p>Thank you for taking the time to meet with me today. I really appreciated learning more about your needs and goals.</p><p>As promised, I\'ll follow up with the next steps shortly. In the meantime, if anything comes to mind, feel free to reach out.</p><p>Best regards,<br>{{Agent_Name}}</p>',
    category: 'thank_you',
  },
  {
    name: 'Thank You for Purchase',
    subject: 'Welcome aboard, {{First_Name}} — thank you!',
    body: '<p>Dear {{First_Name}},</p><p>Thank you for choosing {{Company_Name}}! We\'re thrilled to have you on board.</p><p>Your satisfaction is our top priority. If you ever need assistance, your dedicated contact is {{Agent_Name}} at {{Agent_Email}}.</p><p>Welcome to the family!<br>{{Company_Name}}</p>',
    category: 'thank_you',
  },
  // Re-engagement
  {
    name: 'Re-engagement Cold Lead',
    subject: 'We miss you, {{First_Name}} — here\'s what\'s new',
    body: '<p>Hi {{First_Name}},</p><p>It\'s been a while since we last connected, and I wanted to reach out with some exciting updates.</p><p>We\'ve launched new features and offerings that I think you\'ll love. Would you be interested in a quick catch-up call?</p><p>I\'d love to reconnect and see how we can help you now.</p><p>Best,<br>{{Agent_Name}}<br>{{Company_Name}}</p>',
    category: 're_engagement',
  },
  // Customer Success
  {
    name: 'Customer Success Check-in',
    subject: 'How are things going, {{First_Name}}?',
    body: '<p>Hi {{First_Name}},</p><p>I wanted to check in and see how everything is going with your experience so far.</p><p>Your success is important to us, and I want to make sure you\'re getting the most out of what we offer. Is there anything I can help with?</p><p>Looking forward to hearing from you!<br>{{Agent_Name}}<br>{{Company_Name}}</p>',
    category: 'customer_success',
  },
  // Promotional
  {
    name: 'Promotional Announcement',
    subject: 'Something exciting is here, {{First_Name}}!',
    body: '<p>Hi {{First_Name}},</p><p>We\'ve got something big to share! {{Company_Name}} is launching a new offering, and as one of our valued contacts, you\'re among the first to know.</p><p>This is a limited-time opportunity, so don\'t miss out. Reply to this email or call {{Agent_Phone}} to learn more.</p><p>Excited to share this with you!<br>{{Agent_Name}}<br>{{Company_Name}}</p>',
    category: 'promotional',
  },
];

async function seedTemplates(workspaceId, userId) {
  for (const tpl of templates) {
    const variables = extractVariables(tpl.subject + ' ' + tpl.body);
    const existing = await db.query(
      'SELECT id FROM email_templates WHERE workspace_id = $1 AND name = $2',
      [workspaceId, tpl.name]
    );
    if (existing.rows.length === 0) {
      await db.query(
        `INSERT INTO email_templates (workspace_id, name, subject, body, category, variables, is_draft, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, FALSE, $7)`,
        [workspaceId, tpl.name, tpl.subject, tpl.body, tpl.category, JSON.stringify(variables), userId]
      );
      logger.info(`Seeded template: ${tpl.name}`);
    }
  }
  logger.info(`Template seeding complete. ${templates.length} templates processed.`);
}

async function run() {
  try {
    const wsRes = await db.query('SELECT id FROM workspaces ORDER BY created_at LIMIT 1');
    if (wsRes.rows.length === 0) {
      logger.error('No workspaces found. Create a workspace first.');
      process.exit(1);
    }
    const workspaceId = wsRes.rows[0].id;
    const userRes = await db.query('SELECT id FROM users WHERE workspace_id = $1 ORDER BY created_at LIMIT 1', [workspaceId]);
    if (userRes.rows.length === 0) {
      logger.error('No users found in workspace.');
      process.exit(1);
    }
    const userId = userRes.rows[0].id;
    await seedTemplates(workspaceId, userId);
    process.exit(0);
  } catch (err) {
    logger.error('Template seed error:', err.message);
    process.exit(1);
  }
}

if (require.main === module) {
  run();
}

module.exports = { seedTemplates, templates };
