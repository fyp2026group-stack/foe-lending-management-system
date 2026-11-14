import { test } from 'node:test';
import assert from 'node:assert/strict';
import { conserved, conversion, quantity } from './m3-oracles.mjs';
test('conservation oracle catches double counting and missing buckets', () => {
  const stock = {
    opening: 2,
    receipts: 1,
    netAdjustments: -1,
    inbound: 0,
    outbound: 0,
    available: 1,
    reserved: 1,
    borrowed: 0,
    inspection: 0,
    maintenance: 0,
    transit: 0,
    lost: 0,
    retired: 0,
    consumed: 0,
  };
  conserved(stock);
  assert.throws(() => conserved({ ...stock, available: 2 }));
  assert.throws(() => conserved({ ...stock, inspection: undefined }));
  assert.throws(() => conserved({ ...stock, reserved: -1 }));
});
test('materialization oracle rejects scope changes and fabricated stock', () => {
  const before = {
    itemId: 'synthetic-item',
    laboratoryId: 'synthetic-lab',
    pool: 'available',
    kind: 'returnable',
    uom: 'each',
    anonymous: 1,
    identified: 0,
  };
  const after = {
    ...before,
    anonymous: 0,
    identified: 1,
    assetId: 'synthetic-asset',
    permanentId: 'synthetic-permanent',
  };
  conversion(before, after);
  assert.throws(() => conversion(before, { ...after, anonymous: 1 }));
  assert.throws(() => conversion(before, { ...after, laboratoryId: 'other-lab' }));
});
test('quantity oracle rejects fractions negative and unsafe numeric values', () => {
  for (const value of [-1, 0.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1, '1'])
    assert.throws(() => quantity(value));
  assert.equal(quantity(0), 0);
});
