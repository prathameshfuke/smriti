// @vitest-environment node
//
// Mirrors src/tests/companion-api.test.ts: Node environment (real Request/
// FormData), a chainable Postgrest-like fake for the Supabase client, no DOM.
import { describe, it, expect, vi, beforeEach } from 'vitest';

process.env.FAMILY_SHARE_SECRET = 'test-only-secret-do-not-use-in-production';

const getUser = vi.fn();

function makeChain(result: { data: unknown; error: unknown }) {
  const chain: Record<string, unknown> = {};
  for (const method of ['select', 'eq', 'in', 'order', 'limit', 'insert', 'update', 'gte', 'lte']) {
    chain[method] = vi.fn(() => chain);
  }
  chain.single = vi.fn(() => Promise.resolve(result));
  chain.then = (resolve: (v: typeof result) => unknown) => resolve(result);
  return chain;
}

/** Per-table result table so a single mock can answer differently by table name. */
const tableResults = new Map<string, { data: unknown; error: unknown }>();
function setTable(table: string, result: { data: unknown; error: unknown }) {
  tableResults.set(table, result);
}
const fromMock = vi.fn((table: string) => makeChain(tableResults.get(table) ?? { data: null, error: null }));

vi.mock('@/lib/supabase/client', () => ({
  isSupabaseConfigured: () => true,
  createServerClient: () => ({ auth: { getUser }, from: fromMock }),
  createServiceRoleClient: () => ({ from: fromMock }),
}));

const CAREGIVER_ID = 'cg-1';
const PATIENT_ID = 'patient-1';
const OTHER_PATIENT_ID = 'patient-other';

beforeEach(() => {
  getUser.mockReset();
  fromMock.mockClear();
  tableResults.clear();
  getUser.mockResolvedValue({ data: { user: { id: 'auth-uid-1' } }, error: null });
});

function authedRequest(url: string, init?: RequestInit) {
  return new Request(url, {
    ...init,
    headers: { ...init?.headers, Authorization: 'Bearer test-token' },
  });
}

describe('POST /api/family-share (issue)', () => {
  it('mints a share only after confirming the caregiver owns the patient', async () => {
    setTable('caregivers', { data: { id: CAREGIVER_ID }, error: null });
    setTable('patients', { data: { id: PATIENT_ID }, error: null });
    setTable('family_shares', { data: { id: 'share-1' }, error: null });

    const { POST } = await import('@/app/api/family-share/route');
    const res = await POST(
      authedRequest('http://localhost/api/family-share', {
        method: 'POST',
        body: JSON.stringify({ patientId: PATIENT_ID, label: 'Son in Delhi' }),
      }),
    );
    expect(res.status).toBe(200);
  });

  it('refuses to mint a share for a patient the caller does not own', async () => {
    setTable('caregivers', { data: { id: CAREGIVER_ID }, error: null });
    setTable('patients', { data: null, error: null });

    const { POST } = await import('@/app/api/family-share/route');
    const res = await POST(
      authedRequest('http://localhost/api/family-share', {
        method: 'POST',
        body: JSON.stringify({ patientId: OTHER_PATIENT_ID, label: 'x' }),
      }),
    );
    expect(res.status).toBe(404);
  });
});

describe('GET /api/family-share/[id] (read-only family view)', () => {
  it('returns only digest text and engagement data — never raw session, Memory Bank, or companion-log fields', async () => {
    const expiresAt = new Date(Date.now() + 86400000).toISOString();
    const { signFamilyShare } = await import('@/lib/family/familyShareServer');
    const signature = signFamilyShare('share-1', PATIENT_ID, new Date(expiresAt));

    setTable('family_shares', {
      data: {
        id: 'share-1',
        patient_id: PATIENT_ID,
        signature,
        expires_at: expiresAt,
        revoked_at: null,
      },
      error: null,
    });
    setTable('caregiver_digests', {
      data: { summary_text: 'A good week overall.', generated_at: new Date().toISOString() },
      error: null,
    });
    setTable('daily_summaries', { data: [{ summary_date: '2026-09-01' }, { summary_date: '2026-09-02' }], error: null });

    const { GET } = await import('@/app/api/family-share/[id]/route');
    const res = await GET(new Request('http://localhost/api/family-share/share-1'), {
      params: Promise.resolve({ id: 'share-1' }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();

    const allowedKeys = ['summary', 'generatedAt', 'sessionsThisWeek', 'label'];
    for (const key of Object.keys(body)) {
      expect(allowedKeys).toContain(key);
    }
    // Explicit negative assertions, not just the whitelist above — guards
    // against a future field rename accidentally slipping something through.
    const serialized = JSON.stringify(body);
    expect(serialized).not.toMatch(/question|answer|memory_bank|photo_url|patient_id|caregiver_id|other_patient|patient-other/i);
  });

  it('rejects an expired share', async () => {
    const expiresAt = new Date(Date.now() - 1000).toISOString();
    const { signFamilyShare } = await import('@/lib/family/familyShareServer');
    const signature = signFamilyShare('share-2', PATIENT_ID, new Date(expiresAt));
    setTable('family_shares', {
      data: { id: 'share-2', patient_id: PATIENT_ID, signature, expires_at: expiresAt, revoked_at: null },
      error: null,
    });

    const { GET } = await import('@/app/api/family-share/[id]/route');
    const res = await GET(new Request('http://localhost/api/family-share/share-2'), {
      params: Promise.resolve({ id: 'share-2' }),
    });
    expect(res.status).toBe(401);
  });

  it('rejects a revoked share even before expiry', async () => {
    const expiresAt = new Date(Date.now() + 86400000).toISOString();
    const { signFamilyShare } = await import('@/lib/family/familyShareServer');
    const signature = signFamilyShare('share-3', PATIENT_ID, new Date(expiresAt));
    setTable('family_shares', {
      data: {
        id: 'share-3',
        patient_id: PATIENT_ID,
        signature,
        expires_at: expiresAt,
        revoked_at: new Date().toISOString(),
      },
      error: null,
    });

    const { GET } = await import('@/app/api/family-share/[id]/route');
    const res = await GET(new Request('http://localhost/api/family-share/share-3'), {
      params: Promise.resolve({ id: 'share-3' }),
    });
    expect(res.status).toBe(401);
  });
});

describe('POST /api/family-share/[id]/notes', () => {
  it('a note on a review_required share is stored as pending, not immediately visible to the patient', async () => {
    const expiresAt = new Date(Date.now() + 86400000).toISOString();
    const { signFamilyShare } = await import('@/lib/family/familyShareServer');
    const signature = signFamilyShare('share-4', PATIENT_ID, new Date(expiresAt));
    setTable('family_shares', {
      data: {
        id: 'share-4',
        patient_id: PATIENT_ID,
        signature,
        expires_at: expiresAt,
        revoked_at: null,
        review_required: true,
      },
      error: null,
    });
    let insertedStatus: string | undefined;
    fromMock.mockImplementation((table: string) => {
      if (table === 'family_notes') {
        const chain = makeChain({ data: { id: 'note-1', status: 'pending' }, error: null });
        chain.insert = vi.fn((rowOrRows: { status: string } | Array<{ status: string }>) => {
          const row = Array.isArray(rowOrRows) ? rowOrRows[0] : rowOrRows;
          insertedStatus = row?.status;
          return chain;
        });
        return chain;
      }
      return makeChain(tableResults.get(table) ?? { data: null, error: null });
    });

    const { POST } = await import('@/app/api/family-share/[id]/notes/route');
    const res = await POST(
      new Request('http://localhost/api/family-share/share-4/notes', {
        method: 'POST',
        body: JSON.stringify({ text: 'Proud of you, Ma!' }),
      }),
      { params: Promise.resolve({ id: 'share-4' }) },
    );
    expect(res.status).toBe(200);
    expect(insertedStatus).toBe('pending');
  });
});

describe('GET /api/patients/[id]/surface-note (patient-facing, rate-limited)', () => {
  it('surfaces at most 1 note per day — a second call the same day returns none even if more are approved', async () => {
    setTable('caregivers', { data: { id: CAREGIVER_ID }, error: null });
    setTable('patients', { data: { id: PATIENT_ID }, error: null });
    setTable('family_notes', {
      data: [{ id: 'note-a', text: 'Hi', status: 'approved', surfaced_at: null, created_at: new Date().toISOString() }],
      error: null,
    });
    // Already surfaced one today.
    const todaySurfaced = { data: [{ id: 'note-z', surfaced_at: new Date().toISOString() }], error: null };
    fromMock.mockImplementation((table: string) => {
      if (table === 'family_notes') {
        const chain = makeChain(todaySurfaced);
        return chain;
      }
      return makeChain(tableResults.get(table) ?? { data: null, error: null });
    });

    const { GET } = await import('@/app/api/patients/[id]/surface-note/route');
    const res = await GET(authedRequest(`http://localhost/api/patients/${PATIENT_ID}/surface-note`), {
      params: Promise.resolve({ id: PATIENT_ID }),
    });
    const body = await res.json();
    expect(body.note).toBeNull();
  });
});
