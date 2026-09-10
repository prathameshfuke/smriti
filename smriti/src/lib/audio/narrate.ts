import { speak } from './speech';
import { playBase64Audio } from './player';
import { findCachedSpeech, cacheSpeech } from '@/lib/ai/speech-cache';
import { getDeviceTrustToken } from '@/lib/auth/deviceTrust';
import type { UILanguage } from '@/lib/i18n/languages';

/**
 * Speaks a line of dynamic text aloud — a companion answer, a reminder
 * label — via Bhashini TTS, cached locally so a repeated line never re-hits
 * the rate-limited API. Falls back to on-device `speak()` (browser
 * `speechSynthesis`, silent for Assamese on most devices) on any cache
 * miss the API call can't fill: offline, missing key, non-2xx, timeout.
 * Never throws, mirroring every other audio path in this app.
 */
export async function narrate(text: string, language: UILanguage, isOnline: boolean): Promise<void> {
  if (!text) return;

  try {
    const cached = await findCachedSpeech(language, text);
    if (cached) {
      playBase64Audio(cached.audioBase64, cached.audioFormat, text, language);
      return;
    }
  } catch {
    // Dexie unavailable — fall through to a live attempt below.
  }

  // Matches every other network path on this page (see handleTranscript /
  // acquireTranscript): never spend a request — or the rate-limited
  // Bhashini quota — on a call already known to fail.
  if (!isOnline) {
    speak(text, language);
    return;
  }

  try {
    const token = await getDeviceTrustToken();
    const res = await fetch('/api/ai/speak', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, language, deviceTrustToken: token }),
    });
    if (!res.ok) throw new Error('speak route failed');
    const body = await res.json();
    if (typeof body.audioBase64 !== 'string') throw new Error('no audio in response');

    playBase64Audio(body.audioBase64, body.audioFormat, text, language);
    void cacheSpeech({ language, text, audioBase64: body.audioBase64, audioFormat: body.audioFormat });
  } catch {
    speak(text, language);
  }
}
