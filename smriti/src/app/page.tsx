'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import BigButton from '@/components/ui/BigButton';
import GameTile from '@/components/ui/GameTile';
import LanguagePicker from '@/components/layout/LanguagePicker';
import PinPad from '@/components/ui/PinPad';
import ReminderCard from '@/components/ui/ReminderCard';
import SyncIndicator from '@/components/ui/SyncIndicator';
import { useReminders } from '@/hooks/useReminders';
import { acknowledgeReminder } from '@/lib/engine/reminders';
import { usePatientStore } from '@/stores/patientStore';
import { useSettingsStore } from '@/stores/settingsStore';

const GAMES = [
  { gameName: 'Object Hunt', gameType: 'object_hunt', href: '/games/object-hunt', illustrationSrc: '/images/game-object-hunt.svg' },
  { gameName: 'Word Stream', gameType: 'word_stream', href: '/games/word-stream', illustrationSrc: '/images/game-word-stream.svg' },
  { gameName: 'Quick Tap', gameType: 'quick_tap', href: '/games/quick-tap', illustrationSrc: '/images/game-quick-tap.svg' },
  { gameName: 'Path Match', gameType: 'path_match', href: '/games/path-match', illustrationSrc: '/images/game-path-match.svg' },
] as const;

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

  const onAcknowledgeReminder = async () => {
    if (pendingReminder && currentPatient) {
      await acknowledgeReminder(pendingReminder.id, currentPatient.id, 'touch');
    }
    clearPendingReminder();
  };

  return (
    <main className="mx-auto flex w-full max-w-patient flex-col gap-6 bg-surface px-4 py-6">
      {pendingReminder ? (
        <ReminderCard
          reminder={pendingReminder}
          onAcknowledge={() => void onAcknowledgeReminder()}
          onSnooze={clearPendingReminder}
        />
      ) : null}

      <h1 className="text-center text-2xl font-bold text-primary">SMRITI</h1>

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

      <LanguagePicker />

      <div className="grid grid-cols-2 gap-4">
        {GAMES.map((game) => (
          <GameTile
            key={game.gameType}
            gameName={game.gameName}
            href={game.href}
            illustrationSrc={game.illustrationSrc}
            difficultyLevel={
              ((currentPatient?.currentDifficulty[game.gameType] ?? 1) as 1 | 2 | 3)
            }
          />
        ))}
      </div>

      <div className="flex flex-col gap-3">
        <BigButton label="Reminders" variant="secondary" onClick={() => router.push('/reminders')} />
        <BigButton label="My Progress" variant="secondary" onClick={() => setShowPin(true)} />
      </div>

      {showPin ? <PinDialog onClose={() => setShowPin(false)} /> : null}

      <SyncIndicator status="synced" />
    </main>
  );
}
