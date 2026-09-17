import type { MemoryBankCategory } from '@/lib/supabase/types';
import type { CompanionFact } from './companion-retrieval';

/**
 * Turns Memory Bank rows into the facts Ask Smriti answers from — the only
 * source of personal facts it uses (reminders and everything else are
 * deliberately excluded). Takes a neutral shape so the server and the phone
 * build identical facts.
 */

export interface MemoryEntryLike {
  id: string;
  category: MemoryBankCategory | string;
  title: string;
  detail: string;
  relationship: string | null;
}

const KINDS = new Set(['person', 'schedule', 'life_fact', 'medication']);

export function memoryEntryToFact(entry: MemoryEntryLike): CompanionFact {
  return {
    id: `m:${entry.id}`,
    kind: KINDS.has(entry.category) ? (entry.category as CompanionFact['kind']) : 'life_fact',
    title: entry.title,
    detail: entry.detail,
    relationship: entry.relationship,
  };
}
