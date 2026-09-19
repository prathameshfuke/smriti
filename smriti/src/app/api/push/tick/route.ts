import { timingSafeEqual } from 'node:crypto';
import { createServiceRoleClient } from '@/lib/supabase/client';
import { isPushConfigured } from '@/lib/push/send';
import { runReminderTick } from '@/lib/push/tick';

/**
 * Sends the reminders that are due, as Web Push, to every subscribed phone.
 *
 * Meant to be hit every ~5 minutes by an external scheduler: Vercel Cron
 * (paid plans), cron-job.org, a GitHub Actions `schedule:` workflow, or a
 * Supabase pg_cron + pg_net job. Vercel Cron sends `Authorization: Bearer
 * $CRON_SECRET` automatically; other callers can send `x-cron-secret`.
 *
 * Closed by default: with no CRON_SECRET configured it answers 503 rather
 * than running for anyone. Set PUSH_TICK_LOOKBACK_MINUTES to at least the
 * scheduler's interval plus a minute (default 6, for a 5-minute cadence).
 */

export const dynamic = 'force-dynamic';

function secretMatches(provided: string | null, secret: string): boolean {
  if (!provided) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}

async function handle(request: Request): Promise<Response> {
  const secret = process.env.CRON_SECRET;
  if (!secret) return Response.json({ error: 'cron_not_configured' }, { status: 503 });

  const bearer = request.headers.get('authorization')?.replace(/^Bearer /, '') ?? null;
  if (!secretMatches(bearer, secret) && !secretMatches(request.headers.get('x-cron-secret'), secret)) {
    return Response.json({ error: 'unauthorized' }, { status: 401 });
  }
  if (!isPushConfigured()) return Response.json({ error: 'push_not_configured' }, { status: 503 });

  const configured = Number(process.env.PUSH_TICK_LOOKBACK_MINUTES);
  const lookbackMinutes = Number.isFinite(configured) && configured > 0 ? configured : undefined;
  try {
    const result = await runReminderTick(createServiceRoleClient(), new Date(), { lookbackMinutes });
    return Response.json(result);
  } catch {
    return Response.json({ error: 'tick_failed' }, { status: 500 });
  }
}

export const GET = handle;
export const POST = handle;
