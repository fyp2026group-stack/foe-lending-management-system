import pg from 'pg';
import assert from 'node:assert/strict';
const url = process.env.DATABASE_URL,
  ownerUrl = process.env.MIGRATION_DATABASE_URL;
if (
  !url ||
  !ownerUrl ||
  new URL(url).hostname !== '127.0.0.1' ||
  new URL(url).pathname !== '/lab_m2_test_identity' ||
  new URL(ownerUrl).hostname !== '127.0.0.1' ||
  new URL(ownerUrl).pathname !== '/lab_m2_test_identity'
)
  throw Error('Isolated database required');
const c = new pg.Client({ connectionString: url }),
  owner = new pg.Client({ connectionString: ownerUrl });
await Promise.all([c.connect(), owner.connect()]);
try {
  assert.equal((await c.query('SELECT current_user')).rows[0].current_user, 'lab_runtime');
  const required = [
    'admin@example.invalid',
    'student@example.invalid',
    'lecturer@example.invalid',
    'officer@example.invalid',
    'multi@example.invalid',
  ];
  assert.equal(
    Number(
      (await owner.query('SELECT count(*) FROM lab.users WHERE email=ANY($1)', [required])).rows[0]
        .count
    ),
    required.length
  );
  assert.equal(
    Number(
      (
        await owner.query('SELECT count(DISTINCT role) FROM lab.user_roles WHERE role=ANY($1)', [
          ['ADMIN', 'STUDENT', 'LECTURER', 'TECHNICAL_OFFICER'],
        ])
      ).rows[0].count
    ),
    4
  );
  await assert.rejects(c.query('SELECT count(*) FROM lab.users'), (e) => e.code === '42501');
  for (const sql of [
    'CREATE TABLE lab.forbidden(id int)',
    'DELETE FROM lab.audit',
    'UPDATE lab.audit SET action=action',
    'TRUNCATE lab.audit',
  ])
    await assert.rejects(c.query(sql), (e) => e.code === '42501');
  console.log(
    'Runtime verification passed: required fixtures and roles exist; protected-table/DDL/audit access denied'
  );
} finally {
  await Promise.all([c.end(), owner.end()]);
}
