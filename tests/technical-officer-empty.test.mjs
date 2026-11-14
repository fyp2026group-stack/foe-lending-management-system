import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  officerEmptyCopy,
  officerHasRows,
} from '../src/components/technical-officer/empty-model.ts';
test('zero-row tables suppress chrome and distinguish filtered from true empty', () => {
  assert.equal(officerHasRows([]), false);
  assert.equal(officerHasRows([{ id: 'real-record' }]), true);
  for (const area of [
    'handovers',
    'returns',
    'inspections',
    'inventory',
    'stock',
    'proposals',
    'imports',
    'activity',
  ]) {
    const empty = officerEmptyCopy(area);
    assert.ok(empty.title);
    assert.ok(empty.description);
    assert.equal(officerEmptyCopy(area, true).title, 'No matching records');
    assert.match(officerEmptyCopy(area, true).description, /Clear the filters/);
  }
  assert.notEqual(officerEmptyCopy('returns').title, officerEmptyCopy('inspections').title);
});
test('empty composition contains no table chrome and exposes contextual reset/action only', () => {
  const component = readFileSync(
    new URL('../src/components/technical-officer/empty-state.tsx', import.meta.url),
    'utf8'
  );
  assert.ok(component.includes('filtered&&onReset'));
  assert.ok(component.includes('Clear filters'));
  assert.ok(component.includes('onAction&&action'));
  assert.ok(!/Table|pagination|result-bar/.test(component));
  assert.match(component, /aria-hidden="true"/);
  const workspace = readFileSync(
    new URL('../src/components/technical-officer/workspace.tsx', import.meta.url),
    'utf8'
  );
  assert.ok(workspace.includes('officerHasRows(records.data.items)?<StudentDataTable'));
  assert.ok(!workspace.includes('No records in this authorized scope'));
  assert.ok(!workspace.includes('No outstanding returns.'));
  assert.ok(!/handovers \?|return receipts \?|terminal inspections \?/.test(workspace));
  assert.equal((workspace.match(/<Records filtered=/g) ?? []).length, 4);
  const stock = readFileSync(
    new URL('../src/components/inventory/inventory.tsx', import.meta.url),
    'utf8'
  );
  assert.ok(stock.includes('.length>0?<div className="table-region"'));
  assert.ok(stock.includes('setReceiptOpen(true)} action="Record stock receipt"'));
  assert.ok(stock.includes('stages.data?.items.length===0&&<OfficerEmpty'));
});
