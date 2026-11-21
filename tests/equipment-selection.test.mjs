import { test } from 'node:test';
import assert from 'node:assert/strict';
import { editEquipmentSelection } from '../src/components/lending/equipment-selection.ts';
import { persistStudentSelection, readSelection, sourceKey, basketKey } from '../src/components/lending/student-model.ts';

const key = row => row.itemId;
test('inline edits enforce stock, integer quantities and twenty selections while allowing updates and removal', () => {
  const full = Array.from({ length: 20 }, (_, i) => ({ itemId: String(i), quantity: 1 }));
  assert.equal(editEquipmentSelection(full, { itemId: 'extra', quantity: 1 }, key, 5), full);
  for (const quantity of [NaN, Infinity, 1.5, -1, 6]) {
    assert.equal(editEquipmentSelection(full, { itemId: '0', quantity }, key, 5), full);
  }
  const updated = editEquipmentSelection(full, { itemId: '0', quantity: 5 }, key, 5);
  assert.equal(updated.length, 20);
  assert.equal(updated[0].quantity, 5);
  const removed = editEquipmentSelection(updated, { itemId: '0', quantity: 0 }, key, 0);
  assert.equal(removed.length, 19);
  assert.equal(editEquipmentSelection(removed, { itemId: 'extra', quantity: 1 }, key, 5).length, 20);
  assert.deepEqual(editEquipmentSelection([], { itemId: 'empty', quantity: 1 }, key, 0), []);
});

test('catalogue inline changes survive a storage round trip with exact source identity and clear on removal', () => {
  const uuid = i => `10000000-0000-4000-8000-${String(i).padStart(12, '0')}`;
  const entry = { itemId: uuid(1), labId: uuid(2), locationId: uuid(3), quantity: 3 };
  const values = new Map();
  const storage = { setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) };
  const selected = editEquipmentSelection([], entry, sourceKey, 3);
  persistStudentSelection(storage, 'borrower', selected);
  assert.deepEqual(readSelection(values.get(basketKey('borrower'))), [entry]);
  assert.equal(values.has(basketKey('other-borrower')), false);
  persistStudentSelection(storage, 'borrower', editEquipmentSelection(selected, { ...entry, quantity: 0 }, sourceKey, 0));
  assert.equal(values.size, 0);
});
