import { sourceContains } from './source-assert.mjs';
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
    '/api/admin/reports?report=overdue',
    '"inspections"',
    '"history"',
    '"policies"',
    '"adjustments"',
    '/api/admin/reports',
  ])
    assert.ok(sourceContains(source, token), token);
  assert.ok(sourceContains(source, 'request.borrowerId===session.user.id?[]'));
  assert.ok(sourceContains(source, 'line.stage==="HOD"&&line.hodId===session.user.id'));
  const inventoryOps = readFileSync(
    new URL('../src/components/inventory/inventory.tsx', import.meta.url), 'utf8'
  );
  // Approval safeguards now live in the dedicated Stock Adjustments flow.
  assert.ok(sourceContains(inventoryOps, 'row.proposer === session.user.id'));
  assert.ok(sourceContains(inventoryOps, 'Review independent approval'));
  assert.ok(
    sourceContains(source, 'administrator authority never bypasses approval or handover conflicts')
  );
  assert.ok(sourceContains(source, 'UNCONFIGURED'));
});

test('reports integrate all mandatory server filters and real CSV/XLSX exports', () => {
  const source = readFileSync(
    new URL('../src/components/hod-admin/report-filters.tsx', import.meta.url),
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
    assert.ok(sourceContains(source, filter), filter);
  const exports = readFileSync(new URL('../src/components/hod-admin/workspace.tsx', import.meta.url), 'utf8');
  assert.ok(sourceContains(exports, '&format=${format}'));
  assert.ok(sourceContains(exports, "format: 'csv' | 'xlsx'"));
  assert.ok(sourceContains(exports, "'csv' | 'xlsx'"));
  assert.ok(sourceContains(exports, "value='operations'"));
  assert.ok(sourceContains(exports, 'value="security"'));
});

test('admin shell follows reference dimensions and compact responsive composition', () => {
  const shell = readFileSync(
    new URL('../src/components/identity/session.tsx', import.meta.url),
    'utf8'
  );
  const css = readFileSync(new URL('../src/app/workspace.css', import.meta.url), 'utf8');
  assert.ok(sourceContains(shell, 'AdminNavigation'));
  assert.ok(sourceContains(shell, 'admin-shell'));
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
    assert.ok(sourceContains(css, token), token);
});

test('admin routes prioritize the HOD workspace while preserving official branding', () => {
  const route = readFileSync(
    new URL('../src/app/admin/[resource]/page.tsx', import.meta.url),
    'utf8'
  );
  const workspace = readFileSync(new URL('../src/components/workspace-home.tsx', import.meta.url), 'utf8');
  const shell = readFileSync(
    new URL('../src/components/identity/session.tsx', import.meta.url),
    'utf8'
  );
  assert.ok(sourceContains(route, 'adminViews.includes'));
  // Server page gates authorization; client entry owns the render-prop.
  const entry = readFileSync(
    new URL('../src/components/hod-admin/entry.tsx', import.meta.url), 'utf8'
  );
  assert.ok(sourceContains(route, '<AdminEntry'));
  assert.ok(sourceContains(route, "requirePageRole(['ADMIN'])"));
  assert.ok(sourceContains(entry, '<AdminWorkspace'));
  assert.ok(
    workspace.indexOf("includes('ADMIN')") < workspace.indexOf("includes('TECHNICAL_OFFICER')")
  );
  assert.ok(sourceContains(shell, 'src="/foe-logo.png"'));
});
