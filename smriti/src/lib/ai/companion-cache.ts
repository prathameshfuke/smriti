import { db, type LocalAiConversationLog } from '@/lib/db/schema';

/**
 * Offline "last 5 answered questions" cache for the companion page. A local
 * mirror only — the durable, caregiver-visible log lives server-side in
 * Supabase's `ai_conversation_log`, written by `POST /api/ai/converse`. This
 * table already had exactly the right shape (it was scaffolded ahead of
 * this feature), so it's reused rather than adding a new Dexie table.
 *
 * The same table also holds answers given offline that still need to be
 * uploaded (`pendingSync`); those are never evicted or matched as cache hits
 * until the server has them.
 */

const CACHE_LIMIT = 5;

/** Lowercase, strip punctuation, collapse whitespace. Exact match only —
 * not substring/fuzzy — so a cache hit never confidently shows the wrong
 * answer to a superficially similar but different question.
 *
 * Letters and combining marks of every script are kept: stripping to ASCII
 * turned every Hindi, Assamese or Bengali question into the empty string, so
 * any two of them "matched" and the first cached answer was repeated for
 * every later question in that language. */
export function normalizeQuestion(text: string): string {
  return text
    .normalize('NFC')
    .toLowerCase()
    .replace(/[^\p{L}\p{M}\p{N}\s]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

async function cachedEntriesFor(patientId: string): Promise<LocalAiConversationLog[]> {
  return db.aiConversationLog
    .where('patientId')
    .equals(patientId)
    .filter((e) => !e.pendingSync)
    .toArray();
}

export async function findCachedAnswer(
  patientId: string,
  question: string,
  language?: string,
): Promise<LocalAiConversationLog | null> {
  const target = normalizeQuestion(question);
  if (!target) return null;
  try {
    const entries = await cachedEntriesFor(patientId);
    return (
      entries.find(
        (e) =>
          normalizeQuestion(e.question) === target &&
          // Answers are stored in the language they were given in.
          (!language || !e.language || e.language === language),
      ) ?? null
    );
  } catch {
    // A blocked/broken local DB (private browsing, quota, corruption) is a
    // cache miss, not a fatal error — the caller falls through to the
    // network path exactly as if nothing were cached.
    return null;
  }
}

export async function cacheAnswer(entry: LocalAiConversationLog): Promise<void> {
  await db.aiConversationLog.put(entry);
  if (entry.pendingSync) return;

  const entries = await cachedEntriesFor(entry.patientId);
  if (entries.length <= CACHE_LIMIT) return;

  const excess = [...entries]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(CACHE_LIMIT);
  await db.aiConversationLog.bulkDelete(excess.map((e) => e.id));
}

/**
 * Drops every cached answer for a patient. Called whenever their Memory Bank
 * changes: a cached "Your son Raju visits on Sundays" must not outlive the
 * caregiver correcting it to Saturdays.
 */
export async function clearCachedAnswers(patientId: string): Promise<void> {
  try {
    await db.aiConversationLog
      .where('patientId')
      .equals(patientId)
      .filter((e) => !e.pendingSync)
      .delete();
  } catch {
    // Nothing cached to clear on a broken local DB.
  }
}
