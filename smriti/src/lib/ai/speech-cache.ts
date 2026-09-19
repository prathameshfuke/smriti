import { db, type LocalSpeechCache } from '@/lib/db/schema';
import type { UILanguage } from '@/lib/i18n/languages';

/**
 * Offline cache of Bhashini TTS output. Bhashini's PoC-tier key is
 * rate-limited (per Bhashini's own docs), and reminder phrases in
 * particular repeat every day — this keeps a repeated line from ever
 * re-hitting the API. Sibling to companion-cache.ts, same cap-and-evict
 * shape, no patientId (see LocalSpeechCache).
 */

const CACHE_LIMIT = 200;

/** Keyed hash, never the text: the primary key can't be encrypted (see LocalSpeechCache.id). */
async function cacheKey(language: UILanguage, text: string): Promise<string | null> {
  const hash = await db.keyedHash(`${language}\n${text}`);
  return hash ? `v2:${language}:${hash}` : null;
}

export async function findCachedSpeech(
  language: UILanguage,
  text: string,
): Promise<LocalSpeechCache | null> {
  const id = await cacheKey(language, text);
  if (!id) return null;
  const hit = await db.speechCache.get(id);
  return hit ?? null;
}

export async function cacheSpeech(params: {
  language: UILanguage;
  text: string;
  audioBase64: string;
  audioFormat: string;
}): Promise<void> {
  const id = await cacheKey(params.language, params.text);
  // No key (no WebCrypto): skip caching instead of storing the sentence in the clear.
  if (!id) return;
  await db.speechCache.put({
    id,
    text: params.text,
    language: params.language,
    audioBase64: params.audioBase64,
    audioFormat: params.audioFormat,
    createdAt: new Date().toISOString(),
  });

  const count = await db.speechCache.count();
  if (count <= CACHE_LIMIT) return;

  const excess = await db.speechCache.orderBy('createdAt').limit(count - CACHE_LIMIT).toArray();
  await db.speechCache.bulkDelete(excess.map((e) => e.id));
}
