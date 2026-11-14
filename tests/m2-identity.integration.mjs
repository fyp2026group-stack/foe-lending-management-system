// Explicit entry point: intentionally excluded from the default *.test.mjs glob.
// Missing configuration fails, rather than reporting a skipped integration pass.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID, randomBytes, createHash } from 'node:crypto';
import pg from 'pg';
import { configuration } from './m2-guard.mjs';
import { hashPassword } from '../src/lib/server/password.mjs';

test('M2 real PostgreSQL + HTTP identity contract', async (t) => {
  const cfg = configuration(process.env);
  const db = new pg.Client({
    connectionString: cfg.database,
    connectionTimeoutMillis: 3000,
    statement_timeout: 5000,
  });
  await db.connect();
  let savedSharedLimits = [];
  try {
    assert.equal(
      (await db.query('SELECT current_database() AS name')).rows[0].name,
      cfg.databaseName
    );
    savedSharedLimits = (
      await db.query("SELECT * FROM lab.login_limits WHERE key IN ('login-unknown','global')")
    ).rows;
    await db.query(
      "UPDATE lab.login_limits SET attempts=0,until_at=clock_timestamp()+interval '15 minutes' WHERE key IN ('login-unknown','global')"
    );
    const run = randomUUID();
    const password = randomBytes(24).toString('hex');
    const batch = randomUUID(),
      lab = randomUUID();
    const accounts = {};
    await db.query('BEGIN');
    try {
      await db.query('INSERT INTO lab.batches VALUES($1,$2)', [batch, `QA batch ${run}`]);
      await db.query('INSERT INTO lab.laboratories VALUES($1,$2)', [lab, `QA laboratory ${run}`]);
      for (const [name, roles] of Object.entries({
        admin: ['ADMIN'],
        student: ['STUDENT'],
        lecturer: ['LECTURER'],
        officer: ['TECHNICAL_OFFICER'],
        multi: ['STUDENT', 'LECTURER'],
      })) {
        const id = randomUUID(),
          email = `${name}.${run}@example.invalid`;
        await db.query(
          'INSERT INTO lab.users(id,email,display_name,password_hash,batch_id,registration_number) VALUES($1,$2,$3,$4,$5,$6)',
          [
            id,
            email,
            `Synthetic QA ${name}`,
            hashPassword(password),
            roles.includes('STUDENT') ? batch : null,
            roles.includes('STUDENT') ? `QA-${id}` : null,
          ]
        );
        for (const role of roles)
          await db.query('INSERT INTO lab.user_roles VALUES($1,$2)', [id, role]);
        if (roles.some((r) => ['LECTURER', 'TECHNICAL_OFFICER'].includes(r)))
          await db.query('INSERT INTO lab.staff_labs VALUES($1,$2)', [id, lab]);
        accounts[name] = { id, email, roles };
      }
      await db.query('COMMIT');
    } catch (error) {
      await db.query('ROLLBACK');
      throw error;
    }
    async function request(
      path,
      { method = 'GET', actor, body, raw, csrf = true, origin = cfg.origin } = {}
    ) {
      const response = await fetch(`${cfg.origin}/api/${path}`, {
        method,
        redirect: 'error',
        signal: AbortSignal.timeout(10000),
        headers: {
          ...(method !== 'GET' ? { Origin: origin, 'Content-Type': 'application/json' } : {}),
          ...(actor
            ? { Cookie: actor.cookie, ...(csrf ? { 'X-CSRF-Token': actor.csrf } : {}) }
            : {}),
        },
        ...(raw !== undefined
          ? { body: raw, ...(typeof raw !== 'string' ? { duplex: 'half' } : {}) }
          : body !== undefined
            ? { body: JSON.stringify(body) }
            : {}),
      });
      assert.match(response.headers.get('cache-control') || '', /no-store/);
      return {
        status: response.status,
        data: await response.json(),
        cookie: response.headers.get('set-cookie'),
      };
    }
    async function login(account) {
      const r = await request('auth/login', {
        method: 'POST',
        body: { email: account.email, password },
      });
      assert.equal(r.status, 200, 'Synthetic account login');
      assert.match(r.cookie || '', /HttpOnly/i);
      assert.match(r.cookie || '', /SameSite=Strict/i);
      const actor = { cookie: r.cookie.split(';')[0], csrf: r.data.csrfToken };
      // Before any HTTP mutation, prove this app session was written to the guarded database.
      const token = actor.cookie.slice('lab_session='.length);
      const persisted = await db.query('SELECT user_id FROM lab.sessions WHERE token_hash=$1', [
        createHash('sha256').update(token).digest('hex'),
      ]);
      assert.equal(
        persisted.rows[0]?.user_id,
        account.id,
        'App must use this dedicated test database'
      );
      return actor;
    }
    const admin = await login(accounts.admin);
    const actors = {};
    for (const name of ['student', 'lecturer', 'officer', 'multi'])
      actors[name] = await login(accounts[name]);
    await t.test('anonymous and role matrix; private session DTO', async () => {
      assert.equal((await request('auth/me')).status, 401);
      assert.equal((await request('admin/users')).status, 401);
      for (const name of Object.keys(actors)) {
        const me = await request('auth/me', { actor: actors[name] });
        assert.equal(me.status, 200);
        assert.deepEqual([...me.data.user.roles].sort(), [...accounts[name].roles].sort());
        assert.equal(me.data.user.password_hash, undefined);
        assert.equal((await request('admin/users', { actor: actors[name] })).status, 403);
      }
      for (const resource of ['users', 'batches', 'laboratories'])
        assert.equal((await request(`admin/${resource}`, { actor: admin })).status, 200);
    });
    await t.test('origin and CSRF protect administrative writes', async () => {
      const body = { name: `Rejected ${run}` };
      assert.equal(
        (await request('admin/batches', { method: 'POST', actor: admin, body, csrf: false }))
          .status,
        403
      );
      assert.equal(
        (
          await request('admin/batches', {
            method: 'POST',
            actor: admin,
            body,
            origin: 'http://example.invalid',
          })
        ).status,
        403
      );
      assert.equal(
        (await db.query('SELECT count(*)::int AS n FROM lab.batches WHERE name=$1', [body.name]))
          .rows[0].n,
        0
      );
    });
    await t.test('JSON object closure and collection route arity', async () => {
      for (const raw of [
        '{',
        'null',
        '[]',
        JSON.stringify({ name: `Extra ${run}`, unexpected: true }),
      ])
        assert.equal(
          (await request('admin/batches', { method: 'POST', actor: admin, raw })).status,
          422
        );
      assert.equal((await request(`admin/users/${randomUUID()}`, { actor: admin })).status, 404);
      assert.equal(
        (
          await request(`admin/batches/${randomUUID()}`, {
            method: 'POST',
            actor: admin,
            body: { name: `Arity ${run}` },
          })
        ).status,
        404
      );
    });
    await t.test('student profile and laboratory assignment validation', async () => {
      const base = {
        email: `new.${run}@example.invalid`,
        displayName: 'Synthetic QA new',
        password,
      };
      for (const body of [
        { ...base, roles: ['STUDENT'] },
        { ...base, roles: ['ADMIN'], laboratoryIds: [lab] },
        { ...base, roles: ['LECTURER'], laboratoryIds: [lab, lab] },
      ])
        assert.equal(
          (await request('admin/users', { method: 'POST', actor: admin, body })).status,
          422
        );
      const created = await request('admin/users', {
        method: 'POST',
        actor: admin,
        body: { ...base, roles: ['STUDENT'], batchId: batch, registrationNumber: `QA-new-${run}` },
      });
      assert.ok([200, 201].includes(created.status));
      const row = (
        await db.query('SELECT batch_id,registration_number FROM lab.users WHERE id=$1', [
          created.data.id,
        ])
      ).rows[0];
      assert.equal(row.batch_id, batch);
      assert.equal(row.registration_number, `QA-new-${run}`);
      assert.equal(
        (
          await db.query(
            "SELECT count(*)::int AS n FROM lab.audit WHERE target_id=$1 AND action='CREATE_USER'",
            [created.data.id]
          )
        ).rows[0].n,
        1
      );
    });
    await t.test('chunked UTF8 byte limit rejects without creating data', async () => {
      // Under 16384 UTF16 code units, over 16384 UTF8 bytes; no Content-Length.
      const name = 'é'.repeat(9000);
      const payload = Buffer.from(JSON.stringify({ name }));
      async function* chunks() {
        for (let i = 0; i < payload.length; i += 257) yield payload.subarray(i, i + 257);
      }
      const before = (await db.query('SELECT count(*)::int AS n FROM lab.batches')).rows[0].n;
      assert.equal(
        (await request('admin/batches', { method: 'POST', actor: admin, raw: chunks() })).status,
        413
      );
      assert.equal(
        (await db.query('SELECT count(*)::int AS n FROM lab.batches')).rows[0].n,
        before
      );
    });
    await t.test('omitted laboratoryIds preserves assignments or rejects atomically', async () => {
      const target = accounts.officer;
      const before = (
        await db.query(
          'SELECT laboratory_id FROM lab.staff_labs WHERE user_id=$1 ORDER BY laboratory_id',
          [target.id]
        )
      ).rows;
      const result = await request(`admin/users/${target.id}`, {
        method: 'PATCH',
        actor: admin,
        body: { roles: target.roles, disabled: false },
      });
      assert.ok([200, 422].includes(result.status));
      assert.deepEqual(
        (
          await db.query(
            'SELECT laboratory_id FROM lab.staff_labs WHERE user_id=$1 ORDER BY laboratory_id',
            [target.id]
          )
        ).rows,
        before
      );
    });
    await t.test('idle and absolute expiry independently reject sessions', async () => {
      for (const mode of ['idle', 'absolute']) {
        const actor = await login(accounts.lecturer);
        const tokenHash = createHash('sha256')
          .update(actor.cookie.slice('lab_session='.length))
          .digest('hex');
        const initial = (
          await db.query('SELECT expires_at FROM lab.sessions WHERE token_hash=$1', [tokenHash])
        ).rows[0];
        assert.equal((await request('auth/me', { actor })).status, 200);
        assert.equal(
          (
            await db.query('SELECT expires_at FROM lab.sessions WHERE token_hash=$1', [tokenHash])
          ).rows[0].expires_at.getTime(),
          initial.expires_at.getTime(),
          'Activity cannot extend absolute expiry'
        );
        await db.query(
          mode === 'idle'
            ? "UPDATE lab.sessions SET last_seen_at=clock_timestamp()-interval '31 minutes' WHERE token_hash=$1"
            : "UPDATE lab.sessions SET expires_at=clock_timestamp()-interval '1 second',last_seen_at=clock_timestamp() WHERE token_hash=$1",
          [tokenHash]
        );
        assert.equal((await request('auth/me', { actor })).status, 401, mode);
      }
    });
    await t.test('login denial persists audit and account counter together', async () => {
      const email = `denied.${run}@example.invalid`,
        key = 'login-unknown';
      const counterBefore =
        (await db.query('SELECT attempts FROM lab.login_limits WHERE key=$1', [key])).rows[0]
          ?.attempts ?? 0;
      const before = (
        await db.query("SELECT count(*)::int AS n FROM lab.audit WHERE action='LOGIN_DENIED'")
      ).rows[0].n;
      assert.equal(
        (await request('auth/login', { method: 'POST', body: { email, password } })).status,
        401
      );
      assert.equal(
        (await db.query('SELECT attempts FROM lab.login_limits WHERE key=$1', [key])).rows[0]
          .attempts,
        counterBefore + 1
      );
      assert.equal(
        (await db.query("SELECT count(*)::int AS n FROM lab.audit WHERE action='LOGIN_DENIED'"))
          .rows[0].n,
        before + 1
      );
    });
    await t.test('shared unknown-account limiter bounds rotating account records', async () => {
      const saved = (await db.query("SELECT * FROM lab.login_limits WHERE key='login-unknown'"))
        .rows[0];
      assert.ok(saved, 'Login setup should have initialized limiter');
      try {
        await db.query(
          "UPDATE lab.login_limits SET attempts=20,until_at=clock_timestamp()+interval '15 minutes' WHERE key='login-unknown'"
        );
        const before = (await db.query('SELECT count(*)::int AS n FROM lab.login_limits')).rows[0]
          .n;
        for (let i = 0; i < 3; i++) {
          const email = `rotating-${i}.${run}@example.invalid`;
          assert.equal(
            (await request('auth/login', { method: 'POST', body: { email, password } })).status,
            429
          );
        }
        assert.equal(
          (await db.query('SELECT count(*)::int AS n FROM lab.login_limits')).rows[0].n,
          before
        );
      } finally {
        await db.query(
          "UPDATE lab.login_limits SET attempts=$1,until_at=$2 WHERE key='login-unknown'",
          [saved.attempts, saved.until_at]
        );
      }
    });
    await t.test(
      'grant replacement revokes old sessions; disable blocks login; logout revokes',
      async () => {
        const target = accounts.multi;
        assert.equal(
          (
            await request(`admin/users/${target.id}`, {
              method: 'PATCH',
              actor: admin,
              body: { roles: ['LECTURER'], disabled: false, laboratoryIds: [lab], batchIds: [] },
            })
          ).status,
          200
        );
        assert.equal((await request('auth/me', { actor: actors.multi })).status, 401);
        const fresh = await login(target);
        assert.deepEqual((await request('auth/me', { actor: fresh })).data.user.roles, [
          'LECTURER',
        ]);
        const changeAudit = (
          await db.query(
            "SELECT actor_id,target_id,action,details FROM lab.audit WHERE actor_id=$1 AND target_id=$2 AND action='PATCH_USER'",
            [accounts.admin.id, target.id]
          )
        ).rows;
        assert.equal(changeAudit.length, 1);
        assert.deepEqual([...changeAudit[0].details.before.roles].sort(), ['LECTURER', 'STUDENT']);
        assert.equal(changeAudit[0].details.before.disabled, false);
        assert.deepEqual(changeAudit[0].details.before.labs, [lab]);
        assert.deepEqual(changeAudit[0].details.after, {
          disabled: false,
          roles: ['LECTURER'],
          labs: [lab],
        });
        assert.deepEqual(
          (await db.query('SELECT role FROM lab.user_roles WHERE user_id=$1', [target.id])).rows,
          [{ role: 'LECTURER' }]
        );
        assert.equal(
          (
            await request(`admin/users/${target.id}`, {
              method: 'PATCH',
              actor: admin,
              body: { roles: ['LECTURER'], disabled: true, laboratoryIds: [lab] },
            })
          ).status,
          200
        );
        assert.equal((await request('auth/me', { actor: fresh })).status, 401);
        assert.equal(
          (await request('auth/login', { method: 'POST', body: { email: target.email, password } }))
            .status,
          401
        );
        assert.equal(
          (await request('auth/logout', { method: 'POST', actor: actors.student, body: {} }))
            .status,
          200
        );
        assert.equal((await request('auth/me', { actor: actors.student })).status, 401);
      }
    );
    await t.test('failed foreign key leaves no partial user, roles or success audit', async () => {
      const email = `rollback.${run}@example.invalid`;
      const before = (
        await db.query(
          "SELECT count(*)::int AS n FROM lab.audit WHERE actor_id=$1 AND action='CREATE_USER'",
          [accounts.admin.id]
        )
      ).rows[0].n;
      const r = await request('admin/users', {
        method: 'POST',
        actor: admin,
        body: {
          email,
          displayName: 'Synthetic rollback',
          password,
          roles: ['LECTURER'],
          laboratoryIds: [randomUUID()],
        },
      });
      assert.ok(r.status >= 400);
      assert.equal(
        (await db.query('SELECT count(*)::int AS n FROM lab.users WHERE email=$1', [email])).rows[0]
          .n,
        0
      );
      assert.equal(
        (
          await db.query(
            "SELECT count(*)::int AS n FROM lab.audit WHERE actor_id=$1 AND action='CREATE_USER'",
            [accounts.admin.id]
          )
        ).rows[0].n,
        before
      );
    });
    await t.test(
      'concurrent logout and read allow only ordered outcomes; postcommit rejects',
      async () => {
        const actor = await login(accounts.lecturer);
        const [read, logout] = await Promise.all([
          request('auth/me', { actor }),
          request('auth/logout', { method: 'POST', actor, body: {} }),
        ]);
        assert.ok([200, 401].includes(read.status));
        assert.equal(logout.status, 200);
        assert.equal((await request('auth/me', { actor })).status, 401);
      }
    );
    await t.test(
      'injected success audit failure rolls back role, disabled and session changes',
      async () => {
        const target = accounts.lecturer,
          actor = await login(target);
        const constraint = `qa_audit_${run.replaceAll('-', '')}`;
        const before = (await db.query('SELECT disabled FROM lab.users WHERE id=$1', [target.id]))
          .rows;
        // UUID generated locally, never supplied by a request. Constraint affects this fixture only.
        await db.query(
          `ALTER TABLE lab.audit ADD CONSTRAINT ${constraint} CHECK (NOT (action='PATCH_USER' AND target_id='${target.id}'::uuid)) NOT VALID`
        );
        try {
          const result = await request(`admin/users/${target.id}`, {
            method: 'PATCH',
            actor: admin,
            body: { roles: ['ADMIN'], disabled: true, laboratoryIds: [] },
          });
          assert.ok(result.status >= 400, 'No success without success audit');
          assert.deepEqual(
            (await db.query('SELECT disabled FROM lab.users WHERE id=$1', [target.id])).rows,
            before
          );
          assert.deepEqual(
            (await db.query('SELECT role FROM lab.user_roles WHERE user_id=$1', [target.id])).rows,
            [{ role: 'LECTURER' }]
          );
          assert.equal(
            (await request('auth/me', { actor })).status,
            200,
            'Session revocation must roll back too'
          );
          assert.equal(
            (
              await db.query(
                "SELECT count(*)::int AS n FROM lab.audit WHERE target_id=$1 AND action='PATCH_USER'",
                [target.id]
              )
            ).rows[0].n,
            0
          );
        } finally {
          await db.query(`ALTER TABLE lab.audit DROP CONSTRAINT ${constraint}`);
        }
      }
    );
    await t.test('runtime role cannot modify audit or create schema objects', async () => {
      const r = (
        await db.query(
          "SELECT rolname,rolsuper,rolcreatedb,rolcreaterole, has_table_privilege(oid,'lab.audit','UPDATE') AS au, has_table_privilege(oid,'lab.audit','DELETE') AS ad, has_schema_privilege(oid,'lab','CREATE') AS sc FROM pg_roles WHERE rolname='lab_runtime'"
        )
      ).rows[0];
      assert.ok(r);
      for (const key of ['rolsuper', 'rolcreatedb', 'rolcreaterole', 'au', 'ad', 'sc'])
        assert.equal(r[key], false, key);
    });
    await t.test(
      'actual runtime credential cannot directly write protected identity tables',
      async () => {
        // Required once protected interfaces land. Missing credential is a failing prerequisite, never a green skip.
        assert.ok(
          process.env.M2_TEST_RUNTIME_DATABASE_URL,
          'Runtime credential required for privilege execution evidence'
        );
        const runtimeCfg = configuration({
          ...process.env,
          M2_TEST_DATABASE_URL: process.env.M2_TEST_RUNTIME_DATABASE_URL,
        });
        assert.equal(runtimeCfg.databaseName, cfg.databaseName);
        const runtime = new pg.Client({
          connectionString: runtimeCfg.database,
          connectionTimeoutMillis: 3000,
        });
        await runtime.connect();
        try {
          assert.equal(
            (await runtime.query('SELECT current_user AS role')).rows[0].role,
            'lab_runtime'
          );
          for (const sql of [
            'UPDATE lab.users SET disabled=disabled WHERE false',
            'DELETE FROM lab.user_roles WHERE false',
            'UPDATE lab.sessions SET revoked=revoked WHERE false',
            'UPDATE lab.audit SET action=action WHERE false',
          ]) {
            await runtime.query('BEGIN');
            try {
              await assert.rejects(runtime.query(sql), (error) => error.code === '42501');
            } finally {
              await runtime.query('ROLLBACK');
            }
          }
        } finally {
          await runtime.end();
        }
      }
    );
  } finally {
    try {
      for (const row of savedSharedLimits)
        await db.query('UPDATE lab.login_limits SET attempts=$1,until_at=$2 WHERE key=$3', [
          row.attempts,
          row.until_at,
          row.key,
        ]);
    } finally {
      await db.end();
    }
  }
});
