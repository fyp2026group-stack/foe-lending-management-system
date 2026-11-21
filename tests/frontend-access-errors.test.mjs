import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import ts from 'typescript';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');
const moduleUrl = (source) => 'data:text/javascript;base64,' + Buffer.from(
  ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText
).toString('base64');
const identityUrl = moduleUrl(read('../src/components/identity/api.ts').replace('../display-labels', moduleUrl(read('../src/components/display-labels.ts'))));
const { inventoryWrite, InventoryError } = await import(moduleUrl(
  read('../src/components/inventory/api.ts').replace('@/components/identity/api', identityUrl)
));

test('expired inventory write navigates to sign-in and retains typed failure', async () => {
  const originalFetch = globalThis.fetch;
  const originalWindow = globalThis.window;
  const destinations = [];
  globalThis.window = { location: { pathname: '/inventory', replace: path => destinations.push(path) } };
  globalThis.fetch = async () => Response.json({ code: 'UNAUTHENTICATED' }, { status: 401 });
  try {
    await assert.rejects(inventoryWrite('receipts', {}, 'test-token'), error =>
      error instanceof InventoryError && error.status === 401);
    assert.deepEqual(destinations, ['/login']);
    globalThis.window.location.pathname = '/login';
    await assert.rejects(inventoryWrite('receipts', {}, 'test-token'), InventoryError);
    assert.deepEqual(destinations, ['/login']);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalWindow === undefined) delete globalThis.window;
    else globalThis.window = originalWindow;
  }
});

test('inventory validation errors remain on the form with row diagnostics', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => Response.json({ errors: [{ row: 2, column: 'quantity', code: 'INVALID' }] }, { status: 422 });
  try {
    await assert.rejects(inventoryWrite('imports', {}, 'test-token'), error =>
      error instanceof InventoryError && error.status === 422 && error.issues[0].row === 2);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('login surfaces all Google redirect outcomes using allowlisted messages', () => {
  const login = read('../src/components/identity/login.tsx');
  const page = read('../src/app/login/page.tsx');
  for (const code of ['unavailable', 'account', 'denied', 'expired'])
    assert.match(login, new RegExp(`${code}: '`));
  assert.match(page, /await searchParams/);
  assert.match(page, /typeof google === 'string' \? google : undefined/);
  assert.match(login, /Object.hasOwn\(googleMessages, googleStatus\)/);
  assert.match(login, /role="alert" className="login-error"/);
});
