import { NextRequest, NextResponse } from 'next/server';

export function middleware(request: NextRequest) {
  // Middleware runs on the server, cannot access IndexedDB.
  // Device trust check must happen in the browser (client-side).
  // This middleware serves as a placeholder for future auth checks.
  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|public).*)',
  ],
};
