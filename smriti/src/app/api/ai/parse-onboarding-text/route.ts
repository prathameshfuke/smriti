import { authenticateRequest } from '@/lib/supabase/server-auth';
import { callLLM } from '@/lib/ai/llm-client';
import { validateParsedEntries } from '@/lib/ai/onboarding-parser';

interface ParseRequestBody {
  text?: string;
}

const SYSTEM_PROMPT =
  'Extract people and facts from this caregiver description. Output strict JSON only — no ' +
  'prose, no markdown code fences — in this exact shape: [{"category": "person|life_fact|' +
  'schedule", "title": "...", "detail": "...", "relationship": "..." or null}]. Only extract ' +
  'what is explicitly stated — never infer ages, never invent details not in the text.';

/**
 * Pure text-in, JSON-out. No database write here at all — the caregiver
 * reviews every extracted entry and explicitly confirms before anything
 * reaches memory_bank_entries, via the existing manual-entry write path.
 */
export async function POST(request: Request) {
  const auth = await authenticateRequest(request);
  if (!auth) return Response.json({ error: 'unauthorized' }, { status: 401 });

  let body: ParseRequestBody;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'invalid_json' }, { status: 400 });
  }
  if (!body?.text?.trim()) return Response.json({ error: 'missing_text' }, { status: 400 });

  const result = await callLLM({ systemPrompt: SYSTEM_PROMPT, userPrompt: body.text, maxTokens: 800 });
  const entries = validateParsedEntries(result.text);

  if (!entries) {
    console.error('onboarding text extraction produced invalid output:', result.text);
    return Response.json({ error: 'invalid_extraction' }, { status: 502 });
  }

  return Response.json({ entries });
}
