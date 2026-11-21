import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
const contents = (name) => readFileSync(new URL('../' + name, import.meta.url), 'utf8');

test('HOD server page passes only serializable props to client entry component', () => {
  const page = contents('src/app/admin/[resource]/page.tsx');
  const entry = contents('src/components/hod-admin/entry.tsx');
  assert.ok(page.includes('<AdminEntry view={resource as AdminView} />'));
  assert.ok(!page.includes('<Authenticated>'));
  assert.ok(entry.startsWith("'use client';"));
  assert.ok(entry.includes('<Authenticated>'));
});

test('role checks are server-authoritative and precede protected page renders', () => {
  const guard = contents('src/lib/server/page-access.ts');
  assert.ok(guard.includes('nativeOrmTransaction('));
  assert.ok(guard.includes('authorizePrismaSession(tx, token)'));
  assert.doesNotMatch(guard, /lab\.identity_call\(/);
  assert.ok(guard.includes('allowed.includes(role)'));
  assert.ok(guard.includes('notFound()'));
  assert.ok(guard.includes("redirect('/login')"));
  for (const [path, role] of [
    ['src/app/admin/[resource]/page.tsx', "['ADMIN']"],
    ['src/app/operations/page.tsx', "['TECHNICAL_OFFICER']"],
    ['src/app/inventory/page.tsx', 'requirePageRole()'],
    ['src/app/workspace/page.tsx', 'requirePageRole()'],
    ['src/app/borrowing/page.tsx', 'requirePageRole()'],
  ]) {
    const page = contents(path);
    assert.ok(page.includes('requirePageRole(' + (role === 'requirePageRole()' ? '' : role)), path);
  }
  assert.ok(contents('src/app/borrowing/page.tsx').includes('allowedBorrowingView('));
  assert.ok(contents('src/app/design-system/page.tsx').includes('notFound()'));
});
