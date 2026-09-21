import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import 'fake-indexeddb/auto';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { usePatientStore } from '@/stores/patientStore';
import { useGameStore } from '@/stores/gameStore';
import { I18nProvider } from '@/lib/i18n/provider';
import type { Round } from '@/lib/games/objectHuntRound';

const built: Round[] = [];

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/games/object-hunt',
}));
vi.mock('@/lib/audio/speech', () => ({ speak: vi.fn(), GAME_SPEECH_RATE: 0.9 }));
vi.mock('@/lib/audio/narrate', () => ({ narrate: vi.fn().mockResolvedValue(undefined) }));
vi.mock('@/lib/games/objectHuntRound', async () => {
  const actual = await vi.importActual<typeof import('@/lib/games/objectHuntRound')>('@/lib/games/objectHuntRound');
  return {
    ...actual,
    buildRound: (...args: Parameters<typeof actual.buildRound>) => {
      const round = actual.buildRound(...args);
      built.push(round);
      return round;
    },
  };
});

const advance = (ms: number) =>
  act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });

describe('Object Hunt: eight rounds in a row, answering correctly', () => {
  beforeEach(() => {
    window.localStorage.clear();
    built.length = 0;
    usePatientStore.setState(usePatientStore.getInitialState(), true);
    useGameStore.setState(useGameStore.getInitialState(), true);
    usePatientStore.setState({ currentPatient: { id: 'p-eight', currentDifficulty: {}, educationYears: 12 } as never });
    vi.useFakeTimers();
  });
  afterEach(() => vi.useRealTimers());

  it('never repeats a picture, layout or question order between rounds, and the load grows', async () => {
    const { default: ObjectHuntPage } = await import('@/app/games/object-hunt/page');
    render(
      <I18nProvider>
        <ObjectHuntPage />
      </I18nProvider>,
    );
    await advance(10);
    fireEvent.click(screen.getByRole('button', { name: 'Start!' }));

    const summary: string[] = [];
    for (let roundNo = 1; roundNo <= 8; roundNo += 1) {
      await advance(10);
      const round = built[built.length - 1];
      expect(built).toHaveLength(roundNo);
      const count = round.revealOrder.length;
      const cells = round.tiles.length;
      summary.push(`round ${roundNo}: ${cells} tiles, ${count} pictures: ${round.recallOrder.map((p) => p.object.id).join(', ')}`);

      // Reveal: the "Picture n of N" line is on screen while pictures are shown.
      expect(screen.getByTestId('object-hunt-progress')).toBeInTheDocument();
      await advance(count * 4000 + 600);

      for (let q = 0; q < count; q += 1) {
        await advance(2500);
        const tiles = screen.getAllByRole('button', { name: /Tile/ });
        fireEvent.click(tiles[round.recallOrder[q].index]);
        await advance(1100);
      }
      await advance(10);
      fireEvent.click(screen.getByRole('button', { name: 'Keep going' }));
    }

    if (process.env.OH_SUMMARY) process.stdout.write(`${summary.join('\n')}\n`);

    for (let i = 1; i < built.length; i += 1) {
      const prev = built[i - 1].revealOrder.map((p) => p.object.id);
      const cur = built[i].revealOrder.map((p) => p.object.id);
      expect(cur.filter((id) => prev.includes(id))).toEqual([]);
      expect(built[i].tiles.map((t) => t?.id ?? '-').join()).not.toBe(built[i - 1].tiles.map((t) => t?.id ?? '-').join());
    }
    for (const r of built) {
      expect(r.recallOrder.map((p) => p.object.id).join()).not.toBe(r.revealOrder.map((p) => p.object.id).join());
    }
    // Answering correctly must raise the difficulty: later rounds carry a heavier load.
    const load = (r: Round) => r.tiles.length * r.revealOrder.length;
    expect(load(built[7])).toBeGreaterThan(load(built[0]));
  }, 60_000);
});
