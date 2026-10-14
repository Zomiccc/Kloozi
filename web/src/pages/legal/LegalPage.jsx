import { Link } from 'react-router-dom';

// Shared shell for the public legal pages (privacy, terms, data deletion).
// Company details come from env so the published text never needs code edits:
//   VITE_LEGAL_COMPANY, VITE_LEGAL_EMAIL, VITE_LEGAL_ADDRESS, VITE_LEGAL_COUNTRY
export const LEGAL = {
  product: 'Flazyn',
  company: import.meta.env.VITE_LEGAL_COMPANY || 'Flazyn',
  email: import.meta.env.VITE_LEGAL_EMAIL || 'privacy@flazyn.com',
  address: import.meta.env.VITE_LEGAL_ADDRESS || '',
  country: import.meta.env.VITE_LEGAL_COUNTRY || 'Australia',
  state: import.meta.env.VITE_LEGAL_STATE || '',
  abn: import.meta.env.VITE_LEGAL_ABN || '',
  effective: '1 October 2026',
};

export function Section({ title, children }) {
  return (
    <section className="mt-10">
      <h2 className="text-ink-primary" style={{ fontSize: '20px', fontWeight: 650, letterSpacing: '-0.01em' }}>{title}</h2>
      <div className="mt-3 space-y-3 text-ink-secondary" style={{ fontSize: '15px', lineHeight: 1.7 }}>{children}</div>
    </section>
  );
}

export function List({ items }) {
  return (
    <ul className="list-disc pl-5 space-y-1.5">
      {items.map((t, i) => <li key={i}>{t}</li>)}
    </ul>
  );
}

export function Mail() {
  return <a href={`mailto:${LEGAL.email}`} className="text-accent-deep underline underline-offset-2">{LEGAL.email}</a>;
}

export default function LegalPage({ title, intro, children }) {
  return (
    <div className="min-h-screen" style={{ background: 'var(--canvas)' }}>
      <header className="max-w-3xl mx-auto px-4 sm:px-6 pt-8 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2 text-ink-primary">
          <span className="w-8 h-8 flex items-center justify-center text-white font-bold" style={{ background: 'linear-gradient(135deg, #7C5CFF 0%, #5B3DF5 100%)', borderRadius: '8px' }}>F</span>
          <span className="text-lg font-bold">{LEGAL.product}</span>
        </Link>
        <nav className="flex items-center gap-4 text-ink-secondary" style={{ fontSize: '14px' }}>
          <Link to="/privacy" className="hover:text-ink-primary">Privacy</Link>
          <Link to="/terms" className="hover:text-ink-primary">Terms</Link>
          <Link to="/data-deletion" className="hover:text-ink-primary">Data deletion</Link>
        </nav>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-12">
        <article className="bg-white px-5 sm:px-10 py-10" style={{ borderRadius: '10px', border: '1px solid var(--hairline)' }}>
          <p className="meta-label">Effective {LEGAL.effective}</p>
          <h1 className="text-ink-primary mt-2" style={{ fontSize: '34px', fontWeight: 700, letterSpacing: '-0.02em' }}>{title}</h1>
          {intro && <p className="text-ink-secondary mt-4" style={{ fontSize: '16px', lineHeight: 1.7 }}>{intro}</p>}
          {children}
          <Section title="Contact">
            <p>
              {LEGAL.company}{LEGAL.abn ? ` (ABN ${LEGAL.abn})` : ''}{LEGAL.address ? `, ${LEGAL.address}` : ''}{LEGAL.country ? `, ${LEGAL.country}` : ''}. Email: <Mail />
            </p>
          </Section>
        </article>
        <p className="text-ink-tertiary text-center mt-8" style={{ fontSize: '13px' }}>© 2026 {LEGAL.company}. All rights reserved.</p>
      </main>
    </div>
  );
}
