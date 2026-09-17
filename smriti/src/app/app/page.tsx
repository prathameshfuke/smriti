'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import BigButton from '@/components/ui/BigButton';
import appIcon from '@/appicon.png';
import GameTile from '@/components/ui/GameTile';
import PinPad from '@/components/ui/PinPad';
import ReminderCard from '@/components/ui/ReminderCard';
import PinDots from '@/components/ui/PinDots';
import StreakFlame from '@/components/ui/StreakFlame';
import Skeleton from '@/components/ui/Skeleton';
import FamilyMessageBoard from '@/components/patient/FamilyMessageBoard';
import { useReminders } from '@/hooks/useReminders';
import { useEscapeKey } from '@/hooks/useEscapeKey';
import { useGameStreak } from '@/hooks/useGameStreak';
import { acknowledgeReminder } from '@/lib/engine/reminders';
import { getDeviceTrustToken, isTokenWellFormed } from '@/lib/auth/deviceTrust';
import {
  restoreLocalSession,
  checkLiveCaregiverSession,
  getDevicePatients,
  needsDevicePatientChoice,
  selectActivePatient,
} from '@/lib/auth/localSession';
import WhoIsPlaying from '@/components/patient/WhoIsPlaying';
import type { LocalPatient } from '@/lib/db/schema';
import { speak } from '@/lib/audio/speech';
import { usePatientStore } from '@/stores/patientStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { useTranslation } from '@/lib/i18n/provider';

const GAMES = [
  { nameKey: 'game.objectHunt.name', gameType: 'object_hunt', href: '/games/object-hunt', illustrationSrc: '/images/game-object-hunt.png' },
  { nameKey: 'game.wordStream.name', gameType: 'word_stream', href: '/games/word-stream', illustrationSrc: '/images/game-word-stream.png' },
  { nameKey: 'game.quickTap.name', gameType: 'quick_tap', href: '/games/quick-tap', illustrationSrc: '/images/game-quick-tap.png' },
  { nameKey: 'game.pathMatch.name', gameType: 'path_match', href: '/games/path-match', illustrationSrc: '/images/game-path-match.png' },
  { nameKey: 'game.memoryMatch.name', gameType: 'memory_match', href: '/games/memory-match', illustrationSrc: '/images/game-memory-match.png' },
  { nameKey: 'game.memoryBlocks.name', gameType: 'memory_blocks', href: '/games/memory-blocks', illustrationSrc: '/images/game-memory-blocks.png' },
  { nameKey: 'game.frogLeap.name', gameType: 'frog_leap', href: '/games/frog-leap', illustrationSrc: '/images/game-frog-leap.png' },
  { nameKey: 'game.countingBoxes.name', gameType: 'counting_boxes', href: '/games/counting-boxes', illustrationSrc: '/images/game-counting-boxes.png' },
  { nameKey: 'game.largerNumber.name', gameType: 'larger_number', href: '/games/larger-number', illustrationSrc: '/images/game-larger-number.png' },
  { nameKey: 'game.memorySpan.name', gameType: 'memory_span', href: '/games/memory-span', illustrationSrc: '/images/game-memory-span.png' },
  { nameKey: 'game.fishTrace.name', gameType: 'fish_trace', href: '/games/fish-trace', illustrationSrc: '/images/game-fish-trace.png' },
  { nameKey: 'game.doubleDecision.name', gameType: 'double_decision', href: '/games/double-decision', illustrationSrc: '/images/game-double-decision.png' },
  { nameKey: 'game.nBack.name', gameType: 'n_back', href: '/games/n-back', illustrationSrc: '/images/game-n-back.png' },
  {
    // Never "Memory Match: ..." — that collides with the actual Memory
    // Match pairs game above and reads as a variant of it.
    nameKey: 'game.reminiscenceQuiz.name',
    gameType: 'reminiscence_quiz',
    href: '/games/reminiscence-quiz',
    illustrationSrc: '/images/game-reminiscence-quiz.png',
  },
  {
    nameKey: 'game.routineRecall.name',
    gameType: 'routine_recall',
    href: '/games/routine-recall',
    illustrationSrc: '/images/game-routine-recall.png',
  },
] as const;

/** BCP 47 tags for the date line. Browsers without Assamese or Bodo date
 * data fall back to the nearest locale they have; the date still shows. */
const DATE_LOCALE: Record<string, string> = {
  as: 'as-IN',
  hi: 'hi-IN',
  en: 'en-IN',
  brx: 'hi-IN',
  mni: 'bn-IN',
  bn: 'bn-IN',
  ne: 'ne-NP',
};

const PIN_LENGTH = 4;

/** A shared phone asks "Who is playing?" again after this long untouched. */
const SHARED_IDLE_MS = 30 * 60_000;

function PinDialog({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const { t } = useTranslation();
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

  useEscapeKey(true, onClose);

  return (
    <div
      role="dialog"
      aria-label={t('home.pinTitle')}
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-end justify-center bg-ink/50 sm:items-center sm:p-4"
    >
      <div className="flex max-h-full w-full max-w-sm flex-col gap-5 overflow-y-auto overscroll-contain rounded-t-card bg-surface-card p-6 shadow-xl sm:rounded-card">
        <div>
          <h2 className="font-serif-display text-[1.5rem] font-medium leading-tight text-ink">{t('home.pinTitle')}</h2>
          <p className="mt-1 text-caregiver-body text-ink-muted">{t('home.pinForCaregiver')}</p>
        </div>

        <PinDots filled={digits.length} length={PIN_LENGTH} />

        {locked ? (
          <p role="status" className="text-caregiver-body font-bold text-danger">
            {t('home.pinLocked', { seconds: remainingSeconds })}
          </p>
        ) : null}

        <PinPad onDigit={onDigit} onBackspace={onBackspace} disabled={locked || verifying} />

        <button
          type="button"
          onClick={() =>
            router.push(`/caregiver/login?next=${encodeURIComponent('/caregiver/dashboard')}&resetPin=1`)
          }
          className="text-center text-caregiver-body text-ink-muted underline"
        >
          {t('home.forgotPin')}
        </button>

        <BigButton label={t('common.cancel')} variant="secondary" onClick={onClose} />
      </div>
    </div>
  );
}

export default function HomePage() {
  const router = useRouter();
  const { t, language } = useTranslation();
  const currentPatient = usePatientStore((s) => s.currentPatient);
  const [showPin, setShowPin] = useState(false);
  const { pendingReminder, pendingOccurrence, clearPendingReminder, snoozePendingReminder } = useReminders();
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

  // Who uses this phone. More than one person means a shared phone: ask who
  // is playing on open, after a long idle, and whenever someone taps "Not you?".
  const [devicePatients, setDevicePatients] = useState<LocalPatient[]>([]);
  const [needsPick, setNeedsPick] = useState(false);
  const [unassigned, setUnassigned] = useState(false);
  const [deviceChecked, setDeviceChecked] = useState(false);


  useEffect(() => {
    if (restoring) return;
    let cancelled = false;
    void Promise.all([getDevicePatients(), needsDevicePatientChoice()]).then(([patients, choice]) => {
      if (cancelled) return;
      setDevicePatients(patients);
      setUnassigned(choice);
      const current = usePatientStore.getState().currentPatient;

      if (patients.length === 0) {
        // Nobody is linked to this phone: never leave another patient's
        // profile selected behind the "choose" prompt.
        if (choice && current) usePatientStore.getState().setCurrentPatient(null);
      } else if (patients.length === 1) {
        if (current?.id !== patients[0].id) selectActivePatient(patients[0]);
      } else {
        const { activePatientId, lastActivityAt } = useSettingsStore.getState();
        const active = patients.find((p) => p.id === activePatientId);
        const idle = lastActivityAt !== null && Date.now() - lastActivityAt > SHARED_IDLE_MS;
        if (!active || idle) setNeedsPick(true);
        else if (current?.id !== active.id) selectActivePatient(active);
      }
      setDeviceChecked(true);
    });
    return () => {
      cancelled = true;
    };
  }, [restoring]);

  useEffect(() => {
    if (devicePatients.length < 2) return;
    const check = () => {
      const { lastActivityAt } = useSettingsStore.getState();
      if (lastActivityAt !== null && Date.now() - lastActivityAt > SHARED_IDLE_MS) setNeedsPick(true);
    };
    const onVisible = () => {
      if (document.visibilityState === 'visible') check();
    };
    const interval = setInterval(check, 60_000);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [devicePatients.length]);

  /**
   * Opens the caregiver area. With a PIN, the PIN dialog. Without one (it
   * can be skipped at sign-in) the PIN dialog could never succeed, so it
   * goes through email sign-in, which then offers to set a PIN.
   */
  const openCaregiver = (destination: string) => {
    if (useSettingsStore.getState().caregiverPinHash) {
      setShowPin(true);
      return;
    }
    router.push(`/caregiver/login?next=${encodeURIComponent(destination)}`);
  };

  const choosePatient = (patient: LocalPatient) => {
    selectActivePatient(patient);
    setFamilyNote(null);
    setNeedsPick(false);
  };

  const isShared = devicePatients.length > 1;
  const reminderFor = isShared
    ? devicePatients.find((p) => p.id === pendingReminder?.patientId)?.displayName
    : undefined;

  const onAcknowledgeReminder = async () => {
    // The reminder's own patient, not whoever is selected: on a shared phone
    // Hari's reminder can come up while Maya is playing.
    const patientId = pendingReminder?.patientId ?? currentPatient?.id;
    if (pendingReminder && patientId) {
      await acknowledgeReminder(pendingReminder.id, patientId, 'touch', pendingOccurrence ?? undefined);
    }
    clearPendingReminder();
  };

  // Checks once per app-open whether family left an encouragement note that
  // hasn't been shown yet. Rate limit (max 1/day) is enforced server-side in
  // GET /api/patients/[id]/surface-note — this is just the client asking.
  useEffect(() => {
    // Not until we know who is actually playing: on a shared phone the
    // restored patient may be the wrong person, and the server marks a note
    // as shown the moment it is fetched.
    if (!currentPatient || !deviceChecked || needsPick || unassigned) return;
    let cancelled = false;

    getDeviceTrustToken(currentPatient.id).then((token) => {
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
  }, [currentPatient, deviceChecked, needsPick, unassigned]);

  useEffect(() => {
    if (familyNote) speak(familyNote.text);
  }, [familyNote]);

  // Today's date, read in an effect (not during render) and refreshed each
  // minute so a tablet left on overnight rolls over to the new day.
  const [today, setToday] = useState<Date | null>(null);
  useEffect(() => {
    const tick = () => setToday(new Date());
    tick();
    const interval = setInterval(tick, 60_000);
    return () => clearInterval(interval);
  }, []);
  const todayLabel = today
    ? today.toLocaleDateString(DATE_LOCALE[language] ?? 'en-IN', { weekday: 'long', day: 'numeric', month: 'long' })
    : null;

  return (
    <main className="mx-auto flex w-full max-w-patient flex-col bg-canvas px-5 pt-4 pb-10">
      <header className="flex min-h-touch items-center justify-between gap-4">
        <p className="flex items-center gap-2.5 font-serif-display text-[1.375rem] font-medium text-ink">
          <Image src={appIcon} alt="" width={28} height={28} className="h-7 w-7" priority />
          SMRITI
        </p>
        <button
          type="button"
          data-testid="caregiver-access-icon"
          aria-label={t('home.caregiverAccess')}
          onClick={() => openCaregiver('/caregiver/dashboard')}
          className="flex min-h-touch-min items-center gap-1.5 rounded-control px-3 text-patient-sm font-bold text-ink-muted underline decoration-ink-muted/40 underline-offset-4 transition-colors hover:bg-surface-muted hover:text-ink"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/images/caregiver-access.png" alt="" className="h-5 w-5" />
          {t('home.caregiver')}
        </button>
      </header>

      {pendingReminder ? (
        <ReminderCard
          reminder={pendingReminder}
          occurrence={pendingOccurrence ?? undefined}
          onAcknowledge={() => void onAcknowledgeReminder()}
          onSnooze={snoozePendingReminder}
          forName={reminderFor}
        />
      ) : null}

      {familyNote && !pendingReminder ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="family-note-title"
          className="fixed inset-0 z-50 flex items-end justify-center bg-ink/50 p-4 sm:items-center"
        >
          <div className="max-h-full w-full max-w-patient overflow-y-auto overscroll-contain rounded-card bg-surface-card p-6 shadow-2xl sm:p-8">
            <p id="family-note-title" className="font-serif-display text-patient-heading font-medium leading-[1.1] text-ink">
              {t('home.messageForYou')}
            </p>
            <p className="mt-4 text-patient-body text-ink">{familyNote.text}</p>
            <div className="mt-8">
              <BigButton label={t('home.thankYou')} variant="primary" onClick={() => setFamilyNote(null)} />
            </div>
          </div>
        </div>
      ) : null}

      {unassigned ? (
        <section className="mt-8 flex flex-col gap-4">
          <h1 className="font-serif-display text-patient-heading font-medium text-ink">
            {t('home.chooseWhoTitle')}
          </h1>
          <p className="text-patient-body text-ink-muted">{t('home.chooseWhoBody')}</p>
          <BigButton label={t('home.caregiver')} variant="primary" onClick={() => openCaregiver('/caregiver/device?setup=1')} />
        </section>
      ) : isShared && needsPick ? (
        <WhoIsPlaying patients={devicePatients} onSelect={choosePatient} />
      ) : null}

      {unassigned || (isShared && needsPick) ? null : (
      <>
      {currentPatient ? (
        <section aria-label={t('home.today')} className="mt-8">
          <h1 className="font-serif-display text-[2.5rem] font-medium leading-[1.1] tracking-[-0.01em] text-ink">
            {t('home.greeting')}, {currentPatient.displayName}
          </h1>
          {isShared ? (
            <button
              type="button"
              onClick={() => setNeedsPick(true)}
              className="mt-2 inline-flex min-h-touch-min items-center rounded-control px-1 text-patient-body font-bold text-primary-dark underline decoration-primary/40 underline-offset-4"
            >
              {t('home.notYou').replace('{name}', currentPatient.displayName)}
            </button>
          ) : null}
          {todayLabel ? (
            <p className="mt-3 text-patient-body font-bold text-ink">
              <time dateTime={today?.toISOString().slice(0, 10)}>{todayLabel}</time>
            </p>
          ) : null}
          {!streak.isLoading ? (
            <p
              className={
                'mt-5 flex items-center gap-3 rounded-card border px-4 py-3 text-patient-body ' +
                (streak.current > 0 ? 'border-warning/40 bg-warning/5 font-bold text-ink' : 'border-line200 bg-surface-card text-ink-muted')
              }
              aria-live="off"
            >
              <StreakFlame active={streak.current > 0} size={30} />
              <span>{streak.current > 0 ? `${streak.current} ${t('home.streakCount')}` : t('home.streakStart')}</span>
            </p>
          ) : null}
        </section>
      ) : restoring ? (
        <div aria-busy="true" aria-label={t('common.loading')} className="mt-8 flex flex-col gap-3">
          <Skeleton height={44} width="75%" />
          <Skeleton height={28} width="50%" />
        </div>
      ) : (
        <section className="mt-8 flex flex-col gap-4">
          <h1 className="font-serif-display text-patient-heading font-medium text-ink">{t('home.noPatientTitle')}</h1>
          <p className="text-patient-body text-ink-muted">{t('home.noPatientBody')}</p>
          <BigButton
            label={t('home.caregiverLogin')}
            variant="primary"
            onClick={() => router.push('/caregiver/login?next=/app')}
          />
        </section>
      )}

      <div className="mt-8 flex flex-col gap-touch-gap">
        <BigButton label={t('home.askSmriti')} variant="primary" onClick={() => router.push('/companion')} />
        <BigButton label={t('home.reminders')} variant="secondary" onClick={() => router.push('/reminders')} />
      </div>

      {currentPatient ? (
        <div className="mt-10 empty:hidden">
          <FamilyMessageBoard patientId={currentPatient.id} />
        </div>
      ) : null}

      <section aria-labelledby="games-heading" className="mt-10">
        <h2 id="games-heading" className="font-serif-display text-[1.75rem] font-medium leading-tight text-ink">
          {t('home.chooseGame')}
        </h2>
        <ul className="mt-4 flex flex-col gap-3">
          {GAMES.map((game) => (
            <li key={game.gameType}>
              <GameTile
                gameName={t(game.nameKey)}
                href={game.href}
                illustrationSrc={game.illustrationSrc}
                difficultyLevel={((currentPatient?.currentDifficulty[game.gameType] ?? 1) as 1 | 2 | 3)}
              />
            </li>
          ))}
        </ul>
      </section>

      <div className="mt-10 border-t border-line200 pt-6">
        <BigButton label={t('home.myProgress')} variant="secondary" onClick={() => openCaregiver('/caregiver/dashboard')} />
      </div>
      </>
      )}

      {showPin ? <PinDialog onClose={() => setShowPin(false)} /> : null}
    </main>
  );
}
