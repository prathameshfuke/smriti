import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({ route: 'alerts', status: 'not-implemented' });
}
