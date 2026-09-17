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
  for (const method of ['select', 'eq', 'in', 'gte', 'order', 'limit', 'insert', 'update', 'upsert']) {
    chain[method] = vi.fn(() => chain);
  }
  chain.single = vi.fn(() => Promise.resolve(result));
  chain.maybeSingle = vi.fn(() => Promise.resolve(result));
  chain.then = (resolve: (v: typeof result) => unknown) => resolve(result);
  return chain;
}

// The param's type is what keeps later .mockImplementation((table: string) => ...)
// calls in this file type-checking against the same shape.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const serviceFromMock = vi.fn((_table: string) => makeChain({ data: [], error: null }));
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const callerFromMock = vi.fn((_table: string) => makeChain({ data: [], error: null }));

/** The patient's consent row the AI routes check first; tests set it to null
 * or switch purposes off to exercise the guardrail. */
function consentRow(overrides: Record<string, unknown> = {}) {
  return {
    patient_id: 'p1',
    caregiver_id: 'cg1',
    version: 1,
    care_profile: true,
    guardian_attested: true,
    ai_companion: true,
    voice_processing: true,
    consented_at: '2026-09-01T00:00:00.000Z',
    updated_at: '2026-09-01T00:00:00.000Z',
    ...overrides,
  };
}
let currentConsent: Record<string, unknown> | null = consentRow();

vi.mock('@/lib/supabase/client', () => ({
  isSupabaseConfigured: () => true,
  createServerClient: () => ({ auth: { getUser }, from: callerFromMock }),
  createServiceRoleClient: () => ({
    from: (table: string) =>
      table === 'patient_consents' ? makeChain({ data: currentConsent, error: null }) : serviceFromMock(table),
  }),
}));

vi.mock('@/lib/ai/bhashini-nmt-client', () => ({ translateText: vi.fn() }));

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
  currentConsent = consentRow();
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

    expect(body.text).toBe("I'm not sure about that. You could ask your caregiver.");
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

// ---------------------------------------------------------------------------
// Consent guardrail, Bhashini translation and grounding in the AI routes
// ---------------------------------------------------------------------------
describe('Ask Smriti routes — consent, language and grounding', () => {
  function completeRequest(body: Record<string, unknown>) {
    return new Request('http://localhost/api/ai/complete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deviceTrustToken: makeDeviceToken('p1'), ...body }),
    });
  }

  const rajuFacts = [
    { id: 'e1', title: 'Raju', detail: 'Your son, visits on Sundays', relationship: 'son', category: 'person' },
  ];

  function withFacts(logChain = makeChain({ data: [], error: null })) {
    serviceFromMock.mockImplementation((table: string) => {
      if (table === 'memory_bank_entries') return makeChain({ data: rajuFacts, error: null });
      if (table === 'ai_conversation_log') return logChain;
      return makeChain({ data: [], error: null });
    });
    return logChain;
  }

  it('refuses with 403 before translating or calling the model when Ask Smriti consent was never given', async () => {
    currentConsent = null;
    withFacts();
    const { callLLM } = await import('@/lib/ai/llm-client');
    const { translateText } = await import('@/lib/ai/bhashini-nmt-client');

    const { POST } = await import('@/app/api/ai/complete/route');
    const res = await POST(completeRequest({ question: 'मेरा बेटा कौन है', language: 'hi' }));

    expect(res.status).toBe(403);
    expect((await res.json()).error).toBe('consent_required');
    expect(callLLM).not.toHaveBeenCalled();
    expect(translateText).not.toHaveBeenCalled();
  });

  it('refuses when the caregiver later turned Ask Smriti off', async () => {
    currentConsent = consentRow({ ai_companion: false, voice_processing: false });
    withFacts();
    const { POST } = await import('@/app/api/ai/complete/route');
    const res = await POST(completeRequest({ question: 'who is Raju' }));
    expect(res.status).toBe(403);
  });

  it('translates a Hindi question to English with Bhashini, and the answer back to Hindi', async () => {
    const logChain = withFacts();
    const { translateText } = await import('@/lib/ai/bhashini-nmt-client');
    vi.mocked(translateText).mockReset();
    vi.mocked(translateText).mockImplementation(async (text, source, target) => ({
      text: source === 'hi' && target === 'en' ? 'Who is my son?' : 'राजू आपका बेटा है।',
      model: 'bhashini/test',
    }));
    const { callLLM } = await import('@/lib/ai/llm-client');
    vi.mocked(callLLM).mockResolvedValue({ text: 'Raju is your son.\nFACTS: F1', model: 'groq/test', grounded: true });

    const { POST } = await import('@/app/api/ai/complete/route');
    const res = await POST(completeRequest({ question: 'मेरा बेटा कौन है?', language: 'hi' }));
    const body = await res.json();

    expect(translateText).toHaveBeenCalledWith('मेरा बेटा कौन है?', 'hi', 'en');
    expect(translateText).toHaveBeenCalledWith('Raju is your son.', 'en', 'hi');
    expect(vi.mocked(callLLM).mock.calls[0][0].userPrompt).toBe('Who is my son?');
    expect(body).toEqual({ text: 'राजू आपका बेटा है।', grounded: true, kind: 'answer', answerLanguage: 'hi' });
    expect(logChain.insert).toHaveBeenCalledWith(
      expect.objectContaining({ grounded: true, question: expect.stringContaining('[English: Who is my son?]') }),
    );
  });

  it('returns the English answer, marked as English, when translating the answer back fails', async () => {
    withFacts();
    const { translateText } = await import('@/lib/ai/bhashini-nmt-client');
    vi.mocked(translateText).mockReset();
    vi.mocked(translateText).mockImplementation(async (_text, source) => {
      if (source === 'hi') return { text: 'Who is my son?', model: 'bhashini/test' };
      throw new Error('Bhashini down');
    });
    const { callLLM } = await import('@/lib/ai/llm-client');
    vi.mocked(callLLM).mockResolvedValue({ text: 'Raju is your son.\nFACTS: F1', model: 'groq/test', grounded: true });

    const { POST } = await import('@/app/api/ai/complete/route');
    const body = await (await POST(completeRequest({ question: 'मेरा बेटा कौन है?', language: 'hi' }))).json();

    expect(body).toMatchObject({ text: 'Raju is your son.', kind: 'answer', answerLanguage: 'en' });
  });

  it('replaces an answer that cites no fact with the not-sure reply', async () => {
    withFacts();
    const { callLLM } = await import('@/lib/ai/llm-client');
    vi.mocked(callLLM).mockResolvedValue({
      text: 'Your daughter Priya lives in Delhi.\nFACTS: none',
      model: 'groq/test',
      grounded: true,
    });

    const { POST } = await import('@/app/api/ai/complete/route');
    const body = await (await POST(completeRequest({ question: 'where does my daughter live' }))).json();

    expect(body).toMatchObject({ kind: 'unknown', grounded: false, text: "I'm not sure about that. You could ask your caregiver." });
  });

  it('catches a distress phrase in the patient’s own language even when translation is down', async () => {
    const logChain = withFacts();
    const { translateText } = await import('@/lib/ai/bhashini-nmt-client');
    vi.mocked(translateText).mockReset();
    vi.mocked(translateText).mockRejectedValue(new Error('down'));
    const { callLLM } = await import('@/lib/ai/llm-client');

    const { POST } = await import('@/app/api/ai/complete/route');
    const body = await (await POST(completeRequest({ question: 'मैं मरना चाहता हूँ', language: 'hi' }))).json();

    expect(body.kind).toBe('distress');
    expect(callLLM).not.toHaveBeenCalled();
    expect(logChain.insert).toHaveBeenCalledWith(expect.objectContaining({ flagged_for_followup: true }));
  });

  it('answers from reminders and appointments too, not only Memory Bank entries', async () => {
    serviceFromMock.mockImplementation((table: string) => {
      if (table === 'reminder_schedules') {
        return makeChain({
          data: [
            {
              id: 'r1',
              label: 'Eye check-up',
              reminder_type: 'appointment',
              time_of_day: '10:30:00',
              days_of_week: [],
              appointment_date: '2026-09-20',
              facility_name: 'Jorhat CHC',
              location_notes: null,
              bring_notes: 'old spectacles',
            },
          ],
          error: null,
        });
      }
      return makeChain({ data: [], error: null });
    });
    const { callLLM } = await import('@/lib/ai/llm-client');
    vi.mocked(callLLM).mockResolvedValue({ text: 'On 20 September at 10:30.\nFACTS: F1', model: 'groq/test', grounded: true });

    const { POST } = await import('@/app/api/ai/complete/route');
    const body = await (await POST(completeRequest({ question: 'when is my eye check-up' }))).json();

    const prompt = vi.mocked(callLLM).mock.calls[0][0].systemPrompt;
    expect(prompt).toContain('F1. Eye check-up: Appointment on 2026-09-20 at 10:30 at Jorhat CHC. Bring: old spectacles.');
    expect(body).toMatchObject({ kind: 'answer', grounded: true });
  });

  it('refuses to transcribe a patient phone’s recording when voice consent is off', async () => {
    currentConsent = consentRow({ voice_processing: false });
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const formData = new FormData();
    formData.append('audio', new Blob(['fake'], { type: 'audio/webm' }), 'clip.webm');
    formData.append('deviceTrustToken', JSON.stringify(makeDeviceToken('p1')));
    const { POST } = await import('@/app/api/ai/transcribe/route');

    const res = await POST(new Request('http://localhost/api/ai/transcribe', { method: 'POST', body: formData }));

    expect(res.status).toBe(403);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
