import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID, createHash } from 'node:crypto';
import pg from 'pg';
import { configuration } from './m2-guard.mjs';
const sha = (x) => createHash('sha256').update(x).digest('hex');
test('application reads, comments, multi-line validation and reserve authorization', async () => {
  const db = new pg.Client({ connectionString: configuration(process.env).database });
  await db.connect();
  try {
    await db.query('BEGIN');
    const users = Object.fromEntries(
      (
        await db.query(
          "SELECT id,split_part(email,'@',1) name FROM lab.users WHERE email IN('admin@example.invalid','student@example.invalid','lecturer@example.invalid','officer@example.invalid','multi@example.invalid')"
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
        provenance: 'APP-01 rollback stock ' + randomUUID(),
      },
    ]);
    const secondLocation = randomUUID();
    await db.query('INSERT INTO lab.inv_locations(id,lab_id,name) VALUES($1,$2,$3)', [
      secondLocation,
      stock.lab_id,
      'APP-01 rollback location',
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
    assert.ok((await write('admin', 'policies', { itemId: stock.item_id, policy: 'NONE' })).itemId);
    const line = {
      itemId: stock.item_id,
      labId: stock.lab_id,
      locationId: stock.location_id,
      quantity: 1,
    };
    const payload = {
      purpose: 'APP-01 transaction rollback fixture',
      collectAt: new Date().toISOString(),
      returnAt: new Date(Date.now() + 86400000).toISOString(),
      lines: [line],
    };
    const multi = await write('student', 'requests', {
      ...payload,
      lines: [line, { ...line, locationId: secondLocation }],
    });
    assert.ok(multi.id);
    assert.equal(
      (await call('student', 'read_requests', { requestId: multi.id })).items[0].lines.length,
      2
    );
    assert.equal(
      (await write('student', 'requests', { ...payload, lines: [line, line] })).code,
      'INVALID'
    );
    const request = await write('student', 'requests', payload);
    assert.ok(request.id, JSON.stringify(request));
    const visible = await call('student', 'read_requests', { requestId: request.id });
    assert.equal(visible.items.length, 1);
    assert.equal(visible.items[0].lines.length, 1);
    assert.deepEqual(visible.items[0].lines[0].decisions, []);
    assert.equal(
      (await write('lecturer', 'reserve', { lineId: visible.items[0].lines[0].id })).code,
      'DENIED'
    );
    const commentPayload = { commandId: randomUUID(), requestId: request.id, body: 'original' };
    const comment = await call('student', 'comments', commentPayload);
    assert.ok(comment.id);
    assert.deepEqual(await call('student', 'comments', commentPayload), comment);
    assert.equal(
      (await write('lecturer', 'comments', { requestId: request.id, body: 'unauthorized' })).code,
      'DENIED'
    );
    const corrected = await write('student', 'comments', {
      requestId: request.id,
      body: 'corrected',
      correctsId: comment.id,
    });
    assert.ok(corrected.id);
    assert.equal(
      (
        await write('officer', 'comments', {
          requestId: request.id,
          body: 'wrong author',
          correctsId: corrected.id,
        })
      ).code,
      'DENIED'
    );
    const history = await call('student', 'read_comments', { requestId: request.id });
    assert.equal(history.items.length, 2);
    assert.equal(history.items[0].body, 'original');
    assert.equal(history.items[1].correctsId, comment.id);
    assert.equal(
      (await call('lecturer', 'read_comments', { requestId: request.id })).code,
      'DENIED'
    );
    const reserved = await write('student', 'reserve', { lineId: visible.items[0].lines[0].id });
    assert.ok(reserved.allocationId);
    const ready = await call('student', 'read_ready', { labId: stock.lab_id });
    assert.ok(
      ready.items.some(
        (x) => x.id === reserved.allocationId && x.remaining === 1 && x.requestId === request.id
      )
    );
    const issued = await write('officer', 'issues', {
      allocationId: reserved.allocationId,
      quantity: 1,
    });
    assert.ok(issued.loanId, JSON.stringify(issued));
    const active = await call('student', 'read_loans', { status: 'active', labId: stock.lab_id });
    assert.ok(active.items.some((x) => x.id === issued.loanId && x.outstanding === 1));
    const metrics = await call('student', 'read_metrics', { labId: stock.lab_id });
    assert.ok(metrics.metrics.loans >= 1);
    assert.ok(metrics.metrics.outstandingQuantity >= 1);
    assert.equal((await call('student', 'read_metrics', { labId: randomUUID() })).metrics.loans, 0);
    assert.equal(
      (await call('student', 'read_metrics', { from: '2100-01-01T00:00:00Z' })).metrics.loans,
      0
    );
    await db.query('RESET ROLE');
    await db.query(
      "UPDATE lab.lend_loans SET due_at=clock_timestamp()-interval '1 hour' WHERE id=$1",
      [issued.loanId]
    );
    await db.query('SET LOCAL ROLE lab_runtime');
    assert.ok(
      (await call('student', 'read_loans', { status: 'overdue' })).items.some(
        (x) => x.id === issued.loanId
      )
    );
    assert.equal((await call('student', 'read_loans', { status: 'bogus' })).code, 'INVALID');
    assert.ok(
      (
        await write('officer', 'returns', {
          loanId: issued.loanId,
          condition: 'fixture good condition',
        })
      ).movementId
    );
    assert.ok(
      (await call('student', 'read_loans', { status: 'history' })).items.some(
        (x) => x.id === issued.loanId && x.returns.length === 1
      )
    );
    assert.ok(
      !(await call('student', 'read_loans', { status: 'active' })).items.some(
        (x) => x.id === issued.loanId
      )
    );
    assert.ok(
      (await write('admin', 'policies', { itemId: stock.item_id, policy: 'LECTURER' })).itemId
    );
    const approvalRequest = await write('student', 'requests', {
      ...payload,
      lecturerId: users.lecturer,
    });
    assert.ok(approvalRequest.id);
    const approvalLine = (
      await call('lecturer', 'read_requests', { requestId: approvalRequest.id })
    ).items[0].lines[0];
    assert.equal(
      (
        await write('lecturer', 'decisions', {
          lineId: approvalLine.id,
          decision: 'APPROVE',
          remarks: 'Historical remarks retained',
        })
      ).stage,
      'APPROVED'
    );
    const pastDecision = (
      await call('lecturer', 'read_requests', { requestId: approvalRequest.id })
    ).items[0].lines[0];
    assert.equal(pastDecision.decisions[0].remarks, 'Historical remarks retained');
    assert.ok((await write('admin', 'policies', { itemId: stock.item_id, policy: 'NONE' })).itemId);
    await db.query('RESET ROLE');
    const before = (await db.query('SELECT count(*) n FROM lab.lend_requests')).rows[0].n;
    await db.query('SET LOCAL ROLE lab_runtime');
    assert.equal(
      (
        await write('student', 'requests', {
          ...payload,
          lines: [line, { ...line, itemId: randomUUID() }],
        })
      ).code,
      'POLICY_REQUIRED'
    );
    await db.query('RESET ROLE');
    assert.equal(
      (await db.query('SELECT count(*) n FROM lab.lend_requests')).rows[0].n,
      before,
      'invalid second line rolls back whole request'
    );
  } finally {
    await db.query('ROLLBACK');
    await db.end();
  }
});
