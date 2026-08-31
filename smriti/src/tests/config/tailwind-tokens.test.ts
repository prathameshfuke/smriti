import { describe, it, expect } from 'vitest';
import tailwindConfig from '../../../tailwind.config';

/**
 * SMRITI design tokens are a clinical/brand contract, not styling preference.
 * These assertions pin the values so a refactor cannot silently drift them.
 */
describe('tailwind design tokens', () => {
  const colors = tailwindConfig.theme?.extend?.colors as Record<
    string,
    string | Record<string, string>
  >;

  it('defines primary brand gold as #8B6914', () => {
    expect((colors.primary as Record<string, string>).DEFAULT).toBe('#8B6914');
  });

  it('defines the primary light and dark ramp', () => {
    const primary = colors.primary as Record<string, string>;
    expect(primary.light).toBe('#C4A445');
    expect(primary.dark).toBe('#5C4510');
  });

  it('defines the surface palette used by patient screens', () => {
    const surface = colors.surface as Record<string, string>;
    expect(surface.DEFAULT).toBe('#FAF7F2');
    expect(surface.card).toBe('#FFFFFF');
    expect(surface.muted).toBe('#F0EDE6');
  });

  it('defines traffic-light alert colours for the caregiver dashboard', () => {
    expect(colors.success).toBe('#2E7D32');
    expect(colors.warning).toBe('#E65100');
    expect(colors.danger).toBe('#B71C1C');
  });

  it('sizes patient body text at 22px and headings at 36px', () => {
    const fontSize = tailwindConfig.theme?.extend?.fontSize as Record<
      string,
      [string, { lineHeight: string }]
    >;
    // 1.375rem = 22px, 2.25rem = 36px at a 16px root.
    expect(fontSize['patient-body'][0]).toBe('1.375rem');
    expect(fontSize['patient-body'][1].lineHeight).toBe('1.6');
    expect(fontSize['patient-heading'][0]).toBe('2.25rem');
  });

  it('keeps touch targets at the 64px accessibility minimum', () => {
    const spacing = tailwindConfig.theme?.extend?.spacing as Record<string, string>;
    expect(spacing.touch).toBe('64px');
    expect(spacing['touch-min']).toBe('48px');
  });

  it('scans src for class usage', () => {
    expect(tailwindConfig.content).toContain('./src/**/*.{ts,tsx}');
  });
});
