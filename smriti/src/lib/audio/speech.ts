import type { UILanguage } from '@/lib/i18n/languages';

/** BCP-47 tags to match against installed voices' `.lang`. */
const LANG_TAG: Record<UILanguage, string> = {
  en: 'en',
  hi: 'hi',
  as: 'as',
};

/**
 * Speaks a string aloud via the Web Speech API, guarded to no-op wherever
 * it's unavailable — jsdom in tests, and any browser without it. Callers
 * never touch `window.speechSynthesis` directly so this guard lives in one
 * place.
 *
 * Cancels any speech already queued before speaking: without this, calls
 * fired in quick succession (a reveal sequence, a re-triggered effect) pile
 * up in the browser's utterance queue and play back one after another,
 * sounding like the same line repeating.
 *
 * Picks a voice matching `language` when one is installed; Assamese voices
 * are rare even on devices with Hindi support, so when no matching voice
 * exists this stays silent rather than speaking the line in the wrong
 * language — the on-screen text is the fallback (spec: "Audio is
 * unavailable on this device. You can read the instruction below.").
 */
export function speak(text: string, language: UILanguage = 'en'): void {
  if (typeof window === 'undefined' || !window.speechSynthesis) return;

  window.speechSynthesis.cancel();

  const tag = LANG_TAG[language];
  const voices = window.speechSynthesis.getVoices();
  const voice = voices.find((v) => v.lang.toLowerCase().startsWith(tag));

  if (!voice && language !== 'en') return;

  const utterance = new SpeechSynthesisUtterance(text);
  if (voice) {
    utterance.voice = voice;
    utterance.lang = voice.lang;
  }
  window.speechSynthesis.speak(utterance);
}
