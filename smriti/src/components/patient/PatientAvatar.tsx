'use client';

import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db/schema';

export interface PatientAvatarProps {
  patientId: string;
  name: string;
  size?: number;
}

/**
 * A patient's face from this phone's photo store, or their initial on a warm
 * tile when no photo was added. Decorative: the name is always printed next
 * to it.
 */
export default function PatientAvatar({ patientId, name, size = 72 }: PatientAvatarProps) {
  const photo = useLiveQuery(() => db.patientPhotos.get(patientId), [patientId]);
  const initial = name.trim().charAt(0).toUpperCase() || '?';

  return (
    <span
      aria-hidden="true"
      style={{ width: size, height: size }}
      className="flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-line200 bg-primary/10"
    >
      {photo ? (
        // eslint-disable-next-line @next/next/no-img-element -- local data URL, nothing to optimise
        <img src={photo.dataUrl} alt="" className="h-full w-full object-cover" />
      ) : (
        <span className="font-serif-display font-medium text-primary-dark" style={{ fontSize: size * 0.42 }}>
          {initial}
        </span>
      )}
    </span>
  );
}
