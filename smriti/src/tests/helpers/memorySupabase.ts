/**
 * A tiny in-memory stand-in for the Supabase client: enough of the query
 * builder (select / eq / in / gte / lt / order / limit / single / maybeSingle
 * / insert / upsert / update / delete) for the sync route and the push
 * helpers, with real row storage so a test can assert what was written.
 */

export type Row = Record<string, unknown>;
export type Tables = Record<string, Row[]>;

type Filter = (row: Row) => boolean;

export function createMemorySupabase(tables: Tables, opts: { failInsertOn?: string[] } = {}) {
  const table = (name: string): Row[] => (tables[name] ??= []);

  const from = (name: string) => {
    const filters: Filter[] = [];
    let mode: 'select' | 'update' | 'delete' = 'select';
    let patch: Row = {};
    let orderBy: { col: string; asc: boolean } | null = null;
    let max = Infinity;

    const matching = () => table(name).filter((r) => filters.every((f) => f(r)));
    const run = (): { data: unknown; error: null | { message: string } } => {
      if (mode === 'update') {
        for (const r of matching()) Object.assign(r, patch);
        return { data: null, error: null };
      }
      if (mode === 'delete') {
        const doomed = new Set(matching());
        tables[name] = table(name).filter((r) => !doomed.has(r));
        return { data: null, error: null };
      }
      let rows = matching();
      if (orderBy) {
        const { col, asc } = orderBy;
        rows = [...rows].sort((a, b) => (String(a[col]) < String(b[col]) ? -1 : 1) * (asc ? 1 : -1));
      }
      return { data: rows.slice(0, max).map((r) => ({ ...r })), error: null };
    };

    const chain: Record<string, unknown> = {
      select: () => chain,
      eq: (c: string, v: unknown) => (filters.push((r) => r[c] === v), chain),
      in: (c: string, vs: unknown[]) => (filters.push((r) => vs.includes(r[c])), chain),
      gte: (c: string, v: string) => (filters.push((r) => String(r[c]) >= v), chain),
      lt: (c: string, v: string) => (filters.push((r) => String(r[c]) < v), chain),
      order: (col: string, o?: { ascending?: boolean }) => ((orderBy = { col, asc: o?.ascending !== false }), chain),
      limit: (n: number) => ((max = n), chain),
      update: (p: Row) => ((mode = 'update'), (patch = p), chain),
      delete: () => ((mode = 'delete'), chain),
      single: () => {
        const { data } = run();
        const first = (data as Row[])[0];
        return Promise.resolve(first ? { data: first, error: null } : { data: null, error: { message: 'no rows' } });
      },
      maybeSingle: () => Promise.resolve({ data: (run().data as Row[])[0] ?? null, error: null }),
      insert: (rows: Row | Row[]) => {
        if (opts.failInsertOn?.includes(name)) return Promise.resolve({ data: null, error: { message: 'insert failed' } });
        table(name).push(...(Array.isArray(rows) ? rows : [rows]).map((r) => ({ ...r, created_at: r.created_at ?? new Date().toISOString() })));
        return Promise.resolve({ data: null, error: null });
      },
      upsert: (rows: Row | Row[], o?: { onConflict?: string }) => {
        const keys = (o?.onConflict ?? 'id').split(',');
        for (const r of Array.isArray(rows) ? rows : [rows]) {
          const hit = table(name).find((e) => keys.every((k) => e[k] === r[k]));
          if (hit) Object.assign(hit, r);
          else table(name).push({ ...r });
        }
        return Promise.resolve({ data: null, error: null });
      },
      then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) => Promise.resolve(run()).then(resolve, reject),
    };
    return chain;
  };

  return { from, auth: { getUser: async () => ({ data: { user: { id: 'auth-1' } }, error: null }) }, tables };
}
