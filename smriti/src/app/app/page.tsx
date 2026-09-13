'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import BigButton from '@/components/ui/BigButton';
import appIcon from '@/appicon.png';
import GameTile from '@/components/ui/GameTile';
import LanguagePicker from '@/components/layout/LanguagePicker';
import PinPad from '@/components/ui/PinPad';
import ReminderCard, { REMINDER_ICON } from '@/components/ui/ReminderCard';
import Skeleton from '@/components/ui/Skeleton';
import FamilyMessageBoard from '@/components/patient/FamilyMessageBoard';
import { useReminders } from '@/hooks/useReminders';
import { useGameStreak } from '@/hooks/useGameStreak';
import { acknowledgeReminder } from '@/lib/engine/reminders';
import { getDeviceTrustToken, isTokenWellFormed } from '@/lib/auth/deviceTrust';
import { restoreLocalSession, checkLiveCaregiverSession } from '@/lib/auth/localSession';
import { speak } from '@/lib/audio/speech';
import { usePatientStore } from '@/stores/patientStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { useTranslation } from '@/lib/i18n/provider';

const GAMES = [
  { gameName: 'Object Hunt', gameType: 'object_hunt', href: '/games/object-hunt', illustrationSrc: '/images/game-object-hunt.svg' },
  { gameName: 'Word Stream', gameType: 'word_stream', href: '/games/word-stream', illustrationSrc: '/images/game-word-stream.svg' },
  { gameName: 'Quick Tap', gameType: 'quick_tap', href: '/games/quick-tap', illustrationSrc: '/images/game-quick-tap.svg' },
  { gameName: 'Path Match', gameType: 'path_match', href: '/games/path-match', illustrationSrc: '/images/game-path-match.svg' },
  { gameName: 'Memory Match', gameType: 'memory_match', href: '/games/memory-match', illustrationSrc: '/images/game-memory-match.svg' },
  { gameName: 'Memory Blocks', gameType: 'memory_blocks', href: '/games/memory-blocks', illustrationSrc: '/images/game-memory-blocks.svg' },
  { gameName: 'Frog Leap', gameType: 'frog_leap', href: '/games/frog-leap', illustrationSrc: '/images/game-frog-leap.svg' },
  { gameName: 'Counting Boxes', gameType: 'counting_boxes', href: '/games/counting-boxes', illustrationSrc: '/images/game-counting-boxes.svg' },
  { gameName: 'Larger Number', gameType: 'larger_number', href: '/games/larger-number', illustrationSrc: '/images/game-larger-number.svg' },
  { gameName: 'Memory Span', gameType: 'memory_span', href: '/games/memory-span', illustrationSrc: '/images/game-memory-span.svg' },
  { gameName: 'Fish Trace', gameType: 'fish_trace', href: '/games/fish-trace', illustrationSrc: '/images/game-fish-trace.svg' },
  { gameName: 'Double Decision', gameType: 'double_decision', href: '/games/double-decision', illustrationSrc: '/images/game-double-decision.svg' },
  { gameName: 'N-Back', gameType: 'n_back', href: '/games/n-back', illustrationSrc: '/images/game-n-back.svg' },
  {
    gameName: 'Memory Match: Family & Life',
    gameType: 'reminiscence_quiz',
    href: '/games/reminiscence-quiz',
    illustrationSrc: '/images/game-reminiscence-quiz.svg',
  },
  {
    gameName: 'Routine Recall',
    gameType: 'routine_recall',
    href: '/games/routine-recall',
    illustrationSrc: undefined,
  },
] as const;

/** No new illustration asset — reuses the same reminder-type icons already on the home screen's reminder cards. */
function RoutineRecallIcon() {
  return (
    <span className="flex gap-1 text-3xl" aria-hidden="true">
      <span>{REMINDER_ICON.medication.emoji}</span>
      <span>{REMINDER_ICON.hydration.emoji}</span>
      <span>{REMINDER_ICON.activity.emoji}</span>
      <span>{REMINDER_ICON.appointment.emoji}</span>
    </span>
  );
}

const PIN_LENGTH = 4;

function PinDialog({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const verifyPin = useSettingsStore((s) => s.verifyPin);
  const pinCooldownUntil = useSettingsStore((s) => s.pinCooldownUntil);
  const isPinLocked = useSettingsStore((s) => s.isPinLocked);
  const recordWrongPinAttempt = useSettingsStore((s) => s.recordWrongPinAttempt);
  const clearPinAttempts = useSettingsStore((s) => s.clearPinAttempts);

  const [digits, setDigits] = useState('');
  const [verifying, setVerifying] = useState(false);
  // The actual lockout is judged by isPinLocked()/pinCooldownUntil
  // (settingsStore.ts, persisted) — a page reload mid-cooldown no longer
  // resets it, since pinCooldownUntil is an absolute timestamp, not a
  // decrementing counter. remainingSeconds is display-only, computed inside
  // the effect (not during render — Date.now() read at render time is
  // impure and this project's lint enforces that) and re-read every second
  // while locked so the countdown text keeps ticking.
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const locked = isPinLocked();

  useEffect(() => {
    // No explicit reset when unlocked: the cooldown message itself stops
    // rendering once `locked` is false, so a stale remainingSeconds sitting
    // unused in state is harmless — the next lockout's tick() overwrites it
    // before it's ever displayed again.
    if (!locked || pinCooldownUntil === null) return;
    const tick = () => setRemainingSeconds(Math.max(0, Math.ceil((pinCooldownUntil - Date.now()) / 1000)));
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [locked, pinCooldownUntil]);

  const submitPin = async (candidate: string) => {
    // verifyPin runs a real PBKDF2 chain (100k iterations, settingsStore.ts)
    // — deliberately slow, not instant. Without `verifying` gating input
    // below, a caregiver (or an attacker brute-forcing this 4-digit PIN)
    // typing the next attempt before this resolves would have it silently
    // absorbed into `digits` past PIN_LENGTH and discarded when this attempt
    // finally clears it — undercounting real wrong attempts against the
    // lockout threshold, worse the slower the device. `finally` so a stuck
    // `true` can't survive any exit path, including an unexpected throw.
    setVerifying(true);
    try {
      const ok = await verifyPin(candidate);
      if (!ok) {
        setDigits('');
        recordWrongPinAttempt();
        return;
      }
      // A correct PIN actually clears the slate — previously implicit (the
      // component's own state just wasn't there to inherit), now explicit
      // since the count is persisted and would otherwise carry a stale
      // near-threshold value into the next unrelated lockout window.
      clearPinAttempts();

      // The PIN is a fast unlock on top of a real login, not a second
      // credential — once it's old enough to plausibly have expired, correct
      // digits alone must not be enough. Skip the live check entirely while
      // it's still fresh: that's the whole point of the PIN, and hitting
      // Supabase on every unlock would also break it offline.
      if (useSettingsStore.getState().isCaregiverSessionFresh()) {
        router.push('/caregiver/dashboard');
        return;
      }

      const liveStatus = await checkLiveCaregiverSession();
      if (liveStatus === 'invalid') {
        // The underlying login has actually expired — the PIN can't paper
        // over that. Send them through the real thing instead of bouncing
        // between here and a dashboard that will just bounce them again.
        router.push('/caregiver/login?next=/app');
        return;
      }
      // 'valid' or 'offline': either the login is still genuinely live, or
      // there's no way to check right now. Offline is let through rather than
      // stranding a caregiver with no connectivity — it stays unverified and
      // gets re-checked the next time this device is online.
      if (liveStatus === 'valid') useSettingsStore.getState().markCaregiverSessionVerified();
      router.push('/caregiver/dashboard');
    } finally {
      setVerifying(false);
    }
  };

  const onDigit = (digit: string) => {
    if (locked || verifying) return;
    const next = digits + digit;
    setDigits(next);
    if (next.length === PIN_LENGTH) void submitPin(next);
  };

  const onBackspace = () => {
    if (locked || verifying) return;
    setDigits((d) => d.slice(0, -1));
  };

  return (
    <div
      role="dialog"
      aria-label="Enter caregiver PIN"
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/50 p-4"
    >
      <div className="flex w-full max-w-xs flex-col items-center gap-4 rounded-tile bg-surface-card p-6">
        <h2 className="text-patient-body font-semibold text-ink">Enter Caregiver PIN</h2>

        <div aria-hidden="true" className="flex gap-3">
          {Array.from({ length: PIN_LENGTH }).map((_, i) => (
            <span
              key={i}
              className={`h-4 w-4 rounded-full ${i < digits.length ? 'bg-primary' : 'bg-surface-muted'}`}
            />
          ))}
        </div>

        {locked ? (
          <p role="status" className="text-patient-sm text-danger">
            Too many wrong attempts. Try again in {remainingSeconds}s.
          </p>
        ) : null}

        <PinPad onDigit={onDigit} onBackspace={onBackspace} disabled={locked || verifying} />

        <BigButton label="Cancel" variant="secondary" onClick={onClose} />
      </div>
    </div>
  );
}

export default function HomePage() {
  const router = useRouter();
  const { t } = useTranslation();
  const currentPatient = usePatientStore((s) => s.currentPatient);
  const [showPin, setShowPin] = useState(false);
  const { pendingReminder, clearPendingReminder } = useReminders();
  const streak = useGameStreak(currentPatient?.id ?? null);
  const [familyNote, setFamilyNote] = useState<{ id: string; text: string } | null>(null);

  // `usePatientStore` is in-memory only, so it resets on every fresh load of
  // this page — closing and reopening the tablet, a PWA relaunch, anything
  // short of the tab staying open forever. Without this, that reset showed
  // "No patient selected" and a Caregiver Login prompt even though the local
  // profile this device already trusts is sitting right there in Dexie,
  // forcing a login (and worse, onboarding if that login path failed) for no
  // reason. This only restores what already exists locally; it never talks
  // to Supabase and never blocks the render.
  //
  // `restoring` gates the "No patient selected" fallback below: without it,
  // a legitimate returning patient sees that screen (and its Caregiver Login
  // button) flash for a moment on every cold start, before the restore
  // above has had a chance to run.
  const [restoring, setRestoring] = useState(!currentPatient);

  useEffect(() => {
    if (currentPatient) {
      setRestoring(false);
      return;
    }
    let cancelled = false;
    void restoreLocalSession().finally(() => {
      if (!cancelled) setRestoring(false);
    });
    return () => {
      cancelled = true;
    };
  }, [currentPatient]);

  const onAcknowledgeReminder = async () => {
    if (pendingReminder && currentPatient) {
      await acknowledgeReminder(pendingReminder.id, currentPatient.id, 'touch');
    }
    clearPendingReminder();
  };

  // Checks once per app-open whether family left an encouragement note that
  // hasn't been shown yet. Rate limit (max 1/day) is enforced server-side in
  // GET /api/patients/[id]/surface-note — this is just the client asking.
  useEffect(() => {
    if (!currentPatient) return;
    let cancelled = false;

    getDeviceTrustToken().then((token) => {
      if (cancelled || !token || !isTokenWellFormed(token)) return;
      fetch(
        `/api/patients/${currentPatient.id}/surface-note?deviceTrustToken=${encodeURIComponent(
          JSON.stringify(token),
        )}`,
      )
        .then((res) => res.json())
        .then((body) => {
          if (!cancelled && body?.note) setFamilyNote(body.note);
        })
        .catch(() => {});
    });

    return () => {
      cancelled = true;
    };
  }, [currentPatient]);

  useEffect(() => {
    if (familyNote) speak(familyNote.text);
  }, [familyNote]);

  return (
    <main className="mx-auto flex w-full max-w-patient flex-col gap-6 bg-canvas px-4 py-6 relative">
      <button
        data-testid="caregiver-access-icon"
        aria-label="Caregiver access"
        onClick={() => setShowPin(true)}
        className="absolute top-4 right-4 h-10 w-10 rounded-full bg-primary/10 hover:bg-primary/20 transition-colors flex items-center justify-center"
        title="Caregiver dashboard"
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className="text-primary"
          aria-hidden="true"
        >
          <circle cx="12" cy="8" r="4" />
          <path d="M 12 14 C 7.58 14 4 16.69 4 20 v 2 h 16 v -2 c 0 -3.31 -3.58 -6 -8 -6 Z" />
        </svg>
      </button>

      {pendingReminder ? (
        <ReminderCard
          reminder={pendingReminder}
          onAcknowledge={() => void onAcknowledgeReminder()}
          onSnooze={clearPendingReminder}
        />
      ) : null}

      {familyNote && !pendingReminder ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="mx-4 max-w-patient rounded-tile bg-surface-card p-8 text-center shadow-2xl">
            <p className="text-4xl" aria-hidden="true">
              💌
            </p>
            <p className="mt-3 font-serif-display text-patient-heading leading-[1.05] tracking-[-0.02em] text-ink">A message for you</p>
            <p className="mt-3 text-patient-body text-ink">{familyNote.text}</p>
            <div className="mt-6">
              <BigButton label="Thank you!" variant="primary" onClick={() => setFamilyNote(null)} />
            </div>
          </div>
        </div>
      ) : null}

      <h1 className="flex items-center justify-center gap-2 text-center text-2xl font-bold text-primary">
        <Image src={appIcon} alt="" width={32} height={32} className="h-8 w-8" priority />
        SMRITI
      </h1>

      {currentPatient ? (
        <>
          <p className="text-center font-serif-display text-patient-heading text-ink">
            Hello, {currentPatient.displayName}!
          </p>
          {!streak.isLoading ? (
            <p className="text-center text-patient-body text-ink-muted" aria-live="off">
              {streak.current > 0
                ? `🔥 ${streak.current} ${t('home.streakCount')}`
                : t('home.streakStart')}
            </p>
          ) : null}
        </>
      ) : restoring ? (
        <div aria-busy="true" aria-label="Loading" className="flex flex-col items-center gap-2">
          <Skeleton height={28} width="60%" />
        </div>
      ) : (
        <div className="flex flex-col items-center gap-4">
          <p className="text-patient-body text-ink">No patient selected</p>
          <BigButton
            label="Caregiver login"
            variant="primary"
            onClick={() => router.push('/caregiver/login?next=/app')}
          />
        </div>
      )}

      {currentPatient ? <FamilyMessageBoard patientId={currentPatient.id} /> : null}

      <LanguagePicker />

      <div className="grid grid-cols-2 gap-4">
        {GAMES.map((game) => (
          <GameTile
            key={game.gameType}
            gameName={game.gameName}
            href={game.href}
            illustrationSrc={game.illustrationSrc}
            icon={game.illustrationSrc ? undefined : <RoutineRecallIcon />}
            difficultyLevel={
              ((currentPatient?.currentDifficulty[game.gameType] ?? 1) as 1 | 2 | 3)
            }
          />
        ))}
      </div>

      <div className="flex flex-col gap-3">
        <BigButton label="Ask Smriti" variant="primary" onClick={() => router.push('/companion')} />
        <BigButton label="Reminders" variant="secondary" onClick={() => router.push('/reminders')} />
        <BigButton label={t('home.myProgress')} variant="secondary" onClick={() => setShowPin(true)} />
      </div>

      {showPin ? <PinDialog onClose={() => setShowPin(false)} /> : null}
    </main>
  );
}
