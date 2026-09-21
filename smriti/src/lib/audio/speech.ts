import type { UILanguage } from '@/lib/i18n/languages';
import { claimChannel, isCurrent } from './channel';
import { ensureBundledManifest, findBundledAudio, playBundled } from './bundled';

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
  // No device voice exists for either; a missing voice means silence, never another language.
  kha: 'kha',
  lus: 'lus',
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

  const token = claimChannel();

  // A fixed game line (feedback, instruction) may ship as a bundled clip.
  // The manifest loads in the background on first use, so the very first
  // line of a session can still miss and use the voice; every later one hits.
  void ensureBundledManifest();
  const bundledUrl = findBundledAudio(language, text);
  if (bundledUrl) {
    void playBundled(bundledUrl, token, rate).then((played) => {
      if (!played && isCurrent(token)) speakWithVoice(text, language, rate);
    });
    return;
  }

  speakWithVoice(text, language, rate);
}

/** How long to wait for a browser to fill in its voice list before giving up. */
const VOICE_WAIT_MS = 2000;

let pendingVoiceWait: (() => void) | null = null;

/** Test seam: drops any wait left over from a previous case. */
export function resetVoiceWait(): void {
  pendingVoiceWait?.();
  pendingVoiceWait = null;
}

function voiceFor(tag: string): SpeechSynthesisVoice | undefined {
  return window.speechSynthesis.getVoices().find((v) => v.lang.toLowerCase().startsWith(tag));
}

function utter(text: string, voice: SpeechSynthesisVoice | undefined, rate: number): void {
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = rate;
  if (voice) {
    utterance.voice = voice;
    utterance.lang = voice.lang;
  }
  window.speechSynthesis.speak(utterance);
}

/** The Web Speech tier: silent when no installed voice matches a non-English
 * language, rather than reading the line in the wrong one. */
function speakWithVoice(text: string, language: UILanguage, rate: number): void {
  if (typeof window === 'undefined' || !window.speechSynthesis) return;

  const tag = LANG_TAG[language];
  const voice = voiceFor(tag);
  if (voice || language === 'en') {
    // English falls through with no voice: the browser default is already
    // an English one, and a line should never wait when it need not.
    utter(text, voice, rate);
    return;
  }

  // Chrome and most Android browsers fill `getVoices()` asynchronously, so
  // the first call on a fresh page sees an empty list. Treating that as "no
  // voice installed" silenced every non-English line until something else
  // happened to trigger a second call — read on the device as the app simply
  // not speaking Hindi or Assamese at all. Wait for the list once, briefly,
  // and speak when it lands.
  const synth = window.speechSynthesis;
  // Older engines (and test doubles) expose only the `onvoiceschanged`
  // property, or neither; with no way to be told, staying silent is the same
  // honest "no voice installed" behaviour as before.
  if (typeof synth.addEventListener !== 'function') return;

  resetVoiceWait();
  let settled = false;
  const finish = (speakNow: boolean) => {
    if (settled) return;
    settled = true;
    synth.removeEventListener('voiceschanged', onVoices);
    clearTimeout(timer);
    pendingVoiceWait = null;
    if (speakNow) {
      const found = voiceFor(tag);
      if (found) utter(text, found, rate);
    }
  };
  function onVoices() {
    finish(true);
  }
  const timer = setTimeout(() => finish(false), VOICE_WAIT_MS);
  pendingVoiceWait = () => finish(false);
  synth.addEventListener('voiceschanged', onVoices);
}
