import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID, createHash } from 'node:crypto';
import pg from 'pg';
import { configuration } from './m2-guard.mjs';
const sha = (value) => createHash('sha256').update(value).digest('hex');

test('admin reports are scoped, filtered, paged and separated from security audit', async () => {
  const db = new pg.Client({ connectionString: configuration(process.env).database });
  await db.connect();
  try {
    await db.query('BEGIN');
    const users = Object.fromEntries(
      (
        await db.query(
          "SELECT id,split_part(email,'@',1) name FROM lab.users WHERE email IN('admin@example.invalid','student@example.invalid')"
        )
      ).rows.map((row) => [row.name, row.id])
    );
    const sessions = {};
    for (const name of Object.keys(users)) {
      const token = randomUUID();
      sessions[name] = token;
      await db.query(
        "INSERT INTO lab.sessions(token_hash,user_id,csrf_hash,expires_at,last_seen_at) VALUES($1,$2,$1,clock_timestamp()+interval '1 hour',clock_timestamp())",
        [sha(token), users[name]]
      );
    }
    await db.query("INSERT INTO lab.audit(id,actor_id,action) VALUES($1,$2,'REQUEST_DENIED')", [
      randomUUID(),
      users.admin,
    ]);
    await db.query('SET LOCAL ROLE lab_runtime');
    const call = async (name, report, p = {}) =>
      (await db.query('SELECT lab.admin_report($1,$2,$3) result', [sessions[name], report, p]))
        .rows[0].result;
    assert.equal((await call('student', 'borrowing')).code, 'DENIED');
    const inventory = await call('admin', 'inventory', {
      limit: 2,
      offset: 0,
      sort: 'item',
      direction: 'asc',
    });
    assert.equal(inventory.report, 'inventory');
    assert.ok(Array.isArray(inventory.items));
    assert.ok(inventory.total >= inventory.items.length);
    assert.equal(inventory.limit, 2);
    const borrowing = await call('admin', 'borrowing', {
      status: 'BORROWED',
      limit: 10,
      offset: 0,
    });
    assert.equal(borrowing.report, 'borrowing');
    assert.ok(borrowing.items.every((row) => row.status === 'BORROWED'));
    const approvals = await call('admin', 'approvals', {
      lecturerId: randomUUID(),
      limit: 10,
      offset: 0,
    });
    assert.equal(approvals.report, 'approvals');
    assert.equal(approvals.items.length, 0);
    const security = await call('admin', 'audit', { scope: 'security', limit: 100, offset: 0 });
    assert.ok(security.items.every((row) => row.scope === 'security'));
    assert.ok(security.items.some((row) => row.action === 'REQUEST_DENIED'));
    const operations = await call('admin', 'audit', { scope: 'operations', limit: 100, offset: 0 });
    assert.ok(operations.items.every((row) => row.scope === 'operations'));
    assert.equal((await call('admin', 'inventory', { kind: 'INVALID' })).code, 'INVALID');
  } finally {
    await db.query('ROLLBACK');
    await db.end();
  }
});
