'use client';

import AnimatedSwitch from '@/components/ui/AnimatedSwitch';
import { useSettingsStore } from '@/stores/settingsStore';

/**
 * Double-tap-to-zoom is already blocked app-wide, unconditionally, in
 * globals.css — it's never intentional. Pinch-zoom is blocked by default too,
 * because a patient who mis-triggers it while dragging or tapping quickly
 * cannot get back out. This switch is how a caregiver turns it back on for a
 * low-vision patient who needs to magnify the screen (lib/a11y/zoomLock.ts).
 */
export default function ZoomLockSettings() {
  const zoomLocked = useSettingsStore((s) => s.zoomLocked);
  const setZoomLocked = useSettingsStore((s) => s.setZoomLocked);

  return (
    <div className="flex items-center justify-between gap-4">
      <div className="min-w-0">
        <p className="text-caregiver-body font-bold text-ink">Zoom lock</p>
        <p className="mt-1 text-caregiver-body text-ink-muted">
          {zoomLocked
            ? 'Pinch-to-zoom is off on this phone. Turn this off if the patient needs to magnify the screen. Accidental double-tap zoom is always blocked.'
            : 'Pinch-to-zoom is available on this phone for low vision. Turn on if it keeps triggering by accident while playing or scrolling.'}
        </p>
      </div>
      <AnimatedSwitch checked={zoomLocked} onChange={setZoomLocked} label="Zoom lock" />
    </div>
  );
}
