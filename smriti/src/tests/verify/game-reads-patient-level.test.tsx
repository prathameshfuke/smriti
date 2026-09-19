import { describe, it, expect, vi, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import type { ReactElement } from 'react';
import { render, cleanup } from '@testing-library/react';
import type { LocalPatient } from '@/lib/db/schema';
import { usePatientStore } from '@/stores/patientStore';
import { useGameStore } from '@/stores/gameStore';
import { LanguageProvider } from '@/lib/i18n/provider';

/**
 * ITEM 1 (per-game): the level stored per patient must actually reach the
 * game. Each game component is stubbed and records the props its page hands
 * it; a game whose page never passes the patient's level is "stuck at one
 * level" no matter how well the engine adapts.
 */

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/games',
}));

const seen: Record<string, Record<string, unknown>> = {};
function stub(name: string) {
  return (props: Record<string, unknown>) => {
    seen[name] = props;
    return <div data-testid={name} />;
  };
}
vi.mock('@/components/games/n-back/GameComponent', () => ({ default: stub('n_back') }));
vi.mock('@/components/games/counting-boxes/GameComponent', () => ({ default: stub('counting_boxes') }));
vi.mock('@/components/games/fish-trace/GameComponent', () => ({ default: stub('fish_trace') }));
vi.mock('@/components/games/frog-leap/GameComponent', () => ({ default: stub('frog_leap') }));
vi.mock('@/components/games/larger-number/GameComponent', () => ({ default: stub('larger_number') }));
vi.mock('@/components/games/memory-span/MemoryTestGame', () => ({ default: stub('memory_span') }));
vi.mock('@/components/games/memory-blocks/PatternRecallGame', () => ({ PatternRecallGame: stub('memory_blocks') }));
vi.mock('@/components/games/double-decision/PeripheralSpeedGame', () => ({ PeripheralSpeedGame: stub('double_decision') }));

import NBackPage from '@/app/games/n-back/page';
import CountingBoxesPage from '@/app/games/counting-boxes/page';
import FishTracePage from '@/app/games/fish-trace/page';
import FrogLeapPage from '@/app/games/frog-leap/page';
import LargerNumberPage from '@/app/games/larger-number/page';
import MemoryBlocksPage from '@/app/games/memory-blocks/page';
import DoubleDecisionPage from '@/app/games/double-decision/page';

const patient = (level: number, game: string): LocalPatient => ({
  id: 'p-' + game, caregiverId: 'c1', displayName: 'Aai', ageYears: 72, gender: 'female',
  educationYears: 4, primaryLanguage: 'en', sessionDurationMinutes: 10, isActive: true,
  currentDifficulty: { [game]: level }, updatedAt: '2026-08-31T00:00:00.000Z', syncedAt: null,
});

const PAGES: [string, () => ReactElement][] = [
  ['n_back', () => <NBackPage />],
  ['counting_boxes', () => <CountingBoxesPage />],
  ['fish_trace', () => <FishTracePage />],
  ['frog_leap', () => <FrogLeapPage />],
  ['larger_number', () => <LargerNumberPage />],
  ['memory_blocks', () => <MemoryBlocksPage />],
  ['double_decision', () => <DoubleDecisionPage />],
];

beforeEach(() => {
  cleanup();
  for (const k of Object.keys(seen)) delete seen[k];
  usePatientStore.setState(usePatientStore.getInitialState(), true);
  useGameStore.setState(useGameStore.getInitialState(), true);
});

describe('each imported game receives the patient level from its page', () => {
  it.each(PAGES)('%s', (game, page) => {
    usePatientStore.getState().setCurrentPatient(patient(4, game));
    render(<LanguageProvider>{page()}</LanguageProvider>);
    expect(seen[game], `${game} never rendered`).toBeDefined();
    expect(seen[game].initialLevel).toBe(4);
  });

  it.each(PAGES)('%s: a different patient on the same phone starts at 1', (game, page) => {
    usePatientStore.getState().setCurrentPatient(patient(1, 'other'));
    render(<LanguageProvider>{page()}</LanguageProvider>);
    expect(seen[game].initialLevel).toBe(1);
  });
});

import { MAX_LEVEL } from '@/lib/engine/difficulty';
describe('games with no difficulty dimension do not pretend to level', () => {
  it('memory_span (fixed 12-word list) is pinned to level 1', () => {
    expect(MAX_LEVEL.memory_span).toBe(1);
  });
  it('double_decision levels match its 3 field tiers', () => {
    expect(MAX_LEVEL.double_decision).toBe(3);
  });
});
