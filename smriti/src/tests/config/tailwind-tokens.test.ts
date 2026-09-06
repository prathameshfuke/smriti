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

  it('defines primary brand teal as #06B6D4', () => {
    expect((colors.primary as Record<string, string>).DEFAULT).toBe('#06B6D4');
  });

  it('defines the primary light and dark ramp', () => {
    const primary = colors.primary as Record<string, string>;
    expect(primary.light).toBe('#67E8F9');
    expect(primary.dark).toBe('#0E7490');
  });

  it('defines the surface palette used by patient screens', () => {
    const surface = colors.surface as Record<string, string>;
    expect(surface.DEFAULT).toBe('#FFFFFF');
    expect(surface.card).toBe('#FFFFFF');
    expect(surface.muted).toBe('#F9FAFB');
  });

  it('defines traffic-light alert colours for the caregiver dashboard', () => {
    expect(colors.success).toBe('#059669');
    expect(colors.warning).toBe('#D97706');
    expect(colors.danger).toBe('#DC2626');
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
