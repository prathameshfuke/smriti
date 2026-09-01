import { authenticateRequest } from '@/lib/supabase/server-auth';
import type { AlertSeverity } from '@/lib/supabase/types';

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
    .eq('caregiver_id', caregiver.id);

  const todayStr = new Date().toISOString().slice(0, 10);

  const results = await Promise.all(
    (patients ?? []).map(async (patient) => {
      const [{ data: summaries }, { data: alerts }] = await Promise.all([
        // Last 7 rows, not just the latest: dashboard needs both "today's
        // accuracy" and "distinct days played this week" from one query.
        supabase
          .from('daily_summaries')
          .select('*')
          .eq('patient_id', patient.id)
          .order('summary_date', { ascending: false })
          .limit(7),
        supabase
          .from('alerts')
          .select('severity, is_read')
          .eq('patient_id', patient.id)
          .eq('is_resolved', false),
      ]);

      const alertStatus = reduceAlertStatus((alerts ?? []).map((a) => a.severity));
      const unreadAlertCount = (alerts ?? []).filter((a) => !a.is_read).length;

      const recentSummaries = summaries ?? [];
      const accuracyToday =
        recentSummaries.find((s) => s.summary_date === todayStr)?.accuracy_pct ?? 0;
      const sessionsThisWeek = new Set(recentSummaries.map((s) => s.summary_date)).size;

      return {
        id: patient.id,
        caregiverId: patient.caregiver_id,
        displayName: patient.display_name,
        ageYears: patient.age_years,
        gender: patient.gender,
        primaryLanguage: patient.primary_language,
        isActive: patient.is_active,
        latestSummary: recentSummaries[0] ?? null,
        accuracyToday,
        sessionsThisWeek,
        alertStatus,
        unreadAlertCount,
      };
    }),
  );

  return Response.json({ patients: results });
}
