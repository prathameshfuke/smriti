import type { CompanionFact } from './companion-retrieval';

/**
 * What the answer is, so the phone can show and speak its own reviewed
 * translation for the fixed replies instead of a machine translation:
 * `answer` is a real grounded answer in `text`; `unknown` means the saved
 * facts don't cover the question; `distress` is the Tele-MANAS helpline
 * reply; `unavailable` means no AI provider could be reached right now.
 */
export type CompanionAnswerKind = 'answer' | 'unknown' | 'distress' | 'unavailable';

/**
 * The model is asked to end with a `FACTS:` line naming the fact numbers it
 * used. Returns the answer without that line and the cited facts that exist.
 * A model that ignores the format yields no citations, and the caller falls
 * back to checking word overlap instead.
 */
export function parseCitedAnswer(raw: string, facts: CompanionFact[]): { answer: string; cited: CompanionFact[] | null } {
  const match = raw.match(/\n?\s*FACTS?\s*:\s*([^\n]*)\s*$/i);
  if (!match) return { answer: raw.replace(/^\s*ANSWER\s*:\s*/i, '').trim(), cited: null };
  const answer = raw
    .slice(0, match.index)
    .replace(/^\s*ANSWER\s*:\s*/i, '')
    .trim();
  const numbers = [...match[1].matchAll(/F?\s*(\d+)/gi)].map((m) => Number(m[1]));
  const cited = [...new Set(numbers)].filter((n) => n >= 1 && n <= facts.length).map((n) => facts[n - 1]);
  return { answer, cited };
}
