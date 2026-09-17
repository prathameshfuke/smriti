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
    version: 2,
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
vi.mock('@/lib/ai/bhashini-client', () => ({ synthesizeSpeech: vi.fn() }));

vi.mock('@/lib/ai/llm-client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/ai/llm-client')>();
  return { ...actual, callLLM: vi.fn(), callChat: vi.fn() };
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
  const { callLLM, callChat } = await import('@/lib/ai/llm-client');
  vi.mocked(callLLM).mockReset();
  vi.mocked(callChat).mockReset();
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
// POST /api/ai/converse
// ---------------------------------------------------------------------------
describe('POST /api/ai/converse', () => {
  function converse(body: Record<string, unknown>) {
    return new Request('http://localhost/api/ai/converse', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deviceTrustToken: makeDeviceToken('p1'), ...body }),
    });
  }

  const memoryRows = [
    { id: 'e1', title: 'Raju', detail: 'Lives in Guwahati, visits on Sundays', relationship: 'son', category: 'person' },
    { id: 'e2', title: 'Meena', detail: 'Lives in Jorhat, a teacher', relationship: 'daughter', category: 'person' },
  ];

  function withMemoryBank(logChain = makeChain({ data: [], error: null })) {
    serviceFromMock.mockImplementation((table: string) => {
      if (table === 'memory_bank_entries') return makeChain({ data: memoryRows, error: null });
      if (table === 'ai_conversation_log') return logChain;
      return makeChain({ data: [], error: null });
    });
    return logChain;
  }

  /** First callChat = the reply, second = the independent check. */
  async function modelSays(reply: Record<string, unknown> | string | null, verdict: boolean | null = true) {
    const { callChat } = await import('@/lib/ai/llm-client');
    vi.mocked(callChat)
      .mockResolvedValueOnce({
        text: reply === null ? null : typeof reply === 'string' ? reply : JSON.stringify(reply),
        model: 'groq/openai/gpt-oss-120b',
      })
      .mockResolvedValue({
        text: verdict === null ? null : JSON.stringify({ supported: verdict, reason: '' }),
        model: 'groq/openai/gpt-oss-120b',
      });
    return vi.mocked(callChat);
  }

  it('refuses with 403 before any model call when Ask Smriti consent is missing or switched off', async () => {
    withMemoryBank();
    const callChat = await modelSays({ reply: 'hi', type: 'chitchat', facts: [] });
    const { POST } = await import('@/app/api/ai/converse/route');

    currentConsent = null;
    expect((await POST(converse({ message: 'hello' }))).status).toBe(403);
    currentConsent = consentRow({ ai_companion: false, voice_processing: false });
    expect((await POST(converse({ message: 'hello' }))).status).toBe(403);
    expect(callChat).not.toHaveBeenCalled();
  });

  it('answers small talk warmly instead of refusing it', async () => {
    withMemoryBank();
    await modelSays({ reply: 'নমস্কাৰ! আপুনি কেনে আছে?', type: 'chitchat', facts: [], distress: false });
    const { POST } = await import('@/app/api/ai/converse/route');

    const body = await (await POST(converse({ message: 'নমস্কাৰ', language: 'as' }))).json();

    expect(body).toMatchObject({ kind: 'answer', text: 'নমস্কাৰ! আপুনি কেনে আছে?', grounded: false, answerLanguage: 'as' });
  });

  it('puts only Memory Bank entries in front of the model, and never reminders', async () => {
    serviceFromMock.mockImplementation((table: string) => {
      if (table === 'memory_bank_entries') return makeChain({ data: memoryRows, error: null });
      if (table === 'reminder_schedules') throw new Error('reminders must not be read');
      return makeChain({ data: [], error: null });
    });
    const callChat = await modelSays({ reply: 'Raju is your son.', type: 'memory', facts: ['F1'] });
    const { POST } = await import('@/app/api/ai/converse/route');

    const body = await (await POST(converse({ message: 'who is Raju' }))).json();

    const system = callChat.mock.calls[0][0].messages[0].content;
    expect(system).toContain('F1. Raju (son): Lives in Guwahati, visits on Sundays');
    expect(system).toContain('Meena (daughter)');
    expect(body).toMatchObject({ kind: 'answer', grounded: true, factIds: ['m:e1'] });
  });

  it('sends the conversation so far, so a follow-up keeps its subject', async () => {
    withMemoryBank();
    const callChat = await modelSays({ reply: 'He lives in Guwahati.', type: 'memory', facts: ['F1'] });
    const { POST } = await import('@/app/api/ai/converse/route');

    await POST(
      converse({
        message: 'and where does he live?',
        history: [
          { role: 'user', text: 'who is Raju' },
          { role: 'assistant', text: 'Raju is your son.', factIds: ['m:e1'] },
        ],
      }),
    );

    const messages = callChat.mock.calls[0][0].messages;
    expect(messages.slice(1).map((m: { role: string; content: string }) => [m.role, m.content])).toEqual([
      ['user', 'who is Raju'],
      ['assistant', 'Raju is your son.'],
      ['user', 'and where does he live?'],
    ]);
  });

  it('never shows a reply the independent check finds invented, and logs it for the caregiver', async () => {
    const logChain = withMemoryBank();
    await modelSays({ reply: 'Your daughter Priya called you today.', type: 'chitchat', facts: [] }, false);
    const { POST } = await import('@/app/api/ai/converse/route');

    const body = await (await POST(converse({ message: 'did anyone call me?' }))).json();

    expect(body).toMatchObject({ kind: 'unknown', text: '' });
    expect(logChain.insert).toHaveBeenCalledWith(
      expect.objectContaining({ grounded: false, answer: expect.stringContaining('not shown') }),
    );
  });

  it('rejects a "memory" reply that cites no Memory Bank entry without asking the checker', async () => {
    withMemoryBank();
    const callChat = await modelSays({ reply: 'Your son visits on Mondays.', type: 'memory', facts: [] });
    const { POST } = await import('@/app/api/ai/converse/route');

    const body = await (await POST(converse({ message: 'when does my son visit' }))).json();

    expect(body.kind).toBe('unknown');
    expect(callChat).toHaveBeenCalledTimes(1);
  });

  it('when the checker is unreachable, lets cited memory replies through but not unchecked small talk', async () => {
    withMemoryBank();
    await modelSays({ reply: 'Raju is your son.', type: 'memory', facts: ['F1'] }, null);
    const { POST } = await import('@/app/api/ai/converse/route');
    expect((await (await POST(converse({ message: 'who is Raju' }))).json()).kind).toBe('answer');

    await modelSays({ reply: 'Your family loves you and visits often.', type: 'chitchat', facts: [] }, null);
    expect((await (await POST(converse({ message: 'does my family visit' }))).json()).kind).toBe('unknown');
  });

  it('flags distress from keywords before any model call, and from the model’s own flag', async () => {
    const logChain = withMemoryBank();
    const callChat = await modelSays({ reply: 'I am here with you.', type: 'chitchat', facts: [], distress: true });
    const { POST } = await import('@/app/api/ai/converse/route');

    expect((await (await POST(converse({ message: 'I want to die' }))).json()).kind).toBe('distress');
    expect(callChat).not.toHaveBeenCalled();

    expect((await (await POST(converse({ message: 'nothing matters any more' }))).json()).kind).toBe('distress');
    expect(logChain.insert).toHaveBeenCalledWith(expect.objectContaining({ flagged_for_followup: true }));
  });

  it('retries a malformed model reply once, then reports unavailable', async () => {
    withMemoryBank();
    const { callChat } = await import('@/lib/ai/llm-client');
    vi.mocked(callChat).mockResolvedValue({ text: 'not json at all', model: 'groq/x' });
    const { POST } = await import('@/app/api/ai/converse/route');

    const body = await (await POST(converse({ message: 'hello' }))).json();

    expect(body.kind).toBe('unavailable');
    expect(callChat).toHaveBeenCalledTimes(2);
  });

  it('translates a reply that came back in the wrong language with Bhashini', async () => {
    withMemoryBank();
    await modelSays({ reply: 'Raju is your son.', type: 'memory', facts: ['F1'] });
    const { translateText } = await import('@/lib/ai/bhashini-nmt-client');
    vi.mocked(translateText).mockReset();
    vi.mocked(translateText).mockResolvedValue({ text: 'राजू आपके बेटे हैं।', model: 'bhashini/x' });
    const { POST } = await import('@/app/api/ai/converse/route');

    const body = await (await POST(converse({ message: 'राजू कौन है', language: 'hi' }))).json();

    expect(translateText).toHaveBeenCalledWith('Raju is your son.', 'en', 'hi');
    expect(body).toMatchObject({ kind: 'answer', text: 'राजू आपके बेटे हैं।', answerLanguage: 'hi' });
  });

  it('returns Bhashini speech with the reply when asked, and still answers when speech fails', async () => {
    withMemoryBank();
    const { synthesizeSpeech } = await import('@/lib/ai/bhashini-client');
    vi.mocked(synthesizeSpeech).mockResolvedValueOnce({ audioBase64: 'QUJD', audioFormat: 'wav', model: 'bhashini/x' });
    await modelSays({ reply: 'Hello!', type: 'chitchat', facts: [] });
    const { POST } = await import('@/app/api/ai/converse/route');
    const withAudio = await (await POST(converse({ message: 'hello', speak: true }))).json();
    expect(withAudio.audio).toEqual({ audioBase64: 'QUJD', audioFormat: 'wav' });

    vi.mocked(synthesizeSpeech).mockRejectedValueOnce(new Error('502'));
    await modelSays({ reply: 'Hello!', type: 'chitchat', facts: [] });
    const withoutAudio = await (await POST(converse({ message: 'hello', speak: true }))).json();
    expect(withoutAudio).toMatchObject({ kind: 'answer', text: 'Hello!' });
    expect(withoutAudio.audio).toBeUndefined();
  });

  it('logs the turn with its conversation id, and still logs before MIGRATION 015 adds the column', async () => {
    const logChain = makeChain({ data: null, error: null });
    let inserts = 0;
    logChain.insert = vi.fn(() => {
      inserts += 1;
      const result = inserts === 1 ? { data: null, error: { code: '42703', message: 'no column' } } : { data: null, error: null };
      return { then: (resolve: (v: unknown) => unknown) => resolve(result) };
    });
    withMemoryBank(logChain);
    await modelSays({ reply: 'Hello!', type: 'chitchat', facts: [] });
    const { POST } = await import('@/app/api/ai/converse/route');
    const sessionId = '6f1b2c1e-8a47-4d0e-9a55-0d7d0f0c7a11';

    await POST(converse({ message: 'hello', sessionId }));

    expect(logChain.insert).toHaveBeenNthCalledWith(1, expect.objectContaining({ session_id: sessionId }));
    expect(logChain.insert).toHaveBeenNthCalledWith(2, expect.not.objectContaining({ session_id: sessionId }));
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
