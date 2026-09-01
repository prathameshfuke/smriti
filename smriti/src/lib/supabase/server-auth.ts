import { createServerClient } from './client';

/** No cookie session available on a fetch-based API call — auth is bearer-token only. */
const NO_OP_COOKIE_STORE = { getAll: () => [], set: () => undefined };

export interface AuthenticatedRequest {
  userId: string;
  /** Scoped with the caller's JWT, so RLS applies on every `.from()` query too. */
  supabase: ReturnType<typeof createServerClient>;
}

/**
 * Validates the Bearer token on an API route request. Every route in
 * `src/app/api/*` calls this first and returns 401 on `null`.
 */
export async function authenticateRequest(request: Request): Promise<AuthenticatedRequest | null> {
  const header = request.headers.get('authorization') ?? request.headers.get('Authorization');
  if (!header?.startsWith('Bearer ')) return null;
  const token = header.slice('Bearer '.length);
  if (!token) return null;

  try {
    const supabase = createServerClient(NO_OP_COOKIE_STORE, { authorization: header });
    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data.user) return null;
    return { userId: data.user.id, supabase };
  } catch {
    return null;
  }
}
