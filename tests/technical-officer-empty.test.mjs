import { sourceContains } from './source-assert.mjs';
﻿import { test } from 'node:test';
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
  assert.ok(sourceContains(component, 'filtered&&onReset'));
  assert.ok(sourceContains(component, 'Clear filters'));
  assert.ok(sourceContains(component, 'onAction&&action'));
  assert.ok(!/Table|pagination|result-bar/.test(component));
  assert.match(component, /aria-hidden="true"/);
  const workspace = readFileSync(
    new URL('../src/components/technical-officer/workspace.tsx', import.meta.url),
    'utf8'
  );
  assert.ok(sourceContains(workspace, 'officerHasRows(records.data.items)') && sourceContains(workspace, '<StudentDataTable'));
  assert.ok(!sourceContains(workspace, 'No records in this authorized scope'));
  assert.ok(!sourceContains(workspace, 'No outstanding returns.'));
  assert.ok(!/handovers \?|return receipts \?|terminal inspections \?/.test(workspace));
  assert.ok(sourceContains(workspace, '<Records'));
  assert.ok(sourceContains(workspace, 'filtered={'));
  const stock = readFileSync(
    new URL('../src/components/inventory/inventory.tsx', import.meta.url),
    'utf8'
  );
  assert.ok(sourceContains(stock, 'stock.data.items.filter('));
  assert.ok(sourceContains(stock, '.length > 0 ? ('));
  assert.ok(sourceContains(stock, 'className="table-region"'));
  assert.ok(sourceContains(stock, 'setReceiptOpen(true)'));
  assert.ok(sourceContains(stock, 'Record stock receipt'));
  assert.ok(sourceContains(stock, 'stages.data?.items.length===0&&<OfficerEmpty'));
});
