import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID, createHash } from 'node:crypto';
import pg from 'pg';
import { configuration } from './m2-guard.mjs';
const sha = (x) => createHash('sha256').update(x).digest('hex');
test('CP2 drafts, cancellation, policy revisions and versioned per-line approvals conserve stock', async () => {
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
        quantity: 30,
        provenance: 'CP2 rollback ' + randomUUID(),
      },
    ]);
    const inspect = async (sql, args = []) => {
      await db.query('RESET ROLE');
      const rows = (await db.query(sql, args)).rows;
      await db.query('SET LOCAL ROLE lab_runtime');
      return rows;
    };
    const counts = () =>
      inspect(
        'SELECT (SELECT count(*) FROM lab.lend_lines) lines,(SELECT count(*) FROM lab.lend_allocations) allocations,(SELECT count(*) FROM lab.lend_decisions) decisions,(SELECT count(*) FROM lab.inv_movements) movements'
      );
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
    const read = async (id, name = 'student') =>
      (await call(name, 'read_requests', { requestId: id })).items[0];
    const good = (x) => {
      assert.ok(!x.status, JSON.stringify(x));
      return x;
    };
    const payload = {
      purpose: 'CP2 fixture',
      collectAt: new Date().toISOString(),
      returnAt: new Date(Date.now() + 86400000).toISOString(),
      lines: [
        { itemId: stock.item_id, labId: stock.lab_id, locationId: stock.location_id, quantity: 3 },
      ],
    };
    good(await write('admin', 'policies', { itemId: stock.item_id, policy: 'NONE' }));
    const before = await counts();
    let d = good(await write('student', 'drafts', payload));
    assert.deepEqual(
      await counts(),
      before,
      'draft has no lines, decisions, allocations or stock movements'
    );
    assert.equal(
      (await write('officer', 'submit', { draftId: d.id, expectedVersion: 0 })).code,
      'DENIED'
    );
    assert.equal((await call('officer', 'read_drafts', { requestId: d.id })).items.length, 0);
    d = good(
      await write('student', 'drafts', {
        ...payload,
        draftId: d.id,
        expectedVersion: 0,
        purpose: 'Saved draft',
      })
    );
    assert.equal(d.version, 1);
    assert.equal(
      (await write('student', 'submit', { draftId: d.id, expectedVersion: 0 })).code,
      'STALE_VERSION'
    );
    const sub = { commandId: randomUUID(), draftId: d.id, expectedVersion: 1 };
    const submitted = good(await call('student', 'submit', sub));
    assert.deepEqual(await call('student', 'submit', sub), submitted);
    let r = await read(submitted.id);
    assert.equal(r.summary, 'READY');
    assert.equal(r.lines[0].reservedQuantity, 3);
    let l = r.lines[0];
    const allocation = (await call('officer', 'read_ready', { requestId: r.id })).items[0];
    assert.ok(allocation);
    good(
      await write('officer', 'issues', {
        allocationId: allocation.id,
        quantity: 1,
        expectedVersion: l.version,
      })
    );
    l = (await read(r.id)).lines[0];
    assert.equal(
      (
        await write('student', 'cancel', {
          lineId: l.id,
          expectedVersion: l.version,
          quantity: 3,
          reason: 'Too many',
        })
      ).code,
      'STATE_CONFLICT'
    );
    const cancel = {
      commandId: randomUUID(),
      lineId: l.id,
      expectedVersion: l.version,
      quantity: 2,
      reason: 'Unissued remainder',
    };
    good(await call('student', 'cancel', cancel));
    good(await call('student', 'cancel', cancel));
    l = (await read(r.id)).lines[0];
    assert.equal(l.cancelledQuantity, 2);
    assert.equal(l.issuedQuantity, 1);
    assert.equal(l.reservedQuantity, 0);
    assert.equal((await call('officer', 'read_ready', { requestId: r.id })).items.length, 0);
    assert.equal(
      (await write('officer', 'issues', { allocationId: allocation.id, quantity: 1 })).code,
      'STATE_CONFLICT'
    );
    assert.equal(
      (
        await write('student', 'cancel', {
          lineId: l.id,
          expectedVersion: l.version,
          quantity: 1,
          reason: 'Cannot undo handover',
        })
      ).code,
      'STATE_CONFLICT'
    );
    const loan = (await call('student', 'read_loans', { requestId: r.id })).items[0];
    assert.ok(loan);
    good(await write('officer', 'returns', { loanId: loan.id, condition: 'Received' }));
    for (const policy of ['LECTURER', 'HOD', 'BOTH']) {
      good(await write('admin', 'policies', { itemId: stock.item_id, policy, hodId: users.admin }));
      const draft = good(
        await write('student', 'drafts', { ...payload, lecturerId: users.lecturer })
      );
      const request = good(
        await write('student', 'submit', { draftId: draft.id, expectedVersion: 0 })
      );
      let line = (await read(request.id)).lines[0];
      assert.equal(line.reservedQuantity, 0);
      assert.equal(
        (
          await write('student', 'decisions', {
            lineId: line.id,
            expectedVersion: line.version,
            decision: 'APPROVE',
            remarks: 'Self',
          })
        ).code,
        'DENIED'
      );
      assert.equal(
        (
          await write('multi', 'decisions', {
            lineId: line.id,
            decision: 'APPROVE',
            remarks: 'Other lecturer',
          })
        ).code,
        'DENIED'
      );
      const approver = policy === 'HOD' ? 'admin' : 'lecturer';
      assert.equal(
        (
          await write(approver, 'decisions', {
            lineId: line.id,
            expectedVersion: line.version + 1,
            decision: 'APPROVE',
            remarks: 'Stale',
          })
        ).code,
        'STALE_VERSION'
      );
      good(
        await write(approver, 'decisions', {
          lineId: line.id,
          expectedVersion: line.version,
          decision: 'APPROVE',
          remarks: 'First stage',
        })
      );
      line = (await read(request.id)).lines[0];
      if (policy === 'BOTH') {
        assert.equal(line.stage, 'HOD');
        assert.equal(line.reservedQuantity, 0);
        good(
          await write('admin', 'decisions', {
            lineId: line.id,
            expectedVersion: line.version,
            decision: 'APPROVE',
            remarks: 'Second stage',
          })
        );
        line = (await read(request.id)).lines[0];
      }
      assert.equal(line.stage, 'APPROVED');
      assert.equal(line.reservedQuantity, 3);
      good(
        await write('student', 'cancel', {
          lineId: line.id,
          expectedVersion: line.version,
          quantity: 3,
          reason: 'Close unissued',
        })
      );
      assert.equal((await read(request.id)).summary, 'CANCELLED');
    }
    good(await write('admin', 'policies', { itemId: stock.item_id, policy: 'LECTURER' }));
    const pendingDraft = good(
      await write('student', 'drafts', { ...payload, lecturerId: users.lecturer })
    );
    await inspect('DELETE FROM lab.staff_labs WHERE user_id=$1 AND laboratory_id=$2', [
      users.lecturer,
      stock.lab_id,
    ]);
    const beforeInvalid = await counts();
    assert.equal(
      (await write('student', 'submit', { draftId: pendingDraft.id, expectedVersion: 0 })).code,
      'INVALID'
    );
    assert.deepEqual(
      await counts(),
      beforeInvalid,
      'failed submit leaves no partial request or reservation'
    );
    await inspect('INSERT INTO lab.staff_labs VALUES($1,$2)', [users.lecturer, stock.lab_id]);
    const pending = good(
      await write('student', 'submit', { draftId: pendingDraft.id, expectedVersion: 0 })
    );
    let pendingLine = (await read(pending.id)).lines[0];
    good(
      await write('student', 'cancel', {
        lineId: pendingLine.id,
        expectedVersion: pendingLine.version,
        quantity: 1,
        reason: 'Reduce pending quantity',
      })
    );
    pendingLine = (await read(pending.id)).lines[0];
    good(
      await write('lecturer', 'decisions', {
        lineId: pendingLine.id,
        expectedVersion: pendingLine.version,
        decision: 'APPROVE',
        remarks: 'Approve remaining',
      })
    );
    assert.equal((await read(pending.id)).lines[0].reservedQuantity, 2);
    const invalid = good(
      await write('student', 'drafts', {
        ...payload,
        lines: [{ ...payload.lines[0], quantity: 21 }],
      })
    );
    assert.equal(
      (await write('student', 'submit', { draftId: invalid.id, expectedVersion: 0 })).code,
      'INVALID',
      'returnable limit rechecked on submit'
    );
    const self = good(await write('multi', 'drafts', { ...payload, lecturerId: users.multi }));
    assert.equal(
      (await write('multi', 'submit', { draftId: self.id, expectedVersion: 0 })).code,
      'INVALID',
      'multi-role borrower cannot choose self as lecturer'
    );
    // Approval replay must never make a new reservation after stock arrives.
    const emptyLocation = randomUUID();
    await inspect('INSERT INTO lab.inv_locations(id,lab_id,name) VALUES($1,$2,$3)', [
      emptyLocation,
      stock.lab_id,
      'CP2 empty ' + randomUUID(),
    ]);
    const emptyDraft = good(
      await write('student', 'drafts', {
        ...payload,
        lecturerId: users.lecturer,
        lines: [{ ...payload.lines[0], locationId: emptyLocation }],
      })
    );
    const empty = good(
      await write('student', 'submit', { draftId: emptyDraft.id, expectedVersion: 0 })
    );
    const emptyLine = (await read(empty.id)).lines[0];
    const emptyDecision = {
      commandId: randomUUID(),
      lineId: emptyLine.id,
      expectedVersion: emptyLine.version,
      decision: 'APPROVE',
      remarks: 'Await stock',
    };
    const emptyResult = good(await call('lecturer', 'decisions', emptyDecision));
    assert.equal((await read(empty.id)).summary, 'AWAITING_STOCK');
    await inspect('SELECT lab.inv_receive($1,$2)', [
      users.officer,
      {
        itemId: stock.item_id,
        labId: stock.lab_id,
        locationId: emptyLocation,
        quantity: 3,
        provenance: 'CP2 arriving stock ' + randomUUID(),
      },
    ]);
    assert.deepEqual(await call('lecturer', 'decisions', emptyDecision), emptyResult);
    assert.equal(
      (await read(empty.id)).lines[0].reservedQuantity,
      0,
      'decision replay has no new stock effect'
    );
    good(
      await write('student', 'reserve', {
        lineId: emptyLine.id,
        expectedVersion: (await read(empty.id)).lines[0].version,
      })
    );
    // Mixed summaries retain independently approved and rejected lines.
    const mixedDraft = good(
      await write('student', 'drafts', {
        ...payload,
        lecturerId: users.lecturer,
        lines: [payload.lines[0], { ...payload.lines[0], locationId: emptyLocation }],
      })
    );
    const mixed = good(
      await write('student', 'submit', { draftId: mixedDraft.id, expectedVersion: 0 })
    );
    const mixedLines = (await read(mixed.id)).lines;
    good(
      await write('lecturer', 'decisions', {
        lineId: mixedLines[0].id,
        expectedVersion: mixedLines[0].version,
        decision: 'APPROVE',
        remarks: 'Approved line',
      })
    );
    good(
      await write('lecturer', 'decisions', {
        lineId: mixedLines[1].id,
        expectedVersion: mixedLines[1].version,
        decision: 'REJECT',
        remarks: 'Rejected line',
      })
    );
    assert.equal((await read(mixed.id)).summary, 'MIXED');
    assert.equal(
      (
        await call('student', 'read_requests', {
          requestId: mixed.id,
          status: 'MIXED',
          stage: 'REJECTED',
        })
      ).items.length,
      1
    );
    const original = good(
      await write('student', 'requests', { ...payload, lecturerId: users.lecturer })
    );
    let originalRequest = await read(original.id);
    let originalLine = originalRequest.lines[0];
    good(
      await write('lecturer', 'decisions', {
        lineId: originalLine.id,
        expectedVersion: originalLine.version,
        decision: 'REJECT',
        remarks: 'Please correct',
      })
    );
    originalRequest = await read(original.id);
    const comment = good(
      await write('student', 'comments', { requestId: original.id, body: 'Retain me' })
    );
    assert.ok(comment.id);
    const revision = good(
      await write('student', 'revisions', {
        requestId: original.id,
        expectedVersion: originalRequest.version,
      })
    );
    good(
      await write('admin', 'policies', { itemId: stock.item_id, policy: 'HOD', hodId: users.admin })
    );
    const corrected = good(
      await write('student', 'submit', { draftId: revision.id, expectedVersion: 0 })
    );
    const correctedRequest = await read(corrected.id);
    assert.equal(correctedRequest.predecessorId, original.id);
    assert.equal(correctedRequest.revision, 2);
    assert.equal(correctedRequest.lines[0].stage, 'HOD');
    assert.equal((await read(original.id)).lines[0].decisions[0].remarks, 'Please correct');
    assert.equal(
      (await call('student', 'read_comments', { requestId: original.id })).items[0].body,
      'Retain me'
    );
    assert.equal(
      (
        await write('student', 'revisions', {
          requestId: original.id,
          expectedVersion: originalRequest.version,
        })
      ).code,
      'STATE_CONFLICT'
    );
    const cancelledDraft = good(await write('multi', 'drafts', payload));
    good(
      await write('multi', 'cancel', {
        draftId: cancelledDraft.id,
        expectedVersion: 0,
        reason: 'Withdraw draft',
      })
    );
    assert.equal(
      (await write('multi', 'submit', { draftId: cancelledDraft.id, expectedVersion: 1 })).code,
      'STATE_CONFLICT'
    );
    for (const query of [
      { limit: '0' },
      { offset: '-1' },
      { stage: 'bogus' },
      { unknown: 'x' },
      { from: 'bad-date' },
      { from: '2030-01-01', to: '2020-01-01' },
    ])
      assert.equal((await call('student', 'read_requests', query)).code, 'INVALID');
    assert.equal((await call('student', 'read_requests', { limit: '1' })).items.length, 1);
    const balances = await inspect(
      'SELECT movement_id FROM lab.inv_entries GROUP BY movement_id HAVING sum(delta)<>0 OR count(*)<>2'
    );
    assert.deepEqual(balances, []);
    assert.equal(
      (await inspect('SELECT count(*) n FROM lab.inv_cells WHERE quantity<0'))[0].n,
      '0'
    );
    await db.query('RESET ROLE');
    await db.query('SET CONSTRAINTS ALL IMMEDIATE');
  } finally {
    await db.query('ROLLBACK');
    await db.end();
  }
});
