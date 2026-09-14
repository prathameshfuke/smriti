import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import 'fake-indexeddb/auto';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';

/**
 * Buttons that used to look like they worked but did nothing useful:
 * Remove patient (local-only), Add patient (bounced back to the dashboard),
 * and a family share link that had no page to open.
 */

const push = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, replace: vi.fn() }),
  usePathname: () => '/caregiver/patients',
}));

const getUser = vi.fn();
const getSession = vi.fn();

function makeChain(result: { data: unknown; error: unknown }) {
  const chain: Record<string, unknown> = {};
  for (const method of ['select', 'eq', 'in', 'gte', 'order', 'limit', 'update']) {
    chain[method] = vi.fn(() => chain);
  }
  chain.single = vi.fn(() => Promise.resolve(result));
  chain.then = (resolve: (v: typeof result) => unknown) => resolve(result);
  return chain;
}

const fromMock = vi.fn();

vi.mock('@/lib/supabase/client', () => ({
  isSupabaseConfigured: () => true,
  createBrowserClient: () => ({ auth: { getSession } }),
  createServerClient: () => ({ auth: { getUser }, from: fromMock }),
}));

beforeEach(() => {
  push.mockClear();
  fromMock.mockReset();
  getSession.mockResolvedValue({ data: { session: { access_token: 'tok' } } });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const authed = (method: string) =>
  new Request('http://localhost/api/patients/p1', { method, headers: { Authorization: 'Bearer tok' } });

describe('DELETE /api/patients/[id]', () => {
  it('rejects a request without a session', async () => {
    const { DELETE } = await import('@/app/api/patients/[id]/route');
    const res = await DELETE(new Request('http://localhost/api/patients/p1', { method: 'DELETE' }), {
      params: Promise.resolve({ id: 'p1' }),
    });
    expect(res.status).toBe(401);
  });

  it("refuses to remove another caregiver's patient", async () => {
    getUser.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null });
    fromMock.mockImplementation((table: string) =>
      table === 'caregivers' ? makeChain({ data: { id: 'c1' }, error: null }) : makeChain({ data: null, error: null }),
    );
    const { DELETE } = await import('@/app/api/patients/[id]/route');
    const res = await DELETE(authed('DELETE'), { params: Promise.resolve({ id: 'p1' }) });
    expect(res.status).toBe(404);
  });

  it('soft-deletes an owned patient', async () => {
    getUser.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null });
    const patientsChain = makeChain({ data: { id: 'p1' }, error: null });
    fromMock.mockImplementation((table: string) =>
      table === 'caregivers' ? makeChain({ data: { id: 'c1' }, error: null }) : patientsChain,
    );
    const { DELETE } = await import('@/app/api/patients/[id]/route');
    const res = await DELETE(authed('DELETE'), { params: Promise.resolve({ id: 'p1' }) });
    expect(res.status).toBe(200);
    expect(patientsChain.update).toHaveBeenCalledWith({ is_active: false });
  });
});

describe('Patients page Remove', () => {
  const listBody = {
    patients: [{ id: 'p1', displayName: 'Aai', ageYears: 72, primaryLanguage: 'as', alertStatus: 'green' }],
  };

  it('calls the server and removes the row only after it succeeds', async () => {
    const fetchMock = vi.fn().mockImplementation((url: string, init?: RequestInit) =>
      Promise.resolve({
        ok: true,
        status: 200,
        json: async () => (init?.method === 'DELETE' ? { id: 'p1' } : listBody),
      }),
    );
    vi.stubGlobal('fetch', fetchMock);
    const { default: PatientsPage } = await import('@/app/caregiver/patients/page');
    render(<PatientsPage />);

    fireEvent.click(await screen.findByRole('button', { name: /remove aai/i }));
    fireEvent.click(screen.getByRole('button', { name: /^remove$/i }));

    await waitFor(() => expect(screen.queryByText('Aai')).not.toBeInTheDocument());
    expect(fetchMock).toHaveBeenCalledWith('/api/patients/p1', expect.objectContaining({ method: 'DELETE' }));
  });

  it('keeps the patient and says so when the server refuses', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((_url: string, init?: RequestInit) =>
        Promise.resolve(
          init?.method === 'DELETE'
            ? { ok: false, status: 500, json: async () => ({}) }
            : { ok: true, status: 200, json: async () => listBody },
        ),
      ),
    );
    const { default: PatientsPage } = await import('@/app/caregiver/patients/page');
    render(<PatientsPage />);

    fireEvent.click(await screen.findByRole('button', { name: /remove aai/i }));
    fireEvent.click(screen.getByRole('button', { name: /^remove$/i }));

    expect(await screen.findByText(/could not remove them/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /remove aai/i })).toBeInTheDocument();
  });
});

describe('Add patient', () => {
  it('links to the Add patient flow instead of first-time setup, which bounces back', async () => {
    const { default: AddPatientButton } = await import('@/components/caregiver/AddPatientButton');
    render(<AddPatientButton />);
    expect(screen.getByRole('link', { name: 'Add patient' })).toHaveAttribute('href', '/caregiver/add-patient');
  });
});

describe('Family share page', () => {
  it('shows the weekly view and sends a note', async () => {
    const fetchMock = vi.fn().mockImplementation((url: string, init?: RequestInit) => {
      if (init?.method === 'POST') return Promise.resolve({ ok: true, status: 200, json: async () => ({ status: 'pending' }) });
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({ label: 'Son in Delhi', summary: 'A calm week.', generatedAt: null, sessionsThisWeek: 4 }),
      });
    });
    vi.stubGlobal('fetch', fetchMock);
    const { default: FamilySharePage } = await import('@/app/family/[id]/page');
    render(<FamilySharePage params={Promise.resolve({ id: 'share-1' })} />);

    expect(await screen.findByText(/played on 4 of the last 7 days/i)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/^message$/i), { target: { value: 'Miss you' } });
    fireEvent.click(screen.getByRole('button', { name: /send message/i }));

    expect(await screen.findByText(/caregiver will check it/i)).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith('/api/family-share/share-1/notes', expect.objectContaining({ method: 'POST' }));
  });

  it('says plainly when a link has expired or was revoked', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 401, json: async () => ({}) }));
    const { default: FamilySharePage } = await import('@/app/family/[id]/page');
    render(<FamilySharePage params={Promise.resolve({ id: 'old' })} />);
    expect(await screen.findByText(/this link no longer works/i)).toBeInTheDocument();
  });
});
