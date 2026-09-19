import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { I18nProvider } from '@/lib/i18n/provider';
import { useSettingsStore } from '@/stores/settingsStore';
import PinPad from '@/components/ui/PinPad';
import SyncIndicator from '@/components/ui/SyncIndicator';
import MemoryGrid from '@/components/games/MemoryGrid';
import { OBJECTS } from '@/lib/engine/objects';
import brx from '@/lib/i18n/locales/brx.json';
import mni from '@/lib/i18n/locales/mni.json';

/** Strings that used to be hardcoded English in patient-facing components. */
async function withLanguage(language: 'brx' | 'mni', ui: React.ReactElement) {
  window.localStorage.setItem(
    'smriti.settings',
    JSON.stringify({ state: { language, isFirstLaunch: true, caregiverPinHash: null }, version: 0 }),
  );
  await useSettingsStore.persist.rehydrate();
  return render(<I18nProvider>{ui}</I18nProvider>);
}

beforeEach(() => {
  window.localStorage.clear();
  useSettingsStore.setState(useSettingsStore.getInitialState(), true);
});

describe.each([
  ['brx', brx],
  ['mni', mni],
] as const)('converted patient strings in %s', (code, catalog) => {
  it('PinPad labels come from the catalog', async () => {
    await withLanguage(code, <PinPad onDigit={() => undefined} onBackspace={() => undefined} />);
    expect(screen.getByRole('group', { name: catalog.pin.keypad })).toBeTruthy();
    expect(screen.getByRole('button', { name: catalog.pin.backspace })).toBeTruthy();
  });

  it('SyncIndicator text comes from the catalog', async () => {
    await withLanguage(code, <SyncIndicator status="pending" />);
    expect(screen.getByText(catalog.sync.pending)).toBeTruthy();
  });

  it('MemoryGrid announces face-up cards by their translated name and face-down ones in the language', async () => {
    const tiles = [
      { object: OBJECTS[0], pairId: 0, matched: false },
      { object: OBJECTS[1], pairId: 1, matched: false },
    ];
    await withLanguage(code, <MemoryGrid tiles={tiles} faceUpIndices={[0]} onTileSelect={() => undefined} inputLocked={false} />);
    expect(screen.getByRole('button', { name: OBJECTS[0].name[code] as string })).toBeTruthy();
    expect(screen.getByRole('button', { name: catalog.game.card.replace('{n}', '2') })).toBeTruthy();
  });
});
