import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatReportValue } from '../src/components/hod-admin/report-format.ts';

test('status/category/location fields are never parsed as dates', () => {
  assert.equal(formatReportValue('status', 'BORROWED'), 'BORROWED');
  assert.equal(formatReportValue('category', 'Electronics'), 'Electronics');
  assert.equal(formatReportValue('location', 'Bench 3'), 'Bench 3');
  assert.equal(formatReportValue('quantity', 12), '12');
});
test('only known timestamp fields receive date formatting', () => {
  assert.notEqual(formatReportValue('dueAt', '2026-11-21T14:00:00Z'), '—');
  assert.equal(formatReportValue('date', 'not a real date'), '—');
  assert.equal(formatReportValue('kind', 'RETURNABLE'), 'RETURNABLE');
});
