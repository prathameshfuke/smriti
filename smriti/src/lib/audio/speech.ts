import type { UILanguage } from '@/lib/i18n/languages';
import { claimChannel } from './channel';

/** BCP-47 tags to match against installed voices' `.lang`. Bodo (`brx`) and
 * Manipuri (`mni`) have no standard BCP-47 tag with real browser voice
 * support anywhere near universal — mapped to their ISO codes anyway; no
 * matching voice simply means this stays silent, the same honest "no voice
 * installed" behavior every other unsupported language already gets here. */
const LANG_TAG: Record<UILanguage, string> = {
  en: 'en',
  hi: 'hi',
  as: 'as',
  brx: 'brx',
  mni: 'mni',
  bn: 'bn',
  ne: 'ne',
};

/** Slowed 10% on clinical advice: normal-speed narration reads as too fast
 * for patients still learning a game's instructions. Games-only — pass
 * explicitly to `speak`/`narrate`, never made the default. */
export const GAME_SPEECH_RATE = 0.9;

/**
 * Speaks a string aloud via the Web Speech API, guarded to no-op wherever
 * it's unavailable — jsdom in tests, and any browser without it. Callers
 * never touch `window.speechSynthesis` directly so this guard lives in one
 * place.
 *
 * Claims the app's audio channel before speaking, which cancels queued
 * speech and stops any recorded or TTS clip still playing: without this,
 * calls fired in quick succession (a reveal sequence, a re-triggered effect)
 * pile up or play over one another.
 *
 * Picks a voice matching `language` when one is installed; Assamese voices
 * are rare even on devices with Hindi support, so when no matching voice
 * exists this stays silent rather than speaking the line in the wrong
 * language — the on-screen text is the fallback (spec: "Audio is
 * unavailable on this device. You can read the instruction below.").
 *
 * `rate` defaults to the normal 1.0 speaking rate — pass {@link GAME_SPEECH_RATE}
 * from game code only. This is a shared utility also used outside games
 * (reminders, the AI companion, family-message readback), which must keep
 * their normal pace.
 */
export function speak(text: string, language: UILanguage = 'en', rate = 1): void {
  if (typeof window === 'undefined' || !window.speechSynthesis) return;

  claimChannel();

  const tag = LANG_TAG[language];
  const voices = window.speechSynthesis.getVoices();
  const voice = voices.find((v) => v.lang.toLowerCase().startsWith(tag));

  if (!voice && language !== 'en') return;

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = rate;
  if (voice) {
    utterance.voice = voice;
    utterance.lang = voice.lang;
  }
  window.speechSynthesis.speak(utterance);
}
