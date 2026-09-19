/**
 * Text identity for bundled audio. Kept dependency-free (no catalogs, no
 * Node APIs) because it runs in the browser on every spoken line and in the
 * synthesis script, and both must agree bit for bit.
 */

/** Trim, collapse whitespace, and NFC-normalize so a copy-edit that only
 * changes spacing does not orphan a recorded clip. */
export function normalizePromptText(text: string): string {
  return text.normalize('NFC').replace(/\s+/g, ' ').trim();
}

/** cyrb53: a fast, well-distributed 53-bit hash. Not cryptographic; its job
 * is only to notice that a string changed since its audio was made. */
export function promptHash(text: string): string {
  const s = normalizePromptText(text);
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < s.length; i++) {
    const ch = s.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  const n = 4294967296 * (2097151 & h2) + (h1 >>> 0);
  return n.toString(16).padStart(14, '0');
}
