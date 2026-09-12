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

function configSuccessBody(serviceId = 'ai4bharat/indic-tts-coqui-indo_aryan-gpu--t4') {
  return {
    pipelineResponseConfig: [{ config: [{ serviceId }] }],
    pipelineInferenceAPIEndPoint: { inferenceApiKey: { name: 'Authorization', value: 'dynamic-key' } },
  };
}

function ttsSuccessBody(audioBase64: string, audioFormat = 'wav') {
  return { pipelineResponse: [{ taskType: 'tts', audio: [{ audioContent: audioBase64 }], config: { audioFormat } }] };
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

describe('synthesizeSpeech — primary path (live ULCA discovery resolves a service)', () => {
  it('returns audio on success, using the discovery-resolved service and dynamic auth header', async () => {
    const fetchMock = mockFetchSequence([
      { ok: true, body: configSuccessBody() },
      { ok: true, body: ttsSuccessBody('base64audio') },
    ]);
    vi.stubGlobal('fetch', fetchMock);
    const { synthesizeSpeech } = await import('@/lib/ai/bhashini-client');

    const result = await synthesizeSpeech('Hello', 'hi');

    expect(result.audioBase64).toBe('base64audio');
    expect(result.audioFormat).toBe('wav');
    expect(result.model).toContain('ai4bharat/indic-tts-coqui-indo_aryan-gpu--t4');
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const [, computeRequestInit] = fetchMock.mock.calls[1];
    const computeHeaders = (computeRequestInit as RequestInit).headers as Record<string, string>;
    expect(computeHeaders.Authorization).toBe('dynamic-key');
  });

  it('sends the mapped Bhashini language code to the discovery call, with no serviceId', async () => {
    const fetchMock = mockFetchSequence([
      { ok: true, body: configSuccessBody() },
      { ok: true, body: ttsSuccessBody('x') },
    ]);
    vi.stubGlobal('fetch', fetchMock);
    const { synthesizeSpeech } = await import('@/lib/ai/bhashini-client');

    await synthesizeSpeech('Hello', 'as');

    const [, configRequestInit] = fetchMock.mock.calls[0];
    const sentBody = JSON.parse((configRequestInit as RequestInit).body as string);
    expect(sentBody.pipelineTasks[0].taskType).toBe('tts');
    expect(sentBody.pipelineTasks[0].config.language.sourceLanguage).toBe('as');
    expect(sentBody.pipelineTasks[0].config.serviceId).toBeUndefined();
  });

  it('throws on a non-ok compute response when there is no legacy key configured to fall back to', async () => {
    delete process.env.BHASHINI_INFERENCE_API_KEY;
    vi.stubGlobal(
      'fetch',
      mockFetchSequence([{ ok: true, body: configSuccessBody() }, { ok: false, status: 500 }]),
    );
    const { synthesizeSpeech } = await import('@/lib/ai/bhashini-client');

    await expect(synthesizeSpeech('Hello', 'hi')).rejects.toThrow();
  });
});

describe('synthesizeSpeech — legacy fallback (discovery fails for any reason)', () => {
  it('falls back to the legacy static-key scheme when discovery finds no service, and still returns audio', async () => {
    const fetchMock = mockFetchSequence([
      { ok: false, status: 400, body: { message: 'No supported tasks found for this request!!' } },
      { ok: true, body: ttsSuccessBody('legacy-audio') },
    ]);
    vi.stubGlobal('fetch', fetchMock);
    const { synthesizeSpeech } = await import('@/lib/ai/bhashini-client');

    const result = await synthesizeSpeech('Hello', 'as');

    expect(result.audioBase64).toBe('legacy-audio');
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const [, legacyRequestInit] = fetchMock.mock.calls[1];
    const legacyHeaders = (legacyRequestInit as RequestInit).headers as Record<string, string>;
    expect(legacyHeaders.Authorization).toBe('test-legacy-key');
    const sentBody = JSON.parse((legacyRequestInit as RequestInit).body as string);
    expect(sentBody.pipelineTasks[0].config.serviceId).toBe('Bhashini/IITM/TTS');
  });

  it('falls back when ULCA credentials are missing entirely, not just when discovery misses', async () => {
    delete process.env.BHASHINI_USER_ID;
    delete process.env.BHASHINI_ULCA_API_KEY;
    const fetchMock = mockFetchSequence([{ ok: true, body: ttsSuccessBody('legacy-only-audio') }]);
    vi.stubGlobal('fetch', fetchMock);
    const { synthesizeSpeech } = await import('@/lib/ai/bhashini-client');

    const result = await synthesizeSpeech('Hello', 'hi');

    expect(result.audioBase64).toBe('legacy-only-audio');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('throws when neither the primary discovery nor the legacy key are available', async () => {
    delete process.env.BHASHINI_USER_ID;
    delete process.env.BHASHINI_ULCA_API_KEY;
    delete process.env.BHASHINI_INFERENCE_API_KEY;
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const { synthesizeSpeech } = await import('@/lib/ai/bhashini-client');

    await expect(synthesizeSpeech('Hello', 'hi')).rejects.toThrow();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('throws when both the discovery path and the legacy compute call fail', async () => {
    const fetchMock = mockFetchSequence([
      { ok: false, status: 400, body: { message: 'No supported tasks found for this request!!' } },
      { ok: false, status: 500 },
    ]);
    vi.stubGlobal('fetch', fetchMock);
    const { synthesizeSpeech } = await import('@/lib/ai/bhashini-client');

    await expect(synthesizeSpeech('Hello', 'hi')).rejects.toThrow();
  });
});
