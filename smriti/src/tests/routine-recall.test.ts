import { describe, it, expect, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import { v4 as uuid } from 'uuid';
import { db } from '@/lib/db/schema';
import {
  getRoutineRecallSequence,
  isCorrectOrder,
  ROUTINE_RECALL_LEVELS,
} from '@/lib/games/routine-recall';
import { adjustDifficulty, MAX_LEVEL, type DifficultyState } from '@/lib/engine/difficulty';

const PATIENT_ID = 'patient-1';

async function seedReminder(reminderType: 'medication' | 'hydration' | 'activity' | 'appointment') {
  const id = uuid();
  await db.reminderSchedules.put({
    id,
    patientId: PATIENT_ID,
    reminderType,
    label: reminderType,
    timeOfDay: '08:00',
    daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
    isActive: true,
    updatedAt: new Date().toISOString(),
  });
  return id;
}

async function seedAck(reminderId: string, acknowledgedAt: string) {
  await db.reminderAcks.put({
    id: uuid(),
    reminderId,
    patientId: PATIENT_ID,
    scheduledAt: acknowledgedAt,
    acknowledgedAt,
    ackMethod: 'touch',
    synced: false,
  });
}

function todayAt(hour: number, minute = 0): string {
  const d = new Date();
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
}

beforeEach(async () => {
  await db.reminderSchedules.clear();
  await db.reminderAcks.clear();
});

describe('getRoutineRecallSequence', () => {
  it('refuses to generate with fewer than 3 acknowledged reminders today', async () => {
    const med = await seedReminder('medication');
    const hyd = await seedReminder('hydration');
    await seedAck(med, todayAt(8));
    await seedAck(hyd, todayAt(10));

    const result = await getRoutineRecallSequence(PATIENT_ID, 3);
    expect(result.status).toBe('insufficient');
  });

  it('returns the real chronological ack order, not a synthetic one', async () => {
    const med = await seedReminder('medication');
    const hyd = await seedReminder('hydration');
    const act = await seedReminder('activity');

    // Seeded out of order on purpose — the function must sort by actual time.
    await seedAck(act, todayAt(14));
    await seedAck(med, todayAt(8));
    await seedAck(hyd, todayAt(11));

    const result = await getRoutineRecallSequence(PATIENT_ID, 3);
    expect(result.status).toBe('ready');
    if (result.status !== 'ready') return;

    expect(result.sequence.map((s) => s.reminderType)).toEqual([
      'medication',
      'hydration',
      'activity',
    ]);
  });

  it('caps the sequence at the requested length, keeping the most recent items', async () => {
    const med = await seedReminder('medication');
    for (let h = 6; h < 20; h += 2) {
      await seedAck(med, todayAt(h));
    }

    const result = await getRoutineRecallSequence(PATIENT_ID, 3);
    expect(result.status).toBe('ready');
    if (result.status !== 'ready') return;
    expect(result.sequence).toHaveLength(3);
    // Kept the last 3 chronologically, in order.
    const times = result.sequence.map((s) => s.acknowledgedAt);
    expect(times).toEqual([...times].sort());
  });
});

describe('isCorrectOrder', () => {
  it('matches only the exact real sequence', () => {
    const seq = [
      { ackId: 'a', reminderType: 'medication' as const, acknowledgedAt: '' },
      { ackId: 'b', reminderType: 'hydration' as const, acknowledgedAt: '' },
    ];
    expect(isCorrectOrder(seq, ['a', 'b'])).toBe(true);
    expect(isCorrectOrder(seq, ['b', 'a'])).toBe(false);
    expect(isCorrectOrder(seq, ['a'])).toBe(false);
  });
});

describe('routine_recall difficulty wiring', () => {
  it('uses the same adjustDifficulty() function and config shape as other games', () => {
    const state: DifficultyState = { currentLevel: 1, consecutiveHighScores: 0, consecutiveLowScores: 0 };
    let s = adjustDifficulty(state, 'routine_recall', 90);
    s = adjustDifficulty(s, 'routine_recall', 90);
    s = adjustDifficulty(s, 'routine_recall', 90);
    expect(s.currentLevel).toBe(2);
    expect(s.currentLevel).toBeLessThanOrEqual(MAX_LEVEL.routine_recall);
  });

  it('maps every level 1..MAX_LEVEL to a defined sequence length', () => {
    for (let level = 1; level <= MAX_LEVEL.routine_recall; level += 1) {
      expect(ROUTINE_RECALL_LEVELS[level]).toBeDefined();
      expect(ROUTINE_RECALL_LEVELS[level].sequenceLength).toBeGreaterThanOrEqual(3);
    }
  });
});
