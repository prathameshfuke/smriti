'use client';

import { useEffect, useRef, useState } from 'react';
import StatusBadge, { type StatusTone } from '@/components/ui/StatusBadge';
import AnimatedSwitch from '@/components/ui/AnimatedSwitch';
import { buttonClass } from '@/components/ui/Panel';

export interface AccountAccessCardProps {
  label: string;
  statusTone: StatusTone;
  statusLabel: string;
  reviewRequired: boolean;
  onReviewRequiredChange: (next: boolean) => void;
  active: boolean;
  onRevoke: () => void;
  /** Absolute URL of the family view for this share. */
  shareUrl?: string;
}

type ShareState = 'idle' | 'copied' | 'failed';

/**
 * One family member's share link: who, its status, whether their notes need
 * review first, a way to send the link, and revoke. On phones "Share link"
 * opens the system share sheet (WhatsApp, SMS); elsewhere it copies the link
 * and says so. The link is also printed so it can be copied by hand.
 */
export default function AccountAccessCard({
  label,
  statusTone,
  statusLabel,
  reviewRequired,
  onReviewRequiredChange,
  active,
  onRevoke,
  shareUrl,
}: AccountAccessCardProps) {
  const [shareState, setShareState] = useState<ShareState>('idle');
  const [confirmRevoke, setConfirmRevoke] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const flash = (state: ShareState) => {
    setShareState(state);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setShareState('idle'), 3000);
  };

  const share = async () => {
    if (!shareUrl) return;
    const nav = typeof navigator !== 'undefined' ? navigator : undefined;
    if (nav?.share) {
      try {
        await nav.share({ title: 'SMRITI weekly update', text: `Weekly update for ${label}`, url: shareUrl });
        return;
      } catch (err) {
        // Dismissing the share sheet is not a failure; fall through to copy
        // only for real errors.
        if (err instanceof DOMException && err.name === 'AbortError') return;
      }
    }
    try {
      await nav?.clipboard?.writeText(shareUrl);
      flash(nav?.clipboard ? 'copied' : 'failed');
    } catch {
      flash('failed');
    }
  };

  return (
    <div className="flex flex-col gap-3 px-5 py-4">
      <div className="flex flex-col gap-1">
        <p className="text-caregiver-body font-bold text-ink">{label}</p>
        <StatusBadge tone={statusTone} label={statusLabel} />
      </div>

      {active && shareUrl ? (
        <p className="break-all rounded-tile bg-surface-muted/60 px-3 py-2 text-patient-sm text-ink-muted">{shareUrl}</p>
      ) : null}

      {active ? (
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-3">
            <span className="text-patient-sm text-ink">Review notes before the patient sees them</span>
            <AnimatedSwitch
              checked={reviewRequired}
              onChange={onReviewRequiredChange}
              label={`Require review before ${label}'s notes reach the patient`}
            />
          </div>

          {confirmRevoke ? (
            <div role="alert" className="flex flex-col gap-3 rounded-tile border border-danger/40 bg-danger/5 p-3">
              <p className="text-patient-sm font-bold text-ink">Turn off this link? {label} will no longer be able to open it.</p>
              <div className="flex flex-col gap-2 sm:flex-row">
                <button type="button" onClick={() => setConfirmRevoke(false)} className={buttonClass.secondary}>
                  Keep link
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setConfirmRevoke(false);
                    onRevoke();
                  }}
                  className={`${buttonClass.primary} bg-danger hover:bg-danger`}
                >
                  Revoke
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-2 sm:flex-row">
              {shareUrl ? (
                <button type="button" onClick={() => void share()} className={`${buttonClass.primary} sm:flex-1`}>
                  {shareState === 'copied' ? 'Link copied' : 'Share link'}
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => setConfirmRevoke(true)}
                className={`${buttonClass.secondary} border-danger text-danger hover:bg-danger/5`}
              >
                Revoke
              </button>
            </div>
          )}
          <p role="status" className="empty:hidden text-patient-sm font-bold text-ink">
            {shareState === 'copied' ? 'Link copied. Paste it into a message.' : null}
            {shareState === 'failed' ? 'Could not copy. Select the link above and copy it.' : null}
          </p>
        </div>
      ) : null}
    </div>
  );
}
