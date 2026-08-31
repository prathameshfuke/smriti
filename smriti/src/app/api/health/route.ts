import { NextResponse } from 'next/server';

/**
 * Placeholder. 501 rather than 200 so a client — or the sync queue — can tell
 * "not built yet" from "handled successfully", which a 200 would hide.
 */
export async function GET() {
  return NextResponse.json(
    { route: 'health', status: 'not-implemented' },
    { status: 501 },
  );
}
