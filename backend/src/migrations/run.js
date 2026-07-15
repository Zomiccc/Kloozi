const db = require('../config/database');
const logger = require('../utils/logger');

const migrations = [
  {
    name: '001_create_workspaces_and_users',
    sql: `
      CREATE TABLE IF NOT EXISTS workspaces (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(255) NOT NULL,
        slug VARCHAR(255) UNIQUE,
        plan VARCHAR(50) DEFAULT 'free',
        subscription_status VARCHAR(50) DEFAULT 'active',
        stripe_customer_id VARCHAR(255),
        stripe_subscription_id VARCHAR(255),
        trial_ends_at TIMESTAMP,
        settings JSONB DEFAULT '{}',
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255),
        first_name VARCHAR(100),
        last_name VARCHAR(100),
        phone VARCHAR(50),
        profile_image TEXT,
        role VARCHAR(50) DEFAULT 'sales_agent',
        status VARCHAR(50) DEFAULT 'active',
        designation VARCHAR(100),
        google_id VARCHAR(255),
        two_factor_enabled BOOLEAN DEFAULT false,
        two_factor_secret VARCHAR(255),
        invitation_token VARCHAR(255),
        invitation_accepted_at TIMESTAMP,
        last_activity_at TIMESTAMP DEFAULT NOW(),
        notification_preferences JSONB DEFAULT '{}',
        quiet_hours_start VARCHAR(5) DEFAULT '22:00',
        quiet_hours_end VARCHAR(5) DEFAULT '08:00',
        language VARCHAR(10) DEFAULT 'en',
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );

      CREATE INDEX idx_users_workspace ON users(workspace_id);
      CREATE INDEX idx_users_email ON users(email);
      CREATE INDEX idx_users_invitation_token ON users(invitation_token);
    `
  },
  {
    name: '002_create_leads_tables',
    sql: `
      CREATE TABLE IF NOT EXISTS lead_stages (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
        name VARCHAR(100) NOT NULL,
        color VARCHAR(20) DEFAULT '#6b7280',
        sort_order INTEGER DEFAULT 0,
        is_default BOOLEAN DEFAULT false,
        is_won BOOLEAN DEFAULT false,
        is_lost BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS leads (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
        first_name VARCHAR(100),
        last_name VARCHAR(100),
        phone VARCHAR(50),
        email VARCHAR(255),
        city VARCHAR(100),
        budget NUMERIC(15,2),
        lead_source VARCHAR(100) DEFAULT 'manual',
        stage_id UUID REFERENCES lead_stages(id),
        stage VARCHAR(50) DEFAULT 'new',
        notes TEXT,
        custom_fields JSONB DEFAULT '[]',
        tags TEXT[] DEFAULT '{}',
        score INTEGER DEFAULT 0,
        assigned_to UUID REFERENCES users(id),
        created_by UUID REFERENCES users(id),
        last_activity_at TIMESTAMP DEFAULT NOW(),
        follow_up_date TIMESTAMP,
        follow_up_type VARCHAR(50),
        follow_up_notes TEXT,
        is_unsubscribed BOOLEAN DEFAULT false,
        metadata JSONB DEFAULT '{}',
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );

      CREATE INDEX idx_leads_workspace ON leads(workspace_id);
      CREATE INDEX idx_leads_assigned ON leads(assigned_to);
      CREATE INDEX idx_leads_stage ON leads(stage);
      CREATE INDEX idx_leads_phone ON leads(phone);
      CREATE INDEX idx_leads_email ON leads(email);
      CREATE INDEX idx_leads_source ON leads(lead_source);
      CREATE INDEX idx_leads_city ON leads(city);
      CREATE INDEX idx_leads_follow_up ON leads(follow_up_date);
      CREATE INDEX idx_leads_tags ON leads USING GIN(tags);
      CREATE INDEX idx_leads_created_at ON leads(created_at);

      CREATE TABLE IF NOT EXISTS lead_activities (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
        lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
        user_id UUID REFERENCES users(id),
        type VARCHAR(50) NOT NULL,
        description TEXT,
        metadata JSONB DEFAULT '{}',
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE INDEX idx_activities_lead ON lead_activities(lead_id);
      CREATE INDEX idx_activities_workspace ON lead_activities(workspace_id);
      CREATE INDEX idx_activities_type ON lead_activities(type);
      CREATE INDEX idx_activities_created ON lead_activities(created_at);

      CREATE TABLE IF NOT EXISTS lead_tags (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
        name VARCHAR(100) NOT NULL,
        color VARCHAR(20) DEFAULT '#3b82f6',
        created_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(workspace_id, name)
      );

      CREATE TABLE IF NOT EXISTS lead_groups (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        type VARCHAR(20) DEFAULT 'static',
        filter_config JSONB DEFAULT '{}',
        created_by UUID REFERENCES users(id),
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS lead_custom_fields (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
        name VARCHAR(100) NOT NULL,
        type VARCHAR(50) DEFAULT 'text',
        options JSONB DEFAULT '[]',
        is_required BOOLEAN DEFAULT false,
        sort_order INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `
  },
  {
    name: '003_create_followups_calls',
    sql: `
      CREATE TABLE IF NOT EXISTS follow_ups (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
        lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
        user_id UUID REFERENCES users(id),
        type VARCHAR(50) NOT NULL,
        title VARCHAR(255),
        notes TEXT,
        due_date TIMESTAMP NOT NULL,
        status VARCHAR(50) DEFAULT 'pending',
        completed_at TIMESTAMP,
        snoozed_until TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );

      CREATE INDEX idx_followups_workspace ON follow_ups(workspace_id);
      CREATE INDEX idx_followups_lead ON follow_ups(lead_id);
      CREATE INDEX idx_followups_user ON follow_ups(user_id);
      CREATE INDEX idx_followups_due ON follow_ups(due_date);
      CREATE INDEX idx_followups_status ON follow_ups(status);

      CREATE TABLE IF NOT EXISTS calls (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
        lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
        user_id UUID REFERENCES users(id),
        phone_number VARCHAR(50),
        outcome VARCHAR(50),
        notes TEXT,
        duration_seconds INTEGER DEFAULT 0,
        follow_up_scheduled TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE INDEX idx_calls_workspace ON calls(workspace_id);
      CREATE INDEX idx_calls_lead ON calls(lead_id);
      CREATE INDEX idx_calls_user ON calls(user_id);
      CREATE INDEX idx_calls_created ON calls(created_at);
    `
  },
  {
    name: '004_create_messaging_tables',
    sql: `
      CREATE TABLE IF NOT EXISTS whatsapp_messages (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
        lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
        user_id UUID REFERENCES users(id),
        direction VARCHAR(10) DEFAULT 'outbound',
        message_text TEXT,
        template_name VARCHAR(255),
        media_url TEXT,
        media_type VARCHAR(50),
        status VARCHAR(50) DEFAULT 'pending',
        wa_message_id VARCHAR(255),
        sent_at TIMESTAMP,
        delivered_at TIMESTAMP,
        read_at TIMESTAMP,
        error_message TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE INDEX idx_wa_workspace ON whatsapp_messages(workspace_id);
      CREATE INDEX idx_wa_lead ON whatsapp_messages(lead_id);
      CREATE INDEX idx_wa_status ON whatsapp_messages(status);

      CREATE TABLE IF NOT EXISTS whatsapp_templates (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        category VARCHAR(100) DEFAULT 'intro',
        content TEXT NOT NULL,
        variables JSONB DEFAULT '[]',
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS sms_messages (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
        lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
        user_id UUID REFERENCES users(id),
        direction VARCHAR(10) DEFAULT 'outbound',
        message_text TEXT,
        template_name VARCHAR(255),
        status VARCHAR(50) DEFAULT 'pending',
        twilio_message_id VARCHAR(255),
        sent_at TIMESTAMP,
        delivered_at TIMESTAMP,
        error_message TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE INDEX idx_sms_workspace ON sms_messages(workspace_id);
      CREATE INDEX idx_sms_lead ON sms_messages(lead_id);
      CREATE INDEX idx_sms_status ON sms_messages(status);

      CREATE TABLE IF NOT EXISTS sms_templates (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        content TEXT NOT NULL,
        variables JSONB DEFAULT '[]',
        created_at TIMESTAMP DEFAULT NOW()
      );
    `
  },
  {
    name: '005_create_email_marketing_tables',
    sql: `
      CREATE TABLE IF NOT EXISTS email_templates (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        subject VARCHAR(500),
        body TEXT NOT NULL,
        category VARCHAR(100) DEFAULT 'intro',
        variables JSONB DEFAULT '[]',
        is_draft BOOLEAN DEFAULT false,
        created_by UUID REFERENCES users(id),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );

      CREATE INDEX idx_email_templates_workspace ON email_templates(workspace_id);

      CREATE TABLE IF NOT EXISTS emails (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
        lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
        user_id UUID REFERENCES users(id),
        template_id UUID REFERENCES email_templates(id),
        campaign_id UUID,
        sequence_id UUID,
        subject VARCHAR(500),
        body TEXT,
        from_email VARCHAR(255),
        from_name VARCHAR(255),
        reply_to VARCHAR(255),
        status VARCHAR(50) DEFAULT 'pending',
        sendgrid_message_id VARCHAR(255),
        sent_at TIMESTAMP,
        opened_at TIMESTAMP,
        clicked_at TIMESTAMP,
        replied_at TIMESTAMP,
        bounced_at TIMESTAMP,
        open_count INTEGER DEFAULT 0,
        click_count INTEGER DEFAULT 0,
        tracking_pixel_id VARCHAR(255),
        error_message TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE INDEX idx_emails_workspace ON emails(workspace_id);
      CREATE INDEX idx_emails_lead ON emails(lead_id);
      CREATE INDEX idx_emails_status ON emails(status);
      CREATE INDEX idx_emails_campaign ON emails(campaign_id);
      CREATE INDEX idx_emails_tracking ON emails(tracking_pixel_id);

      CREATE TABLE IF NOT EXISTS email_sequences (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        type VARCHAR(100) DEFAULT 'custom',
        description TEXT,
        is_active BOOLEAN DEFAULT true,
        created_by UUID REFERENCES users(id),
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS email_sequence_steps (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        sequence_id UUID REFERENCES email_sequences(id) ON DELETE CASCADE,
        template_id UUID REFERENCES email_templates(id),
        step_number INTEGER NOT NULL,
        delay_hours INTEGER DEFAULT 0,
        delay_days INTEGER DEFAULT 0,
        condition_type VARCHAR(100),
        condition_value JSONB DEFAULT '{}',
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE INDEX idx_seq_steps_sequence ON email_sequence_steps(sequence_id);

      CREATE TABLE IF NOT EXISTS email_sequence_enrollments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        sequence_id UUID REFERENCES email_sequences(id) ON DELETE CASCADE,
        lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
        workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
        current_step INTEGER DEFAULT 1,
        status VARCHAR(50) DEFAULT 'active',
        enrolled_at TIMESTAMP DEFAULT NOW(),
        last_step_at TIMESTAMP,
        next_step_at TIMESTAMP,
        UNIQUE(sequence_id, lead_id)
      );

      CREATE INDEX idx_enrollments_sequence ON email_sequence_enrollments(sequence_id);
      CREATE INDEX idx_enrollments_lead ON email_sequence_enrollments(lead_id);
      CREATE INDEX idx_enrollments_status ON email_sequence_enrollments(status);

      CREATE TABLE IF NOT EXISTS email_flows (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        is_active BOOLEAN DEFAULT false,
        is_published BOOLEAN DEFAULT false,
        version INTEGER DEFAULT 1,
        created_by UUID REFERENCES users(id),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS email_flow_nodes (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        flow_id UUID REFERENCES email_flows(id) ON DELETE CASCADE,
        node_type VARCHAR(50) NOT NULL,
        node_key VARCHAR(100) NOT NULL,
        position_x FLOAT DEFAULT 0,
        position_y FLOAT DEFAULT 0,
        config JSONB DEFAULT '{}',
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS email_flow_edges (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        flow_id UUID REFERENCES email_flows(id) ON DELETE CASCADE,
        source_node_key VARCHAR(100) NOT NULL,
        target_node_key VARCHAR(100) NOT NULL,
        condition_label VARCHAR(255),
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS email_flow_enrollments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        flow_id UUID REFERENCES email_flows(id) ON DELETE CASCADE,
        lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
        workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
        current_node_key VARCHAR(100),
        status VARCHAR(50) DEFAULT 'active',
        enrolled_at TIMESTAMP DEFAULT NOW(),
        next_action_at TIMESTAMP,
        UNIQUE(flow_id, lead_id)
      );

      CREATE TABLE IF NOT EXISTS email_triggers (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        trigger_type VARCHAR(100) NOT NULL,
        trigger_config JSONB DEFAULT '{}',
        action_type VARCHAR(100) NOT NULL,
        action_config JSONB DEFAULT '{}',
        is_enabled BOOLEAN DEFAULT true,
        created_by UUID REFERENCES users(id),
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS email_trigger_logs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        trigger_id UUID REFERENCES email_triggers(id) ON DELETE CASCADE,
        workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
        lead_id UUID REFERENCES leads(id),
        fired_at TIMESTAMP DEFAULT NOW()
      );
    `
  },
  {
    name: '006_create_campaigns',
    sql: `
      CREATE TABLE IF NOT EXISTS campaigns (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        type VARCHAR(50) NOT NULL,
        channel VARCHAR(50) NOT NULL,
        template_id UUID,
        subject VARCHAR(500),
        body TEXT,
        recipients_count INTEGER DEFAULT 0,
        sent_count INTEGER DEFAULT 0,
        delivered_count INTEGER DEFAULT 0,
        opened_count INTEGER DEFAULT 0,
        clicked_count INTEGER DEFAULT 0,
        replied_count INTEGER DEFAULT 0,
        failed_count INTEGER DEFAULT 0,
        status VARCHAR(50) DEFAULT 'draft',
        scheduled_at TIMESTAMP,
        started_at TIMESTAMP,
        completed_at TIMESTAMP,
        created_by UUID REFERENCES users(id),
        filter_config JSONB DEFAULT '{}',
        ab_test_enabled BOOLEAN DEFAULT false,
        ab_variant_b_template_id UUID,
        ab_split_percentage INTEGER DEFAULT 50,
        ab_winner_declared BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );

      CREATE INDEX idx_campaigns_workspace ON campaigns(workspace_id);
      CREATE INDEX idx_campaigns_status ON campaigns(status);
      CREATE INDEX idx_campaigns_type ON campaigns(type);

      CREATE TABLE IF NOT EXISTS campaign_recipients (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        campaign_id UUID REFERENCES campaigns(id) ON DELETE CASCADE,
        lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
        workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
        status VARCHAR(50) DEFAULT 'pending',
        variant VARCHAR(10) DEFAULT 'a',
        sent_at TIMESTAMP,
        opened_at TIMESTAMP,
        clicked_at TIMESTAMP,
        replied_at TIMESTAMP,
        error_message TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE INDEX idx_recipients_campaign ON campaign_recipients(campaign_id);
      CREATE INDEX idx_recipients_lead ON campaign_recipients(lead_id);
    `
  },
  {
    name: '007_create_content_files',
    sql: `
      CREATE TABLE IF NOT EXISTS content_files (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        original_name VARCHAR(255),
        s3_key VARCHAR(500),
        url TEXT,
        file_type VARCHAR(50),
        mime_type VARCHAR(100),
        size_bytes BIGINT,
        folder_id UUID,
        version INTEGER DEFAULT 1,
        parent_file_id UUID REFERENCES content_files(id),
        is_restricted BOOLEAN DEFAULT false,
        allowed_roles TEXT[] DEFAULT '{}',
        tracking_enabled BOOLEAN DEFAULT true,
        uploaded_by UUID REFERENCES users(id),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );

      CREATE INDEX idx_files_workspace ON content_files(workspace_id);
      CREATE INDEX idx_files_folder ON content_files(folder_id);

      CREATE TABLE IF NOT EXISTS content_folders (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        parent_id UUID REFERENCES content_folders(id),
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS content_tracking (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
        file_id UUID REFERENCES content_files(id) ON DELETE CASCADE,
        lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
        tracking_id VARCHAR(255) UNIQUE,
        sent_by UUID REFERENCES users(id),
        sent_at TIMESTAMP DEFAULT NOW(),
        first_opened_at TIMESTAMP,
        last_opened_at TIMESTAMP,
        open_count INTEGER DEFAULT 0,
        pages_viewed JSONB DEFAULT '[]',
        time_spent_seconds INTEGER DEFAULT 0,
        video_played BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE INDEX idx_tracking_file ON content_tracking(file_id);
      CREATE INDEX idx_tracking_lead ON content_tracking(lead_id);
      CREATE INDEX idx_tracking_id ON content_tracking(tracking_id);
    `
  },
  {
    name: '008_create_notifications_devices',
    sql: `
      CREATE TABLE IF NOT EXISTS notifications (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
        type VARCHAR(100) NOT NULL,
        title VARCHAR(255) NOT NULL,
        body TEXT,
        data JSONB DEFAULT '{}',
        is_read BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE INDEX idx_notifications_user ON notifications(user_id);
      CREATE INDEX idx_notifications_workspace ON notifications(workspace_id);
      CREATE INDEX idx_notifications_read ON notifications(is_read);

      CREATE TABLE IF NOT EXISTS device_tokens (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        token VARCHAR(500) NOT NULL,
        platform VARCHAR(20),
        device_info JSONB DEFAULT '{}',
        active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );

      CREATE INDEX idx_device_tokens_user ON device_tokens(user_id);
      CREATE INDEX idx_device_tokens_token ON device_tokens(token);
    `
  },
  {
    name: '009_create_integrations',
    sql: `
      CREATE TABLE IF NOT EXISTS integrations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
        type VARCHAR(50) NOT NULL,
        name VARCHAR(100),
        is_connected BOOLEAN DEFAULT false,
        credentials JSONB DEFAULT '{}',
        config JSONB DEFAULT '{}',
        field_mapping JSONB DEFAULT '{}',
        last_synced_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(workspace_id, type)
      );

      CREATE INDEX idx_integrations_workspace ON integrations(workspace_id);

      CREATE TABLE IF NOT EXISTS webhook_endpoints (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
        type VARCHAR(50) NOT NULL,
        endpoint_url VARCHAR(500) UNIQUE NOT NULL,
        secret VARCHAR(255),
        field_mapping JSONB DEFAULT '{}',
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE INDEX idx_webhooks_workspace ON webhook_endpoints(workspace_id);

      CREATE TABLE IF NOT EXISTS embed_forms (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        form_key VARCHAR(100) UNIQUE NOT NULL,
        fields JSONB DEFAULT '[]',
        redirect_url TEXT,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE INDEX idx_embed_forms_workspace ON embed_forms(workspace_id);
    `
  },
  {
    name: '010_create_billing_audit',
    sql: `
      CREATE TABLE IF NOT EXISTS subscriptions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
        plan VARCHAR(50) DEFAULT 'free',
        status VARCHAR(50) DEFAULT 'active',
        stripe_customer_id VARCHAR(255),
        stripe_subscription_id VARCHAR(255),
        stripe_price_id VARCHAR(255),
        current_period_start TIMESTAMP,
        current_period_end TIMESTAMP,
        cancel_at_period_end BOOLEAN DEFAULT false,
        trial_start TIMESTAMP,
        trial_end TIMESTAMP,
        agent_limit INTEGER,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );

      CREATE INDEX idx_subscriptions_workspace ON subscriptions(workspace_id);

      CREATE TABLE IF NOT EXISTS invoices (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
        stripe_invoice_id VARCHAR(255),
        amount NUMERIC(15,2),
        currency VARCHAR(10) DEFAULT 'usd',
        status VARCHAR(50) DEFAULT 'open',
        period_start TIMESTAMP,
        period_end TIMESTAMP,
        invoice_url TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS audit_logs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
        user_id UUID REFERENCES users(id),
        action VARCHAR(255) NOT NULL,
        entity_type VARCHAR(100),
        entity_id UUID,
        old_values JSONB,
        new_values JSONB,
        ip_address VARCHAR(50),
        user_agent TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE INDEX idx_audit_workspace ON audit_logs(workspace_id);
      CREATE INDEX idx_audit_user ON audit_logs(user_id);
      CREATE INDEX idx_audit_action ON audit_logs(action);

      CREATE TABLE IF NOT EXISTS refresh_tokens (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        token VARCHAR(500) NOT NULL,
        expires_at TIMESTAMP NOT NULL,
        is_revoked BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE INDEX idx_refresh_tokens_user ON refresh_tokens(user_id);
      CREATE INDEX idx_refresh_tokens_token ON refresh_tokens(token);

      CREATE TABLE IF NOT EXISTS password_resets (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email VARCHAR(255) NOT NULL,
        token VARCHAR(255) NOT NULL,
        expires_at TIMESTAMP NOT NULL,
        used BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE INDEX idx_password_resets_token ON password_resets(token);

      CREATE TABLE IF NOT EXISTS export_history (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
        user_id UUID REFERENCES users(id),
        type VARCHAR(50),
        filter_config JSONB DEFAULT '{}',
        fields JSONB DEFAULT '[]',
        file_url TEXT,
        row_count INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE INDEX idx_export_workspace ON export_history(workspace_id);

      CREATE TABLE IF NOT EXISTS territories (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        city VARCHAR(100) NOT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(workspace_id, user_id, city)
      );

      CREATE INDEX idx_territories_workspace ON territories(workspace_id);

      CREATE TABLE IF NOT EXISTS lead_assignment_rules (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
        type VARCHAR(50) DEFAULT 'round_robin',
        rules JSONB DEFAULT '[]',
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS sequence_enrollments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
        lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
        sequence_type VARCHAR(50) NOT NULL,
        sequence_id UUID,
        channel VARCHAR(50) DEFAULT 'whatsapp',
        current_step INTEGER DEFAULT 1,
        status VARCHAR(50) DEFAULT 'active',
        enrolled_at TIMESTAMP DEFAULT NOW(),
        next_step_at TIMESTAMP,
        UNIQUE(sequence_id, lead_id, sequence_type)
      );

      CREATE INDEX idx_seq_enroll_lead ON sequence_enrollments(lead_id);
      CREATE INDEX idx_seq_enroll_status ON sequence_enrollments(status);
    `
  },
];

async function runMigrations() {
  logger.info('Starting database migrations...');

  for (const migration of migrations) {
    try {
      logger.info(`Running migration: ${migration.name}`);
      await db.query(migration.sql);
      logger.info(`Completed: ${migration.name}`);
    } catch (err) {
      logger.error(`Migration failed: ${migration.name}`, err.message);
      throw err;
    }
  }

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
