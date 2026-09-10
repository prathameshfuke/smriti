import Dexie, { type Table } from 'dexie';
import type { AckMethod, CaregiverRole, GameType, MemoryBankCategory, ReminderType } from '@/lib/supabase/types';

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

export interface LocalCaregiver {
  id: string;
  authUserId: string;
  displayName: string;
  role: CaregiverRole;
  createdAt: string;
}

export interface LocalMemoryBankEntry {
  id: string;
  patientId: string;
  category: MemoryBankCategory;
  title: string;
  detail: string;
  /** Data-URL string locally — this is what every same-device render (the
   * caregiver form, the kiosk reminiscence quiz) actually reads. `lib/db/sync.ts`
   * uploads it to the `memory-bank-photos` Storage bucket on sync and sends
   * *that* URL to Supabase instead — this local copy is never overwritten. */
  photoUrl: string | null;
  relationship: string | null;
  active: boolean;
  createdBy: string;
  updatedAt: string;
  /** False until `/api/sync` confirms this row reached Supabase — see `lib/db/sync.ts`. */
  synced: boolean;
}

export interface LocalAiConversationLog {
  id: string;
  patientId: string;
  question: string;
  answer: string;
  grounded: boolean;
  modelUsed: string;
  createdAt: string;
}

export interface ReminiscenceQuizQuestion {
  question: string;
  options: string[];
  correctIndex: number;
  /** Verbatim title of the Memory Bank entry this question is about — lets
   * the game look up that entry's photo without round-tripping an id
   * through the LLM. */
  entryTitle: string;
}

export interface LocalReminiscenceQuiz {
  id: string;
  patientId: string;
  questions: ReminiscenceQuizQuestion[];
  generatedAt: string;
}

/**
 * Offline mirror of `family_notes` (docs/03_DATABASE.md MIGRATION 010/011),
 * scoped to the rows the kiosk is allowed to see: approved/surfaced
 * messages for the currently-active patient. Populated by a periodic pull
 * (`lib/family/familyMessagesClient.ts`), never written to directly by
 * patient-side code except the local optimistic `seenAt` stamp on ack —
 * this is a read mirror, not a queue, so there is no `syncQueue` entry for
 * it; the ack write goes straight to the server and only updates this row
 * locally on success (or optimistically, with `ackSynced` tracking whether
 * the server has confirmed it).
 */
export interface LocalFamilyMessage {
  id: string;
  patientId: string;
  text: string;
  senderName: string | null;
  senderRelation: string | null;
  photoUrl: string | null;
  createdAt: string;
  /** Set locally the moment the patient taps "Seen"; may run ahead of `ackSynced`. */
  seenAt: string | null;
  /** Whether the seen-ack above has been confirmed by the server. */
  ackSynced: boolean;
}

/**
 * Local cache of Bhashini TTS output, keyed by exact (language, text) so
 * repeat lines — reminder phrases, repeated companion answers — never
 * re-hit the rate-limited PoC API. Patient-agnostic: the same line in the
 * same language sounds identical regardless of whose device plays it, so
 * unlike `aiConversationLog` there is no `patientId` scoping here.
 */
export interface LocalSpeechCache {
  /** `${language} ${text}` — see `lib/ai/speech-cache.ts`. Using the
   * exact content as the key means `put()` naturally dedupes identical
   * lines instead of needing separate lookup-then-insert logic. */
  id: string;
  text: string;
  language: string;
  audioBase64: string;
  audioFormat: string;
  createdAt: string;
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
  caregivers!: Table<LocalCaregiver>;
  patients!: Table<LocalPatient>;
  gameSessions!: Table<LocalGameSession>;
  telemetryEvents!: Table<LocalTelemetryEvent>;
  dailySummaries!: Table<LocalDailySummary>;
  reminderSchedules!: Table<LocalReminderSchedule>;
  reminderAcks!: Table<LocalReminderAck>;
  memoryBankEntries!: Table<LocalMemoryBankEntry>;
  aiConversationLog!: Table<LocalAiConversationLog>;
  reminiscenceQuizzes!: Table<LocalReminiscenceQuiz>;
  syncQueue!: Table<SyncQueueItem>;
  familyMessages!: Table<LocalFamilyMessage>;
  speechCache!: Table<LocalSpeechCache>;

  constructor() {
    super(DB_NAME);
    this.version(1).stores({
      caregivers: 'id, authUserId',
      patients: 'id, caregiverId, isActive',
      gameSessions: 'id, patientId, startedAt, synced',
      telemetryEvents: 'id, sessionId, patientId, gameType, eventTimestamp, synced',
      dailySummaries: 'id, [patientId+summaryDate+gameType], synced',
      reminderSchedules: 'id, patientId, reminderType, isActive',
      reminderAcks: 'id, reminderId, patientId, scheduledAt, synced',
      memoryBankEntries: 'id, patientId, category, active',
      aiConversationLog: 'id, patientId, createdAt',
      reminiscenceQuizzes: 'id, patientId',
      syncQueue: 'id, tableName, createdAt',
    });
    // New store only — Dexie carries every unlisted table over unchanged
    // from version 1, so existing installs upgrade in place with no data loss.
    this.version(2).stores({
      familyMessages: 'id, patientId, createdAt, seenAt',
    });
    // Adds a `synced` index to memoryBankEntries so it can finally be
    // gathered by lib/db/sync.ts the same way gameSessions/telemetryEvents/
    // reminderAcks already are — this table was never wired into the real
    // sync path (only into the never-drained syncQueue), so nothing added
    // here ever reached Supabase. Existing rows have `synced === undefined`,
    // which the `!r.synced` filter in sync.ts treats as unsynced — they
    // self-heal on the next sync instead of needing a data migration.
    this.version(3).stores({
      memoryBankEntries: 'id, patientId, category, active, synced',
    });
    this.version(4).stores({
      speechCache: 'id, createdAt',
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
