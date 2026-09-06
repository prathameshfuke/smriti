import { authenticateRequest } from '@/lib/supabase/server-auth';

const LIMIT = 12;

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authenticateRequest(request);
  if (!auth) return Response.json({ error: 'unauthorized' }, { status: 401 });

  const { supabase, userId } = auth;
  const { id: patientId } = await params;

  const { data: caregiver } = await supabase.from('caregivers').select('id').eq('auth_id', userId).single();
  if (!caregiver) return Response.json({ error: 'caregiver_not_found' }, { status: 404 });

  const { data: owned } = await supabase
    .from('patients')
    .select('id')
    .eq('id', patientId)
    .eq('caregiver_id', caregiver.id)
    .single();
  if (!owned) return Response.json({ error: 'not_found' }, { status: 404 });

  const { data: rows } = await supabase
    .from('caregiver_digests')
    .select('id, week_of, summary_text, generated_at')
    .eq('patient_id', patientId)
    .order('week_of', { ascending: false })
    .limit(LIMIT);

  const digests = (rows ?? []).map((r) => ({
    id: r.id,
    weekOf: r.week_of,
    summaryText: r.summary_text,
    generatedAt: r.generated_at,
  }));

  return Response.json({ digests });
}
