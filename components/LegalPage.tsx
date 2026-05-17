import { CookieConsent } from './CookieConsent';
import { LegalFooter } from './LegalFooter';

export function LegalPage({ kind }: { kind: 'privacy' | 'terms' | 'legal' }) {
  const title = kind === 'privacy' ? 'Privacy policy' : kind === 'terms' ? 'Terms of service' : 'Legal notice';
  const body = kind === 'privacy'
    ? 'Anclora Group processes account, session and call operation data needed to provide Anclora LinguoCAM. Contact: hola@anclora.com.'
    : kind === 'terms'
      ? 'Anclora LinguoCAM provides real-time communication and translation support. It does not replace professional interpretation, legal, medical or regulated advice.'
      : 'Owner and operator: Anclora Group. Anclora LinguoCAM is a commercial brand operated under exclusive license by Anclora Group. No granted trademark registration is asserted.';
  return (
    <div className="relative min-h-screen bg-black px-6 py-20 text-white">
      <div className="mx-auto max-w-3xl space-y-4 rounded-2xl border border-zinc-800 bg-zinc-900 p-8">
        <h1 className="text-4xl font-bold">{title}</h1>
        <p className="text-zinc-300 leading-7">{body}</p>
        <p className="text-zinc-300 leading-7">Necessary cookies support secure sessions and call preferences. Optional categories can be managed from the floating cookie button.</p>
        <a href="/" className="inline-flex rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white">Back</a>
      </div>
      <LegalFooter />
      <CookieConsent />
    </div>
  );
}
