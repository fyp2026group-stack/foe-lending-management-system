import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import {
  CommandReplay,
  draftSavePayload,
  draftSubmitPayload,
  cancellableQuantity,
  requestQuery,
  requestGroup,
} from '../src/components/lending/lifecycle-model.ts';
import { eligibleLecturers, quantityLimit } from '../src/components/lending/request-options.ts';
test('draft save replaces fields with version and explicit submit references saved version', () => {
  const payload = {
    purpose: 'Corrected',
    lines: [{ itemId: 'i', labId: 'l', locationId: 's', quantity: 2 }],
  };
  assert.deepEqual(draftSavePayload(payload), payload);
  assert.deepEqual(draftSavePayload(payload, { id: 'draft', version: 3 }), {
    ...payload,
    draftId: 'draft',
    expectedVersion: 3,
  });
  assert.deepEqual(draftSubmitPayload({ id: 'draft', version: 4 }), {
    draftId: 'draft',
    expectedVersion: 4,
  });
});
test('unknown draft outcomes replay identical command and prevent changed operation or payload', () => {
  const replay = new CommandReplay();
  const first = replay.prepare('drafts', { purpose: 'A', lines: [] });
  assert.deepEqual(replay.prepare('drafts', { purpose: 'A', lines: [] }), first);
  assert.throws(() => replay.prepare('drafts', { purpose: 'B', lines: [] }));
  assert.throws(() => replay.prepare('submit', { purpose: 'A', lines: [] }));
  replay.resolve();
  assert.notEqual(replay.prepare('drafts', { purpose: 'A', lines: [] }).commandId, first.commandId);
});
test('lecturer must cover all labs and cannot be borrower; stock shortage does not change policy quantity limit', () => {
  const lecturers = [
    { id: 'borrower', labIds: ['a', 'b'] },
    { id: 'single', labIds: ['a'] },
    { id: 'both', labIds: ['a', 'b'] },
  ];
  assert.deepEqual(
    eligibleLecturers(lecturers, ['a', 'b'], 'borrower').map((x) => x.id),
    ['both']
  );
  assert.equal(quantityLimit({ kind: 'RETURNABLE', availableQuantity: 0 }), 20);
  assert.equal(quantityLimit({ kind: 'CONSUMABLE', availableQuantity: 2 }), 1000);
});
test('cancellation excludes handovers and prior cancellation and blocks rejected/terminal lines', () => {
  const line = { quantity: 10, issuedQuantity: 4, cancelledQuantity: 3, stage: 'APPROVED' };
  assert.equal(cancellableQuantity(line), 3);
  assert.equal(cancellableQuantity({ ...line, issuedQuantity: 10 }), 0);
  for (const stage of ['REJECTED', 'CANCELLED'])
    assert.equal(cancellableQuantity({ ...line, stage }), 0);
});
test('query sends supported server filters and paging only', () => {
  const url = new URL(
    requestQuery({
      status: 'PENDING',
      stage: 'LECTURER',
      from: '2026-11-10',
      to: '2026-11-11',
      offset: 20,
    }),
    'https://test/'
  );
  assert.deepEqual(Object.fromEntries(url.searchParams), {
    limit: '20',
    offset: '20',
    status: 'PENDING',
    stage: 'LECTURER',
    from: '2026-11-10',
    to: '2026-11-11',
  });
  assert.equal(requestGroup({ summary: 'READY' }), 'ready');
  assert.equal(requestGroup({ summary: 'PARTIALLY_FULFILLED' }), 'borrowed');
  assert.equal(requestGroup({ summary: 'REJECTED' }), 'closed');
});
const moduleUrl = (source) =>
  'data:text/javascript;base64,' +
  Buffer.from(
    ts.transpileModule(source, {
      compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
    }).outputText
  ).toString('base64');
const identityUrl = moduleUrl(
  readFileSync(new URL('../src/components/identity/api.ts', import.meta.url), 'utf8')
);
const source = readFileSync(
  new URL('../src/components/lending/api.ts', import.meta.url),
  'utf8'
).replace('@/components/identity/api', identityUrl);
const { lendingWrite } = await import(moduleUrl(source));
test('CP2 adapter transmits versioned decisions and correction lineage command with CSRF and exact replay', async () => {
  const original = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url, options) => {
    calls.push({ url, options });
    return Response.json({ id: 'correction', predecessorId: 'rejected', version: 0 });
  };
  try {
    const decision = {
      commandId: 'id',
      lineId: 'line',
      expectedVersion: 5,
      decision: 'APPROVE',
      remarks: 'Checked',
    };
    await lendingWrite('decisions', decision, 'csrf');
    await lendingWrite('decisions', decision, 'csrf');
    assert.equal(calls[0].options.credentials, 'same-origin');
    assert.equal(calls[0].options.headers['X-CSRF-Token'], 'csrf');
    assert.equal(calls[0].options.body, calls[1].options.body);
    assert.deepEqual(JSON.parse(calls[0].options.body), decision);
    const correction = await lendingWrite(
      'revisions',
      { commandId: 'revision', requestId: 'rejected', expectedVersion: 6 },
      'csrf'
    );
    assert.equal(correction.predecessorId, 'rejected');
    assert.equal(calls[2].url, '/api/lending/revisions');
  } finally {
    globalThis.fetch = original;
  }
});
test('owned workspace uses full-page review, versioned approval and borrowing terminology', () => {
  const workspace = readFileSync(
    new URL('../src/components/lending/request-workspace.tsx', import.meta.url),
    'utf8'
  );
  const workflow = readFileSync(
    new URL('../src/components/lending/workflow.tsx', import.meta.url),
    'utf8'
  );
  assert.match(workspace, /expectedVersion\s*:\s*line\.version/);
  assert.match(workspace, /predecessorId/);
  assert.match(workspace, /Expected Return Date/);
  assert.doesNotMatch(workspace, /ReviewPanel/);
  assert.doesNotMatch(workflow, /Loans and overdue|Loan status|Loan reference|equipment custody/);
});
