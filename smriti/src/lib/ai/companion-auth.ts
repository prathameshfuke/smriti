import { verifyDeviceTrust } from '@/lib/auth/deviceTrustServer';
import { authenticateRequest } from '@/lib/supabase/server-auth';

export interface CompanionCaller {
  patientId: string;
  /** A kiosk phone acting for one patient, as opposed to a signed-in caregiver. */
  isPatientDevice: boolean;
}

interface AuthBody {
  /** Verified against DEVICE_TRUST_SECRET — see lib/auth/deviceTrustServer.ts. */
  deviceTrustToken?: { patientId: string; issuedAt: number; issuedBy: string; signature: string };
  /** Required with a caregiver Bearer token, which says who is asking but not about whom. */
  patientId?: string;
}

/**
 * Who may talk to Ask Smriti, and about which patient: a patient's phone
 * holding a valid device-trust token (for that token's patient only), or a
 * signed-in caregiver for a patient on their own account. Returns the error
 * Response to send otherwise.
 */
export async function authorizeCompanionCaller(request: Request, body: AuthBody): Promise<CompanionCaller | Response> {
  if (body.deviceTrustToken) {
    if (!verifyDeviceTrust(body.deviceTrustToken)) {
      return Response.json({ error: 'invalid_device_token' }, { status: 401 });
    }
    return { patientId: body.deviceTrustToken.patientId, isPatientDevice: true };
  }

  const auth = await authenticateRequest(request);
  if (!auth) return Response.json({ error: 'unauthorized' }, { status: 401 });
  if (!body.patientId) return Response.json({ error: 'missing_patient_id' }, { status: 400 });

  const { data: caregiver } = await auth.supabase.from('caregivers').select('id').eq('auth_id', auth.userId).single();
  if (!caregiver) return Response.json({ error: 'caregiver_not_found' }, { status: 404 });
  const { data: owned } = await auth.supabase
    .from('patients')
    .select('id')
    .eq('id', body.patientId)
    .eq('caregiver_id', caregiver.id)
    .single();
  if (!owned) return Response.json({ error: 'patient_not_found' }, { status: 404 });

  return { patientId: body.patientId, isPatientDevice: false };
}
