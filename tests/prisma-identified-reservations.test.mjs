import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import ts from 'typescript';
import { requestApprovalGate, assertRequestMayReserve } from '../src/lib/server/services/request-approval-gate.ts';

// Execute the real service functions with deterministic transaction dependencies.
// Database constraints/grants still require the guarded PostgreSQL integration suite.
async function service(file, tx, movements) {
  const key = randomUUID();
  globalThis[key] = {
    randomUUID, Prisma: { PrismaClientKnownRequestError: class extends Error {} },
    nativeOrmTransaction: async work => work(tx),
    authorizePrismaSession: async () => ({ userId: 'officer', roles: ['TECHNICAL_OFFICER'] }),
    isAuthFailure: value => 'status' in value, isUuid: value => typeof value === 'string',
    requestApprovalGate, assertRequestMayReserve,
    ensureCell: async (_tx, key) => ({ id: key.assetId ? 'reserved-' + key.assetId : 'pooled' }),
    postStockMovement: async (_tx, movement) => { movements.push(movement); return 'movement'; },
  };
  const source = readFileSync(new URL('../src/lib/server/services/' + file, import.meta.url), 'utf8')
    .replace(/^import .*?;\r?\n/gm, '');
  const names = Object.keys(globalThis[key]).join(',');
  try {
    return await import('data:text/javascript;base64,' + Buffer.from(
      `const {${names}} = globalThis[${JSON.stringify(key)}];\n` +
      ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022,
        module: ts.ModuleKind.ESNext } }).outputText).toString('base64'));
  } finally { delete globalThis[key]; }
}

function fixture() {
  const claims = [], movements = [];
  const line = { id: 'line', request_id: 'request', item_id: 'item', lab_id: 'lab',
    location_id: 'shelf', quantity: 1, cancelled: 0, stage: 'APPROVED', version: 0,
    lend_requests: { borrower_id: 'borrower', return_at: new Date(Date.now() + 86400000) },
    inv_items: { kind: 'RETURNABLE' }, lend_allocations: null };
  const tx = {
    $queryRaw: async () => [], staff_labs: { findUnique: async () => ({ user_id: 'officer' }) },
    users: { findUnique: async () => ({ disabled: false, user_roles: [{ role: 'STUDENT' }] }) },
    lend_lines: { findUnique: async () => line, findMany: async () => [{
      ...line, policy: 'NONE', lend_decisions: [],
    }] },
    lend_commands: { findUnique: async () => null, create: async () => ({}) },
    inv_cells: { findMany: async () => [{ id: 'available-asset', asset_id: 'asset', quantity: 1 }],
      findUnique: async () => ({ asset_id: null, state: 'RESERVED' }),
      findFirst: async () => ({ id: 'reserved-asset', state: 'RESERVED' }) },
    lend_allocations: { createMany: async () => ({}), updateMany: async () => ({ count: 1 }) },
    lend_reserved_assets: { createMany: async ({ data }) => claims.push(...data),
      updateMany: async ({ where }) => claims.push(where) },
    lend_loans: { createMany: async () => ({}) }, lend_handovers: { createMany: async () => ({}) },
    audit: { createMany: async () => ({}) },
  };
  return { tx, line, claims, movements };
}

test('identified available equipment can be reserved after inspection', async () => {
  const { tx, claims, movements } = fixture();
  const { reserveLendingLine } = await service('lending-reservations.ts', tx, movements);
  const result = await reserveLendingLine('token', 'csrf', { commandId: 'command', lineId: 'line' });
  assert.ok(result.allocationId);
  assert.equal(claims[0].allocation_id, result.allocationId);
  assert.equal(claims[0].asset_id, 'asset');
  assert.equal(movements[0].sourceCellId, 'available-asset');
  assert.equal(movements[0].destCellId, 'reserved-asset');
});

test('pending sibling blocks identified reservations before stock writes', async () => {
  const { tx, claims, movements, line } = fixture();
  tx.lend_lines.findMany = async () => [{ ...line, policy: 'LECTURER', lend_decisions: [] }];
  const { reserveLendingLine } = await service('lending-reservations.ts', tx, movements);
  assert.equal((await reserveLendingLine('token', 'csrf', { commandId: 'c', lineId: 'line' })).code,
    'REQUEST_APPROVAL_INCOMPLETE');
  assert.equal(claims.length, 0);
  assert.equal(movements.length, 0);
});

test('handover chooses its own identified claim and releases it', async () => {
  const { tx, line, claims, movements } = fixture();
  tx.inv_cells.findFirst = async ({ where }) => {
    assert.deepEqual(where.OR[1].id.in, ['pooled', 'reserved-asset']);
    return { id: 'reserved-asset', state: 'RESERVED' };
  };
  tx.lend_allocations.findUnique = async () => ({ id: 'allocation', cell_id: 'pooled',
    quantity: 1, issued: 0, cancelled: 0, lend_lines: line,
    lend_reserved_assets: [{ asset_id: 'asset', cell_id: 'reserved-asset' }] });
  const { issueLendingAllocation } = await service('lending-handovers.ts', tx, movements);
  const result = await issueLendingAllocation('token', 'csrf', {
    commandId: 'command', allocationId: 'allocation', quantity: 1,
  });
  assert.equal(result.assetId, 'asset');
  assert.equal(movements[0].sourceCellId, 'reserved-asset');
  assert.equal(claims[0].asset_id, 'asset');
});

test('identified-only allocation cannot exchange another allocations pooled reservation', async () => {
  const { tx, line, movements } = fixture();
  tx.lend_allocations.findUnique = async () => ({ id: 'allocation', cell_id: 'pooled',
    quantity: 1, issued: 0, cancelled: 0, lend_lines: line,
    lend_reserved_assets: [{ asset_id: 'owned', cell_id: 'reserved-owned' }] });
  tx.inv_cells.findFirst = async () => ({ id: 'available-other', state: 'AVAILABLE' });
  const { issueLendingAllocation } = await service('lending-handovers.ts', tx, movements);
  const result = await issueLendingAllocation('token', 'csrf', {
    commandId: 'command', allocationId: 'allocation', quantity: 1, assetId: 'other',
  });
  assert.equal(result.code, 'STATE_CONFLICT');
  assert.equal(movements.length, 0);
});

test('mixed stock reserves anonymous units first and claims only the named remainder', async () => {
  const { tx, line, claims, movements } = fixture();
  line.quantity = 3;
  tx.inv_cells.findMany = async () => [
    { id: 'named', asset_id: 'asset', quantity: 1 },
    { id: 'anonymous', asset_id: null, quantity: 2 },
  ];
  const { reserveLendingLine } = await service('lending-reservations.ts', tx, movements);
  assert.ok((await reserveLendingLine('t', 'c', { commandId: 'cmd', lineId: 'line' })).allocationId);
  assert.deepEqual(movements.map(x => [x.sourceCellId, x.quantity]), [['anonymous', 2], ['named', 1]]);
  assert.equal(claims.length, 1);
});

test('insufficient combined stock creates no partial reservation', async () => {
  const { tx, line, claims, movements } = fixture();
  line.quantity = 2;
  tx.lend_allocations.createMany = async () => assert.fail('must not create allocation');
  const { reserveLendingLine } = await service('lending-reservations.ts', tx, movements);
  assert.equal((await reserveLendingLine('t', 'c', { commandId: 'cmd', lineId: 'line' })).code,
    'INSUFFICIENT_STOCK');
  assert.equal(movements.length + claims.length, 0);
});

test('reservation replay returns original result without moving stock twice', async () => {
  const { tx, movements } = fixture();
  const payload = { commandId: 'cmd', lineId: 'line' };
  const original = { allocationId: 'existing', movementId: 'original' };
  tx.lend_commands.findUnique = async () => ({ operation: 'reserve', payload, result: original });
  tx.inv_cells.findMany = async () => assert.fail('replay must not read stock');
  const { reserveLendingLine } = await service('lending-reservations.ts', tx, movements);
  assert.deepEqual(await reserveLendingLine('t', 'c', payload), original);
  assert.equal(movements.length, 0);
  assert.equal((await reserveLendingLine('t', 'c', { ...payload, expectedVersion: 1 })).code,
    'IDENTITY_CONFLICT');
});
