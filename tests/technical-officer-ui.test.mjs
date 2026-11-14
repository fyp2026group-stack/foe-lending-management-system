import { sourceContains } from './source-assert.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  officerViews,
  officerHref,
  operationalEvents,
  isDue,
  handoverRemarks,
  laboratoryName,
  operationsSummaryQuery,
  completedOperationsLabel,
} from '../src/components/technical-officer/model.ts';
test('officer navigation has ten separate task destinations', () => {
  assert.equal(officerViews.length, 10);
  assert.equal(new Set(officerViews.map(officerHref)).size, 10);
  assert.equal(officerHref('dashboard'), '/workspace');
});
test('operations excludes security/session events and failed attempts', () => {
  const events = [
    'LOGIN',
    'LOGOUT',
    'LENDING_DENIED',
    'LENDING_REQUESTS',
    'LENDING_ISSUES',
    'LENDING_RETURNS',
    'LENDING_INSPECTIONS',
    'LENDING_MAINTENANCE',
    'UNKNOWN',
  ].map((action) => ({ action }));
  assert.deepEqual(
    operationalEvents(events).map((e) => e.action),
    ['LENDING_ISSUES', 'LENDING_RETURNS', 'LENDING_INSPECTIONS', 'LENDING_MAINTENANCE']
  );
});
test('due status requires outstanding custody and a real past due date', () => {
  const now = Date.parse('2026-11-10T12:00:00Z');
  assert.equal(isDue({ dueAt: '2026-11-09T12:00:00Z', returned: 0, quantity: 1 }, now), true);
  for (const row of [
    { dueAt: null, returned: 0, quantity: 1 },
    { dueAt: 'invalid', returned: 0, quantity: 1 },
    { dueAt: '2026-11-09T12:00:00Z', returned: 1, quantity: 1 },
    { dueAt: '2026-11-11T12:00:00Z', returned: 0, quantity: 1 },
  ])
    assert.equal(isDue(row, now), false);
});

test('handover remarks omit absent/blank input, trim factual text and reject oversized values', () => {
  assert.deepEqual(handoverRemarks(null), {});
  assert.deepEqual(handoverRemarks('  '), {});
  assert.deepEqual(handoverRemarks('  Case and cable checked. \n'), {
    remarks: 'Case and cable checked.',
  });
  assert.throws(() => handoverRemarks('x'.repeat(1001)), /1000/);
  assert.equal(handoverRemarks('x'.repeat(1000)).remarks.length, 1000);
});
test('laboratory labels prefer server labName and use one neutral legacy fallback', () => {
  assert.equal(laboratoryName({ labName: 'Electronics Laboratory' }), 'Electronics Laboratory');
  assert.equal(laboratoryName({}), 'Assigned laboratory');
  assert.equal(laboratoryName({ labName: '' }), 'Assigned laboratory');
});
test('operations summary supplies explicit local midnights with offsets and no pagination', () => {
  const now = new Date(2026, 10, 10, 15, 45);
  const query = operationsSummaryQuery(now);
  const params = new URLSearchParams(query.split('?')[1]);
  assert.ok(query.startsWith('operations-summary?'));
  assert.deepEqual([...params.keys()].sort(), ['from', 'to']);
  assert.match(params.get('from'), /^2026-11-10T00:00:00[+-]\d{2}:\d{2}$/);
  assert.match(params.get('to'), /^2026-11-11T00:00:00[+-]\d{2}:\d{2}$/);
  assert.equal(Date.parse(params.get('from')), new Date(2026, 10, 10).getTime());
  assert.equal(Date.parse(params.get('to')), new Date(2026, 10, 11).getTime());
  assert.equal(completedOperationsLabel, 'Completed lending operations');
});
import { readFileSync } from 'node:fs';
test('officer screen wires migration 046 fields and removes superseded placeholder claims', () => {
  const source = readFileSync(
    new URL('../src/components/technical-officer/workspace.tsx', import.meta.url),
    'utf8'
  );
  assert.ok(sourceContains(source, "...handoverRemarks(d.get('remarks'))"));
  assert.match(source, /<Textarea[^>]+name="remarks"[^>]+maxLength=\{1000\}/);
  assert.ok(sourceContains(source, 'laboratoryName(r)'));
  assert.ok(sourceContains(source, 'laboratoryName(a)'));
  assert.ok(sourceContains(source, 'laboratoryName(selected)'));
  assert.ok(
    sourceContains(source, 'useLending<OperationsSummary>(operationsSummaryQuery(new Date(now)),revision)')
  );
  assert.ok(sourceContains(source, 'value:summary.data?.completed.total'));
  assert.ok(sourceContains(source, 'summary.data?.laboratories??[]'));
  assert.ok(sourceContains(source, '<HandoverFacts handover={selected.handover}/>'));
  assert.ok(!sourceContains(source, 'remarks cannot be saved'));
  assert.ok(!sourceContains(source, 'Completed today'));
  assert.ok(!sourceContains(source, 'in your visible history'));
});
