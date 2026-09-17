'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { motion, AnimatePresence } from 'framer-motion';
import { LilyPadSVG } from './LilyPadSVG';
import { FrogSVG } from './FrogSVG';
import { Button } from '@/components/ui/button';
import { Settings } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { TOUCH_TARGET_MIN_PX } from '@/components/ui/touchTarget';
import { submitScoreToLeaderboard } from '@/lib/leaderboard';
import { narrate } from '@/lib/audio/narrate';
import { GAME_SPEECH_RATE } from '@/lib/audio/speech';
import { useOfflineStatus } from '@/hooks/useOfflineStatus';
import { isUILanguage } from '@/lib/i18n/languages';
import { starsFromRate } from '@/lib/engine/scoring';
import { slower } from '@/lib/games/pacing';
import {
    GamePhase,
    PadPosition,
    getLevelParams,
    pickPadPositions,
    generateJumpSequence,
    calculateScore,
} from './hooks/useFrogEngine';

interface GameSettings {
    startLevel: number;
}

const DEFAULT_SETTINGS: GameSettings = {
    startLevel: 1,
};

const BEST_SCORE_KEY = 'frogMemoryBestScore';
const SETTINGS_KEY = 'frogMemorySettings';

export interface GameComponentProps {
  /** Bridges completion into this app's telemetry/difficulty engine — added glue, not part of the original game logic. */
  onComplete?: (score: number, levelReached: number) => void;
}

export default function GameComponent({ onComplete }: GameComponentProps) {
    const t = useTranslations('games.frogMemoryLeap.gameUI');
    const locale = useLocale();
    const language = isUILanguage(locale) ? locale : 'en';
    const { isOnline } = useOfflineStatus();
    const containerRef = useRef<HTMLDivElement>(null);

    // Settings
    const [settings, setSettings] = useState<GameSettings>(DEFAULT_SETTINGS);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);

    // Game state
    const [phase, setPhase] = useState<GamePhase>('idle');
    const [level, setLevel] = useState(1);
    const [score, setScore] = useState(0);
    const [bestScore, setBestScore] = useState(0);
    const [message, setMessage] = useState('');
    const [roundPoints, setRoundPoints] = useState<number | null>(null);

    // Level data
    const [activePads, setActivePads] = useState<PadPosition[]>([]);
    const [jumpSeq, setJumpSeq] = useState<number[]>([]);

    // Demo playback
    const [demoIndex, setDemoIndex] = useState(-1); // which jump is being shown
    const [highlightedPadId, setHighlightedPadId] = useState<number | null>(null);

    // Player input
    const [playerIndex, setPlayerIndex] = useState(0);
    const [correctPads, setCorrectPads] = useState<Set<number>>(new Set());
    const [wrongPadId, setWrongPadId] = useState<number | null>(null);
    const [startTime, setStartTime] = useState(0);

    // Frog position (pad ID)
    const [frogPadId, setFrogPadId] = useState<number | null>(null);
    const [isJumping, setIsJumping] = useState(false);
    const [jumpDuration, setJumpDuration] = useState(900);
    const [frogRotation, setFrogRotation] = useState(0); // degrees, 0 = sprite default
    const prevPadIdRef = useRef<number | null>(null);

    // Progress
    const [progressTotal, setProgressTotal] = useState(0);
    const [progressStart, setProgressStart] = useState(0);
    const [progressElapsed, setProgressElapsed] = useState(0);

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
        if (phase === 'fail') {
            submitScoreToLeaderboard("frog-memory-leap", score);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [phase]);

    const saveSettings = (newSettings: GameSettings) => {
        setSettings(newSettings);
        setLevel(newSettings.startLevel);
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(newSettings));
        setIsSettingsOpen(false);
    };

    // Container size for responsive scaling
    const [containerWidth, setContainerWidth] = useState(600);

    useEffect(() => {
        const el = containerRef.current;
        if (!el) return;
        const ro = new ResizeObserver(entries => {
            for (const entry of entries) {
                setContainerWidth(entry.contentRect.width);
            }
        });
        ro.observe(el);
        return () => ro.disconnect();
    }, []);

    // Scale game elements based on container width. This app's page is
    // capped at max-w-patient (480px), so the old 600px desktop baseline
    // left the lily pads — the actual tap targets — as small as ~45-56px on
    // real phone widths, under this app's 64px touch-target floor. Rebase
    // against the app's real max width and floor the lily pad at that size
    // (the frog sprite itself isn't tappable, so it keeps scaling freely).
    const scale = Math.max(1, containerWidth / 480);
    const lilyPadSize = Math.max(TOUCH_TARGET_MIN_PX, Math.round(75 * scale));
    const frogSize = Math.round(50 * scale);
    const idleFrogSize = Math.round(80 * scale);

    // Progress bar tick
    useEffect(() => {
        if (progressTotal <= 0) return;
        let id: number;
        const tick = () => {
            const elapsed = Date.now() - progressStart;
            setProgressElapsed(Math.min(elapsed, progressTotal));
            if (elapsed < progressTotal) id = requestAnimationFrame(tick);
        };
        id = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(id);
    }, [progressTotal, progressStart]);

    /**
     * Calculate rotation angle from one pad to another.
     * The sprite faces "down" by default, so 0° = down.
     * We calculate the angle so the frog's head points toward the target.
     */
    const calcRotation = useCallback((fromId: number, toId: number, pads: PadPosition[]) => {
        const from = pads.find(p => p.id === fromId);
        const to = pads.find(p => p.id === toId);
        if (!from || !to) return 0;
        const dx = to.px - from.px;
        const dy = to.py - from.py;
        // Calculate angle CW from north using screen coordinates (Y-down).
        // atan2(dx, -dy) gives CW angle from north:
        //   up=0°, right=90°, down=180°, left=-90°
        const rad = Math.atan2(dx, -dy);
        const targetAngle = (rad * 180) / Math.PI;
        // Sprite default heading ≈ 205° CW from north (≈ -155°),
        // i.e. head points bottom-left, slightly biased toward straight-down.
        const SPRITE_ANGLE = -155;
        let rotation = targetAngle - SPRITE_ANGLE;
        // Normalize to [-180, 180] for shortest rotation path
        rotation = ((rotation + 540) % 360) - 180;
        return rotation;
    }, []);

    /** Calculate Euclidean distance (in % units) between two pads */
    const calcDistance = useCallback((fromId: number, toId: number, pads: PadPosition[]) => {
        const from = pads.find(p => p.id === fromId);
        const to = pads.find(p => p.id === toId);
        if (!from || !to) return 30; // fallback medium distance
        const dx = to.px - from.px;
        const dy = to.py - from.py;
        return Math.sqrt(dx * dx + dy * dy);
    }, []);

    /**
     * Map distance to jump duration.
     * Short hops (~10% units) → 400ms, long leaps (~80% units) → 1200ms.
     * Linearly interpolated and clamped.
     */
    const calcJumpDuration = useCallback((distance: number) => {
        const MIN_DIST = 10;
        const MAX_DIST = 80;
        // Slowed 20% (pacing.SLOWDOWN) per clinical feedback.
        const MIN_DUR = slower(400);
        const MAX_DUR = slower(1200);
        const t = Math.max(0, Math.min(1, (distance - MIN_DIST) / (MAX_DIST - MIN_DIST)));
        return Math.round(MIN_DUR + t * (MAX_DUR - MIN_DUR));
    }, []);

    /** Trigger a jump: set rotation, then simultaneously start position + sprite animation */
    const triggerJump = useCallback((targetPadId: number, pads: PadPosition[], duration = 900) => {
        const fromId = prevPadIdRef.current;
        if (fromId !== null && fromId !== targetPadId) {
            setFrogRotation(calcRotation(fromId, targetPadId, pads));
        }
        setFrogPadId(targetPadId);
        setJumpDuration(duration);
        setIsJumping(true);
        prevPadIdRef.current = targetPadId;
        setTimeout(() => setIsJumping(false), duration);
    }, [calcRotation]);

    // ── Start a new round ──
    const startRound = useCallback((lvl: number) => {
        const params = getLevelParams(lvl);
        const pads = pickPadPositions(params.padCount);
        const seq = generateJumpSequence(pads, params.jumpCount);

        setActivePads(pads);
        setJumpSeq(seq);
        setFrogPadId(seq[0]);
        prevPadIdRef.current = seq[0];
        setDemoIndex(-1);
        setHighlightedPadId(null);
        setPlayerIndex(0);
        setCorrectPads(new Set());
        setWrongPadId(null);
        setRoundPoints(null);
        setIsJumping(false);
        setPhase('watching');
        setMessage(t('level', { level: lvl.toString() }));

        // Pre-compute per-jump durations based on distance
        const jumpDurations: number[] = [];
        for (let i = 1; i < seq.length; i++) {
            const dist = Math.sqrt(
                Math.pow((pads.find(p => p.id === seq[i])?.px ?? 0) - (pads.find(p => p.id === seq[i - 1])?.px ?? 0), 2) +
                Math.pow((pads.find(p => p.id === seq[i])?.py ?? 0) - (pads.find(p => p.id === seq[i - 1])?.py ?? 0), 2)
            );
            // Duration: 400ms–1200ms based on distance, slowed 20%
            // (pacing.SLOWDOWN) per clinical feedback.
            const t = Math.max(0, Math.min(1, (dist - 10) / 70));
            jumpDurations.push(slower(Math.round(400 + t * 800)));
        }
        // Each demo step: jump duration + small pause (200ms)
        const PAUSE_BETWEEN = slower(200);
        const totalDemoTime = jumpDurations.reduce((sum, d) => sum + d + PAUSE_BETWEEN, 0) + slower(1500);
        setProgressTotal(totalDemoTime);
        setProgressStart(Date.now());
        setProgressElapsed(0);

        // After a brief pause, start demo
        setTimeout(() => {
            setMessage(t('watch'));
            void narrate(`${params.jumpCount} ${t('watch')}`, language, isOnline, GAME_SPEECH_RATE);
            playDemo(seq, pads, jumpDurations);
        }, slower(1500));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [t, language, isOnline]);

    // ── Play demo sequence ──
    const playDemo = (seq: number[], pads: PadPosition[], durations: number[]) => {
        // Start from i=1 since frog is already placed at seq[0]
        let i = 1;
        // Highlight the starting pad briefly
        setHighlightedPadId(seq[0]);
        setTimeout(() => setHighlightedPadId(null), slower(400));
        const PAUSE_BETWEEN = slower(200);

        const step = () => {
            if (i < seq.length) {
                const dur = durations[i - 1];
                // Jump to the next pad — rotation + sprite + position all together
                triggerJump(seq[i], pads, dur);
                setHighlightedPadId(seq[i]);

                // Clear highlight shortly after landing
                setTimeout(() => setHighlightedPadId(null), dur * 0.7);

                i++;
                // Next step after jump completes + small pause
                setTimeout(step, dur + PAUSE_BETWEEN);
            } else {
                // Demo done → player turn
                setTimeout(() => {
                    setPhase('playing');
                    setMessage(t('repeat'));
                    setFrogPadId(seq[0]); // reset frog to start
                    prevPadIdRef.current = seq[0];
                    setPlayerIndex(1); // player needs to click from index 1
                    setStartTime(Date.now());
                    setProgressTotal(0);
                }, slower(500));
            }
        };
        const firstDur = durations[0] || slower(600);
        setTimeout(step, firstDur + PAUSE_BETWEEN);
    };

    // ── Handle player click on pad ──
    const handlePadClick = (padId: number) => {
        if (phase !== 'playing') return;

        const expected = jumpSeq[playerIndex];

        if (padId === expected) {
            // Correct! Jump to the pad with distance-based duration
            const dist = calcDistance(prevPadIdRef.current ?? padId, padId, activePads);
            const dur = calcJumpDuration(dist);
            triggerJump(padId, activePads, dur);
            setCorrectPads(prev => new Set(prev).add(padId));

            const nextIdx = playerIndex + 1;
            setPlayerIndex(nextIdx);

            if (nextIdx >= jumpSeq.length) {
                // Round complete!
                handleSuccess();
            }
        } else {
            // Wrong!
            setWrongPadId(padId);
            handleFailure();
        }
    };

    // ── Success ──
    const handleSuccess = () => {
        setPhase('success');
        const elapsed = Date.now() - startTime;
        const points = calculateScore(level, elapsed);
        setRoundPoints(points);

        const newScore = score + points;
        setScore(newScore);

        if (newScore > bestScore) {
            setBestScore(newScore);
            localStorage.setItem(BEST_SCORE_KEY, String(newScore));
        }

        setMessage(t('correct'));

        // Auto advance after pause
        setTimeout(() => {
            const nextLevel = level + 1;
            setLevel(nextLevel);
            startRound(nextLevel);
        }, 2200);
    };

    // ── Failure ──
    const handleFailure = () => {
        setPhase('fail');
        setMessage(t('gameOver'));
        onComplete?.(score, level);
    };

    // ── Restart ──
    const restartGame = () => {
        setLevel(1);
        setScore(0);
        startRound(1);
    };

    // ── Retry same level ──
    const retryLevel = () => {
        startRound(level);
    };

    // Get frog pixel position from pad ID
    const getFrogPosition = () => {
        if (frogPadId === null) return null;
        return activePads.find(p => p.id === frogPadId) || null;
    };

    const frogPos = getFrogPosition();
    const progressPct = progressTotal > 0 ? Math.max(0, 1 - progressElapsed / progressTotal) : 0;
    const params = getLevelParams(level);

    // Floored 1-5 star rating for the end-of-session screen, from how many
    // levels were reached — the same levelReached-to-percentage mapping this
    // game's page wrapper already uses to bridge into the difficulty engine.
    const frogStars = starsFromRate(Math.min(100, level * 12) / 100);

    return (
        <div className="w-full h-full min-h-[460px] flex flex-col border border-line200 bg-surface-card rounded-card overflow-hidden">

            {/* Top HUD */}
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 md:px-6 md:py-3 bg-transparent shrink-0 z-20">
                {phase !== 'idle' && (
                    <span className="text-patient-sm font-bold px-2 py-0.5 md:px-2.5 md:py-1 rounded-full bg-primary-light/40 text-primary-dark shrink-0">
                        {t('level', { level: level.toString() })}
                    </span>
                )}
                <div className="font-serif-display font-semibold text-patient-sm md:text-patient-body text-ink truncate">
                    {phase === 'idle' ? t('start') : message}
                </div>
                {phase !== 'idle' && (
                    <div className="flex gap-3 text-patient-sm font-semibold md:ml-auto">
                        <span className="text-ink-muted">
                            {t('score', { score: score.toString() })}
                        </span>
                        {bestScore > 0 && (
                            <span className="text-ink-muted/70">
                                {t('highScore', { score: bestScore.toString() })}
                            </span>
                        )}
                    </div>
                )}
                {phase === 'idle' && (
                    <div className="ml-auto">
                        <GameSettingsDialog
                            settings={settings}
                            onSave={saveSettings}
                            isOpen={isSettingsOpen}
                            onOpenChange={setIsSettingsOpen}
                            t={t}
                        />
                    </div>
                )}
            </div>

            {/* Play Area */}
            <div
                ref={containerRef}
                className="relative flex-1 w-full min-h-[360px] overflow-hidden bg-[#219EBC]/10"
                style={{
                    backgroundImage: "url('/games/assets/frog/bg_pond.png')",
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                }}
            >
                {/* Score popup */}
                <AnimatePresence>
                    {roundPoints !== null && roundPoints > 0 && (
                        <motion.div
                            key={`score-pop-${Date.now()}`}
                            initial={{ opacity: 1, y: 0, scale: 1 }}
                            animate={{ opacity: 0, y: -60, scale: 1.5 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 1.2, ease: 'easeOut' }}
                            className="absolute top-1/3 left-1/2 -translate-x-1/2 z-40 pointer-events-none"
                        >
                            <span className="text-4xl font-black text-success drop-shadow-lg">
                                +{roundPoints}
                            </span>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Level announce */}
                <AnimatePresence>
                    {phase === 'watching' && demoIndex === -1 && (
                        <motion.div
                            key={`level-ann-${level}`}
                            initial={{ opacity: 0, scale: 0.5 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 1.4 }}
                            transition={{ duration: 0.8 }}
                            className="absolute top-1/4 left-1/2 -translate-x-1/2 z-40 pointer-events-none"
                        >
                            <span className="text-3xl font-black tracking-widest uppercase text-white/80 drop-shadow-xl">
                                {t('level', { level: level.toString() })}
                            </span>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Lily pads */}
                {activePads.map(pad => (
                    <div
                        key={pad.id}
                        className="absolute z-10"
                        style={{
                            left: `${pad.px}%`,
                            top: `${pad.py}%`,
                            transform: 'translate(-50%, -50%)',
                        }}
                    >
                        <LilyPadSVG
                            size={lilyPadSize}
                            isActive={frogPadId === pad.id}
                            isHighlighted={highlightedPadId === pad.id}
                            isCorrect={correctPads.has(pad.id)}
                            isWrong={wrongPadId === pad.id}
                            onClick={() => handlePadClick(pad.id)}
                        />
                    </div>
                ))}

                {/* Frog */}
                {frogPos && (
                    <motion.div
                        className="absolute z-20 pointer-events-none"
                        animate={{
                            left: `${frogPos.px}%`,
                            top: `${frogPos.py}%`,
                        }}
                        transition={{
                            type: 'tween',
                            duration: jumpDuration / 1000,
                            ease: [0.25, 0.1, 0.25, 1],
                        }}
                        style={{
                            transform: 'translate(-50%, -65%)',
                        }}
                    >
                        <FrogSVG size={frogSize} isJumping={isJumping} jumpDuration={jumpDuration} rotation={frogRotation} />
                    </motion.div>
                )}

                {/* Idle decorative frogs */}
                {phase === 'idle' && (
                    <div className="absolute inset-0 z-5 pointer-events-none flex items-center justify-center">
                        <motion.div
                            animate={{ y: [0, -8, 0] }}
                            transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                        >
                            <FrogSVG size={idleFrogSize} />
                        </motion.div>
                    </div>
                )}
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
            <div className="h-24 shrink-0 flex items-center justify-center bg-transparent relative z-20">
                <AnimatePresence mode="popLayout">
                    {phase === 'idle' && (
                        <motion.div
                            key="start-btn"
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                        >
                            <motion.div
                                animate={{ scale: [1, 1.04, 1] }}
                                transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                            >
                                <Button
                                    size="lg"
                                    onClick={() => startRound(settings.startLevel)}
                                    className="w-56 text-patient-body font-semibold rounded-tile text-ink-inverse focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-primary-dark"
                                >
                                    {t('start')}
                                </Button>
                            </motion.div>
                        </motion.div>
                    )}

                    {phase === 'watching' && (
                        <motion.div
                            key="watching-hint"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="text-patient-sm font-medium text-ink-muted"
                        >
                            {params.jumpCount} {t('watch')}
                        </motion.div>
                    )}

                    {phase === 'playing' && (
                        <motion.div
                            key="playing-hint"
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0 }}
                            className="text-patient-sm font-medium text-ink-muted"
                        >
                            {playerIndex - 1}/{jumpSeq.length - 1}
                        </motion.div>
                    )}

                    {phase === 'fail' && (
                        <motion.div
                            key="fail-btns"
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="flex flex-col items-center gap-1"
                        >
                            <p className="text-2xl text-primary" aria-hidden="true">
                                {'★'.repeat(frogStars)}
                                {'☆'.repeat(5 - frogStars)}
                            </p>
                            <div className="flex gap-3">
                                <Button
                                    size="lg"
                                    variant="outline"
                                    onClick={retryLevel}
                                    className="font-semibold py-5 px-8 text-patient-body rounded-tile focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-primary"
                                >
                                    {t('tryAgain')}
                                </Button>
                                <Button
                                    size="lg"
                                    onClick={restartGame}
                                    className="font-semibold py-5 px-8 text-patient-body rounded-tile text-ink-inverse focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-primary-dark"
                                >
                                    {t('start')}
                                </Button>
                            </div>
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