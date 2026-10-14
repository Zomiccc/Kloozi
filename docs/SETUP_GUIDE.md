# Flazyn — Free Setup & Approvals Guide (step by step, with links)

**Situation:** `flazyn.com` is live on Vercel, DNS is at Hostinger, Flazyn is a registered business name of **HB&YM PTY LTD** (ABN 27 688 842 140, ACT), and you're testing on $0.
Everything below is **free** unless it's marked 💲. When something costs money, it's listed under "Buy later".

**Order matters.** Do Phases 1–3 first; after that Meta, LinkedIn and TikTok can run in parallel.

| Phase | What | Time | Cost |
|---|---|---|---|
| 1 | Business email on @flazyn.com | 30 min | Free |
| 2 | Put the CRM online at `app.flazyn.com` | 1 hour | Free |
| 3 | ABN | ✅ Done | — |
| 4 | Meta: Business portfolio + verification | 30 min (+ 2–10 days) | Free |
| 5 | Facebook & Instagram Lead Ads (test now, review later) | 2 hours (+ 1–3 weeks review) | Free |
| 6 | WhatsApp (free test number now, real number later) | 1 hour | Free to test |
| 7 | LinkedIn Lead Sync | 1 hour (+ a few days) | Free |
| 8 | TikTok Lead Generation | 1 hour (+ 2–3 days) | Free |
| 9 | Email sending, SMS, Google sign-in, payments, tracking | 1 hour | Free tiers |

---

## Phase 1 — Free business email (Zoho Mail free plan)

Zoho's **Forever Free** plan gives up to 5 mailboxes on your own domain, enough for testing and for every approval form.

1. Open **Zoho Mail pricing** → scroll to **"Forever Free Plan"** → **Sign up**: <https://www.zoho.com/mail/zohomail-pricing.html>
2. Choose **"Sign up with a domain I already own"** → enter `flazyn.com` → create your admin mailbox, e.g. `hassan@flazyn.com`.
3. Zoho shows a **TXT verification record**. Add it in Hostinger:
   - Hostinger panel: <https://hpanel.hostinger.com/> → **Domains** → **flazyn.com** → **DNS / Nameservers** → **Manage DNS records**
   - Type **TXT**, Name **@**, Value = the `zoho-verification=…` text → **Add record** → back in Zoho click **Verify**.
4. Add the **MX records** Zoho's wizard shows, using the exact hosts Zoho gives you (Australian accounts often get `mx.zoho.com.au`, `mx2.zoho.com.au` and `mx3.zoho.com.au`, with priorities 10, 20 and 50).
5. Add **one SPF record** (TXT, Name `@`). Use the include Zoho shows, plus SendGrid for Flazyn's outgoing mail:
   `v=spf1 include:zoho.com.au include:sendgrid.net ~all`
   (use `include:zoho.com` instead if Zoho's wizard says so — never create two SPF records).
6. **DKIM:** Zoho Admin Console → **Domains** → flazyn.com → **Email Configuration → DKIM** → **Add** selector → copy the TXT record into Hostinger → **Verify**. Guide: <https://www.zoho.com/mail/help/adminconsole/dkim-configuration.html>
7. **DMARC** (TXT, Name `_dmarc`): `v=DMARC1; p=none; rua=mailto:hassan@flazyn.com`
8. Create these as free **aliases** on your mailbox or as **groups**: `hello@`, `privacy@`, `no-reply@`.
   Aliases: <https://www.zoho.com/mail/help/adminconsole/email-alias.html>

✅ **Do not touch** the existing **A / CNAME** records — those keep the website on Vercel running.

**Check everything worked:** <https://mxtoolbox.com/SuperTool.aspx?action=mx%3aflazyn.com> (MX) and <https://mxtoolbox.com/spf.aspx> (SPF).

💲 Later, if you want Gmail-style mail: Google Workspace (<https://workspace.google.com/>, about A$10+/user/month). Switching just means replacing the MX/SPF/DKIM records.

---

## Phase 2 — Put the CRM online for free at `app.flazyn.com`

Every platform needs a **public HTTPS** address for webhooks and for reviewers, and localhost won't work. Free option:

| Piece | Free service | Link |
|---|---|---|
| Database (Postgres) | **Neon** free tier | <https://neon.tech> |
| Backend + web app | **Render** free web service | <https://render.com> |

1. **Neon:** sign up → **New project** → region **Asia Pacific (Sydney)** → copy the connection details (host, database, user, password).
2. **GitHub:** push this project to a **private** repo (Render deploys from GitHub). <https://github.com/new>
3. **Render:** <https://dashboard.render.com/> → **New → Web Service** → connect the repo → set:
   - **Build command:** `cd backend && npm install && cd ../web && npm install --include=dev && npm run build`
   - **Start command:** `cd backend && npm run migrate && npm start`
   - **Instance type:** Free
   - **Environment variables:** copy everything from `backend/.env`, then change:
     `NODE_ENV=production`, `API_URL=https://app.flazyn.com`, `WEB_URL=https://app.flazyn.com`, `CLIENT_URL=https://app.flazyn.com`,
     `DB_HOST/DB_NAME/DB_USER/DB_PASSWORD` = Neon values, `DB_SSL=true`
   - Also add the `VITE_LEGAL_*` values from `web/.env.example` (company name, `privacy@flazyn.com`, state, address).
4. **Custom domain:** Render service → **Settings → Custom Domains** → add `app.flazyn.com` → Render shows a **CNAME** target.
   In Hostinger add: Type **CNAME**, Name **app**, Target = the Render value. HTTPS is issued automatically (free).
   Docs: <https://render.com/docs/custom-domains>
5. Open `https://app.flazyn.com/privacy`, `/terms` and `/data-deletion` — these are the URLs every platform asks for.

⚠️ **Free-tier limits.** Render's free service **sleeps after ~15 minutes** without traffic, and the first request then takes ~30–60 s. That's fine for testing and for reviews (open the app before you submit), but while it sleeps scheduled automations pause.
💲 **Buy later:** Render Starter (about US$7/month, always on) **before real clients use it**.

**Even quicker for testing webhooks today:** `node start-ngrok.js` exposes your PC on a free ngrok URL (<https://dashboard.ngrok.com/get-started/your-authtoken> for a free auth token and one free static domain). Fine for quick tests, but it only works while your PC is on, so don't use it for reviews.

---

## Phase 3 — ABN ✅ already done

The ASIC record shows the business name **FLAZYN** is held by **HB&YM PTY LTD**:

| Field | Value |
|---|---|
| **Legal entity (use this on every form)** | **HB&YM PTY LTD** |
| Trading / business name | **Flazyn** |
| ABN | **27 688 842 140** (active since 14 Jul 2025, GST registered) — <https://abr.business.gov.au/ABN/View?abn=27688842140> |
| ACN | 688 842 140 |
| Address | 87 Eccles Cct, Macgregor ACT 2615 |

To-do:
1. **Website footer on flazyn.com:** "© 2026 HB&YM Pty Ltd trading as Flazyn · ABN 27 688 842 140 · 87 Eccles Cct, Macgregor ACT 2615". Meta compares the website against the documents.
2. Optional: link the business name to the ABN record so "Flazyn" shows on ABN Lookup. ASIC usually syncs this automatically within a few days; if not, update the ABN details at <https://www.abr.gov.au/business-super-funds-charities/updating-your-abn-details>.
3. Keep the ASIC **Record of Registration for Business Name** PDF — it is proof that "Flazyn" belongs to HB&YM PTY LTD.

---

## Phase 4 — Meta Business portfolio + Business Verification (unlocks Facebook leads **and** WhatsApp)

1. Open **Meta Business Settings**: <https://business.facebook.com/settings>
   (If you're asked to create a business portfolio, use the **exact ASIC legal name**.)
2. **Business info:** legal name **HB&YM PTY LTD**, address **87 Eccles Cct, Macgregor ACT 2615**, website `https://flazyn.com`, business email on @flazyn.com — all **exactly** as on the ASIC record.
3. **Security Center → Start verification:** <https://business.facebook.com/settings/security>
   Help: <https://www.facebook.com/business/help/2058515294227817>
   Upload:
   - Enter the **ABN 27 688 842 140** — Meta can often match it automatically against the public ABN register
   - Upload the **ASIC Record of Registration for Business Name** (shows FLAZYN → HB&YM PTY LTD) and, if asked for more, the company's ASIC registration extract
   - If asked for proof of address: a **utility bill or bank statement** addressed to **HB&YM PTY LTD** at 87 Eccles Cct
   - Verify by **email on @flazyn.com** (from Phase 1) — the fastest method.
4. Wait **2–10 business days**. Rejections are almost always name or address mismatches between the form, the documents and the website footer.
5. Rename the old assets while you wait: Pixel "ZomicWebPixel" → Events Manager <https://business.facebook.com/events_manager2> → rename; the Page "Zomic Test" → rename to "Flazyn Test".

---

## Phase 5 — Facebook & Instagram Lead Ads

### 5a. Configure the app (free)
App dashboard: <https://developers.facebook.com/apps> → your app (ID `1755522109047165` — the new Flazyn app; the old Zomic app is retired).

1. **App settings → Basic:**
   - Display name: `Flazyn` · App icon 1024×1024 · Category: *Business and pages*
   - Privacy policy URL: `https://app.flazyn.com/privacy`
   - Terms of service URL: `https://app.flazyn.com/terms`
   - User data deletion → *Data deletion instructions URL*: `https://app.flazyn.com/data-deletion`
   - App domains: `flazyn.com` · Contact email: `hello@flazyn.com` → **Save**
2. Link the app to your **business portfolio** (App settings → Basic → *Business portfolio*, or Business Settings → Accounts → Apps → Add).
3. **Add the product "Facebook Login for Business"** → Settings → *Valid OAuth Redirect URIs*:
   `https://app.flazyn.com/api/integrations/oauth/facebook/callback`
4. **Add the product "Webhooks"** → choose object **Page** → *Subscribe to this object*:
   - Callback URL: `https://app.flazyn.com/api/integrations/webhook/facebook`
   - Verify token: the value of `FACEBOOK_VERIFY_TOKEN` in your env (currently `flazyn_verify_2026`)
   - Then subscribe to the **`leadgen`** field.
   Docs: <https://developers.facebook.com/docs/graph-api/webhooks/getting-started/webhooks-for-leadgen/>

### 5b. Test it now — no approval needed (Development mode)
While the app is in **Development** mode, people **with a role on the app** can already use every permission with Pages they manage.

1. Add teammates under **App roles → Roles** (Admin / Developer / Tester).
2. In Flazyn (`app.flazyn.com`): **Automations → Facebook → Connect** → approve every permission → choose the Flazyn Test page.
3. Make sure the app has lead access: Business Settings → **Integrations → Leads Access** → allow the Flazyn app on the page. Help: <https://www.facebook.com/business/help/540596413257598>
4. Create a test lead with the **Lead Ads Testing Tool**: <https://developers.facebook.com/tools/lead-ads-testing> → choose the page and a form (create a simple Instant Form in Ads Manager if you have none — it's free, you don't have to run an ad) → **Create lead**.
5. The lead should appear in **Leads** within seconds. If it doesn't, check the app's **Webhooks** page for delivery errors.

### 5c. Submit App Review (after Phase 4 verification is approved)
1. App dashboard → **App Review → Permissions and features** → request **Advanced Access** for:
   `leads_retrieval`, `pages_show_list`, `pages_read_engagement`, `pages_manage_metadata`, `pages_manage_ads`, `ads_management`
   Docs: <https://developers.facebook.com/docs/app-review>
2. For each permission, paste a use-case description. Ready-made text for `leads_retrieval`:
   > Flazyn is a CRM for sales teams. When a business connects its Facebook Page, Flazyn subscribes the Page to the leadgen webhook and uses leads_retrieval to fetch each new lead's form answers (name, phone, email and the advertiser's custom questions). The lead appears instantly in that business's pipeline, is assigned to a salesperson, and the salesperson follows up by phone or WhatsApp. Data is visible only to the business that owns the Page, is never sold or shared, and can be deleted at any time (see app.flazyn.com/data-deletion).
3. **Screen recording:** use the free **OBS Studio** (<https://obsproject.com/>) or the Windows Snipping Tool's recorder. Show:
   1. logging in to Flazyn
   2. **Connect** and the Facebook dialog **listing every permission**
   3. choosing the page
   4. creating a test lead with the testing tool
   5. the lead appearing in Flazyn and opening it
   6. **Disconnect** and the `/data-deletion` page
4. Give the reviewers a **test login** for Flazyn, plus Notes on how to reach the Facebook page.
5. Answer **Data handling** (processors: AWS, Twilio, SendGrid, Firebase, OpenAI, Stripe; no data sold).
6. Switch the app to **Live** (top bar) → **Submit**. Expect **1–3 weeks**.

---

## Phase 6 — WhatsApp

### 6a. Test for free right now with Meta's test number
Meta gives every app a **free test phone number** that can message up to **5 verified recipient numbers**.
Getting started: <https://developers.facebook.com/docs/whatsapp/cloud-api/get-started>

1. App dashboard → **Add product → WhatsApp** → **API Setup**.
2. You'll see a **test number** and a **temporary access token** (valid 24 h). Under **To**, add and verify your own mobile number.
3. **Configuration → Webhook:**
   - Callback URL: `https://app.flazyn.com/api/whatsapp/webhook`
   - Verify token: `WHATSAPP_VERIFY_TOKEN` (currently `flazyn_wa_verify_2026`) → **Verify and save** → subscribe to **messages**.
4. In Render env set: `WHATSAPP_MODE=cloud`, `WHATSAPP_PHONE_NUMBER_ID=<test number's ID>`, `WHATSAPP_BUSINESS_ACCOUNT_ID=<WABA ID>`, `WHATSAPP_ACCESS_TOKEN=<token>`.
5. **Permanent token** (so it doesn't expire every 24 h): Business Settings → **Users → System users** → Add → assign the app + WhatsApp account → **Generate token** with `whatsapp_business_messaging` and `whatsapp_business_management`.
   Help: <https://developers.facebook.com/docs/whatsapp/business-management-api/get-started#system-user-access-tokens>
6. Send a message from your phone to the test number → it appears in Flazyn → the auto-responder and chat-assistant rules fire.

### 6b. Go live with your own number (after Phase 4 verification)
1. WhatsApp Manager: <https://business.facebook.com/wa/manage/home/> → **Phone numbers → Add phone number**. Use a number **not** currently on the WhatsApp app, or delete it from the app first.
2. Display name: your brand (must match the business / website). Approval takes ~1–2 days.
3. **Message templates** — needed for any message sent more than 24 h after the lead last messaged you: WhatsApp Manager → **Message templates**. Guidelines: <https://developers.facebook.com/docs/whatsapp/message-templates/guidelines>
4. 💲 Meta charges **per template message** (marketing / utility / authentication) by country. Replies inside the 24-hour window are free. Pricing: <https://developers.facebook.com/docs/whatsapp/pricing>

---

## Phase 7 — LinkedIn Lead Sync (free)

1. **Company Page** named Flazyn: <https://www.linkedin.com/company/setup/new/> (logo, website `https://flazyn.com`, industry *Software Development*). Make Hassan a **super admin**.
2. **Create a developer app:** <https://www.linkedin.com/developers/apps/new>
   - App name `Flazyn` (LinkedIn rules: no "Linked"/"In" in the name or logo) · LinkedIn Page: Flazyn · Privacy URL `https://app.flazyn.com/privacy` · logo.
3. **Settings tab → Verify:** generate the URL → the page super admin opens it and approves. Help: <https://www.linkedin.com/help/linkedin/answer/a548360>
4. **Auth tab → Authorized redirect URLs:** `https://app.flazyn.com/api/integrations/oauth/linkedin/callback`
5. **Products tab → Lead Sync API → Request access** → use your **@flazyn.com** email (personal emails are rejected), the legal name, address and website. Use case: **Lead Sync**.
   Requirements: <https://learn.microsoft.com/en-us/linkedin/marketing/lead-sync/getting-access-leadsync>
6. After approval: copy the Client ID and Secret into Render env (`LINKEDIN_CLIENT_ID`, `LINKEDIN_CLIENT_SECRET`).
7. **Free test lead:** Campaign Manager <https://www.linkedin.com/campaignmanager/> → create an ad account (no payment needed for a draft) → create a **Lead Gen Form** → **Preview → Send test lead**. Help: <https://www.linkedin.com/help/lms/answer/a425781>
8. In Flazyn: **Automations → LinkedIn → Connect**. Flazyn registers the webhook (`https://app.flazyn.com/api/integrations/webhook/linkedin`) automatically.

---

## Phase 8 — TikTok Lead Generation (free)

1. **TikTok for Business account** with your @flazyn.com email: <https://ads.tiktok.com/> → create a **Business Center** with the legal name: <https://business.tiktok.com/>
2. **Become a developer:** <https://business-api.tiktok.com/portal> → *Become a Developer* (company-domain email required). Docs: <https://business-api.tiktok.com/portal/docs/register-as-a-developer/v1.3>
3. **Create an app:** <https://business-api.tiktok.com/portal/docs/create-a-developer-app/v1.3>
   - Name `Flazyn` · Advertiser redirect URL: `https://app.flazyn.com/api/integrations/oauth/tiktok/callback`
   - Description: *"CRM that receives TikTok Lead Generation form submissions for our advertisers in real time, assigns them to sales agents and enables follow-up."*
   - Scope: tick the **Lead / Lead Management** permissions and **Ad Account Management**.
4. Review takes about **2–3 business days**. Then put the App ID and Secret in Render (`TIKTOK_APP_ID`, `TIKTOK_APP_SECRET`) and set the leads webhook to `https://app.flazyn.com/api/integrations/webhook/tiktok`.
5. Test: Flazyn → **Automations → TikTok → Connect**, then TikTok Ads Manager → **Tools → Instant Form** → preview / test submission. Help: <https://ads.tiktok.com/help/article/instant-form>

---

## Phase 9 — Everything else (free tiers)

| What | Free option | Steps |
|---|---|---|
| **Email sending** (campaigns, flows) | Your existing SendGrid key | <https://app.sendgrid.com/settings/sender_auth> → **Authenticate your domain** → flazyn.com → add the 3 CNAMEs in Hostinger → set `SENDGRID_FROM_EMAIL=no-reply@flazyn.com`. Opens/clicks: <https://app.sendgrid.com/settings/mail_settings> → **Event Webhook** → `https://app.flazyn.com/api/marketing/webhooks/sendgrid` (tick Delivered, Open, Click, Bounce) |
| **SMS** | Twilio **trial credit** (can buy one number from the credit; can only text numbers you verify) | <https://console.twilio.com/us1/develop/phone-numbers/manage/search> → buy a number → `TWILIO_PHONE_NUMBER`. Webhook: number → Messaging → `https://app.flazyn.com/api/sms/webhook` |
| **Google sign-in** | Free; keep it in *Testing* with up to 100 test users | <https://console.cloud.google.com/apis/credentials/consent> → app name Flazyn, privacy/terms URLs, authorised domain `flazyn.com`. Credentials: redirect URI `https://app.flazyn.com/api/auth/google/callback` |
| **Payments** | Stripe **test mode** | <https://dashboard.stripe.com/test/webhooks> → endpoint `https://app.flazyn.com/api/billing/webhook` → copy the signing secret to `STRIPE_WEBHOOK_SECRET` |
| **Push notifications** | Firebase Spark (free) | Already configured |
| **Website interest tracking** | Free (built in) | Flazyn → **Automations → Website & Document Tracking** → copy the script → paste it into flazyn.com before `</body>`. On Vercel: add it to your site's layout/template and redeploy |
| **AI briefs** | Your OpenAI key (pay-per-use, typically a few cents a day while testing) | To spend $0, remove `OPENAI_API_KEY` — Flazyn falls back to rule-based briefs. Set a hard monthly limit: <https://platform.openai.com/settings/organization/limits> |

---

## What to buy later — and when

| Item | When | Approx. cost |
|---|---|---|
| Render Starter (always-on server) | **Before real clients** — the free tier sleeps and pauses automations | ~US$7/month |
| WhatsApp template messages | When you message leads outside the 24 h window | Per message, varies by country |
| Twilio phone number + SMS | When SMS goes beyond testing | ~US$1–2/month per number + per SMS |
| SendGrid paid plan | When you send more than the free allowance | from ~US$20/month |
| Google Workspace (optional) | If you prefer Gmail over Zoho | ~A$10+/user/month |
| OpenAI usage | Ongoing, small | Pay as you go |

---

## Checklist

- [ ] Zoho free mail live; `hello@`, `privacy@`, `no-reply@` work; MX, SPF, DKIM, DMARC pass on MXToolbox
- [ ] CRM live at `https://app.flazyn.com`; `/privacy`, `/terms` and `/data-deletion` open
- [ ] ABN applied for → issued → added to the legal pages and the flazyn.com footer
- [ ] Meta business portfolio with the exact legal name → verification submitted → approved
- [ ] Facebook app settings filled; webhook verified; test lead arrives in Development mode
- [ ] App Review submitted (recording + test login) → approved → Live
- [ ] WhatsApp test number working → real number added → templates approved
- [ ] LinkedIn page → app verified → Lead Sync approved → test lead arrives
- [ ] TikTok developer → app approved → test lead arrives
- [ ] SendGrid domain authenticated + event webhook; tracking script on flazyn.com
