import StatusBadge, { type StatusTone } from '@/components/ui/StatusBadge';
import AnimatedSwitch from '@/components/ui/AnimatedSwitch';

export interface AccountAccessCardProps {
  label: string;
  statusTone: StatusTone;
  statusLabel: string;
  reviewRequired: boolean;
  onReviewRequiredChange: (next: boolean) => void;
  active: boolean;
  onRevoke: () => void;
}

/**
 * One family member's share link: who, its current status, whether their
 * notes need caregiver review before the patient sees them, and revoke.
 * Formalizes the row the Family tab used to build inline (see DESIGN.md's
 * "card top-strip removal" log) into a named, reusable Level-1 card.
 */
export default function AccountAccessCard({
  label,
  statusTone,
  statusLabel,
  reviewRequired,
  onReviewRequiredChange,
  active,
  onRevoke,
}: AccountAccessCardProps) {
  return (
    <div className="flex flex-col gap-3 rounded-card border border-line200 bg-white p-3 transition-shadow hover:shadow-md sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-col gap-1">
        <p className="font-bold text-navy">{label}</p>
        <StatusBadge tone={statusTone} label={statusLabel} />
      </div>

      <div className="flex items-center gap-4">
        {active ? (
          <div className="flex items-center gap-2">
            <span className="text-patient-sm text-ink-muted">Review notes first</span>
            <AnimatedSwitch
              checked={reviewRequired}
              onChange={onReviewRequiredChange}
              label={`Require review before ${label}'s notes reach the patient`}
            />
          </div>
        ) : null}

        {active ? (
          <button
            type="button"
            onClick={onRevoke}
            className="text-caregiver-body font-semibold text-danger"
          >
            Revoke
          </button>
        ) : null}
      </div>
    </div>
  );
}
