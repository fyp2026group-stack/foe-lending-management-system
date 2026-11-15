import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('authenticated API 401 redirects to login without changing credential failure handling', () => {
  const api = readFileSync(new URL('../src/components/identity/api.ts', import.meta.url), 'utf8');
  assert.match(api, /response\.status === 401 && path !== '\/api\/auth\/login'/);
  assert.match(api, /window\.location\.replace\('\/login'\)/);
});
test('session bootstrap does not display a dead end for an expired session', () => {
  const shell = readFileSync(new URL('../src/components/identity/session.tsx', import.meta.url), 'utf8');
  assert.match(shell, /error instanceof ApiError && error\.status === 401\) return/);
});
