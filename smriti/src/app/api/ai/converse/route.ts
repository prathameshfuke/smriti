import { parseRequestFacts } from '@/lib/ai/request-facts';
import { v4 as uuid } from 'uuid';
import { createServiceRoleClient } from '@/lib/supabase/client';
import { callChat, GROQ_SMALL_MODEL } from '@/lib/ai/llm-client';
import { matchSeverity, TELE_MANAS_RESPONSE } from '@/lib/ai/distress-keywords';
import { translateText } from '@/lib/ai/bhashini-nmt-client';
import { synthesizeSpeech } from '@/lib/ai/bhashini-client';
import { authorizeCompanionCaller } from '@/lib/ai/companion-auth';
import { memoryEntryToFact } from '@/lib/ai/companion-facts';
import {
  MAX_FACTS_PER_QUESTION,
  rankFacts,
  selectFactsForPrompt,
  type CompanionFact,
} from '@/lib/ai/companion-retrieval';
import {
  MAX_MESSAGE_LENGTH,
  buildConversationMessages,
  buildVerifierMessages,
  isInLanguageScript,
  parseModelReply,
  parseVerifierVerdict,
  sanitizeHistory,
  type HistoryTurn,
  type ModelReply,
} from '@/lib/ai/companion-conversation';
import { hasServerConsent } from '@/lib/consent/consentServer';
import { isUILanguage, type UILanguage } from '@/lib/i18n/languages';

/**
 * One turn of an Ask Smriti conversation.
 *
 * Pipeline: authorize → consent → distress keywords → Memory Bank retrieval
 * → reply from the model, in the patient's own language → independent check
 * that the reply invents nothing about the patient's life → optional speech
 * → log.
 *
 * The model writes the reply in the patient's language directly. Translating
 * through Bhashini was slower (≈5s per direction) and, in the live probe,
 * returned intermittent 502s and translated names as words ("ৰাজু" became
 * "the king"), which corrupts exactly the facts a patient asks about.
 * Bhashini translation is kept only as a fallback for a reply that comes back
 * in the wrong language, and Bhashini still does speech.
 */

interface ConverseRequestBody {
  message?: unknown;
  history?: unknown;
  language?: unknown;
  /** Phone's local date and time in words, so "what day is it" uses the patient's day. */
  clientContext?: { date?: unknown; time?: unknown };
  /** Groups turns of one conversation in the caregiver's log. */
  sessionId?: unknown;
  /** Also return Bhashini speech for the reply, saving the phone a second request. */
  speak?: unknown;
  deviceTrustToken?: { patientId: string; issuedAt: number; issuedBy: string; signature: string };
  patientId?: string;
  /** Active Memory Bank entries from the phone (see lib/ai/request-facts.ts). */
  facts?: unknown;
}

/**
 * `answer`: show and speak `text`. The other kinds are fixed replies the
 * phone shows from its own reviewed translations: `unknown` (nothing
 * verifiable to say), `distress` (Tele-MANAS helpline), `unavailable`
 * (no AI provider reachable).
 */
type ConverseKind = 'answer' | 'unknown' | 'distress' | 'unavailable';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_CONTEXT_LENGTH = 60;
const DISTRESS_LOOKBACK = 5;
const DISTRESS_LOW_THRESHOLD = 2;
const VERIFY_TIMEOUT_MS = 8_000;
const RETRIEVAL_TRANSLATE_TIMEOUT_MS = 3_000;
const SPEECH_TIMEOUT_MS = 12_000;
/** Postgres "undefined column" — `session_id` before MIGRATION 015. */
const UNDEFINED_COLUMN = '42703';

type ServiceClient = ReturnType<typeof createServiceRoleClient>;

function cleanContext(value: unknown): string | null {
  return typeof value === 'string' && value.trim() && value.length <= MAX_CONTEXT_LENGTH ? value.trim() : null;
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([promise, new Promise<T>((_, reject) => setTimeout(() => reject(new Error('timeout')), ms))]);
}

async function logTurn(
  service: ServiceClient,
  row: {
    patientId: string;
    sessionId: string | null;
    question: string;
    answer: string;
    grounded: boolean;
    modelUsed: string;
    flagged: boolean;
  },
): Promise<void> {
  const base = {
    id: uuid(),
    patient_id: row.patientId,
    question: row.question,
    answer: row.answer,
    grounded: row.grounded,
    flagged_for_followup: row.flagged,
    model_used: row.modelUsed,
  };
  let { error } = await service
    .from('ai_conversation_log')
    .insert((row.sessionId ? { ...base, session_id: row.sessionId } : base) as never);
  // Before MIGRATION 015 there is no session column; the turn is still logged.
  if (error?.code === UNDEFINED_COLUMN && row.sessionId) {
    ({ error } = await service.from('ai_conversation_log').insert(base as never));
  }
  if (error) console.error('SMRITI: failed to log companion turn', error.message);
}

/**
 * The facts to put in front of the model: whatever the previous reply was
 * based on first (so "and where does he live?" still has "he"), then the
 * best matches for this message and the one before it. For a Memory Bank too
 * big to send whole, a non-English message that matches nothing by word is
 * translated for retrieval only — never for answering — with a tight timeout.
 */
async function selectFacts(
  facts: CompanionFact[],
  message: string,
  history: HistoryTurn[],
  language: UILanguage,
): Promise<CompanionFact[]> {
  const carried = new Set(history.filter((t) => t.role === 'assistant').at(-1)?.factIds ?? []);
  const lastUser = history.filter((t) => t.role === 'user').at(-1)?.text;
  const queries = [message, ...(lastUser ? [lastUser] : [])];

  if (facts.length > MAX_FACTS_PER_QUESTION && language !== 'en' && !rankFacts(queries, facts).some((r) => r.score > 0)) {
    try {
      const english = await withTimeout(translateText(message, language, 'en'), RETRIEVAL_TRANSLATE_TIMEOUT_MS);
      queries.push(english.text);
    } catch {
      // Retrieval falls back to kind-ordered facts.
    }
  }

  const ordered = [...facts.filter((f) => carried.has(f.id)), ...selectFactsForPrompt(queries, facts)];
  const seen = new Set<string>();
  return ordered.filter((f) => !seen.has(f.id) && seen.add(f.id)).slice(0, MAX_FACTS_PER_QUESTION);
}

async function getModelReply(messages: ReturnType<typeof buildConversationMessages>, factCount: number) {
  const first = await callChat({ messages, json: true });
  if (first.text === null) return { reply: null, model: first.model, reachable: false };
  const parsed = parseModelReply(first.text, factCount);
  if (parsed) return { reply: parsed, model: first.model, reachable: true };
  // A malformed reply gets one more, cooler attempt before giving up.
  const second = await callChat({ messages, json: true, temperature: 0.2 });
  return { reply: parseModelReply(second.text, factCount), model: second.model, reachable: second.text !== null };
}

/**
 * Whether a reply may be shown. Memory replies must cite real facts; every
 * reply is then checked by the independent verifier. If the verifier can't
 * be reached, only replies whose safety doesn't depend on it pass: cited
 * memory replies, clarifying questions and "not written down" replies.
 */
async function isReplyAllowed(reply: ModelReply, facts: CompanionFact[], history: HistoryTurn[], message: string) {
  if (reply.type === 'memory' && reply.cited.length === 0) return false;
  const verdict = await callChat({
    messages: buildVerifierMessages(facts, history, message, reply.reply),
    // The smaller model, so the reply and its check draw on separate
    // free-tier budgets (see GROQ_SMALL_MODEL).
    models: [GROQ_SMALL_MODEL],
    json: true,
    maxTokens: 120,
    temperature: 0,
    timeoutMs: VERIFY_TIMEOUT_MS,
  });
  const supported = parseVerifierVerdict(verdict.text);
  if (supported !== null) return supported;
  return reply.type !== 'chitchat';
}

export async function POST(request: Request) {
  let body: ConverseRequestBody;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'invalid_json' }, { status: 400 });
  }
  const message = typeof body?.message === 'string' ? body.message.trim() : '';
  if (!message) return Response.json({ error: 'missing_message' }, { status: 400 });
  if (message.length > MAX_MESSAGE_LENGTH) return Response.json({ error: 'message_too_long' }, { status: 400 });
  const language: UILanguage = isUILanguage(body.language) ? body.language : 'en';
  const history = sanitizeHistory(body.history);
  const sessionId = typeof body.sessionId === 'string' && UUID_RE.test(body.sessionId) ? body.sessionId : null;

  const caller = await authorizeCompanionCaller(request, body);
  if (caller instanceof Response) return caller;
  const { patientId, isPatientDevice } = caller;

  const service = createServiceRoleClient();
  // Consent first: nothing about this message goes to any provider without it.
  if (!(await hasServerConsent(service, patientId, 'ai'))) {
    return Response.json({ error: 'consent_required' }, { status: 403 });
  }

  const respond = async (
    kind: ConverseKind,
    text: string,
    extra: { grounded?: boolean; factIds?: string[]; answerLanguage?: UILanguage; model?: string } = {},
  ) => {
    const answerLanguage = extra.answerLanguage ?? (kind === 'answer' ? language : 'en');
    let audio: { audioBase64: string; audioFormat: string } | undefined;
    if (body.speak === true && kind === 'answer') {
      try {
        const speech = await withTimeout(synthesizeSpeech(text, answerLanguage), SPEECH_TIMEOUT_MS);
        audio = { audioBase64: speech.audioBase64, audioFormat: speech.audioFormat };
      } catch {
        // The phone speaks the reply itself.
      }
    }
    return Response.json({
      kind,
      text,
      grounded: extra.grounded ?? false,
      factIds: extra.factIds ?? [],
      answerLanguage,
      ...(audio ? { audio } : {}),
      ...(isPatientDevice ? {} : { model: extra.model ?? 'none' }),
    });
  };

  const distress = async (model: string) => {
    await logTurn(service, {
      patientId,
      sessionId,
      question: message,
      answer: TELE_MANAS_RESPONSE,
      grounded: false,
      modelUsed: model,
      flagged: true,
    });
    return respond('distress', TELE_MANAS_RESPONSE, { model });
  };

  // Hard keyword net before any model call; the model's own distress flag is a second one.
  const severity = matchSeverity(message);
  if (severity === 'high') return distress('distress-shortcircuit');
  if (severity === 'low') {
    const { data: recent } = await service
      .from('ai_conversation_log')
      .select('question')
      .eq('patient_id', patientId)
      .order('created_at', { ascending: false })
      .limit(DISTRESS_LOOKBACK);
    const earlier = [
      ...(recent ?? []).map((r) => r.question),
      ...history.filter((t) => t.role === 'user').map((t) => t.text),
    ];
    const lowCount = 1 + earlier.filter((q) => typeof q === 'string' && matchSeverity(q) === 'low').length;
    if (lowCount >= DISTRESS_LOW_THRESHOLD) return distress('distress-shortcircuit');
  }

  // The Memory Bank is the only source of personal facts — nothing else is
  // retrieved. Its cloud copy is end-to-end encrypted, so the facts come from
  // the phone's own decrypted copy, sent with this request (lib/ai/request-facts.ts).
  const facts = parseRequestFacts(body.facts).map(memoryEntryToFact);
  const promptFacts = await selectFacts(facts, message, history, language);

  const date = cleanContext(body.clientContext?.date);
  const messages = buildConversationMessages({
    language,
    facts: promptFacts,
    history,
    message,
    today: date ? { date, time: cleanContext(body.clientContext?.time) } : null,
  });

  const { reply, model, reachable } = await getModelReply(messages, promptFacts.length);
  if (!reply) return respond('unavailable', '', { model });
  if (reply.distress) return distress(model);

  const unknown = async () => {
    await logTurn(service, {
      patientId,
      sessionId,
      question: message,
      answer: `[not shown — could not be verified against the Memory Bank] ${reply.reply}`,
      grounded: false,
      modelUsed: model,
      flagged: false,
    });
    return respond('unknown', '', { model });
  };

  if (!reachable || !(await isReplyAllowed(reply, promptFacts, history, message))) return unknown();

  let text = reply.reply;
  let answerLanguage: UILanguage = language;
  if (!isInLanguageScript(text, language)) {
    try {
      text = (await withTimeout(translateText(text, 'en', language), 8_000)).text;
    } catch {
      answerLanguage = 'en';
      if (!isInLanguageScript(text, 'en')) return respond('unavailable', '', { model });
    }
  }

  const factIds = reply.cited.map((i) => promptFacts[i].id);
  const grounded = reply.type === 'memory' && factIds.length > 0;
  await logTurn(service, {
    patientId,
    sessionId,
    question: message,
    answer: text,
    grounded,
    modelUsed: model,
    flagged: false,
  });
  return respond('answer', text, { grounded, factIds, answerLanguage, model });
}
