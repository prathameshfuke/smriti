import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { applyZoomLock, ZOOM_LOCK_BOOT_SCRIPT } from '@/lib/a11y/zoomLock';
import { useSettingsStore } from '@/stores/settingsStore';
import ZoomLockSettings from '@/components/caregiver/ZoomLockSettings';
import DisplaySizeSync from '@/components/layout/DisplaySizeSync';

const root = document.documentElement;

beforeEach(() => {
  useSettingsStore.setState(useSettingsStore.getInitialState(), true);
  localStorage.clear();
  root.removeAttribute('data-zoom-locked');
});

describe('zoom lock helpers', () => {
  it('writes true only for an actual true value, false for anything else', () => {
    applyZoomLock(root, true);
    expect(root.getAttribute('data-zoom-locked')).toBe('true');

    applyZoomLock(root, 'true');
    expect(root.getAttribute('data-zoom-locked')).toBe('false');

    applyZoomLock(root, undefined);
    expect(root.getAttribute('data-zoom-locked')).toBe('false');
  });

  it('globals.css blocks double-tap zoom unconditionally and pinch only when locked', () => {
    const css = readFileSync(resolve(__dirname, '../app/globals.css'), 'utf8');
    expect(css).toContain('touch-action: manipulation;');
    expect(css).toContain('html[data-zoom-locked="true"] {\n  touch-action: pan-x pan-y;\n}');
  });

  it('boot script applies the saved preference before React, and survives corrupt storage', () => {
    localStorage.setItem('smriti.settings', JSON.stringify({ state: { zoomLocked: true } }));
    new Function(ZOOM_LOCK_BOOT_SCRIPT)();
    expect(root.getAttribute('data-zoom-locked')).toBe('true');

    localStorage.setItem('smriti.settings', '{not json');
    expect(() => new Function(ZOOM_LOCK_BOOT_SCRIPT)()).not.toThrow();
  });
});

describe('settingsStore zoom lock', () => {
  it('defaults to off so pinch-zoom stays available (WCAG 1.4.4)', () => {
    expect(useSettingsStore.getState().zoomLocked).toBe(false);
  });

  it('persists the preference', () => {
    act(() => {
      useSettingsStore.getState().setZoomLocked(true);
    });
    const saved = JSON.parse(localStorage.getItem('smriti.settings') ?? '{}');
    expect(saved.state.zoomLocked).toBe(true);
  });
});

describe('ZoomLockSettings', () => {
  it('locks and unlocks zoom on <html> when a caregiver flips the switch', () => {
    render(
      <>
        <DisplaySizeSync />
        <ZoomLockSettings />
      </>,
    );
    const toggle = screen.getByRole('switch', { name: 'Zoom lock' });
    expect(root.getAttribute('data-zoom-locked')).toBe('false');

    fireEvent.click(toggle);
    expect(root.getAttribute('data-zoom-locked')).toBe('true');

    fireEvent.click(toggle);
    expect(root.getAttribute('data-zoom-locked')).toBe('false');
  });
});
