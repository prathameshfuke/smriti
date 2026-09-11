import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import 'fake-indexeddb/auto';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { db, type LocalPatient } from '@/lib/db/schema';
import { usePatientStore } from '@/stores/patientStore';
import { useGameStore } from '@/stores/gameStore';
import { logEvent } from '@/lib/engine/telemetry';
import { I18nProvider } from '@/lib/i18n/provider';

/**
 * Reproduces (and pins down, stage by stage) the caregiver-reported bug:
 * "a 1-round or 2-round session never shows up on the dashboard, only
 * longer sessions do." Each `describe` below checks one stage of the
 * pipeline in isolation, against the REAL production code (gameStore,
 * telemetry.ts, lib/db/sync.ts, the /api/patients* route handlers) —
 * nothing here re-implements the logic under test.
 *
 * Finding, for the record (see PR description / task report for detail):
 * none of the three stages gate on round count, session duration, or
 * session count anywhere in this codebase — Stages 1-3 below confirm that
 * and stay in the suite as regression tests against such a gate ever being
 * introduced. The actual bug was one level deeper: `gameStore.endSession`
 * (the only place a `game_sessions` row and a `daily_summaries` row were
 * ever written) was only ever called from two explicit UI actions — the nav
 * bar's Back button, or "Finish Session" -> "Back to Home". A patient who
 * plays 1-2 rounds and then simply stops (locks the phone, closes the tab,
 * backgrounds the app) without tapping either is the realistic shape of a
 * short session, not an edge case — and that patient's `daily_summaries`
 * row (the one table `/api/patients` actually reads) never got built at
 * all, so the round(s) they did play never appeared on the dashboard, sync
 * or no sync. Fixed in `lib/engine/telemetry.ts`'s `logEvent` by lazily
 * creating the session row and rebuilding the daily summary after every
 * round, not only at an explicit end. Stages 4-5 below cover that
 * abandonment shape directly, for both 1- and 2-round sessions.
 */

const pushMock = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock, replace: vi.fn() }),
  usePathname: () => '/games/path-match',
}));

const getSession = vi.fn();
const getUser = vi.fn();

/** Same chainable Postgrest-like fake used in src/tests/sync.test.ts. */
function makeChain(result: { data: unknown; error: unknown }) {
  const chain: Record<string, unknown> = {};
  for (const method of ['select', 'eq', 'in', 'gte', 'order', 'limit', 'upsert', 'insert', 'update']) {
    chain[method] = vi.fn(() => chain);
  }
  chain.single = vi.fn(() => Promise.resolve(result));
  chain.then = (resolve: (v: typeof result) => unknown) => resolve(result);
  return chain;
}

const fromMock = vi.fn((table: string) =>
  makeChain(table === 'caregivers' ? { data: { id: 'c-default' }, error: null } : { data: [], error: null }),
);

vi.mock('@/lib/supabase/client', () => ({
  isSupabaseConfigured: () => true,
  createBrowserClient: () => ({ auth: { getSession } }),
  createServerClient: () => ({ auth: { getUser }, from: fromMock }),
}));

const PATIENT_ID = 'short-session-patient';

const patient = (): LocalPatient => ({
  id: PATIENT_ID,
  caregiverId: 'c1',
  displayName: 'Aai',
  ageYears: 72,
  gender: 'female',
  educationYears: 4,
  primaryLanguage: 'as',
  sessionDurationMinutes: 10,
  isActive: true,
  currentDifficulty: {},
  updatedAt: '2026-08-31T00:00:00.000Z',
  syncedAt: null,
});

beforeEach(async () => {
  await db.gameSessions.clear();
  await db.telemetryEvents.clear();
  await db.dailySummaries.clear();
  await db.patients.clear();
  usePatientStore.setState(usePatientStore.getInitialState(), true);
  useGameStore.setState(useGameStore.getInitialState(), true);
  getSession.mockReset();
  getUser.mockReset();
  fromMock.mockReset();
  fromMock.mockImplementation((table: string) =>
    makeChain(table === 'caregivers' ? { data: { id: 'c-default' }, error: null } : { data: [], error: null }),
  );
  pushMock.mockClear();
  Element.prototype.getBoundingClientRect = function () {
    return { left: 0, top: 0, width: 400, height: 600, right: 400, bottom: 600, x: 0, y: 0, toJSON() {} } as DOMRect;
  };
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

/**
 * Drives the REAL Path Match page component through exactly `numRounds`
 * rounds, then all the way through "Finish Session" -> "Back to Home" (the
 * only path that calls gameStore.endSession and buildDailySummary, exactly
 * like a patient tapping through the real UI would).
 */
async function playPathMatchRoundsToHome(numRounds: number): Promise<void> {
  const { default: PathMatchPage } = await import('@/app/games/path-match/page');
  render(
    <I18nProvider>
      <PathMatchPage />
    </I18nProvider>,
  );

  for (let round = 1; round <= numRounds; round += 1) {
    fireEvent.click(screen.getByText(/start!/i));
    await waitFor(() => expect(screen.getByTestId('path-canvas')).toBeInTheDocument());
    const svg = screen.getByTestId('path-canvas');
    const points = screen.getAllByTestId(/^path-point-/);
    for (const point of points) {
      const circle = point.querySelector('circle')!;
      fireEvent.pointerDown(svg, {
        clientX: Number(circle.getAttribute('cx')),
        clientY: Number(circle.getAttribute('cy')),
      });
    }
    await waitFor(() => expect(screen.getByText(/finish session/i)).toBeInTheDocument());

    if (round < numRounds) {
      fireEvent.click(screen.getByText(/another round/i));
      await waitFor(() => expect(screen.getByText(/start!/i)).toBeInTheDocument());
    }
  }

  fireEvent.click(screen.getByText(/finish session/i));
  await waitFor(() => expect(screen.getByText(/back to home/i)).toBeInTheDocument());
  fireEvent.click(screen.getByText(/back to home/i));
  // goHome() awaits buildDailySummary() and endSession() before this fires,
  // so this is the precise signal that both have actually resolved.
  await waitFor(() => expect(pushMock).toHaveBeenCalledWith('/app'));
}

/**
 * Drives the REAL Path Match page through exactly `numRounds` rounds, same
 * as `playPathMatchRoundsToHome` above, but then does nothing else — no
 * "Finish Session" tap, no "Another Round" on the last round, no nav bar
 * Back tap. This is the realistic shape of a short session this bug report
 * is actually about: a patient who plays a round or two and simply stops,
 * not one who completes the game's designed exit flow. Neither of the two
 * only callers of `gameStore.endSession` (PatientNav's `onBack`, and
 * `goHome`) ever runs.
 */
async function playPathMatchRoundsThenAbandon(numRounds: number): Promise<void> {
  const { default: PathMatchPage } = await import('@/app/games/path-match/page');
  render(
    <I18nProvider>
      <PathMatchPage />
    </I18nProvider>,
  );

  for (let round = 1; round <= numRounds; round += 1) {
    fireEvent.click(screen.getByText(/start!/i));
    await waitFor(() => expect(screen.getByTestId('path-canvas')).toBeInTheDocument());
    const svg = screen.getByTestId('path-canvas');
    const points = screen.getAllByTestId(/^path-point-/);
    for (const point of points) {
      const circle = point.querySelector('circle')!;
      fireEvent.pointerDown(svg, {
        clientX: Number(circle.getAttribute('cx')),
        clientY: Number(circle.getAttribute('cy')),
      });
    }
    await waitFor(() => expect(screen.getByText(/finish session/i)).toBeInTheDocument());

    if (round < numRounds) {
      fireEvent.click(screen.getByText(/another round/i));
      await waitFor(() => expect(screen.getByText(/start!/i)).toBeInTheDocument());
    }
  }

  // The patient has just reached "round_complete" after their last round
  // and is about to walk away. `completeRound` fires `void logEvent(...)`
  // without awaiting it (so a slow round doesn't block the UI), so its
  // whole chain -- the telemetry_events write, the lazy game_sessions
  // create, and the daily_summaries bump -- may still be in flight at this
  // exact instant. A real tab close wouldn't wait for any of it either, but
  // the assertions below need to observe the end state once it's *all*
  // landed, not mid-flight -- waiting on telemetryEvents alone was observed
  // to occasionally resolve before the daily_summaries write that follows
  // it had committed, under the heavier scheduling contention of a full
  // parallel test run.
  await waitFor(async () => {
    const events = await db.telemetryEvents.where('patientId').equals(PATIENT_ID).toArray();
    expect(events).toHaveLength(numRounds);

    const sessions = await db.gameSessions.where('patientId').equals(PATIENT_ID).toArray();
    expect(sessions).toHaveLength(1);

    const summaries = await db.dailySummaries
      .toCollection()
      .filter((s) => s.patientId === PATIENT_ID)
      .toArray();
    expect(summaries).toHaveLength(1);
    expect(summaries[0].totalRounds).toBe(numRounds);
  });
}

describe('Stage 1 -- local Dexie write: a short play session lands in IndexedDB', () => {
  beforeEach(async () => {
    await db.patients.put(patient());
    usePatientStore.setState({ currentPatient: patient() });
  });

  it('exactly 1 round of Path Match writes 1 gameSessions row, 1 telemetryEvents row, and a dailySummaries row with totalRounds=1', async () => {
    await playPathMatchRoundsToHome(1);

    const sessions = await db.gameSessions.where('patientId').equals(PATIENT_ID).toArray();
    expect(sessions).toHaveLength(1);
    expect(sessions[0].endedAt).not.toBeNull();
    expect(sessions[0].synced).toBe(false);

    const events = await db.telemetryEvents.where('patientId').equals(PATIENT_ID).toArray();
    expect(events).toHaveLength(1);
    expect(events[0].gameType).toBe('path_match');
    expect(events[0].sessionId).toBe(sessions[0].id);

    const summaries = await db.dailySummaries
      .toCollection()
      .filter((s) => s.patientId === PATIENT_ID)
      .toArray();
    expect(summaries).toHaveLength(1);
    expect(summaries[0].totalRounds).toBe(1);
    expect(summaries[0].sessionCount).toBe(1);
    expect(summaries[0].synced).toBe(false);
  });

  it('exactly 2 rounds of Path Match writes 2 telemetryEvents rows and a dailySummaries row with totalRounds=2', async () => {
    await playPathMatchRoundsToHome(2);

    const sessions = await db.gameSessions.where('patientId').equals(PATIENT_ID).toArray();
    expect(sessions).toHaveLength(1);

    const events = await db.telemetryEvents.where('patientId').equals(PATIENT_ID).toArray();
    expect(events).toHaveLength(2);

    const summaries = await db.dailySummaries
      .toCollection()
      .filter((s) => s.patientId === PATIENT_ID)
      .toArray();
    expect(summaries).toHaveLength(1);
    expect(summaries[0].totalRounds).toBe(2);
  });
});

describe('Stage 1b -- Quick Tap\'s per-item telemetry shape also survives a 1-round session', () => {
  it('logs many item-level events under one round number without losing the session or the daily summary', async () => {
    // Quick Tap logs one telemetry event per displayed item, not per round
    // (see src/app/games/quick-tap/page.tsx's logRoundItem) -- a single
    // "round" at level 1 shows 15 items. This exercises that exact shape
    // instead of a synthetic 1-event stand-in for it.
    useGameStore.getState().startSession(PATIENT_ID);
    const sessionId = useGameStore.getState().activeSession!.id;
    for (let i = 0; i < 15; i += 1) {
      await logEvent({
        sessionId,
        patientId: PATIENT_ID,
        gameType: 'quick_tap',
        difficultyLevel: 1,
        roundNumber: 1,
        isCorrect: i % 3 === 0,
        responseTimeMs: i % 3 === 0 ? 450 : null,
        eventTimestamp: new Date().toISOString(),
        metadata: { objectId: 'x', isTarget: i % 3 === 0, tapped: i % 3 === 0, isFalseAlarm: false },
      });
    }
    await useGameStore.getState().endSession();

    const sessions = await db.gameSessions.where('patientId').equals(PATIENT_ID).toArray();
    expect(sessions).toHaveLength(1);

    const events = await db.telemetryEvents.where('patientId').equals(PATIENT_ID).toArray();
    expect(events).toHaveLength(15);

    const summaries = await db.dailySummaries
      .toCollection()
      .filter((s) => s.patientId === PATIENT_ID && s.gameType === 'quick_tap')
      .toArray();
    expect(summaries).toHaveLength(1);
    expect(summaries[0].totalRounds).toBe(15);
    expect(summaries[0].sessionCount).toBe(1);
  });
});

describe('Stage 2 -- sync: a short session is included in the /api/sync push, never skipped for being short', () => {
  async function playRoundsViaStore(numRounds: number): Promise<void> {
    useGameStore.getState().startSession(PATIENT_ID);
    const sessionId = useGameStore.getState().activeSession!.id;
    for (let round = 1; round <= numRounds; round += 1) {
      await logEvent({
        sessionId,
        patientId: PATIENT_ID,
        gameType: 'path_match',
        difficultyLevel: 1,
        roundNumber: round,
        isCorrect: true,
        responseTimeMs: 1200,
        eventTimestamp: new Date().toISOString(),
        metadata: { completedConnections: 3, totalConnections: 3, timeUsedMs: 1200, wrongTaps: 0 },
      });
    }
    await useGameStore.getState().endSession();
  }

  function stubSuccessfulSync(syncedEventCount: number) {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        serverTimestamp: new Date().toISOString(),
        syncedEventCount,
        syncErrors: {},
        updates: { patients: [], reminders: [], alerts: [] },
      }),
    });
    vi.stubGlobal('fetch', fetchMock);
    return fetchMock;
  }

  it('a 1-round session\'s game_sessions/telemetry_events/daily_summaries rows are all present in the POST body', async () => {
    await playRoundsViaStore(1);
    getSession.mockResolvedValue({ data: { session: { access_token: 'tok' } } });
    const fetchMock = stubSuccessfulSync(1);

    const { syncToServer } = await import('@/lib/db/sync');
    const result = await syncToServer(PATIENT_ID);

    expect(result.success).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    const payload = body.patients[0];
    expect(payload.sessions).toHaveLength(1);
    expect(payload.events).toHaveLength(1);
    expect(payload.dailySummaries).toHaveLength(1);
    expect(payload.dailySummaries[0].totalRounds).toBe(1);
  });

  it('a 2-round session is included too, and gets marked synced locally afterward', async () => {
    await playRoundsViaStore(2);
    getSession.mockResolvedValue({ data: { session: { access_token: 'tok' } } });
    const fetchMock = stubSuccessfulSync(2);

    const { syncToServer } = await import('@/lib/db/sync');
    const result = await syncToServer(PATIENT_ID);

    expect(result.success).toBe(true);
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    const payload = body.patients[0];
    expect(payload.events).toHaveLength(2);
    expect(payload.dailySummaries[0].totalRounds).toBe(2);

    const summaries = await db.dailySummaries
      .toCollection()
      .filter((s) => s.patientId === PATIENT_ID)
      .toArray();
    expect(summaries[0].synced).toBe(true);
    const events = await db.telemetryEvents.where('patientId').equals(PATIENT_ID).toArray();
    expect(events.every((e) => e.synced)).toBe(true);
  });
});

describe('Stage 3 -- caregiver dashboard API: a short session\'s daily_summaries row is not filtered out', () => {
  it('GET /api/patients counts a lone 1-round daily_summaries row as today\'s accuracy and this week\'s session', async () => {
    getUser.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null });
    const today = new Date().toISOString().slice(0, 10);

    fromMock.mockImplementation((table: string) => {
      if (table === 'caregivers') return makeChain({ data: { id: 'c1' }, error: null });
      if (table === 'patients') {
        return makeChain({
          data: [
            {
              id: PATIENT_ID,
              caregiver_id: 'c1',
              display_name: 'Aai',
              age_years: 72,
              gender: 'female',
              primary_language: 'as',
              is_active: true,
            },
          ],
          error: null,
        });
      }
      if (table === 'daily_summaries') {
        // Exactly the shape a real 1-round session's summary carries: one
        // row, total_rounds 1, generated column accuracy_pct = 100.
        return makeChain({ data: [{ summary_date: today, accuracy_pct: 100 }], error: null });
      }
      if (table === 'alerts') return makeChain({ data: [], error: null });
      return makeChain({ data: [], error: null });
    });

    const { GET } = await import('@/app/api/patients/route');
    const res = await GET(new Request('http://localhost/api/patients', { headers: { Authorization: 'Bearer tok' } }));

    expect(res.status).toBe(200);
    const body = await res.json();
    const row = body.patients.find((p: { id: string }) => p.id === PATIENT_ID);
    expect(row).toBeDefined();
    expect(row.accuracyToday).toBe(100);
    expect(row.sessionsThisWeek).toBe(1);
    expect(row.latestSummary).not.toBeNull();
  });

  it('GET /api/patients/[id]/timeline includes a point for a 1-round day, unfiltered by round count', async () => {
    getUser.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null });
    const today = new Date().toISOString().slice(0, 10);

    fromMock.mockImplementation((table: string) => {
      if (table === 'caregivers') return makeChain({ data: { id: 'c1' }, error: null });
      if (table === 'patients') return makeChain({ data: { id: PATIENT_ID }, error: null });
      if (table === 'daily_summaries') {
        return makeChain({
          data: [{ summary_date: today, accuracy_pct: 100, game_type: 'path_match', max_difficulty_reached: 1 }],
          error: null,
        });
      }
      return makeChain({ data: [], error: null });
    });

    const { GET } = await import('@/app/api/patients/[id]/timeline/route');
    const res = await GET(
      new Request(`http://localhost/api/patients/${PATIENT_ID}/timeline?range=30d`, {
        headers: { Authorization: 'Bearer tok' },
      }),
      { params: Promise.resolve({ id: PATIENT_ID }) },
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.points).toHaveLength(1);
    expect(body.points[0]).toMatchObject({ date: today, accuracy: 100, gameType: 'path_match' });
  });
});

describe('Stage 4 -- the actual bug: a patient who plays N rounds and just stops (no Finish Session, no Back tap)', () => {
  beforeEach(async () => {
    await db.patients.put(patient());
    usePatientStore.setState({ currentPatient: patient() });
  });

  it('1 completed round, abandoned mid-game, still writes a gameSessions row (endedAt still null, honestly reflecting it was never closed), 1 telemetryEvents row, and a dailySummaries row with totalRounds=1', async () => {
    await playPathMatchRoundsThenAbandon(1);

    const sessions = await db.gameSessions.where('patientId').equals(PATIENT_ID).toArray();
    expect(sessions).toHaveLength(1);
    expect(sessions[0].endedAt).toBeNull();
    expect(sessions[0].synced).toBe(false);

    const events = await db.telemetryEvents.where('patientId').equals(PATIENT_ID).toArray();
    expect(events).toHaveLength(1);
    expect(events[0].gameType).toBe('path_match');
    expect(events[0].sessionId).toBe(sessions[0].id);

    const summaries = await db.dailySummaries
      .toCollection()
      .filter((s) => s.patientId === PATIENT_ID)
      .toArray();
    expect(summaries).toHaveLength(1);
    expect(summaries[0].totalRounds).toBe(1);
    expect(summaries[0].sessionCount).toBe(1);
    expect(summaries[0].synced).toBe(false);
  });

  it('2 completed rounds, abandoned mid-game, writes 2 telemetryEvents rows and a dailySummaries row with totalRounds=2, still exactly 1 gameSessions row', async () => {
    await playPathMatchRoundsThenAbandon(2);

    const sessions = await db.gameSessions.where('patientId').equals(PATIENT_ID).toArray();
    expect(sessions).toHaveLength(1);
    expect(sessions[0].endedAt).toBeNull();

    const events = await db.telemetryEvents.where('patientId').equals(PATIENT_ID).toArray();
    expect(events).toHaveLength(2);

    const summaries = await db.dailySummaries
      .toCollection()
      .filter((s) => s.patientId === PATIENT_ID)
      .toArray();
    expect(summaries).toHaveLength(1);
    expect(summaries[0].totalRounds).toBe(2);
  });
});

describe('Stage 5 -- abandoned session, end-to-end: local write -> /api/sync payload -> caregiver dashboard, with no explicit finish anywhere', () => {
  beforeEach(async () => {
    await db.patients.put(patient());
    usePatientStore.setState({ currentPatient: patient() });
  });

  function stubSuccessfulSync(syncedEventCount: number) {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        serverTimestamp: new Date().toISOString(),
        syncedEventCount,
        syncErrors: {},
        updates: { patients: [], reminders: [], alerts: [] },
      }),
    });
    vi.stubGlobal('fetch', fetchMock);
    return fetchMock;
  }

  it.each([1, 2])(
    'an abandoned %i-round session syncs its game_sessions row (open, endedAt null) in the SAME payload as its telemetry_events rows -- required by the telemetry_events.session_id NOT NULL FK onto game_sessions (docs/03_DATABASE.md) -- and its daily_summaries row is what GET /api/patients then shows the caregiver',
    async (numRounds) => {
      await playPathMatchRoundsThenAbandon(numRounds);
      getSession.mockResolvedValue({ data: { session: { access_token: 'tok' } } });
      const fetchMock = stubSuccessfulSync(numRounds);

      const { syncToServer } = await import('@/lib/db/sync');
      const result = await syncToServer(PATIENT_ID);
      expect(result.success).toBe(true);

      const body = JSON.parse(fetchMock.mock.calls[0][1].body);
      const payload = body.patients[0];
      expect(payload.sessions).toHaveLength(1);
      expect(payload.sessions[0].endedAt).toBeNull();
      expect(payload.events).toHaveLength(numRounds);
      expect(payload.dailySummaries).toHaveLength(1);
      expect(payload.dailySummaries[0].totalRounds).toBe(numRounds);

      // Chain that exact synced daily_summaries payload into a stubbed
      // Supabase response for the caregiver-facing GET, the same shape
      // Stage 3 uses -- proving this specific abandoned session's own
      // numbers are what reaches the dashboard, not a hand-written stand-in.
      getUser.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null });
      const today = new Date().toISOString().slice(0, 10);
      const accuracyPct =
        (payload.dailySummaries[0].correctRounds / payload.dailySummaries[0].totalRounds) * 100;

      fromMock.mockImplementation((table: string) => {
        if (table === 'caregivers') return makeChain({ data: { id: 'c1' }, error: null });
        if (table === 'patients') {
          return makeChain({
            data: [
              {
                id: PATIENT_ID,
                caregiver_id: 'c1',
                display_name: 'Aai',
                age_years: 72,
                gender: 'female',
                primary_language: 'as',
                is_active: true,
              },
            ],
            error: null,
          });
        }
        if (table === 'daily_summaries') {
          return makeChain({ data: [{ summary_date: today, accuracy_pct: accuracyPct }], error: null });
        }
        if (table === 'alerts') return makeChain({ data: [], error: null });
        return makeChain({ data: [], error: null });
      });

      const { GET } = await import('@/app/api/patients/route');
      const res = await GET(new Request('http://localhost/api/patients', { headers: { Authorization: 'Bearer tok' } }));

      expect(res.status).toBe(200);
      const dashboardBody = await res.json();
      const row = dashboardBody.patients.find((p: { id: string }) => p.id === PATIENT_ID);
      expect(row).toBeDefined();
      expect(row.accuracyToday).toBe(100);
      expect(row.sessionsThisWeek).toBe(1);
      expect(row.latestSummary).not.toBeNull();
    },
  );
});
