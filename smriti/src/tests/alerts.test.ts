import { describe, it, expect } from 'vitest';
import { detectLowAdherence, detectMissedSessions } from '@/lib/engine/alerts';

describe('detectMissedSessions', () => {
  it('returns true when the 3 days before referenceDate have no summary', () => {
    const reference = new Date('2026-09-08T12:00:00.000Z');
    expect(detectMissedSessions([], reference)).toBe(true);
    expect(detectMissedSessions(['2026-08-20'], reference)).toBe(true);
  });

  it('returns false when any of the 3 preceding days has a summary', () => {
    const reference = new Date('2026-09-08T12:00:00.000Z');
    expect(detectMissedSessions(['2026-09-06'], reference)).toBe(false);
    expect(detectMissedSessions(['2026-09-05'], reference)).toBe(false);
  });

  it('ignores today itself — only the 3 prior days count', () => {
    const reference = new Date('2026-09-08T12:00:00.000Z');
    expect(detectMissedSessions(['2026-09-08'], reference)).toBe(true);
  });
});

describe('detectLowAdherence', () => {
  it('returns true below the 50% threshold', () => {
    expect(detectLowAdherence(49)).toBe(true);
    expect(detectLowAdherence(0)).toBe(true);
  });

  it('returns false at or above the 50% threshold', () => {
    expect(detectLowAdherence(50)).toBe(false);
    expect(detectLowAdherence(100)).toBe(false);
  });
});
