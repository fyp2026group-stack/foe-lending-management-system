import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { lecturerViews, lecturerHref, lecturerLabels } from '../src/components/lecturer/model.ts';

test('lecturer workspace exposes six separate reference destinations', () => {
  assert.deepEqual(lecturerViews, [
    'dashboard',
    'equipment',
    'requests',
    'borrowed',
    'approvals',
    'policies',
  ]);
  assert.equal(new Set(lecturerViews.map(lecturerHref)).size, 6);
  assert.equal(lecturerLabels.approvals, 'Approval Inbox');
});

test('lecturer dashboard uses real APIs and excludes security events', () => {
  const source = readFileSync(
    new URL('../src/components/lecturer/workspace.tsx', import.meta.url),
    'utf8'
  );
  for (const path of [
    '"requests"',
    '"borrower-history"',
    '"allocations"',
    '"history"',
    '"policies"',
  ])
    assert.ok(source.includes(path), path);
  assert.ok(source.includes('!["LOGIN", "LOGOUT"].includes(event.action)'));
  assert.ok(
    source.includes('line.stage === "LECTURER"') &&
      source.includes('line.lecturerId === session.user.id')
  );
  assert.ok(source.includes('request.borrowerId === session.user.id') && source.includes('? []'));
  assert.ok(
    source.includes('<Requests') &&
      source.includes('approvals\n') &&
      source.includes('session={session}')
  );
});

test('lecturer shell keeps reference hierarchy at accepted application density', () => {
  const shell = readFileSync(
    new URL('../src/components/identity/session.tsx', import.meta.url),
    'utf8'
  );
  const css = readFileSync(new URL('../src/app/workspace.css', import.meta.url), 'utf8');
  assert.ok(shell.includes('LecturerNavigation'));
  assert.ok(shell.includes('lecturer-shell'));
  for (const token of [
    '--sidebar-width:260px',
    'height:18px',
    'height:62px',
    'font-size:27px',
    'font-size:24px',
    'font-size:23px',
    'lecturer-metrics',
    'lecturer-dashboard-grid',
    '@media(max-width:900px)',
  ])
    assert.ok(css.includes(token), token);
  assert.ok(!css.includes('.lecturer-shell .app-page-header h1{font-size:38px'));
});

test('lecturer empty states distinguish filters and offer contextual actions', () => {
  const empty = readFileSync(
    new URL('../src/components/lecturer/empty-state.tsx', import.meta.url),
    'utf8'
  );
  const requests = readFileSync(
    new URL('../src/components/lending/request-workspace.tsx', import.meta.url),
    'utf8'
  );
  const workspace = readFileSync(
    new URL('../src/components/lecturer/workspace.tsx', import.meta.url),
    'utf8'
  );
  for (const text of [
    'No approvals waiting',
    'No borrowing requests yet',
    'No saved drafts',
    'No equipment currently borrowed',
    'No borrowing activity yet',
    'No approval policies available',
    'No matching records',
    'Clear filters',
  ])
    assert.ok(empty.includes(text), text);
  assert.ok(requests.includes('kind={approvals ? "approvals" : "requests"}'));
  assert.ok(requests.includes('filtered={Boolean('));
  for (const kind of [
    'kind="approvals"',
    'kind="borrowing"',
    'kind="requests"',
    'kind="activity"',
    'kind="policies"',
  ])
    assert.ok(workspace.includes(kind), kind);
});

test('policies and help follows the authoritative guidance hierarchy with live policy data', () => {
  const source = readFileSync(
    new URL('../src/components/lecturer/workspace.tsx', import.meta.url),
    'utf8'
  );
  for (const text of [
    'Borrowing guidance',
    'Policies & Help',
    'Approval reminders',
    'Borrower selects the eligible lecturer',
    'Item-specific policies apply',
    'No self-approval',
    'Return workflow',
    'Return receipt is separate from inspection',
    'Comments are append-only',
    'Overdue equipment remains visible',
    'Item approval policies',
  ])
    assert.ok(source.includes(text), text);
  assert.ok(source.includes('useLendingChoices<Policy>("policies"'));
  assert.ok(source.includes('policy.policy.replaceAll("_", " ")'));
  assert.ok(!source.includes('How lecturer borrowing works'));
});

test('lecturer routes use the dedicated workspace rather than inventory administration', () => {
  const inventory = readFileSync(
    new URL('../src/components/inventory/inventory.tsx', import.meta.url),
    'utf8'
  );
  const lending = readFileSync(
    new URL('../src/components/lending/workflow.tsx', import.meta.url),
    'utf8'
  );
  const dashboard = readFileSync(new URL('../src/app/workspace/page.tsx', import.meta.url), 'utf8');
  assert.ok(inventory.includes('<LecturerWorkspace session={session} view="equipment"'));
  assert.ok(lending.includes('<LecturerWorkspace'));
  assert.ok(dashboard.includes('<LecturerWorkspace session={session}'));
});
