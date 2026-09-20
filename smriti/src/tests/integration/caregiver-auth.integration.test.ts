import { describe, it, expect, afterEach } from 'vitest';
import { createBrowserClient, createServiceRoleClient } from '@/lib/supabase/client';

/**
 * Skipped unless real credentials are present. Without
 * NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY /
 * SUPABASE_SERVICE_ROLE_KEY (vitest.config.ts loads .env.local), these
 * cannot run at all, and failing them on a fresh checkout hides real
 * regressions in the noise. A run WITH those variables still executes them
 * exactly as before.
 */
const HAS_SUPABASE_CREDENTIALS = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY &&
    process.env.SUPABASE_SERVICE_ROLE_KEY,
);

/**
 * Real Supabase integration test — no vi.mock() anywhere in this file.
 *
 * Runs against whatever project NEXT_PUBLIC_SUPABASE_URL/ANON_KEY and
 * SUPABASE_SERVICE_ROLE_KEY (loaded from .env.local by vitest.config.ts)
 * actually point at. It proves the exact mechanism the caregiver login page
 * depends on — signInWithOtp's code being independently verifiable via
 * verifyOtp — against the real Auth API, not a hand-written stand-in for it.
 *
 * admin.generateLink() creates the user AND returns the real one-time code
 * (`email_otp`) without sending an email, so this needs no inbox to read
 * and sends no real email on every run. Every created user is deleted in
 * `afterEach`, so this leaves nothing behind in the project between runs.
 */
describe.skipIf(!HAS_SUPABASE_CREDENTIALS)('Caregiver auth against the real Supabase project', () => {
  const createdUserIds: string[] = [];

  afterEach(async () => {
    const admin = createServiceRoleClient();
    while (createdUserIds.length > 0) {
      const id = createdUserIds.pop()!;
      await admin.auth.admin.deleteUser(id);
    }
  });

  it('verifyOtp establishes a real session for a code obtained independently of signInWithOtp', async () => {
    const email = `smriti-test-${crypto.randomUUID()}@example.com`;
    const admin = createServiceRoleClient();

    const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
      type: 'magiclink',
      email,
    });
    expect(linkError).toBeNull();
    if (linkData.user) createdUserIds.push(linkData.user.id);

    const otp = linkData.properties?.email_otp;
    expect(otp).toBeTruthy();

    // This is the exact call the login page makes after the caregiver types
    // the code they were emailed.
    const browserClient = createBrowserClient();
    const { data: verifyData, error: verifyError } = await browserClient.auth.verifyOtp({
      email,
      token: otp!,
      type: 'email',
    });

    expect(verifyError).toBeNull();
    expect(verifyData.session?.access_token).toBeTruthy();
    expect(verifyData.session?.user.email).toBe(email);
  }, 20000);

  it('verifyOtp rejects a wrong code, matching the login page\'s error path', async () => {
    const email = `smriti-test-${crypto.randomUUID()}@example.com`;
    const admin = createServiceRoleClient();

    const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
      type: 'magiclink',
      email,
    });
    expect(linkError).toBeNull();
    if (linkData.user) createdUserIds.push(linkData.user.id);

    const browserClient = createBrowserClient();
    const { data: verifyData, error: verifyError } = await browserClient.auth.verifyOtp({
      email,
      token: '000000',
      type: 'email',
    });

    expect(verifyError).not.toBeNull();
    expect(verifyData.session).toBeNull();
  }, 20000);
});
