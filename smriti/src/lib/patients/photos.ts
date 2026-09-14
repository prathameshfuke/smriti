import { db } from '@/lib/db/schema';

const MAX_INPUT_BYTES = 10 * 1024 * 1024;
const MAX_EDGE_PX = 360;

export class PhotoTooLargeError extends Error {}

/**
 * Shrinks a chosen photo to at most 360px on its longest edge and stores it
 * on this device for the "Who is playing?" screen. A phone camera photo is
 * several megabytes; the picker only ever shows it at 80px.
 */
export async function savePatientPhoto(patientId: string, file: File): Promise<void> {
  if (file.size > MAX_INPUT_BYTES) throw new PhotoTooLargeError('Photo is larger than 10MB');
  const dataUrl = await shrink(file);
  await db.patientPhotos.put({ patientId, dataUrl, updatedAt: new Date().toISOString() });
}

export async function removePatientPhoto(patientId: string): Promise<void> {
  await db.patientPhotos.delete(patientId);
}

async function shrink(file: File): Promise<string> {
  const original = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });

  if (typeof document === 'undefined') return original;

  const image = await new Promise<HTMLImageElement | null>((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = original;
  });
  if (!image || !image.width || !image.height) return original;

  const scale = Math.min(1, MAX_EDGE_PX / Math.max(image.width, image.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(image.width * scale);
  canvas.height = Math.round(image.height * scale);
  const ctx = canvas.getContext('2d');
  if (!ctx) return original;
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', 0.85);
}
