import { test } from 'node:test';
import assert from 'node:assert/strict';
import { canOpenRoute } from '../src/lib/role-policy.ts';
import { editEquipmentSelection } from '../src/components/lending/equipment-selection.ts';
import { quantityLimit } from '../src/components/lending/request-options.ts';

test('shared borrower catalogue admits all four authenticated roles without granting inventory management', () => {
  for (const role of ['STUDENT', 'LECTURER', 'TECHNICAL_OFFICER', 'ADMIN']) {
    assert.equal(canOpenRoute('/equipment', null, [role]), true);
    assert.equal(canOpenRoute('/borrowing', 'new', [role]), true);
  }
  assert.equal(canOpenRoute('/equipment', null, []), false);
  assert.equal(canOpenRoute('/operations', null, ['STUDENT']), false);
  assert.equal(canOpenRoute('/admin/inventory', null, ['LECTURER']), false);
});

test('off-page selection remains editable at twenty types and stock changes permit removal', () => {
  const key = row => row.itemId;
  const selected = Array.from({ length: 20 }, (_, index) => ({ itemId: String(index), quantity: 1 }));
  const source = { kind: 'RETURNABLE', availableQuantity: 80 };
  const limit = Math.min(source.availableQuantity, quantityLimit(source));
  const updated = editEquipmentSelection(selected, { itemId: '0', quantity: 20 }, key, limit);
  assert.equal(updated[0].quantity, 20);
  assert.equal(updated.length, 20);
  assert.equal(editEquipmentSelection(updated, { itemId: '0', quantity: 21 }, key, limit), updated);
  assert.equal(editEquipmentSelection(updated, { itemId: 'new-page-item', quantity: 1 }, key, limit), updated);
  const removed = editEquipmentSelection(updated, { itemId: '0', quantity: 0 }, key, 0);
  assert.equal(removed.length, 19);
  assert.equal(editEquipmentSelection(removed, { itemId: 'new-page-item', quantity: 1 }, key, limit).length, 20);
});
