'use client';

import { useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { buttonClass } from '@/components/ui/Panel';

/**
 * Leaving the caregiver area for the patient's screen is one tap on a bar
 * that sits next to the tabs a caregiver uses constantly, and it hands the
 * phone over mid-task. This asks first. "Stay here" is focused, so a stray
 * Enter or tap-through cancels instead of switching.
 *
 * Returns the opener and the dialog element to render once, next to the
 * trigger, so each surface keeps its own button styling.
 */
export function usePatientViewConfirm(): { ask: () => void; dialog: ReactNode } {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const dialog = open ? (
    <Dialog open onOpenChange={(next) => setOpen(next)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Switch to Patient View?</DialogTitle>
          <DialogDescription>
            This opens the patient&apos;s home screen. You may need your caregiver PIN to come back here.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex-col-reverse sm:flex-row">
          <button type="button" autoFocus onClick={() => setOpen(false)} className={buttonClass.secondary}>
            Stay here
          </button>
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              router.push('/app');
            }}
            className={buttonClass.primary}
          >
            Switch to Patient View
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  ) : null;

  return { ask: () => setOpen(true), dialog };
}
