import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { adminViews, adminHref, adminGroups } from '../src/components/hod-admin/model.ts';

test('HOD/Admin exposes all eleven authoritative destinations in four groups', () => {
  assert.deepEqual(adminViews, [
    'overview',
    'reports',
    'inventory',
    'approvals',
    'adjustments',
    'users',
    'batches',
    'laboratories',
    'policies',
    'audit',
    'borrowing',
  ]);
  assert.equal(new Set(adminViews.map(adminHref)).size, 11);
  assert.deepEqual(
    adminGroups.map((group) => group.label),
    ['Department', 'Workflow & Control', 'Administration', 'Governance & Personal']
  );
});

test('HOD/Admin workspace uses real authorized APIs and preserves conflict boundaries', () => {
  const source = readFileSync(
    new URL('../src/components/hod-admin/workspace.tsx', import.meta.url),
    'utf8'
  );
  for (const token of [
    '"requests"',
    '"borrower-history"',
    '"inspections"',
    '"history"',
    '"policies"',
    '"adjustments"',
    '/api/admin/reports',
  ])
    assert.ok(source.includes(token), token);
  assert.ok(source.includes('request.borrowerId===session.user.id?[]'));
  assert.ok(source.includes('line.stage==="HOD"&&line.hodId===session.user.id'));
  assert.ok(source.includes('proposers cannot approve their own proposals'));
  assert.ok(
    source.includes('administrator authority never bypasses approval or handover conflicts')
  );
  assert.ok(source.includes('UNCONFIGURED'));
});

test('reports integrate all mandatory server filters and real CSV/XLSX exports', () => {
  const source = readFileSync(
    new URL('../src/components/hod-admin/workspace.tsx', import.meta.url),
    'utf8'
  );
  for (const filter of [
    'batchId',
    'labId',
    'categoryId',
    'itemId',
    'borrowerId',
    'lecturerId',
    'officerId',
    'from',
    'to',
    'status',
    'stage',
    'kind',
  ])
    assert.ok(source.includes(filter), filter);
  assert.ok(source.includes('format:${format}') || source.includes('format=${format}'));
  assert.ok(source.includes('"csv"|"xlsx"'));
  assert.ok(source.includes('scope:"operations"') || source.includes('value="operations"'));
  assert.ok(source.includes('value="security"'));
});

test('admin shell follows reference dimensions and compact responsive composition', () => {
  const shell = readFileSync(
    new URL('../src/components/identity/session.tsx', import.meta.url),
    'utf8'
  );
  const css = readFileSync(new URL('../src/app/workspace.css', import.meta.url), 'utf8');
  assert.ok(shell.includes('AdminNavigation'));
  assert.ok(shell.includes('admin-shell'));
  for (const token of [
    '--sidebar-width:250px',
    'height:28px',
    'height:68px',
    'max-width:1600px',
    'font-size:26px',
    'admin-metrics',
    'admin-overview-grid',
    'admin-report-tabs',
    'admin-advanced-filters',
    '@media(max-width:480px)',
  ])
    assert.ok(css.includes(token), token);
});

test('admin routes prioritize the HOD workspace while preserving official branding', () => {
  const route = readFileSync(
    new URL('../src/app/admin/[resource]/page.tsx', import.meta.url),
    'utf8'
  );
  const workspace = readFileSync(new URL('../src/app/workspace/page.tsx', import.meta.url), 'utf8');
  const shell = readFileSync(
    new URL('../src/components/identity/session.tsx', import.meta.url),
    'utf8'
  );
  assert.ok(route.includes('adminViews.includes'));
  assert.ok(route.includes('<AdminWorkspace'));
  assert.ok(
    workspace.indexOf('includes("ADMIN")') < workspace.indexOf('includes("TECHNICAL_OFFICER")')
  );
  assert.ok(shell.includes('src="/foe-logo.png"'));
});
