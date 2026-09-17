import { v4 as uuid } from 'uuid';
import { authenticateRequest } from '@/lib/supabase/server-auth';
import { createServiceRoleClient } from '@/lib/supabase/client';
import { verifyDeviceTrust } from '@/lib/auth/deviceTrustServer';
import { callLLM } from '@/lib/ai/llm-client';
import { matchSeverity, TELE_MANAS_RESPONSE } from '@/lib/ai/distress-keywords';
import { translateText } from '@/lib/ai/bhashini-nmt-client';
import { memoryEntryToFact, reminderToFact } from '@/lib/ai/companion-facts';
import { describeFact, selectFactsForPrompt, significantWords, type CompanionFact } from '@/lib/ai/companion-retrieval';
import { hasServerConsent } from '@/lib/consent/consentServer';
import { parseCitedAnswer, type CompanionAnswerKind } from '@/lib/ai/companion-answer';
import { isUILanguage, languageName, type UILanguage } from '@/lib/i18n/languages';
import type { ReminderType } from '@/lib/supabase/types';

interface CompleteRequestBody {
  question: string;
  /** The patient's language. The question arrives in it and the answer is returned in it. Default `en`. */
  language?: string;
  /** The phone's local date and time in words ("Thursday, 17 September 2026", "10:32"), so
   * "what day is it" is answered for the patient's own day, not the server's. */
  clientContext?: { date?: string; time?: string };
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

const MAX_QUESTION_LENGTH = 500;
const MAX_CONTEXT_LENGTH = 60;

const NOT_FOUND_PATTERNS = [
  /i don'?t know/i,
  /not (?:something )?i (?:can|could) find/i,
  /no (?:information|record)/i,
];

/** Exact phrase the system prompt hard-instructs the model to say verbatim
 * when a question can't be answered from the facts — also returned directly
 * on the zero-active-facts short-circuit below, so both paths produce the
 * identical, testable string. */
const EXACT_FALLBACK_TEXT = "I'm not sure about that. You could ask your caregiver.";

/** How many of the patient's most recent logged questions to look back
 * through when counting repeated low-severity distress phrases. */
const DISTRESS_LOOKBACK = 5;
/** Repeated low-severity matches (current question + lookback) at or above
 * this count short-circuit the same as a single high-severity phrase. */
const DISTRESS_LOW_THRESHOLD = 2;

function admitsNotKnowing(text: string): boolean {
  if (text.includes(EXACT_FALLBACK_TEXT)) return true;
  return NOT_FOUND_PATTERNS.some((pattern) => pattern.test(text));
}

/**
 * A model given real facts can still fabricate an answer to a question those
 * facts don't cover. Citations are the primary check; for a model that
 * didn't cite, this looks for actual word overlap between the answer and at
 * least one fact, as a cheap proxy for "derived from a provided fact".
 */
function overlapsAnyFact(answerText: string, facts: CompanionFact[]): boolean {
  const answerWords = new Set(significantWords(answerText));
  if (answerWords.size === 0) return false;
  return facts.some((fact) =>
    significantWords([fact.title, fact.relationship ?? '', fact.detail].join(' ')).some((w) => answerWords.has(w)),
  );
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
  const { error } = await service.from('ai_conversation_log').insert({
    id: uuid(),
    patient_id: params.patientId,
    question: params.question,
    answer: params.answer,
    grounded: params.grounded,
    flagged_for_followup: params.flaggedForFollowup,
    model_used: params.modelUsed,
  });
  // The patient still gets their answer; the missing audit row is reported.
  if (error) console.error('SMRITI: failed to log companion exchange', error.message);
}

/** Both forms, when they differ, so a caregiver reading the log sees the patient's words and a translation. */
function withEnglish(original: string, english: string | null): string {
  return english && english !== original ? `${original}\n[English: ${english}]` : original;
}

/** A "what day is it" answer cites no fact; it counts only if it repeats the day it was given. */
function answersFromToday(answer: string, date: string | null): boolean {
  const weekday = date?.split(/[,\s]/)[0];
  return !!weekday && weekday.length > 2 && answer.toLowerCase().includes(weekday.toLowerCase());
}

function cleanContext(value: unknown): string | null {
  return typeof value === 'string' && value.trim() && value.length <= MAX_CONTEXT_LENGTH ? value.trim() : null;
}

async function translateOrNull(text: string, source: UILanguage, target: UILanguage): Promise<string | null> {
  if (source === target) return text;
  try {
    return (await translateText(text, source, target)).text;
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  let body: CompleteRequestBody;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'invalid_json' }, { status: 400 });
  }
  const question = typeof body?.question === 'string' ? body.question.trim() : '';
  if (!question) return Response.json({ error: 'missing_question' }, { status: 400 });
  if (question.length > MAX_QUESTION_LENGTH) return Response.json({ error: 'question_too_long' }, { status: 400 });
  const language: UILanguage = isUILanguage(body.language) ? body.language : 'en';

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

  // Consent is checked before the question goes anywhere — including to
  // Bhashini for translation. After that, everything independent runs at once.
  if (!(await hasServerConsent(service, pid, 'ai'))) {
    return Response.json({ error: 'consent_required' }, { status: 403 });
  }
  const [questionEn, factsResult, remindersResult] = await Promise.all([
    translateOrNull(question, language, 'en'),
    service
      .from('memory_bank_entries')
      .select('id, title, detail, relationship, category')
      .eq('patient_id', pid)
      .eq('active', true),
    service.from('reminder_schedules').select('*').eq('patient_id', pid).eq('is_active', true),
  ]);
  const respond = (text: string, grounded: boolean, model: string, kind: CompanionAnswerKind, answerLanguage: UILanguage) =>
    Response.json(
      isPatientDevice
        ? { text, grounded, kind, answerLanguage }
        : { text, grounded, kind, answerLanguage, model },
    );

  // Distress check runs before any LLM call, ever — this is a hard
  // short-circuit, not a prompt instruction the model could ignore. It reads
  // the patient's own words and the English translation, so a translation
  // outage never disables it.
  const forms = questionEn && questionEn !== question ? [question, questionEn] : [question];
  const severity = forms.map(matchSeverity).includes('high')
    ? 'high'
    : forms.map(matchSeverity).includes('low')
      ? 'low'
      : null;
  const logQuestion = withEnglish(question, questionEn);

  const distress = async () => {
    await logExchange(service, {
      patientId: pid,
      question: logQuestion,
      answer: TELE_MANAS_RESPONSE,
      grounded: false,
      modelUsed: 'distress-shortcircuit',
      flaggedForFollowup: true,
    });
    return respond(TELE_MANAS_RESPONSE, false, 'distress-shortcircuit', 'distress', 'en');
  };

  if (severity === 'high') return distress();
  if (severity === 'low') {
    const { data: recent } = await service
      .from('ai_conversation_log')
      .select('question')
      .eq('patient_id', pid)
      .order('created_at', { ascending: false })
      .limit(DISTRESS_LOOKBACK);
    const lowMatches =
      1 + (recent ?? []).filter((r) => typeof r.question === 'string' && matchSeverity(r.question) === 'low').length;
    if (lowMatches >= DISTRESS_LOW_THRESHOLD) return distress();
  }

  const facts: CompanionFact[] = [
    ...(factsResult.data ?? []).map((row, i) =>
      memoryEntryToFact({ ...row, id: typeof row.id === 'string' ? row.id : `entry-${i}` }),
    ),
    ...(remindersResult.data ?? [])
      .filter((row) => typeof row.label === 'string' && typeof row.time_of_day === 'string')
      .map((row) =>
        reminderToFact({
          id: row.id,
          reminderType: row.reminder_type as ReminderType,
          label: row.label,
          timeOfDay: row.time_of_day,
          daysOfWeek: row.days_of_week ?? [],
          appointmentDate: row.appointment_date,
          facilityName: row.facility_name,
          locationNotes: row.location_notes,
          bringNotes: row.bring_notes,
        }),
      ),
  ];

  const unknown = async (model: string) => {
    await logExchange(service, {
      patientId: pid,
      question: logQuestion,
      answer: EXACT_FALLBACK_TEXT,
      grounded: false,
      modelUsed: model,
      flaggedForFollowup: false,
    });
    return respond(EXACT_FALLBACK_TEXT, false, model, 'unknown', 'en');
  };

  // No facts at all means nothing can ground an answer — skip the LLM
  // entirely rather than trust a small, fast model to always obey the
  // "say exactly" instruction below.
  if (facts.length === 0) return unknown('none');

  const promptFacts = selectFactsForPrompt(forms, facts);
  const factLines = promptFacts.map((fact, i) => `F${i + 1}. ${describeFact(fact)}`).join('\n');
  const date = cleanContext(body.clientContext?.date);
  const time = cleanContext(body.clientContext?.time);
  const today = date ? `\n\nToday is ${date}${time ? `, and the time is ${time}` : ''}.` : '';

  const systemPrompt =
    'You are a gentle memory companion for a person with memory changes. Answer ONLY using the numbered facts ' +
    'below (and today’s date, if given). The facts were written by their caregiver and may be in an Indian ' +
    `language. If the question cannot be answered from these facts, say exactly: ${EXACT_FALLBACK_TEXT} ` +
    'Never guess, never use outside knowledge, never give medical advice beyond what a fact says. Answer in ' +
    'English, in at most 3 short, warm, simple sentences, speaking to the person as "you". ' +
    'After the answer, on its own last line, write FACTS: followed by the numbers of the facts you used ' +
    `(for example "FACTS: F2"), or "FACTS: none".${today}\n\nFacts:\n${factLines}`;

  const userPrompt = questionEn ?? `(asked in ${languageName(language)}) ${question}`;
  const result = await callLLM({ systemPrompt, userPrompt });
  if (!result.grounded) {
    // Both providers are down: the phone shows "can't check right now".
    return respond(result.text, false, result.model, 'unavailable', 'en');
  }

  const { answer: answerEn, cited } = parseCitedAnswer(result.text, promptFacts);
  const grounded =
    answerEn.length > 0 &&
    !admitsNotKnowing(answerEn) &&
    (cited === null
      ? overlapsAnyFact(answerEn, promptFacts)
      : cited.length > 0 || answersFromToday(answerEn, date));
  // Facts existed, but the answer neither admitted "I don't know" nor
  // actually drew on any of them — treat it as fabricated and swap in the
  // same safe fallback used for the zero-facts case.
  if (!grounded) return unknown(result.model);

  const translated = await translateOrNull(answerEn, 'en', language);
  const answerLanguage: UILanguage = translated ? language : 'en';
  const answerText = translated ?? answerEn;

  await logExchange(service, {
    patientId: pid,
    question: logQuestion,
    answer: withEnglish(answerText, answerLanguage === 'en' ? null : answerEn),
    grounded: true,
    modelUsed: result.model,
    flaggedForFollowup: false,
  });

  return respond(answerText, true, result.model, 'answer', answerLanguage);
}
