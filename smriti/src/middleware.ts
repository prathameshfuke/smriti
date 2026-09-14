import { NextResponse } from 'next/server';

/**
 * Device trust check must happen in the browser (middleware runs on the
 * server and cannot access IndexedDB) — this is a placeholder for future
 * auth checks that don't need the request, not dead code.
 */
export function middleware() {
  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|public).*)',
  ],
};
