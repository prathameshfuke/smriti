import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({ route: 'patients', status: 'not-implemented' });
}
