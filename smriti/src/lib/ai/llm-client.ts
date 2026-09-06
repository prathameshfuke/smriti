/**
 * Single entry point for every LLM call in the app. Features must call this,
 * never Groq/OpenRouter directly — that's what keeps provider fallback,
 * timeouts, and the "never throw to the UI" contract in one place.
 *
 * Server-only: reads GROQ_API_KEY / OPENROUTER_API_KEY from process.env.
 * Never import this from a Client Component.
 */

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODEL = 'llama-3.1-8b-instant';
const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const OPENROUTER_MODEL = 'meta-llama/llama-3.1-8b-instruct:free';

export const FALLBACK_TEXT =
  "I can't check that right now — try again in a moment, or ask your caregiver.";

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

async function callProvider(
  url: string,
  apiKey: string,
  model: string,
  params: Required<CallLLMParams>,
): Promise<string> {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: params.systemPrompt },
        { role: 'user', content: params.userPrompt },
      ],
      max_tokens: params.maxTokens,
      temperature: params.temperature,
    }),
    signal: AbortSignal.timeout(PROVIDER_TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new Error(`Provider returned ${response.status}`);
  }

  const body = await response.json();
  const text = body?.choices?.[0]?.message?.content;
  if (typeof text !== 'string' || text.length === 0) {
    throw new Error('Provider returned an empty response');
  }
  return text;
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
