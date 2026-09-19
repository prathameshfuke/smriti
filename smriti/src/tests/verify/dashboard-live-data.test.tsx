import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import 'fake-indexeddb/auto';
import { v4 as uuid } from 'uuid';
import { render as rtlRender, screen, waitFor, cleanup, act } from '@testing-library/react';
import { db } from '@/lib/db/schema';
import { useGameStore } from '@/stores/gameStore';
import { logEvent, buildDailySummary } from '@/lib/engine/telemetry';
import { I18nProvider } from '@/lib/i18n/provider';

/**
 * ITEM 2: the caregiver Overview / patient page read REAL rows. Only the
 * network edge (fetch -> /api/patients) is stubbed; Dexie is real
 * (fake-indexeddb) and sessions are written through the app's own
 * telemetry path (logEvent), exactly as a game does.
 */

const render = (ui: Parameters<typeof rtlRender>[0]) => rtlRender(ui, { wrapper: I18nProvider });

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/caregiver/dashboard',
}));
vi.mock('@/lib/supabase/client', () => ({
  isSupabaseConfigured: () => true,
  createBrowserClient: () => ({ auth: { getSession: async () => ({ data: { session: { access_token: 't' } } }) } }),
}));

let pid: string;
let serverPatient: Record<string, unknown>;

function stubFetch() {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      const body = url.startsWith('/api/patients/') && url.endsWith('/digests')
        ? { digests: [{ id: 'd', summary: 'x', generatedAt: new Date().toISOString() }] }
        : url === '/api/alerts'
          ? { alerts: [] }
          : { patients: [serverPatient] };
      return { ok: true, status: 200, json: async () => body };
    }),
  );
}

const today = () => new Date().toISOString().slice(0, 10);
const daysAgo = (n: number) => {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
};

async function playRounds(game: 'object_hunt' | 'quick_tap', correct: number, total: number, level = 2) {
  for (let i = 0; i < total; i++) {
    await logEvent({
      sessionId: useGameStore.getState().activeSession!.id,
      patientId: pid,
      gameType: game,
      difficultyLevel: level,
      roundNumber: i + 1,
      isCorrect: i < correct,
      responseTimeMs: 1000,
      eventTimestamp: new Date().toISOString(),
      metadata: {},
    });
  }
}

beforeEach(async () => {
  cleanup();
  pid = uuid();
  serverPatient = {
    id: pid, caregiverId: 'c1', displayName: 'Aai Test', ageYears: 72, primaryLanguage: 'en',
    alertStatus: 'yellow', accuracyToday: null, sessionsThisWeek: 0, cognitiveScore: null,
    week: Array(7).fill(null), scoreRows: [],
  };
  useGameStore.setState(useGameStore.getInitialState(), true);
  useGameStore.getState().startSession(pid);
  stubFetch();
});
afterEach(() => vi.unstubAllGlobals());

describe('ITEM 2: Overview reflects real sessions, live, with no seed data', () => {
  it('empty -> played -> played more: score, today %, days-of-7 and week strip all change', async () => {
    const { default: Dashboard } = await import('@/app/caregiver/dashboard/page');
    render(<Dashboard />);

    // Nothing played: no fabricated score / accuracy.
    expect(await screen.findByText('Aai Test')).toBeInTheDocument();
    expect(screen.getByText('No games yet')).toBeInTheDocument();
    expect(screen.getByText('Not played')).toBeInTheDocument();
    expect(screen.getByText('0 of 7 days')).toBeInTheDocument();
    // alert status comes from the server row, not invented
    expect(screen.getByText('Needs attention')).toBeInTheDocument();

    // 10 rounds, 7 correct, through the real telemetry path.
    await act(async () => { await playRounds('object_hunt', 7, 10); });
    expect(await screen.findByText('70%')).toBeInTheDocument();
    expect(screen.getByText('1 of 7 days')).toBeInTheDocument();
    expect(screen.queryByText('No games yet')).not.toBeInTheDocument();
    expect(screen.getByText('Early estimate')).toBeInTheDocument();
    const scoreAfterFirst = screen.getByLabelText(/Cognitive score \d+ out of 100/).getAttribute('aria-label');

    // 10 more, all wrong -> 7/20 = 35 %. Score must move (not stale).
    await act(async () => { await playRounds('object_hunt', 0, 10); });
    expect(await screen.findByText('35%')).toBeInTheDocument();
    const scoreAfterSecond = screen.getByLabelText(/Cognitive score \d+ out of 100/).getAttribute('aria-label');
    expect(scoreAfterSecond).not.toEqual(scoreAfterFirst);

    // Earlier days played on this phone -> days-of-7 counts them.
    await act(async () => {
      await db.dailySummaries.bulkPut([1, 2].map((n) => ({
        id: uuid(), patientId: pid, summaryDate: daysAgo(n), gameType: 'quick_tap', totalRounds: 10,
        correctRounds: 9, avgResponseTimeMs: 800, maxDifficultyReached: 3, sessionCount: 1, eloRating: 0, synced: false,
      })));
    });
    expect(await screen.findByText('3 of 7 days')).toBeInTheDocument();
  });

  it("another patient's local rows never leak onto this patient's card", async () => {
    await db.dailySummaries.put({
      id: uuid(), patientId: 'someone-else', summaryDate: today(), gameType: 'quick_tap', totalRounds: 10,
      correctRounds: 10, avgResponseTimeMs: 800, maxDifficultyReached: 3, sessionCount: 1, eloRating: 0, synced: false,
    });
    const { default: Dashboard } = await import('@/app/caregiver/dashboard/page');
    render(<Dashboard />);
    expect(await screen.findByText('Aai Test')).toBeInTheDocument();
    expect(screen.getByText('Not played')).toBeInTheDocument();
  });

  it('server rows alone (caregiver on a different phone) drive the numbers', async () => {
    serverPatient.scoreRows = [
      { date: today(), gameType: 'object_hunt', correctRounds: 8, totalRounds: 10, maxDifficultyReached: 4 },
      { date: daysAgo(1), gameType: 'object_hunt', correctRounds: 9, totalRounds: 10, maxDifficultyReached: 4 },
    ];
    const { default: Dashboard } = await import('@/app/caregiver/dashboard/page');
    render(<Dashboard />);
    expect(await screen.findByText('80%')).toBeInTheDocument();
    expect(screen.getByText('2 of 7 days')).toBeInTheDocument();
  });
});

describe('ITEM 2: patient page streak / adherence come from real rows', () => {
  it('streak counts consecutive played days from real summaries, and grows after a new session', async () => {
    await db.dailySummaries.bulkPut([1, 2].map((n) => ({
      id: uuid(), patientId: pid, summaryDate: daysAgo(n), gameType: 'quick_tap', totalRounds: 10,
      correctRounds: 9, avgResponseTimeMs: 800, maxDifficultyReached: 3, sessionCount: 1, eloRating: 0, synced: false,
    })));
    const { default: PatientPage } = await import('@/app/caregiver/patients/[id]/page');
    render(<PatientPage params={Promise.resolve({ id: pid })} />);
    const glance = async () => (await screen.findByLabelText('At a glance')).textContent ?? '';
    // yesterday + day before, not played today yet -> streak 2, 0 played... days-of-7 = 2
    await waitFor(async () => expect(await glance()).toMatch(/^2.*Daily streak/));
    await act(async () => { await playRounds('quick_tap', 5, 5); });
    await waitFor(async () => expect(await glance()).toMatch(/^3.*Daily streak/));
    expect(await glance()).toMatch(/3\/7Days played this week/);
    await buildDailySummary(pid, today(), 'quick_tap');
  });

  it("caregiver on a DIFFERENT phone (no local rows): streak and 'days played' come from the server rows", async () => {
    serverPatient.scoreRows = [0, 1, 2].map((n) => ({
      date: daysAgo(n), gameType: 'object_hunt', correctRounds: 8, totalRounds: 10, maxDifficultyReached: 4,
    }));
    const { default: PatientPage } = await import('@/app/caregiver/patients/[id]/page');
    render(<PatientPage params={Promise.resolve({ id: pid })} />);
    const glance = async () => (await screen.findByLabelText('At a glance')).textContent ?? '';
    await waitFor(async () => expect(await glance()).toMatch(/3\/7Days played this week/));
    // The streak is the one number on this card that ignored the server rows.
    expect(await glance()).toMatch(/^3.*Daily streak/);
  });
});
