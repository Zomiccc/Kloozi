const db = require('../config/database');
const logger = require('../utils/logger');

const migrations = [
  {
    name: '001_create_workspaces_and_users',
    sql: `
      CREATE TABLE IF NOT EXISTS workspaces (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        slug TEXT UNIQUE,
        plan TEXT DEFAULT 'free',
        subscription_status TEXT DEFAULT 'active',
        stripe_customer_id TEXT,
        stripe_subscription_id TEXT,
        trial_ends_at TEXT,
        settings TEXT DEFAULT '{}',
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        workspace_id TEXT REFERENCES workspaces(id) ON DELETE CASCADE,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT,
        first_name TEXT,
        last_name TEXT,
        phone TEXT,
        profile_image TEXT,
        role TEXT DEFAULT 'sales_agent',
        status TEXT DEFAULT 'active',
        designation TEXT,
        google_id TEXT,
        two_factor_enabled INTEGER DEFAULT 0,
        two_factor_secret TEXT,
        invitation_token TEXT,
        invitation_accepted_at TEXT,
        last_activity_at TEXT DEFAULT (datetime('now')),
        notification_preferences TEXT DEFAULT '{}',
        quiet_hours_start TEXT DEFAULT '22:00',
        quiet_hours_end TEXT DEFAULT '08:00',
        language TEXT DEFAULT 'en',
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      );

      CREATE INDEX IF NOT EXISTS idx_users_workspace ON users(workspace_id);
      CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
      CREATE INDEX IF NOT EXISTS idx_users_invitation_token ON users(invitation_token);
    `
  },
  {
    name: '002_create_leads_tables',
    sql: `
      CREATE TABLE IF NOT EXISTS lead_stages (
        id TEXT PRIMARY KEY,
        workspace_id TEXT REFERENCES workspaces(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        color TEXT DEFAULT '#6b7280',
        sort_order INTEGER DEFAULT 0,
        is_default INTEGER DEFAULT 0,
        is_won INTEGER DEFAULT 0,
        is_lost INTEGER DEFAULT 0,
        created_at TEXT DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS leads (
        id TEXT PRIMARY KEY,
        workspace_id TEXT REFERENCES workspaces(id) ON DELETE CASCADE,
        first_name TEXT,
        last_name TEXT,
        phone TEXT,
        email TEXT,
        city TEXT,
        budget REAL,
        lead_source TEXT DEFAULT 'manual',
        stage_id TEXT REFERENCES lead_stages(id),
        stage TEXT DEFAULT 'new',
        notes TEXT,
        custom_fields TEXT DEFAULT '[]',
        tags TEXT DEFAULT '[]',
        score INTEGER DEFAULT 0,
        assigned_to TEXT REFERENCES users(id),
        created_by TEXT REFERENCES users(id),
        last_activity_at TEXT DEFAULT (datetime('now')),
        follow_up_date TEXT,
        follow_up_type TEXT,
        follow_up_notes TEXT,
        is_unsubscribed INTEGER DEFAULT 0,
        metadata TEXT DEFAULT '{}',
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      );

      CREATE INDEX IF NOT EXISTS idx_leads_workspace ON leads(workspace_id);
      CREATE INDEX IF NOT EXISTS idx_leads_assigned ON leads(assigned_to);
      CREATE INDEX IF NOT EXISTS idx_leads_stage ON leads(stage);
      CREATE INDEX IF NOT EXISTS idx_leads_phone ON leads(phone);
      CREATE INDEX IF NOT EXISTS idx_leads_email ON leads(email);
      CREATE INDEX IF NOT EXISTS idx_leads_source ON leads(lead_source);
      CREATE INDEX IF NOT EXISTS idx_leads_city ON leads(city);
      CREATE INDEX IF NOT EXISTS idx_leads_follow_up ON leads(follow_up_date);
      CREATE INDEX IF NOT EXISTS idx_leads_created_at ON leads(created_at);

      CREATE TABLE IF NOT EXISTS lead_activities (
        id TEXT PRIMARY KEY,
        workspace_id TEXT REFERENCES workspaces(id) ON DELETE CASCADE,
        lead_id TEXT REFERENCES leads(id) ON DELETE CASCADE,
        user_id TEXT REFERENCES users(id),
        type TEXT NOT NULL,
        description TEXT,
        metadata TEXT DEFAULT '{}',
        created_at TEXT DEFAULT (datetime('now'))
      );

      CREATE INDEX IF NOT EXISTS idx_activities_lead ON lead_activities(lead_id);
      CREATE INDEX IF NOT EXISTS idx_activities_workspace ON lead_activities(workspace_id);
      CREATE INDEX IF NOT EXISTS idx_activities_type ON lead_activities(type);
      CREATE INDEX IF NOT EXISTS idx_activities_created ON lead_activities(created_at);

      CREATE TABLE IF NOT EXISTS lead_tags (
        id TEXT PRIMARY KEY,
        workspace_id TEXT REFERENCES workspaces(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        color TEXT DEFAULT '#3b82f6',
        created_at TEXT DEFAULT (datetime('now')),
        UNIQUE(workspace_id, name)
      );

      CREATE TABLE IF NOT EXISTS lead_groups (
        id TEXT PRIMARY KEY,
        workspace_id TEXT REFERENCES workspaces(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        type TEXT DEFAULT 'static',
        filter_config TEXT DEFAULT '{}',
        created_by TEXT REFERENCES users(id),
        created_at TEXT DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS lead_custom_fields (
        id TEXT PRIMARY KEY,
        workspace_id TEXT REFERENCES workspaces(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        type TEXT DEFAULT 'text',
        options TEXT DEFAULT '[]',
        is_required INTEGER DEFAULT 0,
        sort_order INTEGER DEFAULT 0,
        created_at TEXT DEFAULT (datetime('now'))
      );
    `
  },
  {
    name: '003_create_followups_calls',
    sql: `
      CREATE TABLE IF NOT EXISTS follow_ups (
        id TEXT PRIMARY KEY,
        workspace_id TEXT REFERENCES workspaces(id) ON DELETE CASCADE,
        lead_id TEXT REFERENCES leads(id) ON DELETE CASCADE,
        user_id TEXT REFERENCES users(id),
        type TEXT NOT NULL,
        title TEXT,
        notes TEXT,
        due_date TEXT NOT NULL,
        status TEXT DEFAULT 'pending',
        completed_at TEXT,
        snoozed_until TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      );

      CREATE INDEX IF NOT EXISTS idx_followups_workspace ON follow_ups(workspace_id);
      CREATE INDEX IF NOT EXISTS idx_followups_lead ON follow_ups(lead_id);
      CREATE INDEX IF NOT EXISTS idx_followups_user ON follow_ups(user_id);
      CREATE INDEX IF NOT EXISTS idx_followups_due ON follow_ups(due_date);
      CREATE INDEX IF NOT EXISTS idx_followups_status ON follow_ups(status);

      CREATE TABLE IF NOT EXISTS calls (
        id TEXT PRIMARY KEY,
        workspace_id TEXT REFERENCES workspaces(id) ON DELETE CASCADE,
        lead_id TEXT REFERENCES leads(id) ON DELETE CASCADE,
        user_id TEXT REFERENCES users(id),
        phone_number TEXT,
        outcome TEXT,
        notes TEXT,
        duration_seconds INTEGER DEFAULT 0,
        follow_up_scheduled TEXT,
        created_at TEXT DEFAULT (datetime('now'))
      );

      CREATE INDEX IF NOT EXISTS idx_calls_workspace ON calls(workspace_id);
      CREATE INDEX IF NOT EXISTS idx_calls_lead ON calls(lead_id);
      CREATE INDEX IF NOT EXISTS idx_calls_user ON calls(user_id);
      CREATE INDEX IF NOT EXISTS idx_calls_created ON calls(created_at);
    `
  },
  {
    name: '004_create_messaging_tables',
    sql: `
      CREATE TABLE IF NOT EXISTS whatsapp_messages (
        id TEXT PRIMARY KEY,
        workspace_id TEXT REFERENCES workspaces(id) ON DELETE CASCADE,
        lead_id TEXT REFERENCES leads(id) ON DELETE CASCADE,
        user_id TEXT REFERENCES users(id),
        direction TEXT DEFAULT 'outbound',
        message_text TEXT,
        template_name TEXT,
        media_url TEXT,
        media_type TEXT,
        status TEXT DEFAULT 'pending',
        wa_message_id TEXT,
        sent_at TEXT,
        delivered_at TEXT,
        read_at TEXT,
        error_message TEXT,
        created_at TEXT DEFAULT (datetime('now'))
      );

      CREATE INDEX IF NOT EXISTS idx_wa_workspace ON whatsapp_messages(workspace_id);
      CREATE INDEX IF NOT EXISTS idx_wa_lead ON whatsapp_messages(lead_id);
      CREATE INDEX IF NOT EXISTS idx_wa_status ON whatsapp_messages(status);

      CREATE TABLE IF NOT EXISTS whatsapp_templates (
        id TEXT PRIMARY KEY,
        workspace_id TEXT REFERENCES workspaces(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        category TEXT DEFAULT 'intro',
        content TEXT NOT NULL,
        variables TEXT DEFAULT '[]',
        created_at TEXT DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS sms_messages (
        id TEXT PRIMARY KEY,
        workspace_id TEXT REFERENCES workspaces(id) ON DELETE CASCADE,
        lead_id TEXT REFERENCES leads(id) ON DELETE CASCADE,
        user_id TEXT REFERENCES users(id),
        direction TEXT DEFAULT 'outbound',
        message_text TEXT,
        template_name TEXT,
        status TEXT DEFAULT 'pending',
        twilio_message_id TEXT,
        sent_at TEXT,
        delivered_at TEXT,
        error_message TEXT,
        created_at TEXT DEFAULT (datetime('now'))
      );

      CREATE INDEX IF NOT EXISTS idx_sms_workspace ON sms_messages(workspace_id);
      CREATE INDEX IF NOT EXISTS idx_sms_lead ON sms_messages(lead_id);
      CREATE INDEX IF NOT EXISTS idx_sms_status ON sms_messages(status);

      CREATE TABLE IF NOT EXISTS sms_templates (
        id TEXT PRIMARY KEY,
        workspace_id TEXT REFERENCES workspaces(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        content TEXT NOT NULL,
        variables TEXT DEFAULT '[]',
        created_at TEXT DEFAULT (datetime('now'))
      );
    `
  },
  {
    name: '005_create_email_marketing_tables',
    sql: `
      CREATE TABLE IF NOT EXISTS email_templates (
        id TEXT PRIMARY KEY,
        workspace_id TEXT REFERENCES workspaces(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        subject TEXT,
        body TEXT NOT NULL,
        category TEXT DEFAULT 'intro',
        variables TEXT DEFAULT '[]',
        is_draft INTEGER DEFAULT 0,
        created_by TEXT REFERENCES users(id),
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      );

      CREATE INDEX IF NOT EXISTS idx_email_templates_workspace ON email_templates(workspace_id);

      CREATE TABLE IF NOT EXISTS emails (
        id TEXT PRIMARY KEY,
        workspace_id TEXT REFERENCES workspaces(id) ON DELETE CASCADE,
        lead_id TEXT REFERENCES leads(id) ON DELETE CASCADE,
        user_id TEXT REFERENCES users(id),
        template_id TEXT REFERENCES email_templates(id),
        campaign_id TEXT,
        sequence_id TEXT,
        subject TEXT,
        body TEXT,
        from_email TEXT,
        from_name TEXT,
        reply_to TEXT,
        status TEXT DEFAULT 'pending',
        sendgrid_message_id TEXT,
        sent_at TEXT,
        opened_at TEXT,
        clicked_at TEXT,
        replied_at TEXT,
        bounced_at TEXT,
        open_count INTEGER DEFAULT 0,
        click_count INTEGER DEFAULT 0,
        tracking_pixel_id TEXT,
        error_message TEXT,
        created_at TEXT DEFAULT (datetime('now'))
      );

      CREATE INDEX IF NOT EXISTS idx_emails_workspace ON emails(workspace_id);
      CREATE INDEX IF NOT EXISTS idx_emails_lead ON emails(lead_id);
      CREATE INDEX IF NOT EXISTS idx_emails_status ON emails(status);
      CREATE INDEX IF NOT EXISTS idx_emails_campaign ON emails(campaign_id);
      CREATE INDEX IF NOT EXISTS idx_emails_tracking ON emails(tracking_pixel_id);

      CREATE TABLE IF NOT EXISTS email_sequences (
        id TEXT PRIMARY KEY,
        workspace_id TEXT REFERENCES workspaces(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        type TEXT DEFAULT 'custom',
        description TEXT,
        is_active INTEGER DEFAULT 1,
        created_by TEXT REFERENCES users(id),
        created_at TEXT DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS email_sequence_steps (
        id TEXT PRIMARY KEY,
        sequence_id TEXT REFERENCES email_sequences(id) ON DELETE CASCADE,
        template_id TEXT REFERENCES email_templates(id),
        step_number INTEGER NOT NULL,
        delay_hours INTEGER DEFAULT 0,
        delay_days INTEGER DEFAULT 0,
        condition_type TEXT,
        condition_value TEXT DEFAULT '{}',
        created_at TEXT DEFAULT (datetime('now'))
      );

      CREATE INDEX IF NOT EXISTS idx_seq_steps_sequence ON email_sequence_steps(sequence_id);

      CREATE TABLE IF NOT EXISTS email_sequence_enrollments (
        id TEXT PRIMARY KEY,
        sequence_id TEXT REFERENCES email_sequences(id) ON DELETE CASCADE,
        lead_id TEXT REFERENCES leads(id) ON DELETE CASCADE,
        workspace_id TEXT REFERENCES workspaces(id) ON DELETE CASCADE,
        current_step INTEGER DEFAULT 1,
        status TEXT DEFAULT 'active',
        enrolled_at TEXT DEFAULT (datetime('now')),
        last_step_at TEXT,
        next_step_at TEXT,
        UNIQUE(sequence_id, lead_id)
      );

      CREATE INDEX IF NOT EXISTS idx_enrollments_sequence ON email_sequence_enrollments(sequence_id);
      CREATE INDEX IF NOT EXISTS idx_enrollments_lead ON email_sequence_enrollments(lead_id);
      CREATE INDEX IF NOT EXISTS idx_enrollments_status ON email_sequence_enrollments(status);

      CREATE TABLE IF NOT EXISTS email_flows (
        id TEXT PRIMARY KEY,
        workspace_id TEXT REFERENCES workspaces(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        description TEXT,
        is_active INTEGER DEFAULT 0,
        is_published INTEGER DEFAULT 0,
        version INTEGER DEFAULT 1,
        created_by TEXT REFERENCES users(id),
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS email_flow_nodes (
        id TEXT PRIMARY KEY,
        flow_id TEXT REFERENCES email_flows(id) ON DELETE CASCADE,
        node_type TEXT NOT NULL,
        node_key TEXT NOT NULL,
        position_x REAL DEFAULT 0,
        position_y REAL DEFAULT 0,
        config TEXT DEFAULT '{}',
        created_at TEXT DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS email_flow_edges (
        id TEXT PRIMARY KEY,
        flow_id TEXT REFERENCES email_flows(id) ON DELETE CASCADE,
        source_node_key TEXT NOT NULL,
        target_node_key TEXT NOT NULL,
        condition_label TEXT,
        created_at TEXT DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS email_flow_enrollments (
        id TEXT PRIMARY KEY,
        flow_id TEXT REFERENCES email_flows(id) ON DELETE CASCADE,
        lead_id TEXT REFERENCES leads(id) ON DELETE CASCADE,
        workspace_id TEXT REFERENCES workspaces(id) ON DELETE CASCADE,
        current_node_key TEXT,
        status TEXT DEFAULT 'active',
        enrolled_at TEXT DEFAULT (datetime('now')),
        next_action_at TEXT,
        UNIQUE(flow_id, lead_id)
      );

      CREATE TABLE IF NOT EXISTS email_triggers (
        id TEXT PRIMARY KEY,
        workspace_id TEXT REFERENCES workspaces(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        trigger_type TEXT NOT NULL,
        trigger_config TEXT DEFAULT '{}',
        action_type TEXT NOT NULL,
        action_config TEXT DEFAULT '{}',
        is_enabled INTEGER DEFAULT 1,
        created_by TEXT REFERENCES users(id),
        created_at TEXT DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS email_trigger_logs (
        id TEXT PRIMARY KEY,
        trigger_id TEXT REFERENCES email_triggers(id) ON DELETE CASCADE,
        workspace_id TEXT REFERENCES workspaces(id) ON DELETE CASCADE,
        lead_id TEXT REFERENCES leads(id),
        fired_at TEXT DEFAULT (datetime('now'))
      );
    `
  },
  {
    name: '006_create_campaigns',
    sql: `
      CREATE TABLE IF NOT EXISTS campaigns (
        id TEXT PRIMARY KEY,
        workspace_id TEXT REFERENCES workspaces(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        type TEXT NOT NULL,
        channel TEXT NOT NULL,
        template_id TEXT,
        subject TEXT,
        body TEXT,
        recipients_count INTEGER DEFAULT 0,
        sent_count INTEGER DEFAULT 0,
        delivered_count INTEGER DEFAULT 0,
        opened_count INTEGER DEFAULT 0,
        clicked_count INTEGER DEFAULT 0,
        replied_count INTEGER DEFAULT 0,
        failed_count INTEGER DEFAULT 0,
        status TEXT DEFAULT 'draft',
        scheduled_at TEXT,
        started_at TEXT,
        completed_at TEXT,
        created_by TEXT REFERENCES users(id),
        filter_config TEXT DEFAULT '{}',
        ab_test_enabled INTEGER DEFAULT 0,
        ab_variant_b_template_id TEXT,
        ab_split_percentage INTEGER DEFAULT 50,
        ab_winner_declared INTEGER DEFAULT 0,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      );

      CREATE INDEX IF NOT EXISTS idx_campaigns_workspace ON campaigns(workspace_id);
      CREATE INDEX IF NOT EXISTS idx_campaigns_status ON campaigns(status);
      CREATE INDEX IF NOT EXISTS idx_campaigns_type ON campaigns(type);

      CREATE TABLE IF NOT EXISTS campaign_recipients (
        id TEXT PRIMARY KEY,
        campaign_id TEXT REFERENCES campaigns(id) ON DELETE CASCADE,
        lead_id TEXT REFERENCES leads(id) ON DELETE CASCADE,
        workspace_id TEXT REFERENCES workspaces(id) ON DELETE CASCADE,
        status TEXT DEFAULT 'pending',
        variant TEXT DEFAULT 'a',
        sent_at TEXT,
        opened_at TEXT,
        clicked_at TEXT,
        replied_at TEXT,
        error_message TEXT,
        created_at TEXT DEFAULT (datetime('now'))
      );

      CREATE INDEX IF NOT EXISTS idx_recipients_campaign ON campaign_recipients(campaign_id);
      CREATE INDEX IF NOT EXISTS idx_recipients_lead ON campaign_recipients(lead_id);
    `
  },
  {
    name: '007_create_content_files',
    sql: `
      CREATE TABLE IF NOT EXISTS content_files (
        id TEXT PRIMARY KEY,
        workspace_id TEXT REFERENCES workspaces(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        original_name TEXT,
        s3_key TEXT,
        url TEXT,
        file_type TEXT,
        mime_type TEXT,
        size_bytes INTEGER,
        folder_id TEXT,
        version INTEGER DEFAULT 1,
        parent_file_id TEXT REFERENCES content_files(id),
        is_restricted INTEGER DEFAULT 0,
        allowed_roles TEXT DEFAULT '[]',
        tracking_enabled INTEGER DEFAULT 1,
        uploaded_by TEXT REFERENCES users(id),
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      );

      CREATE INDEX IF NOT EXISTS idx_files_workspace ON content_files(workspace_id);
      CREATE INDEX IF NOT EXISTS idx_files_folder ON content_files(folder_id);

      CREATE TABLE IF NOT EXISTS content_folders (
        id TEXT PRIMARY KEY,
        workspace_id TEXT REFERENCES workspaces(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        parent_id TEXT REFERENCES content_folders(id),
        created_at TEXT DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS content_tracking (
        id TEXT PRIMARY KEY,
        workspace_id TEXT REFERENCES workspaces(id) ON DELETE CASCADE,
        file_id TEXT REFERENCES content_files(id) ON DELETE CASCADE,
        lead_id TEXT REFERENCES leads(id) ON DELETE CASCADE,
        tracking_id TEXT UNIQUE,
        sent_by TEXT REFERENCES users(id),
        sent_at TEXT DEFAULT (datetime('now')),
        first_opened_at TEXT,
        last_opened_at TEXT,
        open_count INTEGER DEFAULT 0,
        pages_viewed TEXT DEFAULT '[]',
        time_spent_seconds INTEGER DEFAULT 0,
        video_played INTEGER DEFAULT 0,
        created_at TEXT DEFAULT (datetime('now'))
      );

      CREATE INDEX IF NOT EXISTS idx_tracking_file ON content_tracking(file_id);
      CREATE INDEX IF NOT EXISTS idx_tracking_lead ON content_tracking(lead_id);
      CREATE INDEX IF NOT EXISTS idx_tracking_id ON content_tracking(tracking_id);
    `
  },
  {
    name: '008_create_notifications_devices',
    sql: `
      CREATE TABLE IF NOT EXISTS notifications (
        id TEXT PRIMARY KEY,
        user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
        workspace_id TEXT REFERENCES workspaces(id) ON DELETE CASCADE,
        type TEXT NOT NULL,
        title TEXT NOT NULL,
        body TEXT,
        data TEXT DEFAULT '{}',
        is_read INTEGER DEFAULT 0,
        created_at TEXT DEFAULT (datetime('now'))
      );

      CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
      CREATE INDEX IF NOT EXISTS idx_notifications_workspace ON notifications(workspace_id);
      CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(is_read);

      CREATE TABLE IF NOT EXISTS device_tokens (
        id TEXT PRIMARY KEY,
        user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
        token TEXT NOT NULL,
        platform TEXT,
        device_info TEXT DEFAULT '{}',
        active INTEGER DEFAULT 1,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      );

      CREATE INDEX IF NOT EXISTS idx_device_tokens_user ON device_tokens(user_id);
      CREATE INDEX IF NOT EXISTS idx_device_tokens_token ON device_tokens(token);
    `
  },
  {
    name: '009_create_integrations',
    sql: `
      CREATE TABLE IF NOT EXISTS integrations (
        id TEXT PRIMARY KEY,
        workspace_id TEXT REFERENCES workspaces(id) ON DELETE CASCADE,
        type TEXT NOT NULL,
        name TEXT,
        is_connected INTEGER DEFAULT 0,
        credentials TEXT DEFAULT '{}',
        config TEXT DEFAULT '{}',
        field_mapping TEXT DEFAULT '{}',
        last_synced_at TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now')),
        UNIQUE(workspace_id, type)
      );

      CREATE INDEX IF NOT EXISTS idx_integrations_workspace ON integrations(workspace_id);

      CREATE TABLE IF NOT EXISTS webhook_endpoints (
        id TEXT PRIMARY KEY,
        workspace_id TEXT REFERENCES workspaces(id) ON DELETE CASCADE,
        type TEXT NOT NULL,
        endpoint_url TEXT UNIQUE NOT NULL,
        secret TEXT,
        field_mapping TEXT DEFAULT '{}',
        is_active INTEGER DEFAULT 1,
        created_at TEXT DEFAULT (datetime('now'))
      );

      CREATE INDEX IF NOT EXISTS idx_webhooks_workspace ON webhook_endpoints(workspace_id);

      CREATE TABLE IF NOT EXISTS embed_forms (
        id TEXT PRIMARY KEY,
        workspace_id TEXT REFERENCES workspaces(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        form_key TEXT UNIQUE NOT NULL,
        fields TEXT DEFAULT '[]',
        redirect_url TEXT,
        is_active INTEGER DEFAULT 1,
        created_at TEXT DEFAULT (datetime('now'))
      );

      CREATE INDEX IF NOT EXISTS idx_embed_forms_workspace ON embed_forms(workspace_id);
    `
  },
  {
    name: '010_create_billing_audit',
    sql: `
      CREATE TABLE IF NOT EXISTS subscriptions (
        id TEXT PRIMARY KEY,
        workspace_id TEXT REFERENCES workspaces(id) ON DELETE CASCADE,
        plan TEXT DEFAULT 'free',
        status TEXT DEFAULT 'active',
        stripe_customer_id TEXT,
        stripe_subscription_id TEXT,
        stripe_price_id TEXT,
        current_period_start TEXT,
        current_period_end TEXT,
        cancel_at_period_end INTEGER DEFAULT 0,
        trial_start TEXT,
        trial_end TEXT,
        agent_limit INTEGER,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      );

      CREATE INDEX IF NOT EXISTS idx_subscriptions_workspace ON subscriptions(workspace_id);

      CREATE TABLE IF NOT EXISTS invoices (
        id TEXT PRIMARY KEY,
        workspace_id TEXT REFERENCES workspaces(id) ON DELETE CASCADE,
        stripe_invoice_id TEXT,
        amount REAL,
        currency TEXT DEFAULT 'usd',
        status TEXT DEFAULT 'open',
        period_start TEXT,
        period_end TEXT,
        invoice_url TEXT,
        created_at TEXT DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS audit_logs (
        id TEXT PRIMARY KEY,
        workspace_id TEXT REFERENCES workspaces(id) ON DELETE CASCADE,
        user_id TEXT REFERENCES users(id),
        action TEXT NOT NULL,
        entity_type TEXT,
        entity_id TEXT,
        old_values TEXT,
        new_values TEXT,
        ip_address TEXT,
        user_agent TEXT,
        created_at TEXT DEFAULT (datetime('now'))
      );

      CREATE INDEX IF NOT EXISTS idx_audit_workspace ON audit_logs(workspace_id);
      CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_logs(user_id);
      CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_logs(action);

      CREATE TABLE IF NOT EXISTS refresh_tokens (
        id TEXT PRIMARY KEY,
        user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
        token TEXT NOT NULL,
        expires_at TEXT NOT NULL,
        is_revoked INTEGER DEFAULT 0,
        created_at TEXT DEFAULT (datetime('now'))
      );

      CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user ON refresh_tokens(user_id);
      CREATE INDEX IF NOT EXISTS idx_refresh_tokens_token ON refresh_tokens(token);

      CREATE TABLE IF NOT EXISTS password_resets (
        id TEXT PRIMARY KEY,
        email TEXT NOT NULL,
        token TEXT NOT NULL,
        expires_at TEXT NOT NULL,
        used INTEGER DEFAULT 0,
        created_at TEXT DEFAULT (datetime('now'))
      );

      CREATE INDEX IF NOT EXISTS idx_password_resets_token ON password_resets(token);

      CREATE TABLE IF NOT EXISTS export_history (
        id TEXT PRIMARY KEY,
        workspace_id TEXT REFERENCES workspaces(id) ON DELETE CASCADE,
        user_id TEXT REFERENCES users(id),
        type TEXT,
        filter_config TEXT DEFAULT '{}',
        fields TEXT DEFAULT '[]',
        file_url TEXT,
        row_count INTEGER DEFAULT 0,
        created_at TEXT DEFAULT (datetime('now'))
      );

      CREATE INDEX IF NOT EXISTS idx_export_workspace ON export_history(workspace_id);

      CREATE TABLE IF NOT EXISTS territories (
        id TEXT PRIMARY KEY,
        workspace_id TEXT REFERENCES workspaces(id) ON DELETE CASCADE,
        user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
        city TEXT NOT NULL,
        created_at TEXT DEFAULT (datetime('now')),
        UNIQUE(workspace_id, user_id, city)
      );

      CREATE INDEX IF NOT EXISTS idx_territories_workspace ON territories(workspace_id);

      CREATE TABLE IF NOT EXISTS lead_assignment_rules (
        id TEXT PRIMARY KEY,
        workspace_id TEXT REFERENCES workspaces(id) ON DELETE CASCADE,
        type TEXT DEFAULT 'round_robin',
        rules TEXT DEFAULT '[]',
        is_active INTEGER DEFAULT 1,
        created_at TEXT DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS sequence_enrollments (
        id TEXT PRIMARY KEY,
        workspace_id TEXT REFERENCES workspaces(id) ON DELETE CASCADE,
        lead_id TEXT REFERENCES leads(id) ON DELETE CASCADE,
        sequence_type TEXT NOT NULL,
        sequence_id TEXT,
        channel TEXT DEFAULT 'whatsapp',
        current_step INTEGER DEFAULT 1,
        status TEXT DEFAULT 'active',
        enrolled_at TEXT DEFAULT (datetime('now')),
        next_step_at TEXT,
        UNIQUE(sequence_id, lead_id, sequence_type)
      );

      CREATE INDEX IF NOT EXISTS idx_seq_enroll_lead ON sequence_enrollments(lead_id);
      CREATE INDEX IF NOT EXISTS idx_seq_enroll_status ON sequence_enrollments(status);
    `
  },
];

async function runMigrations() {
  logger.info('Starting database migrations (JSON file DB)...');

  const db = require('../config/database');
  const fs = require('fs');
  const path = require('path');

  const dbPath = path.resolve(__dirname, '../../crm_final.json');
  let tables = {};
  try {
    if (fs.existsSync(dbPath)) {
      tables = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
    }
  } catch {}

  const tableNames = [
    'workspaces', 'users', 'lead_stages', 'leads', 'lead_activities', 'lead_tags',
    'lead_groups', 'lead_custom_fields', 'follow_ups', 'calls',
    'whatsapp_messages', 'whatsapp_templates', 'sms_messages', 'sms_templates',
    'email_templates', 'emails', 'email_sequences', 'email_sequence_steps',
    'email_sequence_enrollments', 'email_flows', 'email_flow_nodes', 'email_flow_edges',
    'email_flow_enrollments', 'email_triggers', 'email_trigger_logs',
    'campaigns', 'campaign_recipients',
    'content_files', 'content_folders', 'content_tracking',
    'notifications', 'device_tokens',
    'integrations', 'webhook_endpoints', 'embed_forms',
    'subscriptions', 'invoices', 'audit_logs', 'refresh_tokens', 'password_resets',
    'export_history', 'territories', 'lead_assignment_rules', 'sequence_enrollments',
    'whatsapp_auto_responder', 'whatsapp_sequences', 'whatsapp_sequence_steps',
    'whatsapp_sequence_enrollments', 'workspace_branding', 'subteams',
    'lead_automation_rules', 'lead_distribution_config', 'whatsapp_chat_assistant_rules',
    'outgoing_webhooks', 'outgoing_webhook_logs', 'lead_form_pages', 'meta_capi_config',
  ];

  for (const name of tableNames) {
    if (!tables[name]) {
      tables[name] = { _schema: '', _data: [] };
      logger.info(`Created table: ${name}`);
    }
  }

  fs.writeFileSync(dbPath, JSON.stringify(tables, null, 2));
  logger.info('All migrations completed successfully');
}

if (require.main === module) {
  runMigrations()
    .then(() => {
      console.log('Migrations complete');
      process.exit(0);
    })
    .catch((err) => {
      console.error('Migration error:', err);
      process.exit(1);
    });
}

module.exports = { runMigrations, migrations };
