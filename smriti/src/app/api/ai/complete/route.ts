import { v4 as uuid } from 'uuid';
import { authenticateRequest } from '@/lib/supabase/server-auth';
import { createServiceRoleClient } from '@/lib/supabase/client';
import { verifyDeviceTrust } from '@/lib/auth/deviceTrustServer';
import { callLLM } from '@/lib/ai/llm-client';
import { matchSeverity, TELE_MANAS_RESPONSE } from '@/lib/ai/distress-keywords';

interface CompleteRequestBody {
  question: string;
  /** Present when the caller is a kiosk-trusted patient device with no
   * Supabase session — verified server-side below against
   * DEVICE_TRUST_SECRET (see lib/auth/deviceTrustServer.ts). The client
   * cannot compute a valid signature itself; it only ever holds one handed
   * to it by the authenticated POST /api/device-trust route. */
  deviceTrustToken?: { patientId: string; issuedAt: number; issuedBy: string; signature: string };
  /** Required alongside a caregiver Bearer token, since that path has no
   * device token to say which patient the question is about. */
  patientId?: string;
}

const NOT_FOUND_PATTERNS = [
  /i don'?t know/i,
  /not (?:something )?i (?:can|could) find/i,
  /no (?:information|record)/i,
];

/** Exact phrase the system prompt hard-instructs the model to say verbatim
 * when a question can't be answered from the facts — also returned directly
 * on the zero-active-facts short-circuit below, so both paths produce the
 * identical, testable string. */
const EXACT_FALLBACK_TEXT = "I'm not sure about that — you could ask your caregiver.";

/** How many of the patient's most recent logged questions to look back
 * through when counting repeated low-severity distress phrases. */
const DISTRESS_LOOKBACK = 5;
/** Repeated low-severity matches (current question + lookback) at or above
 * this count short-circuit the same as a single high-severity phrase. */
const DISTRESS_LOW_THRESHOLD = 2;

function isGroundedAnswer(text: string): boolean {
  if (text.includes(EXACT_FALLBACK_TEXT)) return false;
  return !NOT_FOUND_PATTERNS.some((pattern) => pattern.test(text));
}

/** Words too common to count as evidence an answer actually drew on a fact
 * (English plus a few frequent Hindi/Assamese function words, since patients'
 * memory-bank facts are often in the local language). */
const STOPWORDS = new Set([
  'the', 'a', 'an', 'is', 'was', 'are', 'were', 'and', 'or', 'to', 'of', 'in',
  'on', 'at', 'for', 'with', 'your', 'you', 'he', 'she', 'they', 'it', 'his',
  'her', 'their', 'this', 'that', 'i', 'not', 'sure', 'about', 'ask', 'my',
  'me', 'we', 'us', 'ke', 'ki', 'ka', 'hai', 'aur', 'se', 'ko', 'ek',
]);

/** Lowercased, punctuation-stripped, stopword-filtered significant words. */
function significantWords(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .split(/[^\p{L}\p{N}]+/u)
      .filter((w) => w.length > 2 && !STOPWORDS.has(w)),
  );
}

/** How many of a fact's key terms (title, relationship, detail) actually
 * show up in the model's answer. */
type Fact = { title: string; detail: string; relationship: string | null; category: string };

/**
 * A model given real facts can still fabricate an answer to a question those
 * facts don't cover — the "say exactly ..." system-prompt line and the
 * `isGroundedAnswer` pattern check above only catch the model admitting it
 * doesn't know; they do nothing if it just invents a plausible-sounding
 * answer instead. This checks the answer text for actual keyword/entity
 * overlap with at least one of the facts that were put in the prompt, as a
 * cheap proxy for "this answer was actually derived from a provided fact"
 * without a second LLM call.
 */
function overlapsAnyFact(answerText: string, facts: Fact[]): boolean {
  const answerWords = significantWords(answerText);
  if (answerWords.size === 0) return false;
  return facts.some((fact) => {
    const factWords = significantWords(
      [fact.title, fact.relationship ?? '', fact.detail].join(' '),
    );
    for (const word of factWords) {
      if (answerWords.has(word)) return true;
    }
    return false;
  });
}

type ServiceClient = ReturnType<typeof createServiceRoleClient>;

async function logExchange(
  service: ServiceClient,
  params: {
    patientId: string;
    question: string;
    answer: string;
    grounded: boolean;
    modelUsed: string;
    flaggedForFollowup: boolean;
  },
): Promise<void> {
  await service.from('ai_conversation_log').insert({
    id: uuid(),
    patient_id: params.patientId,
    question: params.question,
    answer: params.answer,
    grounded: params.grounded,
    flagged_for_followup: params.flaggedForFollowup,
    model_used: params.modelUsed,
  });
}

export async function POST(request: Request) {
  let body: CompleteRequestBody;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'invalid_json' }, { status: 400 });
  }
  if (!body?.question) return Response.json({ error: 'missing_question' }, { status: 400 });

  let patientId: string | null = null;
  let isPatientDevice = false;

  if (body.deviceTrustToken) {
    if (!verifyDeviceTrust(body.deviceTrustToken)) {
      return Response.json({ error: 'invalid_device_token' }, { status: 401 });
    }
    patientId = body.deviceTrustToken.patientId;
    isPatientDevice = true;
  } else {
    const auth = await authenticateRequest(request);
    if (!auth) return Response.json({ error: 'unauthorized' }, { status: 401 });
    if (!body.patientId) return Response.json({ error: 'missing_patient_id' }, { status: 400 });

    // A caregiver Bearer token proves identity, not ownership of this patient.
    const { data: caregiver } = await auth.supabase.from('caregivers').select('id').eq('auth_id', auth.userId).single();
    if (!caregiver) return Response.json({ error: 'caregiver_not_found' }, { status: 404 });
    const { data: owned } = await auth.supabase
      .from('patients')
      .select('id')
      .eq('id', body.patientId)
      .eq('caregiver_id', caregiver.id)
      .single();
    if (!owned) return Response.json({ error: 'patient_not_found' }, { status: 404 });

    patientId = body.patientId;
  }
  const pid = patientId as string;

  // Service role from here on: the caller was already authorized above
  // (device-trust signature check, or caregiver ownership check).
  const service = createServiceRoleClient();

  const respond = (text: string, grounded: boolean, model: string) =>
    isPatientDevice ? Response.json({ text, grounded }) : Response.json({ text, grounded, model });

  // Distress check runs before any LLM call, ever — this is a hard
  // short-circuit, not a prompt instruction the model could ignore.
  const severity = matchSeverity(body.question);
  if (severity === 'high') {
    await logExchange(service, {
      patientId: pid,
      question: body.question,
      answer: TELE_MANAS_RESPONSE,
      grounded: false,
      modelUsed: 'distress-shortcircuit',
      flaggedForFollowup: true,
    });
    return respond(TELE_MANAS_RESPONSE, false, 'distress-shortcircuit');
  }
  if (severity === 'low') {
    const { data: recent } = await service
      .from('ai_conversation_log')
      .select('question')
      .eq('patient_id', pid)
      .order('created_at', { ascending: false })
      .limit(DISTRESS_LOOKBACK);
    const lowMatches = [body.question, ...(recent ?? []).map((r) => r.question)].filter(
      (q) => matchSeverity(q) === 'low',
    ).length;
    if (lowMatches >= DISTRESS_LOW_THRESHOLD) {
      await logExchange(service, {
        patientId: pid,
        question: body.question,
        answer: TELE_MANAS_RESPONSE,
        grounded: false,
        modelUsed: 'distress-shortcircuit',
        flaggedForFollowup: true,
      });
      return respond(TELE_MANAS_RESPONSE, false, 'distress-shortcircuit');
    }
  }

  const { data: facts } = await service
    .from('memory_bank_entries')
    .select('title, detail, relationship, category')
    .eq('patient_id', pid)
    .eq('active', true);

  const factLines = (facts ?? [])
    .map((f) => (f.relationship ? `${f.title} (${f.relationship}): ${f.detail}` : `${f.title}: ${f.detail}`))
    .join('\n');

  // No facts at all means nothing can ground an answer — skip the LLM
  // entirely rather than trust a small, fast model to always obey the
  // "say exactly" instruction below.
  if (!facts || facts.length === 0) {
    await logExchange(service, {
      patientId: pid,
      question: body.question,
      answer: EXACT_FALLBACK_TEXT,
      grounded: false,
      modelUsed: 'none',
      flaggedForFollowup: false,
    });
    return respond(EXACT_FALLBACK_TEXT, false, 'none');
  }

  const systemPrompt =
    'You are a gentle memory companion for a person with memory changes. Answer ONLY using the facts ' +
    'listed below. If the question cannot be answered from these facts, say exactly: ' +
    `${EXACT_FALLBACK_TEXT} Never guess, never use outside knowledge, keep the answer under 3 short ` +
    `sentences, speak warmly and simply.\n\nFacts:\n${factLines}`;

  const result = await callLLM({ systemPrompt, userPrompt: body.question });
  const grounded =
    result.grounded && isGroundedAnswer(result.text) && overlapsAnyFact(result.text, facts);
  // Facts existed, but the answer neither admitted "I don't know" nor
  // actually referenced any of them — treat it as fabricated and swap in
  // the same safe fallback used for the zero-facts case, rather than
  // returning an answer nothing in the prompt actually supports.
  const answerText = grounded ? result.text : EXACT_FALLBACK_TEXT;

  await logExchange(service, {
    patientId: pid,
    question: body.question,
    answer: answerText,
    grounded,
    modelUsed: result.model,
    flaggedForFollowup: false,
  });

  return respond(answerText, grounded, result.model);
}
