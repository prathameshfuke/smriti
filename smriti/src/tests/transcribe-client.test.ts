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

beforeEach(() => {
  process.env.GROQ_API_KEY = 'test-groq-key';
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  vi.unstubAllGlobals();
});

describe('transcribeAudio', () => {
  it('returns the transcript on success', async () => {
    vi.stubGlobal('fetch', mockFetchSequence([{ ok: true, body: { text: 'hello there' } }]));
    const { transcribeAudio } = await import('@/lib/ai/transcribe-client');

    const result = await transcribeAudio(new Blob(['fake-audio'], { type: 'audio/webm' }));

    expect(result.text).toBe('hello there');
    expect(result.model).toContain('groq');
  });

  it('sends a real AbortSignal on the request — a hung Groq connection must not block the companion flow forever', async () => {
    const fetchMock = mockFetchSequence([{ ok: true, body: { text: 'hi' } }]);
    vi.stubGlobal('fetch', fetchMock);
    const { transcribeAudio } = await import('@/lib/ai/transcribe-client');

    await transcribeAudio(new Blob(['fake-audio'], { type: 'audio/webm' }));

    const [, requestInit] = fetchMock.mock.calls[0];
    expect((requestInit as RequestInit).signal).toBeInstanceOf(AbortSignal);
  });

  it('rejects rather than hanging when the request times out', async () => {
    // Mirrors sync.test.ts's approach: simulate what AbortSignal.timeout()
    // produces (a rejected fetch) instead of waiting out a real timer.
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('The operation was aborted')));
    const { transcribeAudio } = await import('@/lib/ai/transcribe-client');

    await expect(transcribeAudio(new Blob(['x']))).rejects.toThrow();
  });

  it('throws when the API key is not configured', async () => {
    delete process.env.GROQ_API_KEY;
    vi.stubGlobal('fetch', vi.fn());
    const { transcribeAudio } = await import('@/lib/ai/transcribe-client');

    await expect(transcribeAudio(new Blob(['x']))).rejects.toThrow();
  });

  it('throws on a non-ok response — no fallback provider inside this client, caller decides what happens next', async () => {
    vi.stubGlobal('fetch', mockFetchSequence([{ ok: false, status: 500 }]));
    const { transcribeAudio } = await import('@/lib/ai/transcribe-client');

    await expect(transcribeAudio(new Blob(['x']))).rejects.toThrow('500');
  });

  it('throws on an empty transcript rather than returning an empty string', async () => {
    vi.stubGlobal('fetch', mockFetchSequence([{ ok: true, body: { text: '' } }]));
    const { transcribeAudio } = await import('@/lib/ai/transcribe-client');

    await expect(transcribeAudio(new Blob(['x']))).rejects.toThrow();
  });
});
