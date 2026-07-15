# CRM Final Platform

A complete, production-ready, mobile-first CRM SaaS platform with full feature parity with Privyr, plus a comprehensive Email Marketing System.

## Tech Stack

- **Mobile App**: React Native + React Navigation + Zustand
- **Web Dashboard**: React.js + Vite + Tailwind CSS + Recharts + React Flow
- **Backend**: Node.js + Express.js + Socket.io
- **Database**: PostgreSQL
- **Cache & Queues**: Redis + BullMQ
- **Email**: SendGrid
- **WhatsApp**: Meta WhatsApp Business API
- **SMS**: Twilio
- **Payments**: Stripe
- **File Storage**: AWS S3
- **AI**: OpenAI GPT-4o
- **Push Notifications**: Firebase Cloud Messaging
- **Auth**: JWT with refresh token rotation

## Project Structure

```
crm/
├── backend/          # Node.js + Express API server
├── web/              # React.js web dashboard
├── mobile/           # React Native mobile app
└── package.json      # Root monorepo scripts
```

## Features

### Authentication & Security
- JWT with refresh token rotation
- Google OAuth login
- Two-factor authentication (2FA via email OTP)
- Role-based access control (Super Admin, Admin, Sales Manager, Sales Agent)
- Multi-tenant workspace isolation
- Password reset flow
- Team invitations

### Lead Management
- Full CRUD with duplicate detection
- Lead stages (New, Contacted, Interested, Negotiating, Won, Lost)
- Tags and groups
- Custom fields
- Lead scoring (auto-calculated based on activity, engagement, recency)
- CSV import/export with field mapping
- Bulk actions (add tag, change stage, assign, delete)
- Auto-assignment rules
- Territory management
- Activity timeline (auto-logged)
- Follow-ups with reminders and snooze

### Email Marketing System
- Template builder with variable support ({{First_Name}}, {{Agent_Name}}, etc.)
- Email sequences with multi-step drips
- Visual email flow builder (React Flow with IF/ELSE conditions)
- Email campaigns with scheduling and A/B testing
- Open/click/reply tracking with tracking pixels
- Unsubscribe management
- AI subject line generation (OpenAI GPT-4o)
- Email analytics (delivery rate, open rate, click rate, reply rate)
- Re-engagement campaigns for cold leads

### WhatsApp
- Official Meta WhatsApp Business API integration
- Template management
- One-on-one messaging
- Bulk send via queues
- Two-way inbox with conversations
- Webhook handling for incoming messages
- Media sharing

### SMS
- Twilio integration
- Template management
- One-on-one messaging
- Bulk send via queues
- Two-way inbox
- Webhook handling for replies

### Calling
- Device dialer integration (tel: links)
- Call logging with outcomes
- Follow-up scheduling from call screen
- Call list with priority sorting
- Call history per lead

### Content & File System
- AWS S3 file uploads
- Folder organization
- Trackable file sharing (email, WhatsApp, SMS)
- Open tracking with analytics
- Restricted file access

### Campaigns
- Multi-channel (Email, WhatsApp, SMS)
- Audience filtering (stage, source, city, tags)
- Scheduling
- A/B testing support
- Real-time stats (sent, delivered, opened, clicked, replied, failed)
- Cancel scheduled campaigns

### Team Management
- Member invitations with role assignment
- Suspend/reactivate members
- Agent performance dashboard (calls, emails, WhatsApp, SMS, won/lost)
- Lead transfer between agents
- Team activity feed (last 24h)
- Territory assignment
- Assignment rules configuration
- Plan-based agent limits

### Analytics & Reports
- Dashboard overview (leads, calls, emails, follow-ups, conversion)
- Lead analytics (by source, city, budget, agent, trend)
- Conversion analytics (by source, agent, avg time to close)
- Pipeline analytics (stage distribution, stuck leads)
- Agent performance comparison
- Date range filtering
- Exportable reports

### Integrations
- Facebook Lead Ads
- Google Lead Forms
- TikTok Lead Ads
- Instagram Lead Ads
- Zapier webhooks
- Meta Conversions API
- Custom webhook endpoints with field mapping
- Embeddable website forms with auto-lead capture
- Google Maps API

### Billing & Subscriptions
- Stripe integration with checkout sessions
- Plans: Free, Pro ($19), Team ($49), Business ($99), Enterprise (custom)
- Stripe customer portal
- Webhook handling (subscription created, updated, deleted, payment failed)
- Invoice history
- Plan-based agent limits
- Super admin panel

### Notifications
- Push notifications via Firebase
- In-app notifications
- Configurable notification preferences per user
- Quiet hours settings
- Real-time via Socket.io

### Mobile App
- 5 tabs: Home, Leads, Campaigns, Reports, Settings
- Offline lead viewing and note-taking
- Native-feeling UI
- Push notification support
- Session persistence
- Quick actions (call, WhatsApp, email, SMS from lead detail)
- Add leads on the go
- Follow-up management

### Multi-Language Support
- English (base)
- Urdu ready
- Arabic ready

## Setup Instructions

### Prerequisites
- Node.js 18+
- PostgreSQL 14+
- Redis 6+
- Android Studio / Xcode (for mobile)

### 1. Backend Setup

```bash
cd backend
npm install

# Copy and configure environment variables
cp .env.example .env
# Edit .env with your database, Redis, and API keys

# Run database migrations
npm run migrate

# Seed demo data
npm run seed

# Start the API server
npm run dev

# Start the queue workers (in another terminal)
npm run worker
```

The API server runs on `http://localhost:5000`.

### 2. Web Dashboard Setup

```bash
cd web
npm install
npm run dev
```

The web dashboard runs on `http://localhost:3000`.

### 3. Mobile App Setup

```bash
cd mobile
npm install

# iOS
cd ios && pod install && cd ..
npm run ios

# Android
npm run android
```

### 4. Run Everything (from root)

```bash
npm install
npm run dev    # Starts backend + web concurrently
```

## Demo Accounts

After running the seed, these accounts are available:

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@demo.com | password123 |
| Manager | manager@demo.com | password123 |
| Agent 1 | agent1@demo.com | password123 |
| Agent 2 | agent2@demo.com | password123 |

## Environment Variables

See `backend/.env.example` for the complete list. Key variables:

- `DATABASE_URL` - PostgreSQL connection string
- `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD`
- `JWT_SECRET`, `JWT_REFRESH_SECRET`
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
- `SENDGRID_API_KEY`, `SENDGRID_FROM_EMAIL`
- `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER`
- `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_VERIFY_TOKEN`
- `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`
- `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_S3_BUCKET`, `AWS_S3_REGION`
- `OPENAI_API_KEY`
- `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`
- `FACEBOOK_APP_ID`, `FACEBOOK_APP_SECRET`
- `TIKTOK_APP_ID`, `TIKTOK_APP_SECRET`
- `GOOGLE_MAPS_API_KEY`

## API Endpoints

### Authentication
- `POST /api/auth/signup` - Create account
- `POST /api/auth/login` - Login
- `POST /api/auth/refresh-token` - Refresh access token
- `POST /api/auth/logout` - Logout
- `POST /api/auth/forgot-password` - Request password reset
- `POST /api/auth/reset-password` - Reset password with token
- `POST /api/auth/verify-2fa` - Verify 2FA code
- `POST /api/auth/toggle-2fa` - Enable/disable 2FA
- `POST /api/auth/accept-invitation` - Accept team invitation

### Leads
- `GET /api/leads` - List leads (with filters, pagination, search)
- `POST /api/leads` - Create lead
- `GET /api/leads/:id` - Get lead details
- `PUT /api/leads/:id` - Update lead
- `DELETE /api/leads/:id` - Delete lead
- `POST /api/leads/import` - Import CSV
- `POST /api/leads/export` - Export CSV
- `POST /api/leads/bulk` - Bulk actions
- `GET /api/leads/stages` - Get stages
- `POST /api/leads/stages` - Create stage
- `GET /api/leads/tags` - Get tags
- `POST /api/leads/tags` - Create tag
- `GET /api/leads/groups` - Get groups
- `POST /api/leads/groups` - Create group
- `GET /api/leads/custom-fields` - Get custom fields
- `POST /api/leads/custom-fields` - Create custom field

### Email Marketing
- `GET /api/emails/templates` - List templates
- `POST /api/emails/templates` - Create template
- `PUT /api/emails/templates/:id` - Update template
- `DELETE /api/emails/templates/:id` - Delete template
- `POST /api/emails/templates/:id/duplicate` - Duplicate template
- `POST /api/emails/templates/preview` - Preview template
- `GET /api/emails/templates/:id/stats` - Template stats
- `GET /api/emails/sequences` - List sequences
- `POST /api/emails/sequences` - Create sequence
- `GET /api/emails/sequences/:id` - Sequence details
- `POST /api/emails/sequences/enroll` - Enroll lead in sequence
- `PUT /api/emails/sequences/:id/lead/:leadId/pause` - Pause for lead
- `PUT /api/emails/sequences/:id/lead/:leadId/resume` - Resume for lead
- `DELETE /api/emails/sequences/:id/lead/:leadId` - Remove from sequence
- `GET /api/emails/flows` - List flows
- `POST /api/emails/flows` - Create flow
- `GET /api/emails/flows/:id` - Flow details
- `PUT /api/emails/flows/:id` - Update flow
- `POST /api/emails/flows/:id/publish` - Publish flow
- `GET /api/emails/triggers` - List triggers
- `POST /api/emails/triggers` - Create trigger
- `PUT /api/emails/triggers/:id/toggle` - Toggle trigger
- `GET /api/emails/analytics` - Email analytics
- `POST /api/emails/ai/subject-lines` - AI subject line generation
- `GET /api/emails/track/open/:trackingId` - Track email open
- `GET /api/emails/unsubscribe/:trackingId` - Unsubscribe

### Campaigns
- `GET /api/campaigns` - List campaigns
- `GET /api/campaigns/:id` - Campaign details
- `POST /api/campaigns` - Create campaign
- `POST /api/campaigns/:id/send` - Send campaign
- `POST /api/campaigns/:id/schedule` - Schedule campaign
- `POST /api/campaigns/:id/cancel` - Cancel campaign
- `GET /api/campaigns/:id/stats` - Campaign stats

### WhatsApp
- `GET /api/whatsapp/webhook` - Webhook verification
- `POST /api/whatsapp/webhook` - Incoming webhook
- `GET /api/whatsapp/templates` - List templates
- `POST /api/whatsapp/templates` - Create template
- `POST /api/whatsapp/send` - Send message
- `POST /api/whatsapp/bulk-send` - Bulk send
- `GET /api/whatsapp/inbox` - Get inbox
- `GET /api/whatsapp/conversations` - Get conversations

### SMS
- `POST /api/sms/webhook` - Twilio webhook
- `GET /api/sms/templates` - List templates
- `POST /api/sms/templates` - Create template
- `POST /api/sms/send` - Send SMS
- `POST /api/sms/bulk-send` - Bulk send
- `GET /api/sms/inbox` - Get inbox

### Calls
- `POST /api/calls/log` - Log a call
- `GET /api/calls` - List calls
- `GET /api/calls/call-list` - Get call list

### Follow-ups
- `GET /api/follow-ups` - List follow-ups
- `POST /api/follow-ups` - Create follow-up
- `PUT /api/follow-ups/:id/complete` - Complete follow-up
- `PUT /api/follow-ups/:id/snooze` - Snooze follow-up
- `DELETE /api/follow-ups/:id` - Delete follow-up

### Content
- `GET /api/content` - List files
- `POST /api/content` - Upload file
- `DELETE /api/content/:id` - Delete file
- `POST /api/content/send` - Send file to lead
- `GET /api/content/track/:trackingId` - Track file open
- `GET /api/content/:fileId/analytics` - File analytics
- `GET /api/content/folders` - List folders
- `POST /api/content/folders` - Create folder

### Team
- `GET /api/team` - List team members
- `POST /api/team/invite` - Invite member
- `PUT /api/team/:id` - Update member
- `POST /api/team/:id/suspend` - Suspend member
- `POST /api/team/:id/reactivate` - Reactivate member
- `POST /api/team/transfer-leads` - Transfer leads
- `GET /api/team/:agentId/performance` - Agent performance
- `GET /api/team/activity-feed` - Team activity feed
- `GET /api/team/territories` - List territories
- `POST /api/team/territories` - Assign territory
- `DELETE /api/team/territories/:id` - Remove territory
- `GET /api/team/assignment-rules` - Get assignment rules
- `PUT /api/team/assignment-rules` - Update assignment rules
- `GET /api/team/profile` - Get profile
- `PUT /api/team/profile` - Update profile
- `POST /api/team/device-token` - Register device token
- `DELETE /api/team/account` - Delete account

### Analytics
- `GET /api/analytics/dashboard` - Dashboard data
- `GET /api/analytics/leads` - Lead analytics
- `GET /api/analytics/conversion` - Conversion analytics
- `GET /api/analytics/pipeline` - Pipeline analytics
- `GET /api/analytics/agents` - Agent performance
- `GET /api/analytics/notifications` - Get notifications
- `PUT /api/analytics/notifications/:id/read` - Mark notification read
- `PUT /api/analytics/notifications/read-all` - Mark all read

### Billing
- `GET /api/billing/plans` - Get plans
- `GET /api/billing/subscription` - Current subscription
- `POST /api/billing/checkout` - Create checkout session
- `POST /api/billing/portal` - Create portal session
- `POST /api/billing/webhook` - Stripe webhook
- `GET /api/billing/super-admin/stats` - Super admin stats

### Integrations
- `GET /api/integrations` - List integrations
- `POST /api/integrations/connect` - Connect integration
- `DELETE /api/integrations/:id/disconnect` - Disconnect
- `GET /api/integrations/webhooks` - List webhooks
- `POST /api/integrations/webhooks` - Create webhook
- `POST /api/integrations/webhook/:workspaceId/:type/:secret` - Webhook receiver
- `GET /api/integrations/embed-forms` - List embed forms
- `POST /api/integrations/embed-forms` - Create embed form
- `GET /api/integrations/embed/:formKey` - Serve embed form
- `POST /api/integrations/embed/:formKey` - Submit embed form
- `GET /api/integrations/embed-forms/:id/code` - Get embed code

## License

Proprietary. All rights reserved.
