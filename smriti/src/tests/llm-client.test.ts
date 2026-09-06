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

function groqSuccessBody(text = 'The sky is blue.') {
  return { choices: [{ message: { content: text } }] };
}

beforeEach(() => {
  process.env.GROQ_API_KEY = 'test-groq-key';
  process.env.OPENROUTER_API_KEY = 'test-openrouter-key';
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  vi.unstubAllGlobals();
});

describe('callLLM', () => {
  it('returns the Groq response on success', async () => {
    vi.stubGlobal('fetch', mockFetchSequence([{ ok: true, body: groqSuccessBody('Hello from Groq') }]));
    const { callLLM } = await import('@/lib/ai/llm-client');

    const result = await callLLM({ systemPrompt: 'sys', userPrompt: 'hi' });

    expect(result.text).toBe('Hello from Groq');
    expect(result.model).toContain('groq');
    expect(result.grounded).toBe(true);
  });

  it('falls through to OpenRouter when Groq fails', async () => {
    vi.stubGlobal(
      'fetch',
      mockFetchSequence([
        { ok: false, status: 429 },
        { ok: true, body: groqSuccessBody('Hello from OpenRouter') },
      ]),
    );
    const { callLLM } = await import('@/lib/ai/llm-client');

    const result = await callLLM({ systemPrompt: 'sys', userPrompt: 'hi' });

    expect(result.text).toBe('Hello from OpenRouter');
    expect(result.model).toContain('openrouter');
    expect(result.grounded).toBe(true);
  });

  it('returns the canned fallback when both providers fail, and never throws', async () => {
    vi.stubGlobal(
      'fetch',
      mockFetchSequence([
        { throws: true },
        { ok: false, status: 500 },
      ]),
    );
    const { callLLM } = await import('@/lib/ai/llm-client');

    await expect(callLLM({ systemPrompt: 'sys', userPrompt: 'hi' })).resolves.toMatchObject({
      grounded: false,
    });
    const result = await callLLM({ systemPrompt: 'sys', userPrompt: 'hi' });
    expect(result.text.length).toBeGreaterThan(0);
    expect(result.grounded).toBe(false);
  });

  it('never leaks the API key into the returned object', async () => {
    vi.stubGlobal('fetch', mockFetchSequence([{ ok: true, body: groqSuccessBody() }]));
    const { callLLM } = await import('@/lib/ai/llm-client');

    const result = await callLLM({ systemPrompt: 'sys', userPrompt: 'hi' });

    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain('test-groq-key');
    expect(serialized).not.toContain('test-openrouter-key');
    expect(serialized).not.toContain('gsk_');
  });

  it('respects maxTokens and temperature defaults without requiring the caller to pass them', async () => {
    const fetchMock = mockFetchSequence([{ ok: true, body: groqSuccessBody() }]);
    vi.stubGlobal('fetch', fetchMock);
    const { callLLM } = await import('@/lib/ai/llm-client');

    await callLLM({ systemPrompt: 'sys', userPrompt: 'hi' });

    const [, requestInit] = fetchMock.mock.calls[0];
    const sentBody = JSON.parse((requestInit as RequestInit).body as string);
    expect(sentBody.max_tokens).toBe(300);
    expect(sentBody.temperature).toBe(0.3);
  });
});
