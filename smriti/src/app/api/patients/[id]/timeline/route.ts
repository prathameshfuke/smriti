import { authenticateRequest } from '@/lib/supabase/server-auth';

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

  // `game_type` is already the canonical GameType union (see
  // lib/supabase/types.ts) — this used to run through `GAME_TYPE_MAP` to
  // translate into ScoreGraph's own narrower vocabulary (`word_recall`,
  // `path_trace`, ...). Every dashboard chart is now typed on the same
  // canonical union, so there is nothing left to translate.
  const points = (rows ?? []).map((r) => ({
    date: r.summary_date,
    accuracy: r.accuracy_pct,
    gameType: r.game_type,
    maxDifficultyReached: r.max_difficulty_reached,
  }));

  return Response.json({ points });
}
