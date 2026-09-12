import { db, type LocalAiConversationLog } from '@/lib/db/schema';

/**
 * Offline "last 5 answered questions" cache for the companion page. A local
 * mirror only — the durable, caregiver-visible log lives server-side in
 * Supabase's `ai_conversation_log`, written by `POST /api/ai/complete`. This
 * table already had exactly the right shape (it was scaffolded ahead of
 * this feature), so it's reused rather than adding a new Dexie table.
 */

const CACHE_LIMIT = 5;

/** Lowercase, strip punctuation, collapse whitespace. Exact match only —
 * not substring/fuzzy — so a cache hit never confidently shows the wrong
 * answer to a superficially similar but different question. */
export function normalizeQuestion(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

async function entriesFor(patientId: string): Promise<LocalAiConversationLog[]> {
  return db.aiConversationLog.where('patientId').equals(patientId).toArray();
}

export async function findCachedAnswer(
  patientId: string,
  question: string,
): Promise<LocalAiConversationLog | null> {
  const target = normalizeQuestion(question);
  try {
    const entries = await entriesFor(patientId);
    return entries.find((e) => normalizeQuestion(e.question) === target) ?? null;
  } catch {
    // A blocked/broken local DB (private browsing, quota, corruption) is a
    // cache miss, not a fatal error — the caller falls through to the
    // network path exactly as if nothing were cached.
    return null;
  }
}

export async function cacheAnswer(entry: LocalAiConversationLog): Promise<void> {
  await db.aiConversationLog.put(entry);

  const entries = await entriesFor(entry.patientId);
  if (entries.length <= CACHE_LIMIT) return;

  const excess = [...entries]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(CACHE_LIMIT);
  await db.aiConversationLog.bulkDelete(excess.map((e) => e.id));
}
