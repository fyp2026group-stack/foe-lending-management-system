import { test } from 'node:test';
import assert from 'node:assert/strict';
import { editEquipmentSelection } from '../src/components/lending/equipment-selection.ts';
import { sourceKey, readSelection, persistStudentSelection, basketKey } from '../src/components/lending/student-model.ts';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
const moduleUrl = text => 'data:text/javascript;base64,' + Buffer.from(ts.transpileModule(text, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText).toString('base64');
const optionsUrl = moduleUrl(readFileSync(new URL('../src/components/lending/request-options.ts', import.meta.url), 'utf8'));
const selector = readFileSync(new URL('../src/components/lending/request-source-selector.ts', import.meta.url), 'utf8')
  .replace("from './request-options'", `from '${optionsUrl}'`);
const { availablePerEquipment, resolveBorrowingSources } = await import(moduleUrl(selector));

const uuid = n => `20000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const line = (location = 3, quantity = 1) => ({ itemId: uuid(1), labId: uuid(2), locationId: uuid(location), quantity });
const source = (extra = {}) => ({ ...line(), item: 'Synthetic scope', lab: 'Synthetic lab', location: 'Synthetic store', kind: 'RETURNABLE', policy: 'NONE', availableQuantity: 4, ...extra });

test('QA browse: equal equipment at separate sources edits and removes independently without mutating input', () => {
  const original = Object.freeze([Object.freeze(line(3, 2)), Object.freeze(line(4, 3))]);
  const next = editEquipmentSelection(original, line(4, 4), sourceKey, 4);
  assert.deepEqual(next, [line(3, 2), line(4, 4)]);
  assert.deepEqual(original, [line(3, 2), line(4, 3)]);
  assert.deepEqual(editEquipmentSelection(next, line(3, 0), sourceKey, 0), [line(4, 4)]);
});

test('QA browse: selection survives repeated filter-independent storage round trips and user switching', () => {
  const values = new Map();
  const storage = { setItem: (k,v) => values.set(k,v), removeItem: k => values.delete(k) };
  let selected = [line(3, 2), line(4, 3)];
  persistStudentSelection(storage, 'synthetic-a', selected);
  persistStudentSelection(storage, 'synthetic-b', [line(5, 1)]);
  selected = readSelection(values.get(basketKey('synthetic-a')));
  selected = editEquipmentSelection(selected, line(4, 1), sourceKey, 4);
  persistStudentSelection(storage, 'synthetic-a', selected);
  assert.deepEqual(readSelection(values.get(basketKey('synthetic-a'))), [line(3, 2), line(4, 1)]);
  persistStudentSelection(storage, 'synthetic-a', []);
  assert.equal(values.has(basketKey('synthetic-a')), false);
  assert.deepEqual(readSelection(values.get(basketKey('synthetic-b'))), [line(5, 1)]);
});

test('QA browse: storage failures propagate so callers cannot falsely claim persistence', () => {
  const unavailable = { setItem() { throw new Error('synthetic quota'); }, removeItem() { throw new Error('synthetic denied'); } };
  assert.throws(() => persistStudentSelection(unavailable, 'synthetic', [line()]), /synthetic quota/);
  assert.throws(() => persistStudentSelection(unavailable, 'synthetic', []), /synthetic denied/);
});

test('QA browse: displayed equipment capacity never pools locations or exceeds returnable limits', () => {
  const sources = [source(), source({ locationId: uuid(4), availableQuantity: 7 }), source({ itemId: uuid(9), availableQuantity: 100 })];
  assert.equal(availablePerEquipment(sources, uuid(1)), 7);
  assert.equal(resolveBorrowingSources([{ itemId: uuid(1), quantity: 8 }], sources, [], 'synthetic'), null);
  assert.equal(availablePerEquipment([source({ availableQuantity: 100 })], uuid(1)), 20);
  assert.equal(availablePerEquipment([source({ kind: 'CONSUMABLE', availableQuantity: 1500 })], uuid(1)), 1000);
  assert.equal(availablePerEquipment(sources, uuid(99)), 0);
});

test('QA browse: source resolution preserves authorized identity and prevents borrower self approval', () => {
  const borrower = uuid(8);
  const sources = [source({ policy: 'LECTURER', availableQuantity: 9 }), source({ policy: 'LECTURER', labId: uuid(5), locationId: uuid(6), availableQuantity: 3 })];
  const self = { id: borrower, labIds: [uuid(2), uuid(5)] };
  const lecturer = { id: uuid(9), labIds: [uuid(5)] };
  assert.equal(resolveBorrowingSources([{ itemId: uuid(1), quantity: 2 }], sources, [self], borrower), null);
  const result = resolveBorrowingSources([{ itemId: uuid(1), quantity: 2 }], sources, [self, lecturer], borrower);
  assert.deepEqual(result.lines.map(({itemId,labId,locationId,quantity}) => ({itemId,labId,locationId,quantity})), [{ ...line(6, 2), labId: uuid(5) }]);
  assert.deepEqual(result.eligible, [lecturer]);
  assert.equal(resolveBorrowingSources([{ itemId: uuid(1), quantity: 2.5 }], sources, [lecturer], borrower), null);
});
