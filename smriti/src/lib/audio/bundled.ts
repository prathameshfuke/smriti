import type { UILanguage } from '@/lib/i18n/languages';
import { isCurrent, playOnChannel } from './channel';
import { promptHash } from './promptHash';

/**
 * Pre-synthesized audio shipped inside the app (public/audio/<lang>/<id>.<ext>,
 * indexed by public/audio/manifest.json). It is the first tier of every
 * spoken line, ahead of the on-device cache, live Bhashini and the browser
 * voice, because it works offline on the first launch with no quota.
 *
 * Lookup is by (language, text hash), not by prompt id: callers keep passing
 * the string they already speak, so no call site had to change, and a line
 * whose wording differs from what was synthesized simply misses and drops to
 * the next tier instead of playing stale audio.
 *
 * The manifest is a dynamic `import()` of the JSON, so it ships as its own
 * precached JS chunk: it is available offline with no fetch (and no extra
 * request for tests that assert on `fetch`), and stays out of the main bundle.
 *
 * No cross-language fallback, ever: only the requested language's bucket is
 * searched. A Bodo line with no Bodo clip is not played with Hindi audio.
 */

export interface BundledManifest {
  version: number;
  languages: Record<string, Record<string, { h: string; ext: string }>>;
}

const AUDIO_BASE = '/audio';

let index: Map<string, string> | null = null;
let loading: Promise<void> | null = null;
/** Clips that failed to load or play this session. Skipped by lookups so a
 * broken file is tried once, not on every repeat and not again by the
 * `speak()` fallback after `narrate()` already saw it fail. */
const failed = new Set<string>();

function buildIndex(manifest: BundledManifest): Map<string, string> {
  const map = new Map<string, string>();
  for (const [lang, entries] of Object.entries(manifest.languages ?? {})) {
    for (const [id, entry] of Object.entries(entries)) {
      map.set(`${lang}:${entry.h}`, `${AUDIO_BASE}/${lang}/${id}.${entry.ext}`);
    }
  }
  return map;
}

export function isBundledManifestLoaded(): boolean {
  return index !== null;
}

/** Loads the manifest once. Never rejects: a failed load just means no
 * bundled tier, and every line falls through to the next one. */
export function ensureBundledManifest(): Promise<void> {
  if (index) return Promise.resolve();
  loading ??= import('../../../public/audio/manifest.json')
    .then((mod) => {
      index = buildIndex((mod.default ?? mod) as BundledManifest);
    })
    .catch(() => {
      index = new Map();
    });
  return loading;
}

/** Test seam: install a manifest without touching the real chunk. */
export function __setBundledManifestForTests(manifest: BundledManifest | null): void {
  index = manifest ? buildIndex(manifest) : null;
  loading = null;
  failed.clear();
}

/** URL of the bundled clip for exactly this language and text, else null.
 * Synchronous; returns null until `ensureBundledManifest()` has resolved. */
export function findBundledAudio(language: UILanguage, text: string): string | null {
  if (!index || !text) return null;
  const url = index.get(`${language}:${promptHash(text)}`) ?? null;
  return url && !failed.has(url) ? url : null;
}

/**
 * Plays a bundled clip on the shared channel. Resolves true once playback
 * started (or the line was overtaken and dropped on purpose), false when the
 * file is missing, undecodable or blocked, so the caller can try the next tier
 * instead of going silent.
 */
export function playBundled(url: string, token: number, rate = 1): Promise<boolean> {
  return new Promise<boolean>((resolveRaw) => {
    const resolve = (ok: boolean, permanent = false) => {
      // Only a file that is missing or undecodable is remembered as broken.
      // An autoplay block (NotAllowedError) is transient: the next line,
      // after a tap, must still be allowed to try this clip.
      if (!ok && permanent) failed.add(url);
      resolveRaw(ok);
    };
    try {
      const audio = new Audio(url);
      if (rate !== 1) audio.playbackRate = rate;
      audio.addEventListener('error', () => resolve(false, true), { once: true });
      playOnChannel(audio, token).then(
        () => resolve(true),
        (err: unknown) => {
          if (!isCurrent(token)) return resolve(true);
          resolve(false, (err as { name?: string } | null)?.name === 'NotSupportedError');
        },
      );
    } catch {
      resolve(false);
    }
  });
}
