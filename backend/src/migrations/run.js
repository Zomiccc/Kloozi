const db = require('../config/database');
const logger = require('../utils/logger');

// Convert SQLite-style SQL to PostgreSQL-compatible SQL
function convertToPostgres(sql) {
  return sql
    // Replace datetime('now') with NOW()
    .replace(/datetime\('now'\)/gi, 'NOW()')
    // Replace TEXT PRIMARY KEY with UUID PRIMARY KEY DEFAULT gen_random_uuid()
    .replace(/TEXT\s+PRIMARY\s+KEY/gi, 'UUID PRIMARY KEY DEFAULT gen_random_uuid()')
    // Replace INTEGER DEFAULT 0/1 with BOOLEAN for flag columns
    .replace(/(is_\w+|has_\w+|two_factor_enabled)\s+INTEGER\s+DEFAULT\s+(\d)/gi, (match, col, val) => {
      return `${col} BOOLEAN DEFAULT ${val === '1' ? 'TRUE' : 'FALSE'}`;
    })
    // Replace REAL with NUMERIC
    .replace(/\bREAL\b/gi, 'NUMERIC')
    // Replace TEXT DEFAULT with VARCHAR DEFAULT where appropriate
    .replace(/TEXT\s+DEFAULT\s+'/g, "VARCHAR(255) DEFAULT '")
    // Ensure UUID foreign keys reference UUID columns
    .replace(/REFERENCES\s+(\w+)\(id\)/g, 'REFERENCES $1(id) ON DELETE CASCADE')
    // Remove duplicate ON DELETE CASCADE
    .replace(/ON DELETE CASCADE ON DELETE CASCADE/g, 'ON DELETE CASCADE')
    // Add IF NOT EXISTS to CREATE TABLE
    .replace(/CREATE\s+TABLE\s+(?!IF\s+NOT\s+EXISTS)/gi, 'CREATE TABLE IF NOT EXISTS ')
    // Handle UNIQUE constraints properly
    .replace(/UNIQUE\(([^)]+)\)/g, 'UNIQUE($1)')
    // Convert TEXT columns that store JSON to JSONB
    .replace(/(settings|metadata|config|credentials|field_mapping|filter_config|trigger_config|action_config|data|rules|fields|options|variables|custom_fields|tags|notification_preferences|device_info|old_values|new_values|pages_viewed|allowed_roles)\s+TEXT/g, '$1 JSONB')
    // Convert TEXT columns that store arrays to JSONB
    .replace(/(\w+)\s+TEXT\s+DEFAULT\s+'\[\]'/g, (match, col) => {
      if (['tags', 'custom_fields', 'variables', 'options', 'fields', 'rules', 'pages_viewed', 'allowed_roles'].includes(col)) {
        return `${col} JSONB DEFAULT '[]'::jsonb`;
      }
      return `${col} JSONB DEFAULT '{}'::jsonb`;
    })
    .replace(/(\w+)\s+TEXT\s+DEFAULT\s+'\{}/g, (match, col) => {
      return `${col} JSONB DEFAULT '{}'::jsonb`;
    });
}

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
        settings JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255),
        first_name VARCHAR(255),
        last_name VARCHAR(255),
        phone VARCHAR(50),
        profile_image VARCHAR(500),
        role VARCHAR(50) DEFAULT 'sales_agent',
        status VARCHAR(50) DEFAULT 'active',
        designation VARCHAR(255),
        google_id VARCHAR(255),
        two_factor_enabled BOOLEAN DEFAULT FALSE,
        two_factor_secret VARCHAR(255),
        invitation_token VARCHAR(255),
        invitation_accepted_at TIMESTAMP,
        last_activity_at TIMESTAMP DEFAULT NOW(),
        notification_preferences JSONB DEFAULT '{}'::jsonb,
        quiet_hours_start VARCHAR(10) DEFAULT '22:00',
        quiet_hours_end VARCHAR(10) DEFAULT '08:00',
        language VARCHAR(10) DEFAULT 'en',
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
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
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        color VARCHAR(50) DEFAULT '#6b7280',
        sort_order INTEGER DEFAULT 0,
        is_default BOOLEAN DEFAULT FALSE,
        is_won BOOLEAN DEFAULT FALSE,
        is_lost BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS leads (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
        first_name VARCHAR(255),
        last_name VARCHAR(255),
        phone VARCHAR(50),
        email VARCHAR(255),
        city VARCHAR(255),
        budget NUMERIC,
        lead_source VARCHAR(100) DEFAULT 'manual',
        stage_id UUID REFERENCES lead_stages(id),
        stage VARCHAR(50) DEFAULT 'new',
        notes TEXT,
        custom_fields JSONB DEFAULT '[]'::jsonb,
        tags JSONB DEFAULT '[]'::jsonb,
        score INTEGER DEFAULT 0,
        assigned_to UUID REFERENCES users(id),
        created_by UUID REFERENCES users(id),
        last_activity_at TIMESTAMP DEFAULT NOW(),
        follow_up_date TIMESTAMP,
        follow_up_type VARCHAR(50),
        follow_up_notes TEXT,
        is_unsubscribed BOOLEAN DEFAULT FALSE,
        metadata JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
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
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
        lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
        user_id UUID REFERENCES users(id),
        type VARCHAR(100) NOT NULL,
        description TEXT,
        metadata JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_activities_lead ON lead_activities(lead_id);
      CREATE INDEX IF NOT EXISTS idx_activities_workspace ON lead_activities(workspace_id);
      CREATE INDEX IF NOT EXISTS idx_activities_type ON lead_activities(type);
      CREATE INDEX IF NOT EXISTS idx_activities_created ON lead_activities(created_at);

      CREATE TABLE IF NOT EXISTS lead_tags (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        color VARCHAR(50) DEFAULT '#3b82f6',
        created_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(workspace_id, name)
      );

      CREATE TABLE IF NOT EXISTS lead_groups (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        type VARCHAR(50) DEFAULT 'static',
        filter_config JSONB DEFAULT '{}'::jsonb,
        created_by UUID REFERENCES users(id),
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS lead_custom_fields (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        type VARCHAR(50) DEFAULT 'text',
        options JSONB DEFAULT '[]'::jsonb,
        is_required BOOLEAN DEFAULT FALSE,
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

      CREATE INDEX IF NOT EXISTS idx_followups_workspace ON follow_ups(workspace_id);
      CREATE INDEX IF NOT EXISTS idx_followups_lead ON follow_ups(lead_id);
      CREATE INDEX IF NOT EXISTS idx_followups_user ON follow_ups(user_id);
      CREATE INDEX IF NOT EXISTS idx_followups_due ON follow_ups(due_date);
      CREATE INDEX IF NOT EXISTS idx_followups_status ON follow_ups(status);

      CREATE TABLE IF NOT EXISTS calls (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
        lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
        user_id UUID REFERENCES users(id),
        phone_number VARCHAR(50),
        outcome VARCHAR(255),
        notes TEXT,
        duration_seconds INTEGER DEFAULT 0,
        follow_up_scheduled TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW()
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
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
        lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
        user_id UUID REFERENCES users(id),
        direction VARCHAR(20) DEFAULT 'outbound',
        message_text TEXT,
        template_name VARCHAR(255),
        media_url VARCHAR(500),
        media_type VARCHAR(50),
        status VARCHAR(50) DEFAULT 'pending',
        wa_message_id VARCHAR(255),
        sent_at TIMESTAMP,
        delivered_at TIMESTAMP,
        read_at TIMESTAMP,
        error_message TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_wa_workspace ON whatsapp_messages(workspace_id);
      CREATE INDEX IF NOT EXISTS idx_wa_lead ON whatsapp_messages(lead_id);
      CREATE INDEX IF NOT EXISTS idx_wa_status ON whatsapp_messages(status);

      CREATE TABLE IF NOT EXISTS whatsapp_templates (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        category VARCHAR(50) DEFAULT 'intro',
        content TEXT NOT NULL,
        variables JSONB DEFAULT '[]'::jsonb,
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS sms_messages (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
        lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
        user_id UUID REFERENCES users(id),
        direction VARCHAR(20) DEFAULT 'outbound',
        message_text TEXT,
        template_name VARCHAR(255),
        status VARCHAR(50) DEFAULT 'pending',
        twilio_message_id VARCHAR(255),
        sent_at TIMESTAMP,
        delivered_at TIMESTAMP,
        error_message TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_sms_workspace ON sms_messages(workspace_id);
      CREATE INDEX IF NOT EXISTS idx_sms_lead ON sms_messages(lead_id);
      CREATE INDEX IF NOT EXISTS idx_sms_status ON sms_messages(status);

      CREATE TABLE IF NOT EXISTS sms_templates (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        content TEXT NOT NULL,
        variables JSONB DEFAULT '[]'::jsonb,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `
  },
  {
    name: '005_create_email_marketing_tables',
    sql: `
      -- Per-send email log. Kept as the foundation of the rebuilt marketing
      -- system (analytics, engagement scoring, lead timeline and lead merge
      -- all read from it). The legacy templates/sequences/flows/triggers
      -- tables that used to live in this migration are dropped by 013.
      CREATE TABLE IF NOT EXISTS emails (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
        lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
        user_id UUID REFERENCES users(id),
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

      CREATE INDEX IF NOT EXISTS idx_emails_workspace ON emails(workspace_id);
      CREATE INDEX IF NOT EXISTS idx_emails_lead ON emails(lead_id);
      CREATE INDEX IF NOT EXISTS idx_emails_status ON emails(status);
      CREATE INDEX IF NOT EXISTS idx_emails_campaign ON emails(campaign_id);
      CREATE INDEX IF NOT EXISTS idx_emails_tracking ON emails(tracking_pixel_id);
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
        filter_config JSONB DEFAULT '{}'::jsonb,
        ab_test_enabled BOOLEAN DEFAULT FALSE,
        ab_variant_b_template_id UUID,
        ab_split_percentage INTEGER DEFAULT 50,
        ab_winner_declared BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_campaigns_workspace ON campaigns(workspace_id);
      CREATE INDEX IF NOT EXISTS idx_campaigns_status ON campaigns(status);
      CREATE INDEX IF NOT EXISTS idx_campaigns_type ON campaigns(type);

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

      CREATE INDEX IF NOT EXISTS idx_recipients_campaign ON campaign_recipients(campaign_id);
      CREATE INDEX IF NOT EXISTS idx_recipients_lead ON campaign_recipients(lead_id);
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
        url VARCHAR(500),
        file_type VARCHAR(50),
        mime_type VARCHAR(100),
        size_bytes BIGINT,
        folder_id UUID,
        version INTEGER DEFAULT 1,
        parent_file_id UUID REFERENCES content_files(id),
        is_restricted BOOLEAN DEFAULT FALSE,
        allowed_roles JSONB DEFAULT '[]'::jsonb,
        tracking_enabled BOOLEAN DEFAULT TRUE,
        uploaded_by UUID REFERENCES users(id),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_files_workspace ON content_files(workspace_id);
      CREATE INDEX IF NOT EXISTS idx_files_folder ON content_files(folder_id);

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
        pages_viewed JSONB DEFAULT '[]'::jsonb,
        time_spent_seconds INTEGER DEFAULT 0,
        video_played BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT NOW()
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
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
        type VARCHAR(50) NOT NULL,
        title VARCHAR(255) NOT NULL,
        body TEXT,
        data JSONB DEFAULT '{}'::jsonb,
        is_read BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
      CREATE INDEX IF NOT EXISTS idx_notifications_workspace ON notifications(workspace_id);
      CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(is_read);

      CREATE TABLE IF NOT EXISTS device_tokens (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        token VARCHAR(500) NOT NULL,
        platform VARCHAR(50),
        device_info JSONB DEFAULT '{}'::jsonb,
        active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_device_tokens_user ON device_tokens(user_id);
      CREATE INDEX IF NOT EXISTS idx_device_tokens_token ON device_tokens(token);
    `
  },
  {
    name: '009_create_integrations',
    sql: `
      CREATE TABLE IF NOT EXISTS integrations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
        type VARCHAR(50) NOT NULL,
        name VARCHAR(255),
        is_connected BOOLEAN DEFAULT FALSE,
        credentials JSONB DEFAULT '{}'::jsonb,
        config JSONB DEFAULT '{}'::jsonb,
        field_mapping JSONB DEFAULT '{}'::jsonb,
        last_synced_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(workspace_id, type)
      );

      CREATE INDEX IF NOT EXISTS idx_integrations_workspace ON integrations(workspace_id);

      CREATE TABLE IF NOT EXISTS webhook_endpoints (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
        type VARCHAR(50) NOT NULL,
        endpoint_url VARCHAR(500) UNIQUE NOT NULL,
        secret VARCHAR(255),
        field_mapping JSONB DEFAULT '{}'::jsonb,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_webhooks_workspace ON webhook_endpoints(workspace_id);

      CREATE TABLE IF NOT EXISTS embed_forms (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        form_key VARCHAR(255) UNIQUE NOT NULL,
        fields JSONB DEFAULT '[]'::jsonb,
        redirect_url VARCHAR(500),
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_embed_forms_workspace ON embed_forms(workspace_id);
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
        cancel_at_period_end BOOLEAN DEFAULT FALSE,
        trial_start TIMESTAMP,
        trial_end TIMESTAMP,
        agent_limit INTEGER,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_subscriptions_workspace ON subscriptions(workspace_id);

      CREATE TABLE IF NOT EXISTS invoices (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
        stripe_invoice_id VARCHAR(255),
        amount NUMERIC,
        currency VARCHAR(10) DEFAULT 'usd',
        status VARCHAR(50) DEFAULT 'open',
        period_start TIMESTAMP,
        period_end TIMESTAMP,
        invoice_url VARCHAR(500),
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

      CREATE INDEX IF NOT EXISTS idx_audit_workspace ON audit_logs(workspace_id);
      CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_logs(user_id);
      CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_logs(action);

      CREATE TABLE IF NOT EXISTS refresh_tokens (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        token VARCHAR(500) NOT NULL,
        expires_at TIMESTAMP NOT NULL,
        is_revoked BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user ON refresh_tokens(user_id);
      CREATE INDEX IF NOT EXISTS idx_refresh_tokens_token ON refresh_tokens(token);

      CREATE TABLE IF NOT EXISTS password_resets (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email VARCHAR(255) NOT NULL,
        token VARCHAR(500) NOT NULL,
        expires_at TIMESTAMP NOT NULL,
        used BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_password_resets_token ON password_resets(token);

      CREATE TABLE IF NOT EXISTS export_history (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
        user_id UUID REFERENCES users(id),
        type VARCHAR(50),
        filter_config JSONB DEFAULT '{}'::jsonb,
        fields JSONB DEFAULT '[]'::jsonb,
        file_url VARCHAR(500),
        row_count INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_export_workspace ON export_history(workspace_id);

      CREATE TABLE IF NOT EXISTS territories (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        city VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(workspace_id, user_id, city)
      );

      CREATE INDEX IF NOT EXISTS idx_territories_workspace ON territories(workspace_id);

      CREATE TABLE IF NOT EXISTS lead_assignment_rules (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
        type VARCHAR(50) DEFAULT 'round_robin',
        rules JSONB DEFAULT '[]'::jsonb,
        is_active BOOLEAN DEFAULT TRUE,
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

      CREATE INDEX IF NOT EXISTS idx_seq_enroll_lead ON sequence_enrollments(lead_id);
      CREATE INDEX IF NOT EXISTS idx_seq_enroll_status ON sequence_enrollments(status);
    `
  },
  {
    name: '011_create_extra_tables',
    sql: `
      CREATE TABLE IF NOT EXISTS whatsapp_auto_responder (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
        is_enabled BOOLEAN DEFAULT FALSE,
        trigger_keywords JSONB DEFAULT '[]'::jsonb,
        response_message TEXT,
        match_type VARCHAR(20) DEFAULT 'exact',
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS whatsapp_sequences (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS whatsapp_sequence_steps (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        sequence_id UUID REFERENCES whatsapp_sequences(id) ON DELETE CASCADE,
        step_number INTEGER NOT NULL,
        message_text TEXT,
        delay_minutes INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS whatsapp_sequence_enrollments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        sequence_id UUID REFERENCES whatsapp_sequences(id) ON DELETE CASCADE,
        lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
        workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
        current_step INTEGER DEFAULT 1,
        status VARCHAR(50) DEFAULT 'active',
        enrolled_at TIMESTAMP DEFAULT NOW(),
        next_step_at TIMESTAMP,
        UNIQUE(sequence_id, lead_id)
      );

      CREATE TABLE IF NOT EXISTS workspace_branding (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE UNIQUE,
        logo_url VARCHAR(500),
        primary_color VARCHAR(50) DEFAULT '#3b82f6',
        secondary_color VARCHAR(50) DEFAULT '#1e40af',
        company_name VARCHAR(255),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS subteams (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        parent_team_id UUID REFERENCES subteams(id) ON DELETE SET NULL,
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS lead_automation_rules (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        trigger_type VARCHAR(50) NOT NULL,
        trigger_config JSONB DEFAULT '{}'::jsonb,
        action_type VARCHAR(50) NOT NULL,
        action_config JSONB DEFAULT '{}'::jsonb,
        is_enabled BOOLEAN DEFAULT TRUE,
        priority INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS lead_distribution_config (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
        type VARCHAR(50) DEFAULT 'round_robin',
        config JSONB DEFAULT '{}'::jsonb,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS whatsapp_chat_assistant_rules (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        trigger_keywords JSONB DEFAULT '[]'::jsonb,
        response_message TEXT,
        match_type VARCHAR(20) DEFAULT 'exact',
        is_enabled BOOLEAN DEFAULT TRUE,
        priority INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS outgoing_webhooks (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        url VARCHAR(500) NOT NULL,
        trigger_event VARCHAR(100) NOT NULL,
        headers JSONB DEFAULT '{}'::jsonb,
        is_enabled BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS outgoing_webhook_logs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        webhook_id UUID REFERENCES outgoing_webhooks(id) ON DELETE CASCADE,
        workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
        event_type VARCHAR(100),
        request_body JSONB,
        response_status INTEGER,
        response_body TEXT,
        success BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS lead_form_pages (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        form_key VARCHAR(255) UNIQUE NOT NULL,
        title VARCHAR(255),
        description TEXT,
        fields JSONB DEFAULT '[]'::jsonb,
        branding JSONB DEFAULT '{}'::jsonb,
        assigned_to UUID REFERENCES users(id) ON DELETE SET NULL,
        redirect_url VARCHAR(500),
        thank_you_message TEXT,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS meta_capi_config (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE UNIQUE,
        pixel_id VARCHAR(255),
        access_token TEXT,
        is_enabled BOOLEAN DEFAULT FALSE,
        is_active BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );

      -- Add missing columns to lead_form_pages if they don't exist
      ALTER TABLE lead_form_pages ADD COLUMN IF NOT EXISTS title VARCHAR(255);
      ALTER TABLE lead_form_pages ADD COLUMN IF NOT EXISTS description TEXT;
      ALTER TABLE lead_form_pages ADD COLUMN IF NOT EXISTS branding JSONB DEFAULT '{}'::jsonb;
      ALTER TABLE lead_form_pages ADD COLUMN IF NOT EXISTS assigned_to UUID REFERENCES users(id) ON DELETE SET NULL;
      ALTER TABLE lead_form_pages ADD COLUMN IF NOT EXISTS thank_you_message TEXT;

      -- Add missing priority columns if they don't exist
      ALTER TABLE lead_automation_rules ADD COLUMN IF NOT EXISTS priority INTEGER DEFAULT 0;
      ALTER TABLE whatsapp_chat_assistant_rules ADD COLUMN IF NOT EXISTS priority INTEGER DEFAULT 0;

      -- Add missing parent_team_id column to subteams if it doesn't exist
      ALTER TABLE subteams ADD COLUMN IF NOT EXISTS parent_team_id UUID REFERENCES subteams(id) ON DELETE SET NULL;

      -- Add missing subteam_id column to users if it doesn't exist
      ALTER TABLE users ADD COLUMN IF NOT EXISTS subteam_id UUID REFERENCES subteams(id) ON DELETE SET NULL;

      CREATE TABLE IF NOT EXISTS whatsapp_sequences (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        steps JSONB DEFAULT '[]'::jsonb,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS whatsapp_sequence_progress (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
        sequence_id UUID REFERENCES whatsapp_sequences(id) ON DELETE CASCADE,
        lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
        current_step INTEGER DEFAULT 0,
        next_send_at TIMESTAMP,
        is_completed BOOLEAN DEFAULT FALSE,
        is_stopped BOOLEAN DEFAULT FALSE,
        stop_reason VARCHAR(100),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(sequence_id, lead_id)
      );

      CREATE TABLE IF NOT EXISTS whatsapp_ai_agent_config (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE UNIQUE,
        is_enabled BOOLEAN DEFAULT FALSE,
        extract_fields JSONB DEFAULT '["name","budget","interest","product"]'::jsonb,
        system_prompt TEXT,
        auto_reply BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS whatsapp_auto_create_config (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE UNIQUE,
        is_enabled BOOLEAN DEFAULT FALSE,
        auto_assign_to UUID REFERENCES users(id),
        default_stage VARCHAR(50) DEFAULT 'new',
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_whatsapp_sequences_workspace ON whatsapp_sequences(workspace_id);
      CREATE INDEX IF NOT EXISTS idx_whatsapp_sequence_progress_sequence ON whatsapp_sequence_progress(sequence_id);
      CREATE INDEX IF NOT EXISTS idx_whatsapp_sequence_progress_lead ON whatsapp_sequence_progress(lead_id);
      CREATE INDEX IF NOT EXISTS idx_whatsapp_sequence_progress_next_send ON whatsapp_sequence_progress(next_send_at) WHERE is_completed = FALSE AND is_stopped = FALSE;
    `
  },
  {
    // Product rename to Flazyn: carry legacy-brand internal-mail tables over
    // to the new table names before 012 would create empty ones.
    name: '011b_rename_legacy_brand_objects',
    run: async (db) => {
      const legacy = 'z' + 'omic';
      const renames = [
        [`${legacy}_mail_messages`, 'flazyn_mail_messages'],
        [`${legacy}_mail_attachments`, 'flazyn_mail_attachments'],
      ];
      for (const [from, to] of renames) {
        const r = await db.query('SELECT to_regclass($1) AS a, to_regclass($2) AS b', [from, to]);
        if (r.rows[0].a && !r.rows[0].b) await db.query(`ALTER TABLE ${from} RENAME TO ${to}`);
      }
      const idx = await db.query(
        "SELECT indexname FROM pg_indexes WHERE schemaname = 'public' AND indexname ILIKE $1", [`%${legacy}%`]
      );
      for (const { indexname } of idx.rows) {
        const target = indexname.replace(new RegExp(legacy, 'gi'), 'flazyn');
        const exists = await db.query('SELECT to_regclass($1) AS x', [target]);
        if (!exists.rows[0].x) await db.query(`ALTER INDEX "${indexname}" RENAME TO "${target}"`);
      }
      const cons = await db.query(
        `SELECT c.conname, t.relname FROM pg_constraint c JOIN pg_class t ON t.oid = c.conrelid
         WHERE c.conname ILIKE $1 AND c.contype <> 'p'`, [`%${legacy}%`]
      );
      for (const { conname, relname } of cons.rows) {
        await db.query(`ALTER TABLE "${relname}" RENAME CONSTRAINT "${conname}" TO "${conname.replace(new RegExp(legacy, 'gi'), 'flazyn')}"`);
      }
      // Cached brand strings inside stored data
      await db.query(`UPDATE integrations SET credentials = replace(credentials::text, '"name": "Z' || 'omic', '"name": "Flazyn')::jsonb
                      WHERE credentials::text ILIKE $1`, [`%"name": "${legacy}%`]);
      await db.query(`UPDATE workspaces SET name = regexp_replace(name, $1, 'Flazyn', 'gi') WHERE name ~* $1`, [legacy]);
      await db.query(`UPDATE users SET email = regexp_replace(email, $1, 'flazyn', 'gi') WHERE email ~* $1`, [legacy]);
    },
  },
  {
    name: '012_create_flazyn_mail',
    sql: `
      CREATE TABLE IF NOT EXISTS flazyn_mail_messages (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
        from_user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        to_user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        cc_user_ids JSONB DEFAULT '[]'::jsonb,
        bcc_user_ids JSONB DEFAULT '[]'::jsonb,
        subject VARCHAR(500),
        body TEXT,
        thread_id UUID DEFAULT gen_random_uuid(),
        parent_message_id UUID REFERENCES flazyn_mail_messages(id) ON DELETE SET NULL,
        is_read BOOLEAN DEFAULT FALSE,
        is_starred BOOLEAN DEFAULT FALSE,
        folder VARCHAR(50) DEFAULT 'inbox',
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_flazyn_mail_workspace ON flazyn_mail_messages(workspace_id);
      CREATE INDEX IF NOT EXISTS idx_flazyn_mail_from_user ON flazyn_mail_messages(from_user_id);
      CREATE INDEX IF NOT EXISTS idx_flazyn_mail_to_user ON flazyn_mail_messages(to_user_id);
      CREATE INDEX IF NOT EXISTS idx_flazyn_mail_thread ON flazyn_mail_messages(thread_id);
      CREATE INDEX IF NOT EXISTS idx_flazyn_mail_folder ON flazyn_mail_messages(folder);
      CREATE INDEX IF NOT EXISTS idx_flazyn_mail_read ON flazyn_mail_messages(is_read);

      CREATE TABLE IF NOT EXISTS flazyn_mail_attachments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        message_id UUID REFERENCES flazyn_mail_messages(id) ON DELETE CASCADE,
        file_url VARCHAR(500),
        file_name VARCHAR(255),
        file_size BIGINT DEFAULT 0,
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_flazyn_mail_attachments_message ON flazyn_mail_attachments(message_id);
    `
  },
  {
    name: '013_drop_legacy_email_feature',
    sql: `
      -- Remove the legacy static email feature set (templates/sequences/flows/triggers).
      -- The per-send log table "emails" and the multi-channel "campaigns" tables are
      -- KEPT: non-email features (analytics, engagement scoring, lead timeline,
      -- merge, WhatsApp/SMS campaigns) depend on them, and the rebuilt marketing
      -- system writes into them.
      ALTER TABLE emails DROP CONSTRAINT IF EXISTS emails_template_id_fkey;
      ALTER TABLE emails DROP CONSTRAINT IF EXISTS emails_campaign_id_fkey;
      ALTER TABLE emails DROP CONSTRAINT IF EXISTS emails_sequence_id_fkey;

      DROP TABLE IF EXISTS email_trigger_logs CASCADE;
      DROP TABLE IF EXISTS email_triggers CASCADE;
      DROP TABLE IF EXISTS email_flow_enrollments CASCADE;
      DROP TABLE IF EXISTS email_flow_edges CASCADE;
      DROP TABLE IF EXISTS email_flow_nodes CASCADE;
      DROP TABLE IF EXISTS email_flows CASCADE;
      DROP TABLE IF EXISTS email_sequence_enrollments CASCADE;
      DROP TABLE IF EXISTS email_sequence_steps CASCADE;
      DROP TABLE IF EXISTS email_sequences CASCADE;
      DROP TABLE IF EXISTS email_templates CASCADE;

      -- Extra columns used by the rebuilt marketing system
      ALTER TABLE emails ADD COLUMN IF NOT EXISTS flow_id UUID;
      ALTER TABLE emails ADD COLUMN IF NOT EXISTS node_key VARCHAR(255);
      ALTER TABLE emails ADD COLUMN IF NOT EXISTS source VARCHAR(50) DEFAULT 'direct';

      CREATE INDEX IF NOT EXISTS idx_emails_flow ON emails(flow_id);
      CREATE INDEX IF NOT EXISTS idx_emails_source ON emails(source);
    `
  },
  {
    name: '014_create_marketing_suite',
    sql: `
      -- ─── Segments: saved dynamic lead audiences ───
      CREATE TABLE IF NOT EXISTS segments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        match_type VARCHAR(10) DEFAULT 'all',
        conditions JSONB DEFAULT '[]'::jsonb,
        created_by UUID REFERENCES users(id),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_segments_workspace ON segments(workspace_id);

      -- ─── Emails designed in the drag-and-drop builder ───
      CREATE TABLE IF NOT EXISTS marketing_emails (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        subject VARCHAR(500),
        design JSONB DEFAULT '[]'::jsonb,
        html TEXT,
        created_by UUID REFERENCES users(id),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_marketing_emails_workspace ON marketing_emails(workspace_id);

      -- ─── Flows: trigger-based automated sequences ───
      CREATE TABLE IF NOT EXISTS flows (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        status VARCHAR(20) DEFAULT 'draft',
        trigger_type VARCHAR(50),
        trigger_config JSONB DEFAULT '{}'::jsonb,
        graph JSONB DEFAULT '{"nodes":[],"edges":[]}'::jsonb,
        live_since TIMESTAMP,
        created_by UUID REFERENCES users(id),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_flows_workspace ON flows(workspace_id);
      CREATE INDEX IF NOT EXISTS idx_flows_status ON flows(status);

      -- ─── Per-lead progress through a flow ───
      CREATE TABLE IF NOT EXISTS flow_enrollments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
        flow_id UUID REFERENCES flows(id) ON DELETE CASCADE,
        lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
        status VARCHAR(20) DEFAULT 'active',
        current_node_key VARCHAR(255),
        entered_at TIMESTAMP DEFAULT NOW(),
        next_action_at TIMESTAMP,
        exit_reason VARCHAR(100),
        completed_at TIMESTAMP,
        UNIQUE(flow_id, lead_id)
      );
      CREATE INDEX IF NOT EXISTS idx_flow_enrollments_flow ON flow_enrollments(flow_id);
      CREATE INDEX IF NOT EXISTS idx_flow_enrollments_lead ON flow_enrollments(lead_id);
      CREATE INDEX IF NOT EXISTS idx_flow_enrollments_due ON flow_enrollments(next_action_at) WHERE status = 'active';

      -- ─── Audit trail of every executed step (powers per-step analytics) ───
      CREATE TABLE IF NOT EXISTS flow_action_log (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
        enrollment_id UUID REFERENCES flow_enrollments(id) ON DELETE CASCADE,
        flow_id UUID REFERENCES flows(id) ON DELETE CASCADE,
        lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
        node_key VARCHAR(255),
        action_type VARCHAR(50),
        status VARCHAR(20),
        detail JSONB DEFAULT '{}'::jsonb,
        executed_at TIMESTAMP DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_flow_action_log_flow ON flow_action_log(flow_id);
      CREATE INDEX IF NOT EXISTS idx_flow_action_log_node ON flow_action_log(flow_id, node_key);
      CREATE INDEX IF NOT EXISTS idx_flow_action_log_enrollment ON flow_action_log(enrollment_id);

      -- ─── Extend campaigns for the rebuilt email campaign experience ───
      ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS segment_id UUID REFERENCES segments(id) ON DELETE SET NULL;
      ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS marketing_email_id UUID;
      ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS converted_count INTEGER DEFAULT 0;
      ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS attributed_value NUMERIC DEFAULT 0;
      ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS send_window_hours INTEGER;
    `
  },
  {
    name: '015_align_automation_schema',
    sql: `
      -- Columns the automation/integration code reads and writes but the
      -- original tables never had (every write to them was failing).

      -- Lead automation rules: source filter + condition/action lists
      ALTER TABLE lead_automation_rules ADD COLUMN IF NOT EXISTS trigger_source VARCHAR(50) DEFAULT 'any';
      ALTER TABLE lead_automation_rules ADD COLUMN IF NOT EXISTS conditions JSONB DEFAULT '[]'::jsonb;
      ALTER TABLE lead_automation_rules ADD COLUMN IF NOT EXISTS actions JSONB DEFAULT '[]'::jsonb;

      -- Lead distribution: round-robin pointer lives in config.rr_index
      ALTER TABLE lead_distribution_config ADD COLUMN IF NOT EXISTS name VARCHAR(255);

      -- WhatsApp chat assistant rules (IF trigger THEN action)
      ALTER TABLE whatsapp_chat_assistant_rules ADD COLUMN IF NOT EXISTS trigger_condition VARCHAR(50) DEFAULT 'contains';
      ALTER TABLE whatsapp_chat_assistant_rules ADD COLUMN IF NOT EXISTS trigger_value TEXT;
      ALTER TABLE whatsapp_chat_assistant_rules ADD COLUMN IF NOT EXISTS action_type VARCHAR(50) DEFAULT 'send_template';
      ALTER TABLE whatsapp_chat_assistant_rules ADD COLUMN IF NOT EXISTS action_value TEXT;
      ALTER TABLE whatsapp_chat_assistant_rules ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;

      -- Outgoing webhooks: multi-event subscriptions
      ALTER TABLE outgoing_webhooks ADD COLUMN IF NOT EXISTS events JSONB DEFAULT '[]'::jsonb;
      ALTER TABLE outgoing_webhooks ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;
      UPDATE outgoing_webhooks SET events = jsonb_build_array(trigger_event)
        WHERE (events IS NULL OR events = '[]'::jsonb) AND trigger_event IS NOT NULL;
      UPDATE outgoing_webhooks SET is_active = is_enabled WHERE is_enabled IS NOT NULL;
      ALTER TABLE outgoing_webhooks ALTER COLUMN trigger_event DROP NOT NULL;
      ALTER TABLE outgoing_webhook_logs ADD COLUMN IF NOT EXISTS event VARCHAR(100);
      ALTER TABLE outgoing_webhook_logs ADD COLUMN IF NOT EXISTS payload JSONB;
      ALTER TABLE outgoing_webhook_logs ADD COLUMN IF NOT EXISTS response_code INTEGER;
      ALTER TABLE outgoing_webhook_logs ADD COLUMN IF NOT EXISTS status VARCHAR(20);
      ALTER TABLE outgoing_webhook_logs ADD COLUMN IF NOT EXISTS error_message TEXT;

      -- WhatsApp auto-responder / sequences
      ALTER TABLE whatsapp_auto_responder ADD COLUMN IF NOT EXISTS message_template TEXT;
      ALTER TABLE whatsapp_auto_responder ADD COLUMN IF NOT EXISTS trigger_type VARCHAR(50) DEFAULT 'new_lead';
      ALTER TABLE whatsapp_sequences ADD COLUMN IF NOT EXISTS description TEXT;
      ALTER TABLE whatsapp_sequences ADD COLUMN IF NOT EXISTS steps JSONB DEFAULT '[]'::jsonb;
      ALTER TABLE whatsapp_sequences ADD COLUMN IF NOT EXISTS created_by UUID;
      ALTER TABLE whatsapp_sequence_steps ADD COLUMN IF NOT EXISTS template_id UUID;
      ALTER TABLE whatsapp_sequence_steps ADD COLUMN IF NOT EXISTS message TEXT;
      ALTER TABLE whatsapp_sequence_steps ADD COLUMN IF NOT EXISTS delay_hours INTEGER DEFAULT 0;
      ALTER TABLE whatsapp_sequence_steps ADD COLUMN IF NOT EXISTS trigger_type VARCHAR(50);

      -- Inbound WhatsApp numbers that are not leads yet (contact import)
      ALTER TABLE whatsapp_messages ADD COLUMN IF NOT EXISTS phone VARCHAR(50);
      CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_phone ON whatsapp_messages(phone);
      UPDATE whatsapp_messages wm SET phone = l.phone FROM leads l
        WHERE wm.lead_id = l.id AND wm.phone IS NULL;

      -- Branding / embed forms
      ALTER TABLE workspace_branding ADD COLUMN IF NOT EXISTS show_branding BOOLEAN DEFAULT TRUE;
      ALTER TABLE workspace_branding ADD COLUMN IF NOT EXISTS custom_css TEXT;
      ALTER TABLE embed_forms ADD COLUMN IF NOT EXISTS facebook_pixel_id VARCHAR(100);
      ALTER TABLE embed_forms ADD COLUMN IF NOT EXISTS google_tag_manager_id VARCHAR(100);
      ALTER TABLE embed_forms ADD COLUMN IF NOT EXISTS custom_tracking_html TEXT;

      -- leads.tags is a JSONB array everywhere in the code, so repair rows that
      -- were stored as an empty object
      UPDATE leads SET tags = '[]'::jsonb WHERE tags IS NULL OR jsonb_typeof(tags) <> 'array';
      CREATE INDEX IF NOT EXISTS idx_leads_tags ON leads USING GIN (tags);
    `
  },
  {
    name: '016_templates_and_interest_tracking',
    sql: `
      -- Template library: forms, emails, WhatsApp, SMS (system + per-workspace)
      CREATE TABLE IF NOT EXISTS templates (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
        slug VARCHAR(120) UNIQUE,
        kind VARCHAR(20) NOT NULL,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        category VARCHAR(80),
        format VARCHAR(20) DEFAULT 'html',
        content TEXT NOT NULL,
        preview_color VARCHAR(20),
        is_system BOOLEAN DEFAULT FALSE,
        source VARCHAR(20) DEFAULT 'custom',
        created_by UUID,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_templates_workspace_kind ON templates(workspace_id, kind);
      ALTER TABLE lead_form_pages ADD COLUMN IF NOT EXISTS template_id UUID REFERENCES templates(id) ON DELETE SET NULL;

      -- Website + document interest tracking
      ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS tracking_key VARCHAR(64) UNIQUE;
      CREATE TABLE IF NOT EXISTS engagement_sessions (
        id VARCHAR(64) PRIMARY KEY,
        workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
        lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
        visitor_id VARCHAR(64),
        channel VARCHAR(20) NOT NULL,
        content_tracking_id UUID,
        referrer TEXT,
        landing_url TEXT,
        device VARCHAR(20),
        total_seconds INTEGER DEFAULT 0,
        notified BOOLEAN DEFAULT FALSE,
        started_at TIMESTAMP DEFAULT NOW(),
        last_seen_at TIMESTAMP DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_eng_sessions_lead ON engagement_sessions(lead_id, last_seen_at DESC);
      CREATE INDEX IF NOT EXISTS idx_eng_sessions_visitor ON engagement_sessions(workspace_id, visitor_id);
      CREATE INDEX IF NOT EXISTS idx_eng_sessions_live ON engagement_sessions(workspace_id, last_seen_at DESC);
      CREATE TABLE IF NOT EXISTS engagement_views (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        session_id VARCHAR(64) REFERENCES engagement_sessions(id) ON DELETE CASCADE,
        workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
        object_key TEXT NOT NULL,
        url TEXT,
        title TEXT,
        page_number INTEGER,
        seconds INTEGER DEFAULT 0,
        max_scroll INTEGER DEFAULT 0,
        first_at TIMESTAMP DEFAULT NOW(),
        last_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(session_id, object_key)
      );
      CREATE INDEX IF NOT EXISTS idx_eng_views_session ON engagement_views(session_id);
      CREATE TABLE IF NOT EXISTS web_visitors (
        workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
        visitor_id VARCHAR(64) NOT NULL,
        lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,
        first_seen_at TIMESTAMP DEFAULT NOW(),
        last_seen_at TIMESTAMP DEFAULT NOW(),
        PRIMARY KEY (workspace_id, visitor_id)
      );
      ALTER TABLE content_tracking ADD COLUMN IF NOT EXISTS page_count INTEGER;
    `
  },
  {
    // One-time: stored times were written in the Postgres server's local zone
    // (e.g. America/Los_Angeles). The app now runs every session in UTC, so
    // shift the DB-generated timestamps once. Client-supplied dates are left alone.
    name: '016a_normalize_timestamps_to_utc',
    run: async (db) => {
      await db.query('CREATE TABLE IF NOT EXISTS app_flags (name VARCHAR(100) PRIMARY KEY, value TEXT, created_at TIMESTAMP DEFAULT NOW())');
      const done = await db.query("SELECT 1 FROM app_flags WHERE name = 'timestamps_utc'");
      if (done.rows.length) return;
      // Read the server's configured zone on a plain connection (the app pool forces UTC).
      const { Client } = require('pg');
      const cfg = require('../config');
      const raw = new Client({ host: cfg.db.host, port: cfg.db.port, database: cfg.db.name, user: cfg.db.user, password: cfg.db.password, ssl: cfg.db.ssl ? { rejectUnauthorized: false } : false });
      await raw.connect();
      const tz = (await raw.query('SHOW timezone')).rows[0]?.TimeZone || 'UTC';
      await raw.end();
      if (!/^(UTC|Etc\/UTC|GMT|Etc\/GMT|Zulu)$/i.test(tz)) {
        const cols = await db.query(
          `SELECT table_name, column_name FROM information_schema.columns
           WHERE table_schema = 'public' AND data_type = 'timestamp without time zone'
             AND column_name = ANY($1)`,
          [['created_at', 'updated_at', 'last_activity_at', 'last_seen_at', 'started_at', 'first_seen_at', 'executed_at', 'entered_at',
            'sent_at', 'opened_at', 'clicked_at', 'replied_at', 'completed_at', 'first_opened_at', 'last_opened_at', 'first_at', 'last_at',
            'live_since', 'next_action_at', 'next_send_at', 'next_step_at', 'enrolled_at', 'invitation_accepted_at', 'delivered_at', 'read_at']]
        );
        for (const { table_name: t, column_name: c } of cols.rows) {
          await db.query(`UPDATE "${t}" SET "${c}" = ("${c}" AT TIME ZONE $1) AT TIME ZONE 'UTC' WHERE "${c}" IS NOT NULL`, [tz]);
        }
      }
      await db.query("INSERT INTO app_flags (name, value) VALUES ('timestamps_utc', $1)", [tz]);
    },
  },
  {
    // Upsert the built-in templates from code so improvements ship with deploys.
    name: '016b_seed_system_templates',
    run: async (db) => {
      const { systemTemplates } = require('../templates/library');
      for (const t of systemTemplates()) {
        await db.query(
          `INSERT INTO templates (slug, kind, name, description, category, format, content, preview_color, is_system, source)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,true,'system')
           ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description, category = EXCLUDED.category,
             format = EXCLUDED.format, content = EXCLUDED.content, preview_color = EXCLUDED.preview_color, updated_at = NOW()`,
          [t.slug, t.kind, t.name, t.description || '', t.category || null, t.format, t.content, t.preview_color || null]
        );
      }
      await db.query("UPDATE workspaces SET tracking_key = 'fz_' || replace(gen_random_uuid()::text, '-', '') WHERE tracking_key IS NULL");
    },
  },
  {
    name: '017_sequence_retries',
    sql: `
      ALTER TABLE whatsapp_sequence_progress ADD COLUMN IF NOT EXISTS failed_attempts INTEGER DEFAULT 0;
      CREATE UNIQUE INDEX IF NOT EXISTS idx_wsp_sequence_lead ON whatsapp_sequence_progress(sequence_id, lead_id);
    `
  },
  {
    name: '017c_campaign_files',
    sql: `
      ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS file_id UUID;
      ALTER TABLE campaign_recipients ADD COLUMN IF NOT EXISTS error_message TEXT;
    `,
  },
  {
    name: '018_intelligence',
    sql: `
      ALTER TABLE leads ADD COLUMN IF NOT EXISTS deal_value NUMERIC(14,2);
      ALTER TABLE leads ADD COLUMN IF NOT EXISTS predicted_value NUMERIC(14,2);
      ALTER TABLE calls ADD COLUMN IF NOT EXISTS recording_url TEXT;
      ALTER TABLE calls ADD COLUMN IF NOT EXISTS transcript TEXT;
      ALTER TABLE calls ADD COLUMN IF NOT EXISTS analysis JSONB;
      ALTER TABLE follow_ups ADD COLUMN IF NOT EXISTS brief JSONB;
      ALTER TABLE follow_ups ADD COLUMN IF NOT EXISTS brief_sent_at TIMESTAMP;
      CREATE TABLE IF NOT EXISTS ad_spend (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
        source VARCHAR(40) NOT NULL,
        campaign VARCHAR(255) NOT NULL DEFAULT '',
        month DATE NOT NULL,
        amount NUMERIC(14,2) NOT NULL DEFAULT 0,
        created_at TIMESTAMP DEFAULT NOW(),
        UNIQUE (workspace_id, source, campaign, month)
      );
      CREATE TABLE IF NOT EXISTS deal_predictions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
        lead_id UUID REFERENCES leads(id) ON DELETE CASCADE UNIQUE,
        lead_source VARCHAR(60),
        predicted NUMERIC(14,2),
        actual NUMERIC(14,2),
        brief JSONB,
        predicted_at TIMESTAMP DEFAULT NOW(),
        closed_at TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_deal_predictions_ws ON deal_predictions(workspace_id, closed_at);
      CREATE INDEX IF NOT EXISTS idx_follow_ups_brief ON follow_ups(status, due_date) WHERE brief_sent_at IS NULL;
    `,
  },
  {
    name: '019_managed_connections',
    sql: `
      CREATE TABLE IF NOT EXISTS connection_requests (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
        platform VARCHAR(20) NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'requested',
        asset_name VARCHAR(255),
        asset_url TEXT,
        client_note TEXT,
        ops_note TEXT,
        message_to_client TEXT,
        requested_by UUID REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        connected_at TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_conn_req_ws ON connection_requests(workspace_id, platform);
      CREATE INDEX IF NOT EXISTS idx_conn_req_status ON connection_requests(status, created_at);
    `,
  },
  {
    // "Request an update": a manager nudges the assigned member about a lead.
    // The trigger closes the request as soon as someone other than the
    // requester logs real work on the lead (call, note, message, stage, ...).
    name: '020_update_requests',
    run: async (db) => {
      await db.query(`
        CREATE TABLE IF NOT EXISTS update_requests (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
          lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
          requested_by UUID REFERENCES users(id) ON DELETE SET NULL,
          assigned_to UUID REFERENCES users(id) ON DELETE SET NULL,
          note TEXT,
          auto BOOLEAN DEFAULT false,
          created_at TIMESTAMP DEFAULT NOW(),
          reminded_at TIMESTAMP,
          resolved_at TIMESTAMP,
          resolved_by UUID REFERENCES users(id) ON DELETE SET NULL,
          resolved_type VARCHAR(50),
          resolved_note TEXT,
          resolved_notified_at TIMESTAMP
        )`);
      await db.query('CREATE UNIQUE INDEX IF NOT EXISTS uq_update_requests_open ON update_requests(lead_id) WHERE resolved_at IS NULL');
      await db.query('CREATE INDEX IF NOT EXISTS idx_update_requests_ws ON update_requests(workspace_id, resolved_at)');
      await db.query(`
        CREATE OR REPLACE FUNCTION flazyn_resolve_update_requests() RETURNS trigger AS $$
        BEGIN
          IF NEW.user_id IS NOT NULL AND NEW.lead_id IS NOT NULL AND NEW.type NOT IN (
            'update_requested', 'update_request_cleared', 'lead_assigned', 'lead_transfer', 'lead_distributed',
            'bulk_action', 'lead_merged', 'flow_enrolled', 'meta_capi', 'automation_rule', 'lead_created'
          ) THEN
            UPDATE update_requests
               SET resolved_at = NOW(), resolved_by = NEW.user_id, resolved_type = NEW.type, resolved_note = LEFT(NEW.description, 300)
             WHERE lead_id = NEW.lead_id AND resolved_at IS NULL AND NEW.user_id IS DISTINCT FROM requested_by;
          END IF;
          RETURN NEW;
        END
        $$ LANGUAGE plpgsql`);
      await db.query('DROP TRIGGER IF EXISTS trg_resolve_update_requests ON lead_activities');
      await db.query(`CREATE TRIGGER trg_resolve_update_requests AFTER INSERT ON lead_activities
        FOR EACH ROW EXECUTE FUNCTION flazyn_resolve_update_requests()`);
    },
  },
  {
    name: '017b_follow_up_reminders',
    sql: `
      ALTER TABLE follow_ups ADD COLUMN IF NOT EXISTS reminded_at TIMESTAMP;
      ALTER TABLE follow_ups ADD COLUMN IF NOT EXISTS overdue_notified_at TIMESTAMP;
      CREATE INDEX IF NOT EXISTS idx_follow_ups_due ON follow_ups(status, due_date);
    `
  },
  {
    // Scores from the old activity formula gave every new lead ~45 regardless of
    // behaviour. Recompute everyone once with the interest engine.
    name: '016c_recompute_interest_scores',
    run: async (db) => {
      const done = await db.query("SELECT 1 FROM app_flags WHERE name = 'interest_v1'");
      if (done.rows.length) return;
      const { refreshLeadInterest } = require('../services/interestService');
      const leads = await db.query('SELECT id, workspace_id FROM leads');
      for (const l of leads.rows) await refreshLeadInterest(l.id, l.workspace_id);
      await db.query("INSERT INTO app_flags (name, value) VALUES ('interest_v1', $1)", [String(leads.rows.length)]);
    },
  },
];

async function runMigrations() {
  logger.info('Starting database migrations (PostgreSQL)...');
  
  // First, ensure the pgcrypto extension is available for gen_random_uuid()
  await db.query('CREATE EXTENSION IF NOT EXISTS "pgcrypto"');
  logger.info('pgcrypto extension enabled');
  
  let completedCount = 0;
  
  for (const migration of migrations) {
    try {
      // Check if migration was already run
      const checkResult = await db.query(
        'SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = $1)',
        [migration.name.split('_').slice(1).join('_')]
      );
      
      if (typeof migration.run === 'function') {
        await migration.run(db);
        completedCount++;
        logger.info(`Migration ${migration.name} completed successfully`);
        continue;
      }

      // Split by semicolons and run each statement
      const statements = migration.sql
        .split(';')
        .map(s => s.trim())
        .filter(s => s.length > 0);
      
      for (const stmt of statements) {
        await db.query(stmt);
      }
      
      completedCount++;
      logger.info(`Migration ${migration.name} completed successfully`);
    } catch (err) {
      // If table already exists, that's fine
      if (err.code === '42P07' || err.message.includes('already exists')) {
        completedCount++;
        logger.info(`Migration ${migration.name} skipped (already exists)`);
      } else {
        logger.error(`Migration ${migration.name} failed:`, err.message);
        throw err;
      }
    }
  }
  
  logger.info(`All ${completedCount}/${migrations.length} migrations completed successfully`);
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