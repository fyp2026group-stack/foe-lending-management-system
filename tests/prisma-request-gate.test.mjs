import test from 'node:test';
import assert from 'node:assert/strict';
import { requestApprovalGate, assertRequestMayReserve } from '../src/lib/server/services/request-approval-gate.ts';

const line = (id, policy, quantity = 1, cancelledQuantity = 0) =>
  ({ id, policy, quantity, cancelledQuantity });
const vote = (lineId, role, decision = 'APPROVE') => ({ lineId, role, decision });

test('any pending item holds the entire order, including no-approval items', () => {
  const lines = [line('a', 'NONE'), line('b', 'LECTURER')];
  const pending = requestApprovalGate(lines, []);
  assert.equal(pending.state, 'PENDING');
  assert.deepEqual(pending.requires, [{ lineId: 'b', role: 'LECTURER' }]);
  assert.deepEqual(pending.missing, [{ lineId: 'b', role: 'LECTURER' }]);
  assert.throws(() => assertRequestMayReserve(pending), /REQUEST_APPROVAL_INCOMPLETE/);
  const approved = requestApprovalGate(lines, [vote('b', 'LECTURER')]);
  assert.equal(approved.state, 'APPROVED');
  assert.doesNotThrow(() => assertRequestMayReserve(approved));
});

test('lecturer approval on item A cannot approve item B', () => {
  const lines = [line('a', 'LECTURER'), line('b', 'LECTURER')];
  assert.deepEqual(requestApprovalGate(lines, [vote('a', 'LECTURER')]).missing, [
    { lineId: 'b', role: 'LECTURER' },
  ]);
  assert.equal(requestApprovalGate(lines, [vote('a', 'LECTURER'), vote('b', 'LECTURER')]).state, 'APPROVED');
});

test('BOTH and mixed HOD/lecturer policies require each line-level decision', () => {
  const lines = [line('a', 'NONE'), line('b', 'BOTH'), line('c', 'HOD')];
  assert.deepEqual(requestApprovalGate(lines, [vote('b', 'LECTURER')]).missing, [
    { lineId: 'b', role: 'HOD' },
    { lineId: 'c', role: 'HOD' },
  ]);
  assert.equal(requestApprovalGate(lines, [
    vote('b', 'LECTURER'), vote('b', 'HOD'), vote('c', 'HOD'),
  ]).state, 'APPROVED');
});

test('any rejection blocks the complete order', () => {
  const gate = requestApprovalGate([line('a', 'BOTH'), line('b', 'NONE')], [
    vote('a', 'LECTURER', 'REJECT'), vote('a', 'HOD'),
  ]);
  assert.equal(gate.state, 'REJECTED');
  assert.throws(() => assertRequestMayReserve(gate));
});

test('fully cancelled items do not delay the rest of the request', () => {
  const gate = requestApprovalGate([line('a', 'LECTURER', 2, 2), line('b', 'NONE')], []);
  assert.equal(gate.state, 'APPROVED');
  assert.deepEqual(gate.requires, []);
  assert.equal(requestApprovalGate([line('a', 'BOTH', 1, 1)], []).state, 'EMPTY');
  assert.equal(requestApprovalGate([line('a', 'LECTURER', 1, 1)], [vote('a', 'LECTURER')]).state, 'EMPTY');
});

test('invalid quantities, duplicate lines and forged approvals fail closed', () => {
  assert.throws(() => requestApprovalGate([line('a', 'NONE', 2, 3)], []), /INVALID_REQUEST_LINE/);
  assert.throws(() => requestApprovalGate([line('a', 'NONE', 1.5)], []), /INVALID_REQUEST_LINE/);
  assert.throws(() => requestApprovalGate([line('a', 'NONE'), line('a', 'NONE')], []), /INVALID_REQUEST_LINE/);
  assert.throws(() => requestApprovalGate([line('a', 'LECTURER')], [vote('a', 'HOD')]), /INVALID_APPROVAL/);
  assert.throws(() => requestApprovalGate([line('a', 'LECTURER')], [vote('a', 'LECTURER'), vote('a', 'LECTURER')]), /INVALID_APPROVAL/);
  assert.throws(() => requestApprovalGate([line('a', 'NONE')], [vote('other', 'LECTURER')]), /INVALID_APPROVAL/);
});
