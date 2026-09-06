import { authenticateRequest } from '@/lib/supabase/server-auth';

type RouteContext = { params: Promise<{ id: string }> };

/** Caregiver-side moderation queue: list notes awaiting review for one patient. */
export async function GET(request: Request, { params }: RouteContext) {
  const { id: patientId } = await params;
  const auth = await authenticateRequest(request);
  if (!auth) return Response.json({ error: 'unauthorized' }, { status: 401 });

  const { supabase, userId } = auth;
  const { data: caregiver } = await supabase.from('caregivers').select('id').eq('auth_id', userId).single();
  if (!caregiver) return Response.json({ error: 'caregiver_not_found' }, { status: 404 });

  const { data: patient } = await supabase
    .from('patients')
    .select('id')
    .eq('id', patientId)
    .eq('caregiver_id', caregiver.id)
    .single();
  if (!patient) return Response.json({ error: 'patient_not_found' }, { status: 404 });

  const { data: notes } = await supabase
    .from('family_notes')
    .select('id, text, status, created_at')
    .eq('patient_id', patientId)
    .eq('status', 'pending')
    .order('created_at', { ascending: true });

  return Response.json({ notes: notes ?? [] });
}

interface ModerateRequestBody {
  noteId: string;
  action: 'approve' | 'reject';
}

/** Caregiver approves or rejects one pending note. */
export async function PATCH(request: Request, { params }: RouteContext) {
  const { id: patientId } = await params;
  const auth = await authenticateRequest(request);
  if (!auth) return Response.json({ error: 'unauthorized' }, { status: 401 });

  let body: ModerateRequestBody;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'invalid_json' }, { status: 400 });
  }
  if (!body?.noteId || (body.action !== 'approve' && body.action !== 'reject')) {
    return Response.json({ error: 'invalid_body' }, { status: 400 });
  }

  const { supabase, userId } = auth;
  const { data: caregiver } = await supabase.from('caregivers').select('id').eq('auth_id', userId).single();
  if (!caregiver) return Response.json({ error: 'caregiver_not_found' }, { status: 404 });

  const { data: patient } = await supabase
    .from('patients')
    .select('id')
    .eq('id', patientId)
    .eq('caregiver_id', caregiver.id)
    .single();
  if (!patient) return Response.json({ error: 'patient_not_found' }, { status: 404 });

  const nextStatus = body.action === 'approve' ? 'approved' : 'rejected';
  const { error } = await supabase
    .from('family_notes')
    .update({ status: nextStatus })
    .eq('id', body.noteId)
    .eq('patient_id', patientId);
  if (error) return Response.json({ error: 'update_failed' }, { status: 500 });

  return Response.json({ status: nextStatus });
}
