/**
 * Safety net for the weekly caregiver digest. Checked after every LLM call
 * in POST /api/ai/generate-digest — a hard filter, not a prompt instruction
 * trusted on its own, since a small model doesn't reliably keep clinical
 * vocabulary out of a summary it wasn't told to avoid on this particular try.
 */

const FORBIDDEN_WORDS = ['dementia', 'decline', 'cognition', 'condition'];
const FORBIDDEN_PATTERN = new RegExp(`\\b(${FORBIDDEN_WORDS.join('|')})\\b`, 'i');

export function containsForbiddenWord(text: string): boolean {
  return FORBIDDEN_PATTERN.test(text);
}

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

/** True when there's no prior digest, or the last one is 7+ days old. */
export function shouldRegenerateDigest(lastGeneratedAt: string | null): boolean {
  if (!lastGeneratedAt) return true;
  return Date.now() - new Date(lastGeneratedAt).getTime() >= SEVEN_DAYS_MS;
}

export interface FallbackDigestStats {
  gamesPlayed: number;
  avgAccuracyPct: number;
  adherencePct: number;
}

/**
 * Built only from numbers, never free text — the fixed floor when the LLM
 * can't be trusted to stay off clinical vocabulary after one retry. Less
 * warm than a generated summary, but guaranteed clean.
 */
export function buildFallbackDigest(stats: FallbackDigestStats): string {
  return (
    `This week: ${stats.gamesPlayed} game session${stats.gamesPlayed === 1 ? '' : 's'} completed, ` +
    `${stats.avgAccuracyPct}% average accuracy. Reminders were acknowledged ${stats.adherencePct}% of the time. ` +
    `This is not medical advice.`
  );
}
