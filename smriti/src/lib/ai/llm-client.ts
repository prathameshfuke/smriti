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
const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
// 'meta-llama/llama-3.1-8b-instruct:free' was retired; OpenRouter's own
// error response names the paid slug below as the replacement — verified
// live, 2026-09-08.
const OPENROUTER_MODEL = 'meta-llama/llama-3.1-8b-instruct';

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
    for (const model of GROQ_CHAT_MODELS) {
      try {
        return { text: await requestProvider(GROQ_URL, groqKey, model, req), model: `groq/${model}` };
      } catch {
        // Next model.
      }
    }
  }

  const openRouterKey = process.env.OPENROUTER_API_KEY;
  if (openRouterKey) {
    try {
      return { text: await requestProvider(OPENROUTER_URL, openRouterKey, OPENROUTER_MODEL, req), model: `openrouter/${OPENROUTER_MODEL}` };
    } catch {
      // Fall through.
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
    try {
      const text = await callProvider(OPENROUTER_URL, openRouterKey, OPENROUTER_MODEL, resolved);
      return { text, model: `openrouter/${OPENROUTER_MODEL}`, grounded: true };
    } catch {
      // Fall through to the canned response.
    }
  }

  return { text: FALLBACK_TEXT, model: 'none', grounded: false };
}
