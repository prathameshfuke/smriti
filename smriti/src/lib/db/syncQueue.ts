import { v4 as uuid } from 'uuid';
import { db, type SyncQueueItem } from './schema';

/**
 * Every local write that the server needs is queued here in the same
 * transaction as the write itself. Without that, a device that goes offline
 * between the write and the next sync attempt loses the record entirely: the
 * row exists in IndexedDB but nothing ever tells the server about it.
 */
export function buildQueueItem(
  tableName: string,
  recordId: string,
  operation: SyncQueueItem['operation'],
  payload: Record<string, unknown>,
): SyncQueueItem {
  return {
    id: uuid(),
    tableName,
    recordId,
    operation,
    payload,
    createdAt: new Date().toISOString(),
    attempts: 0,
  };
}

/** Convenience for writes that are not already inside a transaction. */
export async function enqueue(
  tableName: string,
  recordId: string,
  operation: SyncQueueItem['operation'],
  payload: Record<string, unknown>,
): Promise<void> {
  await db.syncQueue.put(buildQueueItem(tableName, recordId, operation, payload));
}
