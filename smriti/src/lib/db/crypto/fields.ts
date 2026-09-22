/**
 * Which fields of which local tables are encrypted at rest.
 *
 * Only personal or health content is listed, and never an indexed field:
 * IndexedDB builds indexes from the stored value, so an encrypted field can't
 * be queried with `where()`. Ids, foreign keys, timestamps and `synced` flags
 * stay readable so every existing query keeps working. `speechCache` is
 * encrypted too: it caches spoken companion answers and reminder wording, which
 * quote Memory Bank facts and medicines. Its ids are keyed hashes, not the
 * text (see `lib/ai/speech-cache.ts`).
 *
 * Adding a field here is safe for existing installs: rows written before are
 * still read as plain text (see `middleware.ts`) and get encrypted the next
 * time they are written. Bump `ENCRYPTION_MIGRATION_VERSION` in `keys.ts` to
 * re-encrypt old rows eagerly on next open.
 */
export const ENCRYPTED_FIELDS: Readonly<Record<string, readonly string[]>> = {
  caregivers: ['displayName'],
  patients: ['displayName'],
  patientPhotos: ['dataUrl'],
  memoryBankEntries: ['title', 'detail', 'photoUrl', 'relationship'],
  aiConversationLog: ['question', 'answer'],
  reminiscenceQuizzes: ['questions'],
  familyMessages: ['text', 'senderName', 'senderRelation', 'photoUrl'],
  reminderSchedules: ['label', 'facilityName', 'locationNotes', 'bringNotes'],
  telemetryEvents: ['metadata'],
  syncQueue: ['payload'],
  speechCache: ['text', 'audioBase64'],
  deviceTrust: ['signature'],
  apiCache: ['body'],
  cloudKeys: ['key'],
  moodLogs: ['value'],
};
