import type { ReminiscenceQuizQuestion } from '@/lib/db/schema';

/** Below this many person/life_fact entries there isn't enough material for
 * a fair 5-question quiz, so generation is refused rather than attempted. */
export const MIN_ENTRIES = 3;

const QUESTION_COUNT = 5;
const OPTION_COUNT = 3;

function normalize(s: string): string {
  return s.trim().toLowerCase();
}

/** Small models sometimes wrap JSON in a code fence despite being told not
 * to — stripped defensively before parsing, not treated as a validation
 * failure on its own. */
function stripCodeFence(text: string): string {
  return text
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/```\s*$/, '');
}

/**
 * Validates an LLM's raw text response against the quiz shape: exactly 5
 * questions, each with a non-empty prompt, exactly 3 non-empty options, an
 * in-range `correctIndex`, and an `entryTitle` matching one of the facts
 * that were actually fed to the model. Any single failure invalidates the
 * whole batch — there is no such thing as a partially-valid quiz — so the
 * caller can safely treat `null` as "keep whatever was cached before."
 */
export function validateQuizQuestions(raw: string, validTitles: string[]): ReminiscenceQuizQuestion[] | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(stripCodeFence(raw));
  } catch {
    return null;
  }
  if (!Array.isArray(parsed) || parsed.length !== QUESTION_COUNT) return null;

  const normalizedTitles = new Set(validTitles.map(normalize));
  const questions: ReminiscenceQuizQuestion[] = [];

  for (const item of parsed) {
    if (typeof item !== 'object' || item === null) return null;
    const q = item as Record<string, unknown>;

    if (typeof q.question !== 'string' || q.question.trim().length === 0) return null;
    if (!Array.isArray(q.options) || q.options.length !== OPTION_COUNT) return null;
    if (!q.options.every((o) => typeof o === 'string' && o.trim().length > 0)) return null;
    if (
      typeof q.correctIndex !== 'number' ||
      !Number.isInteger(q.correctIndex) ||
      q.correctIndex < 0 ||
      q.correctIndex >= OPTION_COUNT
    ) {
      return null;
    }
    if (typeof q.entryTitle !== 'string' || !normalizedTitles.has(normalize(q.entryTitle))) return null;

    questions.push({
      question: q.question,
      options: q.options as string[],
      correctIndex: q.correctIndex,
      entryTitle: q.entryTitle,
    });
  }

  return questions;
}
