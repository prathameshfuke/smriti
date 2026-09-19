import 'fake-indexeddb/auto';
import Dexie from 'dexie';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DB_NAME, SmritiDB } from '@/lib/db/schema';
import { ENCRYPTED_FIELDS } from '@/lib/db/crypto/fields';
import { cacheSpeech, findCachedSpeech } from '@/lib/ai/speech-cache';

/**
 * ITEM 4: what IndexedDB ACTUALLY holds. Every table gets a row whose every
 * string carries a marker, then the raw stores are read with a plain Dexie
 * instance (no encryption middleware). Any field still containing its marker
 * is plaintext on disk.
 */

const M = (t: string, f: string) => `MARK|${t}|${f}`;
const IDS = new Set(['id', 'patientId', 'caregiverId', 'sessionId', 'reminderId', 'authUserId', 'createdBy', 'consentedBy', 'issuedBy']);

let db: SmritiDB;
beforeEach(() => { db = new SmritiDB(); });
afterEach(async () => { db.close(); await SmritiDB.deleteDatabase(); });

const stamp = '2026-09-16T10:00:00.000Z';

/** One realistic row per table; each free-text/personal string is marked. */
function rows(): Record<string, Record<string, unknown>> {
  const m = (t: string, f: string) => M(t, f);
  return {
    caregivers: { id: 'cg1', authUserId: 'au1', displayName: m('caregivers', 'displayName'), role: 'primary', createdAt: stamp },
    patients: { id: 'p1', caregiverId: 'cg1', displayName: m('patients', 'displayName'), ageYears: 72, gender: 'female', educationYears: 4, primaryLanguage: 'as', sessionDurationMinutes: 15, isActive: true, currentDifficulty: { object_hunt: 3 }, updatedAt: stamp, syncedAt: null },
    patientPhotos: { patientId: 'p1', dataUrl: m('patientPhotos', 'dataUrl'), updatedAt: stamp },
    gameSessions: { id: 's1', patientId: 'p1', startedAt: stamp, endedAt: null, synced: false },
    telemetryEvents: { id: 'e1', sessionId: 's1', patientId: 'p1', gameType: 'object_hunt', difficultyLevel: 2, roundNumber: 1, isCorrect: false, responseTimeMs: 1400, eventTimestamp: stamp, metadata: { answer: m('telemetryEvents', 'metadata') }, synced: false },
    dailySummaries: { id: 'd1', patientId: 'p1', summaryDate: '2026-09-16', gameType: 'object_hunt', totalRounds: 10, correctRounds: 3, avgResponseTimeMs: 1500, maxDifficultyReached: 2, sessionCount: 1, eloRating: 0, synced: false },
    reminderSchedules: { id: 'r1', patientId: 'p1', reminderType: 'medication', label: m('reminderSchedules', 'label'), timeOfDay: '08:00', daysOfWeek: [1, 2], isActive: true, updatedAt: stamp, facilityName: m('reminderSchedules', 'facilityName'), locationNotes: m('reminderSchedules', 'locationNotes'), bringNotes: m('reminderSchedules', 'bringNotes') },
    reminderAcks: { id: 'a1', reminderId: 'r1', patientId: 'p1', scheduledAt: stamp, acknowledgedAt: stamp, ackMethod: 'tap', synced: false },
    memoryBankEntries: { id: 'm1', patientId: 'p1', category: 'person', title: m('memoryBankEntries', 'title'), detail: m('memoryBankEntries', 'detail'), photoUrl: m('memoryBankEntries', 'photoUrl'), relationship: m('memoryBankEntries', 'relationship'), active: true, createdBy: 'cg1', updatedAt: stamp, synced: false },
    aiConversationLog: { id: 'l1', patientId: 'p1', question: m('aiConversationLog', 'question'), answer: m('aiConversationLog', 'answer'), grounded: true, modelUsed: 'x', createdAt: stamp, language: 'en' },
    reminiscenceQuizzes: { id: 'q1', patientId: 'p1', questions: [{ question: m('reminiscenceQuizzes', 'questions'), options: ['a'], correctIndex: 0, entryTitle: m('reminiscenceQuizzes', 'entryTitle') }], generatedAt: stamp },
    syncQueue: { id: 'sq1', tableName: 'patients', recordId: 'p1', operation: 'update', payload: { displayName: m('syncQueue', 'payload') }, createdAt: stamp, attempts: 0 },
    familyMessages: { id: 'f1', patientId: 'p1', text: m('familyMessages', 'text'), senderName: m('familyMessages', 'senderName'), senderRelation: m('familyMessages', 'senderRelation'), photoUrl: m('familyMessages', 'photoUrl'), createdAt: stamp, seenAt: null, ackSynced: false },
    consents: { patientId: 'p1', version: 1, careProfile: true, guardianAttested: true, aiCompanion: true, voiceProcessing: false, consentedBy: 'cg1', consentedAt: stamp, updatedAt: stamp, synced: false },
    syncCursors: { patientId: 'p1', serverTimestamp: stamp },
  };
}

async function rawDump(): Promise<Record<string, Record<string, unknown>[]>> {
  const raw = new Dexie(DB_NAME);
  await raw.open();
  try {
    const out: Record<string, Record<string, unknown>[]> = {};
    for (const t of raw.tables) out[t.name] = (await t.toArray()) as Record<string, unknown>[];
    return out;
  } finally { raw.close(); }
}

async function seed() {
  const r = rows();
  for (const [table, row] of Object.entries(r)) {
    if (table === 'deviceTrust') continue;
    await db.table(table).put(row);
  }
  await db.deviceTrust.put({ patientId: 'p1', issuedAt: 1, issuedBy: 'cg1', signature: M('deviceTrust', 'signature') }, 'p1');
}

describe('ITEM 4: raw IndexedDB contents', () => {
  it('lists every plaintext field on disk (report) and asserts none of the personal ones are plaintext', async () => {
    await seed();
    const dump = await rawDump();
    const plaintext: Record<string, string[]> = {};
    for (const [table, list] of Object.entries(dump)) {
      for (const row of list) {
        const hit = Object.entries(row).filter(([, v]) => JSON.stringify(v ?? null).includes('MARK|')).map(([k]) => k);
        if (hit.length) plaintext[table] = hit;
      }
    }
    process.stderr.write('PLAINTEXT-MARKED FIELDS: ' + JSON.stringify(plaintext) + '\n');
    // Everything carrying a marker is personal by construction.
    expect(plaintext).toEqual({});
  });

  it('every configured field is ciphertext, and round-trips through Dexie', async () => {
    await seed();
    const dump = await rawDump();
    for (const [table, fields] of Object.entries(ENCRYPTED_FIELDS)) {
      for (const row of dump[table]) for (const f of fields) {
        if (row[f] != null) expect(String(row[f]).startsWith('enc1:'), `${table}.${f}`).toBe(true);
      }
    }
    expect((await db.patients.get('p1'))?.displayName).toBe(M('patients', 'displayName'));
    expect((await db.telemetryEvents.get('e1'))?.metadata).toEqual({ answer: M('telemetryEvents', 'metadata') });
  });

  it('a companion answer cached for offline speech is not readable in the raw store', async () => {
    const answer = 'Your husband Ravi takes metformin at eight';
    await cacheSpeech({ language: 'en', text: answer, audioBase64: 'QUJD', audioFormat: 'wav' });
    const dump = await rawDump();
    expect(JSON.stringify(dump.speechCache)).not.toContain('metformin');
    expect(JSON.stringify(dump.speechCache)).not.toContain('Ravi');
    // ...and the cache still works.
    expect((await findCachedSpeech('en', answer))?.text).toBe(answer);
  });

  it('an install upgraded from v1 encryption purges legacy plaintext speech-cache rows and old plaintext everywhere else gets encrypted', async () => {
    await db.patients.put({ id: 'p9', caregiverId: 'c', displayName: 'Old Plain Name', ageYears: 1, gender: 'other', educationYears: 1, primaryLanguage: 'en', sessionDurationMinutes: 5, isActive: true, currentDifficulty: {}, updatedAt: stamp, syncedAt: null });
    db.close();
    // Roll the install back to "v1 encryption": legacy plaintext rows + old migration marker.
    const raw = new Dexie(DB_NAME);
    await raw.open();
    await raw.table('speechCache').put({ id: 'en Your husband Ravi takes metformin', text: 'Your husband Ravi takes metformin', language: 'en', audioBase64: 'QUJD', audioFormat: 'wav', createdAt: stamp });
    await raw.table('patients').put({ id: 'p8', caregiverId: 'c', displayName: 'Legacy Plain Name', ageYears: 1, gender: 'other', educationYears: 1, primaryLanguage: 'en', sessionDurationMinutes: 5, isActive: true, currentDifficulty: {}, updatedAt: stamp, syncedAt: null });
    await raw.table('keyring').update('storage', { migratedVersion: 1 });
    raw.close();

    db = new SmritiDB();
    await db.open();
    const dump = await rawDump();
    expect(dump.speechCache).toEqual([]);
    expect(JSON.stringify(dump.patients)).not.toContain('Legacy Plain Name');
    expect((await db.patients.get('p8'))?.displayName).toBe('Legacy Plain Name');
  });

  it('key storage: the data key is wrapped by a NON-extractable CryptoKey, no raw key on disk (it does live in the same database as the data)', async () => {
    await db.open();
    const dump = await rawDump();
    const entry = dump.keyring[0] as { wrappingKey?: CryptoKey; rawKey?: string; wrappedKey?: string };
    expect(entry.rawKey).toBeUndefined();
    expect(entry.wrappedKey).toBeTruthy();
    expect(entry.wrappingKey?.extractable).toBe(false);
    await expect(globalThis.crypto.subtle.exportKey('raw', entry.wrappingKey as CryptoKey)).rejects.toBeTruthy();
  });
});
