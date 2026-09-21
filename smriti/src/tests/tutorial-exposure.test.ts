import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TUTORIAL_AUTO_SHOW_LIMIT, claimAutoTutorial, tutorialShownCount } from '@/lib/games/tutorialExposure';

describe('claimAutoTutorial', () => {
  beforeEach(() => window.localStorage.clear());

  it('opens on each of the first 7 visits, then never again', () => {
    const results = Array.from({ length: 10 }, () => claimAutoTutorial('p1', 'quick_tap'));
    expect(results).toEqual([true, true, true, true, true, true, true, false, false, false]);
    expect(TUTORIAL_AUTO_SHOW_LIMIT).toBe(7);
  });

  it('counts each patient and each game separately', () => {
    for (let i = 0; i < 7; i += 1) claimAutoTutorial('p1', 'quick_tap');
    expect(claimAutoTutorial('p1', 'quick_tap')).toBe(false);
    expect(claimAutoTutorial('p2', 'quick_tap')).toBe(true);
    expect(claimAutoTutorial('p1', 'path_match')).toBe(true);
    expect(tutorialShownCount('p2', 'quick_tap')).toBe(1);
  });

  it('never opens without a patient', () => {
    expect(claimAutoTutorial(null, 'quick_tap')).toBe(false);
    expect(claimAutoTutorial(undefined, 'quick_tap')).toBe(false);
  });

  it('treats a garbled stored count as none seen', () => {
    window.localStorage.setItem('smriti.tutorialShown.p1.quick_tap', 'abc');
    expect(claimAutoTutorial('p1', 'quick_tap')).toBe(true);
    expect(tutorialShownCount('p1', 'quick_tap')).toBe(1);
  });

  it('stays closed when storage is blocked', () => {
    const spy = vi.spyOn(window.localStorage, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    try {
      expect(claimAutoTutorial('p1', 'quick_tap')).toBe(false);
    } finally {
      spy.mockRestore();
    }
  });
});
