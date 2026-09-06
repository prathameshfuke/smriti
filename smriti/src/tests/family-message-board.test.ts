// @vitest-environment node
//
// Family message board: extends family_notes (see family-sharing.test.ts)
// with sender identity, photo, caregiver-direct posting, a patient-facing
// feed, and a "Seen" ack. Same chainable Postgrest-like fake as
// family-sharing.test.ts.
import { describe, it, expect, vi, beforeEach } from 'vitest';

process.env.FAMILY_SHARE_SECRET = 'test-only-secret-do-not-use-in-production';
process.env.DEVICE_TRUST_SECRET = 'test-only-device-secret-do-not-use-in-production';

const getUser = vi.fn();

function makeChain(result: { data: unknown; error: unknown }) {
  const chain: Record<string, unknown> = {};
  for (const method of ['select', 'eq', 'in', 'order', 'limit', 'insert', 'update', 'gte', 'lte', 'is']) {
    chain[method] = vi.fn(() => chain);
  }
  chain.single = vi.fn(() => Promise.resolve(result));
  chain.then = (resolve: (v: typeof result) => unknown) => resolve(result);
  return chain;
}

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

beforeEach(() => {
  getUser.mockReset();
  fromMock.mockReset();
  fromMock.mockImplementation((table: string) => makeChain(tableResults.get(table) ?? { data: null, error: null }));
  tableResults.clear();
  getUser.mockResolvedValue({ data: { user: { id: 'auth-uid-1' } }, error: null });
});

function authedRequest(url: string, init?: RequestInit) {
  return new Request(url, {
    ...init,
    headers: { ...init?.headers, Authorization: 'Bearer test-token' },
  });
}

describe('POST /api/patients/[id]/family-notes (caregiver-direct post)', () => {
  it('inserts an already-approved message with no family_share_id, tied to the caregiver instead', async () => {
    setTable('caregivers', { data: { id: CAREGIVER_ID }, error: null });
    setTable('patients', { data: { id: PATIENT_ID }, error: null });

    let inserted: Record<string, unknown> | undefined;
    fromMock.mockImplementation((table: string) => {
      if (table === 'family_notes') {
        const chain = makeChain({ data: { id: 'note-1' }, error: null });
        chain.insert = vi.fn((row: Record<string, unknown>) => {
          inserted = row;
          return chain;
        });
        return chain;
      }
      return makeChain(tableResults.get(table) ?? { data: null, error: null });
    });

    const { POST } = await import('@/app/api/patients/[id]/family-notes/route');
    const res = await POST(
      authedRequest(`http://localhost/api/patients/${PATIENT_ID}/family-notes`, {
        method: 'POST',
        body: JSON.stringify({ text: 'Thinking of you today!', senderName: 'Asha', senderRelation: 'Daughter' }),
      }),
      { params: Promise.resolve({ id: PATIENT_ID }) },
    );

    expect(res.status).toBe(200);
    expect(inserted?.status).toBe('approved');
    expect(inserted?.family_share_id).toBeNull();
    expect(inserted?.posted_by_caregiver_id).toBe(CAREGIVER_ID);
    expect(inserted?.sender_name).toBe('Asha');
  });

  it('refuses to post for a patient the caller does not own', async () => {
    setTable('caregivers', { data: { id: CAREGIVER_ID }, error: null });
    setTable('patients', { data: null, error: null });

    const { POST } = await import('@/app/api/patients/[id]/family-notes/route');
    const res = await POST(
      authedRequest(`http://localhost/api/patients/${PATIENT_ID}/family-notes`, {
        method: 'POST',
        body: JSON.stringify({ text: 'hi' }),
      }),
      { params: Promise.resolve({ id: PATIENT_ID }) },
    );
    expect(res.status).toBe(404);
  });

  it('rejects an empty message', async () => {
    setTable('caregivers', { data: { id: CAREGIVER_ID }, error: null });
    setTable('patients', { data: { id: PATIENT_ID }, error: null });

    const { POST } = await import('@/app/api/patients/[id]/family-notes/route');
    const res = await POST(
      authedRequest(`http://localhost/api/patients/${PATIENT_ID}/family-notes`, {
        method: 'POST',
        body: JSON.stringify({ text: '   ' }),
      }),
      { params: Promise.resolve({ id: PATIENT_ID }) },
    );
    expect(res.status).toBe(400);
  });
});

describe('GET /api/patients/[id]/family-notes/feed (patient-facing, device-trust)', () => {
  it('returns approved/surfaced messages for a valid device-trust token', async () => {
    const { signDeviceTrust } = await import('@/lib/auth/deviceTrustServer');
    const token = signDeviceTrust(PATIENT_ID, CAREGIVER_ID);

    setTable('family_notes', {
      data: [
        {
          id: 'note-1',
          text: 'Miss you!',
          sender_name: 'Ravi',
          sender_relation: 'Son',
          photo_url: null,
          created_at: new Date().toISOString(),
          seen_at: null,
        },
      ],
      error: null,
    });

    const { GET } = await import('@/app/api/patients/[id]/family-notes/feed/route');
    const res = await GET(
      new Request(
        `http://localhost/api/patients/${PATIENT_ID}/family-notes/feed?deviceTrustToken=${encodeURIComponent(
          JSON.stringify(token),
        )}`,
      ),
      { params: Promise.resolve({ id: PATIENT_ID }) },
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.notes).toHaveLength(1);
    expect(body.notes[0]).toMatchObject({ senderName: 'Ravi', senderRelation: 'Son', text: 'Miss you!' });
  });

  it('rejects a device-trust token for a different patient', async () => {
    const { signDeviceTrust } = await import('@/lib/auth/deviceTrustServer');
    const token = signDeviceTrust('other-patient', CAREGIVER_ID);
    setTable('caregivers', { data: null, error: null });

    const { GET } = await import('@/app/api/patients/[id]/family-notes/feed/route');
    const res = await GET(
      new Request(
        `http://localhost/api/patients/${PATIENT_ID}/family-notes/feed?deviceTrustToken=${encodeURIComponent(
          JSON.stringify(token),
        )}`,
      ),
      { params: Promise.resolve({ id: PATIENT_ID }) },
    );
    expect(res.status).toBe(401);
  });
});

describe('POST /api/patients/[id]/family-notes/[noteId]/seen (patient acknowledgement)', () => {
  it('stamps seen_at only when it is currently null (idempotent)', async () => {
    const { signDeviceTrust } = await import('@/lib/auth/deviceTrustServer');
    const token = signDeviceTrust(PATIENT_ID, CAREGIVER_ID);

    let updatePayload: Record<string, unknown> | undefined;
    fromMock.mockImplementation((table: string) => {
      if (table === 'family_notes') {
        const chain = makeChain({ data: null, error: null });
        chain.update = vi.fn((payload: Record<string, unknown>) => {
          updatePayload = payload;
          return chain;
        });
        return chain;
      }
      return makeChain(tableResults.get(table) ?? { data: null, error: null });
    });

    const { POST } = await import('@/app/api/patients/[id]/family-notes/[noteId]/seen/route');
    const res = await POST(
      new Request(
        `http://localhost/api/patients/${PATIENT_ID}/family-notes/note-1/seen?deviceTrustToken=${encodeURIComponent(
          JSON.stringify(token),
        )}`,
        { method: 'POST' },
      ),
      { params: Promise.resolve({ id: PATIENT_ID, noteId: 'note-1' }) },
    );

    expect(res.status).toBe(200);
    expect(updatePayload?.seen_at).toBeTruthy();
  });
});
