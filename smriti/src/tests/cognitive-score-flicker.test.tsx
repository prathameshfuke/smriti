import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import 'fake-indexeddb/auto';
import { render, screen, waitFor, cleanup, act } from '@testing-library/react';
import { db } from '@/lib/db/schema';
import CognitiveScoreCard from '@/components/caregiver/CognitiveScoreCard';
import {
  SCORE_WINDOW_DAYS,
  computeCognitiveScore,
  mergeScoreRows,
  type ScoreRow,
} from '@/lib/dashboard/cognitiveScore';

/**
 * ISSUE A/B/C regression suite.
 *
 * A: the patient detail page builds its cognitive score from TWO independent
 *    async sources (Dexie via useCognitiveTrend, and /api/patients). Before
 *    the fix it rendered a number as soon as EITHER had arrived, so the ring
 *    showed one score and then silently replaced it with another.
 * B: the card must state its own 14-day window, and must not present the
 *    scoring WEIGHTS as if they were this patient's measurements.
 * C: `level` falls back to a copy of `accuracy` when no levelled game was
 *    played — that must not be printed as "N% of top level".
 */

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/caregiver/patients/p1',
}));
vi.mock('@/lib/supabase/client', () => ({
  isSupabaseConfigured: () => true,
  createBrowserClient: () => ({ auth: { getSession: async () => ({ data: { session: { access_token: 't' } } }) } }),
}));

const iso = (daysBack: number) => {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - daysBack);
  return d.toISOString().slice(0, 10);
};
const today = () => iso(0);

/** Rows the server has but this phone does not: low accuracy, drags the score down. */
const serverScoreRows: ScoreRow[] = [0, 1, 2, 3, 4].map((n) => ({
  date: iso(n + 3),
  gameType: 'quick_tap',
  correctRounds: 6,
  totalRounds: 30,
  maxDifficultyReached: 1,
}));

async function seedLocalHighAccuracy(patientId: string) {
  for (const n of [0, 1, 2]) {
    await db.dailySummaries.put({
      id: `${patientId}-${iso(n)}-object_hunt`,
      patientId,
      summaryDate: iso(n),
      gameType: 'object_hunt',
      correctRounds: 19,
      totalRounds: 20,
      maxDifficultyReached: 5,
      sessionCount: 1,
      avgReactionMs: 900,
    } as never);
  }
}

/** A fetch whose /api/patients response only resolves when we say so. */
function deferredPatientsFetch(patientId: string) {
  let release!: () => void;
  const gate = new Promise<void>((r) => {
    release = r;
  });
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      if (url === '/api/patients') {
        await gate;
        return {
          ok: true,
          status: 200,
          json: async () => ({
            patients: [
              {
                id: patientId,
                displayName: 'Aai',
                ageYears: 72,
                primaryLanguage: 'as',
                alertStatus: 'green',
                scoreRows: serverScoreRows,
              },
            ],
          }),
        };
      }
      const body = url.endsWith('/digests') ? { digests: [] } : { alerts: [] };
      return { ok: true, status: 200, json: async () => body };
    }),
  );
  return { release };
}

/** Every number the ring / card currently paints, in order. */
function paintedScores(container: HTMLElement): string[] {
  return Array.from(container.querySelectorAll('[role="img"]'))
    .map((el) => el.getAttribute('aria-label') ?? '')
    .map((l) => (l.match(/Cognitive score (\d+) out of 100/) ?? [])[1])
    .filter((n): n is string => n !== undefined);
}

beforeEach(async () => {
  await db.dailySummaries.clear();
  // authedFetch caches GETs in db.apiCache and falls back to that cache on a
  // network failure — a leftover entry would mask the offline case below.
  await db.apiCache.clear();
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('Issue A: cognitive score never paints a partial-data number', () => {
  it('shows only a skeleton until BOTH sources resolve, and the first number painted is the final number', async () => {
    const patientId = 'p1';
    await seedLocalHighAccuracy(patientId);
    const { release } = deferredPatientsFetch(patientId);

    const { default: PatientDetailPage } = await import('@/app/caregiver/patients/[id]/page');
    const { container } = render(<PatientDetailPage params={Promise.resolve({ id: patientId })} />);

    // Wait for proof that the Dexie source has RESOLVED while the server one
    // is still in flight: the per-game breakdown is fed by the same Dexie
    // trend and only lists a game once those rows have arrived. Without this
    // anchor the assertion below could pass vacuously (both sources still
    // pending), which is exactly how a flicker test fools itself.
    await waitFor(() => expect(screen.getAllByTestId('game-breakdown-row').length).toBeGreaterThan(0));
    await act(async () => {
      await new Promise((r) => setTimeout(r, 20));
    });

    // The local-only score is ~84; the merged one is 45. Before the fix, 84
    // was on screen at this point and was replaced when the fetch landed.
    expect(paintedScores(container)).toEqual([]);
    expect(screen.queryByText(/of rounds correct/)).not.toBeInTheDocument();

    await act(async () => {
      release();
      await new Promise((r) => setTimeout(r, 20));
    });

    await waitFor(() => expect(paintedScores(container).length).toBeGreaterThan(0));
    const painted = paintedScores(container);

    // Every ring on the page agrees, and it equals the score over the union.
    const expected = computeCognitiveScore(
      mergeScoreRows(
        serverScoreRows,
        [0, 1, 2].map((n) => ({
          date: iso(n),
          gameType: 'object_hunt',
          correctRounds: 19,
          totalRounds: 20,
          maxDifficultyReached: 5,
        })),
      ),
      today(),
    )!.score;
    expect(new Set(painted)).toEqual(new Set([String(expected)]));
  });

  it('a failed /api/patients fetch ends in an error state, not an indefinite skeleton', async () => {
    const patientId = 'p1';
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (url === '/api/patients') throw new Error('offline');
        const body = url.endsWith('/digests') ? { digests: [] } : { alerts: [] };
        return { ok: true, status: 200, json: async () => body };
      }),
    );

    const { default: PatientDetailPage } = await import('@/app/caregiver/patients/[id]/page');
    const { container } = render(<PatientDetailPage params={Promise.resolve({ id: patientId })} />);

    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
    await act(async () => {
      await new Promise((r) => setTimeout(r, 20));
    });
    // No skeleton left spinning on the score card.
    expect(container.querySelectorAll('.animate-pulse').length).toBe(0);
  });
});

describe('Issue B: the score card labels its own window and its weights', () => {
  const score = computeCognitiveScore(
    [0, 1, 2, 3].map((n) => ({
      date: iso(n),
      gameType: 'object_hunt' as const,
      correctRounds: 6,
      totalRounds: 10,
      maxDifficultyReached: 3,
    })),
    today(),
  )!;

  it('states a window that matches SCORE_WINDOW_DAYS', () => {
    render(<CognitiveScoreCard score={score} />);
    const label = screen.getByTestId('score-window-label').textContent ?? '';
    const days = Number((label.match(/(\d+)\s*days/) ?? [])[1]);
    expect(days).toBe(SCORE_WINDOW_DAYS);
  });

  it('does not present the 60/25/15 weights as measured values', () => {
    render(<CognitiveScoreCard score={score} />);
    expect(screen.queryByText(/60% accuracy, 25% level, 15% regular play/)).not.toBeInTheDocument();
    expect(screen.getByText(/Those are the weights, not this patient's results/)).toBeInTheDocument();
    // The measured accuracy row says what it measures.
    expect(screen.getByText(/of rounds correct/)).toBeInTheDocument();
  });
});

describe('Issue C: level is not printed as a measurement when it is a copy of accuracy', () => {
  it('flags the fallback on the score object', () => {
    const quizOnly = computeCognitiveScore(
      [0, 1, 2].map((n) => ({
        date: iso(n),
        gameType: 'memory_quiz',
        correctRounds: 7,
        totalRounds: 10,
        maxDifficultyReached: 1,
      })),
      today(),
    )!;
    expect(quizOnly.levelFromAccuracy).toBe(true);
    expect(quizOnly.level).toBe(quizOnly.accuracy);

    render(<CognitiveScoreCard score={quizOnly} />);
    expect(screen.getByText('No levelled games yet')).toBeInTheDocument();
    expect(screen.queryByText(/% of top level/)).not.toBeInTheDocument();
  });

  it('prints a real level percentage when a levelled game was played', () => {
    const levelled = computeCognitiveScore(
      [0, 1, 2].map((n) => ({
        date: iso(n),
        gameType: 'object_hunt',
        correctRounds: 7,
        totalRounds: 10,
        maxDifficultyReached: 3,
      })),
      today(),
    )!;
    expect(levelled.levelFromAccuracy).toBe(false);
    render(<CognitiveScoreCard score={levelled} />);
    expect(screen.getByText(/% of top level/)).toBeInTheDocument();
  });
});
