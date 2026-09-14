import { authenticateRequest } from '@/lib/supabase/server-auth';
import type { AlertSeverity } from '@/lib/supabase/types';
import { SCORE_WINDOW_DAYS, shiftDate, summarizeActivity, type ScoreRow } from '@/lib/dashboard/cognitiveScore';

function reduceAlertStatus(severities: AlertSeverity[]): AlertSeverity {
  if (severities.includes('red')) return 'red';
  if (severities.includes('yellow')) return 'yellow';
  return 'green';
}

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
    .select('*')
    .eq('caregiver_id', caregiver.id)
    // Removed patients (DELETE /api/patients/[id]) stay in the table for the
    // record but never come back into the caregiver's list.
    .eq('is_active', true);

  const todayStr = new Date().toISOString().slice(0, 10);
  const scoreFrom = shiftDate(todayStr, -(2 * SCORE_WINDOW_DAYS - 1));

  const results = await Promise.all(
    (patients ?? []).map(async (patient) => {
      const [{ data: summaries }, { data: alerts }] = await Promise.all([
        // Two score windows (this fortnight and the one before, for the
        // change arrow). One row per game per day, so bounded by date, not
        // by row count: the old `.limit(7)` could cover a single busy day.
        supabase
          .from('daily_summaries')
          .select('*')
          .eq('patient_id', patient.id)
          .gte('summary_date', scoreFrom)
          .order('summary_date', { ascending: false })
          .limit(500),
        supabase
          .from('alerts')
          .select('severity, is_read')
          .eq('patient_id', patient.id)
          .eq('is_resolved', false),
      ]);

      const alertStatus = reduceAlertStatus((alerts ?? []).map((a) => a.severity));
      const unreadAlertCount = (alerts ?? []).filter((a) => !a.is_read).length;

      const recentSummaries = summaries ?? [];
      const scoreRows: ScoreRow[] = recentSummaries.map((s) => {
        // `accuracy_pct` is generated in Postgres; fall back to it when the
        // raw round counts are absent so a row always carries its weight.
        const totalRounds = s.total_rounds ?? 1;
        const correctRounds = s.correct_rounds ?? ((s.accuracy_pct ?? 0) / 100) * totalRounds;
        return {
          date: s.summary_date,
          gameType: s.game_type,
          correctRounds,
          totalRounds,
          maxDifficultyReached: s.max_difficulty_reached ?? 1,
        };
      });
      const activity = summarizeActivity(scoreRows, todayStr);
      const score = activity.score;

      return {
        id: patient.id,
        caregiverId: patient.caregiver_id,
        displayName: patient.display_name,
        ageYears: patient.age_years,
        gender: patient.gender,
        primaryLanguage: patient.primary_language,
        isActive: patient.is_active,
        latestSummary: recentSummaries[0] ?? null,
        // Null when nothing was played today, so the card can say so rather
        // than show 0%.
        accuracyToday: activity.accuracyToday,
        sessionsThisWeek: activity.daysPlayedThisWeek,
        // Raw rows too: the Overview merges them with this phone's own
        // not-yet-synced games (mergeScoreRows) before showing anything.
        scoreRows,
        cognitiveScore: score
          ? { score: score.score, band: score.band, delta: score.delta, enoughData: score.enoughData }
          : null,
        week: activity.week,
        alertStatus,
        unreadAlertCount,
      };
    }),
  );

  return Response.json({ patients: results });
}
