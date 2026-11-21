import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');

test('Prisma baseline represents the complete existing table structure', () => {
  const schema = read('prisma/schema.prisma');
  const migration = read('prisma/migrations/0_init/migration.sql');
  const models = (schema.match(/^model /gm) ?? []).length;
  const tables = (migration.match(/CREATE TABLE /g) ?? []).length;
  const foreignKeys = (migration.match(/FOREIGN KEY/g) ?? []).length;
  assert.ok(models >= 40, `Expected at least 40 models, found ${models}`);
  assert.ok(tables >= 40, `Expected at least 40 tables, found ${tables}`);
  assert.ok(foreignKeys >= 75, `Expected at least 75 FK constraints, found ${foreignKeys}`);
  for (const model of ['users', 'sessions', 'inv_items', 'inv_cells', 'lend_requests', 'lend_lines', 'lend_decisions', 'lend_allocations']) {
    assert.ok(schema.includes(`model ${model} {`), `Missing model: ${model}`);
  }
  assert.doesNotMatch(migration, /DROP (?:TABLE|SCHEMA)/i);
});

test('Prisma baseline never replaces advanced database invariants silently', () => {
  const sql = read('prisma/migrations/0_init/migration.sql');
  const db = read('database/035_lending_lifecycle.sql');
  assert.match(db, /CREATE TRIGGER lend_line_version/);
  assert.match(db, /CREATE FUNCTION lab\.lend_reserve/);
  assert.doesNotMatch(sql, /CREATE FUNCTION lab\.lend_reserve/);
  // Preserve the legacy provisioner until functions, triggers, grants,
  // check constraints, and expression indexes are explicitly migrated.
  assert.match(read('package.json'), /"db:setup": "node scripts\/local\.mjs db:setup"/);
});
