import test from 'node:test';
import assert from 'node:assert/strict';
import { requestApprovalGate, assertRequestMayReserve } from '../src/lib/server/services/request-approval-gate.ts';

const line = (policy, quantity = 1, cancelledQuantity = 0) =>
  ({ policy, quantity, cancelledQuantity });
const vote = (role, decision = 'APPROVE') => ({ role, decision });

test('any equipment requiring lecturer review gates the entire request', () => {
  const lines = [line('NONE'), line('LECTURER')];
  const pending = requestApprovalGate(lines, []);
  assert.equal(pending.state, 'PENDING');
  assert.deepEqual(pending.requires, ['LECTURER']);
  assert.deepEqual(pending.missing, ['LECTURER']);
  assert.throws(() => assertRequestMayReserve(pending), /REQUEST_APPROVAL_INCOMPLETE/);
  const approved = requestApprovalGate(lines, [vote('LECTURER')]);
  assert.equal(approved.state, 'APPROVED');
  assert.doesNotThrow(() => assertRequestMayReserve(approved));
});

test('mixed HOD and lecturer policies require both independent decisions', () => {
  const lines = [line('NONE'), line('LECTURER'), line('HOD')];
  assert.deepEqual(requestApprovalGate(lines, [vote('LECTURER')]), {
    state: 'PENDING', requires: ['LECTURER', 'HOD'], missing: ['HOD'],
  });
  assert.equal(requestApprovalGate(lines, [vote('LECTURER'), vote('HOD')]).state, 'APPROVED');
  assert.equal(requestApprovalGate([line('BOTH')], [vote('HOD')]).state, 'PENDING');
});

test('any rejection blocks the complete request', () => {
  const gate = requestApprovalGate([line('BOTH'), line('NONE')], [
    vote('LECTURER', 'REJECT'),
    vote('HOD'),
  ]);
  assert.equal(gate.state, 'REJECTED');
  assert.throws(() => assertRequestMayReserve(gate));
});

test('fully cancelled lines do not create approval requirements', () => {
  const gate = requestApprovalGate([line('LECTURER', 2, 2), line('NONE')], []);
  assert.equal(gate.state, 'APPROVED');
  assert.deepEqual(gate.requires, []);
  assert.equal(requestApprovalGate([line('BOTH', 1, 1)], []).state, 'EMPTY');
});

test('invalid quantities, duplicate or forged votes fail closed', () => {
  assert.throws(() => requestApprovalGate([line('NONE', 2, 3)], []), /INVALID_REQUEST_LINE/);
  assert.throws(() => requestApprovalGate([line('NONE', 1.5)], []), /INVALID_REQUEST_LINE/);
  assert.throws(() => requestApprovalGate([line('LECTURER')], [vote('HOD')]), /INVALID_APPROVAL/);
  assert.throws(() => requestApprovalGate([line('LECTURER')], [vote('LECTURER'), vote('LECTURER')]), /INVALID_APPROVAL/);
});
