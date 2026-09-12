// @vitest-environment node
//
// API-route and lib-only tests, no DOM needed — jsdom's FormData/Request
// body round-trip (used by the transcribe route tests below) is unreliable;
// Node's native undici implementation is spec-compliant.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import 'fake-indexeddb/auto';
import { db } from '@/lib/db/schema';
import { signDeviceTrust } from '@/lib/auth/deviceTrustServer';

// Set before any describe block's `{ ...process.env }` snapshot runs, so it
// survives every afterEach's `process.env = { ...ORIGINAL_ENV }` reset below.
process.env.DEVICE_TRUST_SECRET = 'test-only-secret-do-not-use-in-production';

const getUser = vi.fn();

/** Chainable Postgrest-like fake: every filter method returns itself, `.single()`
 * and `await` both resolve to the same canned `{ data, error }`. Mirrors the
 * helper in `sync.test.ts` — kept local since no shared test-utils module
 * exists in this repo yet. */
function makeChain(result: { data: unknown; error: unknown }) {
  const chain: Record<string, unknown> = {};
  for (const method of ['select', 'eq', 'in', 'order', 'limit', 'insert', 'update']) {
    chain[method] = vi.fn(() => chain);
  }
  chain.single = vi.fn(() => Promise.resolve(result));
  chain.then = (resolve: (v: typeof result) => unknown) => resolve(result);
  return chain;
}

const serviceFromMock = vi.fn((_table: string) => makeChain({ data: [], error: null }));
const callerFromMock = vi.fn((_table: string) => makeChain({ data: [], error: null }));

vi.mock('@/lib/supabase/client', () => ({
  isSupabaseConfigured: () => true,
  createServerClient: () => ({ auth: { getUser }, from: callerFromMock }),
  createServiceRoleClient: () => ({ from: serviceFromMock }),
}));

vi.mock('@/lib/ai/llm-client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/ai/llm-client')>();
  return { ...actual, callLLM: vi.fn() };
});

// A real HMAC-signed token, matching what POST /api/device-trust would
// actually issue — the old fixture built a forged token with the previous,
// unsigned `btoa(...)` scheme and asserted the routes accepted it, which was
// the vulnerability, not a behavior worth preserving in these tests.
function makeDeviceToken(patientId: string, caregiverId = 'cg1') {
  return signDeviceTrust(patientId, caregiverId);
}

beforeEach(async () => {
  getUser.mockReset();
  serviceFromMock.mockReset();
  callerFromMock.mockReset();
  serviceFromMock.mockImplementation(() => makeChain({ data: [], error: null }));
  callerFromMock.mockImplementation(() => makeChain({ data: [], error: null }));
  const { callLLM } = await import('@/lib/ai/llm-client');
  vi.mocked(callLLM).mockReset();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// distress-keywords.ts (pure — no mocking needed)
// ---------------------------------------------------------------------------
describe('matchSeverity', () => {
  it('matches high-severity phrases on a single occurrence', async () => {
    const { matchSeverity } = await import('@/lib/ai/distress-keywords');
    expect(matchSeverity('I want to die')).toBe('high');
    expect(matchSeverity('I want to hurt myself today')).toBe('high');
  });

  it('is case-insensitive', async () => {
    const { matchSeverity } = await import('@/lib/ai/distress-keywords');
    expect(matchSeverity('I WANT TO DIE')).toBe('high');
  });

  it('matches low-severity phrases', async () => {
    const { matchSeverity } = await import('@/lib/ai/distress-keywords');
    expect(matchSeverity('I am scared')).toBe('low');
    expect(matchSeverity('please help me')).toBe('low');
  });

  it('returns null for unrelated text', async () => {
    const { matchSeverity } = await import('@/lib/ai/distress-keywords');
    expect(matchSeverity('what is the weather like today')).toBeNull();
  });

  it('TELE_MANAS_RESPONSE surfaces 14416', async () => {
    const { TELE_MANAS_RESPONSE } = await import('@/lib/ai/distress-keywords');
    expect(TELE_MANAS_RESPONSE).toContain('14416');
  });
});

// ---------------------------------------------------------------------------
// companion-cache.ts (real Dexie via fake-indexeddb)
// ---------------------------------------------------------------------------
describe('companion-cache', () => {
  beforeEach(async () => {
    await db.aiConversationLog.clear();
  });

  function entry(overrides: Partial<import('@/lib/db/schema').LocalAiConversationLog> = {}) {
    return {
      id: overrides.id ?? crypto.randomUUID(),
      patientId: 'p1',
      question: 'what is my sons name',
      answer: 'Your son is Raju.',
      grounded: true,
      modelUsed: 'groq/llama-3.1-8b-instant',
      createdAt: new Date().toISOString(),
      ...overrides,
    };
  }

  it('keeps only the 5 newest cached entries per patient', async () => {
    const { cacheAnswer } = await import('@/lib/ai/companion-cache');
    for (let i = 0; i < 6; i++) {
      await cacheAnswer(
        entry({ id: `e${i}`, question: `question ${i}`, createdAt: new Date(2026, 0, 1, 0, i).toISOString() }),
      );
    }
    const rows = await db.aiConversationLog.where('patientId').equals('p1').toArray();
    expect(rows).toHaveLength(5);
    expect(rows.map((r) => r.id).sort()).toEqual(['e1', 'e2', 'e3', 'e4', 'e5']);
  });

  it('finds a cached answer by normalized exact match', async () => {
    const { cacheAnswer, findCachedAnswer } = await import('@/lib/ai/companion-cache');
    await cacheAnswer(entry({ question: "What's my son's name?" }));
    const found = await findCachedAnswer('p1', "  WHATS MY SON'S NAME  ");
    expect(found?.answer).toBe('Your son is Raju.');
  });

  it('returns null when no cached question matches', async () => {
    const { cacheAnswer, findCachedAnswer } = await import('@/lib/ai/companion-cache');
    await cacheAnswer(entry({ question: 'what day is it' }));
    const found = await findCachedAnswer('p1', 'what is my medication');
    expect(found).toBeNull();
  });

  it('never returns a match cached under a different patient', async () => {
    const { cacheAnswer, findCachedAnswer } = await import('@/lib/ai/companion-cache');
    await cacheAnswer(entry({ patientId: 'other-patient', question: 'what is my medication' }));
    const found = await findCachedAnswer('p1', 'what is my medication');
    expect(found).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// transcribe-client.ts (real implementation, fetch stubbed)
// ---------------------------------------------------------------------------
describe('transcribeAudio', () => {
  const ORIGINAL_ENV = { ...process.env };

  beforeEach(() => {
    process.env.GROQ_API_KEY = 'test-groq-key';
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  it('returns transcribed text on success', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ text: 'hello there' }) }),
    );
    const { transcribeAudio } = await import('@/lib/ai/transcribe-client');
    const result = await transcribeAudio(new Blob(['fake-audio']));
    expect(result.text).toBe('hello there');
  });

  it('throws when the provider responds with a non-ok status', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500, json: async () => ({}) }));
    const { transcribeAudio } = await import('@/lib/ai/transcribe-client');
    await expect(transcribeAudio(new Blob(['fake-audio']))).rejects.toThrow();
  });

  it('throws without calling fetch when GROQ_API_KEY is missing', async () => {
    delete process.env.GROQ_API_KEY;
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const { transcribeAudio } = await import('@/lib/ai/transcribe-client');
    await expect(transcribeAudio(new Blob(['fake-audio']))).rejects.toThrow();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// POST /api/ai/transcribe
// ---------------------------------------------------------------------------
describe('POST /api/ai/transcribe', () => {
  const ORIGINAL_ENV = { ...process.env };

  beforeEach(() => {
    process.env.GROQ_API_KEY = 'test-groq-key';
    process.env.BHASHINI_USER_ID = 'test-user-id';
    process.env.BHASHINI_ULCA_API_KEY = 'test-ulca-key';
    process.env.BHASHINI_INFERENCE_API_KEY = 'test-legacy-key';
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  function makeRequest(deviceTrustToken: unknown, language?: string) {
    const formData = new FormData();
    formData.append('audio', new Blob(['fake-audio-bytes'], { type: 'audio/webm' }), 'clip.webm');
    if (deviceTrustToken !== undefined) {
      formData.append('deviceTrustToken', JSON.stringify(deviceTrustToken));
    }
    if (language !== undefined) formData.append('language', language);
    return new Request('http://localhost/api/ai/transcribe', { method: 'POST', body: formData });
  }

  /** Branches on URL so one test can simulate Bhashini and Groq responding
   * differently — the two providers this route now tries in sequence.
   * `bhashini` is used for BOTH the discovery-resolved compute call and the
   * legacy-fallback compute call, since both hit the same dhruva-api URL. */
  const ulcaConfigSuccess: { ok: boolean; status?: number; body?: unknown } = {
    ok: true,
    body: {
      pipelineResponseConfig: [{ config: [{ serviceId: 'ai4bharat/conformer-hi-gpu--t4' }] }],
      pipelineInferenceAPIEndPoint: { inferenceApiKey: { name: 'Authorization', value: 'dynamic-key' } },
    },
  };

  function mockProviders(bhashini: { ok: boolean; status?: number; body?: unknown }, groq: { ok: boolean; status?: number; body?: unknown }) {
    return vi.fn().mockImplementation((url: string) => {
      const target = url.includes('meity-auth.ulcacontrib.org')
        ? ulcaConfigSuccess
        : url.includes('dhruva-api.bhashini.gov.in')
          ? bhashini
          : groq;
      return Promise.resolve({
        ok: target.ok,
        status: target.status ?? (target.ok ? 200 : 500),
        json: async () => target.body,
      });
    });
  }

  it('returns 401 and never calls the provider when the device token is missing', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const { POST } = await import('@/app/api/ai/transcribe/route');
    const res = await POST(makeRequest(undefined));
    expect(res.status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('returns 401 for an invalid signature', async () => {
    const { POST } = await import('@/app/api/ai/transcribe/route');
    const res = await POST(
      makeRequest({ patientId: 'p1', issuedAt: Date.now(), issuedBy: 'cg1', signature: 'bad' }),
    );
    expect(res.status).toBe(401);
  });

  it('returns 200 with the transcript for a valid token and a successful transcription', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ text: 'what is my medication' }) }),
    );
    const { POST } = await import('@/app/api/ai/transcribe/route');
    const res = await POST(makeRequest(makeDeviceToken('p1')));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.text).toBe('what is my medication');
  });

  it('returns 502 when transcription fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500, json: async () => ({}) }));
    const { POST } = await import('@/app/api/ai/transcribe/route');
    const res = await POST(makeRequest(makeDeviceToken('p1')));
    expect(res.status).toBe(502);
  });

  it('accepts a caregiver Bearer token with no device-trust field at all', async () => {
    getUser.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null });
    const groqFetch = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ text: 'family question' }) });
    vi.stubGlobal('fetch', groqFetch);

    const formData = new FormData();
    formData.append('audio', new Blob(['fake-audio-bytes'], { type: 'audio/webm' }), 'clip.webm');
    const req = new Request('http://localhost/api/ai/transcribe', {
      method: 'POST',
      headers: { Authorization: 'Bearer caregiver-tok' },
      body: formData,
    });

    const { POST } = await import('@/app/api/ai/transcribe/route');
    const res = await POST(req);
    expect(res.status).toBe(200);
  });

  it('routes Assamese to Bhashini ASR and never calls Groq when Bhashini succeeds', async () => {
    const fetchMock = mockProviders(
      { ok: true, body: { pipelineResponse: [{ output: [{ source: 'অসমীয়া প্ৰতিলিপি' }] }] } },
      { ok: true, body: { text: 'this should never be returned' } },
    );
    vi.stubGlobal('fetch', fetchMock);

    const { POST } = await import('@/app/api/ai/transcribe/route');
    const res = await POST(makeRequest(makeDeviceToken('p1'), 'as'));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.text).toBe('অসমীয়া প্ৰতিলিপি');
    // 2 calls: the ULCA config call, then the Bhashini compute call — never Groq.
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('falls through to Groq Whisper when Bhashini fails for a Bhashini-eligible language', async () => {
    const fetchMock = mockProviders(
      { ok: false, status: 500 },
      { ok: true, body: { text: 'groq caught the fallback' } },
    );
    vi.stubGlobal('fetch', fetchMock);

    const { POST } = await import('@/app/api/ai/transcribe/route');
    const res = await POST(makeRequest(makeDeviceToken('p1'), 'hi'));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.text).toBe('groq caught the fallback');
    // 4 calls: the ULCA config call, the failing primary compute call, the
    // legacy-fallback compute call (also mocked to fail here), then Groq.
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it('never attempts Bhashini for English — Groq Whisper is called directly', async () => {
    const fetchMock = mockProviders(
      { ok: true, body: { pipelineResponse: [{ output: [{ source: 'should never be called' }] }] } },
      { ok: true, body: { text: 'english via groq' } },
    );
    vi.stubGlobal('fetch', fetchMock);

    const { POST } = await import('@/app/api/ai/transcribe/route');
    const res = await POST(makeRequest(makeDeviceToken('p1'), 'en'));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.text).toBe('english via groq');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).not.toContain('dhruva-api.bhashini.gov.in');
  });
});

// ---------------------------------------------------------------------------
// POST /api/ai/complete
// ---------------------------------------------------------------------------
describe('POST /api/ai/complete', () => {
  function makeRequest(body: Record<string, unknown>) {
    return new Request('http://localhost/api/ai/complete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  }

  it('builds a system prompt containing every active Memory Bank fact verbatim', async () => {
    const factsChain = makeChain({
      data: [
        { title: 'Raju', detail: 'Your son, visits on Sundays', relationship: 'son', category: 'person' },
        {
          title: 'Blood pressure pill',
          detail: 'One red pill after breakfast',
          relationship: null,
          category: 'medication',
        },
      ],
      error: null,
    });
    serviceFromMock.mockImplementation((table: string) =>
      table === 'memory_bank_entries' ? factsChain : makeChain({ data: [], error: null }),
    );
    const { callLLM } = await import('@/lib/ai/llm-client');
    vi.mocked(callLLM).mockResolvedValue({
      text: 'Raju is your son.',
      model: 'groq/llama-3.1-8b-instant',
      grounded: true,
    });

    const { POST } = await import('@/app/api/ai/complete/route');
    await POST(makeRequest({ question: 'who is Raju', deviceTrustToken: makeDeviceToken('p1') }));

    const [callArgs] = vi.mocked(callLLM).mock.calls;
    const systemPrompt = (callArgs[0] as { systemPrompt: string }).systemPrompt;
    expect(systemPrompt).toContain('Your son, visits on Sundays');
    expect(systemPrompt).toContain('One red pill after breakfast');
  });

  it('refuses to answer with the exact fallback text when there are zero active facts, without calling the LLM', async () => {
    const factsChain = makeChain({ data: [], error: null });
    const logChain = makeChain({ data: [], error: null });
    serviceFromMock.mockImplementation((table: string) => {
      if (table === 'memory_bank_entries') return factsChain;
      if (table === 'ai_conversation_log') return logChain;
      return makeChain({ data: [], error: null });
    });
    const { callLLM } = await import('@/lib/ai/llm-client');

    const { POST } = await import('@/app/api/ai/complete/route');
    const res = await POST(makeRequest({ question: 'who is Raju', deviceTrustToken: makeDeviceToken('p1') }));
    const body = await res.json();

    expect(body.text).toBe("I'm not sure about that — you could ask your caregiver.");
    expect(callLLM).not.toHaveBeenCalled();
    expect(logChain.insert).toHaveBeenCalledWith(
      expect.objectContaining({ grounded: false, flagged_for_followup: false, model_used: 'none' }),
    );
  });

  it('short-circuits to the Tele-MANAS response on a high-severity phrase, without calling the LLM', async () => {
    const logChain = makeChain({ data: [], error: null });
    serviceFromMock.mockImplementation((table: string) => {
      if (table === 'ai_conversation_log') return logChain;
      return makeChain({ data: [{ title: 'x', detail: 'y', relationship: null, category: 'life_fact' }], error: null });
    });
    const { callLLM } = await import('@/lib/ai/llm-client');
    const { TELE_MANAS_RESPONSE } = await import('@/lib/ai/distress-keywords');

    const { POST } = await import('@/app/api/ai/complete/route');
    const res = await POST(makeRequest({ question: 'I want to hurt myself', deviceTrustToken: makeDeviceToken('p1') }));
    const body = await res.json();

    expect(body.text).toBe(TELE_MANAS_RESPONSE);
    expect(callLLM).not.toHaveBeenCalled();
    expect(logChain.insert).toHaveBeenCalledWith(
      expect.objectContaining({ flagged_for_followup: true, grounded: false, model_used: 'distress-shortcircuit' }),
    );
  });

  it('does not short-circuit on a single low-severity phrase', async () => {
    serviceFromMock.mockImplementation((table: string) => {
      if (table === 'ai_conversation_log') return makeChain({ data: [], error: null });
      return makeChain({ data: [{ title: 'x', detail: 'y', relationship: null, category: 'life_fact' }], error: null });
    });
    const { callLLM } = await import('@/lib/ai/llm-client');
    vi.mocked(callLLM).mockResolvedValue({ text: 'It is Tuesday.', model: 'groq/llama-3.1-8b-instant', grounded: true });

    const { POST } = await import('@/app/api/ai/complete/route');
    await POST(makeRequest({ question: 'I am scared, what day is it', deviceTrustToken: makeDeviceToken('p1') }));

    expect(callLLM).toHaveBeenCalledTimes(1);
  });

  it('short-circuits on a low-severity phrase seen twice within the last 5 logged questions', async () => {
    const logChain = makeChain({ data: [{ question: 'I feel scared today' }], error: null });
    serviceFromMock.mockImplementation((table: string) => {
      if (table === 'ai_conversation_log') return logChain;
      return makeChain({ data: [{ title: 'x', detail: 'y', relationship: null, category: 'life_fact' }], error: null });
    });
    const { callLLM } = await import('@/lib/ai/llm-client');
    const { TELE_MANAS_RESPONSE } = await import('@/lib/ai/distress-keywords');

    const { POST } = await import('@/app/api/ai/complete/route');
    const res = await POST(makeRequest({ question: 'I am still scared', deviceTrustToken: makeDeviceToken('p1') }));
    const body = await res.json();

    expect(body.text).toBe(TELE_MANAS_RESPONSE);
    expect(callLLM).not.toHaveBeenCalled();
    expect(logChain.insert).toHaveBeenCalledWith(expect.objectContaining({ flagged_for_followup: true }));
  });
});

// ---------------------------------------------------------------------------
// GET /api/patients/[id]/companion-activity
// ---------------------------------------------------------------------------
describe('GET /api/patients/[id]/companion-activity', () => {
  function makeRequest() {
    return new Request('http://localhost/api/patients/p1/companion-activity', {
      headers: { Authorization: 'Bearer tok' },
    });
  }

  it('returns 401 with no Authorization header', async () => {
    const { GET } = await import('@/app/api/patients/[id]/companion-activity/route');
    const res = await GET(new Request('http://localhost/api/patients/p1/companion-activity'), {
      params: Promise.resolve({ id: 'p1' }),
    });
    expect(res.status).toBe(401);
  });

  it('returns 404 when the caller does not own the patient', async () => {
    getUser.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null });
    callerFromMock.mockImplementation((table: string) => {
      if (table === 'caregivers') return makeChain({ data: { id: 'c1' }, error: null });
      if (table === 'patients') return makeChain({ data: null, error: null });
      return makeChain({ data: [], error: null });
    });
    const { GET } = await import('@/app/api/patients/[id]/companion-activity/route');
    const res = await GET(makeRequest(), { params: Promise.resolve({ id: 'p1' }) });
    expect(res.status).toBe(404);
  });

  it('returns up to 10 questions, newest first, with grounded/flagged status intact', async () => {
    getUser.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null });
    const rows = Array.from({ length: 3 }, (_, i) => ({
      id: `log-${i}`,
      question: `question ${i}`,
      answer: `answer ${i}`,
      grounded: i !== 1,
      flagged_for_followup: i === 2,
      created_at: new Date(2026, 0, i + 1).toISOString(),
    }));
    callerFromMock.mockImplementation((table: string) => {
      if (table === 'caregivers') return makeChain({ data: { id: 'c1' }, error: null });
      if (table === 'patients') return makeChain({ data: { id: 'p1' }, error: null });
      if (table === 'ai_conversation_log') return makeChain({ data: rows, error: null });
      return makeChain({ data: [], error: null });
    });
    const { GET } = await import('@/app/api/patients/[id]/companion-activity/route');
    const res = await GET(makeRequest(), { params: Promise.resolve({ id: 'p1' }) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.questions).toHaveLength(3);
    expect(body.questions[1].grounded).toBe(false);
    expect(body.questions[2].flaggedForFollowup).toBe(true);
  });
});
