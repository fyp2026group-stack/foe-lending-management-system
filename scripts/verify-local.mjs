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
  // Prisma migration history must be owned by the migration role, not runtime.
  const applied = (await owner.query(
    'SELECT migration_name FROM lab._prisma_migrations WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL'
  )).rows.map((row) => row.migration_name);
  assert.ok(applied.includes('0_init'), 'Prisma legacy baseline must be marked applied');
  assert.ok(
    applied.includes('20261115070200_admin_catalogue_reads'),
    'Reference-read privilege migration must be applied'
  );
  for (const table of ['lab.batches', 'lab.laboratories', 'lab.staff_labs', 'lab.inv_locations', 'lab.user_batch_memberships']) {
    assert.equal(
      (await c.query('SELECT has_table_privilege(current_user,$1,\'SELECT\') AS allowed', [table])).rows[0].allowed,
      true, 'Prisma reference-read grant missing: ' + table
    );
  }
  for (const table of ['lab.users','lab.sessions','lab.inv_cells','lab.lend_lines','lab.audit']) {
    assert.equal(
      (await c.query('SELECT has_table_privilege(current_user,$1,\'SELECT\') AS allowed', [table])).rows[0].allowed,
      false, 'Sensitive data read must remain denied: ' + table
    );
  }
  for (const [table,column] of [
    ['lab.inv_items','id'], ['lab.inv_items','name'],
    ['lab.lend_policies','item_id'],['lab.lend_policies','policy'],['lab.lend_policies','hod_id'],
    ['lab.inv_categories','id'],['lab.inv_categories','name'],['lab.inv_categories','active'],['lab.inv_categories','version']
  ]) {
    const { rows } = await c.query(
      'SELECT has_column_privilege(current_user,$1,$2,\'SELECT\') AS allowed',
      [table,column]
    );
    assert.equal(rows[0].allowed, true, 'Missing typed-policy read privilege: ' + table + '.' + column);
  }
  assert.equal(
    (await c.query('SELECT has_column_privilege(current_user,$1,$2,\'SELECT\') AS allowed',
      ['lab.inv_items','specifications'])).rows[0].allowed,
    false, 'Runtime must not read unrestricted item specification columns'
  );
  const replaySource = (await owner.query(
    "SELECT pg_get_functiondef('lab.lending_call_cp2(text,text,text,jsonb)'::regprocedure) AS source"
  )).rows[0].source;
  assert.match(replaySource, /EXECUTE 'UPDATE lab\.lend_commands c SET result=\$1/);
  assert.doesNotMatch(replaySource, /lending_call(?:_cp2)?\.result/);
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
