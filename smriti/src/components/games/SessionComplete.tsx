'use client';

import { useEffect, useState } from 'react';
import BigButton from '@/components/ui/BigButton';
import { narrate } from '@/lib/audio/narrate';
import { GAME_SPEECH_RATE } from '@/lib/audio/speech';
import { useTranslation } from '@/lib/i18n/provider';
import { useOfflineStatus } from '@/hooks/useOfflineStatus';
import type { GameType } from '@/lib/supabase/types';

export interface SessionCompleteProps {
  gameType: GameType;
  stars: number;
  correctCount: number;
  totalCount: number;
  /** Extra picks/taps on things that were not asked for; shown only when > 0. */
  wrongCount?: number;
  onGoHome: () => void;
}

/**
 * Messages never use a fail/error vocabulary — a low-star session is still
 * framed as progress, never as a mistake the patient made.
 */
const ENCOURAGEMENT_KEY: Record<number, string> = {
  5: 'game.sessionEnd.star5',
  4: 'game.sessionEnd.star4',
  3: 'game.sessionEnd.star3',
  2: 'game.sessionEnd.star2',
  1: 'game.sessionEnd.star1',
};

const GREETING_VARIANTS = 3;
const BADGES = ['🎉', '🌟', '🏆', '🌼', '👏'];
const CONFETTI_COLORS = ['#C9A227', '#E07A5F', '#81B29A', '#3D85C6', '#F2CC8F'];

/** A random headline, badge and confetti layout for one completion screen. */
function buildCelebration() {
  return {
    greetingKey: `game.celebrate.${Math.floor(Math.random() * GREETING_VARIANTS)}`,
    badge: BADGES[Math.floor(Math.random() * BADGES.length)],
    confetti: Array.from({ length: 24 }, (_, i) => ({
      left: Math.random() * 100,
      delay: Math.random() * 0.8,
      duration: 2.2 + Math.random() * 1.4,
      color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
      round: i % 3 === 0,
    })),
  };
}

export default function SessionComplete({
  stars,
  correctCount,
  totalCount,
  wrongCount = 0,
  onGoHome,
}: SessionCompleteProps) {
  const { t, language } = useTranslation();
  const { isOnline } = useOfflineStatus();
  const safeStars = Math.max(1, Math.min(5, Math.round(stars)));
  const message = t(ENCOURAGEMENT_KEY[safeStars]);

  // Picked once per screen so the headline and badge don't change on re-render.
  const [{ greetingKey, badge, confetti }] = useState(buildCelebration);

  useEffect(() => {
    void narrate(message, language, isOnline, GAME_SPEECH_RATE);
    // Speak once, when this screen appears.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="relative flex min-h-dvh flex-col justify-center overflow-hidden bg-surface px-6 py-10">
      <div className="pointer-events-none absolute inset-0 motion-reduce:hidden" aria-hidden="true" data-testid="celebration-confetti">
        {confetti.map((c, i) => (
          <span
            key={i}
            className={'absolute top-0 block h-3 w-2 ' + (c.round ? 'rounded-full' : 'rounded-sm')}
            style={{
              left: `${c.left}%`,
              backgroundColor: c.color,
              opacity: 0,
              animation: `smriti-confetti-fall ${c.duration}s ease-in ${c.delay}s 1 forwards`,
            }}
          />
        ))}
      </div>

      <div className="relative mx-auto flex w-full max-w-patient flex-col gap-6">
        {/* Wraps, and the headline may shrink: at Large text a long Assamese
            greeting beside the badge was wider than a 320px screen. */}
        <div
          className="flex flex-wrap items-center gap-4"
          style={{ animation: 'smriti-badge-pop 600ms ease-out 1 both' }}
        >
          <span className="text-6xl leading-none" aria-hidden="true">
            {badge}
          </span>
          <p className="min-w-0 break-words font-serif-display text-patient-heading font-semibold text-primary">{t(greetingKey)}</p>
        </div>
        <div role="img" aria-label={t('game.starsLabel', { count: safeStars })} className="flex flex-wrap gap-2">
          {Array.from({ length: 5 }, (_, i) => (
            <Star key={i} filled={i < safeStars} />
          ))}
        </div>
        <div className="min-w-0 break-words">
          <p className="font-serif-display text-patient-heading font-medium text-ink">
            {t('game.outOfCorrect', { count: correctCount, total: totalCount })}
          </p>
          {wrongCount > 0 ? (
            <p className="mt-1 text-patient-body text-ink-muted">{t('game.extraTaps', { count: wrongCount })}</p>
          ) : null}
          <p className="mt-3 text-patient-body text-ink-muted">{message}</p>
        </div>
        <BigButton label={t('game.backToHome')} variant="primary" onClick={onGoHome} />
      </div>
    </div>
  );
}

/** Five-point star, muga gold. The gold outline on empty stars keeps the
 * count of five visible, so one star reads as "one of five", not "one". */
function Star({ filled }: { filled: boolean }) {
  return (
    <svg width="44" height="44" viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M12 2.8l2.8 5.7 6.3.9-4.55 4.43 1.07 6.27L12 17.13 6.38 20.1l1.07-6.27L2.9 9.4l6.3-.9L12 2.8z"
        fill={filled ? '#C9A227' : 'none'}
        stroke={filled ? '#8B6914' : '#C9A227'}
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}
