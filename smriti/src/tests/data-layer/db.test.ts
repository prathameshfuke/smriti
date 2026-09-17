import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { SmritiDB, type LocalPatient, type LocalTelemetryEvent } from '@/lib/db/schema';

/**
 * Each test gets a fresh database. Dexie keeps a connection open per instance,
 * so the previous instance is closed before its backing store is deleted.
 */
let db: SmritiDB;

const patient = (over: Partial<LocalPatient> = {}): LocalPatient => ({
  id: 'p1',
  caregiverId: 'c1',
  displayName: 'Test Patient',
  ageYears: 72,
  gender: 'female',
  educationYears: 4,
  primaryLanguage: 'as',
  sessionDurationMinutes: 15,
  isActive: true,
  currentDifficulty: { object_hunt: 3, word_stream: 2 },
  updatedAt: '2026-08-31T10:00:00.000Z',
  syncedAt: null,
  ...over,
});

const event = (over: Partial<LocalTelemetryEvent> = {}): LocalTelemetryEvent => ({
  id: 'e1',
  sessionId: 's1',
  patientId: 'p1',
  gameType: 'object_hunt',
  difficultyLevel: 3,
  roundNumber: 1,
  isCorrect: true,
  responseTimeMs: 1400,
  eventTimestamp: '2026-08-31T10:01:00.000Z',
  metadata: {},
  synced: false,
  ...over,
});

beforeEach(async () => {
  await SmritiDB.deleteDatabase();
  db = new SmritiDB();
  await db.open();
});

afterEach(() => {
  db.close();
});

describe('SmritiDB', () => {
  it('creates all 16 tables', () => {
    const names = db.tables.map((t) => t.name).sort();
    expect(names).toEqual(
      [
        'aiConversationLog',
        'caregivers',
        'dailySummaries',
        'deviceTrust',
        'familyMessages',
        'gameSessions',
        'keyring',
        'memoryBankEntries',
        'patientPhotos',
        'patients',
        'reminderAcks',
        'reminderSchedules',
        'reminiscenceQuizzes',
        'speechCache',
        'syncQueue',
        'telemetryEvents',
      ].sort(),
    );
  });

  it('inserts and retrieves a LocalPatient by id', async () => {
    await db.patients.add(patient());
    const found = await db.patients.get('p1');
    expect(found?.displayName).toBe('Test Patient');
    expect(found?.primaryLanguage).toBe('as');
  });

  it('round-trips currentDifficulty as a per-game record', async () => {
    await db.patients.add(patient());
    const found = await db.patients.get('p1');
    expect(found?.currentDifficulty).toEqual({ object_hunt: 3, word_stream: 2 });
  });

  it('queries telemetryEvents by patientId', async () => {
    await db.telemetryEvents.bulkAdd([
      event({ id: 'e1', patientId: 'p1' }),
      event({ id: 'e2', patientId: 'p1', roundNumber: 2 }),
      event({ id: 'e3', patientId: 'p2' }),
    ]);
    const forP1 = await db.telemetryEvents.where('patientId').equals('p1').toArray();
    expect(forP1).toHaveLength(2);
    expect(forP1.map((e) => e.id).sort()).toEqual(['e1', 'e2']);
  });

  it('queries telemetryEvents by the synced index for the sync queue', async () => {
    await db.telemetryEvents.bulkAdd([
      event({ id: 'e1', synced: false }),
      event({ id: 'e2', synced: true }),
    ]);
    // Dexie indexes booleans as 0/1, so unsynced rows are filtered in memory.
    const unsynced = await db.telemetryEvents.filter((e) => !e.synced).toArray();
    expect(unsynced.map((e) => e.id)).toEqual(['e1']);
  });

  it('supports the compound index on dailySummaries', async () => {
    await db.dailySummaries.bulkAdd([
      {
        id: 'd1',
        patientId: 'p1',
        summaryDate: '2026-08-31',
        gameType: 'object_hunt',
        totalRounds: 10,
        correctRounds: 8,
        avgResponseTimeMs: 1500,
        maxDifficultyReached: 4,
        sessionCount: 1,
        eloRating: 1200,
        synced: false,
      },
      {
        id: 'd2',
        patientId: 'p1',
        summaryDate: '2026-08-31',
        gameType: 'quick_tap',
        totalRounds: 12,
        correctRounds: 6,
        avgResponseTimeMs: 900,
        maxDifficultyReached: 2,
        sessionCount: 1,
        eloRating: 1180,
        synced: false,
      },
    ]);

    const hit = await db.dailySummaries
      .where('[patientId+summaryDate+gameType]')
      .equals(['p1', '2026-08-31', 'object_hunt'])
      .first();

    expect(hit?.id).toBe('d1');
    expect(hit?.correctRounds).toBe(8);
  });

  it('enqueues sync work', async () => {
    await db.syncQueue.add({
      id: 'q1',
      tableName: 'telemetryEvents',
      recordId: 'e1',
      operation: 'insert',
      payload: { id: 'e1' },
      createdAt: '2026-08-31T10:02:00.000Z',
      attempts: 0,
    });
    expect(await db.syncQueue.count()).toBe(1);
  });
});
