import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { uuid } from '../src/lib/server/services/inventory-category-mutations.ts';

test('native Prisma command identifiers use the complete 8-4-4-4-12 UUID shape', () => {
  for (let i = 0; i < 20; i++) assert.equal(uuid(randomUUID()), true);
  for (const invalid of [
    '', null, undefined, 20,
    'ffffffff-ffff-ffff-ffffffffffff',
    'ffffffff-ffff-ffff-ffff-fffffffffff',
    'ffffffff-ffff-ffff-ffff-ffffffffffff-injected',
    'not-a-command-id',
  ]) assert.equal(uuid(invalid), false);
});
