'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useTranslations, useLocale } from 'next-intl';
import { Trophy, RotateCcw } from 'lucide-react';
import confetti from 'canvas-confetti';
import { narrate } from '@/lib/audio/narrate';
import { speak, GAME_SPEECH_RATE } from '@/lib/audio/speech';
import { matchSpokenWords, useVoiceInput } from '@/lib/audio/voiceInput';
import { useOfflineStatus } from '@/hooks/useOfflineStatus';
import { useTapSelect } from '@/hooks/useTapSelect';
import { isUILanguage } from '@/lib/i18n/languages';
import { starsFromRate } from '@/lib/engine/scoring';
import { slower } from '@/lib/games/pacing';

type GameState = 'instruction' | 'presentation' | 'recall' | 'setup' | 'results';

interface Demographics {
  ageGroup: string;
  gender: 'male' | 'female' | 'other' | '';
}

interface GameResults {
  wordsRecalled: string[];
  correctWords: string[];
  score: number;
  percentile?: number;
  timeSpent: number;
}

export interface MemoryTestGameProps {
  /** Bridges completion into this app's telemetry/difficulty engine — added glue, not part of the original game logic. */
  onComplete?: (score: number) => void;
}

/** Gap between words when reading the list aloud. Slowed 20% (pacing.SLOWDOWN) per clinical feedback. */
const WORD_READ_MS = slower(1800);

/** Word tiles: fixed 2 columns on phones, and text wraps inside the tile
 * instead of spilling out of it (issue #4: "umbrella" overflowed its box). */
const WORD_GRID_CLASS = 'grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 max-w-3xl mx-auto';

export default function MemoryTestGame({ onComplete }: MemoryTestGameProps) {
  const t = useTranslations('games.freeShortTermMemoryTest');
  const locale = useLocale();
  const language = isUILanguage(locale) ? locale : 'en';
  const { isOnline } = useOfflineStatus();
  const tapSelect = useTapSelect();

  // Get word bank from translations
  const wordBank = t.raw('wordBank') as string[];
  
  const [gameState, setGameState] = useState<GameState>('presentation');
  const [currentWords, setCurrentWords] = useState<string[]>([]);
  const [userInputs, setUserInputs] = useState<string[]>(Array(12).fill(''));
  const [demographics, setDemographics] = useState<Demographics>({ ageGroup: '', gender: '' });
  const [results, setResults] = useState<GameResults | null>(null);
  const [startTime, setStartTime] = useState(0);
  /** Index of the word being read aloud, or -1. */
  const [speakingIndex, setSpeakingIndex] = useState(-1);
  const readTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const [heard, setHeard] = useState('');

  const stopReading = useCallback(() => {
    readTimersRef.current.forEach(clearTimeout);
    readTimersRef.current = [];
    setSpeakingIndex(-1);
  }, []);

  useEffect(() => stopReading, [stopReading]);

  /** Reads every word aloud one at a time, highlighting the tile being read. */
  const readWordsAloud = useCallback(() => {
    stopReading();
    currentWords.forEach((word, i) => {
      readTimersRef.current.push(
        setTimeout(() => {
          setSpeakingIndex(i);
          speak(word, language, GAME_SPEECH_RATE);
        }, i * WORD_READ_MS),
      );
    });
    readTimersRef.current.push(setTimeout(() => setSpeakingIndex(-1), currentWords.length * WORD_READ_MS));
  }, [currentWords, language, stopReading]);

  // Spoken answers fill the next empty boxes with the words recognised.
  const onSpokenText = useCallback(
    (text: string) => {
      setHeard(text);
      const matched = matchSpokenWords(text, currentWords);
      setUserInputs((prev) => {
        const next = [...prev];
        const already = new Set(next.map((v) => v.trim().toLowerCase()));
        for (const word of matched) {
          if (already.has(word.toLowerCase())) continue;
          const slot = next.findIndex((v) => v.trim() === '');
          if (slot === -1) break;
          next[slot] = word;
          already.add(word.toLowerCase());
        }
        return next;
      });
    },
    [currentWords],
  );
  const voice = useVoiceInput(language, isOnline, onSpokenText);

  // Generate words on client side to avoid hydration mismatch
  useEffect(() => {
    if (wordBank.length > 0 && currentWords.length === 0) {
      const shuffled = [...wordBank].sort(() => Math.random() - 0.5);
      setCurrentWords(shuffled.slice(0, 12));
    }
  }, [wordBank, currentWords.length]);

  // Narrate the instructions aloud whenever the word-presentation screen is
  // (re)entered — this game's instruction moment, mirroring how the app's
  // original games speak their instruction text on entry.
  useEffect(() => {
    if (gameState !== 'presentation') return;
    void narrate(`${t('memorizeTheseWords')} ${t('studyAtYourPace')}`, language, isOnline, GAME_SPEECH_RATE);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameState]);

  const stars = results ? starsFromRate(results.score / 100) : 1;

  const proceedToRecall = useCallback(() => {
    stopReading();
    setGameState('recall');
    setStartTime(Date.now());
  }, [stopReading]);

  const submitRecall = useCallback(() => {
    voice.stop();
    const timeSpent = (Date.now() - startTime) / 1000;
    const userWords = userInputs
      .map((input: string) => input.toLowerCase().trim())
      .filter((word: string) => word.length > 0);

    const correctWords = currentWords.filter((phrase: string) => 
      userWords.some((userWord: string) => {
        // Allow partial matches and flexible matching
        const normalizedPhrase = phrase.toLowerCase().replace(/\s+/g, '');
        const normalizedUser = userWord.replace(/\s+/g, '');
        return normalizedPhrase.includes(normalizedUser) || 
               normalizedUser.includes(normalizedPhrase) ||
               phrase.toLowerCase().split(' ').some((word: string) => word === userWord);
      })
    );

    const score = Math.round((correctWords.length / currentWords.length) * 100);

    setResults({
      wordsRecalled: userWords,
      correctWords,
      score,
      timeSpent
    });

    setGameState('setup');
  }, [userInputs, currentWords, startTime, voice]);

  const calculatePercentile = useCallback((score: number, ageGroup: string, gender: string) => {
    // Simplified percentile calculation based on research approximations
    // This is a basic implementation - in real world, you'd use proper normative data
    let basePercentile = score;
    
    // Age group adjustments (younger people typically perform better)
    if (ageGroup === 'under-18') basePercentile -= 8;
    else if (ageGroup === '18-25') basePercentile -= 5;
    else if (ageGroup === '65+') basePercentile += 10;
    else if (ageGroup === '46-65') basePercentile += 5;
    
    // Gender adjustments are minimal in most memory research
    if (gender === 'female') basePercentile += 2; // Slight advantage in verbal memory
    
    return Math.max(1, Math.min(99, basePercentile));
  }, []);

  const submitDemographics = useCallback(() => {
    if (results && demographics.ageGroup && demographics.gender) {
      const percentile = calculatePercentile(results.score, demographics.ageGroup, demographics.gender);
      
      setResults({
        ...results,
        percentile
      });
    }
    
    setGameState('results');
    if (results) onComplete?.(results.score);

    // Celebrate if score is good
    if (results && results.score >= 70) {
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 }
      });
    }
  }, [results, demographics, calculatePercentile, onComplete]);



  const updateUserInput = useCallback((index: number, value: string) => {
    const newInputs = [...userInputs];
    newInputs[index] = value;
    setUserInputs(newInputs);
  }, [userInputs]);

  const resetGame = useCallback(() => {
    // Generate new words and start fresh
    const shuffled = [...wordBank].sort(() => Math.random() - 0.5);
    setCurrentWords(shuffled.slice(0, 12));
    setGameState('presentation');
    setUserInputs(Array(12).fill(''));
    setDemographics({ ageGroup: '', gender: '' });
    setResults(null);
    setStartTime(0);
    setHeard('');
  }, [wordBank]);

  // Show loading state until words are generated
  if (currentWords.length === 0) {
    return (
      <div className="w-full max-w-4xl mx-auto p-4">
        <div className="text-center space-y-4">
          <div className="text-patient-body font-medium text-ink">Loading...</div>
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-4xl mx-auto p-4">
      <div className="space-y-8">
        {gameState === 'presentation' && (
            <div className="text-center space-y-8">
              <div className="space-y-3">
                <div className="font-serif-display text-patient-heading text-primary">
                  {t('memorizeTheseWords')}
                </div>
                <p className="text-patient-body text-ink-muted max-w-md mx-auto">
                  {t('studyAtYourPace')}
                </p>
              </div>

              <div>
                <Button
                  variant="outline"
                  onClick={speakingIndex >= 0 ? stopReading : readWordsAloud}
                  className="rounded-tile px-6 text-patient-body"
                  data-testid="memory-span-read-aloud"
                >
                  {speakingIndex >= 0 ? t('voice.stopReading') : `🔊 ${t('voice.hearWords')}`}
                </Button>
              </div>

              <div className={WORD_GRID_CLASS}>
                {currentWords.map((phrase, index) => (
                  <div
                    key={index}
                    className={
                      'flex min-h-[4.5rem] min-w-0 items-center justify-center rounded-tile border px-2 py-3 text-center font-medium transition-all duration-200 ' +
                      (speakingIndex === index ? 'border-primary bg-primary/10 shadow-md' : 'border-line200 bg-surface-card')
                    }
                  >
                    <span className="min-w-0 text-patient-body leading-tight text-ink [overflow-wrap:anywhere]">
                      {phrase}
                    </span>
                  </div>
                ))}
              </div>

              <div className="pt-6">
                <Button
                  onClick={proceedToRecall}
                  size="lg"
                  className="px-8 py-3"
                >
                  {t('ready')}
                </Button>
              </div>
            </div>
          )}

          {gameState === 'recall' && (
            <div className="space-y-8">
              <div className="text-center space-y-3">
                <h3 className="font-serif-display text-patient-heading text-ink">
                  {t('recall.title')}
                </h3>
                <p className="text-patient-body text-ink-muted max-w-lg mx-auto">
                  {t('recall.gridInstruction')}
                </p>
              </div>

              <div className="space-y-4">
                <div className="text-center">
                  <Label className="text-patient-body font-medium text-ink">{t('recall.inputLabel')}</Label>
                </div>
                {voice.supported ? (
                  <div className="flex flex-col items-center gap-2">
                    <Button
                      onClick={voice.status === 'listening' ? voice.stop : () => void voice.start()}
                      disabled={voice.status === 'transcribing'}
                      size="lg"
                      className={
                        'rounded-full px-8 py-3 text-patient-body ' +
                        (voice.status === 'listening' ? 'animate-pulse motion-reduce:animate-none' : '')
                      }
                      data-testid="memory-span-mic"
                    >
                      {voice.status === 'listening' ? `⏹ ${t('voice.stopListening')}` : `🎤 ${t('voice.sayWords')}`}
                    </Button>
                    <p role="status" aria-live="polite" className="min-h-[1.5rem] text-patient-sm text-ink-muted">
                      {voice.status === 'listening'
                        ? t('voice.listening')
                        : voice.status === 'transcribing'
                          ? t('voice.transcribing')
                          : voice.status === 'error'
                            ? t('voice.error')
                            : heard
                              ? t('voice.heard', { text: heard })
                              : ''}
                    </p>
                  </div>
                ) : null}
                <div className={WORD_GRID_CLASS}>
                  {userInputs.map((input, index) => (
                    <Input
                      key={index}
                      value={input}
                      onChange={(e) => updateUserInput(index, e.target.value)}
                      className="min-w-0 text-center text-patient-body h-14 rounded-tile bg-surface-card border border-line200 hover:shadow-md transition-all duration-200 focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-primary"
                      style={{ animationDelay: `${index * 50}ms` }}
                    />
                  ))}
                </div>
              </div>

              <div className="text-center pt-4">
                <Button
                  onClick={submitRecall}
                  size="lg"
                  disabled={userInputs.every(input => input.trim().length === 0)}
                  className="px-8 py-3 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {t('submitRecall')}
                </Button>
              </div>
            </div>
          )}

          {gameState === 'setup' && (
            <div className="space-y-8">
              <div className="text-center space-y-3">
                <h3 className="font-serif-display text-patient-heading text-ink">
                  {t('setup.title')}
                </h3>
                <p className="text-patient-body text-ink-muted max-w-lg mx-auto">
                  {t('setup.description')}
                </p>
              </div>

              <div className="bg-surface-card rounded-panel p-8 max-w-2xl mx-auto border-2 border-primary/20">
                <div className="space-y-8">
                  {/* Age Group Section */}
                  <div className="space-y-4">
                    <Label className="text-patient-body font-bold text-primary block text-center">{t('setup.ageGroup')}</Label>
                                         <div className="grid grid-cols-3 gap-3">
                       {[
                         { value: "under-18", label: t('setup.ageUnder18'), emoji: "" },
                         { value: "18-25", label: t('setup.age18to25'), emoji: "" },
                         { value: "26-45", label: t('setup.age26to45'), emoji: "" },
                         { value: "46-65", label: t('setup.age46to65'), emoji: "⭐" },
                         { value: "65+", label: t('setup.age65plus'), emoji: "" }
                       ].map((age) => {
                        const tap = tapSelect(() => setDemographics({ ...demographics, ageGroup: age.value }));
                        return (
                        <div
                          key={age.value}
                          {...tap}
                          style={tap.style}
                          className={`relative cursor-pointer group transition-all duration-200 ${
                            demographics.ageGroup === age.value
                              ? 'scale-105'
                              : 'hover:scale-102'
                          }`}
                        >
                          <div className={`
                            p-4 rounded-tile border-2 text-center transition-all duration-200
                            ${demographics.ageGroup === age.value
                              ? 'bg-primary border-primary text-ink-inverse shadow-md'
                              : 'bg-surface-card border-line200 hover:border-primary hover:shadow-sm'
                            }
                          `}>
                            <div className="text-2xl mb-2">{age.emoji}</div>
                            <div className="font-semibold text-patient-sm">{age.label}</div>
                          </div>
                          {demographics.ageGroup === age.value && (
                            <div className="absolute -top-1 -right-1 w-6 h-6 bg-primary-dark rounded-full flex items-center justify-center">
                              <span className="text-ink-inverse text-xs font-bold"></span>
                            </div>
                          )}
                        </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Gender Section */}
                  <div className="space-y-4">
                    <Label className="text-patient-body font-bold text-primary block text-center">{t('setup.gender')}</Label>
                    <div className="grid grid-cols-3 gap-3">
                      {[
                        { value: "male", label: t('setup.male'), emoji: "" },
                        { value: "female", label: t('setup.female'), emoji: "" },
                        { value: "other", label: t('setup.other'), emoji: "" }
                      ].map((gender) => {
                        const tap = tapSelect(() => setDemographics({ ...demographics, gender: gender.value as Demographics['gender'] }));
                        return (
                        <div
                          key={gender.value}
                          {...tap}
                          style={tap.style}
                          className={`relative cursor-pointer group transition-all duration-200 ${
                            demographics.gender === gender.value
                              ? 'scale-105'
                              : 'hover:scale-102'
                          }`}
                        >
                          <div className={`
                            p-4 rounded-tile border-2 text-center transition-all duration-200
                            ${demographics.gender === gender.value
                              ? 'bg-primary border-primary text-ink-inverse shadow-md'
                              : 'bg-surface-card border-line200 hover:border-primary hover:shadow-sm'
                            }
                          `}>
                            <div className="text-2xl mb-2">{gender.emoji}</div>
                            <div className="font-semibold text-patient-sm">{gender.label}</div>
                          </div>
                          {demographics.gender === gender.value && (
                            <div className="absolute -top-1 -right-1 w-6 h-6 bg-primary-dark rounded-full flex items-center justify-center">
                              <span className="text-ink-inverse text-xs font-bold"></span>
                            </div>
                          )}
                        </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex justify-center pt-4">
                <Button
                  onClick={submitDemographics}
                  disabled={!demographics.ageGroup || !demographics.gender}
                  size="lg"
                  className="px-10 py-4 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {t('setup.submit')}
                </Button>
              </div>
            </div>
          )}

          {gameState === 'results' && results && (
            <div className="space-y-8">
              <div className="text-center space-y-4">
                <div className="relative">
                  <Trophy className="w-20 h-20 mx-auto text-primary" />
                  <div className="absolute -top-2 -right-2 w-8 h-8 bg-primary rounded-full flex items-center justify-center text-ink-inverse font-bold text-sm">
                    {results.score}
                  </div>
                </div>
                <h3 className="font-serif-display text-patient-heading text-ink">
                  {t('results.title')}
                </h3>
                <p className="text-4xl text-primary" aria-hidden="true">
                  {'⭐'.repeat(stars)}
                  {'☆'.repeat(5 - stars)}
                </p>
                <p className="text-patient-body text-ink-muted">
                  {results.score >= 80 ? t('results.excellent') :
                   results.score >= 60 ? t('results.good') :
                   t('results.keepPracticing')}
                </p>
              </div>

              <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
                <Card className="bg-surface-card border-line200">
                  <CardHeader>
                    <CardTitle className="font-serif-display text-patient-body text-ink">
                      {t('results.performance')}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex justify-between items-center p-3 bg-surface-muted rounded-control">
                      <span className="font-medium text-ink">{t('results.wordsRecalled')}:</span>
                      <span className="font-bold text-xl text-primary">{results.correctWords.length}/12</span>
                    </div>
                    <div className="flex justify-between items-center p-3 bg-surface-muted rounded-control">
                      <span className="font-medium text-ink">{t('results.accuracy')}:</span>
                      <span className="font-bold text-xl text-success">{results.score}%</span>
                    </div>
                    <div className="flex justify-between items-center p-3 bg-surface-muted rounded-control">
                      <span className="font-medium text-ink">{t('results.timeSpent')}:</span>
                      <span className="font-bold text-xl text-ink">{Math.round(results.timeSpent)}s</span>
                    </div>
                    {results.percentile && (
                      <div className="flex justify-between items-center p-3 bg-surface-muted rounded-control border-2 border-primary/20">
                        <span className="font-medium text-ink">{t('results.percentile')}:</span>
                        <span className="font-bold text-xl text-primary">{results.percentile}th</span>
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card className="bg-surface-card border-line200">
                  <CardHeader>
                    <CardTitle className="font-serif-display text-patient-body text-ink">
                      {t('results.correctWords')}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {results.correctWords.length > 0 ? (
                        results.correctWords.map((word, index) => (
                          <div
                            key={index}
                            className="flex items-center gap-3 px-3 py-2 bg-success/10 rounded-control"
                            style={{ animationDelay: `${index * 100}ms` }}
                          >
                            <div className="w-6 h-6 bg-success rounded-full flex items-center justify-center">
                              <span className="text-ink-inverse text-sm font-bold"></span>
                            </div>
                            <span className="font-medium text-ink">{word}</span>
                          </div>
                        ))
                      ) : (
                        <div className="text-center py-4">
                          <p className="text-patient-sm text-ink-muted">{t('results.noMatches')}</p>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Encouragement Section */}
              <div className="bg-surface-card rounded-panel p-6 max-w-4xl mx-auto border border-line200">
                <div className="text-center space-y-4">
                  <h4 className="font-serif-display text-patient-body text-ink">
                    {t('results.encouragement')}
                  </h4>
                  <p className="text-patient-body text-ink-muted max-w-2xl mx-auto">
                    {t('results.trainingTip')}
                  </p>
                </div>
              </div>

              <div className="text-center pt-4">
                <Button
                  onClick={resetGame}
                  size="lg"
                  className="px-8 py-3 gap-3"
                >
                  <RotateCcw className="w-5 h-5" />
                  {t('tryAgain')}
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  } 