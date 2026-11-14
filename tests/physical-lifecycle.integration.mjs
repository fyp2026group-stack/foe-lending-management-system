import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID, createHash } from 'node:crypto';
import pg from 'pg';
import { configuration } from './m2-guard.mjs';
const sha = (x) => createHash('sha256').update(x).digest('hex');
test('CP3 physical custody, identity reuse, independent inspection, maintenance and extensions conserve stock', async () => {
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
    const loc = randomUUID();
    await db.query('INSERT INTO lab.inv_locations(id,lab_id,name) VALUES($1,$2,$3)', [
      loc,
      stock.lab_id,
      'CP3 ' + randomUUID(),
    ]);
    await db.query('SELECT lab.inv_receive($1,$2)', [
      users.officer,
      {
        itemId: stock.item_id,
        labId: stock.lab_id,
        locationId: loc,
        quantity: 12,
        provenance: 'CP3 ' + randomUUID(),
      },
    ]);
    const inspect = async (sql, args = []) => {
      await db.query('RESET ROLE');
      const rows = (await db.query(sql, args)).rows;
      await db.query('SET LOCAL ROLE lab_runtime');
      return rows;
    };
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
    const good = (x) => {
      assert.ok(!x.status, JSON.stringify(x));
      return x;
    };
    const req = async (id, name = 'student') =>
      good(await call(name, 'read_requests', { requestId: id })).items[0];
    const loan = async (id, name = 'student') =>
      good(await call(name, 'read_borrower-history', { loanId: id })).items[0];
    const state = async (asset) =>
      (
        await inspect('SELECT state FROM lab.inv_cells WHERE asset_id=$1 AND quantity=1', [asset])
      )[0].state;
    const payload = {
      purpose: 'CP3',
      collectAt: new Date().toISOString(),
      returnAt: new Date(Date.now() + 86400000).toISOString(),
      lines: [{ itemId: stock.item_id, labId: stock.lab_id, locationId: loc, quantity: 3 }],
    };
    good(await write('admin', 'policies', { itemId: stock.item_id, policy: 'NONE' }));
    const create = async (name = 'student', quantity = 3, locationId = loc) => {
      const d = good(
        await write(name, 'drafts', {
          ...payload,
          lines: [{ ...payload.lines[0], quantity, locationId }],
        })
      );
      const r = good(await write(name, 'submit', { draftId: d.id, expectedVersion: 0 }));
      return {
        r: await req(r.id, name),
        a: good(await call('officer', 'read_ready', { requestId: r.id })).items[0],
      };
    };
    let { r, a } = await create();
    const period = {
      from: new Date(Date.now() - 86400000).toISOString(),
      to: new Date(Date.now() + 86400000).toISOString(),
      labId: stock.lab_id,
    };
    const before = good(await call('officer', 'read_operations-summary', period)).completed;
    const issue = {
      commandId: randomUUID(),
      allocationId: a.id,
      quantity: 1,
      expectedVersion: r.lines[0].version,
      serial: 'CP3-' + randomUUID(),
      remarks: '  Identity checked; cable included.  ',
    };
    const first = good(await call('officer', 'issues', issue));
    assert.deepEqual(await call('officer', 'issues', issue), first);
    assert.equal(await state(first.assetId), 'BORROWED');
    assert.equal((await loan(first.loanId)).handover.remarks, 'Identity checked; cable included.');
    assert.equal((await loan(first.loanId)).handover.actor_id, users.officer);
    const after = good(await call('officer', 'read_operations-summary', period)).completed;
    assert.equal(after.handovers, before.handovers + 1);
    assert.equal(
      after.total,
      before.total + 1,
      'replay and materialization do not double-count completed handovers'
    );
    assert.equal(
      (await loan(first.loanId)).labName,
      (await inspect('SELECT name FROM lab.laboratories WHERE id=$1', [stock.lab_id]))[0].name
    );
    assert.equal(
      (await call('officer', 'issues', { ...issue, remarks: 'Changed' })).code,
      'IDENTITY_CONFLICT'
    );
    r = await req(r.id);
    for (const remarks of ['', true, {}, 'x'.repeat(1001)])
      assert.equal(
        (await write('officer', 'issues', { allocationId: a.id, quantity: 1, remarks })).code,
        'INVALID'
      );
    assert.equal(
      good(await call('officer', 'read_ready', { requestId: r.id })).items[0].labName,
      (await loan(first.loanId)).labName
    );
    assert.equal(
      (
        await write('officer', 'issues', {
          ...issue,
          commandId: randomUUID(),
          expectedVersion: r.lines[0].version,
        })
      ).code,
      'STATE_CONFLICT',
      'duplicate serial cannot create second identity'
    );
    const second = good(
      await write('multi', 'issues', {
        allocationId: a.id,
        quantity: 1,
        expectedVersion: r.lines[0].version,
      })
    );
    r = await req(r.id);
    assert.equal(
      (await write('officer', 'issues', { allocationId: a.id, quantity: 1, expectedVersion: 0 }))
        .code,
      'STALE_VERSION'
    );
    // A multi-role borrower cannot hand over to or inspect for themselves.
    const self = await create('multi', 1);
    assert.equal(
      (await write('multi', 'issues', { allocationId: self.a.id, quantity: 1 })).code,
      'DENIED'
    );
    const selfLoan = good(
      await write('officer', 'issues', { allocationId: self.a.id, quantity: 1 })
    );
    const selfExtension = good(
      await write('multi', 'extensions', {
        loanId: selfLoan.loanId,
        expectedVersion: 0,
        proposedDueAt: new Date(Date.now() + 172800000).toISOString(),
        reason: 'Multi-role borrower',
      })
    );
    assert.equal(
      (
        await write('multi', 'extension-decisions', {
          extensionId: selfExtension.extensionId,
          expectedVersion: 0,
          decision: 'APPROVE',
          remarks: 'Own lecturer role',
        })
      ).code,
      'DENIED'
    );
    assert.equal(
      (await write('multi', 'returns', { loanId: selfLoan.loanId, condition: 'Self receipt' }))
        .code,
      'DENIED'
    );
    const selfReceipt = good(
      await write('officer', 'returns', { loanId: selfLoan.loanId, condition: 'Received' })
    );
    assert.equal(
      (
        await write('multi', 'inspections', {
          inspectionId: selfReceipt.inspectionId,
          expectedVersion: 0,
          outcome: 'CLEAR_AVAILABLE',
          condition: 'Good',
          notes: 'Self clearance',
        })
      ).code,
      'DENIED'
    );
    // Consumables have quantity fulfilment but no borrowed-equipment obligations.
    const consumable = randomUUID();
    await inspect(
      "INSERT INTO lab.inv_items(id,category_id,name,kind,uom) SELECT $1,category_id,$2,'CONSUMABLE','unit' FROM lab.inv_items WHERE id=$3",
      [consumable, 'CP3 supplies ' + randomUUID(), stock.item_id]
    );
    await inspect('SELECT lab.inv_receive($1,$2)', [
      users.officer,
      {
        itemId: consumable,
        labId: stock.lab_id,
        locationId: loc,
        quantity: 5,
        provenance: 'CP3 supplies ' + randomUUID(),
      },
    ]);
    good(await write('admin', 'policies', { itemId: consumable, policy: 'NONE' }));
    const cd = good(
      await write('student', 'drafts', {
        ...payload,
        lines: [{ ...payload.lines[0], itemId: consumable, quantity: 3 }],
      })
    );
    const cr = good(await write('student', 'submit', { draftId: cd.id, expectedVersion: 0 }));
    const ca = good(await call('officer', 'read_ready', { requestId: cr.id })).items[0];
    const ci = good(await write('officer', 'issues', { allocationId: ca.id, quantity: 3 }));
    assert.equal(ci.assetId, null);
    assert.equal((await loan(ci.loanId)).outstandingQuantity, 0);
    assert.equal((await loan(ci.loanId)).dueAt, null);
    assert.equal(
      (
        await write('officer', 'returns', {
          loanId: ci.loanId,
          condition: 'No physical obligation',
        })
      ).code,
      'STATE_CONFLICT'
    );
    assert.equal(
      (
        await write('student', 'extensions', {
          loanId: ci.loanId,
          expectedVersion: 0,
          proposedDueAt: new Date(Date.now() + 172800000).toISOString(),
          reason: 'Invalid consumable extension',
        })
      ).code,
      'STATE_CONFLICT'
    );
    // Extensions retain original due date; NONE policy requires a current independent lecturer.
    const extension = good(
      await write('student', 'extensions', {
        loanId: first.loanId,
        expectedVersion: 0,
        proposedDueAt: new Date(Date.now() + 172800000).toISOString(),
        reason: 'More measurements',
      })
    );
    assert.equal(
      (
        await write('student', 'extension-decisions', {
          extensionId: extension.extensionId,
          expectedVersion: 0,
          decision: 'APPROVE',
          remarks: 'Self',
        })
      ).code,
      'DENIED'
    );
    assert.equal(
      (
        await write('lecturer', 'extension-decisions', {
          extensionId: extension.extensionId,
          expectedVersion: 1,
          decision: 'APPROVE',
          remarks: 'Stale',
        })
      ).code,
      'STALE_VERSION'
    );
    const decision = {
      commandId: randomUUID(),
      extensionId: extension.extensionId,
      expectedVersion: 0,
      decision: 'APPROVE',
      remarks: 'Approved extension',
    };
    const accepted = good(await call('lecturer', 'extension-decisions', decision));
    assert.notEqual(accepted.originalDueAt, accepted.dueAt);
    assert.deepEqual(await call('lecturer', 'extension-decisions', decision), accepted);
    await inspect('DELETE FROM lab.staff_labs WHERE user_id=$1 AND laboratory_id=$2', [
      users.lecturer,
      stock.lab_id,
    ]);
    assert.equal(
      (await call('lecturer', 'extension-decisions', decision)).code,
      'DENIED',
      'replay checks current authority'
    );
    await inspect('INSERT INTO lab.staff_labs VALUES($1,$2)', [users.lecturer, stock.lab_id]);
    const pending = good(
      await write('student', 'extensions', {
        loanId: first.loanId,
        expectedVersion: 1,
        proposedDueAt: new Date(Date.now() + 259200000).toISOString(),
        reason: 'Another extension',
      })
    );
    good(
      await write('lecturer', 'extension-decisions', {
        extensionId: pending.extensionId,
        expectedVersion: 0,
        decision: 'REJECT',
        remarks: 'Please return',
      })
    );
    assert.equal(
      good(await call('student', 'read_extensions', { loanId: first.loanId })).items.length,
      2
    );
    // Receipt returns only one issued unit; the other remains borrowed.
    const receive = {
      commandId: randomUUID(),
      loanId: first.loanId,
      expectedVersion: 1,
      quantity: 1,
      condition: 'Damaged cable',
    };
    const receipt = good(await call('multi', 'returns', receive));
    assert.deepEqual(await call('multi', 'returns', receive), receipt);
    assert.equal(await state(first.assetId), 'INSPECTION');
    assert.equal(await state(second.assetId), 'BORROWED');
    assert.equal((await loan(second.loanId)).outstandingQuantity, 1);
    assert.equal(
      (await write('officer', 'returns', { loanId: first.loanId, condition: 'Again' })).code,
      'STATE_CONFLICT'
    );
    const inspectionCommand = {
      inspectionId: receipt.inspectionId,
      expectedVersion: 0,
      outcome: 'UNRESOLVED',
      condition: 'Cable damaged',
      notes: 'Awaiting diagnosis',
    };
    assert.equal((await write('student', 'inspections', inspectionCommand)).code, 'DENIED');
    good(await write('officer', 'inspections', inspectionCommand));
    assert.equal(await state(first.assetId), 'INSPECTION');
    assert.equal(
      (await write('officer', 'inspections', { ...inspectionCommand, outcome: 'CLEAR_AVAILABLE' }))
        .code,
      'STALE_VERSION'
    );
    const routed = good(
      await write('officer', 'inspections', {
        ...inspectionCommand,
        expectedVersion: 1,
        outcome: 'ROUTE_MAINTENANCE',
      })
    );
    assert.equal(await state(first.assetId), 'MAINTENANCE');
    const activeCell = (
      await inspect('SELECT * FROM lab.inv_cells WHERE asset_id=$1 AND quantity=1', [first.assetId])
    )[0];
    const bypass = (
      await db.query('SELECT lab.inventory_call($1,$2,$3,$4) result', [
        sessions.officer.token,
        sessions.officer.csrf,
        'stock',
        {
          commandId: randomUUID(),
          itemId: stock.item_id,
          labId: stock.lab_id,
          locationId: loc,
          assetId: first.assetId,
          expectedVersion: activeCell.version,
          fromState: 'MAINTENANCE',
          toState: 'AVAILABLE',
          quantity: 1,
        },
      ])
    ).rows[0].result;
    assert.ok(bypass.status, 'generic inventory cannot bypass maintenance');
    good(
      await write('multi', 'maintenance', {
        maintenanceId: routed.maintenanceId,
        expectedVersion: 0,
        status: 'IN_PROGRESS',
        notes: 'Repair started',
      })
    );
    assert.equal(
      (
        await write('officer', 'maintenance', {
          maintenanceId: routed.maintenanceId,
          expectedVersion: 0,
          status: 'RETIRED',
          notes: 'Stale',
        })
      ).code,
      'STALE_VERSION'
    );
    good(
      await write('officer', 'maintenance', {
        maintenanceId: routed.maintenanceId,
        expectedVersion: 1,
        status: 'RETIRED',
        notes: 'Beyond repair',
      })
    );
    assert.equal(await state(first.assetId), 'RETIRED');
    assert.equal(
      (
        await write('officer', 'maintenance', {
          maintenanceId: routed.maintenanceId,
          expectedVersion: 2,
          status: 'RESOLVED_AVAILABLE',
          notes: 'Cannot resurrect',
        })
      ).code,
      'STATE_CONFLICT'
    );
    // A cleared identity is reused, never materialized again.
    const rec2 = good(
      await write('officer', 'returns', {
        loanId: second.loanId,
        quantity: 1,
        expectedVersion: 0,
        condition: 'Good',
      })
    );
    good(
      await write('multi', 'inspections', {
        inspectionId: rec2.inspectionId,
        expectedVersion: 0,
        outcome: 'CLEAR_AVAILABLE',
        condition: 'Good',
        notes: 'Tested',
      })
    );
    assert.equal(await state(second.assetId), 'AVAILABLE');
    r = await req(r.id);
    const count = (await inspect('SELECT count(*) n FROM lab.inv_assets'))[0].n;
    const reuseRequest = await create('student', 1);
    const reused = good(
      await write('officer', 'issues', {
        allocationId: reuseRequest.a.id,
        quantity: 1,
        assetId: second.assetId,
        expectedVersion: reuseRequest.r.lines[0].version,
      })
    );
    assert.equal(reused.assetId, second.assetId);
    assert.equal((await inspect('SELECT count(*) n FROM lab.inv_assets'))[0].n, count);
    // Identified-only stock reserves and hands over its actual identity.
    const rec3 = good(
      await write('officer', 'returns', { loanId: reused.loanId, condition: 'Good' })
    );
    const route3 = good(
      await write('multi', 'inspections', {
        inspectionId: rec3.inspectionId,
        expectedVersion: 0,
        outcome: 'ROUTE_MAINTENANCE',
        condition: 'Repairable',
        notes: 'Service',
      })
    );
    good(
      await write('officer', 'maintenance', {
        maintenanceId: route3.maintenanceId,
        expectedVersion: 0,
        status: 'RESOLVED_AVAILABLE',
        notes: 'Repaired',
      })
    );
    const loc2 = randomUUID();
    await inspect('INSERT INTO lab.inv_locations(id,lab_id,name) VALUES($1,$2,$3)', [
      loc2,
      stock.lab_id,
      'CP3 identified ' + randomUUID(),
    ]);
    await inspect(
      "SELECT lab.inv_post($1,$2,$3,(SELECT id FROM lab.inv_cells WHERE asset_id=$4 AND quantity=1),lab.inv_cell($2,$3,$5,$4,'AVAILABLE'),1,'TRANSFER','CP3 fixture')",
      [users.officer, stock.item_id, stock.lab_id, second.assetId, loc2]
    );
    let only = await create('student', 1, loc2);
    assert.ok(only.a);
    assert.equal(await state(second.assetId), 'RESERVED');
    const assets = good(await call('officer', 'read_handover-assets', { allocationId: only.a.id }));
    assert.equal(assets.items[0].assetId, second.assetId);
    const again = good(
      await write('multi', 'issues', {
        allocationId: only.a.id,
        assetId: second.assetId,
        quantity: 1,
        expectedVersion: only.r.lines[0].version,
      })
    );
    assert.equal(again.assetId, second.assetId);
    assert.equal(
      (
        await write('officer', 'issues', {
          allocationId: only.a.id,
          assetId: second.assetId,
          quantity: 1,
        })
      ).code,
      'STATE_CONFLICT'
    );
    const rec4 = good(
      await write('officer', 'returns', { loanId: again.loanId, condition: 'Good' })
    );
    good(
      await write('officer', 'inspections', {
        inspectionId: rec4.inspectionId,
        expectedVersion: 0,
        outcome: 'CLEAR_AVAILABLE',
        condition: 'Good',
        notes: 'Cleared',
      })
    );
    only = await create('student', 1, loc2);
    good(
      await write('student', 'cancel', {
        lineId: only.r.lines[0].id,
        expectedVersion: only.r.lines[0].version,
        quantity: 1,
        reason: 'No longer needed',
      })
    );
    assert.equal(await state(second.assetId), 'AVAILABLE');
    assert.equal(
      good(await call('student', 'read_sources', { labId: stock.lab_id })).items.find(
        (x) => x.locationId === loc2
      ).availableQuantity,
      1,
      'identified-only stock remains borrowable'
    );
    // An identified allocation cannot spend another allocation's pooled anonymous unit.
    await inspect('SELECT lab.inv_receive($1,$2)', [
      users.officer,
      {
        itemId: stock.item_id,
        labId: stock.lab_id,
        locationId: loc2,
        quantity: 1,
        provenance: 'CP3 pooled ' + randomUUID(),
      },
    ]);
    const anonymousClaim = await create('student', 1, loc2);
    const identifiedClaim = await create('student', 1, loc2);
    const identifiedDefault = good(
      await write('officer', 'issues', { allocationId: identifiedClaim.a.id, quantity: 1 })
    );
    assert.equal(identifiedDefault.assetId, second.assetId);
    good(
      await write('student', 'cancel', {
        lineId: anonymousClaim.r.lines[0].id,
        expectedVersion: anonymousClaim.r.lines[0].version,
        quantity: 1,
        reason: 'Release own anonymous claim',
      })
    );
    // Scoped queues and closed query filters.
    assert.equal(
      good(await call('student', 'read_maintenance', { status: 'RETIRED', loanId: first.loanId }))
        .items.length,
      1
    );
    assert.equal(
      good(await call('multi', 'read_borrower-history', { loanId: first.loanId })).items.length,
      0
    );
    await inspect(
      "UPDATE lab.lend_loans SET due_at=clock_timestamp()-interval '1 minute' WHERE id=$1",
      [again.loanId]
    );
    assert.equal(
      good(await call('student', 'read_overdue', { loanId: again.loanId })).items.length,
      0,
      'returned equipment is never overdue'
    );
    const fresh = await create('student', 1);
    const freshLoan = good(
      await write('officer', 'issues', { allocationId: fresh.a.id, quantity: 1 })
    );
    await inspect(
      "UPDATE lab.lend_loans SET due_at=clock_timestamp()-interval '1 minute' WHERE id=$1",
      [freshLoan.loanId]
    );
    assert.equal(
      good(await call('student', 'read_overdue', { loanId: freshLoan.loanId })).items.length,
      1
    );
    await inspect('DELETE FROM lab.staff_labs WHERE user_id=$1 AND laboratory_id=$2', [
      users.officer,
      stock.lab_id,
    ]);
    assert.equal(
      good(await call('officer', 'read_borrowed', { loanId: freshLoan.loanId })).items.length,
      0
    );
    assert.equal((await call('officer', 'issues', issue)).code, 'DENIED');
    for (const p of [{ unknown: 'x' }, { limit: '0' }, { status: 'bogus' }])
      assert.equal((await call('student', 'read_inspections', p)).code, 'INVALID');
    assert.equal(
      good(await call('student', 'read_borrower-history', { limit: '1' })).items.length,
      1
    );
    assert.equal(
      good(await call('officer', 'read_borrower-history', { loanId: first.loanId })).items.length,
      0,
      'handover notes follow record scope'
    );
    assert.equal(
      good(await call('officer', 'read_expected', { loanId: freshLoan.loanId })).items.length,
      0,
      'revoked scope conceals operational names/history'
    );
    await inspect('INSERT INTO lab.staff_labs VALUES($1,$2)', [users.officer, stock.lab_id]);
    for (const policy of ['LECTURER', 'HOD', 'BOTH']) {
      good(await write('admin', 'policies', { itemId: stock.item_id, policy, hodId: users.admin }));
      const pd = good(
        await write('student', 'drafts', {
          ...payload,
          lecturerId: users.lecturer,
          lines: [{ ...payload.lines[0], quantity: 1 }],
        })
      );
      const pr = good(await write('student', 'submit', { draftId: pd.id, expectedVersion: 0 }));
      let line = (await req(pr.id)).lines[0];
      if (policy !== 'HOD') {
        good(
          await write('lecturer', 'decisions', {
            lineId: line.id,
            expectedVersion: line.version,
            decision: 'APPROVE',
            remarks: 'Academic approval',
          })
        );
        line = (await req(pr.id)).lines[0];
      }
      if (policy !== 'LECTURER')
        good(
          await write('admin', 'decisions', {
            lineId: line.id,
            expectedVersion: line.version,
            decision: 'APPROVE',
            remarks: 'HOD approval',
          })
        );
      const pa = good(await call('officer', 'read_ready', { requestId: pr.id })).items[0];
      const pi = good(await write('officer', 'issues', { allocationId: pa.id, quantity: 1 }));
      const pe = good(
        await write('student', 'extensions', {
          loanId: pi.loanId,
          expectedVersion: 0,
          proposedDueAt: new Date(Date.now() + 172800000).toISOString(),
          reason: 'Policy-specific extension',
        })
      );
      const approver = policy === 'LECTURER' ? 'lecturer' : 'admin';
      const other = policy === 'LECTURER' ? 'admin' : 'lecturer';
      assert.equal(
        (
          await write(other, 'extension-decisions', {
            extensionId: pe.extensionId,
            expectedVersion: 0,
            decision: 'APPROVE',
            remarks: 'Wrong policy authority',
          })
        ).code,
        'DENIED'
      );
      good(
        await write(approver, 'extension-decisions', {
          extensionId: pe.extensionId,
          expectedVersion: 0,
          decision: 'APPROVE',
          remarks: 'Independent decision',
        })
      );
    }
    assert.deepEqual(
      await inspect(
        'SELECT movement_id FROM lab.inv_entries GROUP BY movement_id HAVING sum(delta)<>0 OR count(*)<>2'
      ),
      []
    );
    assert.deepEqual(
      await inspect(
        "SELECT tablename FROM pg_tables WHERE schemaname='lab' AND tablename IN('lend_inspections','lend_inspection_events','lend_maintenance','lend_maintenance_events','lend_extensions','lend_extension_decisions','lend_reserved_assets') AND (has_table_privilege('lab_runtime','lab.'||tablename,'SELECT') OR has_table_privilege('lab_runtime','lab.'||tablename,'INSERT,UPDATE,DELETE'))"
      ),
      []
    );
    assert.deepEqual(
      (
        await inspect(
          "SELECT proname FROM pg_proc p JOIN pg_namespace ns ON ns.oid=p.pronamespace WHERE ns.nspname='lab' AND proname LIKE 'lending_call%' AND has_function_privilege('lab_runtime',p.oid,'EXECUTE')"
        )
      ).map((x) => x.proname),
      ['lending_call']
    );
    assert.deepEqual(
      await inspect(
        'SELECT c.id FROM lab.inv_cells c WHERE c.quantity<>(SELECT coalesce(sum(e.delta),0) FROM lab.inv_entries e WHERE e.cell_id=c.id)'
      ),
      []
    );
    assert.equal(
      (await inspect('SELECT count(*) n FROM lab.inv_cells WHERE quantity<0'))[0].n,
      '0'
    );
    await db.query('RESET ROLE');
    for (const table of [
      'lend_returns',
      'lend_inspection_events',
      'lend_maintenance_events',
      'lend_extension_decisions',
      'lend_handovers',
    ]) {
      await db.query('SAVEPOINT immutable_check');
      await assert.rejects(db.query('DELETE FROM lab.' + table), /immutable inventory history/);
      await db.query('ROLLBACK TO SAVEPOINT immutable_check');
    }
    await db.query('SET CONSTRAINTS ALL IMMEDIATE');
  } finally {
    await db.query('ROLLBACK');
    await db.end();
  }
});
