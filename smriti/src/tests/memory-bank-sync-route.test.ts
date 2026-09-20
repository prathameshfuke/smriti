import { describe, it, expect, vi } from 'vitest';

const getUser = vi.fn();

function makeChain(result: { data: unknown; error: unknown }) {
  const chain: Record<string, unknown> = {};
  for (const method of ['select', 'eq', 'in', 'gte', 'order', 'limit', 'upsert', 'insert', 'update']) {
    chain[method] = vi.fn(() => chain);
  }
  chain.single = vi.fn(() => Promise.resolve(result));
  chain.maybeSingle = vi.fn(() => Promise.resolve(result));
  chain.then = (resolve: (v: typeof result) => unknown) => resolve(result);
  return chain as Record<string, ReturnType<typeof vi.fn>> & PromiseLike<typeof result>;
}

const fromMock = vi.fn();

vi.mock('@/lib/supabase/client', () => ({
  isSupabaseConfigured: () => true,
  createBrowserClient: () => ({}),
  createServerClient: () => ({ auth: { getUser }, from: fromMock }),
}));

const enc = (s: string) => `enc1:${Buffer.from(s).toString('base64')}`;

function entry(over: Record<string, unknown> = {}) {
  return {
    id: 'mb-1',
    patient_id: 'p1',
    category: 'person',
    title: enc('t'),
    detail: enc('d'),
    relationship: null,
    photo_url: null,
    active: true,
    created_by: 'c1',
    updated_at: '2026-09-20T10:00:00.000Z',
    ...over,
  };
}

async function post(userId: string, memoryBankEntries: unknown[], stored: unknown[]) {
  getUser.mockResolvedValue({ data: { user: { id: userId } }, error: null });
  const mbChain = makeChain({ data: stored, error: null });
  fromMock.mockImplementation((table: string) => {
    if (table === 'caregivers') return makeChain({ data: { id: 'c1' }, error: null });
    if (table === 'patients') return makeChain({ data: [{ id: 'p1' }], error: null });
    if (table === 'memory_bank_entries') return mbChain;
    return makeChain({ data: [], error: null });
  });
  const { POST } = await import('@/app/api/sync/route');
  const res = await POST(
    new Request('http://localhost/api/sync', {
      method: 'POST',
      headers: { Authorization: 'Bearer tok', 'Content-Type': 'application/json' },
      body: JSON.stringify({
        deviceId: 'd1',
        lastSyncTimestamp: null,
        patients: [{ patientId: 'p1', sessions: [], events: [], dailySummaries: [], reminderAcks: [], memoryBankEntries }],
      }),
    }),
  );
  return { res, body: await res.json(), mbChain };
}

describe('POST /api/sync — Memory Bank', () => {
  it('refuses plain-text entries and stores nothing', async () => {
    const { body, mbChain } = await post('u-plain', [entry({ title: 'Meena', detail: 'Your daughter' })], []);
    expect(body.syncErrors.p1.memoryBankEntries).toMatch(/encrypted/);
    expect(mbChain.upsert).not.toHaveBeenCalled();
  });

  it('refuses a plain-text relationship even when title and detail are encrypted', async () => {
    const { body, mbChain } = await post('u-rel', [entry({ relationship: 'daughter' })], []);
    expect(body.syncErrors.p1.memoryBankEntries).toMatch(/encrypted/);
    expect(mbChain.upsert).not.toHaveBeenCalled();
  });

  it('stores encrypted entries', async () => {
    const { body, mbChain } = await post('u-ok', [entry()], []);
    expect(body.syncErrors.p1).toBeUndefined();
    expect(mbChain.upsert).toHaveBeenCalledWith([expect.objectContaining({ id: 'mb-1', title: enc('t') })], {
      onConflict: 'id',
    });
  });

  it('does not overwrite a newer stored edit (last write wins)', async () => {
    const { body, mbChain } = await post('u-lww', [entry({ updated_at: '2026-09-20T09:00:00.000Z' })], [
      { id: 'mb-1', updated_at: '2026-09-20T10:00:00.000Z' },
    ]);
    expect(body.syncErrors.p1).toBeUndefined();
    expect(mbChain.upsert).not.toHaveBeenCalled();
  });
});
