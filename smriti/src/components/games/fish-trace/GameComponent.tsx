'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { motion, AnimatePresence } from 'framer-motion';
import { useFishEngine, getLevelParams, GamePhase } from './hooks/useFishEngine';
import { SunfishSVG } from './SunfishSVG';
import { Settings } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { TOUCH_TARGET_MIN_PX } from "@/components/ui/touchTarget";
import { submitScoreToLeaderboard } from '@/lib/leaderboard';
import { narrate } from '@/lib/audio/narrate';
import { GAME_SPEECH_RATE } from '@/lib/audio/speech';
import { useOfflineStatus } from '@/hooks/useOfflineStatus';
import { useTapSelect } from '@/hooks/useTapSelect';
import { isUILanguage } from '@/lib/i18n/languages';
import { starsFromRate } from '@/lib/engine/scoring';

interface GameSettings {
    startLevel: number;
}

const DEFAULT_SETTINGS: GameSettings = {
    startLevel: 1,
};

const SETTINGS_KEY = 'fishTraceSettings';
const BEST_SCORE_KEY = 'fishTraceBestScore';

export interface GameComponentProps {
  /** Bridges completion into this app's telemetry/difficulty engine — added glue, not part of the original game logic. */
  onComplete?: (score: number, levelReached: number) => void;
}

export default function GameComponent({ onComplete }: GameComponentProps) {
    const t = useTranslations('games.fishTrace');
    const locale = useLocale();
    const language = isUILanguage(locale) ? locale : 'en';
    const { isOnline } = useOfflineStatus();
    const tapSelect = useTapSelect();
    const containerRef = useRef<HTMLDivElement>(null);

    // Settings
    const [settings, setSettings] = useState<GameSettings>(DEFAULT_SETTINGS);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);

    // Level + Score
    const [level, setLevel] = useState(1);
    const [score, setScore] = useState(0);
    const [bestScore, setBestScore] = useState(0);
    const [roundPoints, setRoundPoints] = useState<number | null>(null); // for +N animation
    const [roundResult, setRoundResult] = useState<{ isPerfect: boolean; correct: number; total: number } | null>(null);

    // Game phase
    const [phase, setPhase] = useState<GamePhase>('idle');
    const [message, setMessage] = useState('');

    // Progress bar
    const [progressTotal, setProgressTotal] = useState(0);
    const [progressStartTime, setProgressStartTime] = useState(0);
    const [progressElapsed, setProgressElapsed] = useState(0);

    // Force render trigger (for fish selection updates)
    const [, forceRender] = useState(0);

    // Load best score & settings
    useEffect(() => {
        const saved = localStorage.getItem(BEST_SCORE_KEY);
        if (saved) setBestScore(parseInt(saved, 10) || 0);

        const savedSettings = localStorage.getItem(SETTINGS_KEY);
        if (savedSettings) {
            try {
                const parsed = JSON.parse(savedSettings);
                setSettings(parsed);
                setLevel(parsed.startLevel || 1);
            } catch { /* ignore */ }
        }
    }, []);

    useEffect(() => {
        if (phase === 'completed' && roundResult && !roundResult.isPerfect) {
            submitScoreToLeaderboard("fish-trace", score);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [phase, roundResult]);

    // Current level params
    const levelParams = getLevelParams(level);

    const {
        fishesRef,
        initFishes,
        startMovement,
        stopMovement,
        toggleSelection,
        markResults,
        calculateScore,
    } = useFishEngine({
        containerWidth: containerRef.current?.clientWidth || 800,
        containerHeight: containerRef.current?.clientHeight || 600,
        fishCount: levelParams.fishCount,
        targetCount: levelParams.targetCount,
        speedMultiplier: levelParams.speed
    });

    // Refs for animating DOM elements at 60fps
    const fishNodeRefs = useRef<{ [id: number]: HTMLDivElement | null }>({});

    // Container size for responsive fish scaling
    const [cWidth, setCWidth] = useState(800);
    useEffect(() => {
        const el = containerRef.current;
        if (!el) return;
        const ro = new ResizeObserver(entries => {
            for (const entry of entries) setCWidth(entry.contentRect.width);
        });
        ro.observe(el);
        return () => ro.disconnect();
    }, []);

    // Scale fish size based on container width. This app's page is capped
    // at max-w-patient (480px), so the old 800px desktop baseline was never
    // reachable — fishScale was always clamped to its 0.6 floor, pinning
    // every fish at ~36px regardless of device, well under this app's 64px
    // touch-target floor for the only tappable target in this game. Rebase
    // against the app's real max width and enforce that floor directly.
    const fishScale = Math.max(1, cWidth / 480);
    const fishSize = Math.max(TOUCH_TARGET_MIN_PX, Math.round(60 * fishScale));
    const fishOffset = fishSize / 2;

    // Progress bar animation loop
    useEffect(() => {
        if (progressTotal <= 0) return;
        let frameId: number;
        const tick = () => {
            const elapsed = Date.now() - progressStartTime;
            setProgressElapsed(Math.min(elapsed, progressTotal));
            if (elapsed < progressTotal) {
                frameId = requestAnimationFrame(tick);
            }
        };
        frameId = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(frameId);
    }, [progressTotal, progressStartTime]);

    // Sync Loop: copy ref coordinates to DOM nodes at 60fps
    const fishOffsetRef = useRef(fishOffset);
    fishOffsetRef.current = fishOffset;

    useEffect(() => {
        let frameId: number;
        const renderLoop = () => {
            if (phase === 'watching' || phase === 'tracking') {
                const fishes = fishesRef.current;
                const offset = fishOffsetRef.current;
                Object.values(fishes).forEach(fish => {
                    const node = fishNodeRefs.current[fish.id];
                    if (node) {
                        const flipX = fish.vx < 0 ? -1 : 1;
                        node.style.transform = `translate(${fish.x - offset}px, ${fish.y - offset}px) scaleX(${flipX})`;
                    }
                });
            }
            frameId = requestAnimationFrame(renderLoop);
        };

        if (phase === 'watching' || phase === 'tracking') {
            frameId = requestAnimationFrame(renderLoop);
        }
        return () => cancelAnimationFrame(frameId);
    }, [phase, fishesRef]);

    const saveSettings = (newSettings: GameSettings) => {
        setSettings(newSettings);
        setLevel(newSettings.startLevel);
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(newSettings));
        setIsSettingsOpen(false);
    };

    const startGame = useCallback(() => {
        setPhase('watching');
        setMessage(t('start'));
        void narrate(t('start'), language, isOnline, GAME_SPEECH_RATE);
        setRoundPoints(null);
        setRoundResult(null);

        const { glowDuration, trackDuration } = getLevelParams(level);

        // Start progress bar for glow phase
        setProgressTotal(glowDuration);
        setProgressStartTime(Date.now());
        setProgressElapsed(0);

        setTimeout(() => {
            initFishes();
            startMovement();
            forceRender(p => p + 1);

            setTimeout(() => {
                setMessage(t('glowEnding'));
            }, glowDuration - 1000);

            // Tracking phase
            setTimeout(() => {
                setPhase('tracking');
                setMessage(t('tracking'));
                // Progress bar for tracking
                setProgressTotal(trackDuration);
                setProgressStartTime(Date.now());
                setProgressElapsed(0);

                // Selection phase
                setTimeout(() => {
                    stopMovement();
                    setPhase('selecting');
                    setMessage(t('selection'));
                    setProgressTotal(0);
                    forceRender(p => p + 1);
                }, trackDuration);

            }, glowDuration);
        }, 100);
    }, [t, level, initFishes, startMovement, stopMovement, language, isOnline]);

    const handleFishClick = (id: number) => {
        if (phase !== 'selecting') return;
        toggleSelection(id);
        forceRender(p => p + 1);
    };

    const confirmSelection = () => {
        setPhase('completed');
        markResults();
        setProgressTotal(0);

        const result = calculateScore(level);
        setRoundResult({ isPerfect: result.isPerfect, correct: result.correct, total: result.total });
        setRoundPoints(result.points);

        const newScore = score + result.points;
        setScore(newScore);

        // Update best score
        if (newScore > bestScore) {
            setBestScore(newScore);
            localStorage.setItem(BEST_SCORE_KEY, String(newScore));
        }

        if (result.isPerfect) {
            setMessage(t('perfect'));
        } else if (result.correct > 0) {
            setMessage(t('partial'));
        } else {
            setMessage(t('gameOver'));
        }

        onComplete?.(newScore, level);
        forceRender(p => p + 1);

        // Auto-advance if perfect
        if (result.isPerfect) {
            setTimeout(() => {
                setLevel(l => l + 1);
                setTimeout(() => startGame(), 300);
            }, 2000);
        }
    };

    const fishes = Object.values(fishesRef.current);

    // Progress bar percentage
    const progressPct = progressTotal > 0 ? Math.max(0, 1 - progressElapsed / progressTotal) : 0;

    // Floored 1-5 star rating for this round's result screen — never reads as a zero-star failure.
    const fishStars = roundResult && roundResult.total > 0
        ? starsFromRate(roundResult.correct / roundResult.total)
        : 5;

    return (
        <div className="w-full h-full min-h-[460px] flex flex-col border border-line200 bg-surface-card rounded-card overflow-hidden">

            {/* Top HUD */}
            <div className="flex justify-between items-center px-6 py-3 bg-transparent shrink-0 z-20">
                <div className="flex items-center gap-3">
                    {phase !== 'idle' && (
                        <span className="text-patient-sm font-bold px-2.5 py-1 rounded-full bg-primary-light/40 text-primary-dark">
                            {t('level')} {level}
                        </span>
                    )}
                    <div className="font-serif-display font-semibold text-patient-body text-ink">
                        {phase === 'idle' ? t('title') : message}
                    </div>
                </div>
                <div className="flex gap-3 items-center">
                    {phase !== 'idle' && (
                        <div className="flex gap-3 text-patient-sm font-semibold">
                            <span className="text-ink-muted">
                                {t('scorePrefix')} {score}
                            </span>
                            {bestScore > 0 && (
                                <span className="text-ink-muted/70">
                                    {t('bestScore')} {bestScore}
                                </span>
                            )}
                        </div>
                    )}
                    {phase === 'idle' && (
                        <GameSettingsDialog
                            settings={settings}
                            onSave={saveSettings}
                            isOpen={isSettingsOpen}
                            onOpenChange={setIsSettingsOpen}
                            t={t}
                        />
                    )}
                </div>
            </div>

            {/* Play Area */}
            <div
                className="relative flex-1 w-full min-h-[360px] overflow-hidden bg-[#0D9488]/10"
                ref={containerRef}
            >
                {/* Score Popup Animation */}
                <AnimatePresence>
                    {roundPoints !== null && roundPoints > 0 && (
                        <motion.div
                            key={`score-popup-${Date.now()}`}
                            initial={{ opacity: 1, y: 0, scale: 1 }}
                            animate={{ opacity: 0, y: -80, scale: 1.6 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 1.2, ease: 'easeOut' }}
                            className="absolute top-1/3 left-1/2 -translate-x-1/2 z-30 pointer-events-none"
                        >
                            <span className="text-4xl font-black text-success drop-shadow-lg">
                                +{roundPoints}
                            </span>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Level Announce */}
                <AnimatePresence>
                    {phase === 'watching' && (
                        <motion.div
                            key={`level-announce-${level}`}
                            initial={{ opacity: 0, scale: 0.5 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 1.5 }}
                            transition={{ duration: 0.8, ease: 'easeOut' }}
                            className="absolute top-1/4 left-1/2 -translate-x-1/2 z-30 pointer-events-none"
                        >
                            <span className="text-3xl font-black tracking-widest uppercase text-white/80 drop-shadow-xl">
                                {t('round', { level })}
                            </span>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Idle Decorative Fishes */}
                {phase === 'idle' && (
                    <div className="absolute inset-0 z-5 overflow-hidden pointer-events-none">
                        {[0, 1, 2].map(i => (
                            <motion.div
                                key={`deco-fish-${i}`}
                                className="absolute"
                                initial={{
                                    x: -80,
                                    y: 100 + i * 120,
                                }}
                                animate={{
                                    x: [
                                        -80,
                                        (containerRef.current?.clientWidth || 800) + 80
                                    ],
                                }}
                                transition={{
                                    duration: 12 + i * 4,
                                    repeat: Infinity,
                                    ease: 'linear',
                                    delay: i * 3,
                                }}
                            >
                                <SunfishSVG
                                    isGlowing={false}
                                    isSelected={false}
                                    isTarget={false}
                                    isChecking={false}
                                    isWrongSelection={false}
                                    size={40 + i * 10}
                                />
                            </motion.div>
                        ))}
                    </div>
                )}

                {/* Game Fishes */}
                <div className="absolute inset-0 z-10 w-full h-full overflow-hidden">
                    {phase !== 'idle' && fishes.map(fish => {
                        const isGlowing = phase === 'watching' && fish.isTarget;
                        const flipX = fish.vx < 0 ? -1 : 1;
                        const tap = tapSelect(() => handleFishClick(fish.id), phase === 'selecting');

                        return (
                            <div
                                key={fish.id}
                                ref={el => { fishNodeRefs.current[fish.id] = el; }}
                                {...tap}
                                className="absolute top-0 left-0 cursor-pointer"
                                style={{
                                    ...tap.style,
                                    transform: phase === 'selecting' || phase === 'completed'
                                        ? `translate(${fish.x - fishOffset}px, ${fish.y - fishOffset}px) scaleX(${flipX})`
                                        : undefined,
                                    transition: phase === 'selecting' || phase === 'completed' ? 'transform 0.5s ease' : 'none',
                                    willChange: 'transform'
                                }}
                            >
                                <SunfishSVG
                                    isGlowing={isGlowing}
                                    isSelected={fish.isSelected}
                                    isTarget={fish.isTarget}
                                    isChecking={fish.isChecking}
                                    isWrongSelection={fish.isWrongSelection}
                                    size={fishSize}
                                />
                            </div>
                        );
                    })}
                </div>

                {/* Phase transition overlay */}
                <AnimatePresence>
                    {(phase === 'tracking') && (
                        <motion.div
                            key="dimmer"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.8 }}
                            className="absolute inset-0 z-5 pointer-events-none bg-black/10"
                        />
                    )}
                </AnimatePresence>
            </div>

            {/* Progress Bar */}
            {progressTotal > 0 && (
                <div className="w-full h-1 bg-surface-muted shrink-0 overflow-hidden">
                    <motion.div
                        className="h-full rounded-r-full bg-primary"
                        style={{ width: `${progressPct * 100}%` }}
                        transition={{ duration: 0.05 }}
                    />
                </div>
            )}

            {/* Bottom Controls */}
            {/* min-h, not h-24: the result stack (stars, score, Try again) is taller
                than 96px and spilled over the board, worse at Large text. */}
            <div className="min-h-24 py-2 shrink-0 flex items-center justify-center bg-transparent relative z-20">
                <AnimatePresence mode="popLayout">
                    {phase === 'idle' && (
                        <motion.div
                            key="idle-menu"
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="flex items-center justify-center"
                        >
                            <motion.div
                                animate={{ scale: [1, 1.04, 1] }}
                                transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                            >
                                <Button
                                    size="lg"
                                    onClick={() => startGame()}
                                    className="w-56 text-patient-body font-semibold rounded-tile text-ink-inverse focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-primary-dark"
                                >
                                    {t('startBtn')}
                                </Button>
                            </motion.div>
                        </motion.div>
                    )}

                    {phase === 'selecting' && (
                        <motion.div
                            key="confirm-btn"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0 }}
                            className="flex items-center justify-center"
                        >
                            <Button
                                size="lg"
                                onClick={confirmSelection}
                                className="font-semibold py-6 px-12 text-patient-body rounded-tile text-ink-inverse focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-primary-dark"
                            >
                                {t('confirmSelection')}
                            </Button>
                        </motion.div>
                    )}

                    {phase === 'completed' && (
                        <motion.div
                            key="result-menu"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="flex flex-col items-center gap-2"
                        >
                            {roundResult && (
                                <>
                                    <p className="text-2xl text-primary" aria-hidden="true">
                                        {'★'.repeat(fishStars)}
                                        {'☆'.repeat(5 - fishStars)}
                                    </p>
                                    <div className="text-patient-sm font-medium text-ink-muted">
                                        {roundResult.correct}/{roundResult.total} {t('scorePrefix')} {roundPoints !== null ? `+${roundPoints}` : ''}
                                    </div>
                                </>
                            )}
                            {!roundResult?.isPerfect && (
                                <Button
                                    size="lg"
                                    onClick={() => startGame()}
                                    className="font-semibold py-5 px-10 text-patient-body rounded-tile text-ink-inverse hover:scale-105 transition-transform focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-primary-dark"
                                >
                                    {t('tryAgain')}
                                </Button>
                            )}
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
}

function GameSettingsDialog({
    settings,
    onSave,
    isOpen,
    onOpenChange,
    t
}: {
    settings: GameSettings;
    onSave: (settings: GameSettings) => void;
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    t: ReturnType<typeof useTranslations>;
}) {
    const [tempSettings, setTempSettings] = useState(settings);

    useEffect(() => {
        setTempSettings(settings);
    }, [settings, isOpen]);

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogTrigger asChild>
                <Button
                    variant="outline"
                    size="icon"
                    style={{ minHeight: TOUCH_TARGET_MIN_PX, minWidth: TOUCH_TARGET_MIN_PX }}
                    className="shadow-sm rounded-full focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-primary"
                >
                    <Settings className="w-5 h-5" />
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-sm rounded-card">
                <DialogHeader>
                    <DialogTitle className="font-serif-display font-semibold text-patient-body text-ink">{t('settings')}</DialogTitle>
                </DialogHeader>
                <div className="space-y-5 py-4">
                    <div className="space-y-2">
                        <Label htmlFor="startLevel" className="font-semibold text-patient-sm text-ink">{t('startLevel')}</Label>
                        <Input
                            id="startLevel"
                            type="number"
                            min="1"
                            max="20"
                            value={tempSettings.startLevel}
                            onChange={(e) => {
                                const val = parseInt(e.target.value) || 1;
                                setTempSettings({
                                    ...tempSettings,
                                    startLevel: Math.min(20, Math.max(1, val))
                                });
                            }}
                        />
                    </div>
                </div>
                <div className="flex justify-end gap-2 mt-2">
                    <Button variant="ghost" onClick={() => onOpenChange(false)} className="font-semibold text-patient-sm">
                        {t('cancel')}
                    </Button>
                    <Button onClick={() => onSave(tempSettings)} className="font-semibold text-patient-sm text-ink-inverse">
                        {t('save')}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}