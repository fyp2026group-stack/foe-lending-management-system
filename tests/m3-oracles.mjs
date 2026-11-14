import assert from 'node:assert/strict';
export function quantity(value) {
  assert.ok(
    Number.isSafeInteger(value) && value >= 0,
    'Quantity must be a nonnegative safe integer'
  );
  return value;
}
export function conserved(snapshot) {
  const source = ['opening', 'receipts', 'netAdjustments', 'inbound', 'outbound'];
  const pools = [
    'available',
    'reserved',
    'borrowed',
    'inspection',
    'maintenance',
    'transit',
    'lost',
    'retired',
    'consumed',
  ];
  for (const key of source)
    assert.ok(Number.isSafeInteger(snapshot[key]), `Missing/inexact source ${key}`);
  for (const key of pools) quantity(snapshot[key]);
  const left =
    BigInt(snapshot.opening) +
    BigInt(snapshot.receipts) +
    BigInt(snapshot.netAdjustments) +
    BigInt(snapshot.inbound) -
    BigInt(snapshot.outbound);
  const right = pools.reduce((sum, key) => sum + BigInt(snapshot[key]), 0n);
  assert.equal(right, left, 'Disjoint stock pools must reconcile to external sources');
}
export function conversion(before, after) {
  for (const key of ['itemId', 'laboratoryId', 'pool', 'kind', 'uom'])
    assert.equal(after[key], before[key], `Conversion changed ${key}`);
  quantity(before.anonymous);
  quantity(after.anonymous);
  quantity(before.identified);
  quantity(after.identified);
  assert.equal(after.anonymous, before.anonymous - 1);
  assert.equal(after.identified, before.identified + 1);
  assert.ok(after.assetId && after.permanentId, 'Materialization needs durable asset identity');
}
export async function finalUnit(contenders, attempt) {
  assert.ok(contenders >= 2);
  const outcomes = await Promise.all(Array.from({ length: contenders }, (_, i) => attempt(i)));
  assert.equal(
    outcomes.filter((result) => result.committed).length,
    1,
    'Exactly one final-unit effect'
  );
  return outcomes;
}
