import type { DBCore, DBCoreCursor, DBCoreTable, Middleware } from 'dexie';
import { decryptValue, encryptValue, isEncrypted, StorageLockedError } from './cipher';

type KeyGetter = () => Uint8Array | null;

/**
 * Dexie DBCore middleware that encrypts the configured fields on every write
 * and decrypts them on every read, so the rest of the app keeps calling
 * `db.table.put/get/where` exactly as before.
 *
 * Level -2 puts it directly on top of IndexedDB, below Dexie's own cache,
 * hooks and observability middlewares (levels -1 to 2), so those only ever see
 * plain values.
 *
 * Values without the `enc1:` prefix are returned untouched. That keeps rows
 * written by builds from before this existed readable until they are migrated.
 */
export function createEncryptionMiddleware(
  fieldsByTable: Readonly<Record<string, readonly string[]>>,
  getKey: KeyGetter,
): Middleware<DBCore> {
  return {
    stack: 'dbcore',
    name: 'FieldEncryptionMiddleware',
    level: -2,
    create: (down: DBCore) => ({
      ...down,
      table: (tableName: string): DBCoreTable => {
        const table = down.table(tableName);
        const fields = fieldsByTable[tableName];
        if (!fields?.length) return table;

        const requireKey = () => {
          const key = getKey();
          if (!key) throw new StorageLockedError();
          return key;
        };

        const encryptRow = (row: unknown) => {
          if (!row || typeof row !== 'object') return row;
          const source = row as Record<string, unknown>;
          if (!fields.some((f) => source[f] != null)) return row;
          const key = requireKey();
          const copy = { ...source };
          for (const field of fields) {
            if (copy[field] != null) copy[field] = encryptValue(key, copy[field], `${tableName}.${field}`);
          }
          return copy;
        };

        const decryptRow = (row: unknown) => {
          if (!row || typeof row !== 'object') return row;
          const source = row as Record<string, unknown>;
          if (!fields.some((f) => isEncrypted(source[f]))) return row;
          const key = requireKey();
          const copy = { ...source };
          for (const field of fields) {
            const value = copy[field];
            if (isEncrypted(value)) copy[field] = decryptValue(key, value, `${tableName}.${field}`);
          }
          return copy;
        };

        const wrapCursor = (cursor: DBCoreCursor | null): DBCoreCursor | null => {
          if (!cursor) return cursor;
          let lastRaw: unknown;
          let lastPlain: unknown;
          return Object.create(cursor, {
            value: {
              get() {
                const raw = cursor.value;
                if (raw !== lastRaw) {
                  lastRaw = raw;
                  lastPlain = decryptRow(raw);
                }
                return lastPlain;
              },
            },
          });
        };

        return {
          ...table,
          mutate: (req) => {
            if (req.type !== 'add' && req.type !== 'put') return table.mutate(req);
            return table.mutate({ ...req, values: req.values.map(encryptRow) });
          },
          get: (req) => table.get(req).then(decryptRow),
          getMany: (req) => table.getMany(req).then((rows) => rows.map(decryptRow)),
          query: (req) =>
            table.query(req).then((res) => (req.values ? { ...res, result: res.result.map(decryptRow) } : res)),
          openCursor: (req) => table.openCursor(req).then(wrapCursor),
        };
      },
    }),
  };
}
