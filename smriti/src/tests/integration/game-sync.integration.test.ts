import { describe, it, expect, afterEach } from 'vitest';
import { createBrowserClient, createServiceRoleClient } from '@/lib/supabase/client';
import { POST as syncRoute } from '@/app/api/sync/route';

/**
 * Real Supabase integration test for the caregiver dashboard sync path — no
 * vi.mock() anywhere in this file. Drives a played round through the exact
 * same /api/sync POST handler the app calls, against the real project, then
 * reads the real rows back to prove they actually landed — the thing the
 * caregiver dashboard's "0/7 sessions" bug turned out to hinge on.
 *
 * Setup uses the service-role client to seed a real auth user, caregiver and
 * patient (bypassing RLS, same as any test fixture would); the sync call
 * itself goes through the route with a real Bearer access token, so RLS is
 * genuinely exercised for the part that matters.
 */
describe('Game session sync against the real Supabase project', () => {
  const cleanup: Array<() => Promise<void>> = [];

  afterEach(async () => {
    while (cleanup.length > 0) {
      await cleanup.pop()!();
    }
  });

  it('POST /api/sync writes real game_sessions, telemetry_events and daily_summaries rows', async () => {
    const admin = createServiceRoleClient();
    const email = `smriti-test-${crypto.randomUUID()}@example.com`;

    const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
      type: 'magiclink',
      email,
    });
    expect(linkError).toBeNull();
    const authUserId = linkData.user!.id;
    cleanup.push(async () => {
      await admin.auth.admin.deleteUser(authUserId);
    });

    const browserClient = createBrowserClient();
    const { data: verifyData, error: verifyError } = await browserClient.auth.verifyOtp({
      email,
      token: linkData.properties!.email_otp!,
      type: 'email',
    });
    expect(verifyError).toBeNull();
    const accessToken = verifyData.session!.access_token;

    const caregiverId = crypto.randomUUID();
    const patientId = crypto.randomUUID();
    const now = new Date().toISOString();
    const today = now.slice(0, 10);

    const { error: caregiverError } = await admin.from('caregivers').insert({
      id: caregiverId,
      auth_id: authUserId,
      display_name: 'Integration Test Caregiver',
      phone: null,
      email,
      role: 'family',
      preferred_language: 'en',
    });
    expect(caregiverError).toBeNull();
    cleanup.push(async () => {
      await admin.from('caregivers').delete().eq('id', caregiverId);
    });

    const { error: patientError } = await admin.from('patients').insert({
      id: patientId,
      caregiver_id: caregiverId,
      display_name: 'Integration Test Patient',
      age_years: 70,
      gender: 'female',
      education_years: 8,
      primary_language: 'en',
      session_duration_minutes: 10,
      is_active: true,
    });
    expect(patientError).toBeNull();
    cleanup.push(async () => {
      await admin.from('patients').delete().eq('id', patientId);
    });

    const sessionId = crypto.randomUUID();
    const eventId = crypto.randomUUID();
    const summaryId = crypto.randomUUID();
    cleanup.push(async () => {
      await admin.from('daily_summaries').delete().eq('id', summaryId);
      await admin.from('telemetry_events').delete().eq('id', eventId);
      await admin.from('game_sessions').delete().eq('id', sessionId);
    });

    const request = new Request('http://localhost/api/sync', {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        deviceId: 'integration-test-device',
        lastSyncTimestamp: null,
        patients: [
          {
            patientId,
            sessions: [{ id: sessionId, patient_id: patientId, started_at: now, ended_at: now, device_id: 'integration-test-device' }],
            events: [
              {
                id: eventId,
                session_id: sessionId,
                patient_id: patientId,
                game_type: 'path_match',
                difficulty_level: 1,
                round_number: 1,
                is_correct: true,
                response_time_ms: 1200,
                event_timestamp: now,
                metadata: {},
              },
            ],
            dailySummaries: [
              {
                id: summaryId,
                patient_id: patientId,
                summary_date: today,
                game_type: 'path_match',
                total_rounds: 1,
                correct_rounds: 1,
                avg_response_time_ms: 1200,
                max_difficulty_reached: 1,
                session_count: 1,
                elo_rating: null,
              },
            ],
            reminderAcks: [],
          },
        ],
      }),
    });

    const response = await syncRoute(request);
    expect(response.status).toBe(200);
    const responseBody = await response.json();
    expect(responseBody.syncErrors).toEqual({});
    expect(responseBody.syncedEventCount).toBe(1);

    // Prove the rows are really there, not just that the route said 200.
    const { data: sessionRow } = await admin.from('game_sessions').select('*').eq('id', sessionId).single();
    expect(sessionRow?.patient_id).toBe(patientId);

    const { data: eventRow } = await admin.from('telemetry_events').select('*').eq('id', eventId).single();
    expect(eventRow?.is_correct).toBe(true);

    const { data: summaryRow } = await admin
      .from('daily_summaries')
      .select('*')
      .eq('id', summaryId)
      .single();
    expect(summaryRow?.total_rounds).toBe(1);
    expect(summaryRow?.correct_rounds).toBe(1);
    // This dashboard reads this exact column for "today's accuracy" — the
    // original bug's symptom lived right here.
    expect(Number(summaryRow?.accuracy_pct)).toBe(100);
  }, 20000);
});
