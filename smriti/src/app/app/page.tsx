'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import BigButton from '@/components/ui/BigButton';
import appIcon from '@/appicon.png';
import GameTile from '@/components/ui/GameTile';
import LanguagePicker from '@/components/layout/LanguagePicker';
import PinPad from '@/components/ui/PinPad';
import ReminderCard, { REMINDER_ICON } from '@/components/ui/ReminderCard';
import FamilyMessageBoard from '@/components/patient/FamilyMessageBoard';
import { useReminders } from '@/hooks/useReminders';
import { acknowledgeReminder } from '@/lib/engine/reminders';
import { getDeviceTrustToken, isTokenWellFormed } from '@/lib/auth/deviceTrust';
import { restoreLocalSession } from '@/lib/auth/localSession';
import { speak } from '@/lib/audio/speech';
import { usePatientStore } from '@/stores/patientStore';
import { useSettingsStore } from '@/stores/settingsStore';

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

const MAX_PIN_ATTEMPTS = 3;
const COOLDOWN_SECONDS = 30;
const PIN_LENGTH = 4;

function PinDialog({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const verifyPin = useSettingsStore((s) => s.verifyPin);

  const [digits, setDigits] = useState('');
  const [, setAttempts] = useState(0);
  const [cooldown, setCooldown] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  useEffect(() => {
    if (cooldown <= 0 && intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, [cooldown]);

  const startCooldown = () => {
    setCooldown(COOLDOWN_SECONDS);
    intervalRef.current = setInterval(() => {
      setCooldown((s) => Math.max(0, s - 1));
    }, 1000);
  };

  const submitPin = async (candidate: string) => {
    const ok = await verifyPin(candidate);
    if (ok) {
      router.push('/caregiver/dashboard');
      return;
    }
    setDigits('');
    setAttempts((prev) => {
      const next = prev + 1;
      if (next >= MAX_PIN_ATTEMPTS) startCooldown();
      return next;
    });
  };

  const onDigit = (digit: string) => {
    if (cooldown > 0) return;
    const next = digits + digit;
    setDigits(next);
    if (next.length === PIN_LENGTH) void submitPin(next);
  };

  const onBackspace = () => {
    if (cooldown > 0) return;
    setDigits((d) => d.slice(0, -1));
  };

  const locked = cooldown > 0;

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
            Too many wrong attempts. Try again in {cooldown}s.
          </p>
        ) : null}

        <PinPad onDigit={onDigit} onBackspace={onBackspace} disabled={locked} />

        <BigButton label="Cancel" variant="secondary" onClick={onClose} />
      </div>
    </div>
  );
}

export default function HomePage() {
  const router = useRouter();
  const currentPatient = usePatientStore((s) => s.currentPatient);
  const [showPin, setShowPin] = useState(false);
  const { pendingReminder, clearPendingReminder } = useReminders();
  const [familyNote, setFamilyNote] = useState<{ id: string; text: string } | null>(null);

  // `usePatientStore` is in-memory only, so it resets on every fresh load of
  // this page — closing and reopening the tablet, a PWA relaunch, anything
  // short of the tab staying open forever. Without this, that reset showed
  // "No patient selected" and a Caregiver Login prompt even though the local
  // profile this device already trusts is sitting right there in Dexie,
  // forcing a login (and worse, onboarding if that login path failed) for no
  // reason. This only restores what already exists locally; it never talks
  // to Supabase and never blocks the render.
  useEffect(() => {
    if (currentPatient) return;
    void restoreLocalSession();
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
        className="absolute top-4 right-4 h-10 w-10 rounded-full bg-teal/10 hover:bg-teal/20 transition-colors flex items-center justify-center"
        title="Caregiver dashboard"
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className="text-teal"
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
            <p className="mt-3 font-serif-display text-patient-heading text-ink">A message for you</p>
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
        <p className="text-center text-patient-heading text-ink">
          Hello, {currentPatient.displayName}!
        </p>
      ) : (
        <div className="flex flex-col items-center gap-4">
          <p className="text-patient-body text-ink">No patient selected</p>
          <BigButton
            label="Caregiver Login"
            variant="primary"
            onClick={() => router.push('/caregiver/login')}
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
        <BigButton label="My Progress" variant="secondary" onClick={() => setShowPin(true)} />
      </div>

      {showPin ? <PinDialog onClose={() => setShowPin(false)} /> : null}
    </main>
  );
}
