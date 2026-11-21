import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { isUuid } from '../src/lib/server/services/uuid.ts';

test('native Prisma command identifiers use the complete 8-4-4-4-12 UUID shape', () => {
  for (let i = 0; i < 20; i++) assert.equal(isUuid(randomUUID()), true);
  for (const invalid of [
    '', null, undefined, 20,
    'ffffffff-ffff-ffff-ffffffffffff',
    'ffffffff-ffff-ffff-ffff-fffffffffff',
    'ffffffff-ffff-ffff-ffff-ffffffffffff-injected',
    'not-a-command-id',
  ]) assert.equal(isUuid(invalid), false);
});
