import { test } from 'node:test';
import assert from 'node:assert/strict';
import { retrySnapshot } from '../src/lib/server/transaction-retry.ts';

test('snapshot conflict reruns the full callback and returns its fresh result', async () => {
  let attempts = 0;
  const result = await retrySnapshot(async () => {
    if (++attempts < 3) throw Object.assign(new Error('conflict'), { code: 'P2034' });
    return { authorized: true, snapshot: attempts };
  });
  assert.deepEqual(result, { authorized: true, snapshot: 3 });
});

test('snapshot conflicts stop after five attempts', async () => {
  let attempts = 0;
  const conflict = Object.assign(new Error('conflict'), { code: 'P2034' });
  await assert.rejects(retrySnapshot(async () => { attempts++; throw conflict; }),
    error => error === conflict);
  assert.equal(attempts, 5);
});

test('other failures are propagated without replay', async () => {
  for (const error of [new Error('unavailable'), { code: 'P2002' }, null]) {
    let attempts = 0;
    await assert.rejects(retrySnapshot(async () => { attempts++; throw error; }),
      caught => caught === error);
    assert.equal(attempts, 1);
  }
});
