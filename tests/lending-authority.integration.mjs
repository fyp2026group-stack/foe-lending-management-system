import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID, createHash } from 'node:crypto';
import pg from 'pg';
import { configuration } from './m2-guard.mjs';
const sha = (x) => createHash('sha256').update(x).digest('hex');
test('current approver authority and borrower eligibility are required, including replay', async () => {
  const db = new pg.Client({ connectionString: configuration(process.env).database });
  await db.connect();
  try {
    await db.query('BEGIN');
    const users = Object.fromEntries(
      (
        await db.query(
          "SELECT id,split_part(email,'@',1) name FROM lab.users WHERE email IN('admin@example.invalid','student@example.invalid','lecturer@example.invalid','officer@example.invalid')"
        )
      ).rows.map((x) => [x.name, x.id])
    );
    const sessions = {};
    for (const name of Object.keys(users)) {
      const token = randomUUID(),
        csrf = randomUUID();
      sessions[name] = { token, csrf };
      await db.query(
        "INSERT INTO lab.sessions(token_hash,user_id,csrf_hash,expires_at,last_seen_at) VALUES($1,$2,$3,clock_timestamp()+interval '1 hour',clock_timestamp())",
        [sha(token), users[name], sha(csrf)]
      );
    }
    const stock = (
      await db.query(
        "SELECT * FROM lab.inv_cells WHERE item_id='20000000-0000-4000-8000-000000000002' AND state='AVAILABLE' AND asset_id IS NULL LIMIT 1"
      )
    ).rows[0];
    assert.ok(stock);
    await db.query('SELECT lab.inv_receive($1,$2)', [
      users.officer,
      {
        itemId: stock.item_id,
        labId: stock.lab_id,
        locationId: stock.location_id,
        quantity: 4,
        provenance: 'Authority rollback stock ' + randomUUID(),
      },
    ]);
    await db.query('SET LOCAL ROLE lab_runtime');
    const call = async (name, op, p = {}) =>
      (
        await db.query('SELECT lab.lending_call($1,$2,$3,$4) result', [
          sessions[name].token,
          sessions[name].csrf,
          op,
          p,
        ])
      ).rows[0].result;
    const write = (name, op, p) => call(name, op, { commandId: randomUUID(), ...p });
    const mutate = async (sql, args) => {
      await db.query('RESET ROLE');
      await db.query(sql, args);
      await db.query('SET LOCAL ROLE lab_runtime');
    };
    assert.ok(
      (
        await write('admin', 'policies', {
          itemId: stock.item_id,
          policy: 'BOTH',
          hodId: users.admin,
        })
      ).itemId
    );
    const request = await write('student', 'requests', {
      purpose: 'Current authority regression',
      lecturerId: users.lecturer,
      collectAt: new Date().toISOString(),
      returnAt: new Date(Date.now() + 86400000).toISOString(),
      lines: [
        { itemId: stock.item_id, labId: stock.lab_id, locationId: stock.location_id, quantity: 2 },
      ],
    });
    assert.ok(request.id);
    const line = (await call('lecturer', 'read_requests', { requestId: request.id })).items[0]
      .lines[0];
    const decision = {
      commandId: randomUUID(),
      lineId: line.id,
      decision: 'APPROVE',
      remarks: 'Authority regression approval',
    };
    const assertConcealed = async () => {
      assert.deepEqual(
        (await call('lecturer', 'read_requests', { requestId: request.id })).items,
        []
      );
      assert.equal(
        (await call('lecturer', 'read_comments', { requestId: request.id })).code,
        'DENIED'
      );
      assert.equal((await call('lecturer', 'decisions', decision)).code, 'DENIED');
    };
    await mutate('DELETE FROM lab.staff_labs WHERE user_id=$1 AND laboratory_id=$2', [
      users.lecturer,
      stock.lab_id,
    ]);
    await assertConcealed(); // A lecturer role alone is insufficient.
    await mutate("DELETE FROM lab.user_roles WHERE user_id=$1 AND role='LECTURER'", [
      users.lecturer,
    ]);
    await mutate("INSERT INTO lab.user_roles VALUES($1,'STUDENT')", [users.lecturer]);
    await assertConcealed(); // Reproduced downgraded lecturer case.
    await mutate('INSERT INTO lab.staff_labs VALUES($1,$2)', [users.lecturer, stock.lab_id]);
    await assertConcealed(); // Lab assignment alone is insufficient.
    await mutate("INSERT INTO lab.user_roles VALUES($1,'LECTURER')", [users.lecturer]);
    const approvedByLecturer = await call('lecturer', 'decisions', decision);
    assert.equal(approvedByLecturer.stage, 'HOD', JSON.stringify(approvedByLecturer));
    assert.equal((await call('lecturer', 'decisions', decision)).stage, 'HOD', 'authorized replay');
    await mutate("DELETE FROM lab.user_roles WHERE user_id=$1 AND role='LECTURER'", [
      users.lecturer,
    ]);
    await assertConcealed(); // Previously successful command cannot bypass revocation.
    const hod = {
      commandId: randomUUID(),
      lineId: line.id,
      decision: 'APPROVE',
      remarks: 'HOD authority',
    };
    await mutate("INSERT INTO lab.user_roles VALUES($1,'STUDENT')", [users.admin]);
    await mutate("DELETE FROM lab.user_roles WHERE user_id=$1 AND role='ADMIN'", [users.admin]);
    assert.deepEqual((await call('admin', 'read_requests', { requestId: request.id })).items, []);
    assert.equal((await call('admin', 'decisions', hod)).code, 'DENIED');
    await mutate("INSERT INTO lab.user_roles VALUES($1,'ADMIN')", [users.admin]);
    assert.equal((await call('admin', 'decisions', hod)).stage, 'APPROVED');
    const allocation = await write('student', 'reserve', { lineId: line.id });
    assert.ok(allocation.allocationId);
    const issue = { commandId: randomUUID(), allocationId: allocation.allocationId, quantity: 1 };
    const assertNoIssue = async () => {
      assert.equal((await call('officer', 'issues', issue)).code, 'DENIED');
      await db.query('RESET ROLE');
      assert.equal(
        Number(
          (
            await db.query('SELECT count(*) n FROM lab.lend_loans WHERE allocation_id=$1', [
              allocation.allocationId,
            ])
          ).rows[0].n
        ),
        0
      );
      assert.equal(
        (
          await db.query('SELECT issued FROM lab.lend_allocations WHERE id=$1', [
            allocation.allocationId,
          ])
        ).rows[0].issued,
        0
      );
      await db.query('SET LOCAL ROLE lab_runtime');
    };
    await mutate('UPDATE lab.users SET disabled=true WHERE id=$1', [users.student]);
    await assertNoIssue();
    await mutate('UPDATE lab.users SET disabled=false WHERE id=$1', [users.student]);
    await mutate("DELETE FROM lab.user_roles WHERE user_id=$1 AND role='STUDENT'", [users.student]);
    await assertNoIssue();
    await mutate("INSERT INTO lab.user_roles VALUES($1,'STUDENT')", [users.student]);
    const issued = await call('officer', 'issues', issue);
    assert.ok(issued.loanId);
    await mutate('UPDATE lab.users SET disabled=true WHERE id=$1', [users.student]);
    assert.equal(
      (await call('officer', 'issues', issue)).code,
      'DENIED',
      'issue replay still checks borrower'
    );
    await mutate('UPDATE lab.users SET disabled=false WHERE id=$1', [users.student]);
    assert.deepEqual(await call('officer', 'issues', issue), issued);
    await mutate('DELETE FROM lab.staff_labs WHERE user_id=$1 AND laboratory_id=$2', [
      users.officer,
      stock.lab_id,
    ]);
    assert.equal(
      (await call('officer', 'issues', issue)).code,
      'DENIED',
      'issue replay still checks officer scope'
    );
  } finally {
    await db.query('ROLLBACK');
    await db.end();
  }
});
