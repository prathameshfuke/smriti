import { describe, it, expect } from 'vitest';
import { toContentPack, pickObjects, packPoolSize } from '@/lib/engine/objects';

describe('toContentPack', () => {
  it('accepts the two known packs', () => {
    expect(toContentPack('festival')).toBe('festival');
    expect(toContentPack('market')).toBe('market');
  });

  it('falls back to undefined (the general pool) for anything else', () => {
    expect(toContentPack('garbage')).toBeUndefined();
    expect(toContentPack('')).toBeUndefined();
    expect(toContentPack(null)).toBeUndefined();
    expect(toContentPack(undefined)).toBeUndefined();
  });
});

describe('pickObjects with a pack', () => {
  it('never returns fewer than 0 or crashes for an unknown pack — draws from the general pool instead', () => {
    // Simulates what a malformed `?pack=` URL param resolves to after toContentPack.
    const picked = pickObjects(3, [], toContentPack('garbage'));
    expect(picked.length).toBe(3);
  });

  it('festival pack has at least the 6 objects Part 2 asked for', () => {
    expect(packPoolSize('festival')).toBeGreaterThanOrEqual(6);
  });

  it('market pack has enough objects for the highest Word Stream grid (12)', () => {
    expect(packPoolSize('market')).toBeGreaterThanOrEqual(12);
  });
});
