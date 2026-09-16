'use client';

import { useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import BigButton from '@/components/ui/BigButton';
import SessionComplete from '@/components/games/SessionComplete';
import { starsFromRate } from '@/lib/engine/scoring';
import { speak, GAME_SPEECH_RATE } from '@/lib/audio/speech';
import { isUILanguage } from '@/lib/i18n/languages';
import { TOUCH_TARGET_MIN_PX } from '@/components/ui/touchTarget';
import { useTapSelect } from '@/hooks/useTapSelect';
import type { LocalReminiscenceQuiz } from '@/lib/db/schema';

export interface ReminiscenceQuizGameProps {
  quiz: LocalReminiscenceQuiz;
  /** Photo for the entry each question is about, keyed by `entryTitle`. */
  entryPhotos: Record<string, string | null>;
  onComplete: (accuracyPct: number) => void;
  onGoHome: () => void;
}

/**
 * A miss here is never framed as wrong — there's no red styling or
 * "incorrect" text anywhere in this component, only a warm nudge and the
 * reveal. `SessionComplete` already guarantees at least 1 star and has no
 * fail-vocabulary in its own copy; this component just needs to hold that
 * same discipline for the one moment the other games don't have — an
 * answer reveal.
 */
export default function ReminiscenceQuizGame({ quiz, entryPhotos, onComplete, onGoHome }: ReminiscenceQuizGameProps) {
  const t = useTranslations('games.reminiscenceQuiz.gameUI');
  const locale = useLocale();
  const language = isUILanguage(locale) ? locale : 'en';
  const tapSelect = useTapSelect();
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [correctCount, setCorrectCount] = useState(0);
  const [done, setDone] = useState(false);

  const question = quiz.questions[index];
  const isLast = index + 1 >= quiz.questions.length;
  const photoUrl = question ? entryPhotos[question.entryTitle] : null;

  const selectOption = (i: number) => {
    if (selected !== null) return;
    setSelected(i);
    const isCorrect = i === question.correctIndex;
    if (isCorrect) setCorrectCount((c) => c + 1);
    speak(isCorrect ? t('correct') : t('tryTogether'), language, GAME_SPEECH_RATE);
  };

  const advance = () => {
    if (isLast) {
      setDone(true);
      onComplete((correctCount / quiz.questions.length) * 100);
      return;
    }
    setIndex((i) => i + 1);
    setSelected(null);
  };

  if (done) {
    return (
      <SessionComplete
        gameType="reminiscence_quiz"
        stars={starsFromRate(correctCount / quiz.questions.length)}
        correctCount={correctCount}
        totalCount={quiz.questions.length}
        onGoHome={onGoHome}
      />
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-patient flex-1 flex-col gap-6 bg-canvas px-4 py-6">
      {photoUrl ? (
        // Real alt text, unlike GameTile's decorative illustrations — this
        // photo is the content the question is about, not decoration.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={photoUrl} alt={question.entryTitle} className="mx-auto h-40 w-40 rounded-full object-cover" />
      ) : null}

      <p className="text-center font-serif-display text-patient-heading text-ink">{question.question}</p>

      <div className="flex flex-col gap-3">
        {question.options.map((option, i) => {
          const isChosen = selected === i;
          const isCorrectOption = i === question.correctIndex;
          const revealClass =
            selected === null
              ? ''
              : isCorrectOption
                ? 'ring-4 ring-success'
                : isChosen
                  ? 'ring-4 ring-primary/40'
                  : 'opacity-60';
          const tap = tapSelect(() => selectOption(i), selected === null);
          return (
            <button
              key={option}
              type="button"
              disabled={selected !== null}
              {...tap}
              style={{ ...tap.style, minHeight: TOUCH_TARGET_MIN_PX }}
              className={`rounded-tile border border-line200 bg-white px-4 text-patient-body font-semibold text-ink ${revealClass}`}
            >
              {option}
            </button>
          );
        })}
      </div>

      {selected !== null ? (
        <>
          <p className="text-center text-patient-body text-ink-muted">
            {selected === question.correctIndex ? t('correct') : t('tryTogether')}
          </p>
          <BigButton label={isLast ? t('finish') : t('next')} variant="primary" onClick={advance} />
        </>
      ) : null}
    </div>
  );
}
