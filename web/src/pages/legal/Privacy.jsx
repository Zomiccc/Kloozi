import LegalPage, { LEGAL, Section, List, Mail } from './LegalPage';
import { Link } from 'react-router-dom';

export default function Privacy() {
  return (
    <LegalPage
      title="Privacy Policy"
      intro={`${LEGAL.product} is a customer relationship management (CRM) platform operated by ${LEGAL.company}. Businesses use ${LEGAL.product} to capture sales leads from their advertising and websites, and to follow up with those leads by phone, WhatsApp, SMS and email. This policy explains what information we collect, how we use it, who we share it with, and the choices you have.`}
    >
      <Section title="Who this policy covers">
        <p>
          This policy applies to (a) <strong>customers</strong> — businesses and their team members who create a {LEGAL.product} account, and
          (b) <strong>leads</strong> — people whose details a customer has received, for example by submitting a lead form on Facebook,
          Instagram, LinkedIn, TikTok, Google or a customer's website, or by messaging the customer on WhatsApp.
        </p>
        <p>
          For lead information, the customer that collected it is the data controller and {LEGAL.product} acts as its data processor.
          If you are a lead and want to access or delete your data, you can contact the business you submitted it to, or contact us
          and we will forward your request.
        </p>
      </Section>

      <Section title="Information we collect">
        <p><strong>Account information</strong> — name, email address, phone number, company name, role, password (stored only as a one-way hash), and, if you sign in with Google, your Google account email and name.</p>
        <p><strong>Lead information received from connected platforms</strong> — when a customer connects an advertising account, we receive the answers a person submitted on that platform's lead form. This typically includes full name, phone number, email address, city, and any custom questions the advertiser added (for example budget or product interest), plus the form, ad and campaign identifiers. Sources include:</p>
        <List items={[
          'Meta (Facebook and Instagram Lead Ads), through the Meta Graph API leadgen webhook and the leads_retrieval permission, using only the Pages the customer explicitly connects',
          'LinkedIn Lead Gen Forms, through the LinkedIn Marketing API for ad accounts the customer connects',
          'TikTok Lead Generation, through the TikTok for Business API for advertiser accounts the customer connects',
          'Website forms, WordPress, Google Forms and Zapier connections that the customer installs',
        ]} />
        <p><strong>Messages</strong> — WhatsApp, SMS and email messages exchanged between a customer and its leads through {LEGAL.product}, including delivery status.</p>
        <p><strong>Activity and engagement data</strong> — notes, call logs, follow-ups, pipeline stage changes, and whether a lead opened an email or a shared document.</p>
        <p><strong>Technical data</strong> — IP address, browser type and device information, collected in server logs for security and troubleshooting.</p>
      </Section>

      <Section title="How we use information">
        <List items={[
          'To deliver new leads to the customer that collected them, in real time, and to assign them to the right team member',
          'To let customers contact and follow up with their own leads (calls, WhatsApp, SMS, email) and run the automations they configure',
          'To show customers reports about their own sales pipeline and campaigns',
          'To send customers service notifications, such as new-lead alerts',
          'To secure the service, prevent abuse, and fix problems',
          'To process subscription payments',
        ]} />
        <p>
          Data received from Meta, LinkedIn or TikTok is used <strong>only</strong> to provide the lead-management service to the customer
          that connected the account. We do not sell it, we do not use it for advertising, we do not use it to build profiles across
          customers, and we do not share it with data brokers.
        </p>
      </Section>

      <Section title="Who we share information with">
        <p>We share information only with service providers that run parts of the service on our behalf, under contracts that restrict them to that purpose:</p>
        <List items={[
          'Cloud hosting and file storage (database servers, Amazon Web Services S3)',
          'Twilio and Meta WhatsApp Business Platform — to send and receive WhatsApp and SMS messages',
          'Twilio SendGrid — to send email',
          'Google Firebase — to deliver push notifications to the mobile app',
          'OpenAI — only if the customer enables AI features (such as the WhatsApp AI agent or email parsing), to process the relevant message text',
          'Stripe — to process subscription payments (we never see or store full card numbers)',
        ]} />
        <p>We may also disclose information if required by law, or to protect the rights and safety of our users and the public.</p>
      </Section>

      <Section title="Data retention">
        <p>
          Customer account data and lead data are kept for as long as the customer's account is active. Customers can delete individual
          leads at any time. When an account is deleted, its data is removed from our active systems within 30 days and from backups
          within 90 days. Access tokens for connected platforms are deleted as soon as the customer disconnects the integration.
        </p>
      </Section>

      <Section title="Security">
        <p>
          Data is encrypted in transit (HTTPS/TLS). Passwords are hashed. Access to customer data is limited to authorised personnel who
          need it to operate the service, and every workspace's data is isolated from every other workspace.
        </p>
      </Section>

      <Section title="Your rights and choices">
        <p>
          You can access, correct, export or delete your information. Customers can do most of this inside the app. Anyone can email <Mail /> and
          we will respond within 30 days. Instructions for deleting data received through Facebook or other platforms are on our{' '}
          <Link to="/data-deletion" className="text-accent-deep underline underline-offset-2">data deletion page</Link>.
        </p>
      </Section>

      <Section title="Australian privacy law">
        <p>
          {LEGAL.company} handles personal information in line with the <em>Privacy Act 1988</em> (Cth) and the Australian Privacy
          Principles. You can ask for access to, or correction of, the personal information we hold about you by emailing <Mail />.
          We respond within 30 days and do not charge for making a request.
        </p>
        <p>
          <strong>Overseas disclosure.</strong> Some of the service providers listed above store or process data outside Australia,
          mainly in the United States (and, depending on configuration, the European Union or Singapore). We take reasonable steps,
          including contractual commitments, to make sure they handle it consistently with the Australian Privacy Principles.
        </p>
        <p>
          <strong>Complaints.</strong> If you have a privacy concern, email <Mail /> and we will investigate and reply within 30 days.
          If you are not satisfied with our response, you can complain to the Office of the Australian Information Commissioner (OAIC)
          at <a href="https://www.oaic.gov.au" className="text-accent-deep underline underline-offset-2" target="_blank" rel="noreferrer">oaic.gov.au</a>.
        </p>
        <p>
          <strong>Data breaches.</strong> If a breach is likely to cause serious harm, we will notify affected people and the OAIC
          under the Notifiable Data Breaches scheme.
        </p>
      </Section>

      <Section title="Children">
        <p>{LEGAL.product} is a business tool and is not directed at children under 16. We do not knowingly collect their information.</p>
      </Section>

      <Section title="Changes to this policy">
        <p>We will post any changes on this page and update the effective date. Material changes will be notified to customers by email.</p>
      </Section>
    </LegalPage>
  );
}
