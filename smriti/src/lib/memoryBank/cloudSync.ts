import { db, type LocalMemoryBankEntry } from '@/lib/db/schema';
import { createBrowserClient } from '@/lib/supabase/client';
import type { MemoryBankCategory } from '@/lib/supabase/types';
import { getLocalCloudKey } from './cloudKey';
import {
  decryptCloudField,
  decryptPhotoBytes,
  encryptCloudField,
  encryptPhotoBytes,
} from './cloudCrypto';

/**
 * Encryption layer for the Memory Bank's part of the regular sync
 * (lib/db/sync.ts). The phone's own copy (Dexie) is always the one the app
 * reads; sync runs in the background and no screen waits on it.
 *
 * Conflicts use the rule already used by sync.ts for Memory Bank, patients
 * and reminders: last write wins on `updated_at`, with an unsent local edit
 * kept until it is uploaded. `updated_at` is the time of the edit on the
 * phone (MIGRATION 017 removes the server trigger that overwrote it with the
 * upload time), and api/sync refuses to replace a row with an older one.
 */

/** Private bucket (MIGRATION 017). Objects are ciphertext. */
export const PHOTO_BUCKET = 'memory-bank-photos';
/** Marks an encrypted `photo_url` that points into PHOTO_BUCKET. */
const STORAGE_PREFIX = 'storage:';

export interface CloudMemoryBankRow {
  id: string;
  patient_id: string;
  category: string;
  title: string;
  detail: string;
  photo_url: string | null;
  relationship: string | null;
  active: boolean;
  created_by: string;
  updated_at: string;
}

async function currentCaregiverId(): Promise<string | null> {
  return (await db.caregivers.toCollection().first())?.id ?? null;
}

function dataUrlToBytes(dataUrl: string): Uint8Array {
  const base64 = dataUrl.slice(dataUrl.indexOf(',') + 1);
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function bytesToDataUrl(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return `data:${sniffImageType(bytes)};base64,${btoa(binary)}`;
}

function sniffImageType(b: Uint8Array): string {
  if (b[0] === 0x89 && b[1] === 0x50) return 'image/png';
  if (b[0] === 0x47 && b[1] === 0x49) return 'image/gif';
  if (b[0] === 0x52 && b[1] === 0x49) return 'image/webp';
  return 'image/jpeg';
}

/**
 * Encrypts unsynced entries for upload. Returns [] when this phone has no
 * unlocked Memory Bank key: entries then stay local (and `synced: false`)
 * until a key is set up — they are never sent in plain text.
 *
 * A photo is uploaded as ciphertext to the private bucket, and `photo_url`
 * carries its (encrypted) object path. An entry whose photo fails to upload
 * is left out, so it is retried whole next time instead of losing the photo.
 */
export async function encryptEntriesForCloud(entries: LocalMemoryBankEntry[]): Promise<CloudMemoryBankRow[]> {
  if (entries.length === 0) return [];
  const caregiverId = await currentCaregiverId();
  const key = caregiverId ? await getLocalCloudKey(caregiverId) : null;
  if (!key) return [];

  const supabase = createBrowserClient();
  const rows = await Promise.all(
    entries.map(async (e): Promise<CloudMemoryBankRow | null> => {
      let photoRef = e.photoUrl;
      if (photoRef?.startsWith('data:')) {
        const path = `${e.patientId}/${e.id}`;
        try {
          const sealed = encryptPhotoBytes(key, e.id, dataUrlToBytes(photoRef));
          const { error } = await supabase.storage
            .from(PHOTO_BUCKET)
            .upload(path, new Blob([sealed as Uint8Array<ArrayBuffer>], { type: 'application/octet-stream' }), {
              contentType: 'application/octet-stream',
              upsert: true,
            });
          if (error) return null;
        } catch {
          return null;
        }
        photoRef = `${STORAGE_PREFIX}${path}`;
      }
      return {
        id: e.id,
        patient_id: e.patientId,
        category: e.category,
        title: encryptCloudField(key, e.id, 'title', e.title),
        detail: encryptCloudField(key, e.id, 'detail', e.detail),
        relationship: encryptCloudField(key, e.id, 'relationship', e.relationship),
        photo_url: encryptCloudField(key, e.id, 'photo_url', photoRef),
        active: e.active,
        created_by: e.createdBy,
        updated_at: e.updatedAt,
      };
    }),
  );
  return rows.filter((r): r is CloudMemoryBankRow => r !== null);
}

async function downloadPhoto(key: Uint8Array, id: string, ref: string | null): Promise<string | null> {
  if (!ref || !ref.startsWith(STORAGE_PREFIX)) return ref;
  const { data, error } = await createBrowserClient().storage.from(PHOTO_BUCKET).download(ref.slice(STORAGE_PREFIX.length));
  if (error || !data) throw error ?? new Error('photo download failed');
  return bytesToDataUrl(decryptPhotoBytes(key, id, new Uint8Array(await data.arrayBuffer())));
}

/** Decrypts one server row into the local shape. Throws if it can't. */
export async function decryptCloudRow(
  key: Uint8Array,
  row: CloudMemoryBankRow,
  existingPhoto: string | null,
): Promise<LocalMemoryBankEntry> {
  const photoRef = decryptCloudField(key, row.id, 'photo_url', row.photo_url);
  const samePhoto = photoRef?.startsWith(STORAGE_PREFIX) && existingPhoto?.startsWith('data:');
  return {
    id: row.id,
    patientId: row.patient_id,
    category: row.category as MemoryBankCategory,
    title: decryptCloudField(key, row.id, 'title', row.title) ?? '',
    detail: decryptCloudField(key, row.id, 'detail', row.detail) ?? '',
    relationship: decryptCloudField(key, row.id, 'relationship', row.relationship),
    // An unchanged photo isn't downloaded again; a changed one always is.
    photoUrl: samePhoto && existingPhoto ? existingPhoto : await downloadPhoto(key, row.id, photoRef),
    active: row.active,
    createdBy: row.created_by,
    updatedAt: row.updated_at,
    synced: true,
  };
}

export interface DecryptedMemoryBank {
  entries: Map<string, LocalMemoryBankEntry>;
  /** Patients with a row this phone couldn't decrypt (no key yet, or a bad
   * row); their pull cursor must not advance past it. */
  unreadablePatients: Set<string>;
}

/**
 * Decrypts the Memory Bank rows a sync response sent down (other phones'
 * edits). Rows that can't be decrypted are left out and reported, never
 * written to the phone as ciphertext or shown as plain text.
 */
export async function decryptIncomingMemoryBank(rows: CloudMemoryBankRow[]): Promise<DecryptedMemoryBank> {
  const result: DecryptedMemoryBank = { entries: new Map(), unreadablePatients: new Set() };
  if (rows.length === 0) return result;
  const caregiverId = await currentCaregiverId();
  const key = caregiverId ? await getLocalCloudKey(caregiverId) : null;
  for (const row of rows) {
    if (!key) {
      result.unreadablePatients.add(row.patient_id);
      continue;
    }
    try {
      const local = await db.memoryBankEntries.get(row.id);
      result.entries.set(row.id, await decryptCloudRow(key, row, local?.photoUrl ?? null));
    } catch (err) {
      console.error('[memory-bank] could not decrypt a cloud entry; keeping the local copy', row.id, err);
      result.unreadablePatients.add(row.patient_id);
    }
  }
  return result;
}
