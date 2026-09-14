'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { stopAllAudio } from '@/lib/audio/channel';

/**
 * Silences the app whenever the screen changes. Without it, an instruction
 * still being read out on a game screen carried on over the next screen's own
 * narration after Back or a session end. Renders nothing.
 */
export default function AudioRouteReset() {
  const pathname = usePathname();
  useEffect(() => stopAllAudio, [pathname]);
  return null;
}
