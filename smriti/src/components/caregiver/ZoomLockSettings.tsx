'use client';

import AnimatedSwitch from '@/components/ui/AnimatedSwitch';
import { useSettingsStore } from '@/stores/settingsStore';

/**
 * Double-tap-to-zoom is already blocked app-wide, unconditionally, in
 * globals.css — it's never intentional. Pinch-zoom stays available by
 * default so a low-vision patient can still magnify the screen. This switch
 * is the opt-in for a patient who never needs pinch-zoom and instead keeps
 * mis-triggering it while dragging or tapping quickly; turning it on drops
 * pinch-zoom on this phone too (lib/a11y/zoomLock.ts).
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
            ? 'Pinch-to-zoom is off on this phone. Accidental double-tap zoom is always blocked.'
            : 'Pinch-to-zoom stays available for low vision. Turn on if it keeps triggering by accident while playing or scrolling.'}
        </p>
      </div>
      <AnimatedSwitch checked={zoomLocked} onChange={setZoomLocked} label="Zoom lock" />
    </div>
  );
}
