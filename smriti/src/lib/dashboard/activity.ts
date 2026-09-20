import type { GameType } from '@/lib/supabase/types';
import { MAX_LEVEL } from '@/lib/engine/difficulty';
import { TARGET_ACCURACY_MAX, TARGET_ACCURACY_MIN } from '@/lib/engine/adaptive';
import { shiftDate } from './cognitiveScore';
import type { TrendPoint } from './trend';

/**
 * How much a patient is actually using the app, and at what level — the two
 * questions a caregiver or health worker asks that accuracy alone cannot
 * answer. A flat accuracy line means one thing if the patient played every
 * day at a rising level, and quite another if they played twice and the
 * level was dropped underneath them.
 *
 * Pure functions over `TrendPoint`s, like the rest of `lib/dashboard` — the
 * hooks read Dexie, these only do arithmetic.
 */

export interface ActivityDay {
  date: string;
  /** Sessions started that day across all games; 0 for a day not played. */
  sessions: number;
  rounds: number;
}

export interface ActivitySummary {
  days: ActivityDay[];
  daysPlayed: number;
  totalSessions: number;
  totalRounds: number;
  /** Rounds per day over the whole window, days not played included. */
  averageRoundsPerDay: number;
  /** Days since the last day with any play; null when they have never played. */
  daysSinceLastPlayed: number | null;
}

/** After this many days with nothing played, the dashboard says so. */
export const INACTIVITY_ALERT_DAYS = 4;

export function summarizeActivityLevel(points: TrendPoint[], today: string, windowDays = 14): ActivitySummary {
  const from = shiftDate(today, -(windowDays - 1));
  const byDate = new Map<string, ActivityDay>();
  for (let i = 0; i < windowDays; i += 1) {
    const date = shiftDate(from, i);
    byDate.set(date, { date, sessions: 0, rounds: 0 });
  }

  let lastPlayed: string | null = null;
  for (const p of points) {
    if (p.date < from || p.date > today) continue;
    const day = byDate.get(p.date);
    if (!day) continue;
    day.sessions += p.sessionCount;
    day.rounds += p.totalRounds;
    if (p.totalRounds > 0 && (!lastPlayed || p.date > lastPlayed)) lastPlayed = p.date;
  }

  const days = [...byDate.values()];
  const totalRounds = days.reduce((sum, d) => sum + d.rounds, 0);
  const totalSessions = days.reduce((sum, d) => sum + d.sessions, 0);

  return {
    days,
    daysPlayed: days.filter((d) => d.rounds > 0).length,
    totalSessions,
    totalRounds,
    averageRoundsPerDay: totalRounds / windowDays,
    daysSinceLastPlayed: lastPlayed ? daysBetween(lastPlayed, today) : null,
  };
}

function daysBetween(from: string, to: string): number {
  const ms = new Date(`${to}T00:00:00Z`).getTime() - new Date(`${from}T00:00:00Z`).getTime();
  return Math.round(ms / 86_400_000);
}

export interface DifficultyTrendPoint {
  date: string;
  /** Highest level reached that day, as a share of the game's cap, 0-1. */
  levelShare: number;
  level: number;
  gameType: GameType;
}

/**
 * Level over time, per game. Levels are not comparable between games — level
 * 5 of 5 in N-Back is the ceiling, level 5 of 10 in Object Hunt is halfway —
 * so the share of each game's own cap is carried alongside the raw number,
 * and that is what a combined chart should plot.
 */
export function difficultyTrend(points: TrendPoint[]): DifficultyTrendPoint[] {
  return points
    .filter((p) => MAX_LEVEL[p.gameType] > 1)
    .map((p) => ({
      date: p.date,
      level: p.maxDifficultyReached,
      levelShare: Math.min(1, p.maxDifficultyReached / MAX_LEVEL[p.gameType]),
      gameType: p.gameType,
    }))
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}

/** Where a game sits: which part of thinking it exercises. */
export type CognitiveDomain = 'memory' | 'attention' | 'speed' | 'reasoning' | 'life';

export const GAME_DOMAIN: Record<GameType, CognitiveDomain> = {
  object_hunt: 'memory',
  word_stream: 'memory',
  memory_match: 'memory',
  memory_blocks: 'memory',
  memory_span: 'memory',
  n_back: 'memory',
  path_match: 'attention',
  counting_boxes: 'attention',
  fish_trace: 'attention',
  frog_leap: 'attention',
  quick_tap: 'speed',
  double_decision: 'speed',
  larger_number: 'reasoning',
  reminiscence_quiz: 'life',
  routine_recall: 'life',
};

export const DOMAIN_LABEL: Record<CognitiveDomain, string> = {
  memory: 'Memory',
  attention: 'Attention',
  speed: 'Speed',
  reasoning: 'Numbers and reasoning',
  life: 'Daily life and family',
};

export interface DomainRow {
  domain: CognitiveDomain;
  label: string;
  accuracy: number;
  totalRounds: number;
  gamesPlayed: number;
}

/**
 * Accuracy per domain, rounds-weighted like every other aggregate here, so
 * one short game cannot swing a domain. A domain with nothing played is left
 * out entirely rather than shown as 0% — which would read as failure rather
 * than absence.
 */
export function aggregateByDomain(points: TrendPoint[]): DomainRow[] {
  const byDomain = new Map<CognitiveDomain, { correct: number; total: number; games: Set<GameType> }>();

  for (const p of points) {
    if (p.totalRounds <= 0) continue;
    const domain = GAME_DOMAIN[p.gameType];
    if (!domain) continue;
    const entry = byDomain.get(domain) ?? { correct: 0, total: 0, games: new Set<GameType>() };
    entry.correct += (p.accuracy / 100) * p.totalRounds;
    entry.total += p.totalRounds;
    entry.games.add(p.gameType);
    byDomain.set(domain, entry);
  }

  return [...byDomain.entries()]
    .map(([domain, e]) => ({
      domain,
      label: DOMAIN_LABEL[domain],
      accuracy: (e.correct / e.total) * 100,
      totalRounds: e.total,
      gamesPlayed: e.games.size,
    }))
    .sort((a, b) => b.totalRounds - a.totalRounds);
}

/**
 * Whether the games are landing where the adaptive loop aims (see
 * `lib/engine/adaptive.ts`). Too easy and the patient is not being
 * stretched; too hard and they are being set up to fail. This is what tells
 * a health worker the difficulty is working, rather than just moving.
 */
export type ChallengeFit = 'too-easy' | 'about-right' | 'too-hard' | 'unknown';

export function challengeFit(points: TrendPoint[]): { fit: ChallengeFit; accuracy: number | null } {
  const played = points.filter((p) => p.totalRounds > 0);
  if (played.length === 0) return { fit: 'unknown', accuracy: null };
  const total = played.reduce((sum, p) => sum + p.totalRounds, 0);
  const correct = played.reduce((sum, p) => sum + (p.accuracy / 100) * p.totalRounds, 0);
  const accuracy = (correct / total) * 100;
  if (accuracy > TARGET_ACCURACY_MAX) return { fit: 'too-easy', accuracy };
  if (accuracy < TARGET_ACCURACY_MIN) return { fit: 'too-hard', accuracy };
  return { fit: 'about-right', accuracy };
}
