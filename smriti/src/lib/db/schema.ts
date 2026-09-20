import Dexie, { type Table } from 'dexie';
import { ENCRYPTED_FIELDS } from '@/lib/db/crypto/fields';
import { createEncryptionMiddleware } from '@/lib/db/crypto/middleware';
import { type KeyringEntry, loadOrCreateStorageKey, migrateToEncrypted } from '@/lib/db/crypto/keys';
import type { AckMethod, CaregiverRole, GameType, MemoryBankCategory, ReminderType } from '@/lib/supabase/types';
import type { ConsentRecord } from '@/lib/consent/policy';

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
  /** When the reminder was first set up. Adherence never counts days before
   * it. Absent on rows saved by older builds, which fall back to `updatedAt`. */
  createdAt?: string;
  /*
   * Appointment-only fields (see lib/engine/appointments.ts). For a dated
   * appointment `timeOfDay` is the appointment time and `daysOfWeek` is `[]`.
   * Not indexed, so no Dexie version bump. Absent on every other type.
   */
  /** `YYYY-MM-DD`, the patient's local calendar day. */
  appointmentDate?: string;
  /** Free text: "the CHC", "Dr. Borah". */
  facilityName?: string;
  /** Free text: how to get there. */
  locationNotes?: string;
  /** Free text: documents or items to bring. */
  bringNotes?: string;
  /** `HH:MM` on the day before; absent = no day-before prompt. */
  remindDayBeforeTime?: string;
  /** `HH:MM` on the day, at or before the appointment; absent = no day-of prompt. */
  remindDayOfTime?: string;
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
  /** Language the question was asked in. Cached answers are only reused for
   * the same language — they are stored translated. Absent on older rows. */
  language?: string;
  /** True for an answer produced on the phone (offline, from the local
   * Memory Bank) that the server has not logged yet. `lib/db/sync.ts`
   * uploads these; online answers are logged by `/api/ai/converse` itself. */
  pendingSync?: boolean;
}

/**
 * What the last sync run did, kept across reloads. Before this existed the
 * "last synced" time lived in React state only, so it vanished on every
 * reload, and a failure left no trace at all: the next automatic attempt
 * retried at the same fixed interval with no idea the last five had failed,
 * and the caregiver was never told which records were stuck.
 *
 * One row, addressed by a constant key (out-of-line key, same as
 * `deviceTrust` — see `DeviceTrustToken`'s doc comment). Per-patient pull
 * watermarks are a different thing entirely and live in `SyncCursor` below.
 */
export interface SyncStateRecord {
  /** When the last fully accepted sync finished, by the server's clock. */
  lastSyncedAt: string | null;
  /** Failures in a row since the last success; drives the backoff window. */
  consecutiveFailures: number;
  /** Why the last attempt failed, cleared on success. */
  lastError: string | null;
  /** Which row categories the server rejected last time, for the UI. */
  failedCategories: string[];
  /** When the last attempt ran, successful or not. */
  lastAttemptAt: string | null;
}

/** Per-patient pull cursor for `/api/sync`: the server time of the last
 * successful sync, so each sync only downloads what changed since. Lives in
 * Dexie (not localStorage) so deleting the local database also resets it and
 * the next sign-in pulls everything again. */
export interface SyncCursor {
  patientId: string;
  serverTimestamp: string;
}

/** The caregiver's consent for one patient — see lib/consent/policy.ts. */
export interface LocalConsent extends ConsentRecord {
  /** False until `/api/sync` (or the direct push after the form) confirms the server has it. */
  synced: boolean;
}

export interface ReminiscenceQuizQuestion {
  question: string;
  options: string[];
  correctIndex: number;
  /** Verbatim title of the Memory Bank entry this question is about — lets
   * the game look up that entry's photo without round-tripping an id
   * through the LLM. */
  entryTitle: string;
  /** Whether to show the entry's photo with this question. False when the
   * photo would give the answer away (the question names the relationship
   * or quotes the detail). Absent on older quizzes, which always showed it. */
  showPhoto?: boolean;
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
  /** `v2:${language}:${keyed hash of text}` — see `lib/ai/speech-cache.ts`.
   * A keyed hash (not the text) so the primary key, which can't be
   * encrypted, doesn't hold the spoken sentence; equal lines still map to
   * one row, so `put()` dedupes them. */
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

/**
 * The one signed token a kiosk device holds, proving to the server which
 * single patient it's allowed to act as while offline (see
 * lib/auth/deviceTrust.ts and lib/auth/deviceTrustServer.ts). Keyed by a
 * constant string key (out-of-line key — see the `deviceTrust: ''` schema
 * below), never by `id`, since there is only ever one per device.
 *
 * This used to live in a second, independently-versioned native IndexedDB
 * connection that `lib/auth/deviceTrust.ts` opened by hand against this same
 * `smriti` database name, hardcoded at version 1. Once Dexie (this file) had
 * opened the real database at a higher version — which every onboarding run
 * guarantees, since it writes the caregiver/patient via Dexie before device
 * trust is ever touched — that second connection's version-1 request became
 * a permanent `VersionError` for the rest of the app's life: device trust
 * could never actually be stored or read again. One physical IndexedDB
 * database must have exactly one version authority, so it is a table here
 * like everything else this app persists locally.
 */
export interface DeviceTrustToken {
  patientId: string;
  issuedAt: number;
  issuedBy: string;
  signature: string;
}

/**
 * A patient's photo, kept on this device only. It exists so a shared phone's
 * "Who is playing?" screen can show faces; it is never synced, since the
 * server `patients` table has no photo column and a face is more personal
 * than anything else the app stores.
 */
export interface LocalPatientPhoto {
  patientId: string;
  dataUrl: string;
  updatedAt: string;
}

/**
 * The last successful response of a caregiver GET request, so dashboard
 * screens can show last-synced data instead of an error while offline.
 * `body` holds patient details and is encrypted at rest.
 */
export interface LocalApiCacheEntry {
  body: unknown;
  cachedAt: string;
}

/** The Memory Bank cloud key once unlocked on this phone (base64). */
export interface LocalCloudKey {
  key: string;
  savedAt: string;
}

export class SmritiDB extends Dexie {
  patientPhotos!: Table<LocalPatientPhoto, string>;
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
  /** Out-of-line keys (see `DeviceTrustToken`'s own doc comment) — always
   * read/written via an explicit key, never `db.deviceTrust.add()`. */
  deviceTrust!: Table<DeviceTrustToken, string>;
  /** Out-of-line keys. Holds the sealed storage key — see lib/db/crypto/keys.ts. */
  keyring!: Table<KeyringEntry, string>;
  consents!: Table<LocalConsent, string>;
  syncCursors!: Table<SyncCursor, string>;
  /** Out-of-line keys. One row, see `SyncStateRecord`. */
  syncState!: Table<SyncStateRecord, string>;
  /** Out-of-line keys (request path). Last good caregiver API responses,
   * shown when offline — see lib/api/client.ts. */
  apiCache!: Table<LocalApiCacheEntry, string>;
  /** Out-of-line keys (caregiver id). The unwrapped Memory Bank cloud key,
   * encrypted at rest by the device key — see lib/memoryBank/cloudKey.ts. */
  cloudKeys!: Table<LocalCloudKey, string>;

  /** The unsealed field-encryption key. Memory only, loaded on every open. */
  private storageKey: Uint8Array | null = null;

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
    // New store only, same as versions 2-4 above — existing installs
    // upgrade in place with no data loss. Out-of-line primary key (`''`):
    // there's exactly one row, addressed by a constant key, not an `id`
    // field on the value itself (see DeviceTrustToken's doc comment for why
    // this now lives here instead of a second, separately-versioned native
    // IndexedDB connection to this same database name).
    this.version(5).stores({
      deviceTrust: '',
    });
    // New store only. Local-only patient photos for the shared-phone picker.
    this.version(6).stores({
      patientPhotos: 'patientId',
    });
    // New store only. The sealed key for field-level encryption at rest.
    this.version(7).stores({
      keyring: '',
    });
    // New stores only. One consent record and one sync cursor per patient.
    this.version(8).stores({
      consents: 'patientId',
      syncCursors: 'patientId',
    });
    // New stores only. Last-known caregiver dashboard data for offline use,
    // and the unlocked Memory Bank cloud key.
    this.version(9).stores({
      apiCache: '',
      cloudKeys: '',
    });
    // New store only. Survives reloads so the last sync outcome — when it
    // last worked, and why it last failed — is not lost with React state.
    this.version(10).stores({
      syncState: '',
    });

    // Personal and health fields are encrypted before they reach IndexedDB
    // (see lib/db/crypto/). The key is loaded in `ready`, which Dexie awaits
    // before running any queued query, so nothing reads or writes early.
    // Sticky, so it runs again whenever the database reopens — including
    // after deleteDatabase(), which starts over with a fresh key.
    this.use(createEncryptionMiddleware(ENCRYPTED_FIELDS, () => this.storageKey));
    this.on(
      'ready',
      async (vipDb) => {
        this.storageKey = null;
        const keyring = vipDb.table<KeyringEntry, string>('keyring');
        const { key } = await loadOrCreateStorageKey(vipDb, keyring);
        this.storageKey = key;
        await migrateToEncrypted(vipDb, keyring, ENCRYPTED_FIELDS, key);
      },
      true,
    );
  }

  /**
   * HMAC-SHA256 of `value` under the storage key, hex. A stable, unguessable
   * id for content that must be findable by value but must not be readable
   * from the key column. Null when WebCrypto or the key isn't available, in
   * which case callers should skip the cache rather than store plain text.
   */
  async keyedHash(value: string): Promise<string | null> {
    await this.open();
    const subtle = globalThis.crypto?.subtle;
    const raw = this.storageKey;
    if (!subtle || !raw) return null;
    const key = await subtle.importKey('raw', raw as BufferSource, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    const mac = new Uint8Array(await subtle.sign('HMAC', key, new TextEncoder().encode(value)));
    return Array.from(mac, (b) => b.toString(16).padStart(2, '0')).join('');
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
