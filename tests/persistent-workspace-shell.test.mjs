import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
test('protected routes share one persistent authenticated layout', () => {
  const root = readFileSync(new URL('../src/app/layout.tsx', import.meta.url), 'utf8');
  const boundary = readFileSync(new URL('../src/components/identity/app-session-shell.tsx', import.meta.url), 'utf8');
  const shell = readFileSync(new URL('../src/components/identity/session.tsx', import.meta.url), 'utf8');
  assert.ok(root.includes('<AppSessionShell>{children}</AppSessionShell>'));
  assert.ok(boundary.includes('<WorkspaceSessionContext.Provider value={session}>'));
  assert.ok(boundary.includes("pathname === '/login'"));
  assert.ok(shell.includes('if (inheritedSession) return <>{children(inheritedSession)}</>;'));
  assert.ok(shell.includes('if (inheritedSession) return;'));
});
