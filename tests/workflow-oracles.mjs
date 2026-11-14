import assert from 'node:assert/strict';
export function unchangedStock(before, after) {
  assert.deepEqual(after, before, 'Approval must not issue or reserve stock');
}
export function returnConservation({
  issued,
  received,
  lossResolved = 0,
  outstanding,
  inspectionDelta,
  returned,
}) {
  for (const value of [issued, received, lossResolved, outstanding, inspectionDelta, returned])
    assert.ok(Number.isSafeInteger(value) && value >= 0);
  assert.equal(issued, received + lossResolved + outstanding);
  assert.equal(inspectionDelta, returned, 'Receipt must enter inspection');
}
export function stageChain(mode) {
  assert.ok(['NONE', 'LECTURER', 'HOD', 'BOTH'].includes(mode));
  return mode === 'NONE' ? [] : mode === 'BOTH' ? ['LECTURER', 'HOD'] : [mode];
}
export function distinctActor(borrowerId, actorId) {
  assert.ok(borrowerId && actorId);
  assert.notEqual(borrowerId, actorId, 'Multirole cannot bypass person conflict');
}
