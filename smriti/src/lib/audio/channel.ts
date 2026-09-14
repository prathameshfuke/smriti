/**
 * One audio channel for the whole app: at most one line is audible at a time.
 *
 * Overlap came from three places. Every recorded or TTS clip was a fresh
 * `new Audio()` that nothing ever stopped. `speak()` cancelled the browser
 * voice but not those clips. And `narrate()` awaits a network TTS call, so an
 * instruction requested first could arrive after a newer line had started
 * and play over it.
 *
 * Every new line calls `claimChannel()`, which silences whatever is playing
 * and returns a token. Async work checks `isCurrent(token)` before starting
 * playback, so a line that has been overtaken is dropped instead of layered.
 */

let generation = 0;
let current: HTMLAudioElement | null = null;

function silence(): void {
  if (current) {
    try {
      current.pause();
    } catch {
      // A detached or never-loaded element can throw on pause; it is silent anyway.
    }
    current = null;
  }
  if (typeof window !== 'undefined' && window.speechSynthesis) {
    window.speechSynthesis.cancel();
  }
}

/** Stops whatever is playing and invalidates any line still being fetched. */
export function stopAllAudio(): void {
  generation += 1;
  silence();
}

/** Starts a new line: silences the channel and returns this line's token. */
export function claimChannel(): number {
  stopAllAudio();
  return generation;
}

/** False once a newer line (or a stop) has claimed the channel. */
export function isCurrent(token: number): boolean {
  return token === generation;
}

/**
 * Plays an element as the channel's only sound. Stops the previous clip and
 * browser voice first; restarts the element if it was already mid-play (a
 * repeated N-Back letter).
 */
export function playOnChannel(audio: HTMLAudioElement, token: number = claimChannel()): Promise<void> {
  if (!isCurrent(token)) return Promise.resolve();
  silence();
  current = audio;
  try {
    audio.currentTime = 0;
  } catch {
    // Not seekable before metadata loads; it starts from 0 anyway.
  }
  audio.addEventListener(
    'ended',
    () => {
      if (current === audio) current = null;
    },
    { once: true },
  );
  const result = audio.play();
  return result && typeof result.then === 'function' ? result : Promise.resolve();
}
