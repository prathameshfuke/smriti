import { db } from '@/lib/db/schema';
import type { ReminderType } from '@/lib/supabase/types';

export interface RoutineRecallItem {
  ackId: string;
  reminderType: ReminderType;
  acknowledgedAt: string;
}

export type RoutineRecallResult =
  | { status: 'ready'; sequence: RoutineRecallItem[] }
  | { status: 'insufficient' };

/** Below this, a sequence would be too short to test recall meaningfully. */
const MIN_ITEMS = 3;
/** Beyond this many days back, a recovered sequence is too stale to call "today's routine". */
const LOOKBACK_DAYS = 7;

/** Per-level sequence length — mirrors the LEVELS-table pattern other games use (see path-match). */
export const ROUTINE_RECALL_LEVELS: Record<number, { sequenceLength: number }> = {
  1: { sequenceLength: 3 },
  2: { sequenceLength: 4 },
  3: { sequenceLength: 5 },
  4: { sequenceLength: 6 },
  5: { sequenceLength: 7 },
};

function dateKey(iso: string): string {
  return iso.slice(0, 10);
}

function daysAgoKey(daysAgo: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString().slice(0, 10);
}

/**
 * Builds today's (or, failing that, the most recent day with enough
 * activity) real routine sequence from the patient's own reminder_acks —
 * never synthetic content. Scans backwards up to a week before giving up,
 * so a single quiet day doesn't strand the game indefinitely.
 */
export async function getRoutineRecallSequence(
  patientId: string,
  sequenceLength: number,
): Promise<RoutineRecallResult> {
  const acks = await db.reminderAcks
    .where('patientId')
    .equals(patientId)
    .filter((a) => a.acknowledgedAt !== null)
    .toArray();

  for (let daysAgo = 0; daysAgo <= LOOKBACK_DAYS; daysAgo += 1) {
    const targetKey = daysAgoKey(daysAgo);
    const dayAcks = acks.filter((a) => dateKey(a.acknowledgedAt as string) === targetKey);
    if (dayAcks.length < MIN_ITEMS) continue;

    dayAcks.sort((a, b) => (a.acknowledgedAt as string).localeCompare(b.acknowledgedAt as string));

    const withType = await Promise.all(
      dayAcks.map(async (a) => {
        const schedule = await db.reminderSchedules.get(a.reminderId);
        if (!schedule) return null;
        return {
          ackId: a.id,
          reminderType: schedule.reminderType,
          acknowledgedAt: a.acknowledgedAt as string,
        } satisfies RoutineRecallItem;
      }),
    );
    const valid = withType.filter((v): v is RoutineRecallItem => v !== null);
    if (valid.length < MIN_ITEMS) continue;

    return { status: 'ready', sequence: valid.slice(-sequenceLength) };
  }

  return { status: 'insufficient' };
}

/** Fisher-Yates — same shuffle shape used by path-match/object-hunt, not a new implementation. */
export function shuffleSequence<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/** True only when the submitted ack-id order exactly matches the real chronological order. */
export function isCorrectOrder(correct: RoutineRecallItem[], submittedAckIds: string[]): boolean {
  if (submittedAckIds.length !== correct.length) return false;
  return correct.every((item, i) => item.ackId === submittedAckIds[i]);
}
