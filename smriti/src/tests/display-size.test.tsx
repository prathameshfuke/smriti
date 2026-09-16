import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { act, fireEvent, render, screen } from '@testing-library/react';
import {
  applyDisplaySizes,
  DISPLAY_SIZE_BOOT_SCRIPT,
  ICON_SCALE,
  isDisplaySize,
  TEXT_SCALE,
} from '@/lib/a11y/sizing';
import { useSettingsStore } from '@/stores/settingsStore';
import DisplaySizeSettings from '@/components/caregiver/DisplaySizeSettings';
import DisplaySizeSync from '@/components/layout/DisplaySizeSync';

const root = document.documentElement;

beforeEach(() => {
  useSettingsStore.setState(useSettingsStore.getInitialState(), true);
  localStorage.clear();
  root.removeAttribute('data-text-size');
  root.removeAttribute('data-icon-size');
});

describe('display size helpers', () => {
  it('only accepts the three fixed sizes', () => {
    expect(['sm', 'md', 'lg'].every(isDisplaySize)).toBe(true);
    expect(isDisplaySize('xl')).toBe(false);
    expect(isDisplaySize(undefined)).toBe(false);
  });

  it('writes both attributes and falls back to Small for unknown values', () => {
    applyDisplaySizes(root, 'lg', 'bogus');
    expect(root.getAttribute('data-text-size')).toBe('lg');
    expect(root.getAttribute('data-icon-size')).toBe('sm');
  });

  it('keeps globals.css in step with the scale factors', () => {
    const css = readFileSync(resolve(__dirname, '../app/globals.css'), 'utf8');
    for (const size of ['md', 'lg'] as const) {
      expect(css).toContain(`html[data-text-size="${size}"] {\n  --text-scale: ${TEXT_SCALE[size]};`);
      expect(css).toContain(`html[data-icon-size="${size}"] {\n  --icon-scale: ${ICON_SCALE[size]};`);
    }
  });

  it('boot script applies saved sizes before React, and survives corrupt storage', () => {
    localStorage.setItem('smriti.settings', JSON.stringify({ state: { textSize: 'md', iconSize: 'lg' } }));
    new Function(DISPLAY_SIZE_BOOT_SCRIPT)();
    expect(root.getAttribute('data-text-size')).toBe('md');
    expect(root.getAttribute('data-icon-size')).toBe('lg');

    localStorage.setItem('smriti.settings', '{not json');
    expect(() => new Function(DISPLAY_SIZE_BOOT_SCRIPT)()).not.toThrow();
  });
});

describe('settingsStore display sizes', () => {
  it('defaults to Small so existing devices look unchanged', () => {
    expect(useSettingsStore.getState().textSize).toBe('sm');
    expect(useSettingsStore.getState().iconSize).toBe('sm');
  });

  it('persists text and icon size independently', () => {
    act(() => {
      useSettingsStore.getState().setTextSize('lg');
      useSettingsStore.getState().setIconSize('md');
    });
    const saved = JSON.parse(localStorage.getItem('smriti.settings') ?? '{}');
    expect(saved.state.textSize).toBe('lg');
    expect(saved.state.iconSize).toBe('md');
  });
});

describe('DisplaySizeSettings', () => {
  it('changes the sizes on <html> when a caregiver picks one', () => {
    render(
      <>
        <DisplaySizeSync />
        <DisplaySizeSettings />
      </>,
    );
    const textGroup = screen.getByRole('group', { name: 'Text size' });
    const iconGroup = screen.getByRole('group', { name: 'Icon size' });

    fireEvent.click(textGroup.querySelector('input[value="lg"]')!);
    fireEvent.click(iconGroup.querySelector('input[value="md"]')!);

    expect(root.getAttribute('data-text-size')).toBe('lg');
    expect(root.getAttribute('data-icon-size')).toBe('md');
    expect((textGroup.querySelector('input[value="lg"]') as HTMLInputElement).checked).toBe(true);
    expect((textGroup.querySelector('input[value="sm"]') as HTMLInputElement).checked).toBe(false);
  });

  it('offers exactly Small, Medium and Large for each setting', () => {
    render(<DisplaySizeSettings />);
    expect(screen.getAllByRole('radio', { name: 'Small' })).toHaveLength(2);
    expect(screen.getAllByRole('radio', { name: 'Medium' })).toHaveLength(2);
    expect(screen.getAllByRole('radio', { name: 'Large' })).toHaveLength(2);
  });
});
