'use client';

import { usePathname } from 'next/navigation';
import { useSettingsStore } from '@/stores/settingsStore';
import { LANGUAGES, type UILanguage } from '@/lib/i18n/languages';
import { LANGUAGE_TARGET_MIN_PX } from '@/components/ui/touchTarget';

/**
 * Language names are written in their own script, never translated: a patient
 * looking for Assamese scans for "অসমীয়া", not for the word "Assamese".
 *
 * STOPGAP: this flat list scales badly past 3 languages — the real
 * region-grouped, capability-labeled selector (multilingual-expansion plan,
 * Part 4/Step 5) replaces this component's body next. These 4 new entries
 * exist only so UILanguage's widening compiles; Manipuri is written in
 * Bengali script here (Meitei Mayek has no font loaded in this app yet —
 * see languages.ts).
 */
const NATIVE_NAME: Record<UILanguage, string> = {
  as: 'অসমীয়া',
  hi: 'हिन्दी',
  en: 'English',
  brx: 'बड़ो',
  mni: 'মৈতৈলোন্',
  bn: 'বাংলা',
  ne: 'नेपाली',
};

export default function LanguagePicker() {
  const language = useSettingsStore((s) => s.language);
  const setLanguage = useSettingsStore((s) => s.setLanguage);
  const pathname = usePathname();

  // Language is a caregiver-only setting — a dementia patient who
  // accidentally switches the app into a language they don't read has no
  // way to switch it back unsupervised. This isn't just "no patient screen
  // renders this today": the component itself refuses to act outside
  // `/caregiver/*` so a future page that imports it by mistake can't
  // silently re-expose the control on a patient-facing screen.
  if (!pathname?.startsWith('/caregiver')) return null;

  return (
    <div className="flex flex-wrap gap-touch-gap" role="group" aria-label="Choose language">
      {LANGUAGES.map((code) => {
        const active = code === language;
        return (
          <button
            key={code}
            type="button"
            lang={code}
            onClick={() => setLanguage(code)}
            aria-pressed={active}
            style={{ minHeight: LANGUAGE_TARGET_MIN_PX }}
            className={
              'flex-1 rounded-tile px-5 text-patient-body font-semibold ' +
              'transition-transform duration-100 active:scale-[0.97] ' +
              'motion-reduce:active:scale-100 focus-visible:outline ' +
              'focus-visible:outline-4 focus-visible:outline-offset-2 ' +
              'focus-visible:outline-primary-dark ' +
              (active
                ? 'bg-primary text-ink-inverse'
                : 'bg-surface-card text-ink border-2 border-surface-muted hover:bg-surface-muted')
            }
          >
            {NATIVE_NAME[code]}
          </button>
        );
      })}
    </div>
  );
}
