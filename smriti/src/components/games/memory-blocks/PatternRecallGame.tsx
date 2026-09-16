'use client'

import { useState, useCallback, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { PlayCircle, Trophy, Loader2 } from 'lucide-react'
import { ShareModal } from '@/components/ui/ShareModal'
import { useTranslations, useLocale } from 'next-intl'
import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import { useTimeout } from '@/hooks/useTimeout'
import { submitScoreToLeaderboard } from '@/lib/leaderboard'
import { narrate } from '@/lib/audio/narrate'
import { useOfflineStatus } from '@/hooks/useOfflineStatus'
import { isUILanguage } from '@/lib/i18n/languages'
import { starsFromRate } from '@/lib/engine/scoring'

interface Block {
    id: number
    isHighlighted: boolean
    isError: boolean
    isCorrect: boolean
}

const START_LEVEL = 3
const MAX_START_LEVEL = 20
const BEST_SCORE_KEY = 'memoryBlocksBestScore'

export interface PatternRecallGameProps {
  /** Bridges completion into this app's telemetry/difficulty engine — added glue, not part of the original game logic. */
  onComplete?: (score: number, levelReached: number) => void;
}

export function PatternRecallGame({ onComplete }: PatternRecallGameProps = {}) {
    const t = useTranslations('games.blockMemoryChallenge.gameUI')
    const locale = useLocale()
    const language = isUILanguage(locale) ? locale : 'en'
    const { isOnline } = useOfflineStatus()
    const [gameState, setGameState] = useState<'idle' | 'showing' | 'guessing' | 'complete' | 'failed'>('idle')
    const [level, setLevel] = useState(START_LEVEL)
    const [startLevel, setStartLevel] = useState(START_LEVEL)
    const [blocks, setBlocks] = useState<Block[]>(createInitialBlocks())
    const [pattern, setPattern] = useState<number[]>([])
    const [userPattern, setUserPattern] = useState<number[]>([])
    const [score, setScore] = useState(0)
    const [bestScore, setBestScore] = useState(0)
    const [roundStartTime, setRoundStartTime] = useState(0)
    const [showResults, setShowResults] = useState(false)
    const [isLoading, setIsLoading] = useState(false)
    const [showShareModal, setShowShareModal] = useState(false)
    const [blockToAnimate, setBlockToAnimate] = useState<number | null>(null)
    const [animateError, setAnimateError] = useState<number | null>(null)

    useTimeout(() => {
        if (blockToAnimate === null) {
            return
        }

        setBlocks((currentBlocks) => currentBlocks.map((block) => ({ ...block, isCorrect: false })))

        if (userPattern.length === pattern.length) {
            const levelScore = calculateLevelScore(level, roundStartTime)
            const newTotalScore = score + levelScore
            const nextLevel = level + 1
            const nextPattern = generatePattern(nextLevel)

            setScore(newTotalScore)
            updateBestScore(newTotalScore)
            setGameState('complete')

            setTimeout(() => {
                setLevel(nextLevel)
                setPattern(nextPattern)
                resetBlocks()
                void showPattern(nextPattern)
            }, 500)
        }

        setBlockToAnimate(null)
    }, blockToAnimate !== null ? 300 : null)

    useTimeout(() => {
        if (animateError === null) {
            return
        }

        setBlocks((currentBlocks) =>
            currentBlocks.map((block) => ({
                ...block,
                isError: false,
                isCorrect: false,
            }))
        )
        setAnimateError(null)
        setShowResults(true)
    }, animateError !== null ? 600 : null)

    useEffect(() => {
        const savedBestScore = localStorage.getItem(BEST_SCORE_KEY)

        if (savedBestScore) {
            setBestScore(parseInt(savedBestScore, 10))
        }
    }, [])

    // Narrate the instructions aloud whenever a new pattern is about to be
    // shown — this game's instruction moment, mirroring how the app's
    // original games speak their instruction text on entry.
    useEffect(() => {
        if (gameState !== 'showing') return
        void narrate(t('watchSequence'), language, isOnline)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [gameState])

    // Floored 1-5 star rating for the results screen, from how many levels
    // were reached — the same levelReached-to-percentage mapping this game's
    // page wrapper already uses to bridge into the difficulty engine.
    const blockStars = starsFromRate(Math.min(100, level * 12) / 100)

    const updateBestScore = useCallback((newScore: number) => {
        if (newScore > bestScore) {
            setBestScore(newScore)
            localStorage.setItem(BEST_SCORE_KEY, newScore.toString())
        }
    }, [bestScore])

    const resetBlocks = useCallback(() => {
        setBlocks((currentBlocks) =>
            currentBlocks.map((block) => ({
                ...block,
                isHighlighted: false,
                isError: false,
                isCorrect: false,
            }))
        )
        setBlockToAnimate(null)
        setAnimateError(null)
    }, [])

    const showPattern = useCallback(async (nextPattern: number[]) => {
        setGameState('showing')
        setUserPattern([])

        for (const blockId of nextPattern) {
            setBlocks((currentBlocks) =>
                currentBlocks.map((block) => ({
                    ...block,
                    isHighlighted: block.id === blockId,
                    isCorrect: false,
                }))
            )

            await wait(800)

            setBlocks((currentBlocks) =>
                currentBlocks.map((block) => ({
                    ...block,
                    isHighlighted: false,
                }))
            )

            await wait(200)
        }

        resetBlocks()
        setGameState('guessing')
        setRoundStartTime(Date.now())
    }, [resetBlocks])

    const startGame = useCallback(() => {
        const initialLevel = startLevel

        setIsLoading(true)
        setGameState('idle')
        setLevel(initialLevel)
        setPattern([])
        setUserPattern([])
        setScore(0)
        setShowResults(false)
        resetBlocks()

        setTimeout(() => {
            const nextPattern = generatePattern(initialLevel)

            setIsLoading(false)
            setPattern(nextPattern)
            void showPattern(nextPattern)
        }, 1000)
    }, [resetBlocks, showPattern, startLevel])

    const handleFailure = useCallback(() => {
        setGameState('failed')
        onComplete?.(score, level)

        if (score > 0) {
            void submitScoreToLeaderboard('block-memory-challenge', score)
        }
    }, [score, level, onComplete])

    const handleBlockClick = useCallback((blockId: number) => {
        if (gameState !== 'guessing') {
            return
        }

        if (blockToAnimate !== null || animateError !== null) {
            return
        }

        const nextUserPattern = [...userPattern, blockId]
        const currentIndex = userPattern.length
        const isCorrect = pattern[currentIndex] === blockId

        setUserPattern(nextUserPattern)

        if (isCorrect) {
            setBlocks((currentBlocks) =>
                currentBlocks.map((block) =>
                    block.id === blockId ? { ...block, isCorrect: true } : block
                )
            )
            setBlockToAnimate(blockId)
            return
        }

        setBlocks((currentBlocks) =>
            currentBlocks.map((block) =>
                block.id === blockId
                    ? { ...block, isError: true, isCorrect: false }
                    : block.id === pattern[currentIndex]
                        ? { ...block, isCorrect: true, isError: false }
                        : block
            )
        )
        setAnimateError(blockId)
        handleFailure()
    }, [animateError, blockToAnimate, gameState, handleFailure, pattern, userPattern])

    return (
        <div className="space-y-8 max-w-md mx-auto py-4">
            {gameState !== 'idle' && !showResults && (
                <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
                    <div className="flex shrink-0 gap-4 items-center">
                        <div className="text-patient-body font-semibold text-ink">
                            {t('level')}: {level}
                        </div>
                        <div className="flex items-center gap-1 text-ink">
                            <Trophy className="w-4 h-4 text-primary" />
                            <span>{score}</span>
                        </div>
                    </div>
                    <div className="min-w-0 text-right text-patient-sm text-ink-muted">
                        {gameState === 'showing'
                            ? t('watchSequence')
                            : gameState === 'guessing'
                                ? t('repeatSequence')
                                : gameState === 'complete'
                                    ? t('wellDone')
                                    : ''}
                    </div>
                </div>
            )}

            <div className="relative">
                <div className="grid grid-cols-3 gap-4 max-w-md mx-auto">
                    {blocks.map((block) => (
                        <div
                            key={block.id}
                            onClick={() => handleBlockClick(block.id)}
                            // 96px floor in px, not min-h-24 (rem): an empty
                            // square tile has no text to fit, and a rem floor
                            // grew with Large text until three tiles no longer
                            // fit a 360px phone and the page scrolled sideways.
                            className={cn(
                                'aspect-square min-h-[96px] rounded-tile transition-all duration-150',
                                'flex items-center justify-center',
                                'border border-line200',
                                gameState === 'guessing' ? 'cursor-pointer bg-surface-muted' : 'cursor-not-allowed bg-surface-muted',
                                block.isHighlighted && 'bg-primary scale-95 cursor-default',
                                block.isCorrect && 'bg-success scale-95 cursor-default',
                                block.isError && 'bg-danger/30 scale-95 cursor-default',
                                gameState !== 'guessing' && !block.isHighlighted && !block.isCorrect && !block.isError && 'opacity-75',
                            )}
                        />
                    ))}
                </div>

                {gameState === 'idle' && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-primary/5 rounded-tile backdrop-blur-xs p-4">
                        {bestScore > 0 && (
                            <div className="text-center mb-2">
                                <div className="text-patient-sm text-ink-muted">
                                    {t('bestScore')}
                                </div>
                                <div className="font-serif-display text-patient-heading text-ink">
                                    {bestScore}
                                </div>
                            </div>
                        )}

                        <div className="flex w-4/5 flex-col items-center gap-3">
                            <Label htmlFor="start-level-slider">
                                {t('startLevelLabel', { count: startLevel })}
                            </Label>
                            <Slider
                                id="start-level-slider"
                                min={START_LEVEL}
                                max={MAX_START_LEVEL}
                                step={1}
                                value={[startLevel]}
                                onValueChange={(value) => setStartLevel(value[0] ?? START_LEVEL)}
                                className="w-full"
                                disabled={isLoading}
                            />
                        </div>

                        <Button
                            size="lg"
                            onClick={startGame}
                            className="gap-2"
                            disabled={isLoading}
                        >
                            {isLoading ? (
                                <Loader2 className="w-5 h-5 animate-spin" />
                            ) : (
                                <PlayCircle className="w-5 h-5" />
                            )}
                            {isLoading ? t('starting') : t('startGame')}
                        </Button>
                    </div>
                )}

                {showResults && (
                    <div className="absolute inset-0 flex items-center justify-center bg-surface/95 backdrop-blur-sm rounded-tile overflow-y-auto scrollbar-none">
                        <div className="bg-surface-card p-6 rounded-card shadow-md space-y-4 text-center w-11/12 max-w-sm my-4">
                            <h3 className="font-serif-display text-patient-heading text-ink mb-4">
                                {t('gameOver')}
                            </h3>
                            <p className="text-4xl text-primary" aria-hidden="true">
                                {'★'.repeat(blockStars)}
                                {'☆'.repeat(5 - blockStars)}
                            </p>
                            <div className="space-y-2 text-left w-full text-patient-body text-ink">
                                <p className="flex justify-between gap-4">
                                    <span>{t('finalScore')}:</span>
                                    <span className="font-bold">{score}</span>
                                </p>
                                <p className="flex justify-between gap-4">
                                    <span>{t('bestScore')}:</span>
                                    <span className="font-bold">{bestScore}</span>
                                </p>
                            </div>

                            <div className="flex gap-2 justify-center mt-6">
                                <Button onClick={startGame}>{t('playAgain')}</Button>
                                <Button
                                    variant="outline"
                                    onClick={() => setShowShareModal(true)}
                                >
                                    {t('share')}
                                </Button>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            <ShareModal
                isOpen={showShareModal}
                onClose={() => setShowShareModal(false)}
            />
        </div>
    )
}

function calculateLevelScore(currentLevel: number, roundStartTime: number) {
    const baseScore = currentLevel * 10
    const speedBonus = roundStartTime && Date.now() - roundStartTime <= 3000 ? 10 : 0

    return baseScore + speedBonus
}

function createInitialBlocks(): Block[] {
    return Array.from({ length: 9 }, (_, i) => ({
        id: i,
        isHighlighted: false,
        isError: false,
        isCorrect: false,
    }))
}

function generatePattern(length: number): number[] {
    const pattern: number[] = []

    while (pattern.length < length) {
        pattern.push(generateNextBlockId(pattern.at(-1)))
    }

    return pattern
}

function generateNextBlockId(previousBlockId?: number) {
    let nextBlockId = Math.floor(Math.random() * 9)

    while (nextBlockId === previousBlockId) {
        nextBlockId = Math.floor(Math.random() * 9)
    }

    return nextBlockId
}

function wait(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms))
}
