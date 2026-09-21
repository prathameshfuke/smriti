import { describe, expect, it } from 'vitest';
import en from '@/lib/i18n/locales/en.json';
import {
  DRIFT_THRESHOLD, MAX_CHUNK_CHARS, buildSheet, check, chunkKeys, flatten, normalizeLine, roundTripSimilarity,
  repairPlaceholders, selectKeys, splitOutput, toPasteLine, unflatten,
} from '../../scripts/paste-translate.lib';

const flat = flatten(en);

describe('what gets drafted', () => {
  const keys = selectKeys(flat);

  it('leaves out every piece of safety wording', () => {
    for (const k of keys) {
      expect(k).not.toMatch(/^(reminder\.|reminders\.|reminderType\.|pin\.|home\.pin|home\.forgotPin|companion\.|disclaimer|login\.|push\.|alertPush\.|alertOptIn\.|caregiver\.|lang\.)/);
    }
    expect(keys).not.toContain('reminder.medication');
    expect(keys).not.toContain('companion.distress');
    expect(keys).toContain('game.objectHunt.instruction');
  });

  it('splits into chunks the Google box accepts, without losing or reordering a key', () => {
    const chunks = chunkKeys(keys, flat);
    expect(chunks.flat()).toEqual(keys);
    for (const c of chunks) expect(c.map((k) => toPasteLine(flat[k])).join('\n').length).toBeLessThanOrEqual(MAX_CHUNK_CHARS);
    expect(chunks.length).toBeGreaterThanOrEqual(1);
    // A small limit forces real splitting, still in order and complete.
    const small = chunkKeys(keys, flat, 600);
    expect(small.length).toBeGreaterThan(3);
    expect(small.flat()).toEqual(keys);
  });

  it('flatten and unflatten round-trip', () => {
    expect(unflatten(flatten(en))).toEqual(en);
  });
});

describe('cleaning pasted lines', () => {
  it('restores re-spaced placeholders and straight quotes', () => {
    expect(normalizeLine('  { count } of {total } found ')).toBe('{count} of {total} found');
    expect(normalizeLine('It’s “done”')).toBe('It\'s "done"');
  });

  it('drops blank lines and Windows line endings', () => {
    expect(splitOutput('one\r\n\r\ntwo\n')).toEqual(['one', 'two']);
  });

  it('keeps a multi-line string on one paste line', () => {
    expect(toPasteLine('a\n  b')).toBe('a b');
  });
});

describe('mechanical checks', () => {
  const src = 'Remember where each picture is hidden.';

  it('passes ordinary text', () => {
    expect(check(src, 'Kynmaw haei ka dur kaba don hangne.')).toBe('ok');
  });

  it('catches every kind of visible damage', () => {
    expect(check(src, '')).toBe('empty');
    expect(check(src, src)).toBe('unchanged');
    expect(check('{count} of {total}', '{count} na')).toBe('placeholders');
    expect(check('Choose a game', 'Game অমা thlang la')).toBe('wrong-script');
    expect(check(src, 'fakin fakin fakin fakin fakin fakin fakin fakin')).toBe('repeats');
    expect(check('Good morning, your medicine is due today', 'Good morning, your medicine is due')).toBe('mostly-english');
  });
});

describe('round trip', () => {
  it('scores a faithful round trip high and a drifted one low', () => {
    expect(roundTripSimilarity('Where was the key?', 'Where was the key?')).toBe(1);
    expect(roundTripSimilarity('Choose who uses this phone', 'This phone is used by women')).toBeLessThan(DRIFT_THRESHOLD);
    expect(roundTripSimilarity('', 'x')).toBe(0);
  });
});

describe('review sheet', () => {
  it('shows every row, flags drift, and escapes pipes', () => {
    const sheet = buildSheet('Khasi', 'kha', [
      { key: 'a', english: 'A | B', draft: 'x | y', verdict: 'ok', similarity: 0.9 },
      { key: 'b', english: 'Choose', draft: 'Jied', verdict: 'ok', similarity: 0.1 },
      { key: 'c', english: 'Correct!', draft: 'Correct!', verdict: 'unchanged', similarity: null },
    ], ['reminder.medication']);
    expect(sheet).toContain('No native speaker has checked any line');
    expect(sheet).toContain('A \\| B');
    expect(sheet).toContain('ok (drifted)');
    expect(sheet).toContain('| `c` | Correct! | Correct! | unchanged |');
    expect(sheet).toContain('meaning may have drifted on 1');
  });
});

describe('translated placeholders', () => {
  const aliases = { kyrteng: 'name', baroh: 'total', khein: 'count' };

  it('puts back placeholder words Google translated', () => {
    expect(repairPlaceholders('Not {name}?', 'Bad {kyrteng}?', aliases)).toBe('Bad {name}?');
    expect(repairPlaceholders('{count} of {total}', '{khein} na ka {baroh}', aliases)).toBe('{count} na ka {total}');
    expect(repairPlaceholders('Picture {n} of {total}', 'Ka dur {n} jong ka {baroh}', aliases)).toBe('Ka dur {n} jong ka {total}');
  });

  it('leaves a line alone when it cannot be repaired exactly', () => {
    // Unknown word: not in the map, so the placeholder set stays wrong and the check flags it.
    expect(repairPlaceholders('Not {name}?', 'Bad {xyz}?', aliases)).toBe('Bad {xyz}?');
    // A placeholder missing altogether.
    expect(repairPlaceholders('{count} of {total}', '{khein} na', aliases)).toBe('{khein} na');
    // Already right: untouched.
    expect(repairPlaceholders('Not {name}?', 'Bad {name}?', aliases)).toBe('Bad {name}?');
  });
});
