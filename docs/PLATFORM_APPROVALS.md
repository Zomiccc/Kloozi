# Flazyn — Platform Approvals, Step by Step

How to get Flazyn approved to pull leads from **Meta (Facebook/Instagram)**, **WhatsApp**, **LinkedIn** and **TikTok**, plus the rename chores for Google, SendGrid and Stripe.

Everything in the code is ready for these steps: the permission scopes, the webhook endpoints and signatures, the privacy/terms/data-deletion pages, and account and data deletion. What remains is paperwork in each platform's dashboard. Only you (or Hassan) can do this, because every platform ties it to a real person and a real business.

> **Order matters.** Steps 0–1 unblock everything else. After that, Meta, LinkedIn and TikTok can run **in parallel**.

---

## Step 0 — Things you need before any application

| # | Item | Why | Notes |
|---|------|-----|-------|
| 0.1 | **A public HTTPS domain** for Flazyn (e.g. `flazyn.com` or `app.flazyn.com`) | Every platform rejects `localhost` and ngrok/loca.lt links in reviews. | Deploy the backend + `web/dist` (Railway/Render/VPS). The backend serves the web build when `NODE_ENV=production`. |
| 0.2 | **Business email on that domain** (e.g. `admin@flazyn.com`, `privacy@flazyn.com`) | LinkedIn and TikTok reject personal Gmail addresses. Meta prefers a domain email. | Google Workspace, Zoho Mail (free tier) or your host's email. |
| 0.3 | **Business documents for Hassan's company** | Meta Business Verification. LinkedIn and TikTok ask for the legal name and address. | Australia: the **ASIC registration** (company extract / Certificate of Registration with ACN, or business-name registration) and the **ABN** once issued, plus a **utility bill or bank statement** showing the *same* legal name and address. The name must match **exactly** everywhere. |
| 0.4 | **A business phone number** that can receive a call or SMS | Meta verification and WhatsApp number registration | Must **not** already be registered on the WhatsApp app (or delete it from the app first). |

### Configure the deployed app

In `backend/.env` on the server:

```
NODE_ENV=production
API_URL=https://app.flazyn.com        # your real domain
WEB_URL=https://app.flazyn.com
CLIENT_URL=https://app.flazyn.com
FACEBOOK_GRAPH_VERSION=v25.0
```

In `web/.env` before running `npm run build`. These values appear on the public legal pages:

```
VITE_LEGAL_COMPANY=<Hassan's registered company name>
VITE_LEGAL_EMAIL=privacy@flazyn.com
VITE_LEGAL_ADDRESS=<registered business address>
VITE_LEGAL_COUNTRY=Australia
VITE_LEGAL_STATE=<state, e.g. New South Wales>
VITE_LEGAL_ABN=<ABN once issued>
```

Then confirm these three pages open publicly:
- `https://<domain>/privacy`
- `https://<domain>/terms`
- `https://<domain>/data-deletion`

> The policy text was written to match exactly what Flazyn does. Have a lawyer glance at it before going fully live. It is a sound starting point, not legal advice.

---

## Step 1 — Rename what already exists under "Zomic" (≈30 minutes)

Do **not** create new apps. IDs, secrets and tokens all stay the same.

1. **Facebook App** → [developers.facebook.com/apps](https://developers.facebook.com/apps) → your app (ID `1755522109047165` — the new Flazyn app; the old Zomic app is retired) → **App settings → Basic**
   - Display name: `Flazyn`
   - App icon: upload a 1024×1024 Flazyn logo
   - Privacy Policy URL: `https://<domain>/privacy`
   - Terms of Service URL: `https://<domain>/terms`
   - User data deletion: choose **"Data deletion instructions URL"** → `https://<domain>/data-deletion`
   - App domains: `<domain>`
   - Category: *Business and Pages*
   - Contact email: your domain email
   - **Save changes**
2. **Facebook Page** "Zomic Test" (ID `1206733362528393`) → Page settings → rename to `Flazyn Test`. Renaming keeps the webhook subscription. Meta may take a few days to approve a page name change.
3. **Business Manager** (ID `1375192794574098`) → [business.facebook.com/settings](https://business.facebook.com/settings) → **Business info** → change the business name to the **legal company name** on the documents. It doesn't have to say "Flazyn", but it must match the documents.
4. **Pixel** "ZomicWebPixel" → Events Manager → Data sources → the pixel → Settings → rename to `FlazynWebPixel`.
5. **Google Cloud** (OAuth client `396238503828-…`) → [console.cloud.google.com](https://console.cloud.google.com) → **APIs & Services → OAuth consent screen** → App name `Flazyn`, logo, support email, privacy and terms URLs, authorized domain. Add the production redirect `https://<domain>/api/auth/google/callback` under **Credentials**.
6. **Firebase** → Project settings → change the *display* name to Flazyn. The project ID `zomic-crm` **cannot** be changed and is invisible to users, so leave it.
7. **SendGrid** → Settings → Sender Authentication → authenticate your **domain** (DNS records) and create a sender `Flazyn <no-reply@flazyn.com>`. Update `SENDGRID_FROM_EMAIL` in `.env`. The code already uses `SENDGRID_FROM_NAME=Flazyn`.
8. **Stripe** (still in test mode) → Products → rename every product and plan to "Flazyn …". Settings → Public details / Branding → name `Flazyn`, logo, support email.
9. **AWS S3** bucket `zomic-files`: bucket names can't be renamed. Optional: create `flazyn-files`, copy the objects across, then update `AWS_S3_BUCKET`. Nobody sees bucket names, so this is cosmetic only.

---

## Step 2 — Meta Business Verification (unlocks Meta lead ads *and* WhatsApp)

1. Go to [business.facebook.com/settings](https://business.facebook.com/settings) → **Security Center** → **Start verification**.
2. Enter the legal business name, address, phone and website **exactly** as they appear on your documents.
3. Upload:
   - the **ASIC Certificate of Registration** / current company extract (shows the ACN), or the ABN registration (an ABN Lookup page or the ABR confirmation), and
   - a **utility bill or bank statement** (last 3 months) with the same name and address.
4. Choose a verification method: email on your domain (fastest), phone call, or SMS. Meta then checks that your website shows the same business name, so add a footer to `flazyn.com` that says "© <Legal Name>" and the address.
   Tip: for Australian businesses Meta can often confirm the ABN against the public ABN Lookup register automatically, so having the ABN speeds this up.
5. Wait: usually **2–10 business days**. If Meta rejects it, the reason is almost always a name or address mismatch. Fix it and resubmit.

---

## Step 3 — Meta App Review for Lead Ads (`leads_retrieval`)

Flazyn now requests exactly these permissions, which is what Meta's Lead Ads CRM guide lists:

`leads_retrieval`, `pages_show_list`, `pages_read_engagement`, `pages_manage_metadata`, `pages_manage_ads`, `ads_management`

### 3.1 Prepare the app
1. App dashboard → **Use cases / Products** → make sure **Webhooks** and **Facebook Login for Business** are added.
2. **Facebook Login → Settings → Valid OAuth Redirect URIs**: `https://<domain>/api/integrations/oauth/facebook/callback`
3. **Webhooks** → select object **Page** → Callback URL `https://<domain>/api/integrations/webhook/facebook`, Verify token = the value of `FACEBOOK_VERIFY_TOKEN` in your `.env` (it is now `flazyn_verify_2026`) → **Verify and save** → subscribe to the **`leadgen`** field.
4. Make sure `FACEBOOK_APP_SECRET` is set on the server. Flazyn now rejects webhook calls whose `X-Hub-Signature-256` doesn't match.
5. Test it in standard access first. On the Flazyn **Test** page, log in to Flazyn → Automations → Facebook → **Connect** → approve every permission. Then open the [Lead Ads Testing Tool](https://developers.facebook.com/tools/lead-ads-testing) → choose the page and form → **Create lead**. The lead should appear in Flazyn within seconds.
6. In **Business Settings → Integrations → Leads Access**, make sure the Flazyn app has access to the page.

### 3.2 Record the screencast
Record one video for each permission, or one video that clearly covers them all, in English UI with captions or voice-over:
1. Log in to Flazyn at your real domain.
2. Automations → Facebook → **Connect** → the Facebook dialog showing **all requested permissions** → pick the page → approve.
3. Back in Flazyn: show the connected page.
4. Submit a test lead with the Lead Ads Testing Tool.
5. Show the lead arriving in **Leads**, open it, and show the name, phone and form answers.
6. Show **Disconnect** and the `/data-deletion` page.

### 3.3 Submit
1. App dashboard → **App Review → Permissions and features** → request **Advanced Access** for each permission above.
2. For each permission, write a use-case description. For example, for `leads_retrieval`:
   > *Flazyn is a CRM for sales teams. When a business connects its Facebook Page, Flazyn subscribes to the Page's `leadgen` webhook and uses `leads_retrieval` to fetch each new lead's form answers (name, phone, email and the advertiser's custom questions). The lead appears instantly in the business's Flazyn pipeline, is assigned to a salesperson, and the salesperson follows up by phone or WhatsApp. Data is shown only to the business that owns the Page, is never sold or shared, and can be deleted at any time.*

   Write similar one-paragraph explanations for the others: `pages_show_list` is used to let the user pick a page, `pages_manage_metadata` to subscribe the page to the leadgen webhook, and so on.
3. Fill in **Data Handling** questions (data processors: AWS, Twilio, SendGrid, Firebase, OpenAI, Stripe; data is not shared or sold).
4. Switch the app to **Live** mode (top bar).
5. Submit. Expect **1–3 weeks**; Meta's reviews have been slow in 2026. If rejected, read the reviewer notes carefully. The usual causes are a screencast that doesn't show the login dialog permissions, or a broken privacy URL.

---

## Step 4 — WhatsApp Business (after Step 2 is approved)

The code supports two providers. Pick **one** for production:

**Option A: Meta WhatsApp Cloud API (direct, cheapest)**
1. [developers.facebook.com/apps](https://developers.facebook.com/apps) → your app → **WhatsApp → API Setup**.
2. **Add phone number** → enter the business number → display name `Flazyn` or the business brand. The display name must match the verified business or website.
3. Verify the number by SMS or voice → wait for display-name approval (usually 1–2 days).
4. **Configuration → Webhook**: `https://<domain>/api/whatsapp/webhook`, verify token = `WHATSAPP_VERIFY_TOKEN` (now `flazyn_wa_verify_2026`) → subscribe to **messages**.
5. Create a **System User** in Business Settings → give it the app and the WhatsApp account → generate a **permanent token** with `whatsapp_business_messaging` and `whatsapp_business_management`. Put it in `WHATSAPP_ACCESS_TOKEN`.
6. In `.env`: set `WHATSAPP_MODE=cloud`, plus `WHATSAPP_PHONE_NUMBER_ID` and `WHATSAPP_BUSINESS_ACCOUNT_ID`.
7. **Message templates**: any message sent more than 24 hours after the lead's last message must use an approved template. Create templates such as "new_lead_welcome" in **WhatsApp Manager → Message templates**. Approval takes minutes to hours.
8. If other businesses will connect *their own* WhatsApp numbers through Flazyn, apply to become a **Tech Provider** and request Advanced Access to the two WhatsApp permissions through App Review, the same way as Step 3.

**Option B: Twilio (what the dev setup uses now)**
1. Twilio Console → Messaging → Senders → **WhatsApp senders** → **Self sign-up** → log in with the verified Meta Business → register the number.
2. Set the sender's **"When a message comes in"** webhook to `https://<domain>/api/whatsapp/webhook` (POST). Flazyn now understands Twilio's format.
3. Keep `WHATSAPP_MODE=sandbox` (the Twilio code path) and set `TWILIO_WHATSAPP_FROM=whatsapp:+<your number>`.

---

## Step 5 — LinkedIn Lead Sync API

LinkedIn requires a *real* company page and a *verified* app. Test pages get rejected.

1. **Create a Company Page** named `Flazyn` from the LinkedIn work menu → Create a Company Page → Company. Add the logo, website `https://<domain>`, industry and size. Make Hassan, or whoever will own it, a **super admin**.
2. Go to [linkedin.com/developers/apps/new](https://www.linkedin.com/developers/apps/new):
   - App name `Flazyn`. LinkedIn rules: don't use "Linked" or "In" in the name or logo.
   - LinkedIn Page: select the Flazyn page.
   - Privacy policy URL: `https://<domain>/privacy`
   - App logo
   - Agree to the terms → **Create app**
3. **Settings tab → Verify**: generate the verification URL and send it to the page's super admin, who opens it and approves. This step is mandatory.
4. **Auth tab → Authorized redirect URLs**: add `https://<domain>/api/integrations/oauth/linkedin/callback`
5. **Products tab** → find **Lead Sync API** → **Request access** → fill in the form:
   - Business email: your **domain email**, which you must verify.
   - Legal name, registered address and website, matching Step 0.
   - Use case: **Lead Sync**, worded something like this:
     > *Flazyn syncs LinkedIn Lead Gen Form leads into our customers' CRM in real time so sales teams can follow up immediately.*
6. Wait for approval. You'll get an email, or you can check the Products tab. It usually takes a few business days.
7. After approval:
   - Copy the **Client ID** and **Client Secret** into `.env` as `LINKEDIN_CLIENT_ID` and `LINKEDIN_CLIENT_SECRET`.
   - Under **Webhooks**, register `https://<domain>/api/integrations/webhook/linkedin`. LinkedIn sends a challenge, and Flazyn answers it automatically with the HMAC of your client secret.
8. Test it: in Flazyn, Automations → LinkedIn → **Connect**. Flazyn requests `r_marketing_leadgen_automation r_ads r_organization_admin` and subscribes each of your ad accounts to lead notifications. Then send a test lead from LinkedIn **Campaign Manager → your form → Preview → Send test lead**.

> The LinkedIn and TikTok lead-fetching code follows their current API docs, but it **can only be tested end-to-end after approval**. Plan a short test-and-fix session right after each approval arrives.

---

## Step 6 — TikTok Lead Generation (TikTok API for Business)

1. Create a **TikTok for Business** account at [ads.tiktok.com](https://ads.tiktok.com) with the domain email → create a **Business Center** with the legal company details.
2. Go to [business-api.tiktok.com/portal](https://business-api.tiktok.com/portal) → **Become a Developer** → name and a **company-domain email**. Personal email is rejected. Wait for developer approval (1–3 days).
3. **My Apps → Create an App**:
   - App name `Flazyn`
   - Description, for example:
     > *CRM that receives TikTok Lead Generation form submissions for our advertisers in real time, assigns them to sales agents and enables follow-up.*
   - Advertiser redirect URL: `https://<domain>/api/integrations/oauth/tiktok/callback`
   - **Scope of permission**: tick the **Lead Management / Lead** permissions, plus **Ad Account Management** (needed to read which advertiser accounts were authorized). Only tick what matches the description.
   - Submit. Review takes **2–3 business days**.
4. After approval:
   - Copy the **App ID** and **Secret** into `.env` as `TIKTOK_APP_ID` and `TIKTOK_APP_SECRET`.
   - Set the leads **webhook / subscription callback** to `https://<domain>/api/integrations/webhook/tiktok`.
5. Test it: Flazyn → Automations → TikTok → **Connect**. The authorized advertiser IDs are stored, and leads are now routed **only** to the workspace that authorized that advertiser. Then submit a test lead from **TikTok Ads Manager → Tools → Instant Form → Preview/Test**.

---

## Step 7 — WordPress plugin (already rebranded)

- Plugin: `plugins/wordpress/flazyn/`. The downloadable zip is `web/public/plugins/wordpress/flazyn.zip`, also served from the WordPress integration page.
- Reinstall it on **ezload.io**: deactivate and delete the old "CRM Final" plugin → upload `flazyn.zip` → paste the **Account Token** again. The settings keys changed, so the old token isn't carried over.
- Before listing it on wordpress.org: replace `Plugin URI: https://flazyn.com` with the real site, bump `Version`, and add screenshots to `readme.txt`.

---

## Checklist

- [ ] Domain + HTTPS deployed; `/privacy`, `/terms`, `/data-deletion` load publicly
- [ ] Domain email working
- [ ] ASIC registration + ABN + utility bill/bank statement, all with the same legal name and address
- [ ] Step 1 renames done (FB app, page, Business Manager, pixel, Google, Firebase, SendGrid, Stripe)
- [ ] Meta Business Verification **approved**
- [ ] Meta App Review submitted → approved → app **Live**
- [ ] WhatsApp number registered + webhook + templates
- [ ] LinkedIn page + app verified + Lead Sync access approved + webhook validated
- [ ] TikTok developer + app approved + webhook set
- [ ] Old "CRM Final" WordPress plugin replaced with `flazyn.zip`
- [ ] After each approval: run one real test lead end-to-end

### Sources
- Meta — [Webhooks for Lead Ads (CRM)](https://developers.facebook.com/documentation/ads-commerce/marketing-api/guides/lead-ads/quickstart/webhooks-integration), [Retrieving Leads](https://developers.facebook.com/documentation/ads-commerce/marketing-api/guides/lead-ads/retrieving)
- LinkedIn — [Getting Access to Lead Sync](https://learn.microsoft.com/en-us/linkedin/marketing/lead-sync/getting-access-leadsync?view=li-lms-2026-09), [Lead Sync API](https://learn.microsoft.com/en-us/linkedin/marketing/lead-sync/leadsync?view=li-lms-2026-09)
- TikTok — [Register as a developer](https://business-api.tiktok.com/portal/docs/register-as-a-developer/v1.3), [Create a developer app](https://business-api.tiktok.com/portal/docs/create-a-developer-app/v1.3)
- Review-timeline context — [Meta App Review now takes ~20 days (2026)](https://bundle.social/blog/meta-app-review-20-days)

---

# Part 2 — Keys & settings so every automation actually works

Code is done for all of these. Each row is what **you** must provide or switch on. ✅ = already in your `backend/.env`, ⚠️ = missing / placeholder.

## A. Foundation (everything depends on this)

| Need | Why | Where |
|---|---|---|
| Public HTTPS deploy + `API_URL` / `WEB_URL` set to the real domain | Webhooks, tracked links, form pages and the website script all use these URLs | `backend/.env` |
| **Run exactly one backend instance**, always on | The scheduler (flows, sequences, campaigns, chat-assistant 5-min rule, account purge) runs in-process. Two instances = double sends; sleeping dynos = missed steps | Railway/Render: 1 replica, no sleep |
| Strong `JWT_SECRET` / `JWT_REFRESH_SECRET` (32+ random chars) | Also signs OAuth state and tracked-link tokens | `backend/.env` |
| At least one **sales agent** in Team | Round-robin and least-loaded assignment pick from sales agents; with none, the owner gets every lead | Team page |

## B. Channels

| Automation | Needs | Status / where |
|---|---|---|
| **Email** sending (campaigns, flows, distribution emails) | `SENDGRID_API_KEY` with *Mail Send* permission; **Domain Authentication** for your domain; `SENDGRID_FROM_EMAIL=no-reply@yourdomain` (a Gmail sender will land in spam) | ✅ key · ⚠️ from address is a Gmail |
| Email **opens / clicks / bounces** (segments like "opened but didn't reply", interest score) | SendGrid → Settings → Mail Settings → **Event Webhook** → `https://<domain>/api/marketing/webhooks/sendgrid`, tick Delivered, Open, Click, Bounce, Spam Report | ⚠️ set after deploy |
| **WhatsApp** auto-responder, chat assistant, AI agent, sequences | Step 4 of Part 1 (Cloud API or Twilio sender) + webhook `https://<domain>/api/whatsapp/webhook` + approved **message templates** for anything sent >24h after the lead's last message | ⚠️ needs Meta Business Verification |
| **SMS** | Buy a Twilio number → `TWILIO_PHONE_NUMBER`; Twilio number → Messaging webhook `https://<domain>/api/sms/webhook` | ✅ SID/token · ⚠️ number = `buy_later` |
| **Push** notifications on the mobile app | Firebase service account (present) + the mobile app registering its FCM token | ✅ server side |

## C. Lead sources

| Source | Needs |
|---|---|
| Facebook / Instagram Lead Ads | Part 1 Steps 1–3 (`leads_retrieval` approval), `FACEBOOK_APP_SECRET` set (webhook signatures are now verified), **reconnect** Facebook in the app once deployed |
| LinkedIn | Part 1 Step 5 → `LINKEDIN_CLIENT_ID/SECRET` |
| TikTok | Part 1 Step 6 → `TIKTOK_APP_ID/SECRET` |
| Website forms / WordPress / Google Forms / Zapier | Nothing extra — copy the account token from the integration page |
| Lead-form pages (templates) | Nothing extra — pick a design in Automations → Lead Forms or Templates → *Use* |

## D. Interest tracking + AI

| Feature | Needs |
|---|---|
| **Website time & pages** | Paste the one-line script from **Automations → Website & Document Tracking** on every page of your site, and save your website URL there |
| **PDF / document reading** (per-page time) | Upload files in **Content** and share them from Flazyn (WhatsApp/email). Files must be reachable by the server: S3 objects need to be public-read *or* the server needs read access to the bucket |
| Identifying website visitors | Automatic when they submit any form on your site (the script captures email/phone), use a Flazyn form page, or click a **tracked link** (lead profile → *Copy tracked website link*) |
| **AI brief** (summary, next action, suggested message) | `OPENAI_API_KEY` with billing enabled on the OpenAI account; optional `OPENAI_MODEL` (default `gpt-4o-mini`). Without a key, a rule-based brief is shown and labelled as such | ✅ key present |
| Privacy | Your `/privacy` page already covers it; add a cookie notice on your website if you have EU/UK visitors |

## E. Revenue & signals back to ads

| Feature | Needs |
|---|---|
| Stripe subscriptions | Live keys when ready; Stripe → Developers → Webhooks → `https://<domain>/api/billing/webhook` (signature verification was broken and is now fixed) |
| Meta Conversions API ("qualified lead" back to Meta) | Pixel ID + CAPI access token in **Automations → Meta Conversions API** |
