import LegalPage, { LEGAL, Section, List } from './LegalPage';
import { Link } from 'react-router-dom';

export default function Terms() {
  return (
    <LegalPage
      title="Terms of Service"
      intro={`These terms govern your use of ${LEGAL.product}, a CRM service operated by ${LEGAL.company}. By creating an account or using the service you agree to them on behalf of yourself and the business you represent.`}
    >
      <Section title="The service">
        <p>
          {LEGAL.product} lets businesses capture leads from advertising platforms and websites, organise them in a sales pipeline, and
          follow up by phone, WhatsApp, SMS and email, including automated rules and sequences that the customer configures.
        </p>
      </Section>

      <Section title="Your account">
        <List items={[
          'You must provide accurate information and keep your login credentials secure.',
          'You are responsible for everything done under your workspace, including by team members you invite.',
          'You must be at least 18 and authorised to bind your business to these terms.',
        ]} />
      </Section>

      <Section title="Your data and your leads">
        <p>
          You own the data you put into {LEGAL.product}, including your leads. You are responsible for having a lawful basis to collect
          and contact your leads, for honouring their opt-outs, and for complying with the policies of every platform you connect
          (including Meta's Platform Terms, the WhatsApp Business Policy, LinkedIn's API Terms and TikTok's advertising policies).
          We process lead data only on your instructions, as described in our{' '}
          <Link to="/privacy" className="text-accent-deep underline underline-offset-2">Privacy Policy</Link>.
        </p>
      </Section>

      <Section title="Acceptable use">
        <p>You may not use {LEGAL.product} to:</p>
        <List items={[
          'send spam or messages to people who have not given you permission to contact them',
          'send unlawful, deceptive, harassing or infringing content',
          'collect sensitive data (such as health or financial account data) through lead forms without a lawful basis',
          'attempt to access other workspaces, overload the service, or reverse-engineer it',
          'resell the service without our written agreement',
        ]} />
        <p>We may suspend accounts that break these rules, particularly where a messaging channel provider asks us to.</p>
      </Section>

      <Section title="Third-party platforms">
        <p>
          Integrations with Meta, WhatsApp, LinkedIn, TikTok, Google, Twilio, SendGrid and others depend on those providers. We are not
          responsible for their availability, pricing or policy changes, and an integration may stop working if a provider changes or
          withdraws access.
        </p>
      </Section>

      <Section title="Plans and payment">
        <p>
          Paid plans are billed in advance through Stripe and renew automatically until cancelled. You can cancel at any time; access
          continues until the end of the paid period. Fees are non-refundable except where the law requires otherwise. Message
          charges from WhatsApp or SMS providers may apply separately.
        </p>
      </Section>

      <Section title="Availability and changes">
        <p>
          We work to keep the service available but do not guarantee uninterrupted operation. We may change or discontinue features
          and will give reasonable notice of material changes that affect paid customers.
        </p>
      </Section>

      <Section title="Termination">
        <p>
          You can delete your account at any time. We may suspend or terminate accounts that breach these terms. After termination you
          can request an export of your data for 30 days, after which it is deleted as described in the Privacy Policy.
        </p>
      </Section>

      <Section title="Liability">
        <p>
          The service is provided "as is". To the extent permitted by law, {LEGAL.company} is not liable for indirect or consequential
          losses, lost profits or lost data, and our total liability in any 12-month period is limited to the fees you paid us in that
          period.
        </p>
      </Section>

      <Section title="Governing law">
        <p>
          These terms are governed by the laws of {LEGAL.state ? `${LEGAL.state}, ` : ''}{LEGAL.country}, and you submit to the
          non-exclusive jurisdiction of its courts. Nothing in these terms excludes rights you have under the Australian Consumer Law
          that cannot lawfully be excluded.
        </p>
      </Section>
    </LegalPage>
  );
}
