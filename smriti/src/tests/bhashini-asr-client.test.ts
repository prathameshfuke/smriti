import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const ORIGINAL_ENV = { ...process.env };

function mockFetchSequence(responses: Array<{ ok?: boolean; status?: number; body?: unknown; throws?: boolean }>) {
  let call = 0;
  return vi.fn().mockImplementation(() => {
    const next = responses[Math.min(call, responses.length - 1)];
    call += 1;
    if (next.throws) return Promise.reject(new Error('network error'));
    return Promise.resolve({
      ok: next.ok,
      status: next.status ?? (next.ok ? 200 : 500),
      json: async () => next.body,
    });
  });
}

function asrSuccessBody(text: string) {
  return { pipelineResponse: [{ taskType: 'asr', output: [{ source: text }] }] };
}

function configSuccessBody(serviceId = 'ai4bharat/conformer-hi-gpu--t4') {
  return {
    pipelineResponseConfig: [{ config: [{ serviceId }] }],
    pipelineInferenceAPIEndPoint: { inferenceApiKey: { name: 'Authorization', value: 'dynamic-key' } },
  };
}

/** The real, live-confirmed shape of a discovery miss — Assamese ASR has
 * no registered service under the new ULCA account at all. */
function noServiceFoundBody() {
  return { code: 'bad-request', message: 'No supported tasks found for this request!!' };
}

beforeEach(() => {
  process.env.BHASHINI_USER_ID = 'test-user-id';
  process.env.BHASHINI_ULCA_API_KEY = 'test-ulca-key';
  process.env.BHASHINI_INFERENCE_API_KEY = 'test-legacy-key';
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  vi.unstubAllGlobals();
});

describe('supportsBhashiniAsr', () => {
  it('is true for as/hi and false for en — the confirmed language coverage of the ASR service id used', async () => {
    const { supportsBhashiniAsr } = await import('@/lib/ai/bhashini-asr-client');
    expect(supportsBhashiniAsr('as')).toBe(true);
    expect(supportsBhashiniAsr('hi')).toBe(true);
    expect(supportsBhashiniAsr('en')).toBe(false);
  });
});

describe('transcribeBhashini — primary path (live ULCA discovery resolves a service)', () => {
  it('returns the transcript on success, using the discovery-resolved service and dynamic auth header', async () => {
    const fetchMock = mockFetchSequence([
      { ok: true, body: configSuccessBody('ai4bharat/conformer-hi-gpu--t4') },
      { ok: true, body: asrSuccessBody('हैलो') },
    ]);
    vi.stubGlobal('fetch', fetchMock);
    const { transcribeBhashini } = await import('@/lib/ai/bhashini-asr-client');

    const result = await transcribeBhashini(new Blob(['fake-audio'], { type: 'audio/webm' }), 'hi');

    expect(result.text).toBe('हैलो');
    expect(result.model).toContain('ai4bharat/conformer-hi-gpu--t4');
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const [, computeRequestInit] = fetchMock.mock.calls[1];
    const computeHeaders = (computeRequestInit as RequestInit).headers as Record<string, string>;
    expect(computeHeaders.Authorization).toBe('dynamic-key');
    const sentBody = JSON.parse((computeRequestInit as RequestInit).body as string);
    expect(sentBody.pipelineTasks[0].config.serviceId).toBe('ai4bharat/conformer-hi-gpu--t4');
  });

  it('sends webm as the declared audioFormat — no conversion step, per the confirmed Task 0 result', async () => {
    const fetchMock = mockFetchSequence([
      { ok: true, body: configSuccessBody() },
      { ok: true, body: asrSuccessBody('hello') },
    ]);
    vi.stubGlobal('fetch', fetchMock);
    const { transcribeBhashini } = await import('@/lib/ai/bhashini-asr-client');

    await transcribeBhashini(new Blob(['fake-audio'], { type: 'audio/webm' }), 'hi');

    const [, requestInit] = fetchMock.mock.calls[1];
    const sentBody = JSON.parse((requestInit as RequestInit).body as string);
    expect(sentBody.pipelineTasks[0].config.audioFormat).toBe('webm');
    expect(sentBody.pipelineTasks[0].config.language.sourceLanguage).toBe('hi');
  });

  it('throws on a non-ok compute response when there is no legacy key configured to fall back to', async () => {
    delete process.env.BHASHINI_INFERENCE_API_KEY;
    vi.stubGlobal(
      'fetch',
      mockFetchSequence([{ ok: true, body: configSuccessBody() }, { ok: false, status: 500 }]),
    );
    const { transcribeBhashini } = await import('@/lib/ai/bhashini-asr-client');

    await expect(transcribeBhashini(new Blob(['x']), 'hi')).rejects.toThrow();
  });

  it('throws on an empty transcript when there is no legacy key configured to fall back to', async () => {
    delete process.env.BHASHINI_INFERENCE_API_KEY;
    vi.stubGlobal(
      'fetch',
      mockFetchSequence([
        { ok: true, body: configSuccessBody() },
        { ok: true, body: { pipelineResponse: [{ output: [{ source: '' }] }] } },
      ]),
    );
    const { transcribeBhashini } = await import('@/lib/ai/bhashini-asr-client');

    await expect(transcribeBhashini(new Blob(['x']), 'hi')).rejects.toThrow();
  });
});

describe('transcribeBhashini — legacy fallback (live ULCA discovery has no registered service, e.g. Assamese)', () => {
  it('falls back to the legacy static-key scheme when discovery finds no service, and still returns a transcript', async () => {
    const fetchMock = mockFetchSequence([
      { ok: false, status: 400, body: noServiceFoundBody() }, // discovery miss
      { ok: true, body: asrSuccessBody('অসমীয়া প্ৰতিলিপি') }, // legacy compute call succeeds
    ]);
    vi.stubGlobal('fetch', fetchMock);
    const { transcribeBhashini } = await import('@/lib/ai/bhashini-asr-client');

    const result = await transcribeBhashini(new Blob(['fake-audio'], { type: 'audio/webm' }), 'as');

    expect(result.text).toBe('অসমীয়া প্ৰতিলিপি');
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const [, legacyRequestInit] = fetchMock.mock.calls[1];
    const legacyHeaders = (legacyRequestInit as RequestInit).headers as Record<string, string>;
    expect(legacyHeaders.Authorization).toBe('test-legacy-key');
    const sentBody = JSON.parse((legacyRequestInit as RequestInit).body as string);
    expect(sentBody.pipelineTasks[0].config.serviceId).toBe('bhashini/ai4bharat/conformer-multilingual-asr');
  });

  it('falls back when ULCA credentials are missing entirely, not just when discovery misses', async () => {
    delete process.env.BHASHINI_USER_ID;
    delete process.env.BHASHINI_ULCA_API_KEY;
    const fetchMock = mockFetchSequence([{ ok: true, body: asrSuccessBody('legacy-only transcript') }]);
    vi.stubGlobal('fetch', fetchMock);
    const { transcribeBhashini } = await import('@/lib/ai/bhashini-asr-client');

    const result = await transcribeBhashini(new Blob(['x']), 'as');

    expect(result.text).toBe('legacy-only transcript');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('throws when neither the primary discovery nor the legacy key are available', async () => {
    delete process.env.BHASHINI_USER_ID;
    delete process.env.BHASHINI_ULCA_API_KEY;
    delete process.env.BHASHINI_INFERENCE_API_KEY;
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const { transcribeBhashini } = await import('@/lib/ai/bhashini-asr-client');

    await expect(transcribeBhashini(new Blob(['x']), 'as')).rejects.toThrow();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('throws when both the discovery path and the legacy compute call fail', async () => {
    const fetchMock = mockFetchSequence([
      { ok: false, status: 400, body: noServiceFoundBody() },
      { ok: false, status: 500 },
    ]);
    vi.stubGlobal('fetch', fetchMock);
    const { transcribeBhashini } = await import('@/lib/ai/bhashini-asr-client');

    await expect(transcribeBhashini(new Blob(['x']), 'as')).rejects.toThrow();
  });
});
