import { speak } from './speech';
import { playBase64Audio } from './player';
import { claimChannel, isCurrent } from './channel';
import { findCachedSpeech, cacheSpeech } from '@/lib/ai/speech-cache';
import { getDeviceTrustToken } from '@/lib/auth/deviceTrust';
import type { UILanguage } from '@/lib/i18n/languages';

/** Bounds the whole /api/ai/speak round trip client-side, independent of the
 * server's own 20s Bhashini timeout — defense in depth against a hung
 * connection to this app's own server (cold start, platform hiccup), not
 * just a hung upstream provider. */
const SPEAK_FETCH_TIMEOUT_MS = 25_000;

/**
 * Speaks a line of dynamic text aloud — a companion answer, a reminder
 * label — via Bhashini TTS, cached locally so a repeated line never re-hits
 * the rate-limited API. Falls back to on-device `speak()` (browser
 * `speechSynthesis`, silent for Assamese on most devices) on any cache
 * miss the API call can't fill: offline, missing key, non-2xx, timeout.
 * Never throws, mirroring every other audio path in this app.
 *
 * `rate` defaults to the normal 1.0 rate — pass {@link GAME_SPEECH_RATE}
 * from game code only. This function is also used outside games (the AI
 * companion, reminder labels), which must keep their normal pace.
 */
export async function narrate(text: string, language: UILanguage, isOnline: boolean, rate = 1): Promise<void> {
  if (!text) return;
  // Claimed before any await: a line requested later wins, and this one is
  // dropped if it is overtaken while its audio is still being looked up.
  const token = claimChannel();

  try {
    const cached = await findCachedSpeech(language, text);
    if (!isCurrent(token)) return;
    if (cached) {
      playBase64Audio(cached.audioBase64, cached.audioFormat, text, language, token, rate);
      return;
    }
  } catch {
    // Dexie unavailable — fall through to a live attempt below.
  }

  // Matches every other network path on this page (see handleTranscript /
  // acquireTranscript): never spend a request — or the rate-limited
  // Bhashini quota — on a call already known to fail.
  if (!isOnline) {
    if (isCurrent(token)) speak(text, language, rate);
    return;
  }

  try {
    const trustToken = await getDeviceTrustToken();
    const res = await fetch('/api/ai/speak', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, language, deviceTrustToken: trustToken }),
      signal: AbortSignal.timeout(SPEAK_FETCH_TIMEOUT_MS),
    });
    if (!res.ok) throw new Error('speak route failed');
    const body = await res.json();
    if (typeof body.audioBase64 !== 'string') throw new Error('no audio in response');

    // Cached even when overtaken, so the next time this line is asked for it plays at once.
    void cacheSpeech({ language, text, audioBase64: body.audioBase64, audioFormat: body.audioFormat });
    playBase64Audio(body.audioBase64, body.audioFormat, text, language, token, rate);
  } catch {
    if (isCurrent(token)) speak(text, language, rate);
  }
}
