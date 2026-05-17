const footerLabels = {
  es: { terms: 'Términos', privacy: 'Privacidad', legal: 'Aviso legal', rights: 'Todos los derechos reservados.' },
  en: { terms: 'Terms', privacy: 'Privacy', legal: 'Legal notice', rights: 'All rights reserved.' },
  de: { terms: 'AGB', privacy: 'Datenschutz', legal: 'Impressum', rights: 'Alle Rechte vorbehalten.' },
  ru: { terms: 'Условия', privacy: 'Конфиденциальность', legal: 'Правовая информация', rights: 'Все права защищены.' },
  fr: { terms: 'Conditions', privacy: 'Confidentialité', legal: 'Mentions légales', rights: 'Tous droits réservés.' },
  it: { terms: 'Termini', privacy: 'Privacy', legal: 'Note legali', rights: 'Tutti i diritti riservati.' },
};

export function LegalFooter({ locale = 'en' }: { locale?: keyof typeof footerLabels }) {
  const copy = footerLabels[locale] ?? footerLabels.en;
  const year = new Date().getFullYear();
  return (
    <footer className="absolute inset-x-0 bottom-0 z-20 border-t border-zinc-800 bg-black/90 px-4 py-2 text-[11px] text-zinc-500 backdrop-blur">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span>© {year} Anclora Group — {copy.rights} Anclora LinguoCAM forma parte del ecosistema tecnológico de Anclora Group.</span>
        <span className="flex flex-wrap gap-3">
          <a href="/terms" className="hover:text-zinc-200">{copy.terms}</a>
          <a href="/privacy" className="hover:text-zinc-200">{copy.privacy}</a>
          <a href="/legal" className="hover:text-zinc-200">{copy.legal}</a>
          <a href="mailto:hola@anclora.com" className="hover:text-zinc-200">hola@anclora.com</a>
          <button type="button" onClick={() => window.dispatchEvent(new Event('anclora:open-cookie-preferences'))} className="hover:text-zinc-200">Cookies</button>
        </span>
      </div>
    </footer>
  );
}
