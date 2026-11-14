import pg from 'pg';
import assert from 'node:assert/strict';
import { randomUUID, createHmac } from 'node:crypto';
import { hashPassword } from '../src/lib/server/password.mjs';
import { runAdmitted } from '../src/lib/server/admission.ts';
const url = process.env.DATABASE_URL;
if (
  !url ||
  new URL(url).hostname !== '127.0.0.1' ||
  new URL(url).pathname !== '/lab_m2_test_identity'
)
  throw Error('Dedicated local database required');
const runtime = new pg.Client({ connectionString: url }),
  owner = new pg.Client({ connectionString: process.env.MIGRATION_DATABASE_URL });
await runtime.connect();
await owner.connect();
const rpc = async (sql, args) => (await runtime.query(sql, args)).rows[0].result;
let workCalls = 0;
const admit = async (token, csrf) =>
  runAdmitted(
    () => rpc('SELECT lab.admin_hash_admit($1,$2) AS result', [token, csrf]),
    async () => {
      workCalls++;
      return { admitted: true };
    }
  );
try {
  const suffix = randomUUID();
  const password = 'Synthetic-Admission-' + suffix;
  async function fixture(role) {
    const id = randomUUID(),
      email = role.toLowerCase() + '-' + suffix + '@example.invalid';
    await owner.query('BEGIN');
    await owner.query(
      'INSERT INTO lab.users(id,email,display_name,password_hash) VALUES($1,$2,$3,$4)',
      [id, email, 'Synthetic admission', hashPassword(password)]
    );
    await owner.query('INSERT INTO lab.user_roles VALUES($1,$2)', [id, role]);
    await owner.query('COMMIT');
    const start = await rpc('SELECT lab.login_start($1) AS result', [email]);
    assert(start.challengeId);
    return rpc('SELECT lab.login_finish($1,$2) AS result', [
      start.challengeId,
      createHmac('sha256', process.env.LOGIN_VERIFIER_SECRET)
        .update(start.challengeId)
        .digest('hex'),
    ]);
  }
  const admin = await fixture('ADMIN'),
    staff = await fixture('LECTURER');
  assert.equal((await admit('invalid', 'invalid')).status, 401);
  assert.equal(workCalls, 0);
  assert.equal((await admit(staff.token, staff.csrfToken)).status, 403);
  assert.equal(workCalls, 0);
  assert.equal((await admit(admin.token, 'wrong')).status, 403);
  assert.equal(workCalls, 0);
  for (let i = 0; i < 5; i++)
    assert.equal((await admit(admin.token, admin.csrfToken)).admitted, true);
  assert.equal(workCalls, 5);
  assert.equal((await admit(admin.token, admin.csrfToken)).status, 429);
  assert.equal(workCalls, 5);
  const before =
    (await owner.query('SELECT suppressed FROM lab.denial_suppression WHERE singleton')).rows[0]
      ?.suppressed ?? '0';
  for (let i = 0; i < 105; i++)
    await runtime.query("SELECT lab.denial($1,'INVALID')", [staff.token]);
  const summary = await rpc('SELECT lab.denial_summary($1) AS result', [admin.token]);
  assert(BigInt(summary.suppressed) > BigInt(before));
  assert.equal((await rpc('SELECT lab.denial_summary($1) AS result', [staff.token])).status, 403);
  const audit = (
    await owner.query(
      "SELECT action,details FROM lab.audit WHERE action='CALLER_REPORTED_DENIAL' ORDER BY occurred_at DESC LIMIT 1"
    )
  ).rows[0];
  assert(audit.details.attribution.includes('not proven'));
  for (let i = 0; i < 22; i++)
    await rpc('SELECT lab.login_start($1) AS result', [
      'unknown-' + i + '-' + suffix + '@example.invalid',
    ]);
  const known = await rpc('SELECT lab.login_start($1) AS result', [
    (
      await owner.query(
        "SELECT email FROM lab.users WHERE id=(SELECT user_id FROM lab.sessions WHERE token_hash=encode(public.digest($1,'sha256'),'hex'))",
        [admin.token]
      )
    ).rows[0].email,
  ]);
  assert(known.challengeId);
  await owner.query(
    "UPDATE lab.sessions SET revoked=true WHERE token_hash=encode(public.digest($1,'sha256'),'hex')",
    [admin.token]
  );
  assert.equal((await admit(admin.token, admin.csrfToken)).status, 401);
  assert.equal(workCalls, 5);
  console.log(
    'Admission passed: unauth/nonadmin/CSRF/revoked zero hash calls; five-work cap; unknown-account budget preserves known account; durable suppression summary and report labeling'
  );
} finally {
  await runtime.end();
  await owner.end();
}
