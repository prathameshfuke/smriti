import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// The param's type is what keeps later .mockImplementation((table: string) => ...)
// calls in this file type-checking against the same shape.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const serviceFromMock = vi.fn((_table: string) => makeChain({ data: [], error: null }));
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const callerFromMock = vi.fn((_table: string) => makeChain({ data: [], error: null }));
const getUser = vi.fn();

function makeChain(result: { data: unknown; error: unknown }) {
  const chain: Record<string, unknown> = {};
  for (const method of ['select', 'eq', 'gte', 'lte', 'in', 'order', 'limit', 'insert', 'upsert', 'update']) {
    chain[method] = vi.fn(() => chain);
  }
  chain.single = vi.fn(() => Promise.resolve(result));
  chain.then = (resolve: (v: typeof result) => unknown) => resolve(result);
  return chain;
}

vi.mock('@/lib/supabase/client', () => ({
  isSupabaseConfigured: () => true,
  createServerClient: () => ({ auth: { getUser }, from: callerFromMock }),
  createServiceRoleClient: () => ({ from: serviceFromMock }),
}));

vi.mock('@/lib/ai/llm-client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/ai/llm-client')>();
  return { ...actual, callLLM: vi.fn() };
});

function makeAuthedRequest(path: string, body?: Record<string, unknown>) {
  return new Request(`http://localhost${path}`, {
    method: body ? 'POST' : 'GET',
    headers: { Authorization: 'Bearer tok', 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
}

beforeEach(async () => {
  getUser.mockReset();
  serviceFromMock.mockReset();
  callerFromMock.mockReset();
  getUser.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null });
  callerFromMock.mockImplementation((table: string) => {
    if (table === 'caregivers') return makeChain({ data: { id: 'c1' }, error: null });
    if (table === 'patients') return makeChain({ data: { id: 'p1' }, error: null });
    return makeChain({ data: [], error: null });
  });
  serviceFromMock.mockImplementation(() => makeChain({ data: [], error: null }));
  const { callLLM } = await import('@/lib/ai/llm-client');
  vi.mocked(callLLM).mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// digest-safety.ts (pure)
// ---------------------------------------------------------------------------
describe('containsForbiddenWord', () => {
  it('detects each forbidden word standalone and mid-sentence', async () => {
    const { containsForbiddenWord } = await import('@/lib/ai/digest-safety');
    expect(containsForbiddenWord('This may indicate dementia.')).toBe(true);
    expect(containsForbiddenWord('a decline in scores')).toBe(true);
    expect(containsForbiddenWord('cognition appears affected')).toBe(true);
    expect(containsForbiddenWord('a worsening condition')).toBe(true);
  });

  it('is case-insensitive', async () => {
    const { containsForbiddenWord } = await import('@/lib/ai/digest-safety');
    expect(containsForbiddenWord('DEMENTIA risk')).toBe(true);
  });

  it('passes a clean sentence with none of the words', async () => {
    const { containsForbiddenWord } = await import('@/lib/ai/digest-safety');
    expect(containsForbiddenWord('Raju completed 4 games this week with 82% accuracy.')).toBe(false);
  });
});

describe('shouldRegenerateDigest', () => {
  it('is true when there is no prior digest', async () => {
    const { shouldRegenerateDigest } = await import('@/lib/ai/digest-safety');
    expect(shouldRegenerateDigest(null)).toBe(true);
  });

  it('is true when the last digest is 8 days old and false when 3 days old', async () => {
    const { shouldRegenerateDigest } = await import('@/lib/ai/digest-safety');
    const eightDaysAgo = new Date(Date.now() - 8 * 86400000).toISOString();
    const threeDaysAgo = new Date(Date.now() - 3 * 86400000).toISOString();
    expect(shouldRegenerateDigest(eightDaysAgo)).toBe(true);
    expect(shouldRegenerateDigest(threeDaysAgo)).toBe(false);
  });
});

describe('buildFallbackDigest', () => {
  it('never contains a forbidden word and reflects the given numbers', async () => {
    const { buildFallbackDigest, containsForbiddenWord } = await import('@/lib/ai/digest-safety');
    const text = buildFallbackDigest({ gamesPlayed: 12, avgAccuracyPct: 76, adherencePct: 60 });
    expect(containsForbiddenWord(text)).toBe(false);
    expect(text).toContain('12');
    expect(text).toContain('76');
    expect(text).toContain('60');
  });
});

// ---------------------------------------------------------------------------
// POST /api/ai/generate-digest
// ---------------------------------------------------------------------------
describe('POST /api/ai/generate-digest', () => {
  it('produces a non-empty summary from a 7-day pull and never calls the LLM again once cached today', async () => {
    const summariesChain = makeChain({
      data: [{ summary_date: new Date().toISOString().slice(0, 10), game_type: 'object_hunt', accuracy_pct: 80 }],
      error: null,
    });
    const logChain = makeChain({ data: [{ grounded: true }, { grounded: false }], error: null });
    const digestChain = makeChain({ data: null, error: null });
    const scheduleChain = makeChain({ data: [], error: null });
    const ackChain = makeChain({ data: [], error: null });
    serviceFromMock.mockImplementation((table: string) => {
      if (table === 'daily_summaries') return summariesChain;
      if (table === 'ai_conversation_log') return logChain;
      if (table === 'caregiver_digests') return digestChain;
      if (table === 'reminder_schedules') return scheduleChain;
      if (table === 'reminder_acks') return ackChain;
      return makeChain({ data: [], error: null });
    });
    const { callLLM } = await import('@/lib/ai/llm-client');
    vi.mocked(callLLM).mockResolvedValue({
      text: 'Raju completed several games this week with steady accuracy. Reminders were mostly acknowledged on time.',
      model: 'groq/llama-3.1-8b-instant',
      grounded: true,
    });

    const { POST } = await import('@/app/api/ai/generate-digest/route');
    const res = await POST(makeAuthedRequest('/api/ai/generate-digest', { patientId: 'p1' }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.summary.length).toBeGreaterThan(0);
    expect(digestChain.upsert).toHaveBeenCalled();
  });

  it('returns the existing digest unchanged without calling the LLM when it was generated today', async () => {
    const digestChain = makeChain({
      data: { patient_id: 'p1', week_of: new Date().toISOString().slice(0, 10), summary_text: 'Already generated today.', generated_at: new Date().toISOString() },
      error: null,
    });
    serviceFromMock.mockImplementation((table: string) => (table === 'caregiver_digests' ? digestChain : makeChain({ data: [], error: null })));
    const { callLLM } = await import('@/lib/ai/llm-client');

    const { POST } = await import('@/app/api/ai/generate-digest/route');
    const res = await POST(makeAuthedRequest('/api/ai/generate-digest', { patientId: 'p1' }));
    const body = await res.json();

    expect(body.summary).toBe('Already generated today.');
    expect(callLLM).not.toHaveBeenCalled();
  });

  it('regenerates once on a forbidden-word hit, and stores the templated fallback if the second attempt still has one', async () => {
    const digestChain = makeChain({ data: null, error: null });
    serviceFromMock.mockImplementation((table: string) => (table === 'caregiver_digests' ? digestChain : makeChain({ data: [], error: null })));
    const { callLLM } = await import('@/lib/ai/llm-client');
    vi.mocked(callLLM)
      .mockResolvedValueOnce({ text: 'Possible cognitive decline noted.', model: 'groq/llama-3.1-8b-instant', grounded: true })
      .mockResolvedValueOnce({ text: 'This still mentions decline again.', model: 'groq/llama-3.1-8b-instant', grounded: true });

    const { POST } = await import('@/app/api/ai/generate-digest/route');
    const { containsForbiddenWord } = await import('@/lib/ai/digest-safety');
    const res = await POST(makeAuthedRequest('/api/ai/generate-digest', { patientId: 'p1' }));
    const body = await res.json();

    expect(callLLM).toHaveBeenCalledTimes(2);
    expect(containsForbiddenWord(body.summary)).toBe(false);
    expect(digestChain.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ summary_text: body.summary }),
      expect.anything(),
    );
  });
});

// ---------------------------------------------------------------------------
// GET /api/patients/[id]/digests
// ---------------------------------------------------------------------------
describe('GET /api/patients/[id]/digests', () => {
  it('returns digests newest first', async () => {
    const rows = [
      { id: 'd1', patient_id: 'p1', week_of: '2026-08-24', summary_text: 'older', generated_at: '2026-08-24T00:00:00.000Z' },
      { id: 'd2', patient_id: 'p1', week_of: '2026-08-31', summary_text: 'newer', generated_at: '2026-08-31T00:00:00.000Z' },
    ];
    callerFromMock.mockImplementation((table: string) => {
      if (table === 'caregivers') return makeChain({ data: { id: 'c1' }, error: null });
      if (table === 'patients') return makeChain({ data: { id: 'p1' }, error: null });
      if (table === 'caregiver_digests') return makeChain({ data: [...rows].reverse(), error: null });
      return makeChain({ data: [], error: null });
    });
    const { GET } = await import('@/app/api/patients/[id]/digests/route');
    const res = await GET(makeAuthedRequest('/api/patients/p1/digests'), { params: Promise.resolve({ id: 'p1' }) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.digests[0].summaryText).toBe('newer');
  });
});
