/**
 * Single entry point for every LLM call in the app. Features must call this,
 * never Groq/OpenRouter directly — that's what keeps provider fallback,
 * timeouts, and the "never throw to the UI" contract in one place.
 *
 * Server-only: reads GROQ_API_KEY / OPENROUTER_API_KEY from process.env.
 * Never import this from a Client Component.
 */

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
// 'llama-3.1-8b-instant' was retired from Groq's catalog (404s on every
// call) — verified live against the Groq API, 2026-09-08.
const GROQ_MODEL = 'openai/gpt-oss-20b';
/**
 * Conversation models, tried in order. The larger model is preferred for
 * Ask Smriti: probed live (scripts/probe-ai.mjs, 2026-09-17) it replied in
 * Assamese, Hindi and Bengali natively in under a second and kept small talk
 * free of invented details, where the 20b model added "Raju is coming today"
 * to a plain greeting.
 */
export const GROQ_CHAT_MODELS = ['openai/gpt-oss-120b', 'openai/gpt-oss-20b'] as const;

/**
 * Groq's free tier meters per model: 1,000 requests/day and 8,000
 * tokens/minute each (read from the live rate-limit headers, 2026-09-18).
 * A conversation turn makes two calls — the reply and the check that it
 * invented nothing — so the check runs on this smaller model to keep both
 * inside their own budget instead of spending one model's minute twice.
 */
export const GROQ_SMALL_MODEL = 'openai/gpt-oss-20b';
const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
/**
 * Both accounts are on the free tier, which decides every model choice here.
 *
 * OpenRouter free tier serves only `:free` slugs; a paid slug answers 402
 * once the small starting balance is gone, so the fallback would die
 * silently. These two are the free slugs that exist for this account
 * (checked live, 2026-09-18) — they are tried in order because free
 * capacity is shared and each answers 429 "rate-limited upstream" fairly
 * often, which is exactly what happened to all of them during that check.
 */
const OPENROUTER_MODELS = ['qwen/qwen3.8-27b:free', 'google/gemma-4-31b-it:free'] as const;

export const FALLBACK_TEXT =
  "I can't check that right now. Try again in a moment, or ask your caregiver.";

export interface CallLLMParams {
  systemPrompt: string;
  userPrompt: string;
  /** Default 300 — keeps answers short for elderly listeners. */
  maxTokens?: number;
  /** Default 0.3 — low, factual, not creative. */
  temperature?: number;
}

export interface CallLLMResult {
  text: string;
  model: string;
  /** Whether a real model call succeeded (vs. the canned fallback). Callers
   * that ground answers in caregiver-supplied facts apply their own,
   * separate "grounded in Memory Bank" check on top of this. */
  grounded: boolean;
}

/** A hung connection (accepted but never responding) must not block the
 * patient-facing companion request forever — this is what actually forces a
 * fall-through to the next provider, then to the canned fallback text. */
const PROVIDER_TIMEOUT_MS = 15_000;

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface ProviderRequest {
  messages: ChatMessage[];
  maxTokens: number;
  temperature: number;
  /** Ask for a JSON object reply (Groq only; other providers are parsed leniently). */
  json?: boolean;
  timeoutMs?: number;
}

/** gpt-oss models spend part of the token budget on hidden reasoning before
 * the visible reply. Keeping reasoning low and the budget above the visible
 * length stops a longer answer from coming back empty. */
function isReasoningModel(model: string): boolean {
  return model.startsWith('openai/gpt-oss');
}

async function requestProvider(url: string, apiKey: string, model: string, req: ProviderRequest): Promise<string> {
  const reasoning = isReasoningModel(model);
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: req.messages,
      ...(reasoning
        ? { max_completion_tokens: req.maxTokens + 400, reasoning_effort: 'low' }
        : { max_tokens: req.maxTokens }),
      temperature: req.temperature,
      ...(req.json && url === GROQ_URL ? { response_format: { type: 'json_object' } } : {}),
    }),
    signal: AbortSignal.timeout(req.timeoutMs ?? PROVIDER_TIMEOUT_MS),
  });

  if (!response.ok) {
    // Status only — provider error bodies can echo the prompt, which holds patient data.
    console.error(`SMRITI: ${model} returned ${response.status}`);
    throw new Error(`Provider returned ${response.status}`);
  }

  const body = await response.json();
  const text = body?.choices?.[0]?.message?.content;
  if (typeof text !== 'string' || text.length === 0) {
    throw new Error('Provider returned an empty response');
  }
  return text;
}

async function callProvider(
  url: string,
  apiKey: string,
  model: string,
  params: Required<CallLLMParams>,
): Promise<string> {
  return requestProvider(url, apiKey, model, {
    messages: [
      { role: 'system', content: params.systemPrompt },
      { role: 'user', content: params.userPrompt },
    ],
    maxTokens: params.maxTokens,
    temperature: params.temperature,
  });
}

export interface CallChatParams {
  messages: ChatMessage[];
  /** Groq models to try, in order. Defaults to GROQ_CHAT_MODELS. */
  models?: readonly string[];
  /** Visible reply budget. Default 400. */
  maxTokens?: number;
  /** Default 0.4 — warm but not inventive. */
  temperature?: number;
  json?: boolean;
  timeoutMs?: number;
}

export interface CallChatResult {
  /** Null when every provider failed. */
  text: string | null;
  model: string;
}

/**
 * Multi-turn chat for Ask Smriti: Groq's conversation models in order, then
 * OpenRouter. Never throws — `text: null` means nothing could be reached, and
 * the caller shows its own "can't check right now" reply.
 */
export async function callChat(params: CallChatParams): Promise<CallChatResult> {
  const req: ProviderRequest = {
    messages: params.messages,
    maxTokens: params.maxTokens ?? 400,
    temperature: params.temperature ?? 0.4,
    json: params.json,
    timeoutMs: params.timeoutMs,
  };

  const groqKey = process.env.GROQ_API_KEY;
  if (groqKey) {
    for (const model of params.models ?? GROQ_CHAT_MODELS) {
      try {
        return { text: await requestProvider(GROQ_URL, groqKey, model, req), model: `groq/${model}` };
      } catch {
        // Next model: a 429 here is a free-tier minute budget, not a dead provider.
      }
    }
  }

  const openRouterKey = process.env.OPENROUTER_API_KEY;
  if (openRouterKey) {
    for (const model of OPENROUTER_MODELS) {
      try {
        return { text: await requestProvider(OPENROUTER_URL, openRouterKey, model, req), model: `openrouter/${model}` };
      } catch {
        // Next free slug.
      }
    }
  }

  return { text: null, model: 'none' };
}

export async function callLLM(params: CallLLMParams): Promise<CallLLMResult> {
  const resolved: Required<CallLLMParams> = {
    systemPrompt: params.systemPrompt,
    userPrompt: params.userPrompt,
    maxTokens: params.maxTokens ?? 300,
    temperature: params.temperature ?? 0.3,
  };

  const groqKey = process.env.GROQ_API_KEY;
  if (groqKey) {
    try {
      const text = await callProvider(GROQ_URL, groqKey, GROQ_MODEL, resolved);
      return { text, model: `groq/${GROQ_MODEL}`, grounded: true };
    } catch {
      // Fall through to OpenRouter.
    }
  }

  const openRouterKey = process.env.OPENROUTER_API_KEY;
  if (openRouterKey) {
    for (const model of OPENROUTER_MODELS) {
      try {
        const text = await callProvider(OPENROUTER_URL, openRouterKey, model, resolved);
        return { text, model: `openrouter/${model}`, grounded: true };
      } catch {
        // Next free slug, then the canned response.
      }
    }
  }

  return { text: FALLBACK_TEXT, model: 'none', grounded: false };
}
