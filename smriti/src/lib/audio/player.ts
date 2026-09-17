import { claimChannel, isCurrent, playOnChannel } from './channel';

const LANGUAGE_LOCALE: Record<string, string> = { as: 'as-IN', hi: 'hi-IN', en: 'en-IN' };

function speakFallback(token: number, fallbackText: string | undefined, language: string | undefined, rate?: number): void {
  // A newer line has started since this one was requested: stay silent.
  if (!isCurrent(token)) return;
  if (typeof window === 'undefined' || !window.speechSynthesis) {
    console.warn('SMRITI: SpeechSynthesis unavailable, cannot play reminder audio');
    return;
  }
  if (!fallbackText) return;

  const utterance = new SpeechSynthesisUtterance(fallbackText);
  utterance.lang = LANGUAGE_LOCALE[language ?? 'en'] ?? 'en-IN';
  if (rate) utterance.rate = rate;
  window.speechSynthesis.speak(utterance);
}

function playSource(src: string, token: number, fallbackText?: string, language?: string, rate?: number): void {
  try {
    const audio = new Audio(src);
    if (rate) audio.playbackRate = rate;
    audio.addEventListener('error', () => speakFallback(token, fallbackText, language, rate));
    playOnChannel(audio, token).catch(() => speakFallback(token, fallbackText, language, rate));
  } catch {
    speakFallback(token, fallbackText, language, rate);
  }
}

/**
 * Plays a recorded prompt when one exists; falls back to on-device speech
 * synthesis whenever the source is missing or fails to load/play. Never
 * throws — a reminder audio failure must not block the reminder itself.
 * Stops anything else playing first (lib/audio/channel.ts).
 */
export function playAudio(src: string, fallbackText?: string, language?: string): void {
  const token = claimChannel();
  if (!src) {
    speakFallback(token, fallbackText, language);
    return;
  }
  playSource(src, token, fallbackText, language);
}

/**
 * Plays base64-encoded audio (Bhashini TTS output, cached or freshly
 * fetched) via a `data:` URI. Same never-throws/fallback contract as
 * `playAudio`. `token` comes from the caller's own `claimChannel()` when the
 * clip was fetched asynchronously, so a clip that has been overtaken by a
 * newer line is dropped rather than played on top of it. `rate` defaults to
 * the normal 1.0 playback rate — pass a slower rate from game code only;
 * this is a shared utility also used outside games (reminders, the AI
 * companion), which must keep their normal pace.
 */
export function playBase64Audio(
  audioBase64: string,
  audioFormat: string,
  fallbackText?: string,
  language?: string,
  token: number = claimChannel(),
  rate = 1,
): void {
  if (!isCurrent(token)) return;
  playSource(`data:audio/${audioFormat};base64,${audioBase64}`, token, fallbackText, language, rate);
}
