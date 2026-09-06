export interface ParsedMemoryBankEntry {
  category: 'person' | 'life_fact' | 'schedule';
  title: string;
  detail: string;
  relationship: string | null;
}

const ALLOWED_CATEGORIES = new Set(['person', 'life_fact', 'schedule']);

function stripCodeFence(text: string): string {
  return text
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/```\s*$/, '');
}

/**
 * Validates the LLM's free-text-extraction output. Deliberately excludes
 * `medication` even though it's a real Memory Bank category — a medication
 * fact pulled from a caregiver's free-text description is exactly the kind
 * of detail worth typing carefully, not extracting.
 */
export function validateParsedEntries(raw: string): ParsedMemoryBankEntry[] | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(stripCodeFence(raw));
  } catch {
    return null;
  }
  if (!Array.isArray(parsed)) return null;

  const entries: ParsedMemoryBankEntry[] = [];
  for (const item of parsed) {
    if (typeof item !== 'object' || item === null) return null;
    const e = item as Record<string, unknown>;

    if (typeof e.category !== 'string' || !ALLOWED_CATEGORIES.has(e.category)) return null;
    if (typeof e.title !== 'string' || e.title.trim().length === 0) return null;
    if (typeof e.detail !== 'string' || e.detail.trim().length === 0) return null;
    if (e.relationship !== null && e.relationship !== undefined && typeof e.relationship !== 'string') return null;

    entries.push({
      category: e.category as ParsedMemoryBankEntry['category'],
      title: e.title,
      detail: e.detail,
      relationship: (e.relationship as string | null | undefined) ?? null,
    });
  }

  return entries;
}
