import { test } from 'node:test';
import assert from 'node:assert/strict';
import { configuration } from './m2-guard.mjs';
const valid = { M2_TEST_ENABLE: 'synthetic-only', M2_TEST_DATABASE_URL: 'postgres://localhost/lab_m2_test_qa', M2_TEST_APP_ORIGIN: 'http://127.0.0.1:3000' };
test('M2 guard requires explicit opt-in, dedicated local database and local app', () => {
  assert.equal(configuration(valid).databaseName, 'lab_m2_test_qa');
  for (const change of [{ M2_TEST_ENABLE: '' }, { M2_TEST_DATABASE_URL: 'postgres://localhost/production' },
    { M2_TEST_DATABASE_URL: 'postgres://example.invalid/lab_m2_test_qa' }, { M2_TEST_APP_ORIGIN: 'https://example.invalid' },
    { M2_TEST_APP_ORIGIN: 'http://localhost:3000/path' }]) assert.throws(() => configuration({ ...valid, ...change }));
});
