import { describe, it, expect, vi, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import { db } from '@/lib/db/schema';
import { findCachedAnswer, cacheAnswer, normalizeQuestion } from '@/lib/ai/companion-cache';

beforeEach(async () => {
  await db.aiConversationLog.clear();
  vi.restoreAllMocks();
});

describe('normalizeQuestion', () => {
  it('lowercases, strips punctuation, and collapses whitespace', () => {
    expect(normalizeQuestion("What's  my medication?")).toBe('whats my medication');
  });
});

describe('findCachedAnswer', () => {
  it('returns the matching entry for a normalized-equal question', async () => {
    await cacheAnswer({
      id: 'e1',
      patientId: 'p1',
      question: "What's my medication?",
      answer: 'One red pill after breakfast.',
      grounded: true,
      modelUsed: 'groq',
      createdAt: new Date().toISOString(),
    });

    const hit = await findCachedAnswer('p1', 'whats my medication');
    expect(hit?.answer).toBe('One red pill after breakfast.');
  });

  it('returns null, not a rejected promise, when the local DB read throws (blocked/broken IndexedDB)', async () => {
    // Private-browsing IndexedDB blocks, quota errors, or a corrupted local
    // DB are real failure modes here. Before the fix, this call was
    // unguarded in the companion page (handleTranscript awaited it directly
    // with no try/catch), so a throw here left the UI stuck in "thinking"
    // forever with no code path back out. The fix treats it as a cache miss.
    const whereSpy = vi.spyOn(db.aiConversationLog, 'where').mockImplementation(() => {
      throw new Error('IndexedDB unavailable (private browsing)');
    });

    await expect(findCachedAnswer('p1', 'what day is it')).resolves.toBeNull();
    expect(whereSpy).toHaveBeenCalled();
  });
});
