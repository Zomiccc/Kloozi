# CRM Final Platform

A complete, production-ready, mobile-first CRM SaaS platform inspired by Privyr, plus a comprehensive Email Marketing System that goes beyond Privyr's feature set.

## Tech Stack

- **Mobile App**: React Native + React Navigation + Zustand
- **Web Dashboard**: React.js + Vite + Tailwind CSS + Recharts + React Flow
- **Backend**: Node.js + Express.js + Socket.io
- **Database**: PostgreSQL (production) / JSON file DB (local dev — zero setup)
- **Cache & Queues**: Redis + BullMQ (production) / In-memory fallback (local dev — zero setup)
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

## Quick Start (Local Dev — Zero External Dependencies)

The app runs **without PostgreSQL, Redis, or any API keys**. The backend uses a JSON file database and in-memory cache/queues as fallbacks.

### 1. Backend

```bash
cd backend
npm install

# Create .env (minimum: JWT_SECRET and JWT_REFRESH_SECRET)
# See backend/.env.example for all variables

# Create database tables (JSON file DB)
npm run migrate

# Seed demo data
npm run seed

# Start the API server
npm run dev
```

The API server runs on `http://localhost:5000`.

> **Note**: No need to run `npm run worker` in local dev — jobs are processed inline automatically.

### 2. Web Dashboard

```bash
cd web
npm install
npm run dev
```

The web dashboard runs on `http://localhost:3000`.

### 3. Mobile App

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

## Production Setup

For production, use PostgreSQL and Redis:

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

See `backend/.env.example` for the complete list.

### Required (Local Dev)
- `JWT_SECRET`, `JWT_REFRESH_SECRET` - For auth tokens

### Required (Production)
- `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` - PostgreSQL
- `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD` - Redis cache/queues
- `JWT_SECRET`, `JWT_REFRESH_SECRET` - For auth tokens

### Optional (Only Needed for Specific Features)
| Variable | Feature |
|----------|---------|
| `SENDGRID_API_KEY`, `SENDGRID_FROM_EMAIL` | Sending real emails |
| `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER` | Sending real SMS |
| `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_VERIFY_TOKEN` | WhatsApp messaging |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | Payment processing |
| `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_S3_BUCKET`, `AWS_REGION` | File uploads to S3 |
| `OPENAI_API_KEY` | AI subject line generation |
| `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY` | Push notifications |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Google OAuth login |
| `FACEBOOK_APP_ID`, `FACEBOOK_APP_SECRET` | Facebook Lead Ads integration |
| `TIKTOK_APP_ID`, `TIKTOK_APP_SECRET` | TikTok Lead Ads integration |
| `GOOGLE_MAPS_API_KEY` | Google Maps integration |

> **All features work in demo mode without API keys** — they return graceful "not configured" responses instead of crashing.

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

## Privyr Feature Comparison

### Feature Parity with Privyr

| Privyr Feature | CRM Final Status | Notes |
|----------------|-----------------|-------|
| **Lead Capture** | | |
| Lead Source Integrations (Facebook Ads, Google Forms, Zapier, webhooks) | ✅ Implemented | Facebook, Google, TikTok, Instagram, Zapier, custom webhooks |
| Instant Lead Alerts | ✅ Implemented | Push notifications via Firebase + in-app notifications |
| Privyr Lead Forms (shareable via link/QR) | ✅ Implemented | Embeddable forms with custom fields, shareable via link |
| Lead Assignment & Distribution | ✅ Implemented | Auto-assignment rules, round-robin, territory-based |
| AI Lead Parsing from Email | ❌ Missing | Not implemented — leads from email alerts require manual or webhook parsing |
| Auto-Merge Duplicate Leads | ⚠️ Partial | Duplicate detection on create, but no auto-merge — returns duplicate warning |
| Import from Phonebook | ❌ Missing | Mobile app doesn't have phonebook import |
| Import from Excel/CSV | ✅ Implemented | CSV import with field mapping |
| **Lead Engagement** | | |
| Contact via WhatsApp, Text, Call, Email | ✅ Implemented | All four channels with template support |
| Follow-Up Sequences (multi-step drips) | ✅ Implemented | Email sequences with configurable delays + WhatsApp/SMS sequences |
| Message/File/Page Templates | ✅ Implemented | Email, WhatsApp, and SMS templates with variable personalization |
| File & Page Tracking (view notifications) | ✅ Implemented | S3 file upload + tracking pixel + open analytics |
| File/Page Branding & Personalization | ⚠️ Partial | Personalization via variables; no custom branding/logo overlay on files |
| Bulk Calling | ⚠️ Partial | Call list with priority sorting, but no sequential bulk dial mode |
| Bulk Messaging | ✅ Implemented | Bulk send for WhatsApp, SMS, and email via campaigns |
| WhatsApp Auto-Responder (24/7 auto-reply) | ⚠️ Partial | Webhook handler exists for incoming WhatsApp, but no auto-responder logic for new leads |
| WhatsApp Campaigns | ✅ Implemented | Bulk WhatsApp campaigns with template support |
| WhatsApp Contact Import | ❌ Missing | No auto-import of leads from WhatsApp conversations |
| WhatsApp Chat Monitoring | ❌ Missing | No manager visibility into agent WhatsApp conversations |
| Automated WhatsApp Sequences | ⚠️ Partial | Sequence enrollments exist but no WhatsApp-specific sequence steps |
| Meta Conversions API | ✅ Implemented | Send conversion data back to Meta for ad optimization |
| Facebook Pixel & Google Tag Manager | ❌ Missing | Not integrated into embed forms |
| **Lead Management** | | |
| Activity Timeline | ✅ Implemented | Auto-logged for all channels (email, WhatsApp, SMS, calls, notes) |
| Client Notes & Groups | ✅ Implemented | Notes on leads + lead groups |
| Custom Client Fields | ✅ Implemented | Custom fields with dropdown options |
| Custom Dropdown Options | ✅ Implemented | Supported in custom fields |
| Timeline Attachments | ❌ Missing | Cannot attach files to activity timeline entries |
| Activity Geolocation | ❌ Missing | No GPS location logging on activities |
| Lead Stages/Pipeline | ✅ Implemented | Customizable stages (New, Contacted, Interested, Negotiating, Won, Lost) |
| Lead Tags | ✅ Implemented | Create and assign tags with colors |
| Lead Scoring | ✅ Implemented | Auto-calculated based on activity, engagement, recency |
| Lead Search & Filters | ✅ Implemented | Search by name/phone/email/city, filter by stage/source/agent/tag/budget/date |
| **Team Features** | | |
| Team Dashboard & Analytics | ✅ Implemented | Agent performance, team activity feed, conversion analytics |
| Team Member Invitations | ✅ Implemented | Email invitations with role assignment |
| Role-Based Permissions | ✅ Implemented | Super Admin, Admin, Sales Manager, Sales Agent |
| Subteam Hierarchy | ❌ Missing | No nested sub-team structure |
| Lead Transfer Between Agents | ✅ Implemented | Bulk transfer with assignment |
| Territory Management | ✅ Implemented | Assign territories to agents |
| Assignment Rules | ✅ Implemented | Custom rules + round-robin distribution |
| Custom Branding of App | ❌ Missing | No white-label/branding customization |
| **Other** | | |
| Multi-Language Support | ⚠️ Partial | English base, Urdu/ Arabic config ready but no translations |
| Mobile App (iOS + Android) | ✅ Implemented | React Native app with 5 tabs |
| Web Dashboard | ✅ Implemented | Full React dashboard with all features |
| Real-Time Updates | ✅ Implemented | Socket.io for live notifications |
| Offline Mode | ❌ Missing | Mobile app requires internet connection |

### Features in CRM Final That Privyr Does NOT Have

| Feature | Description |
|---------|-------------|
| **Visual Email Flow Builder** | Drag-and-drop email automation builder with IF/ELSE conditions (React Flow) |
| **Email Triggers** | Event-based email triggers (lead created, stage changed, etc.) |
| **A/B Testing for Campaigns** | Split test email templates with variant B and winner declaration |
| **AI Subject Line Generation** | OpenAI GPT-4o powered subject line suggestions |
| **Re-engagement Engine** | Automatic detection of cold leads (no email open in 30 days) and re-engagement campaigns |
| **Stripe Billing & Subscriptions** | Full SaaS billing with checkout, customer portal, and webhook handling |
| **Super Admin Panel** | Multi-tenant super admin stats across all workspaces |
| **Email Open/Click Tracking** | Tracking pixel + SendGrid webhook integration for detailed email analytics |
| **Comprehensive Analytics Suite** | Lead analytics, conversion analytics, pipeline analytics, agent performance — beyond Privyr's basic dashboard |
| **Custom Webhook System** | Create custom webhook endpoints with field mapping for any lead source |

### Summary

- **Total Privyr features checked**: 35+
- **Fully implemented**: 22
- **Partially implemented**: 6
- **Missing from CRM Final**: 9
- **Features CRM Final has that Privyr doesn't**: 10

### Missing Features — Priority for Implementation

1. **WhatsApp Auto-Responder** — Auto-reply to new leads on WhatsApp 24/7 (high value, medium effort)
2. **WhatsApp Chat Monitoring** — Manager visibility into agent WhatsApp conversations (high value, high effort)
3. **WhatsApp Contact Import** — Auto-create leads from new WhatsApp conversations (medium value, medium effort)
4. **Activity Geolocation** — Log GPS when interacting with leads (low value, low effort)
5. **Timeline Attachments** — Attach files to activity timeline (low value, low effort)
6. **Auto-Merge Duplicate Leads** — Auto-merge instead of just warning (low value, low effort)
7. **AI Lead Parsing from Email** — Extract leads from email alerts (medium value, high effort)
8. **Phonebook Import** — Import contacts from phone (low value, low effort for mobile)
9. **Subteam Hierarchy** — Nested team structure (low value, medium effort)

## License

Proprietary. All rights reserved.
