import LegalPage, { LEGAL, Section, Mail } from './LegalPage';

export default function DataDeletion() {
  return (
    <LegalPage
      title="Data Deletion Instructions"
      intro={`How to delete data held by ${LEGAL.product}, including data received through Facebook, Instagram, LinkedIn and TikTok.`}
    >
      <Section title="If you are a Flazyn customer">
        <p><strong>Delete individual leads:</strong> open the lead in {LEGAL.product}, choose Delete. Bulk deletion is available from the Leads list.</p>
        <p>
          <strong>Disconnect a platform:</strong> go to Automations, open the Facebook, LinkedIn or TikTok integration and choose Disconnect.
          Stored access tokens are deleted immediately and no further leads are received.
        </p>
        <p>
          <strong>Remove {LEGAL.product} from Facebook:</strong> in Facebook, go to Settings &amp; privacy → Settings → Business integrations,
          select {LEGAL.product} and choose Remove. This revokes our access to your Pages.
        </p>
        <p>
          <strong>Delete your whole account:</strong> go to Settings → Account → Delete account, or email <Mail /> from the account's
          email address. All workspace data is removed from active systems within 30 days and from backups within 90 days.
        </p>
      </Section>

      <Section title="If you submitted your details on a lead form">
        <p>
          Your information belongs to the business whose form you filled in. You can ask that business to delete it, or email <Mail /> with
          the subject “Data deletion request” and include the phone number or email address you submitted and, if you know it, the
          business name. We will verify the request, delete the matching records (or pass the request to the business that controls
          them) and confirm within 30 days.
        </p>
      </Section>
    </LegalPage>
  );
}
