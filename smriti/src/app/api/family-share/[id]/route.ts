import { authenticateRequest } from '@/lib/supabase/server-auth';
import { createServiceRoleClient } from '@/lib/supabase/client';
import { verifyFamilyShareSignature, isFamilyShareExpired } from '@/lib/family/familyShareServer';

type RouteContext = { params: Promise<{ id: string }> };

interface FamilyShareRow {
  id: string;
  patient_id: string;
  caregiver_id?: string;
  label: string;
  signature: string;
  expires_at: string;
  revoked_at: string | null;
}

/**
 * Loads and validates a share row: signature, expiry, and revocation. Used
 * by every unauthenticated family-facing route (this file's GET, and
 * notes/route.ts's POST) so the check can never drift between them.
 */
async function loadValidShare(
  service: ReturnType<typeof createServiceRoleClient>,
  shareId: string,
): Promise<FamilyShareRow | null> {
  const { data } = await service.from('family_shares').select('*').eq('id', shareId).single();
  const row = data as FamilyShareRow | null;
  if (!row) return null;
  if (row.revoked_at) return null;
  if (isFamilyShareExpired(row.expires_at)) return null;
  if (!verifyFamilyShareSignature(row.id, row.patient_id, row.expires_at, row.signature)) return null;
  return row;
}

/**
 * The read-only family view. No auth header — the share id in the URL,
 * checked against its own signature, is the credential. Response is built
 * field-by-field (never a spread of a DB row) so a future column addition
 * to `patients`/`daily_summaries`/`caregiver_digests` can't silently leak
 * through — this is the boundary the family-sharing test suite guards.
 */
export async function GET(_request: Request, { params }: RouteContext) {
  const { id } = await params;
  const service = createServiceRoleClient();

  const share = await loadValidShare(service, id);
  if (!share) return Response.json({ error: 'invalid_or_expired_share' }, { status: 401 });

  const { data: digest } = await service
    .from('caregiver_digests')
    .select('summary_text, generated_at')
    .eq('patient_id', share.patient_id)
    .order('generated_at', { ascending: false })
    .limit(1)
    .single();

  const since = new Date();
  since.setDate(since.getDate() - 7);
  const { data: summaries } = await service
    .from('daily_summaries')
    .select('summary_date')
    .eq('patient_id', share.patient_id)
    .gte('summary_date', since.toISOString().slice(0, 10));

  const sessionsThisWeek = new Set(((summaries ?? []) as Array<{ summary_date: string }>).map((s) => s.summary_date))
    .size;

  return Response.json({
    label: share.label,
    summary: digest?.summary_text ?? null,
    generatedAt: digest?.generated_at ?? null,
    sessionsThisWeek,
  });
}

/**
 * Toggle whether a family member's notes need caregiver approval before the
 * patient sees them. Caregiver-authenticated, ownership-checked — same
 * pattern as DELETE below; the only mutable field on a share post-issuance.
 */
export async function PATCH(request: Request, { params }: RouteContext) {
  const { id } = await params;
  const auth = await authenticateRequest(request);
  if (!auth) return Response.json({ error: 'unauthorized' }, { status: 401 });

  const body = (await request.json()) as { reviewRequired?: unknown };
  if (typeof body.reviewRequired !== 'boolean') {
    return Response.json({ error: 'invalid_body' }, { status: 400 });
  }

  const { supabase, userId } = auth;
  const { data: caregiver } = await supabase.from('caregivers').select('id').eq('auth_id', userId).single();
  if (!caregiver) return Response.json({ error: 'caregiver_not_found' }, { status: 404 });

  const { data: share } = await supabase
    .from('family_shares')
    .select('id')
    .eq('id', id)
    .eq('caregiver_id', caregiver.id)
    .single();
  if (!share) return Response.json({ error: 'share_not_found' }, { status: 404 });

  const { error } = await supabase
    .from('family_shares')
    .update({ review_required: body.reviewRequired })
    .eq('id', id);
  if (error) return Response.json({ error: 'update_failed' }, { status: 500 });

  return Response.json({ reviewRequired: body.reviewRequired });
}

/** Revoke. Caregiver-authenticated, ownership-checked — same as issuance. */
export async function DELETE(request: Request, { params }: RouteContext) {
  const { id } = await params;
  const auth = await authenticateRequest(request);
  if (!auth) return Response.json({ error: 'unauthorized' }, { status: 401 });

  const { supabase, userId } = auth;
  const { data: caregiver } = await supabase.from('caregivers').select('id').eq('auth_id', userId).single();
  if (!caregiver) return Response.json({ error: 'caregiver_not_found' }, { status: 404 });

  const { data: share } = await supabase
    .from('family_shares')
    .select('id')
    .eq('id', id)
    .eq('caregiver_id', caregiver.id)
    .single();
  if (!share) return Response.json({ error: 'share_not_found' }, { status: 404 });

  const { error } = await supabase
    .from('family_shares')
    .update({ revoked_at: new Date().toISOString() })
    .eq('id', id);
  if (error) return Response.json({ error: 'revoke_failed' }, { status: 500 });

  return Response.json({ revoked: true });
}
