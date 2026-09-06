import { authenticateRequest } from '@/lib/supabase/server-auth';
import type { GameType } from '@/lib/supabase/types';

/** ScoreGraph's own GameType union predates the DB's naming for 2 of 4 games. */
const GAME_TYPE_MAP: Record<GameType, string> = {
  object_hunt: 'object_hunt',
  word_stream: 'word_recall',
  quick_tap: 'quick_tap',
  path_match: 'path_trace',
  memory_match: 'memory_match',
  memory_blocks: 'memory_blocks',
  frog_leap: 'frog_leap',
  counting_boxes: 'counting_boxes',
  n_back: 'n_back',
  larger_number: 'larger_number',
  memory_span: 'memory_span',
  fish_trace: 'fish_trace',
  double_decision: 'double_decision',
  reminiscence_quiz: 'reminiscence_quiz',
  routine_recall: 'routine_recall',
};

const RANGE_DAYS: Record<string, number> = { '30d': 30, '90d': 90, '180d': 180 };

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authenticateRequest(request);
  if (!auth) return Response.json({ error: 'unauthorized' }, { status: 401 });

  const { supabase, userId } = auth;
  const { id: patientId } = await params;

  const { data: caregiver } = await supabase
    .from('caregivers')
    .select('id')
    .eq('auth_id', userId)
    .single();
  if (!caregiver) return Response.json({ error: 'caregiver_not_found' }, { status: 404 });

  // Ownership check before any other query — same pattern as the /api/sync fix.
  const { data: owned } = await supabase
    .from('patients')
    .select('id')
    .eq('id', patientId)
    .eq('caregiver_id', caregiver.id)
    .single();
  if (!owned) return Response.json({ error: 'not_found' }, { status: 404 });

  const url = new URL(request.url);
  const range = url.searchParams.get('range') ?? '30d';
  const days = RANGE_DAYS[range] ?? 30;

  const since = new Date();
  since.setDate(since.getDate() - (days - 1));
  const sinceStr = since.toISOString().slice(0, 10);

  const { data: rows } = await supabase
    .from('daily_summaries')
    .select('summary_date, accuracy_pct, game_type, max_difficulty_reached')
    .eq('patient_id', patientId)
    .gte('summary_date', sinceStr)
    .order('summary_date', { ascending: true });

  const points = (rows ?? []).map((r) => ({
    date: r.summary_date,
    accuracy: r.accuracy_pct,
    gameType: GAME_TYPE_MAP[r.game_type],
    maxDifficultyReached: r.max_difficulty_reached,
  }));

  return Response.json({ points });
}
