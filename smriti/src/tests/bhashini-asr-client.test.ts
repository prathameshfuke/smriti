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

beforeEach(() => {
  process.env.BHASHINI_INFERENCE_API_KEY = 'test-bhashini-key';
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

describe('transcribeBhashini', () => {
  it('returns the transcript on success', async () => {
    vi.stubGlobal('fetch', mockFetchSequence([{ ok: true, body: asrSuccessBody('নমস্কাৰ') }]));
    const { transcribeBhashini } = await import('@/lib/ai/bhashini-asr-client');

    const result = await transcribeBhashini(new Blob(['fake-audio'], { type: 'audio/webm' }), 'as');

    expect(result.text).toBe('নমস্কাৰ');
    expect(result.model).toContain('bhashini');
  });

  it('sends webm as the declared audioFormat — no conversion step, per the confirmed Task 0 result', async () => {
    const fetchMock = mockFetchSequence([{ ok: true, body: asrSuccessBody('hello') }]);
    vi.stubGlobal('fetch', fetchMock);
    const { transcribeBhashini } = await import('@/lib/ai/bhashini-asr-client');

    await transcribeBhashini(new Blob(['fake-audio'], { type: 'audio/webm' }), 'hi');

    const [, requestInit] = fetchMock.mock.calls[0];
    const sentBody = JSON.parse((requestInit as RequestInit).body as string);
    expect(sentBody.pipelineTasks[0].config.audioFormat).toBe('webm');
    expect(sentBody.pipelineTasks[0].config.language.sourceLanguage).toBe('hi');
  });

  it('throws when the API key is not configured', async () => {
    delete process.env.BHASHINI_INFERENCE_API_KEY;
    vi.stubGlobal('fetch', vi.fn());
    const { transcribeBhashini } = await import('@/lib/ai/bhashini-asr-client');

    await expect(transcribeBhashini(new Blob(['x']), 'as')).rejects.toThrow();
  });

  it('throws on a non-ok response — no fallback provider inside this client, same contract as transcribe-client.ts', async () => {
    vi.stubGlobal('fetch', mockFetchSequence([{ ok: false, status: 500 }]));
    const { transcribeBhashini } = await import('@/lib/ai/bhashini-asr-client');

    await expect(transcribeBhashini(new Blob(['x']), 'as')).rejects.toThrow('500');
  });

  it('throws on an empty transcript rather than returning an empty string', async () => {
    vi.stubGlobal('fetch', mockFetchSequence([{ ok: true, body: { pipelineResponse: [{ output: [{ source: '' }] }] } }]));
    const { transcribeBhashini } = await import('@/lib/ai/bhashini-asr-client');

    await expect(transcribeBhashini(new Blob(['x']), 'as')).rejects.toThrow();
  });
});
