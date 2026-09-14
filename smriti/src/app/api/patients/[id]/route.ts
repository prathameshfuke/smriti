import { authenticateRequest } from '@/lib/supabase/server-auth';

type RouteContext = { params: Promise<{ id: string }> };

/**
 * Remove a patient from the caregiver's list. A soft delete (`is_active`
 * false), so game history stays for the record and the change syncs to every
 * device. Caregiver-authenticated and ownership-checked, the same pattern as
 * family-share revocation.
 */
export async function DELETE(request: Request, { params }: RouteContext) {
  const { id } = await params;
  const auth = await authenticateRequest(request);
  if (!auth) return Response.json({ error: 'unauthorized' }, { status: 401 });

  const { supabase, userId } = auth;
  const { data: caregiver } = await supabase.from('caregivers').select('id').eq('auth_id', userId).single();
  if (!caregiver) return Response.json({ error: 'caregiver_not_found' }, { status: 404 });

  const { data: patient } = await supabase
    .from('patients')
    .select('id')
    .eq('id', id)
    .eq('caregiver_id', caregiver.id)
    .single();
  if (!patient) return Response.json({ error: 'patient_not_found' }, { status: 404 });

  const { error } = await supabase.from('patients').update({ is_active: false }).eq('id', id);
  if (error) return Response.json({ error: 'update_failed' }, { status: 500 });

  return Response.json({ id, isActive: false });
}
