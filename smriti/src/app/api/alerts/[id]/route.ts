import { authenticateRequest } from '@/lib/supabase/server-auth';

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authenticateRequest(request);
  if (!auth) return Response.json({ error: 'unauthorized' }, { status: 401 });

  const { supabase, userId } = auth;
  const { id } = await params;

  let body: { is_read?: boolean; is_resolved?: boolean };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'invalid_json' }, { status: 400 });
  }
  if (body.is_read === undefined && body.is_resolved === undefined) {
    return Response.json({ error: 'nothing_to_update' }, { status: 400 });
  }

  const { data: caregiver } = await supabase
    .from('caregivers')
    .select('id')
    .eq('auth_id', userId)
    .single();
  if (!caregiver) return Response.json({ error: 'caregiver_not_found' }, { status: 404 });

  const patch: { is_read?: boolean; is_resolved?: boolean; resolved_at?: string | null } = {};
  if (body.is_read !== undefined) patch.is_read = body.is_read;
  if (body.is_resolved !== undefined) {
    patch.is_resolved = body.is_resolved;
    patch.resolved_at = body.is_resolved ? new Date().toISOString() : null;
  }

  const { data, error } = await supabase
    .from('alerts')
    .update(patch)
    .eq('id', id)
    .eq('caregiver_id', caregiver.id)
    .select()
    .single();

  if (error || !data) return Response.json({ error: 'alert_not_found' }, { status: 404 });

  return Response.json({ alert: data });
}
