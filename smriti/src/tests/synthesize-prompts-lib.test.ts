import { describe, it, expect } from 'vitest';
import {
  planWork,
  validateAudio,
  sniffAudio,
  addToManifest,
  removeFromManifest,
  serializeManifest,
  EMPTY_MANIFEST,
  type Manifest,
} from '../../scripts/synthesize-prompts.lib';
import type { ExpectedEntry } from '@/lib/audio/prompts';

const entry = (lang: string, id: string, hash: string): ExpectedEntry => ({
  lang: lang as ExpectedEntry['lang'],
  id,
  group: 'g',
  text: `${lang}-${id}`,
  hash,
});

function wav(seconds: number, amplitude: number, rate = 8000): Uint8Array {
  const n = Math.floor(seconds * rate);
  const buf = new Uint8Array(44 + n * 2);
  const v = new DataView(buf.buffer);
  buf.set([0x52, 0x49, 0x46, 0x46], 0);
  v.setUint32(4, 36 + n * 2, true);
  buf.set([0x57, 0x41, 0x56, 0x45, 0x66, 0x6d, 0x74, 0x20], 8);
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, 1, true);
  v.setUint32(24, rate, true);
  v.setUint32(28, rate * 2, true);
  v.setUint16(32, 2, true);
  v.setUint16(34, 16, true);
  buf.set([0x64, 0x61, 0x74, 0x61], 36);
  v.setUint32(40, n * 2, true);
  for (let i = 0; i < n; i++) v.setInt16(44 + i * 2, Math.round(Math.sin(i / 5) * amplitude), true);
  return buf;
}

describe('planWork: skip-existing / resume / change detection', () => {
  const have = () => true;
  const manifest: Manifest = { version: 1, languages: { hi: { a: { h: 'H1', ext: 'm4a' } } } };

  it('skips clips whose hash matches and file exists (resume after an interrupted run)', () => {
    const plan = planWork([entry('hi', 'a', 'H1')], manifest, have);
    expect(plan.todo).toHaveLength(0);
    expect(plan.upToDate).toHaveLength(1);
  });

  it('regenerates when the source text changed (hash differs)', () => {
    const plan = planWork([entry('hi', 'a', 'H2')], manifest, have);
    expect(plan.todo).toEqual([{ entry: entry('hi', 'a', 'H2'), reason: 'stale' }]);
  });

  it('regenerates when the manifest lists a file that is not on disk', () => {
    const plan = planWork([entry('hi', 'a', 'H1')], manifest, () => false);
    expect(plan.todo[0].reason).toBe('file-missing');
  });

  it('new entries are todo; --force redoes everything', () => {
    expect(planWork([entry('as', 'b', 'X')], manifest, have).todo[0].reason).toBe('new');
    expect(planWork([entry('hi', 'a', 'H1')], manifest, have, { force: true }).todo[0].reason).toBe('forced');
  });

  it('flags manifest entries that are no longer expected as orphans', () => {
    const plan = planWork([], manifest, have);
    expect(plan.orphans).toEqual([{ lang: 'hi', id: 'a', ext: 'm4a' }]);
  });

  it('honours --lang and --only filters without orphaning out-of-scope clips', () => {
    const plan = planWork([entry('as', 'b', 'X'), entry('hi', 'c', 'Y')], manifest, have, { langs: ['as'] });
    expect(plan.todo.map((w) => w.entry.id)).toEqual(['b']);
    expect(plan.orphans).toEqual([]);
    const only = planWork([entry('as', 'b', 'X'), entry('as', 'zzz', 'Y')], EMPTY_MANIFEST, have, { only: 'zz' });
    expect(only.todo.map((w) => w.entry.id)).toEqual(['zzz']);
  });
});

describe('validateAudio', () => {
  it('accepts a real, audible WAV', () => {
    const r = validateAudio(wav(0.5, 8000));
    expect(r.ok).toBe(true);
    expect(r.durationSec).toBeCloseTo(0.5, 1);
  });

  it('rejects empty, tiny, silent, too-short and non-audio payloads', () => {
    expect(validateAudio(new Uint8Array(0)).ok).toBe(false);
    expect(validateAudio(new Uint8Array(500)).ok).toBe(false);
    expect(validateAudio(wav(0.5, 0)).reason).toMatch(/silent/);
    expect(validateAudio(wav(0.05, 8000)).reason).toMatch(/short/);
    expect(validateAudio(new TextEncoder().encode('{"error":"nope"}'.repeat(30))).ok).toBe(false);
  });

  it('recognizes other containers', () => {
    const m4a = new Uint8Array(400);
    m4a.set([0, 0, 0, 0x20, 0x66, 0x74, 0x79, 0x70], 0);
    expect(sniffAudio(m4a)).toBe('m4a');
    expect(validateAudio(m4a).ok).toBe(true);
    const mp3 = new Uint8Array(400);
    mp3.set([0x49, 0x44, 0x33], 0);
    expect(sniffAudio(mp3)).toBe('mp3');
  });
});

describe('manifest editing', () => {
  it('adds and removes entries immutably and serializes deterministically', () => {
    let m = addToManifest(EMPTY_MANIFEST, 'hi', 'b', { h: '2', ext: 'wav' });
    m = addToManifest(m, 'as', 'a', { h: '1', ext: 'm4a' });
    expect(EMPTY_MANIFEST.languages).toEqual({});
    const text = serializeManifest(m);
    expect(text.indexOf('"as"')).toBeLessThan(text.indexOf('"hi"'));
    m = removeFromManifest(m, 'hi', 'b');
    expect(m.languages.hi).toBeUndefined();
    expect(JSON.parse(serializeManifest(m))).toEqual({ version: 1, languages: { as: { a: { h: '1', ext: 'm4a' } } } });
  });
});
