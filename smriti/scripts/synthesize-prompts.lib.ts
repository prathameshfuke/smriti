/**
 * Pure helpers for scripts/synthesize-prompts.ts, split out so they can be
 * unit-tested without network, credentials or a filesystem.
 */
import type { ExpectedEntry } from '../src/lib/audio/prompts';

export interface ManifestEntry {
  /** Hash of the normalized source text this clip was made from. */
  h: string;
  /** File extension actually written (wav, mp3, m4a, ...). */
  ext: string;
}

export interface Manifest {
  version: 1;
  languages: Record<string, Record<string, ManifestEntry>>;
}

export const EMPTY_MANIFEST: Manifest = { version: 1, languages: {} };

export type WorkReason = 'new' | 'stale' | 'forced' | 'file-missing';

export interface WorkItem {
  entry: ExpectedEntry;
  reason: WorkReason;
}

export interface WorkPlan {
  todo: WorkItem[];
  /** Already synthesized, text unchanged, file present: skipped (resume). */
  upToDate: ExpectedEntry[];
  /** In the manifest but no longer expected (prompt removed or its text is
   * gone from that language): the clip should be deleted, not shipped. */
  orphans: { lang: string; id: string; ext: string }[];
}

export interface PlanOptions {
  force?: boolean;
  /** Restrict to these languages. */
  langs?: readonly string[];
  /** Restrict to ids containing this substring. */
  only?: string;
}

/**
 * Decides what to synthesize. Skip-existing / resume is the default: an entry
 * whose hash matches the manifest and whose file is on disk costs nothing.
 * A changed source string changes the hash, so it is regenerated.
 */
export function planWork(
  expected: readonly ExpectedEntry[],
  manifest: Manifest,
  fileExists: (lang: string, id: string, ext: string) => boolean,
  options: PlanOptions = {},
): WorkPlan {
  const inScope = (lang: string, id: string) =>
    (!options.langs || options.langs.includes(lang)) && (!options.only || id.includes(options.only));

  const todo: WorkItem[] = [];
  const upToDate: ExpectedEntry[] = [];
  const expectedKeys = new Set<string>();

  for (const entry of expected) {
    expectedKeys.add(`${entry.lang}/${entry.id}`);
    if (!inScope(entry.lang, entry.id)) continue;
    const existing = manifest.languages[entry.lang]?.[entry.id];
    if (options.force) todo.push({ entry, reason: 'forced' });
    else if (!existing) todo.push({ entry, reason: 'new' });
    else if (existing.h !== entry.hash) todo.push({ entry, reason: 'stale' });
    else if (!fileExists(entry.lang, entry.id, existing.ext)) todo.push({ entry, reason: 'file-missing' });
    else upToDate.push(entry);
  }

  const orphans: WorkPlan['orphans'] = [];
  for (const [lang, entries] of Object.entries(manifest.languages)) {
    for (const [id, e] of Object.entries(entries)) {
      if (!expectedKeys.has(`${lang}/${id}`) && inScope(lang, id)) orphans.push({ lang, id, ext: e.ext });
    }
  }
  return { todo, upToDate, orphans };
}

export type AudioKind = 'wav' | 'mp3' | 'ogg' | 'm4a' | 'flac' | 'unknown';

export function sniffAudio(buf: Uint8Array): AudioKind {
  const ascii = (from: number, to: number) => String.fromCharCode(...buf.subarray(from, to));
  if (buf.length >= 12 && ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WAVE') return 'wav';
  if (buf.length >= 4 && ascii(0, 4) === 'OggS') return 'ogg';
  if (buf.length >= 4 && ascii(0, 4) === 'fLaC') return 'flac';
  if (buf.length >= 8 && ascii(4, 8) === 'ftyp') return 'm4a';
  if (buf.length >= 3 && ascii(0, 3) === 'ID3') return 'mp3';
  if (buf.length >= 2 && buf[0] === 0xff && (buf[1] & 0xe0) === 0xe0) return 'mp3';
  return 'unknown';
}

export interface AudioCheck {
  ok: boolean;
  kind: AudioKind;
  reason?: string;
  durationSec?: number;
}

/** Duration and silence check for 16-bit PCM WAV; other containers are only
 * sniffed (a decoder would be needed to go further). */
export function checkWav(buf: Uint8Array): AudioCheck {
  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  let offset = 12;
  let channels = 1;
  let sampleRate = 0;
  let bits = 16;
  let format = 1;
  let dataStart = -1;
  let dataLen = 0;
  while (offset + 8 <= buf.length) {
    const id = String.fromCharCode(buf[offset], buf[offset + 1], buf[offset + 2], buf[offset + 3]);
    const size = view.getUint32(offset + 4, true);
    if (id === 'fmt ') {
      format = view.getUint16(offset + 8, true);
      channels = view.getUint16(offset + 10, true);
      sampleRate = view.getUint32(offset + 12, true);
      bits = view.getUint16(offset + 22, true);
    } else if (id === 'data') {
      dataStart = offset + 8;
      // Streamed WAVs may carry a 0 or 0xFFFFFFFF length; trust the buffer then.
      dataLen = size === 0 || size === 0xffffffff || dataStart + size > buf.length ? buf.length - dataStart : size;
      break;
    }
    offset += 8 + size + (size % 2);
  }
  if (dataStart < 0 || !sampleRate) return { ok: false, kind: 'wav', reason: 'wav has no fmt/data chunk' };
  const bytesPerFrame = (bits / 8) * channels;
  const durationSec = dataLen / bytesPerFrame / sampleRate;
  if (durationSec < 0.2) return { ok: false, kind: 'wav', reason: `too short (${durationSec.toFixed(2)}s)`, durationSec };
  if (format === 1 && bits === 16) {
    let peak = 0;
    const step = Math.max(1, Math.floor(dataLen / 2 / 20000)) * 2;
    for (let i = dataStart; i + 1 < dataStart + dataLen; i += step) {
      peak = Math.max(peak, Math.abs(view.getInt16(i, true)));
    }
    if (peak < 200) return { ok: false, kind: 'wav', reason: 'audio is silent', durationSec };
  }
  return { ok: true, kind: 'wav', durationSec };
}

export function validateAudio(buf: Uint8Array): AudioCheck {
  if (buf.length < 200) return { ok: false, kind: 'unknown', reason: `only ${buf.length} bytes` };
  const kind = sniffAudio(buf);
  if (kind === 'unknown') return { ok: false, kind, reason: 'not a recognized audio container' };
  if (kind === 'wav') return checkWav(buf);
  return { ok: true, kind };
}

export function decodeBase64(b64: string): Uint8Array {
  return new Uint8Array(Buffer.from(b64, 'base64'));
}

export function addToManifest(manifest: Manifest, lang: string, id: string, entry: ManifestEntry): Manifest {
  const languages = { ...manifest.languages, [lang]: { ...(manifest.languages[lang] ?? {}), [id]: entry } };
  return { version: 1, languages };
}

export function removeFromManifest(manifest: Manifest, lang: string, id: string): Manifest {
  const bucket = { ...(manifest.languages[lang] ?? {}) };
  delete bucket[id];
  const languages = { ...manifest.languages };
  if (Object.keys(bucket).length === 0) delete languages[lang];
  else languages[lang] = bucket;
  return { version: 1, languages };
}

/** Deterministic key order so re-running the script yields a clean git diff. */
export function serializeManifest(manifest: Manifest): string {
  const languages: Manifest['languages'] = {};
  for (const lang of Object.keys(manifest.languages).sort()) {
    languages[lang] = {};
    for (const id of Object.keys(manifest.languages[lang]).sort()) languages[lang][id] = manifest.languages[lang][id];
  }
  return JSON.stringify({ version: 1, languages }, null, 1) + '\n';
}
