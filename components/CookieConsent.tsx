import { useEffect, useState } from 'react';

type CookiePreferences = { necessary: true; session: true; analytics: boolean; marketing: boolean; updatedAt: string; version: 'v1' };
const STORAGE_KEY = 'anclora-cookie-consent-v1';
const defaults: CookiePreferences = { necessary: true, session: true, analytics: false, marketing: false, updatedAt: '', version: 'v1' };

export function CookieConsent() {
  const [open, setOpen] = useState(false);
  const [settings, setSettings] = useState(false);
  const [preferences, setPreferences] = useState(defaults);
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<CookiePreferences>;
        setPreferences({ necessary: true, session: true, analytics: Boolean(parsed.analytics), marketing: Boolean(parsed.marketing), updatedAt: parsed.updatedAt ?? '', version: 'v1' });
        return;
      }
    } catch {}
    setOpen(true);
  }, []);
  useEffect(() => {
    const listener = () => { setOpen(true); setSettings(true); };
    window.addEventListener('anclora:open-cookie-preferences', listener);
    return () => window.removeEventListener('anclora:open-cookie-preferences', listener);
  }, []);
  function persist(next: CookiePreferences) {
    const value = { ...next, necessary: true as const, session: true as const, updatedAt: new Date().toISOString(), version: 'v1' as const };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
    setPreferences(value);
    setOpen(false);
    setSettings(false);
  }
  return (
    <>
      <button type="button" aria-label="Cookie preferences" onClick={() => { setOpen(true); setSettings(true); }} className="fixed bottom-12 left-5 z-50 h-11 w-11 rounded-full border border-blue-400/40 bg-zinc-950/90 text-blue-200 shadow-2xl backdrop-blur">C</button>
      {open ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/65 px-4 py-6 backdrop-blur-sm sm:items-center" role="dialog" aria-modal="true" aria-labelledby="linguo-cookie-title">
          <div className="w-full max-w-lg rounded-2xl border border-zinc-700 bg-zinc-900 p-6 text-white shadow-2xl">
            <h2 id="linguo-cookie-title" className="text-2xl font-semibold">{settings ? 'Manage cookies' : 'Cookie preferences'}</h2>
            <p className="mt-3 text-sm leading-6 text-zinc-300">Necessary cookies support secure sessions and call preferences. Optional analytics or marketing remain disabled unless accepted.</p>
            {settings ? (
              <div className="mt-5 space-y-3">
                <CookieRow title="Necessary cookies" description="Session, security and call operation. They cannot be disabled." checked disabled onChange={() => {}} />
                <CookieRow title="Analytics cookies" description="Operational quality and stability measurement." checked={preferences.analytics} onChange={(analytics) => setPreferences((current) => ({ ...current, analytics }))} />
                <CookieRow title="Marketing cookies" description="Reserved for relevant communications. They do not enable scripts that are not present." checked={preferences.marketing} onChange={(marketing) => setPreferences((current) => ({ ...current, marketing }))} />
              </div>
            ) : null}
            <div className="mt-5 flex flex-col gap-3 sm:flex-row">
              {!settings ? <button type="button" onClick={() => persist({ ...defaults, analytics: true, marketing: true })} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white">Accept all</button> : null}
              <button type="button" onClick={() => settings ? persist(preferences) : setSettings(true)} className="rounded-lg bg-zinc-800 px-4 py-2 text-sm font-semibold text-zinc-100">{settings ? 'Save preferences' : 'Settings'}</button>
              <button type="button" onClick={() => persist(defaults)} className="rounded-lg px-4 py-2 text-sm font-semibold text-zinc-300">Reject optional</button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

function CookieRow({ title, description, checked, disabled, onChange }: { title: string; description: string; checked: boolean; disabled?: boolean; onChange: (checked: boolean) => void }) {
  return <label className="flex items-start justify-between gap-4 rounded-xl border border-zinc-700 bg-zinc-950 p-4"><span><span className="block text-sm font-medium">{title}</span><span className="mt-1 block text-xs leading-5 text-zinc-400">{description}</span></span><input type="checkbox" checked={checked} disabled={disabled} onChange={(event) => onChange(event.target.checked)} className="mt-1 h-5 w-5 accent-blue-600" /></label>;
}
