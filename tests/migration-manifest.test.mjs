import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const migration = readFileSync(new URL('../scripts/database.mjs', import.meta.url), 'utf8');
test('fresh database setup includes the final admin self-change guard', () => {
  const filenames = [...migration.matchAll(/'([0-9]{3}_[^']+\.sql)'/g)].map((match) => match[1]);
  assert.equal(filenames.at(-1), '051_hod_admin_self_change_guard.sql');
  assert.equal(new Set(filenames).size, filenames.length);
  assert.ok(
    filenames.indexOf('051_hod_admin_self_change_guard.sql') >
    filenames.indexOf('050_hod_admin_governance_hardening.sql')
  );
});
