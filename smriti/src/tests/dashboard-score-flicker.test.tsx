import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import 'fake-indexeddb/auto';
import { render, screen, waitFor, cleanup, act } from '@testing-library/react';
import { useEffect, useState } from 'react';
import { db } from '@/lib/db/schema';
import { computeCognitiveScore, mergeScoreRows, summarizeActivity, type ScoreRow } from '@/lib/dashboard/cognitiveScore';

/**
 * The caregiver Overview builds each patient card from TWO independent async
 * sources: /api/patients (server rows) and Dexie (rows this phone recorded and
 * has not synced). `useLocalScoreRows` used to coalesce its still-loading
 * `useLiveQuery` result to `{}`, which is indistinguishable from "this phone
 * has no local rows" — so when the fetch resolved first, every card painted a
 * score ring, a "Today N% correct" figure and a sparkline computed from server
 * rows ONLY, then silently swapped them when Dexie landed.
 */

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/caregiver/dashboard',
}));
vi.mock('@/lib/supabase/client', () => ({
  isSupabaseConfigured: () => true,
  createBrowserClient: () => ({ auth: { getSession: async () => ({ data: { session: { access_token: 't' } } }) } }),
}));

/**
 * A controllable `useLiveQuery`: it keeps the hook's real contract (undefined
 * until the query has run) but holds the result back until the test releases
 * it, so we can force the "server first, Dexie second" ordering deterministically.
 */
let dexieGate: { promise: Promise<void>; release: () => void };
vi.mock('dexie-react-hooks', () => ({
  useLiveQuery: (querier: () => unknown) => {
    const [value, setValue] = useState<unknown>(undefined);
    useEffect(() => {
      let alive = true;
      void (async () => {
        await dexieGate.promise;
        const v = await querier();
        if (alive) setValue(v);
      })();
      return () => {
        alive = false;
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    return value;
  },
}));

const iso = (daysBack: number) => {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - daysBack);
  return d.toISOString().slice(0, 10);
};
const today = () => iso(0);

const PATIENT_ID = 'p1';

/** Server rows: low accuracy. */
const serverScoreRows: ScoreRow[] = [0, 1, 2, 3, 4].map((n) => ({
  date: iso(n + 3),
  gameType: 'quick_tap',
  correctRounds: 6,
  totalRounds: 30,
  maxDifficultyReached: 1,
}));

/** Local-only rows: high accuracy, including today. */
const localScoreRows: ScoreRow[] = [0, 1, 2].map((n) => ({
  date: iso(n),
  gameType: 'object_hunt',
  correctRounds: 19,
  totalRounds: 20,
  maxDifficultyReached: 5,
}));

async function seedLocal() {
  for (const r of localScoreRows) {
    await db.dailySummaries.put({
      id: `${PATIENT_ID}-${r.date}-${r.gameType}`,
      patientId: PATIENT_ID,
      summaryDate: r.date,
      gameType: r.gameType,
      correctRounds: r.correctRounds,
      totalRounds: r.totalRounds,
      maxDifficultyReached: r.maxDifficultyReached,
      sessionCount: 1,
      avgReactionMs: 900,
    } as never);
  }
}

function stubPatientsFetch() {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      if (url === '/api/patients') {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            patients: [
              {
                id: PATIENT_ID,
                displayName: 'Aai',
                ageYears: 72,
                primaryLanguage: 'as',
                alertStatus: 'green',
                accuracyToday: null,
                sessionsThisWeek: 0,
                scoreRows: serverScoreRows,
              },
            ],
          }),
        };
      }
      return { ok: true, status: 200, json: async () => ({}) };
    }),
  );
}

/** Every number the card currently paints: ring score, Score figure, Today %, sparkline summary. */
function painted(container: HTMLElement): string | null {
  const ring = Array.from(container.querySelectorAll('[role="img"]'))
    .map((el) => el.getAttribute('aria-label') ?? '')
    .filter((l) => /Cognitive score/.test(l))[0];
  const todayPct = Array.from(container.querySelectorAll('span'))
    .map((el) => el.textContent ?? '')
    .filter((t) => /^\d+%$/.test(t))[0];
  const week = Array.from(container.querySelectorAll('[role="img"]'))
    .map((el) => el.getAttribute('aria-label') ?? '')
    .filter((l) => /last 7 days/.test(l))[0];
  if (!ring && !todayPct && !week) return null;
  return `ring=${ring ?? '-'} | today=${todayPct ?? '-'} | week=${week ?? '-'}`;
}

beforeEach(async () => {
  dexieGate = (() => {
    let release!: () => void;
    const promise = new Promise<void>((r) => {
      release = r;
    });
    return { promise, release };
  })();
  await db.dailySummaries.clear();
  await db.apiCache.clear();
  await seedLocal();
  stubPatientsFetch();
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const tick = async (ms = 20) => {
  await act(async () => {
    await new Promise((r) => setTimeout(r, ms));
  });
};

describe('caregiver Overview: no partial-data numbers on a patient card', () => {
  it('paints no number until BOTH the server fetch and the Dexie query have settled', async () => {
    const { default: DashboardPage } = await import('@/app/caregiver/dashboard/page');
    const { container } = render(<DashboardPage />);

    const sequence: Array<string | null> = [];
    // Let the fetch resolve (Dexie still gated) and record what is on screen.
    for (let i = 0; i < 5; i++) {
      await tick();
      sequence.push(painted(container));
    }

    // Proof the server source has genuinely settled while Dexie has not: the
    // summary strip only renders once patients !== null, and it carries no
    // per-patient score numbers. Without this anchor the assertion below
    // could pass vacuously (both sources still pending), which is exactly how
    // a flicker test fools itself.
    await waitFor(() => expect(screen.getByText(/Everyone is on track today/)).toBeInTheDocument());
    expect(screen.queryByTestId('patient-card-name')).not.toBeInTheDocument();

    const beforeDexie = [...sequence];
    expect(beforeDexie.filter((s) => s !== null)).toEqual([]);

    await act(async () => {
      dexieGate.release();
      await new Promise((r) => setTimeout(r, 20));
    });
    await tick();

    await waitFor(() => expect(screen.getByTestId('patient-card-name')).toHaveTextContent('Aai'));
    const final = painted(container);
    expect(final).not.toBeNull();

    const merged = mergeScoreRows(serverScoreRows, localScoreRows);
    const expected = summarizeActivity(merged, today());
    expect(final).toContain(`Cognitive score ${computeCognitiveScore(merged, today())!.score} out of 100`);
    expect(final).toContain(`today=${expected.accuracyToday}%`);

    // The first number painted is the final number.
    const firstPainted = [...sequence, final].find((s) => s !== null);
    expect(firstPainted).toBe(final);
  });

  it('a failed /api/patients fetch ends in an explicit error state, not an indefinite skeleton', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (url === '/api/patients') throw new Error('offline');
        return { ok: true, status: 200, json: async () => ({}) };
      }),
    );

    const { default: DashboardPage } = await import('@/app/caregiver/dashboard/page');
    const { container } = render(<DashboardPage />);

    await waitFor(() => expect(screen.getByText(/Try again/)).toBeInTheDocument());
    dexieGate.release();
    await tick();
    expect(container.querySelectorAll('.animate-pulse').length).toBe(0);
  });
});
