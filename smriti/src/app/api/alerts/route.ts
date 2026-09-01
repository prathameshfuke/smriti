import { authenticateRequest } from '@/lib/supabase/server-auth';

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

  const { data: alerts } = await supabase
    .from('alerts')
    .select('*')
    .eq('caregiver_id', caregiver.id)
    .order('created_at', { ascending: false });

  return Response.json({ alerts: alerts ?? [] });
}
