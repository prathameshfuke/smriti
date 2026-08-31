import Dexie, { type Table } from 'dexie';
import type { AckMethod, GameType, ReminderType } from '@/lib/supabase/types';

/**
 * Offline-first local mirror (IndexedDB via Dexie).
 *
 * Field names are camelCase here while the Supabase types are snake_case:
 * this store is written and read by the client, the other is a wire format.
 * `lib/db/sync.ts` maps between them.
 *
 * Mirrors 03_DATABASE.md section 2.
 */

export const DB_NAME = 'smriti';

export interface LocalPatient {
  id: string;
  caregiverId: string;
  displayName: string;
  ageYears: number;
  gender: 'male' | 'female' | 'other';
  educationYears: number;
  primaryLanguage: string;
  sessionDurationMinutes: number;
  isActive: boolean;
  /** Current difficulty per game type, e.g. `{ object_hunt: 3 }`. */
  currentDifficulty: Record<string, number>;
  updatedAt: string;
  syncedAt: string | null;
}

export interface LocalGameSession {
  id: string;
  patientId: string;
  startedAt: string;
  endedAt: string | null;
  synced: boolean;
}

export interface LocalTelemetryEvent {
  id: string;
  sessionId: string;
  patientId: string;
  gameType: GameType;
  difficultyLevel: number;
  roundNumber: number;
  isCorrect: boolean;
  /** NULL when the round timed out. */
  responseTimeMs: number | null;
  eventTimestamp: string;
  metadata: Record<string, unknown>;
  synced: boolean;
}

export interface LocalDailySummary {
  id: string;
  patientId: string;
  summaryDate: string;
  gameType: string;
  totalRounds: number;
  correctRounds: number;
  avgResponseTimeMs: number;
  maxDifficultyReached: number;
  sessionCount: number;
  eloRating: number;
  synced: boolean;
}

export interface LocalReminderSchedule {
  id: string;
  patientId: string;
  reminderType: ReminderType;
  label: string;
  timeOfDay: string;
  daysOfWeek: number[];
  isActive: boolean;
  updatedAt: string;
}

export interface LocalReminderAck {
  id: string;
  reminderId: string;
  patientId: string;
  scheduledAt: string;
  acknowledgedAt: string | null;
  ackMethod: AckMethod | null;
  synced: boolean;
}

export interface SyncQueueItem {
  id: string;
  tableName: string;
  recordId: string;
  operation: 'insert' | 'update';
  payload: Record<string, unknown>;
  createdAt: string;
  attempts: number;
}

export class SmritiDB extends Dexie {
  patients!: Table<LocalPatient>;
  gameSessions!: Table<LocalGameSession>;
  telemetryEvents!: Table<LocalTelemetryEvent>;
  dailySummaries!: Table<LocalDailySummary>;
  reminderSchedules!: Table<LocalReminderSchedule>;
  reminderAcks!: Table<LocalReminderAck>;
  syncQueue!: Table<SyncQueueItem>;

  constructor() {
    super(DB_NAME);
    this.version(1).stores({
      patients: 'id, caregiverId, isActive',
      gameSessions: 'id, patientId, startedAt, synced',
      telemetryEvents: 'id, sessionId, patientId, gameType, eventTimestamp, synced',
      dailySummaries: 'id, [patientId+summaryDate+gameType], synced',
      reminderSchedules: 'id, patientId, reminderType, isActive',
      reminderAcks: 'id, reminderId, patientId, scheduledAt, synced',
      syncQueue: 'id, tableName, createdAt',
    });
  }

  /** Drops the backing store. Exposed for test isolation. */
  static deleteDatabase(): Promise<void> {
    return Dexie.delete(DB_NAME);
  }
}

/**
 * Constructing a Dexie instance does not touch IndexedDB, so this singleton is
 * safe to evaluate during SSR or prerendering. It only opens on first query,
 * which happens in the browser.
 */
export const db = new SmritiDB();
