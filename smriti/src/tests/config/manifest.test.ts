import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const manifest = JSON.parse(
  readFileSync(resolve(process.cwd(), 'public/manifest.json'), 'utf8'),
);

describe('PWA manifest', () => {
  it('uses the SMRITI brand gold as theme_color', () => {
    expect(manifest.theme_color).toBe('#8B6914');
  });

  it('declares standalone display so it installs as an app', () => {
    expect(manifest.display).toBe('standalone');
  });

  it('locks portrait orientation for shared elderly-user devices', () => {
    expect(manifest.orientation).toBe('portrait');
  });

  it('carries the SMRITI name and short_name', () => {
    expect(manifest.name).toBe('SMRITI - Cognitive Care');
    expect(manifest.short_name).toBe('SMRITI');
  });

  it('uses the warm surface tone as background_color', () => {
    expect(manifest.background_color).toBe('#FAF7F2');
  });

  it('ships 192px and 512px icons that exist on disk', () => {
    const sizes = manifest.icons.map((i: { sizes: string }) => i.sizes);
    expect(sizes).toContain('192x192');
    expect(sizes).toContain('512x512');

    for (const icon of manifest.icons as { src: string }[]) {
      const onDisk = resolve(process.cwd(), 'public', icon.src.replace(/^\//, ''));
      expect(() => readFileSync(onDisk)).not.toThrow();
    }
  });

  it('marks the 512px icon maskable for Android adaptive icons', () => {
    const large = (manifest.icons as { sizes: string; purpose?: string }[]).find(
      (i) => i.sizes === '512x512',
    );
    expect(large?.purpose).toBe('maskable');
  });
});
