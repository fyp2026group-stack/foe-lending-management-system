import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

// Exercise the real connection gate without loading a driver or opening sockets.
async function adapter() {
  const source = readFileSync(new URL('../src/lib/server/db.ts', import.meta.url), 'utf8')
    .replace(/import .* from '@prisma\/client';/, `
      export const constructed = [];
      class PrismaClient {
        constructor(options) { constructed.push(options); }
        async $transaction(work) { return work({ synthetic: true }); }
      }`)
    .replace(/import .* from '@prisma\/adapter-pg';/,
      'class PrismaPg { constructor(options) { Object.assign(this, options); } }')
    .replace(/import .* from '.\/transaction-retry';/,
      'const retrySnapshot = work => work();');
  const javascript = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  return import('data:text/javascript;base64,' + Buffer.from(javascript).toString('base64') + '#' + Math.random());
}

test('serverless connection gate separates restricted runtime from migration owners', async t => {
  const keys = ['ORM_DATABASE_URL', 'DATABASE_POOL_SIZE', 'MIGRATION_DATABASE_URL'];
  const saved = Object.fromEntries(keys.map(key => [key, process.env[key]]));
  t.after(() => keys.forEach(key => saved[key] === undefined
    ? delete process.env[key] : process.env[key] = saved[key]));
  process.env.MIGRATION_DATABASE_URL = 'postgresql://postgres:synthetic@migration.invalid/lab';

  await t.test('missing runtime URL never falls back to migration credentials', async () => {
    const db = await adapter();
    delete process.env.ORM_DATABASE_URL;
    await assert.rejects(db.nativeOrmTransaction(() => null), /ORM_DATABASE_URL is required/);
    assert.equal(db.constructed.length, 0);
  });

  await t.test('owner and lookalike usernames are rejected before driver construction', async () => {
    const db = await adapter();
    for (const user of ['postgres', 'postgres.project', 'lab_owner', 'lab_orm_elevated']) {
      process.env.ORM_DATABASE_URL = `postgresql://${user}:synthetic@database.invalid/lab`;
      await assert.rejects(db.nativeOrmTransaction(() => null), /restricted lab_orm/);
    }
    assert.equal(db.constructed.length, 0);
  });

  await t.test('Supabase restricted pooler username retains TLS settings and reuses its pool', async () => {
    const db = await adapter();
    const url = 'postgresql://lab_orm.project:synthetic@pooler.invalid:6543/postgres?sslmode=verify-full';
    process.env.ORM_DATABASE_URL = url;
    process.env.DATABASE_POOL_SIZE = '2';
    assert.equal(await db.nativeOrmTransaction(tx => tx.synthetic), true);
    await db.nativeOrmTransaction(() => null);
    assert.equal(db.constructed.length, 1);
    assert.equal(db.constructed[0].adapter.connectionString, url);
    assert.equal(db.constructed[0].adapter.max, 2);
    assert.equal(db.constructed[0].adapter.connectionTimeoutMillis, 10000);
    assert.equal(db.constructed[0].adapter.statement_timeout, 30000);
  });

  await t.test('query parameter cannot override the restricted PostgreSQL username', async () => {
    const db = await adapter();
    process.env.ORM_DATABASE_URL = 'postgresql://lab_orm:synthetic@database.invalid/lab?user=postgres';
    await assert.rejects(db.nativeOrmTransaction(() => null), /restricted lab_orm/);
    assert.equal(db.constructed.length, 0);
  });
});
