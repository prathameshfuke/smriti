import { authenticateRequest } from '@/lib/supabase/server-auth';

/** Trailing window, not a Monday–Sunday calendar week — same rolling-range
 * convention as the cognitive-score dashboard (see cognitiveScore.ts). */
const WINDOW_DAYS = 7;

export interface LeaderboardEntry {
  rank: number;
  patientId: string;
  displayName: string;
  /** Sum of `correct_rounds` across every game/day in the window. */
  points: number;
  /** Sum of `session_count` across every game/day in the window. */
  gamesPlayed: number;
}

/**
 * Caregiver-only weekly leaderboard: points (correct answers) and games
 * played, ranked, for the logged-in caregiver's own patients only. Never
 * exposed to patients and never spans other caregivers/families — this
 * app's accessibility spec forbids patient-facing rankings (see
 * lib/leaderboard.ts), so this stays a caregiver-dashboard-only view built
 * for old-age-home staff tracking their own residents.
 */
export async function GET(request: Request) {
  const auth = await authenticateRequest(request);
  if (!auth) return Response.json({ error: 'unauthorized' }, { status: 401 });

  const { supabase, userId } = auth;

  const { data: caregiver } = await supabase
    .from('caregivers')
    .select('id')
    .eq('auth_id', userId)
    .single();
  if (!caregiver) return Response.json({ error: 'caregiver_not_found' }, { status: 404 });

  const { data: patients } = await supabase
    .from('patients')
    .select('id, display_name')
    .eq('caregiver_id', caregiver.id)
    .eq('is_active', true);

  const ownedPatients = patients ?? [];
  if (ownedPatients.length === 0) return Response.json({ leaderboard: [] });

  const patientIds = ownedPatients.map((p) => p.id);
  const since = new Date();
  since.setDate(since.getDate() - (WINDOW_DAYS - 1));
  const sinceStr = since.toISOString().slice(0, 10);

  const { data: summaries } = await supabase
    .from('daily_summaries')
    .select('patient_id, correct_rounds, session_count')
    .in('patient_id', patientIds)
    .gte('summary_date', sinceStr);

  const totals = new Map<string, { points: number; gamesPlayed: number }>();
  for (const p of ownedPatients) totals.set(p.id, { points: 0, gamesPlayed: 0 });
  for (const row of summaries ?? []) {
    const entry = totals.get(row.patient_id);
    if (!entry) continue;
    entry.points += row.correct_rounds ?? 0;
    entry.gamesPlayed += row.session_count ?? 0;
  }

  const leaderboard: LeaderboardEntry[] = ownedPatients
    .map((p) => {
      const totalsForPatient = totals.get(p.id) ?? { points: 0, gamesPlayed: 0 };
      return {
        rank: 0,
        patientId: p.id,
        displayName: p.display_name,
        points: totalsForPatient.points,
        gamesPlayed: totalsForPatient.gamesPlayed,
      };
    })
    // Points desc, then games played desc, then name — stable and deterministic.
    .sort((a, b) => b.points - a.points || b.gamesPlayed - a.gamesPlayed || a.displayName.localeCompare(b.displayName))
    .map((entry, i) => ({ ...entry, rank: i + 1 }));

  return Response.json({ leaderboard });
}
