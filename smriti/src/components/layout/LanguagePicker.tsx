'use client';

import { useSettingsStore } from '@/stores/settingsStore';
import { LANGUAGES, type UILanguage } from '@/lib/i18n/languages';
import { TOUCH_TARGET_MIN_PX } from '@/components/ui/touchTarget';

/**
 * Language names are written in their own script, never translated: a patient
 * looking for Assamese scans for "অসমীয়া", not for the word "Assamese".
 */
const NATIVE_NAME: Record<UILanguage, string> = {
  as: 'অসমীয়া',
  hi: 'हिन्दी',
  en: 'English',
};

export default function LanguagePicker() {
  const language = useSettingsStore((s) => s.language);
  const setLanguage = useSettingsStore((s) => s.setLanguage);

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
            style={{ minHeight: TOUCH_TARGET_MIN_PX }}
            className={
              'flex-1 rounded-tile px-5 text-patient-body font-semibold transition-colors ' +
              'focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-2 ' +
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
