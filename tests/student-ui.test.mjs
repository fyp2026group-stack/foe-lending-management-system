import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  studentCounts,
  approvalPath,
  isStudent,
  readSelection,
  basketKey,
  persistStudentSelection,
  needsStudentAttention,
  isStudentOverdue,
} from '../src/components/lending/student-model.ts';

test('student metrics distinguish mixed approvals, reservation, returned custody and overdue', () => {
  const now = Date.parse('2026-11-10T12:00:00Z');
  const drafts = [
    { cancelled: false },
    { cancelled: true },
    { cancelled: false, submittedId: 'submitted' },
  ];
  const requests = [
    {
      lines: [
        { stage: 'HOD', reservedQuantity: 0 },
        { stage: 'APPROVED', reservedQuantity: 2 },
      ],
    },
    { lines: [{ stage: 'REJECTED', reservedQuantity: 0 }] },
  ];
  const loans = [
    { quantity: 2, returned: 1, dueAt: '2026-11-09T12:00:00Z' },
    { quantity: 1, returned: 1, dueAt: '2026-11-09T12:00:00Z' },
    { quantity: 1, returned: 0, dueAt: null },
  ];
  assert.deepEqual(studentCounts(drafts, requests, loans, now), [1, 1, 1, 2, 1]);
});
test('approval paths preserve each configured route and unknown policy values', () => {
  assert.equal(approvalPath('HOD'), 'HOD');
  assert.equal(approvalPath('LECTURER'), 'Lecturer');
  assert.equal(approvalPath('BOTH'), 'Lecturer -> HOD');
  assert.equal(approvalPath('NONE'), 'No academic approval');
  assert.equal(approvalPath('UNCONFIGURED'), 'Approval requirement unavailable');
});
test('student presentation does not override explicitly assigned staff roles', () => {
  assert.equal(isStudent(['STUDENT']), true);
  assert.equal(isStudent(['STUDENT', 'ADMIN']), false);
  assert.equal(isStudent(['LECTURER']), false);
});
test('carried request choices reject malformed, duplicate, excessive and fractional quantities', () => {
  const line = {
    itemId: '10000000-0000-4000-8000-000000000001',
    labId: '10000000-0000-4000-8000-000000000002',
    locationId: '10000000-0000-4000-8000-000000000003',
    quantity: 2,
  };
  assert.deepEqual(readSelection(JSON.stringify([line])), [line]);
  for (const invalid of [
    '{',
    JSON.stringify([line, line]),
    JSON.stringify([{ ...line, quantity: 0 }]),
    JSON.stringify([{ ...line, quantity: 1.5 }]),
    JSON.stringify([{ ...line, quantity: 1001 }]),
    JSON.stringify([{ ...line, labId: 'invalid' }]),
    JSON.stringify(Array(21).fill(line)),
  ])
    assert.deepEqual(readSelection(invalid), []);
  assert.notEqual(basketKey('student-a'), basketKey('student-b'));
});

test('QA-STU-01 empty restart and remove-all clear a previously carried user selection', () => {
  const saved = new Map();
  const storage = {
    setItem: (key, value) => saved.set(key, value),
    removeItem: (key) => saved.delete(key),
  };
  const line = {
    itemId: '10000000-0000-4000-8000-000000000001',
    labId: '10000000-0000-4000-8000-000000000002',
    locationId: '10000000-0000-4000-8000-000000000003',
    quantity: 2,
  };
  persistStudentSelection(storage, 'student', [line]);
  assert.deepEqual(readSelection(saved.get(basketKey('student'))), [line]);
  // Leave the request unsaved, return to a fresh browse basket, and start empty.
  persistStudentSelection(storage, 'student', []);
  assert.equal(saved.has(basketKey('student')), false);
  // Select again, remove all entries, then start. Other users remain isolated.
  persistStudentSelection(storage, 'other', [line]);
  persistStudentSelection(storage, 'student', [line]);
  const remaining = [line].filter(() => false);
  persistStudentSelection(storage, 'student', remaining);
  assert.deepEqual(readSelection(saved.get(basketKey('student'))), []);
  assert.equal(saved.has(basketKey('other')), true);
});

test('QA-STU-02 mixed request with rejected and pending lines requires attention without reservations', () => {
  assert.equal(
    needsStudentAttention({
      summary: 'MIXED',
      lines: [
        { stage: 'REJECTED', reservedQuantity: 0 },
        { stage: 'LECTURER', reservedQuantity: 0 },
      ],
    }),
    true
  );
  assert.equal(
    needsStudentAttention({
      summary: 'PENDING',
      lines: [{ stage: 'LECTURER', reservedQuantity: 0 }],
    }),
    false
  );
});

test('QA-STU-03 clock ticks and focus refresh overdue metrics and date constraints deterministically', async (t) => {
  const { subscribeStudentClock, readStudentClock } =
    await import('../src/components/lending/student-clock.ts');
  const originalWindow = globalThis.window;
  globalThis.window = new EventTarget();
  const start = Date.parse('2026-11-10T12:00:00Z');
  t.mock.timers.enable({ apis: ['Date', 'setInterval'], now: start });
  let unsubscribe;
  try {
    const snapshots = [];
    unsubscribe = subscribeStudentClock(() => snapshots.push(readStudentClock()));
    const loan = { quantity: 1, returned: 0, dueAt: new Date(start + 10000).toISOString() };
    assert.equal(isStudentOverdue(loan, readStudentClock()), false);
    t.mock.timers.tick(30000);
    assert.equal(isStudentOverdue(loan, readStudentClock()), true);
    assert.equal(studentCounts([], [], [loan], readStudentClock())[4], 1);
    t.mock.timers.tick(1000);
    globalThis.window.dispatchEvent(new Event('focus'));
    assert.equal(readStudentClock(), start + 31000);
    assert.equal(snapshots.length, 3);
  } finally {
    unsubscribe?.();
    t.mock.timers.reset();
    globalThis.window = originalWindow;
  }
});

test('official TanStack composition sorts numbers, filters before paging, and supports page changes', async () => {
  const { createElement } = await import('react');
  const { renderToString } = await import('react-dom/server');
  const { useTable } = await import('@tanstack/react-table');
  const { studentTableFeatures } =
    await import('../src/components/lending/student-table-features.ts');
  const data = Array.from({ length: 25 }, (_, i) => ({
    name: i % 2 ? 'Camera' : 'Meter',
    quantity: 25 - i,
  }));
  let table;
  renderToString(
    createElement(function Probe() {
      table = useTable({
        features: studentTableFeatures,
        data,
        columns: [
          { accessorKey: 'name', filterFn: 'includesString', sortFn: 'alphanumeric' },
          { accessorKey: 'quantity', sortFn: 'basic' },
        ],
      });
      return null;
    })
  );
  table.setSorting([{ id: 'quantity', desc: false }]);
  assert.equal(table.getRowModel().rows[0].original.quantity, 1);
  table.getColumn('name').setFilterValue('Meter');
  assert.equal(table.getFilteredRowModel().rows.length, 13);
  table.setPageSize(10);
  assert.equal(table.getRowModel().rows.length, 10);
  table.nextPage();
  assert.equal(table.getRowModel().rows.length, 3);
  assert.deepEqual(
    table.getRowModel().rows.map((row) => row.original.quantity),
    [21, 23, 25]
  );
});

test('student activity allowlist excludes governance, bootstrap, inventory, auth and unknown actions', async () => {
  const { studentActivity } = await import('../src/components/lending/student-activity.ts');
  const request = {
    id: '10000000-0000-4000-8000-000000000001',
    lines: [{ id: 'line', decisions: [] }],
  };
  const occurredAt = '2026-11-10T12:00:00Z';
  const forbidden = [
    'GOVERNANCE_DENIED',
    'SYNTHETIC_BOOTSTRAP',
    'LOGIN',
    'LOGOUT',
    'LENDING_DENIED',
    'LENDING_POLICIES',
    'INVENTORY_ISSUE',
    'SOMETHING_NEW',
    'constructor',
    '__proto__',
  ];
  const events = forbidden.map((action) => ({ action, targetId: request.id, occurredAt }));
  events.push(
    { action: 'LENDING_SUBMIT', targetId: request.id, occurredAt },
    { action: 'LENDING_SUBMIT', targetId: 'unowned', occurredAt }
  );
  const result = studentActivity(events, [request]);
  assert.equal(result.length, 1);
  assert.equal(result[0].label, 'Request submitted');
  assert.equal(result[0].reference, 'Request 10000000');
  assert.doesNotMatch(
    JSON.stringify(result.map(({ label, reference }) => ({ label, reference }))),
    /GOVERNANCE|BOOTSTRAP|LENDING_|INVENTORY|UNCONFIGURED/
  );
});
test('student activity resolves actual approval snapshots and collected equipment to request references', async () => {
  const { studentActivity } = await import('../src/components/lending/student-activity.ts');
  const occurredAt = '2026-11-10T12:00:00Z';
  const request = {
    id: 'request',
    lines: [
      {
        id: 'line',
        decisions: [
          { id: 'decision', stage: 'LECTURER', decision: 'APPROVE', createdAt: occurredAt },
        ],
      },
    ],
  };
  const result = studentActivity(
    [{ action: 'LENDING_ISSUES', targetId: 'borrowing', occurredAt }],
    [request],
    [{ id: 'borrowing', requestId: 'request' }]
  );
  assert.deepEqual(result.map((item) => item.label).sort(), [
    'Equipment collected',
    'Lecturer approved',
  ]);
  assert.ok(result.every((item) => item.requestId === 'request'));
});
