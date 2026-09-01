const LANGUAGE_LOCALE: Record<string, string> = { as: 'as-IN', hi: 'hi-IN', en: 'en-IN' };

function speakFallback(fallbackText: string | undefined, language: string | undefined): void {
  if (typeof window === 'undefined' || !window.speechSynthesis) {
    console.warn('SMRITI: SpeechSynthesis unavailable, cannot play reminder audio');
    return;
  }
  if (!fallbackText) return;

  const utterance = new SpeechSynthesisUtterance(fallbackText);
  utterance.lang = LANGUAGE_LOCALE[language ?? 'en'] ?? 'en-IN';
  window.speechSynthesis.speak(utterance);
}

/**
 * Plays a recorded prompt when one exists; falls back to on-device speech
 * synthesis whenever the source is missing or fails to load/play. Never
 * throws — a reminder audio failure must not block the reminder itself.
 */
export function playAudio(src: string, fallbackText?: string, language?: string): void {
  if (!src) {
    speakFallback(fallbackText, language);
    return;
  }

  try {
    const audio = new Audio(src);
    audio.addEventListener('error', () => speakFallback(fallbackText, language));
    const playResult = audio.play();
    if (playResult && typeof playResult.catch === 'function') {
      playResult.catch(() => speakFallback(fallbackText, language));
    }
  } catch {
    speakFallback(fallbackText, language);
  }
}
