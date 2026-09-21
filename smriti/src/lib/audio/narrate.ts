import { speak } from './speech';
import { playBase64Audio } from './player';
import { claimChannel, isCurrent } from './channel';
import { ensureBundledManifest, findBundledAudio, isBundledManifestLoaded, playBundled } from './bundled';
import { findCachedSpeech, cacheSpeech } from '@/lib/ai/speech-cache';
import { getDeviceTrustToken } from '@/lib/auth/deviceTrust';
import { NO_SPEECH_SERVICE_LANGUAGES, type UILanguage } from '@/lib/i18n/languages';

/** Bounds the whole /api/ai/speak round trip client-side, independent of the
 * server's own 20s Bhashini timeout — defense in depth against a hung
 * connection to this app's own server (cold start, platform hiccup), not
 * just a hung upstream provider. */
const SPEAK_FETCH_TIMEOUT_MS = 25_000;

/**
 * Speaks a line aloud. Playback order, first hit wins:
 *   1. audio bundled with the app (public/audio, see bundled.ts)
 *   2. the on-device Dexie speech cache
 *   3. live Bhashini TTS via /api/ai/speak (online only), cached on success
 *   4. the browser's Web Speech voice through `speak()` (silent for Assamese
 *      and most other regional languages on most devices)
 *   5. silence — the caller's on-screen text is the last fallback.
 * Never throws, mirroring every other audio path in this app. No tier ever
 * substitutes another language's audio.
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

  // Tier 1: audio bundled with the app. Offline-safe, no quota, no network.
  // A clip that will not play (missing file, decode error) falls through.
  // Awaited only on the first line of a session; afterwards this adds no tick.
  if (!isBundledManifestLoaded()) await ensureBundledManifest();
  if (!isCurrent(token)) return;
  const bundledUrl = findBundledAudio(language, text);
  if (bundledUrl && (await playBundled(bundledUrl, token, rate))) return;
  if (!isCurrent(token)) return;

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
  // Same for a language with no Bhashini voice at all: the request could only fail.
  if (!isOnline || NO_SPEECH_SERVICE_LANGUAGES.includes(language)) {
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
