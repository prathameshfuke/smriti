import type { DBCore, DBCoreCursor, DBCoreTable } from 'dexie';
import { describe, expect, it } from 'vitest';
import { createEncryptionMiddleware } from '@/lib/db/crypto/middleware';
import { encryptValue, generateStorageKey } from '@/lib/db/crypto/cipher';

/**
 * A real IDBCursor's `key` and `primaryKey` are brand-checked accessors: read
 * with any other `this` they throw "TypeError: Illegal invocation".
 * fake-indexeddb doesn't check, so the other data-layer tests can't see this.
 * Private fields give the same check here.
 */
class BrandCheckedCursor {
  #key: unknown;
  #primaryKey: unknown;
  #value: unknown;
  done = false;

  constructor(key: unknown, primaryKey: unknown, value: unknown) {
    this.#key = key;
    this.#primaryKey = primaryKey;
    this.#value = value;
  }

  get key() {
    return this.#key;
  }

  get primaryKey() {
    return this.#primaryKey;
  }

  get value() {
    return this.#value;
  }
}

describe('encryption middleware cursor', () => {
  const key = new Uint8Array(generateStorageKey());
  const row = { id: 'r1', patientId: 'p1', label: encryptValue(key, 'Pills', 'reminderSchedules.label') };

  const openWrapped = async () => {
    const native = new BrandCheckedCursor('p1', 'r1', row) as unknown as DBCoreCursor;
    const table = { openCursor: async () => native } as unknown as DBCoreTable;
    const down = { table: () => table } as unknown as DBCore;
    const core = createEncryptionMiddleware({ reminderSchedules: ['label'] }, () => key).create(down);
    return (await core.table!('reminderSchedules').openCursor({} as never))!;
  };

  it('reads key and primaryKey without an illegal invocation', async () => {
    const cursor = await openWrapped();
    expect(cursor.key).toBe('p1');
    expect(cursor.primaryKey).toBe('r1');
  });

  it('survives being wrapped again the way Dexie live queries do', async () => {
    const cursor = await openWrapped();
    // Dexie's observability middleware wraps every cursor inside liveQuery like this.
    const tracked = Object.create(cursor, {
      primaryKey: { get: () => cursor.primaryKey },
      value: { get: () => cursor.value },
    }) as DBCoreCursor;
    expect(tracked.primaryKey).toBe('r1');
    expect((tracked.value as { label: string }).label).toBe('Pills');
  });
});
