import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID, randomBytes, createHash } from 'node:crypto';
import pg from 'pg';
import { configuration } from './m2-guard.mjs';
const sha = (value) => createHash('sha256').update(value).digest('hex');
test('admin governance preserves multiple batch history and guarded deactivation', async () => {
  const db = new pg.Client({ connectionString: configuration(process.env).database });
  await db.connect();
  try {
    await db.query('BEGIN');
    const admin = (await db.query("SELECT id FROM lab.users WHERE email='admin@example.invalid'"))
      .rows[0].id;
    const student = (
      await db.query(
        "SELECT id,display_name,registration_number FROM lab.users WHERE email='student@example.invalid'"
      )
    ).rows[0];
    const token = randomBytes(32).toString('hex'),
      csrf = randomUUID();
    await db.query(
      "INSERT INTO lab.sessions(token_hash,user_id,csrf_hash,expires_at,last_seen_at) VALUES($1,$2,$3,clock_timestamp()+interval '1 hour',clock_timestamp())",
      [sha(token), admin, sha(csrf)]
    );
    const first = randomUUID(),
      second = randomUUID();
    await db.query(
      "INSERT INTO lab.batches(id,name) VALUES($1,'Governance batch A'),($2,'Governance batch B')",
      [first, second]
    );
    await db.query('SET LOCAL ROLE lab_runtime');
    const call = async (op, target, p) =>
      (
        await db.query('SELECT lab.admin_governance($1,$2,$3,$4,$5) result', [
          token,
          csrf,
          op,
          target,
          p,
        ])
      ).rows[0].result;
    const created = await call('create_user', null, {
      email: `${randomUUID()}@example.invalid`,
      displayName: 'Governance Student',
      passwordHash: `scrypt$${'0'.repeat(32)}$${'1'.repeat(128)}`,
      registrationNumber: `G-${randomUUID()}`,
      roles: ['STUDENT'],
      laboratoryIds: [],
      batchIds: [first, second],
    });
    assert.ok(created.id, JSON.stringify(created));
    const updated = await call('patch_user', student.id, {
      displayName: student.display_name,
      registrationNumber: student.registration_number,
      roles: ['STUDENT'],
      disabled: false,
      laboratoryIds: [],
      batchIds: [first, second],
    });
    assert.equal(updated.id, student.id, JSON.stringify(updated));
    const users = await call('read_users', null, {});
    const row = users.items.find((value) => value.id === student.id);
    assert.deepEqual(new Set(row.batchIds), new Set([first, second]));
    assert.ok(row.batchHistory.length >= 2);
    assert.equal(
      (await call('patch_batch', first, { name: 'Governance batch A', active: false })).code,
      'ACTIVE_MEMBERSHIPS'
    );
    assert.equal(
      (await call('patch_laboratory', randomUUID(), { name: 'Missing', active: false })).code,
      'NOT_FOUND'
    );
    await db.query('RESET ROLE');
  } finally {
    await db.query('ROLLBACK');
    await db.end();
  }
});
