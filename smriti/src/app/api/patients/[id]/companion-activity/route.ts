import { authenticateRequest } from '@/lib/supabase/server-auth';

const LIMIT = 10;

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

  const { data: owned } = await supabase
    .from('patients')
    .select('id')
    .eq('id', patientId)
    .eq('caregiver_id', caregiver.id)
    .single();
  if (!owned) return Response.json({ error: 'not_found' }, { status: 404 });

  const { data: rows } = await supabase
    .from('ai_conversation_log')
    .select('id, question, answer, grounded, flagged_for_followup, created_at')
    .eq('patient_id', patientId)
    .order('created_at', { ascending: false })
    .limit(LIMIT);

  const questions = (rows ?? []).map((r) => ({
    id: r.id,
    question: r.question,
    answer: r.answer,
    grounded: r.grounded,
    flaggedForFollowup: r.flagged_for_followup,
    createdAt: r.created_at,
  }));

  return Response.json({ questions });
}
