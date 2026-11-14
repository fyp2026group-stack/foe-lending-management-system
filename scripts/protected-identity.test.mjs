import pg from 'pg';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { verifyPassword, hashPassword } from '../src/lib/server/password.mjs';
const url = process.env.DATABASE_URL;
if (
  !url ||
  new URL(url).hostname !== '127.0.0.1' ||
  new URL(url).pathname !== '/lab_m2_test_identity'
)
  throw Error('Dedicated local database required');
const c = new pg.Client({ connectionString: url });
await c.connect();
const rpc = async (sql, args) => (await c.query(sql, args)).rows[0].result;
try {
  assert.equal((await c.query('SELECT current_user')).rows[0].current_user, 'lab_runtime');
  const role = (
    await c.query(
      'SELECT rolsuper,rolcreaterole,rolcreatedb FROM pg_roles WHERE rolname=current_user'
    )
  ).rows[0];
  assert.equal(role.rolsuper, false);
  assert.equal(role.rolcreaterole, false);
  assert.equal(role.rolcreatedb, false);
  assert.equal(
    (
      await c.query(
        'SELECT count(*)::int AS n FROM pg_auth_members m JOIN pg_roles r ON r.oid=m.member WHERE r.rolname=current_user'
      )
    ).rows[0].n,
    0
  );
  for (const table of [
    'users',
    'sessions',
    'user_roles',
    'staff_labs',
    'batches',
    'laboratories',
    'audit',
    'login_challenges',
    'verifier_secret',
  ]) {
    await assert.rejects(c.query('SELECT * FROM lab.' + table), (e) => e.code === '42501');
    await assert.rejects(c.query('DELETE FROM lab.' + table), (e) => e.code === '42501');
  }
  await assert.rejects(
    c.query("INSERT INTO lab.audit(id,action) VALUES(gen_random_uuid(),'FORGED')"),
    (e) => e.code === '42501'
  );
  await assert.rejects(c.query('CREATE TABLE lab.forbidden(id int)'), (e) => e.code === '42501');
  const start = await rpc('SELECT lab.login_start($1) AS result', ['admin@example.invalid']);
  assert(start.challengeId);
  assert(verifyPassword(process.env.SYNTHETIC_ADMIN_PASSWORD, start.passwordHash));
  const bad = await rpc('SELECT lab.login_finish($1,$2) AS result', [start.challengeId, 'forged']);
  assert.equal(bad.status, 401);
  const again = await rpc('SELECT lab.login_finish($1,$2) AS result', [
    start.challengeId,
    createHmac('sha256', process.env.LOGIN_VERIFIER_SECRET).update(start.challengeId).digest('hex'),
  ]);
  assert.equal(again.status, 401);
  async function login(email) {
    const s = await rpc('SELECT lab.login_start($1) AS result', [email]);
    assert(verifyPassword(process.env.SYNTHETIC_ADMIN_PASSWORD, s.passwordHash));
    return rpc('SELECT lab.login_finish($1,$2) AS result', [
      s.challengeId,
      createHmac('sha256', process.env.LOGIN_VERIFIER_SECRET).update(s.challengeId).digest('hex'),
    ]);
  }
  const admin = await login('admin@example.invalid');
  assert(admin.token);
  const call = (session, op, target, p) =>
    rpc('SELECT lab.identity_call($1,$2,$3,$4,$5) AS result', [
      session.token,
      session.csrfToken,
      op,
      target,
      p,
    ]);
  assert.equal((await call(admin, 'me', null, {})).user.email, 'admin@example.invalid');
  assert(Array.isArray((await call(admin, 'users', null, {})).items));
  assert.equal(
    (
      await rpc('SELECT lab.identity_call($1,$2,$3,$4,$5) AS result', [
        admin.token,
        'wrong',
        'create_batch',
        null,
        { name: 'Denied' },
      ])
    ).status,
    403
  );
  const student = await login('student@example.invalid');
  assert.equal((await call(student, 'users', null, {})).status, 403);
  const created = await call(admin, 'create_user', null, {
    email: 'protected-' + Date.now() + '@example.invalid',
    displayName: 'Synthetic Protected',
    passwordHash: hashPassword(process.env.SYNTHETIC_ADMIN_PASSWORD),
    roles: ['LECTURER'],
    laboratoryIds: [],
  });
  assert(created.id);
  const users = await call(admin, 'users', null, {});
  const newUser = users.items.find((u) => u.id === created.id);
  assert(newUser);
  const newSession = await login(newUser.email);
  assert(newSession.token);
  assert(
    (
      await call(admin, 'patch_user', created.id, {
        roles: ['TECHNICAL_OFFICER'],
        disabled: true,
        laboratoryIds: [],
      })
    ).id
  );
  assert.equal((await call(newSession, 'me', null, {})).status, 401);
  assert.equal(
    (
      await call(admin, 'patch_user', (await call(admin, 'me', null, {})).user.id, {
        roles: ['ADMIN'],
        disabled: false,
        laboratoryIds: [],
      })
    ).status,
    403
  );
  await rpc('SELECT lab.denial($1,$2) AS result', [newSession.token, 'INVALID']);
  const result = await call(admin, 'create_batch', null, { name: 'Protected ' + Date.now() });
  assert(result.id);
  assert.equal(
    (await call(admin, 'create_batch', null, { name: 'Bad', actorId: 'forged' })).status,
    422
  );
  await call(admin, 'logout', null, {});
  assert.equal((await call(admin, 'me', null, {})).status, 401);
  await call(student, 'logout', null, {});
  const owner = new pg.Client({ connectionString: process.env.MIGRATION_DATABASE_URL });
  await owner.connect();
  try {
    const audit = (
      await owner.query(
        "SELECT actor_id,details FROM lab.audit WHERE target_id=$1 AND action='PATCH_USER' ORDER BY occurred_at DESC LIMIT 1",
        [created.id]
      )
    ).rows[0];
    assert(audit.actor_id);
    assert.deepEqual(audit.details.before.roles, ['LECTURER']);
    assert.deepEqual(audit.details.after.roles, ['TECHNICAL_OFFICER']);
    assert.equal(audit.details.after.disabled, true);
    const denial = (
      await owner.query(
        "SELECT actor_id FROM lab.audit WHERE action='REQUEST_DENIED' ORDER BY occurred_at DESC LIMIT 1"
      )
    ).rows[0];
    assert.equal(denial.actor_id, null);
  } finally {
    await owner.end();
  }
  console.log(
    'Protected runtime checks passed: no base reads/DML, forged/consumed challenge denied, scoped me/admin, CSRF, audited mutation, closed payload and logout'
  );
} finally {
  await c.end();
}
