import 'fake-indexeddb/auto';
import Dexie from 'dexie';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DB_NAME, SmritiDB, type LocalMemoryBankEntry, type LocalPatient } from '@/lib/db/schema';
import {
  decryptValue,
  encryptValue,
  generateStorageKey,
  isEncrypted,
  StorageDecryptError,
} from '@/lib/db/crypto/cipher';
import { ENCRYPTION_MIGRATION_VERSION, KEYRING_ID } from '@/lib/db/crypto/keys';

/**
 * Reads what IndexedDB actually holds, bypassing the encryption middleware:
 * a plain Dexie instance opened on the same database in dynamic mode.
 */
async function rawRow(table: string, key: string): Promise<Record<string, unknown> | undefined> {
  const raw = new Dexie(DB_NAME);
  await raw.open();
  try {
    return await raw.table(table).get(key);
  } finally {
    raw.close();
  }
}

const patient = (over: Partial<LocalPatient> = {}): LocalPatient => ({
  id: 'p1',
  caregiverId: 'c1',
  displayName: 'Maya Devi',
  ageYears: 72,
  gender: 'female',
  educationYears: 4,
  primaryLanguage: 'as',
  sessionDurationMinutes: 15,
  isActive: true,
  currentDifficulty: { object_hunt: 3 },
  updatedAt: '2026-09-16T10:00:00.000Z',
  syncedAt: null,
  ...over,
});

const memory = (over: Partial<LocalMemoryBankEntry> = {}): LocalMemoryBankEntry => ({
  id: 'm1',
  patientId: 'p1',
  category: 'person',
  title: 'Wedding day',
  detail: 'Married Ravi in Guwahati, 1974',
  photoUrl: 'data:image/png;base64,iVBORw0KGgo=',
  relationship: 'husband',
  active: true,
  createdBy: 'c1',
  updatedAt: '2026-09-16T10:00:00.000Z',
  synced: false,
  ...over,
});

describe('field cipher', () => {
  const key = generateStorageKey();

  it('round-trips strings, objects and arrays', () => {
    for (const value of ['Maya', { a: 1, b: [true, null] }, [{ question: 'q', options: ['x'] }]]) {
      const sealed = encryptValue(key, value, 't.f');
      expect(isEncrypted(sealed)).toBe(true);
      expect(decryptValue(key, sealed, 't.f')).toEqual(value);
    }
  });

  it('uses a fresh nonce, so equal values encrypt differently', () => {
    expect(encryptValue(key, 'same', 't.f')).not.toBe(encryptValue(key, 'same', 't.f'));
  });

  it('rejects a tampered ciphertext', () => {
    const sealed = encryptValue(key, 'Maya', 't.f');
    const last = sealed.at(-2) === 'A' ? 'B' : 'A';
    const tampered = sealed.slice(0, -2) + last + sealed.slice(-1);
    expect(() => decryptValue(key, tampered, 't.f')).toThrow(StorageDecryptError);
  });

  it('rejects a ciphertext moved to a different field', () => {
    const sealed = encryptValue(key, 'Maya', 'patients.displayName');
    expect(() => decryptValue(key, sealed, 'memoryBankEntries.title')).toThrow(StorageDecryptError);
  });

  it('rejects the wrong key', () => {
    const sealed = encryptValue(key, 'Maya', 't.f');
    expect(() => decryptValue(generateStorageKey(), sealed, 't.f')).toThrow(StorageDecryptError);
  });
});

describe('encrypted local database', () => {
  let db: SmritiDB;

  beforeEach(() => {
    db = new SmritiDB();
  });

  afterEach(async () => {
    db.close();
    await SmritiDB.deleteDatabase();
  });

  it('stores personal fields as ciphertext and reads them back as plain text', async () => {
    await db.patients.put(patient());
    await db.memoryBankEntries.put(memory());

    const stored = await rawRow('patients', 'p1');
    expect(isEncrypted(stored?.displayName)).toBe(true);
    expect(JSON.stringify(stored)).not.toContain('Maya');

    const storedMemory = await rawRow('memoryBankEntries', 'm1');
    for (const field of ['title', 'detail', 'photoUrl', 'relationship']) {
      expect(isEncrypted(storedMemory?.[field])).toBe(true);
    }

    expect(await db.patients.get('p1')).toEqual(patient());
    expect(await db.memoryBankEntries.get('m1')).toEqual(memory());
  });

  it('leaves ids, indexes and flags readable so queries still work', async () => {
    await db.memoryBankEntries.bulkPut([memory(), memory({ id: 'm2', patientId: 'p2', title: 'School' })]);

    const stored = await rawRow('memoryBankEntries', 'm1');
    expect(stored?.patientId).toBe('p1');
    expect(stored?.synced).toBe(false);

    const rows = await db.memoryBankEntries.where('patientId').equals('p2').toArray();
    expect(rows.map((r) => r.title)).toEqual(['School']);
  });

  it('decrypts through cursors, filters and modify', async () => {
    await db.memoryBankEntries.bulkPut([memory(), memory({ id: 'm2', title: 'School' })]);

    const filtered = await db.memoryBankEntries.filter((r) => r.title === 'School').toArray();
    expect(filtered.map((r) => r.id)).toEqual(['m2']);

    await db.memoryBankEntries.where('id').equals('m1').modify((r) => {
      r.detail = `${r.detail} (edited)`;
    });
    expect((await db.memoryBankEntries.get('m1'))?.detail).toBe('Married Ravi in Guwahati, 1974 (edited)');
    expect(isEncrypted((await rawRow('memoryBankEntries', 'm1'))?.detail)).toBe(true);

    await db.memoryBankEntries.update('m2', { title: 'College' });
    expect((await db.memoryBankEntries.get('m2'))?.title).toBe('College');
  });

  it('encrypts out-of-line tables and non-string fields', async () => {
    await db.deviceTrust.put({ patientId: 'p1', issuedAt: 1, issuedBy: 'c1', signature: 'sig-abc' }, 'patient:p1');
    await db.reminiscenceQuizzes.put({
      id: 'q1',
      patientId: 'p1',
      questions: [{ question: 'Who is Ravi?', options: ['Husband', 'Son'], correctIndex: 0, entryTitle: 'Wedding day' }],
      generatedAt: '2026-09-16T10:00:00.000Z',
    });

    expect(isEncrypted((await rawRow('deviceTrust', 'patient:p1'))?.signature)).toBe(true);
    expect(isEncrypted((await rawRow('reminiscenceQuizzes', 'q1'))?.questions)).toBe(true);
    expect((await db.deviceTrust.get('patient:p1'))?.signature).toBe('sig-abc');
    expect((await db.reminiscenceQuizzes.get('q1'))?.questions[0].options).toEqual(['Husband', 'Son']);
  });

  it('keeps the data key sealed, never stored as raw bytes', async () => {
    await db.patients.put(patient());
    const entry = await db.keyring.get(KEYRING_ID);
    expect(entry?.rawKey).toBeUndefined();
    expect(entry?.wrappingKey?.extractable).toBe(false);
    expect(entry?.migratedVersion).toBe(ENCRYPTION_MIGRATION_VERSION);
  });

  it('reads the data again after the database is closed and reopened', async () => {
    await db.patients.put(patient());
    db.close();

    const reopened = new SmritiDB();
    try {
      expect(await reopened.patients.toArray()).toEqual([patient()]);
    } finally {
      reopened.close();
    }
  });

  it('encrypts rows left in plain text by an older build on next open', async () => {
    db.close();
    await SmritiDB.deleteDatabase();

    // Version 6 of the schema, as shipped before encryption existed.
    const legacy = new Dexie(DB_NAME);
    legacy.version(6).stores({ patients: 'id, caregiverId, isActive', memoryBankEntries: 'id, patientId, category, active, synced' });
    await legacy.table('patients').put(patient());
    await legacy.table('memoryBankEntries').put(memory());
    legacy.close();

    db = new SmritiDB();
    expect((await db.patients.get('p1'))?.displayName).toBe('Maya Devi');
    expect(isEncrypted((await rawRow('patients', 'p1'))?.displayName)).toBe(true);
    expect(isEncrypted((await rawRow('memoryBankEntries', 'm1'))?.title)).toBe(true);
  });

  it('starts over with a fresh key after deleteDatabase', async () => {
    await db.patients.put(patient());
    const before = await db.keyring.get(KEYRING_ID);

    await SmritiDB.deleteDatabase();

    expect(await db.patients.count()).toBe(0);
    await db.patients.put(patient({ displayName: 'Hari' }));
    expect((await db.patients.get('p1'))?.displayName).toBe('Hari');
    const after = await db.keyring.get(KEYRING_ID);
    expect(after?.wrappedKey).not.toEqual(before?.wrappedKey);
  });

  it('clears a table it can no longer decrypt instead of failing every read', async () => {
    await db.patients.put(patient());
    db.close();

    const raw = new Dexie(DB_NAME);
    await raw.open();
    await raw.table('keyring').delete(KEYRING_ID);
    raw.close();

    db = new SmritiDB();
    expect(await db.patients.count()).toBe(0);
    await db.patients.put(patient());
    expect((await db.patients.get('p1'))?.displayName).toBe('Maya Devi');
  });
});
