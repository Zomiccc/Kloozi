# Flazyn - Development Status & Codebase Documentation

## UI Redesign, Templates & Interest Tracking — October 2026

**Design: "The Dispatch Desk".** Warm paper canvas, near-black ink, volt (#D6F24B) for live/active and ember
(#FF5A1F) for heat. Typography: Instrument Serif for headlines, Instrument Sans for UI, JetBrains Mono for every number.
The tokens live in `web/src/index.css` and `web/tailwind.config.js`, and the shared primitives in `components/ui.jsx`.
The dark "console" sidebar (`components/Layout.jsx`) always shows **Waiting on you**: the count of uncontacted leads and
the oldest wait time. Lead rows carry a live heat stripe and wait timer (`leadHeat`, `HeatDot`).

**Templates** (`/app/templates`, `templates` table, `controllers/templateController.js`): the library has built-in
forms (5 designs), emails (4), WhatsApp (8) and SMS (4) templates (`backend/src/templates/library.js`, upserted by
migration `016b`). Users can import .html, .txt or .flazyn.json files, export templates, duplicate them, write custom
HTML or text with live preview, and *Use* a template. Using one creates a builder email, a quick reply or a live form
page. Form pages render through `services/formRenderer.js`: values are escaped, every `<form>` is rewritten to post to
Flazyn, and pages are served under a CSP sandbox so custom HTML can't reach the app origin.
The email builder now has a raw **HTML** block.

**Interest** (`services/interestService.js`, `controllers/trackingController.js`, `/app/engagement`, lead → Interest tab):
- **Website tracking:** a script at `/api/track/t.js?k=<tracking_key>` sends text/plain beacons to `/api/track/hit`.
  Visitors are identified by a signed `?fz=` link token, by a form submit, or by the `fz_vid` value carried into Flazyn form pages.
- **Document tracking:** shared files open in a tracked pdf.js viewer that records seconds per page (`/api/track/doc/:id`).
- **Score:** each lead gets a transparent 0–100 score in which every point is a listed signal, decaying after 14 quiet days.
  `leads.score` now *is* this score, so lists, segments and flows use it.
- **AI brief:** summary, what they care about, next action and a suggested WhatsApp message via OpenAI
  (`OPENAI_MODEL`, default gpt-4o-mini). Without a key it falls back to a rule-based brief.
- **Live alerts:** one alert per session, sent to the assignee or, if none, to the managers.

**Fixes:** Dashboard crashed (hook order). Timestamps were read about 12h off (Postgres in LA time, Node in Karachi time):
the pool now forces UTC, and migration `016a` shifted DB-generated times once. Leads created with no agents available
went unassigned; they now go to the workspace owner. The Stripe webhook could never verify signatures (the body was
already parsed); it now uses the raw body.

**Setup checklist** (keys, webhooks, permissions): `docs/PLATFORM_APPROVALS.md` → Part 2.


## Flazyn Rename + Automation Engine — October 2026

**Rename:** the product is **Flazyn** (formerly Zomic / "CRM Final"). Code, UI, plugins, env values and the
database (`flazyn_mail_*` tables, indexes, constraints — migration `011b_rename_legacy_brand_objects`) no longer
use the old names. Unchangeable external IDs kept on purpose: Firebase project `zomic-crm`, S3 bucket
`zomic-files`. Postgres database name `crm_final` is unchanged. Webhook verify tokens are now `flazyn_*`, so update them in Meta.

**Lead pipeline** (`backend/src/services/leadPipeline.js`): every lead source (manual, CSV, phonebook,
Facebook/TikTok/LinkedIn, embed forms, lead-form pages, Zapier/WordPress/Google Forms tokens, inbound
WhatsApp, email parsing) goes through `createLead()`. New leads then run, in order:
automation rules → lead distribution (round-robin / broadcast to team members, email, WhatsApp) →
fallback assignment (territory → assignment strategy → creator) → assignee notification → outgoing webhooks.
Lead edits, bulk actions and flow stage changes call `onLeadUpdated()` (stage_changed / deal_won / deal_lost /
lead_updated webhooks, reassignment alerts).

**Chat assistant** (`backend/src/services/chatAssistant.js`) runs on every inbound WhatsApp message
(keywords / new number / no reply in 5 min). **Inbound WhatsApp** resolves the correct workspace, accepts
both Meta Cloud API and Twilio payloads, de-duplicates retries, stores the sender phone, and applies the
auto-responder settings from the WhatsApp page (all / new contacts / outside hours, delay, 60-min cooldown).

**Schema alignment:** migration `015_align_automation_schema` adds the columns the automation code had
always expected (webhooks, chat assistant, auto-responder, sequences, branding, embed forms) and repairs
`leads.tags` to always be a JSONB array.

**Connectors hardened:** OAuth `state` is a signed 20-minute token (`GET /api/integrations/oauth/state`).
Facebook now requests `leads_retrieval` and the related lead-ads permissions, uses Graph `FACEBOOK_GRAPH_VERSION` (v25.0),
exchanges for long-lived tokens, and verifies `X-Hub-Signature-256`. LinkedIn uses Lead Sync
(`r_marketing_leadgen_automation`), with HMAC challenge and signature verification. TikTok routes leads only to the workspace
that authorised the advertiser; previously it sent each lead to every workspace. Disconnecting wipes stored tokens.

**Privacy / compliance:** public `/privacy`, `/terms`, `/data-deletion` pages (configure via `VITE_LEGAL_*`),
Settings → Account → Delete account, and a purge job that permanently removes accounts 30 days after deletion.
Notifications are now always stored in-app and pushed live over Socket.io, not only to phones.

**Platform approvals:** step-by-step guide in `docs/PLATFORM_APPROVALS.md`.

**Verified:** 31-check end-to-end API suite (rules, distribution, webhooks, duplicates, bulk, token webhook,
Twilio inbound + chat assistant, notifications) plus 12 connector security checks, all passing. Frontend builds.
LinkedIn/TikTok lead fetching follows their current docs but can only be tested after API approval.


## Marketing Suite Rebuild (Klaviyo Model) — August 2026

The legacy email feature (templates / sequences / flows / campaigns pages) was
**removed** and replaced by a behavior-driven marketing suite:

- **Segments** — dynamic, condition-based lead audiences (`segments` table).
  Conditions compile to parameterized SQL against `leads`, `emails`,
  `lead_activities`. Evaluated fresh on every query — never a snapshot.
- **Flows** — visual node-graph automations (`flows`, `flow_enrollments`,
  `flow_action_log`). Triggers: lead created, stage entered, segment entered,
  tagged with, days inactive, source is, manual. Actions: send_email, wait,
  condition (branch yes/no), add_tag, change_stage, notify_agent, whatsapp,
  sms, exit. Engine ticks every 60 s via `startScheduledJobs()`
  (`backend/src/queues/index.js`) — triggers are polled and due enrollment
  steps execute through `backend/src/services/flowEngine.js`.
- **Campaigns** — one-off sends to a segment or hand-picked leads; send now or
  schedule (30 s scheduler). Multi-channel: email via the tracked SendGrid
  chokepoint, plus WhatsApp/SMS reusing existing services.
- **Email Builder** — drag-and-drop block editor producing responsive HTML;
  documents stored in `marketing_emails`; used by campaigns AND flow
  "Send Email" steps.
- **Tracking** — open/click pixels + SendGrid event webhook feed a per-email
  state machine (`handleEmailEvent`), which also powers segment conditions
  like "opened but didn't reply".
- **Analytics** — `/app/marketing/analytics`: per flow (entered / active /
  completed / exited + step-level counts from `flow_action_log`), per campaign
  (sent / opened / clicked), per segment sizes. Revenue attribution is NOT
  shown because deal value is not stored on leads — no fabricated numbers.

**End-to-end verification (real SendGrid account):** signup → create segment →
create builder email → create flow (segment trigger → send → wait 1 min →
condition opened? → tag) → live → real test lead created → scheduler enrolled
the lead and SendGrid accepted the message (202 + message id logged in
`emails`) → wait node scheduled next step correctly → open tracked via public
pixel URL → condition branched YES → tag applied → enrollment completed.

Legacy cleanup: migration `013_drop_legacy_email_feature` drops
email_templates/sequences/flows/triggers tables while KEEPING the per-send
`emails` log (lead timeline, engagement scoring and merge depend on it).


## Project Overview
Flazyn is a full-stack customer relationship management system with WhatsApp Business integration, Facebook Lead Ads integration, and Meta Conversions API support.

**Tech Stack:**
- **Backend**: Node.js, Express, PostgreSQL, Socket.io, Redis (optional)
- **Frontend**: React, Vite, TailwindCSS, Zustand (state management)
- **Integrations**: WhatsApp Cloud API, Facebook Graph API, Meta Conversions API, SendGrid, Twilio, Stripe, OpenAI

---

## Current Integration Status

### ✅ WhatsApp Business Cloud API
**Status**: Partially working — OTP sending configured, awaiting Meta test number registration

**What Works:**
- OTP sending endpoint (`POST /api/whatsapp/send-otp`)
- OTP verification endpoint (`POST /api/whatsapp/verify-otp`)
- Webhook verification with proper `hub.mode=subscribe` check
- Message sending via WhatsApp Cloud API
- Auto-responder settings (stored in workspace settings)
- Chat monitoring and conversation history

**What Needs Configuration:**
1. Add test phone number in Meta Developer Console → WhatsApp → API Setup → "To" field
2. Update `backend/.env` with correct credentials:
   ```
   WHATSAPP_API_URL=https://graph.facebook.com/v25.0
   WHATSAPP_PHONE_NUMBER_ID=1145886271951817
   WHATSAPP_BUSINESS_ACCOUNT_ID=4313679592232288
   WHATSAPP_ACCESS_TOKEN=<token from Meta console>
   WHATSAPP_VERIFY_TOKEN=flazyn_wa_verify_2026
   ```
3. Configure webhook (for receiving messages):
   - Callback URL: `https://<your-domain>/api/whatsapp/webhook`
   - Verify Token: `flazyn_wa_verify_2026`
   - Subscribe to field: `messages`

**Known Issue:**
- Meta's test number registration server sometimes returns "WA Registration temporarily unavailable" — this is a Meta-side issue, retry after 5 minutes

**Recent Fixes:**
- Removed dangerous dev simulation fallback that hid real API errors
- Fixed webhook verification to check `hub.mode=subscribe`
- Fixed env var name mismatch (`WHATSAPP_BUSINESS_ACCOUNT_ID` vs `WHATSAPP_BUSINESS_ID`)
- Fixed JSON.parse crashes on workspace settings (handles both string and jsonb)
- Fixed duplicate phone number check query for jsonb columns

---

### ✅ Facebook Lead Ads
**Status**: OAuth flow configured, webhook configured

**What Works:**
- OAuth callback endpoint (`GET /api/integrations/oauth/facebook/callback`)
- Webhook verification (`GET /api/integrations/webhook/facebook`)
- Webhook lead ingestion (`POST /api/integrations/webhook/facebook`)
- Frontend OAuth config fetch (`GET /api/integrations/oauth/config`)
- Duplicate lead handling respecting workspace settings

**What Needs Configuration:**
1. Update `backend/.env`:
   ```
   FACEBOOK_APP_ID=<your app ID>
   FACEBOOK_APP_SECRET=<your app secret>
   FACEBOOK_VERIFY_TOKEN=flazyn_verify_2026
   ```
2. Configure OAuth redirect URI in Meta Console:
   - Add: `https://<your-domain>/api/integrations/oauth/facebook/callback`
3. Configure webhook for leadgen:
   - Callback URL: `https://<your-domain>/api/integrations/webhook/facebook`
   - Verify Token: `flazyn_verify_2026`
   - Subscribe to field: `leadgen`

**Recent Fixes:**
- Added backend endpoint to provide Facebook app ID to frontend (no need for separate frontend `.env`)
- Added detailed error logging for OAuth failures
- Fixed signup response to include `workspaceId` for OAuth state parameter

---

### ✅ Meta Conversions API
**Status**: Fully implemented, ready for configuration

**What Works:**
- Server-side event sending to Meta Conversions API
- Configuration endpoints for pixel ID and access token
- Automatic `QualifiedLead` event when lead is qualified
- Settings page integration
- Automation page integration

**What Needs Configuration:**
1. Go to Meta Events Manager → Get Pixel ID
2. Generate Conversions API access token
3. Configure in CRM → Settings → Meta Conversions API:
   - Enter Pixel ID
   - Enter Access Token
   - Enable tracking

**Code Location:**
- Backend: `backend/src/controllers/automationController.js:281-311`
- Frontend: `web/src/pages/Settings.jsx` (meta_capi tab)
- Frontend: `web/src/pages/integrations/MetaCAPIIntegration.jsx`

---

## Recent Bug Fixes

### 1. WhatsApp Dev Simulation Removed
**File**: `backend/src/services/whatsappService.js`
**Issue**: Dev mode simulated success even when API failed, hiding real errors
**Fix**: Removed simulation, now returns actual API errors

### 2. WhatsApp Webhook Verification
**File**: `backend/src/controllers/whatsappController.js:85-99`
**Issue**: Only checked `hub.verify_token`, not `hub.mode`
**Fix**: Now properly checks `mode === 'subscribe' && token === verifyToken`

### 3. Env Var Name Mismatch
**File**: `backend/src/config/index.js:107`
**Issue**: `.env` has `WHATSAPP_BUSINESS_ACCOUNT_ID` but code read `WHATSAPP_BUSINESS_ID`
**Fix**: Now reads both, prioritizing `WHATSAPP_BUSINESS_ACCOUNT_ID`

### 4. JSON.parse Crashes
**Files**: `backend/src/controllers/whatsappController.js` (multiple locations)
**Issue**: Would crash if DB returns jsonb object instead of string
**Fix**: Added check: `typeof rawSettings === 'string' ? JSON.parse(rawSettings) : (rawSettings || {})`

### 5. Duplicate Phone Check Query
**File**: `backend/src/controllers/whatsappController.js:382`
**Issue**: Used `LIKE` on jsonb column which doesn't work
**Fix**: Changed to `settings->>'whatsapp_number' = $1` for jsonb

### 6. Signup Missing workspaceId
**File**: `backend/src/controllers/authController.js:101`
**Issue**: Facebook OAuth state was empty for new signups
**Fix**: Added `workspaceId: result.workspace_id` to signup response

### 7. 401 Refresh on All Endpoints
**File**: `web/src/lib/api.js`
**Issue**: Token refresh only triggered on specific endpoints
**Fix**: Now triggers on any 401 response

### 8. React Duplicate Keys
**File**: `web/src/components/Layout.jsx`
**Issue**: Duplicate key `/app/email-templates` in navigation
**Fix**: Removed duplicate entry

### 9. Lead Source Chart Colors
**File**: `backend/src/controllers/analyticsController.js`
**Issue**: Random colors on chart refresh
**Fix**: Deterministic color mapping with expanded palette

### 10. AI Insight Backend
**File**: `backend/src/controllers/analyticsController.js`
**Issue**: No AI insight endpoint
**Fix**: Added `GET /api/analytics/ai-insight` with OpenAI integration

### 11. Duplicate Lead Handling
**Files**: `backend/src/services/oauthService.js`, `backend/src/controllers/integrationController.js`
**Issue**: No duplicate lead handling for webhook leads
**Fix**: Added `checkDuplicateLead` helper and integrated into webhook handlers

---

## Environment Variables Required

### Backend (`backend/.env`)
```bash
# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=crm_final
DB_USER=postgres
DB_PASSWORD=your_password

# JWT
JWT_SECRET=your_jwt_secret
JWT_REFRESH_SECRET=your_refresh_secret

# WhatsApp
WHATSAPP_API_URL=https://graph.facebook.com/v25.0
WHATSAPP_PHONE_NUMBER_ID=1145886271951817
WHATSAPP_BUSINESS_ACCOUNT_ID=4313679592232288
WHATSAPP_ACCESS_TOKEN=your_whatsapp_token
WHATSAPP_VERIFY_TOKEN=flazyn_wa_verify_2026

# Facebook
FACEBOOK_APP_ID=your_facebook_app_id
FACEBOOK_APP_SECRET=your_facebook_app_secret
FACEBOOK_VERIFY_TOKEN=flazyn_verify_2026

# OpenAI
OPENAI_API_KEY=your_openai_key

# SendGrid
SENDGRID_API_KEY=your_sendgrid_key
SENDGRID_FROM_EMAIL=noreply@yourdomain.com
SENDGRID_FROM_NAME=Flazyn

# Firebase
FIREBASE_PROJECT_ID=your_project_id
FIREBASE_CLIENT_EMAIL=your_client_email
FIREBASE_PRIVATE_KEY=your_private_key_with_newlines

# Stripe
STRIPE_SECRET_KEY=your_stripe_secret
STRIPE_WEBHOOK_SECRET=your_webhook_secret

# AWS (for file uploads)
AWS_ACCESS_KEY_ID=your_aws_key
AWS_SECRET_ACCESS_KEY=your_aws_secret
AWS_REGION=us-east-1
AWS_S3_BUCKET=your_bucket
```

### Frontend (`web/.env`) - Optional
The frontend now fetches OAuth config from backend, so this is optional:
```bash
VITE_FB_APP_ID=your_facebook_app_id
VITE_API_URL=http://localhost:5000
```

---

## Running Locally

### Prerequisites
- Node.js 18+
- PostgreSQL 14+
- Redis (optional, for cache and job queue)

### Setup
```bash
# Install dependencies
npm install
cd backend && npm install
cd ../web && npm install

# Run migrations
cd backend
npm run migrate

# Start backend (port 5000)
npm run dev

# Start frontend (port 3000)
cd ../web
npm run dev
```

### Database Setup
```bash
# Create PostgreSQL database
createdb crm_final

# Run migrations
cd backend
npm run migrate

# (Optional) Run seeders
npm run seed
```

---

## Deployment Notes

### Production Static Serving
The backend now serves the frontend build in production mode:
- Build frontend: `cd web && npm run build`
- Backend serves `web/dist` when `NODE_ENV=production`
- Single server deployment possible

### Webhooks for Production
Meta webhooks require a publicly accessible URL:
1. Use ngrok for local testing: `ngrok http 5000`
2. Use the ngrok URL as webhook callback in Meta console
3. For production, use your actual domain with HTTPS

### Railway Deployment (Recommended)
1. Push code to GitHub
2. Create Railway project
3. Add services:
   - PostgreSQL
   - Redis (optional)
   - Backend (Node.js)
   - Frontend (Vite)
4. Configure environment variables
5. Railway handles webhooks automatically

---

## Known Issues

1. **WhatsApp Test Number Registration**: Meta's test number registration server sometimes returns "WA Registration temporarily unavailable" — this is a Meta-side issue, retry after 5 minutes

2. **Redis Not Required**: The app works without Redis (uses in-memory fallback), but Redis is recommended for production for cache and job queue

3. **AWS SDK v2 Deprecation**: The app uses AWS SDK v2 which is deprecated. Should migrate to v3 when possible

4. **PostgreSQL vs SQLite**: The app uses PostgreSQL. SQLite is not supported

---

## Key Files Reference

### Backend Structure
```
backend/src/
├── config/          # Environment config, database connection
├── controllers/     # Route handlers (auth, leads, whatsapp, etc.)
├── middleware/      # Auth, CORS, error handling, rate limiting
├── migrations/      # Database migrations
├── routes/          # Express route definitions
├── services/        # Business logic (whatsappService, oauthService, etc.)
├── utils/           # Helpers (logger, i18n, notifications)
├── workers/         # Background job processors
└── server.js        # Express app entry point
```

### Frontend Structure
```
web/src/
├── components/      # Reusable components (BrandLogo, Layout)
├── lib/            # API client (axios with interceptors)
├── pages/          # Page components (Dashboard, Settings, Integrations)
├── stores/         # Zustand state management (authStore)
├── App.jsx         # Main app with routing
└── main.jsx        # React entry point
```

### Important Integration Files
- **WhatsApp**: `backend/src/services/whatsappService.js`, `backend/src/controllers/whatsappController.js`
- **Facebook**: `backend/src/services/oauthService.js`, `web/src/pages/integrations/FacebookIntegration.jsx`
- **Meta CAPI**: `backend/src/controllers/automationController.js`, `web/src/pages/integrations/MetaCAPIIntegration.jsx`

---

## Testing Checklist

### WhatsApp
- [ ] Test OTP sending with registered test number
- [ ] Test OTP verification
- [ ] Test webhook verification (use ngrok)
- [ ] Test message sending to leads
- [ ] Test auto-responder settings

### Facebook
- [ ] Test OAuth flow
- [ ] Test page connection
- [ ] Test webhook verification (use ngrok)
- [ ] Test lead ingestion from webhook

### Meta Conversions API
- [ ] Configure Pixel ID and token
- [ ] Test event sending when lead is qualified
- [ ] Verify events appear in Meta Events Manager

---

## Next Steps for Full Production Readiness

1. **WhatsApp**:
   - Wait for Meta test number registration to work
   - Configure webhook with ngrok or production domain
   - Test end-to-end OTP flow

2. **Facebook**:
   - Configure OAuth redirect URI in Meta Console
   - Configure webhook for leadgen
   - Test OAuth flow and lead ingestion

3. **Meta Conversions API**:
   - Get Pixel ID from Meta Events Manager
   - Generate Conversions API token
   - Configure in CRM Settings
   - Test event sending

4. **Deployment**:
   - Choose platform (Railway, Render, VPS)
   - Set up PostgreSQL and Redis
   - Configure environment variables
   - Deploy backend and frontend
   - Configure production webhooks with real domain

---

## Support & Debugging

### Backend Logs
The backend uses winston for logging. For detailed error output, check:
- Console output (errors are also logged via `console.error` for visibility)
- `logs/error.log` (in production)
- `logs/combined.log` (in production)

### Common Issues

**"WhatsApp not configured"**: Check `WHATSAPP_PHONE_NUMBER_ID` and `WHATSAPP_ACCESS_TOKEN` in `.env`

**"Account not registered (code 133010)"**: Add your phone number as a test recipient in Meta Console

**"WA Registration temporarily unavailable"**: Meta server issue, retry after 5 minutes

**"Facebook authentication failed"**: Check `FACEBOOK_APP_ID` and OAuth redirect URI configuration

**"Webhook verification failed"**: Ensure verify token matches between Meta Console and `.env`

**"Database connection failed"**: Check PostgreSQL is running and credentials in `.env` are correct

---

## Database Migration (Completed July 27, 2026)

### ✅ Real PostgreSQL Migration Complete
- **Database driver rewritten**: `backend/src/config/database.js` now uses `pg` (node-postgres) instead of JSON file simulation
- **52 tables created** in `crm_final` PostgreSQL database on localhost:5432
- **pgcrypto extension enabled** for UUID generation
- **Migration runner rewritten**: `backend/src/migrations/run.js` now produces PostgreSQL-compatible SQL schemas with:
  - UUID primary keys with `gen_random_uuid()`
  - TIMESTAMP instead of SQLite datetime strings
  - JSONB for all JSON columns (settings, metadata, config, etc.)
  - BOOLEAN for boolean flags (is_*, two_factor_*)
  - NUMERIC for monetary/real values
  - Proper PostgreSQL indexing
  - Foreign key constraints with CASCADE deletes
- **Old JSON file** (`crm_final.json`) preserved but no longer used

### ✅ Webhook Setup Complete
- **Webhook setup script**: `webhook-setup.js` created — tests all webhook endpoints
- **WhatsApp webhook verification**: ✅ PASSED (returns challenge for valid token, 403 for invalid)
- **Facebook webhook verification**: ✅ PASSED (returns challenge for valid token, 403 for invalid)
- **WhatsApp webhook POST**: ✅ PASSED (incoming message accepted with 200)
- **Facebook webhook POST**: ✅ PASSED (leadgen event accepted with 200)
- All webhooks work on both `localhost:5000` and through public tunnel

**To expose via public URL:**
```bash
# Option 1: ngrok (need free account + auth token)
ngrok config add-authtoken YOUR_TOKEN
ngrok http 5000

# Option 2: localtunnel (no account needed) — RUNNING at:
# https://lovely-memes-mix.loca.lt
```

### Backend Server Status
- **Running**: port 5000
- **Environment**: development
- **Database**: PostgreSQL (real, `crm_final` database)
- **Redis**: Not available (using in-memory fallback)

---

**Last Updated**: July 27, 2026
**Workspace Location**: `c:\Users\lenovo\Desktop\crm`
