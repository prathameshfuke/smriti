/**
 * Distress-keyword safety net for the companion. Checked before every LLM
 * call in `POST /api/ai/complete` — never folded into the grounded-QA logic
 * itself, so the two concerns (fact-grounding vs. crisis detection) stay
 * independently readable and testable.
 *
 * Two severity tiers, not one flat list: `want to die` / `hurt myself` are
 * unambiguous on a single utterance, but `scared` / `help me` are common
 * enough in ordinary speech that triggering on a single occurrence would
 * make the companion cry wolf on everyday questions. The caller (the route)
 * is responsible for counting `'low'` occurrences across recent questions
 * and only treating repeated low-severity matches as a signal — this module
 * only classifies a single piece of text.
 */

const HIGH_SEVERITY_PATTERNS: RegExp[] = [
  /want to die/i,
  /kill myself/i,
  /hurt myself/i,
  /end my life/i,
  /suicide/i,
  // Checked on the patient's own words too, not only the English
  // translation: a translation outage must never switch the safety net off.
  /आत्महत्या/u,
  /मरना चाहत[ाी]/u,
  /जीना नहीं चाहत[ाी]/u,
  /खुद को (?:मार|नुकसान)/u,
  /আত্মহত্যা/u,
  /মরতে চাই/u,
  /মৰিব খোজো/u,
  /मर्न चाहन्छु/u,
];

const LOW_SEVERITY_PATTERNS: RegExp[] = [/\bscared\b/i, /help me/i];

export type DistressSeverity = 'high' | 'low';

export function matchSeverity(text: string): DistressSeverity | null {
  if (HIGH_SEVERITY_PATTERNS.some((pattern) => pattern.test(text))) return 'high';
  if (LOW_SEVERITY_PATTERNS.some((pattern) => pattern.test(text))) return 'low';
  return null;
}

export const TELE_MANAS_RESPONSE =
  'It sounds like you might be going through something hard right now. ' +
  'Please call 14416 (Tele-MANAS) to talk with someone, or tell your caregiver.';
