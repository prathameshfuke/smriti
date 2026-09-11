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

  it('defines primary brand terracotta as #B3452D', () => {
    expect((colors.primary as Record<string, string>).DEFAULT).toBe('#B3452D');
  });

  it('defines the primary light and dark ramp', () => {
    // Amigo-inspired repoint (docs/Design System_ Amigo-Inspired Clinical AI
    // Platform.md §3.1: terra-600/rose-100/terra-700) — light/dark ramp
    // around the terracotta primary, not the old cyan brand.
    const primary = colors.primary as Record<string, string>;
    expect(primary.light).toBe('#E7B2A2');
    expect(primary.dark).toBe('#933A27');
  });

  it('defines the surface palette used by patient screens', () => {
    // paper-50 (§3.1: "Main page background") — warm off-white, not pure
    // white, matching the rest of the Amigo-inspired palette (canvas, paper50).
    const surface = colors.surface as Record<string, string>;
    expect(surface.DEFAULT).toBe('#F8F7F3');
    expect(surface.card).toBe('#FFFFFF');
    expect(surface.muted).toBe('#F0EEE9');
  });

  it('defines traffic-light alert colours for the caregiver dashboard', () => {
    // success = design doc's documented `signal-green` (§3.1: "Announcement/
    // status indicator only") — warning/danger are unchanged from before.
    expect(colors.success).toBe('#39A85A');
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
