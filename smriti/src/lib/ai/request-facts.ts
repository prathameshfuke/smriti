/**
 * Memory Bank facts sent by the phone with an Ask Smriti request.
 *
 * The cloud copy of the Memory Bank is end-to-end encrypted (see
 * lib/memoryBank/cloudCrypto.ts), so the server can't read it: the phone,
 * which holds the decrypted copy, sends the active entries with each message
 * and the server uses them for that request only, never storing them. A
 * caller can only affect answers for a patient it is already authorized for.
 */
export interface RequestFact {
  id: string;
  title: string;
  detail: string;
  relationship: string | null;
  category: string;
}

const MAX_FACTS = 200;
const MAX_FIELD_CHARS = 2000;

function text(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim().slice(0, MAX_FIELD_CHARS);
  return trimmed.length ? trimmed : null;
}

/** Validates and bounds the `facts` array from a request body. Invalid items are dropped. */
export function parseRequestFacts(raw: unknown): RequestFact[] {
  if (!Array.isArray(raw)) return [];
  const out: RequestFact[] = [];
  for (const [i, item] of raw.slice(0, MAX_FACTS).entries()) {
    if (!item || typeof item !== 'object') continue;
    const f = item as Record<string, unknown>;
    const title = text(f.title);
    const detail = text(f.detail);
    const category = text(f.category);
    if (!title || !detail || !category) continue;
    out.push({ id: text(f.id) ?? `entry-${i}`, title, detail, category, relationship: text(f.relationship) });
  }
  return out;
}

/** The phone-side counterpart: active entries in the shape above. */
export function toRequestFacts(
  entries: Array<{ id: string; title: string; detail: string; relationship: string | null; category: string; active: boolean }>,
): RequestFact[] {
  return entries
    .filter((e) => e.active)
    .slice(0, MAX_FACTS)
    .map(({ id, title, detail, relationship, category }) => ({ id, title, detail, relationship, category }));
}
