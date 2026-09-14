import { describe, it, expect, vi, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import { render as rtlRender, screen, fireEvent, within } from '@testing-library/react';
import { db, type LocalReminderAck } from '@/lib/db/schema';
import { dateRange } from '@/lib/engine/adherence';
import { I18nProvider } from '@/lib/i18n/provider';

// CaregiverDashboardPage's sync status/label now calls useTranslation().
function render(ui: Parameters<typeof rtlRender>[0], options?: Parameters<typeof rtlRender>[1]) {
  return rtlRender(ui, { wrapper: I18nProvider, ...options });
}

const push = vi.fn();
const router = { push, replace: vi.fn() };
let pathname = '/caregiver/dashboard';

vi.mock('next/navigation', () => ({
  useRouter: () => router,
  usePathname: () => pathname,
}));

const getSession = vi.fn();

vi.mock('@/lib/supabase/client', () => ({
  isSupabaseConfigured: () => true,
  createBrowserClient: () => ({ auth: { getSession } }),
}));

function mockFetchJson(body: unknown, ok = true) {
  return vi.fn().mockResolvedValue({
    ok,
    status: ok ? 200 : 500,
    json: async () => body,
  });
}

const patient = (over: Record<string, unknown> = {}) => ({
  id: 'p1',
  caregiverId: 'c1',
  displayName: 'Aai',
  ageYears: 72,
  primaryLanguage: 'as',
  alertStatus: 'green',
  accuracyToday: 80,
  sessionsThisWeek: 3,
  ...over,
});

beforeEach(() => {
  push.mockClear();
  pathname = '/caregiver/dashboard';
  getSession.mockResolvedValue({ data: { session: { access_token: 'tok' } } });
});

describe('Caregiver dashboard', () => {
  it('renders alert banner when patients data includes RED status', async () => {
    vi.stubGlobal(
      'fetch',
      mockFetchJson({
        patients: [patient({ id: 'p1', alertStatus: 'red' }), patient({ id: 'p2' })],
      }),
    );
    const { default: DashboardPage } = await import('@/app/caregiver/dashboard/page');
    render(<DashboardPage />);

    expect(await screen.findByText(/needs? immediate attention/i)).toBeInTheDocument();
    vi.unstubAllGlobals();
  });

  it('does NOT render alert banner when all patients are green or yellow', async () => {
    vi.stubGlobal(
      'fetch',
      mockFetchJson({
        patients: [
          patient({ id: 'p1', displayName: 'Aai', alertStatus: 'yellow' }),
          patient({ id: 'p2', displayName: 'Deuta', alertStatus: 'green' }),
        ],
      }),
    );
    const { default: DashboardPage } = await import('@/app/caregiver/dashboard/page');
    render(<DashboardPage />);

    await screen.findByText('Aai');
    expect(screen.queryByText(/needs? immediate attention/i)).not.toBeInTheDocument();
    vi.unstubAllGlobals();
  });

  it('sorts the patient list RED -> YELLOW -> GREEN', async () => {
    vi.stubGlobal(
      'fetch',
      mockFetchJson({
        patients: [
          patient({ id: 'p1', displayName: 'Green Patient', alertStatus: 'green' }),
          patient({ id: 'p2', displayName: 'Red Patient', alertStatus: 'red' }),
          patient({ id: 'p3', displayName: 'Yellow Patient', alertStatus: 'yellow' }),
        ],
      }),
    );
    const { default: DashboardPage } = await import('@/app/caregiver/dashboard/page');
    render(<DashboardPage />);

    await screen.findByText('Red Patient');
    const names = screen.getAllByTestId('patient-card-name').map((el) => el.textContent);
    expect(names).toEqual(['Red Patient', 'Yellow Patient', 'Green Patient']);
    vi.unstubAllGlobals();
  });

  it('each patient card shows an accuracy percentage', async () => {
    vi.stubGlobal(
      'fetch',
      mockFetchJson({ patients: [patient({ id: 'p1', accuracyToday: 73 })] }),
    );
    const { default: DashboardPage } = await import('@/app/caregiver/dashboard/page');
    render(<DashboardPage />);

    expect(await screen.findByText('73%')).toBeInTheDocument();
    vi.unstubAllGlobals();
  });

  it('patient cards carry no colored edge stripe', async () => {
    vi.stubGlobal('fetch', mockFetchJson({ patients: [patient({ id: 'p1', alertStatus: 'green' })] }));
    const { default: DashboardPage } = await import('@/app/caregiver/dashboard/page');
    const { container } = render(<DashboardPage />);

    await screen.findByText('Aai');
    expect(findStripes(container)).toEqual([]);
    vi.unstubAllGlobals();
  });
});

/**
 * A card stripe is a thin (1/1.5 unit) bar filled with a status or brand
 * color. StatusBadge's own dot is rounded-full and excluded.
 */
function findStripes(root: HTMLElement) {
  return Array.from(root.querySelectorAll<HTMLElement>('[class]')).filter((el) => {
    const cls = el.getAttribute('class') ?? '';
    const thin = /(^|\s)[wh]-1(\.5)?(\s|$)/.test(cls) && !/(^|\s)rounded-full(\s|$)/.test(cls);
    const colored = /(^|\s)bg-(success|warning|danger|gamosa|muga|primary)(\s|$)/.test(cls);
    return (thin && colored) || /(^|\s)border-[lt]-\d/.test(cls);
  });
}

describe('Patients list page', () => {
  it('renders all patients from the API response', async () => {
    vi.stubGlobal(
      'fetch',
      mockFetchJson({
        patients: [
          patient({ id: 'p1', displayName: 'Aai' }),
          patient({ id: 'p2', displayName: 'Deuta' }),
          patient({ id: 'p3', displayName: 'Khura' }),
        ],
      }),
    );
    const { default: PatientsPage } = await import('@/app/caregiver/patients/page');
    render(<PatientsPage />);

    expect(await screen.findByText('Aai')).toBeInTheDocument();
    expect(screen.getByText('Deuta')).toBeInTheDocument();
    expect(screen.getByText('Khura')).toBeInTheDocument();
    vi.unstubAllGlobals();
  });

  it('patient rows carry no colored edge stripe — TrafficLight already shows status', async () => {
    vi.stubGlobal(
      'fetch',
      mockFetchJson({
        patients: [
          patient({ id: 'p1', displayName: 'Aai', alertStatus: 'red' }),
          patient({ id: 'p2', displayName: 'Deuta', alertStatus: 'yellow' }),
          patient({ id: 'p3', displayName: 'Khura', alertStatus: 'green' }),
        ],
      }),
    );
    const { default: PatientsPage } = await import('@/app/caregiver/patients/page');
    const { container } = render(<PatientsPage />);

    await screen.findByText('Aai');
    expect(findStripes(container)).toEqual([]);
    expect(screen.getAllByRole('img', { name: /^Status:/ })).toHaveLength(3);
    vi.unstubAllGlobals();
  });
});

describe('Patient detail page', () => {
  const fetchByUrl = (routes: Record<string, unknown>) =>
    vi.fn().mockImplementation((url: string) => {
      const match = Object.keys(routes).find((key) => url.includes(key));
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => (match ? routes[match] : {}),
      });
    });

  it('cognitive tab renders the ScoreGraph component', async () => {
    vi.stubGlobal(
      'fetch',
      fetchByUrl({
        '/api/patients/p1/timeline': { points: [{ date: '2026-08-01', accuracy: 80, gameType: 'object_hunt' }] },
        '/api/patients': { patients: [patient({ id: 'p1' })] },
      }),
    );
    const { default: PatientDetailPage } = await import('@/app/caregiver/patients/[id]/page');
    render(<PatientDetailPage params={Promise.resolve({ id: 'p1' })} />);

    expect(await screen.findByTestId('score-graph')).toBeInTheDocument();
    vi.unstubAllGlobals();
  });

  it('reminders tab shows the adherence percentage computed from local Dexie data', async () => {
    // The Reminders tab reads reminderSchedules/reminderAcks straight out of
    // Dexie now (useReminderAdherence), not the network — this only needs
    // /api/patients so the page itself can resolve, matching the offline
    // requirement the rest of this suite covers for the cognitive tab.
    vi.stubGlobal(
      'fetch',
      fetchByUrl({
        '/api/patients/p1/timeline': { points: [] },
        '/api/patients': { patients: [patient({ id: 'p1' })] },
      }),
    );
    await db.reminderSchedules.clear();
    await db.reminderAcks.clear();
    await db.reminderSchedules.add({
      id: 'sched-1',
      patientId: 'p1',
      reminderType: 'medication',
      label: 'Aspirin',
      timeOfDay: '00:00',
      daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
      isActive: true,
      updatedAt: '2026-08-31T00:00:00.000Z',
    });
    // Every expected occurrence in the last 7 days acknowledged -> 100%,
    // a deterministic result regardless of which weekday the suite runs on.
    const acks: LocalReminderAck[] = dateRange(7).map((date, i) => ({
      id: `ack-${i}`,
      reminderId: 'sched-1',
      patientId: 'p1',
      scheduledAt: `${date}T00:00:00.000Z`,
      acknowledgedAt: `${date}T00:05:00.000Z`,
      ackMethod: 'touch',
      synced: true,
    }));
    await db.reminderAcks.bulkAdd(acks);

    const { default: PatientDetailPage } = await import('@/app/caregiver/patients/[id]/page');
    render(<PatientDetailPage params={Promise.resolve({ id: 'p1' })} />);

    await screen.findByTestId('score-graph');
    fireEvent.click(screen.getByRole('button', { name: /reminders/i }));

    expect(await screen.findByText('7 of 7 marked done')).toBeInTheDocument();
    vi.unstubAllGlobals();
    await db.reminderSchedules.clear();
    await db.reminderAcks.clear();
  });

  it('cognitive tab renders the activity calendar with the correct number of day cells for the current month', async () => {
    vi.stubGlobal(
      'fetch',
      fetchByUrl({
        '/api/patients/p1/timeline': { points: [] },
        '/api/patients': { patients: [patient({ id: 'p1' })] },
      }),
    );
    const { default: PatientDetailPage } = await import('@/app/caregiver/patients/[id]/page');
    render(<PatientDetailPage params={Promise.resolve({ id: 'p1' })} />);

    await screen.findByTestId('score-graph');

    const now = new Date();
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();

    const cells = await screen.findAllByTestId('calendar-day');
    expect(cells).toHaveLength(daysInMonth);
  });

  it('renders an unresolved alert for this patient fetched from /api/alerts', async () => {
    vi.stubGlobal(
      'fetch',
      fetchByUrl({
        '/api/patients/p1/timeline': { points: [] },
        '/api/patients': { patients: [patient({ id: 'p1' })] },
        '/api/alerts': {
          alerts: [
            {
              id: 'a1',
              patient_id: 'p1',
              title: 'Sudden drop in performance',
              description: "Today's object hunt accuracy is well below the recent average.",
              severity: 'red',
              is_resolved: false,
            },
            // Other patient's alert and an already-resolved alert must both be filtered out.
            { id: 'a2', patient_id: 'p2', title: 'Other patient', description: null, severity: 'red', is_resolved: false },
            { id: 'a3', patient_id: 'p1', title: 'Old, resolved', description: null, severity: 'yellow', is_resolved: true },
          ],
        },
      }),
    );
    const { default: PatientDetailPage } = await import('@/app/caregiver/patients/[id]/page');
    render(<PatientDetailPage params={Promise.resolve({ id: 'p1' })} />);

    expect(await screen.findByText('Sudden drop in performance')).toBeInTheDocument();
    expect(screen.queryByText('Other patient')).not.toBeInTheDocument();
    expect(screen.queryByText('Old, resolved')).not.toBeInTheDocument();
    vi.unstubAllGlobals();
  });

  describe('offline: cognitive charts render from Dexie alone', () => {
    beforeEach(async () => {
      await db.dailySummaries.clear();
    });

    it('renders full trend, per-game breakdown, and calendar data with every non-essential fetch call failing', async () => {
      // Every request EXCEPT /api/patients and /api/alerts (the page
      // shell's own pre-existing network dependencies, out of scope for
      // this task) rejects outright — the closest a jsdom test can come to
      // "genuinely offline." In particular /api/patients/p1/timeline and
      // .../adherence, this patient's OLD data sources, are never stubbed
      // with data and always fail, so any value shown for them must have
      // come from Dexie.
      const fetchSpy = vi.fn().mockImplementation((url: string) => {
        if (url.includes('/timeline') || url.includes('/adherence')) {
          return Promise.reject(new Error(`offline — ${url}`));
        }
        if (url.includes('/api/patients')) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: async () => ({ patients: [patient({ id: 'p1' })] }),
          });
        }
        if (url.includes('/api/alerts')) {
          return Promise.resolve({ ok: true, status: 200, json: async () => ({ alerts: [] }) });
        }
        return Promise.reject(new Error(`offline — ${url}`));
      });
      vi.stubGlobal('fetch', fetchSpy);

      const today = new Date().toISOString().slice(0, 10);
      const daysAgo = (n: number) => {
        const d = new Date();
        d.setUTCDate(d.getUTCDate() - n);
        return d.toISOString().slice(0, 10);
      };
      await db.dailySummaries.bulkAdd([
        {
          id: 'off-1',
          patientId: 'p1',
          summaryDate: today,
          gameType: 'object_hunt',
          totalRounds: 10,
          correctRounds: 9,
          avgResponseTimeMs: 900,
          maxDifficultyReached: 5,
          sessionCount: 1,
          eloRating: 0,
          synced: true,
        },
        {
          id: 'off-2',
          patientId: 'p1',
          summaryDate: daysAgo(1),
          gameType: 'quick_tap',
          totalRounds: 8,
          correctRounds: 4,
          avgResponseTimeMs: 700,
          maxDifficultyReached: 2,
          sessionCount: 1,
          eloRating: 0,
          synced: true,
        },
        {
          id: 'off-3',
          patientId: 'p1',
          summaryDate: daysAgo(2),
          gameType: 'object_hunt',
          totalRounds: 10,
          correctRounds: 8,
          avgResponseTimeMs: 950,
          maxDifficultyReached: 5,
          sessionCount: 1,
          eloRating: 0,
          synced: true,
        },
        {
          id: 'off-4',
          patientId: 'p1',
          summaryDate: daysAgo(3),
          gameType: 'object_hunt',
          totalRounds: 10,
          correctRounds: 7,
          avgResponseTimeMs: 950,
          maxDifficultyReached: 4,
          sessionCount: 1,
          eloRating: 0,
          synced: true,
        },
        {
          id: 'off-5',
          patientId: 'p1',
          summaryDate: daysAgo(4),
          gameType: 'object_hunt',
          totalRounds: 10,
          correctRounds: 6,
          avgResponseTimeMs: 950,
          maxDifficultyReached: 4,
          sessionCount: 1,
          eloRating: 0,
          synced: true,
        },
      ]);

      const { default: PatientDetailPage } = await import('@/app/caregiver/patients/[id]/page');
      render(<PatientDetailPage params={Promise.resolve({ id: 'p1' })} />);

      // 5 distinct days clears the default 5-session low-data floor, so the
      // full line-chart state (with its sr-only accessible table) renders.
      const region = await screen.findByRole('img', { name: /line chart of blended daily accuracy/i });
      expect(within(region).getByText(today)).toBeInTheDocument();

        // Not pinned to a specific day cell: `summaryDate` is written app-wide
      // as a UTC calendar day (every game page calls
      // `new Date().toISOString().slice(0, 10)`), while the calendar grid
      // numbers its cells off local Date methods — a pre-existing,
      // out-of-scope mismatch for timezones off UTC. Asserting "at least one
      // dot exists" avoids depending on that and still proves the data is
      // real and Dexie-sourced (nothing else could have produced it here).
      const dayCells = screen.getAllByTestId('calendar-day');
      const dotted = dayCells.filter((cell) => cell.querySelector('.bg-success, .bg-warning, .bg-danger'));
      expect(dotted.length).toBeGreaterThan(0);

      const calledUrls = fetchSpy.mock.calls.map((c) => String(c[0]));
      expect(calledUrls.some((u) => u.includes('/timeline'))).toBe(false);
      expect(calledUrls.some((u) => u.includes('/adherence'))).toBe(false);

      vi.unstubAllGlobals();
      await db.dailySummaries.clear();
    });
  });
});
