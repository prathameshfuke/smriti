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
    // gpt-oss reasons before replying: the visible 300 plus reasoning headroom, reasoning kept low.
    expect(sentBody.max_completion_tokens).toBe(700);
    expect(sentBody.reasoning_effort).toBe('low');
    expect(sentBody.temperature).toBe(0.3);
  });
});

describe('callChat', () => {
  it('prefers the larger Groq conversation model and asks for a JSON reply', async () => {
    const fetchMock = mockFetchSequence([{ ok: true, body: groqSuccessBody('{"reply":"Namaskar"}') }]);
    vi.stubGlobal('fetch', fetchMock);
    const { callChat } = await import('@/lib/ai/llm-client');

    const result = await callChat({ messages: [{ role: 'user', content: 'hi' }], json: true });

    expect(result).toEqual({ text: '{"reply":"Namaskar"}', model: 'groq/openai/gpt-oss-120b' });
    const sent = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(sent.model).toBe('openai/gpt-oss-120b');
    expect(sent.response_format).toEqual({ type: 'json_object' });
  });

  it('tries the smaller Groq model, then free OpenRouter slugs, and returns null text when all fail', async () => {
    const fetchMock = mockFetchSequence([
      { ok: false, status: 503 },
      { ok: false, status: 429 },
      // Free OpenRouter capacity is shared and answers 429 often, so the
      // second free slug has to be tried too.
      { ok: false, status: 429 },
      { ok: true, body: groqSuccessBody('hello') },
    ]);
    vi.stubGlobal('fetch', fetchMock);
    const { callChat } = await import('@/lib/ai/llm-client');

    const result = await callChat({ messages: [{ role: 'user', content: 'hi' }], json: true });
    expect(result.model).toBe('openrouter/google/gemma-4-31b-it:free');
    expect(JSON.parse(fetchMock.mock.calls[1][1].body).model).toBe('openai/gpt-oss-20b');
    // Every OpenRouter model tried is a free slug: a paid one 402s on this account.
    for (const call of fetchMock.mock.calls.slice(2)) {
      expect(JSON.parse(call[1].body).model).toMatch(/:free$/);
      expect(JSON.parse(call[1].body).response_format).toBeUndefined();
    }

    vi.stubGlobal('fetch', mockFetchSequence([{ ok: false, status: 500 }]));
    expect(await callChat({ messages: [{ role: 'user', content: 'hi' }] })).toEqual({ text: null, model: 'none' });
  });

  it('spends the reply and its verification on different Groq models, so each keeps its own free-tier budget', async () => {
    const fetchMock = mockFetchSequence([{ ok: true, body: groqSuccessBody('{"supported":true}') }]);
    vi.stubGlobal('fetch', fetchMock);
    const { callChat, GROQ_SMALL_MODEL, GROQ_CHAT_MODELS } = await import('@/lib/ai/llm-client');

    await callChat({ messages: [{ role: 'user', content: 'check' }], models: [GROQ_SMALL_MODEL], json: true });

    expect(JSON.parse(fetchMock.mock.calls[0][1].body).model).toBe(GROQ_SMALL_MODEL);
    expect(GROQ_CHAT_MODELS[0]).not.toBe(GROQ_SMALL_MODEL);
  });
});
