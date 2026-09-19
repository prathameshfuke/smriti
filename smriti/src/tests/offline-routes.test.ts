import { readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { describe, expect, it } from 'vitest';
import { OFFLINE_ROUTES } from '@/lib/pwa/offlineRoutes';

const APP_DIR = join(__dirname, '..', 'app');

function staticPages(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      if (name === 'api' || name.includes('[')) continue;
      out.push(...staticPages(full));
    } else if (name === 'page.tsx') {
      const route = '/' + relative(APP_DIR, dir).split(sep).join('/');
      out.push(route === '/' ? '/' : route.replace(/\/$/, ''));
    }
  }
  return out;
}

describe('OFFLINE_ROUTES', () => {
  it('lists every static page so each one opens offline', () => {
    expect([...OFFLINE_ROUTES].sort()).toEqual(staticPages(APP_DIR).sort());
  });
});
