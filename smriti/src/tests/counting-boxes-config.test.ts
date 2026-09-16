import { describe, it, expect } from 'vitest';
import { LEVEL_CONFIGS } from '@/components/games/counting-boxes/GameComponent';

describe('Counting Boxes LEVEL_CONFIGS observer curve', () => {
  it('has one config per level and valid [min, max] observer ranges', () => {
    expect(LEVEL_CONFIGS.length).toBe(6);
    for (const { observer } of LEVEL_CONFIGS) {
      const [min, max] = observer;
      expect(min).toBeLessThanOrEqual(max);
    }
  });

  it('decreases the observer window monotonically across levels', () => {
    for (let i = 1; i < LEVEL_CONFIGS.length; i++) {
      const [prevMin, prevMax] = LEVEL_CONFIGS[i - 1].observer;
      const [min, max] = LEVEL_CONFIGS[i].observer;
      expect(min).toBeLessThanOrEqual(prevMin);
      expect(max).toBeLessThanOrEqual(prevMax);
    }
  });

  it('never drops the observer max by more than 60% between adjacent levels', () => {
    for (let i = 1; i < LEVEL_CONFIGS.length; i++) {
      const prevMax = LEVEL_CONFIGS[i - 1].observer[1];
      const max = LEVEL_CONFIGS[i].observer[1];
      const drop = (prevMax - max) / prevMax;
      expect(drop).toBeLessThan(0.6);
    }
  });

  it('tapers from roughly 3000ms at level 1 to roughly 500ms at level 6', () => {
    const [, firstMax] = LEVEL_CONFIGS[0].observer;
    const [lastMin] = LEVEL_CONFIGS[LEVEL_CONFIGS.length - 1].observer;
    expect(firstMax).toBeGreaterThanOrEqual(2500);
    expect(lastMin).toBeLessThanOrEqual(600);
  });
});
