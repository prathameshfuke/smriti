/**
 * Offline-first client for the family message board: pulls the feed into
 * Dexie's `familyMessages` table (schema.ts) and posts "Seen" acks. Mirrors
 * the shape of `lib/db/sync.ts` — best-effort network calls, Dexie is
 * always the thing the UI actually reads, so a patient with no connectivity
 * still sees whatever was last fetched and can still tap "Seen" (the ack
 * lands locally immediately; the server call is fire-and-forget and safe to
 * retry since `POST .../seen` is idempotent).
 */

import { db, type LocalFamilyMessage } from '@/lib/db/schema';
import { getDeviceTrustToken, isTokenWellFormed } from '@/lib/auth/deviceTrust';

const FETCH_TIMEOUT_MS = 8_000;

interface FeedNote {
  id: string;
  text: string;
  senderName: string | null;
  senderRelation: string | null;
  photoUrl: string | null;
  createdAt: string;
  seenAt: string | null;
}

/**
 * Pulls the patient's family message feed and upserts it into Dexie. Never
 * throws — a failed pull just means the board keeps showing whatever is
 * already cached locally.
 */
export async function pullFamilyMessages(patientId: string): Promise<void> {
  try {
    const token = await getDeviceTrustToken();
    if (!token || !isTokenWellFormed(token)) return;

    const res = await fetch(
      `/api/patients/${patientId}/family-notes/feed?deviceTrustToken=${encodeURIComponent(JSON.stringify(token))}`,
      { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) },
    );
    if (!res.ok) return;

    const body = (await res.json()) as { notes: FeedNote[] };
    const incoming = body.notes ?? [];
    if (incoming.length === 0) return;

    await db.transaction('rw', db.familyMessages, async () => {
      for (const note of incoming) {
        const existing = await db.familyMessages.get(note.id);
        const local: LocalFamilyMessage = {
          id: note.id,
          patientId,
          text: note.text,
          senderName: note.senderName,
          senderRelation: note.senderRelation,
          photoUrl: note.photoUrl,
          createdAt: note.createdAt,
          // A locally-recorded "Seen" tap that hasn't synced yet must never
          // be overwritten back to unseen by a server response that predates it.
          seenAt: existing?.seenAt ?? note.seenAt,
          ackSynced: existing?.ackSynced ?? Boolean(note.seenAt),
        };
        await db.familyMessages.put(local);
      }
    });
  } catch {
    // Offline or transient failure — Dexie keeps whatever was last cached.
  }
}

/** Every cached family message for a patient, newest first. */
export async function getLocalFamilyMessages(patientId: string): Promise<LocalFamilyMessage[]> {
  const rows = await db.familyMessages.where('patientId').equals(patientId).toArray();
  return rows.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

/**
 * Marks one message seen: stamps Dexie immediately (so the UI reflects the
 * tap even if offline), then best-effort tells the server. Safe to call
 * more than once — both the local write and the server route are idempotent.
 */
export async function acknowledgeFamilyMessage(patientId: string, messageId: string): Promise<void> {
  const now = new Date().toISOString();
  const existing = await db.familyMessages.get(messageId);
  await db.familyMessages.put({
    id: messageId,
    patientId,
    text: existing?.text ?? '',
    senderName: existing?.senderName ?? null,
    senderRelation: existing?.senderRelation ?? null,
    photoUrl: existing?.photoUrl ?? null,
    createdAt: existing?.createdAt ?? now,
    seenAt: existing?.seenAt ?? now,
    ackSynced: false,
  });

  try {
    const token = await getDeviceTrustToken();
    if (!token || !isTokenWellFormed(token)) return;

    const res = await fetch(
      `/api/patients/${patientId}/family-notes/${messageId}/seen?deviceTrustToken=${encodeURIComponent(
        JSON.stringify(token),
      )}`,
      { method: 'POST', signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) },
    );
    if (res.ok) {
      await db.familyMessages.update(messageId, { ackSynced: true });
    }
  } catch {
    // Stays ackSynced: false — a later pull/retry will reconcile.
  }
}
