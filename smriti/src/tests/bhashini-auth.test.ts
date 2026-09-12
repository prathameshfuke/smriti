import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const ORIGINAL_ENV = { ...process.env };

function mockFetchOnce(response: { ok?: boolean; status?: number; body?: unknown; throws?: boolean }) {
  return vi.fn().mockImplementation(() => {
    if (response.throws) return Promise.reject(new Error('network error'));
    return Promise.resolve({
      ok: response.ok,
      status: response.status ?? (response.ok ? 200 : 500),
      json: async () => response.body,
    });
  });
}

/** Shape of a real discovery-success response — serviceId comes back
 * resolved by Bhashini, never supplied by the caller (confirmed live: a
 * config call that sends its own guessed serviceId gets a bare 500, even
 * for known-working combinations). */
function configSuccessBody(serviceId: string, name: string, value: string) {
  return {
    pipelineResponseConfig: [{ config: [{ serviceId }] }],
    pipelineInferenceAPIEndPoint: { inferenceApiKey: { name, value } },
  };
}

beforeEach(() => {
  process.env.BHASHINI_USER_ID = 'test-user-id';
  process.env.BHASHINI_ULCA_API_KEY = 'test-ulca-key';
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  vi.unstubAllGlobals();
});

describe('fetchInferenceAuth', () => {
  it('returns the resolved serviceId and dynamic header name/value from a successful discovery call', async () => {
    vi.stubGlobal(
      'fetch',
      mockFetchOnce({ ok: true, body: configSuccessBody('ai4bharat/conformer-hi-gpu--t4', 'Authorization', 'dynamic-key-123') }),
    );
    const { fetchInferenceAuth } = await import('@/lib/ai/bhashini-auth');

    const auth = await fetchInferenceAuth('asr', 'hi');

    expect(auth).toEqual({ name: 'Authorization', value: 'dynamic-key-123', serviceId: 'ai4bharat/conformer-hi-gpu--t4' });
  });

  it('sends userID/ulcaApiKey headers and no serviceId in the request — discovery resolves it, the caller never supplies one', async () => {
    const fetchMock = mockFetchOnce({ ok: true, body: configSuccessBody('some/service', 'Authorization', 'k') });
    vi.stubGlobal('fetch', fetchMock);
    const { fetchInferenceAuth } = await import('@/lib/ai/bhashini-auth');

    await fetchInferenceAuth('tts', 'hi');

    const [url, requestInit] = fetchMock.mock.calls[0];
    expect(url).toBe('https://meity-auth.ulcacontrib.org/ulca/apis/v0/model/getModelsPipeline');
    const headers = (requestInit as RequestInit).headers as Record<string, string>;
    expect(headers.userID).toBe('test-user-id');
    expect(headers.ulcaApiKey).toBe('test-ulca-key');
    const sentBody = JSON.parse((requestInit as RequestInit).body as string);
    expect(sentBody.pipelineTasks[0].taskType).toBe('tts');
    expect(sentBody.pipelineTasks[0].config.language.sourceLanguage).toBe('hi');
    expect(sentBody.pipelineTasks[0].config.serviceId).toBeUndefined();
  });

  it('throws when BHASHINI_USER_ID/BHASHINI_ULCA_API_KEY are not configured', async () => {
    delete process.env.BHASHINI_USER_ID;
    delete process.env.BHASHINI_ULCA_API_KEY;
    vi.stubGlobal('fetch', vi.fn());
    const { fetchInferenceAuth } = await import('@/lib/ai/bhashini-auth');

    await expect(fetchInferenceAuth('asr', 'as')).rejects.toThrow();
  });

  it('throws on a "no service found" 400 — a real, expected outcome for a language this account has no registered service for', async () => {
    vi.stubGlobal('fetch', mockFetchOnce({ ok: false, status: 400, body: { message: 'No supported tasks found for this request!!' } }));
    const { fetchInferenceAuth } = await import('@/lib/ai/bhashini-auth');

    await expect(fetchInferenceAuth('asr', 'as')).rejects.toThrow('400');
  });

  it('throws on a non-ok config response for other reasons (auth failure, server error)', async () => {
    vi.stubGlobal('fetch', mockFetchOnce({ ok: false, status: 401 }));
    const { fetchInferenceAuth } = await import('@/lib/ai/bhashini-auth');

    await expect(fetchInferenceAuth('asr', 'hi')).rejects.toThrow('401');
  });

  it('throws when the config response has no usable serviceId/inferenceApiKey', async () => {
    vi.stubGlobal('fetch', mockFetchOnce({ ok: true, body: { pipelineResponseConfig: [], pipelineInferenceAPIEndPoint: {} } }));
    const { fetchInferenceAuth } = await import('@/lib/ai/bhashini-auth');

    await expect(fetchInferenceAuth('asr', 'hi')).rejects.toThrow();
  });

  it('rejects (never hangs) when the config call itself times out/aborts', async () => {
    vi.stubGlobal('fetch', mockFetchOnce({ throws: true }));
    const { fetchInferenceAuth } = await import('@/lib/ai/bhashini-auth');

    await expect(fetchInferenceAuth('asr', 'hi')).rejects.toThrow();
  });
});
