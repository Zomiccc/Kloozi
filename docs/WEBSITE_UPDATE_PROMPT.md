# PROMPT — Update flazyn.com legal pages and footer

You are updating the live marketing website **flazyn.com** (hosted on Vercel). Make the changes below, keeping the site's existing design, fonts, colours, header and navigation. Only the legal content and the footer change.

## Why this matters
Meta (Facebook/WhatsApp), LinkedIn and TikTok review these pages when approving our API access. Their reviewers and automated checkers must be able to read the text, and the legal entity on the website must match our business registration exactly.

## Tasks

1. **Global footer.** On every page of the site, including the home page, blog and legal pages, add this line to the footer (small text, centred or matching the current footer style):
   `© 2026 HB&YM Pty Ltd trading as Flazyn · ABN 27 688 842 140 · 87 Eccles Cct, Macgregor ACT 2615, Australia`
   Below it, add links: **Privacy** → `/privacy`, **Terms** → `/terms`, **Data deletion** → `/data-deletion`, **hello@flazyn.com** → `mailto:hello@flazyn.com`.
   Implement it once in the shared footer/layout component, not page by page.

2. **Replace the content** of these three existing pages with the text in the "PAGE CONTENT" section below. Use it word for word, keeping the headings, lists, bold text and links:
   - `https://flazyn.com/privacy`
   - `https://flazyn.com/terms`
   - `https://flazyn.com/data-deletion`
   Keep these exact URLs (no redirects, no trailing-slash variants that 404).

3. **Make the text crawler-readable.** The legal text must be in the HTML the server returns, not only rendered by JavaScript after load. Use static generation / SSR / prerendering for these pages. Check it with `curl https://flazyn.com/privacy`: the policy text must appear in the raw HTML.

4. **Page metadata.** Set these titles:
   - "Privacy Policy | Flazyn"
   - "Terms of Service | Flazyn"
   - "Data Deletion Instructions | Flazyn"
   Give each a one-sentence meta description. The pages must be indexable (no `noindex`).

5. **Readability.** Use a max content width of about 720px, comfortable line height, headings for each section, and responsive layout on phones. Make every email address a `mailto:` link and every URL a clickable link.

6. **Do not:**
   - change any other page content
   - add cookie banners or trackers
   - use the name "Zomic" anywhere
   - change the legal entity name, ABN, address or email addresses given below

## Acceptance checklist (verify before finishing)
- [ ] Footer line with HB&YM Pty Ltd, ABN and address appears on the home page and on every other page
- [ ] `/privacy`, `/terms` and `/data-deletion` return HTTP 200 with the new text in the raw HTML (curl)
- [ ] Privacy page mentions Facebook/Instagram Lead Ads (`leads_retrieval`), LinkedIn Lead Sync and TikTok Lead Generation, the Privacy Act 1988 and the OAIC
- [ ] Data deletion page explains how to remove Flazyn from Facebook and how to email a deletion request
- [ ] Pages look correct on mobile and desktop
- [ ] Deployed to production on flazyn.com

---

# PAGE CONTENT

## Footer (every page of flazyn.com)

```
© 2026 HB&YM Pty Ltd trading as Flazyn · ABN 27 688 842 140 · 87 Eccles Cct, Macgregor ACT 2615, Australia
Privacy · Terms · Data deletion · hello@flazyn.com
```
(Link "Privacy", "Terms" and "Data deletion" to the three pages.)

---

## /privacy — Privacy Policy

**Effective date:** 1 October 2026

Flazyn is a customer relationship management (CRM) service operated by **HB&YM Pty Ltd (ABN 27 688 842 140)**, trading as Flazyn ("Flazyn", "we", "us"). Businesses use Flazyn to capture sales leads from their advertising and websites and to follow up with those leads by phone, WhatsApp, SMS and email. This policy explains what personal information we collect, how we use and share it, and your choices. We handle personal information in line with the *Privacy Act 1988* (Cth) and the Australian Privacy Principles.

### 1. Who this policy covers
- **Customers**: businesses and their team members who use Flazyn, and people who join our early-access programme.
- **Leads**: people whose details a customer receives, for example by submitting a lead form on Facebook, Instagram, LinkedIn, TikTok, Google or a customer's website, or by messaging the customer on WhatsApp.

For lead information, the customer who collected it controls that information and Flazyn processes it on their behalf. If you are a lead, you can contact the business you submitted your details to, or contact us and we will pass on your request.

### 2. Information we collect
- **Account information**: name, email, phone, company, role, and password (stored only as a one-way hash). If you sign in with Google, we also receive your Google email and name.
- **Lead information from connected platforms.** When a customer connects an advertising account, we receive the answers a person submitted on that platform's lead form. This is typically name, phone, email, city and any custom questions the advertiser added, plus form, ad and campaign identifiers. The sources are:
  - **Meta (Facebook and Instagram Lead Ads)**, via the Meta Graph API leadgen webhook and the `leads_retrieval` permission, only for the Pages the customer connects
  - **LinkedIn Lead Gen Forms**, via the LinkedIn Lead Sync API, for ad accounts the customer connects
  - **TikTok Lead Generation**, via the TikTok API for Business, for advertiser accounts the customer connects
  - website forms, WordPress, Google Forms and Zapier connections the customer installs
- **Messages**: WhatsApp, SMS and email messages exchanged between a customer and its leads through Flazyn, and their delivery status.
- **Engagement information**: when a customer shares a document or website link through Flazyn, or installs the Flazyn script on their own website, we record:
  - pages viewed and time spent
  - which pages of a shared document were read
  - email opens and clicks

  This information is linked to a lead only after they identify themselves (for example by submitting a form or opening a link sent to them).
- **Technical information**: IP address, browser and device type, kept in server logs for security and troubleshooting.

### 3. How we use information
- to deliver new leads instantly to the customer that collected them and assign them to the right team member
- to let customers contact and follow up with their own leads, and to run the automations the customer configures
- to show customers reports and interest indicators about their own leads, including optional AI-generated summaries
- to send service notifications, such as new-lead alerts
- to secure the service, prevent abuse and fix problems, and to process subscription payments

**Data received from Meta, LinkedIn or TikTok is used only to provide the lead-management service to the customer that connected the account.** We do not sell it, use it for advertising, build profiles across customers, or share it with data brokers.

### 4. Who we share information with
We share information only with service providers that run parts of Flazyn for us, under contracts limiting them to that purpose:
- cloud hosting and storage (including Amazon Web Services)
- Twilio and the Meta WhatsApp Business Platform, to send and receive WhatsApp and SMS messages
- Twilio SendGrid, to send email
- Google Firebase, to deliver push notifications
- OpenAI, only when a customer uses AI features, to process the relevant text
- Stripe, for payments (we never store full card numbers)

We may also disclose information when required by law.

### 5. Overseas disclosure
Some of these providers store or process data outside Australia, mainly in the United States, and depending on configuration also the European Union or Singapore. We take reasonable steps, including contractual commitments, to ensure they handle it consistently with the Australian Privacy Principles.

### 6. Retention and security
- We keep customer and lead data while the customer's account is active.
- Customers can delete individual leads at any time.
- When an account is deleted, its data is removed from active systems within 30 days and from backups within 90 days.
- Access tokens for connected platforms are deleted when the customer disconnects the integration.
- Data is encrypted in transit (HTTPS), passwords are hashed, and each customer's data is isolated from every other customer's.

### 7. Access, correction and deletion
You can ask for access to, correction of, or deletion of your personal information by emailing **hello@flazyn.com**. We respond within 30 days and do not charge for requests. Deletion instructions, including for data received via Facebook, are on our [Data Deletion](https://flazyn.com/data-deletion) page.

### 8. Complaints
If you have a privacy concern, email **hello@flazyn.com**; we will investigate and reply within 30 days. If you are not satisfied, you can complain to the Office of the Australian Information Commissioner at [oaic.gov.au](https://www.oaic.gov.au). If a data breach is likely to cause serious harm, we will notify affected people and the OAIC under the Notifiable Data Breaches scheme.

### 9. Children
Flazyn is a business tool and is not directed at children under 16.

### 10. Changes
We will post changes on this page and update the effective date; material changes will be emailed to customers.

### Contact
HB&YM Pty Ltd trading as Flazyn · ABN 27 688 842 140 · 87 Eccles Cct, Macgregor ACT 2615, Australia · **hello@flazyn.com**

---

## /terms — Terms of Service

**Effective date:** 1 October 2026

These terms govern your use of flazyn.com and the Flazyn service, provided by **HB&YM Pty Ltd (ABN 27 688 842 140)** trading as Flazyn. By using the website or the service you agree to them on behalf of yourself and the business you represent.

### 1. The service and early access
Flazyn lets businesses capture leads from advertising platforms and websites, organise them in a pipeline, and follow up by phone, WhatsApp, SMS and email, including automations the customer configures. Flazyn is currently offered as an early-access service: features may change, and the service may be interrupted while we improve it. Early access is free unless we agree otherwise in writing.

### 2. Your account
You must give accurate information, keep your login secure, and be at least 18 and authorised to act for your business. You are responsible for activity in your workspace, including by team members you invite.

### 3. Your data and your leads
You own the data you put into Flazyn, including your leads. You are responsible for:
- having a lawful basis to collect and contact your leads
- honouring their opt-outs
- complying with the policies of every platform you connect, including Meta's Platform Terms, the WhatsApp Business Policy, LinkedIn's API Terms and TikTok's advertising policies

We process lead data only on your instructions, as described in our [Privacy Policy](https://flazyn.com/privacy).

### 4. Acceptable use
You may not use Flazyn to:
- send spam or contact people without permission
- send unlawful, misleading or harassing content
- collect sensitive information without a lawful basis
- access other customers' data or interfere with the service
- resell it without our written agreement

We may suspend accounts that break these rules.

### 5. Third-party platforms
Integrations with Meta, WhatsApp, LinkedIn, TikTok, Google, Twilio, SendGrid and others depend on those providers. We are not responsible for their availability or policy changes.

### 6. Fees
Paid plans, when introduced, are billed in advance and renew until cancelled. Messaging charges from WhatsApp or SMS providers may apply separately.

### 7. Termination
You can stop using Flazyn and delete your account at any time. We may suspend or end accounts that breach these terms. After termination you can request an export of your data for 30 days, after which it is deleted.

### 8. Liability
The service is provided "as is". To the extent permitted by law, we are not liable for indirect or consequential loss, and our total liability in any 12 months is limited to the fees you paid us in that period. Nothing in these terms excludes rights you have under the **Australian Consumer Law** that cannot lawfully be excluded.

### 9. Governing law
These terms are governed by the laws of the **Australian Capital Territory**, Australia, and you submit to the non-exclusive jurisdiction of its courts.

### Contact
HB&YM Pty Ltd trading as Flazyn · ABN 27 688 842 140 · **hello@flazyn.com**

---

## /data-deletion — Data Deletion Instructions

**Effective date:** 1 October 2026

You can ask Flazyn (HB&YM Pty Ltd, ABN 27 688 842 140) to delete your personal data at any time.

### If you use Flazyn (business customers)
- **Delete individual leads:** open the lead in Flazyn and choose *Delete*, or select several in the Leads list.
- **Disconnect a platform:** in Flazyn go to *Automations*, open Facebook, LinkedIn or TikTok and choose *Disconnect*. Stored access tokens are deleted immediately and no further leads are received.
- **Remove Flazyn from Facebook:** in Facebook go to *Settings & privacy → Settings → Business integrations*, select Flazyn and choose *Remove*.
- **Delete your whole account:** in Flazyn go to *Settings → Account → Delete account*, or email **hello@flazyn.com** from the account's email address. All workspace data is removed from active systems within 30 days and from backups within 90 days.

### If you submitted your details on a lead form or messaged a business
Your information belongs to the business whose form or WhatsApp you used, and you can ask that business to delete it. You can also email **hello@flazyn.com** with the subject **"Data deletion request"**, including the phone number or email address you used and, if you know it, the business name. We will verify the request and delete the matching records (or pass the request to the business that controls them) and confirm **within 30 days**.

### Contact
HB&YM Pty Ltd trading as Flazyn · 87 Eccles Cct, Macgregor ACT 2615, Australia · **hello@flazyn.com**
