import type { GameType } from '@/lib/supabase/types';

/**
 * Every game that can produce a `daily_summaries` / `dailySummaries` row, in
 * the order the caregiver dashboard's per-game views list them.
 *
 * Single source of truth: this used to be copy-pasted in
 * `app/caregiver/patients/[id]/page.tsx` (canonical labels), and effectively
 * duplicated a second and third time by `components/ui/ScoreGraph.tsx` (its
 * own narrower `GameType` union + `GAME_LABEL` map) and
 * `app/api/patients/[id]/timeline/route.ts` (`GAME_TYPE_MAP`), both of which
 * existed only to translate into that narrower vocabulary. Now that every
 * chart is typed on the canonical `GameType` union, nothing needs the
 * translation, and every consumer (the page, the per-game breakdown chart,
 * the session calendar) imports this one copy instead of inventing another.
 */
export const CANONICAL_GAMES: GameType[] = [
  'object_hunt',
  'word_stream',
  'quick_tap',
  'path_match',
  'memory_match',
  'memory_blocks',
  'frog_leap',
  'counting_boxes',
  'n_back',
  'larger_number',
  'memory_span',
  'fish_trace',
  'double_decision',
  'reminiscence_quiz',
  'routine_recall',
];

export const GAME_LABELS: Record<GameType, string> = {
  object_hunt: 'Object Hunt',
  word_stream: 'Word Stream',
  quick_tap: 'Quick Tap',
  path_match: 'Path Match',
  memory_match: 'Memory Match',
  memory_blocks: 'Memory Blocks',
  frog_leap: 'Frog Leap',
  counting_boxes: 'Counting Boxes',
  n_back: 'N-Back',
  larger_number: 'Larger Number',
  memory_span: 'Memory Span',
  fish_trace: 'Fish Trace',
  double_decision: 'Double Decision',
  reminiscence_quiz: 'Family & Life Quiz',
  routine_recall: 'Routine Recall',
};
