import { describe, it, expect, vi, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import { render, screen, fireEvent } from '@testing-library/react';

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

    expect(await screen.findByText(/need immediate attention/i)).toBeInTheDocument();
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
    expect(screen.queryByText(/need immediate attention/i)).not.toBeInTheDocument();
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
});

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

  it('reminders tab shows the adherence percentage from the adherence API', async () => {
    vi.stubGlobal(
      'fetch',
      fetchByUrl({
        '/api/patients/p1/timeline': { points: [] },
        '/api/patients/p1/adherence': {
          overallPct: 64,
          byType: {},
          missed: [],
        },
        '/api/patients': { patients: [patient({ id: 'p1' })] },
      }),
    );
    const { default: PatientDetailPage } = await import('@/app/caregiver/patients/[id]/page');
    render(<PatientDetailPage params={Promise.resolve({ id: 'p1' })} />);

    await screen.findByTestId('score-graph');
    fireEvent.click(screen.getByRole('button', { name: /reminders/i }));

    expect(await screen.findByText(/64% reminders acknowledged this week/i)).toBeInTheDocument();
    vi.unstubAllGlobals();
  });

  it('history tab renders a calendar with the correct number of day cells for the current month', async () => {
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
    fireEvent.click(screen.getByRole('button', { name: /history/i }));

    const now = new Date();
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();

    const cells = await screen.findAllByTestId('calendar-day');
    expect(cells).toHaveLength(daysInMonth);
  });
});
