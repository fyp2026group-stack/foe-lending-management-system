import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID, createHash } from 'node:crypto';
import pg from 'pg';
import { configuration } from './m2-guard.mjs';
const sha = (value) => createHash('sha256').update(value).digest('hex');

test('request through return preserves authorization, idempotency, history and inventory', async () => {
  const cfg = configuration(process.env),
    db = new pg.Client({ connectionString: cfg.database, connectionTimeoutMillis: 3000 });
  await db.connect();
  const sessionHashes = [];
  const command = () => randomUUID();
  try {
    await db.query('BEGIN');
    const users = Object.fromEntries(
      (
        await db.query(
          "SELECT id,split_part(email,'@',1) name FROM lab.users WHERE email IN('admin@example.invalid','student@example.invalid','lecturer@example.invalid','officer@example.invalid','multi@example.invalid')"
        )
      ).rows.map((row) => [row.name, row.id])
    );
    assert.equal(Object.keys(users).length, 5, 'synthetic actors required');
    const actors = {};
    for (const name of Object.keys(users)) {
      const token = randomUUID(),
        csrf = randomUUID();
      sessionHashes.push(sha(token));
      await db.query(
        "INSERT INTO lab.sessions(token_hash,user_id,csrf_hash,expires_at,last_seen_at) VALUES($1,$2,$3,clock_timestamp()+interval '1 hour',clock_timestamp())",
        [sha(token), users[name], sha(csrf)]
      );
      actors[name] = { token, csrf };
    }
    const call = async (name, op, p = {}) =>
      (
        await db.query('SELECT lab.lending_call($1,$2,$3,$4) result', [
          actors[name].token,
          actors[name].csrf,
          op,
          p,
        ])
      ).rows[0].result;
    const source = (
      await db.query(
        "SELECT c.item_id,c.lab_id,c.location_id FROM lab.inv_cells c JOIN lab.inv_items i ON i.id=c.item_id WHERE i.name='Synthetic Multimeter' AND c.state='AVAILABLE' AND c.asset_id IS NULL LIMIT 1"
      )
    ).rows[0];
    assert.ok(source);
    await db.query('SELECT lab.inv_receive($1,$2)', [
      users.officer,
      {
        itemId: source.item_id,
        labId: source.lab_id,
        locationId: source.location_id,
        quantity: 4,
        provenance: 'Workflow rollback stock ' + command(),
      },
    ]);
    const stock = (
      await db.query(
        "SELECT c.item_id,c.lab_id,c.location_id,c.quantity FROM lab.inv_cells c JOIN lab.inv_items i ON i.id=c.item_id WHERE i.name='Synthetic Multimeter' AND c.state='AVAILABLE' AND c.asset_id IS NULL ORDER BY c.quantity DESC LIMIT 1"
      )
    ).rows[0];
    assert.ok(stock?.quantity >= 2, 'at least two anonymous units required');
    const totalBefore = Number(
      (
        await db.query(
          "SELECT coalesce(sum(quantity),0) quantity FROM lab.inv_cells WHERE item_id=$1 AND state IN('AVAILABLE','RESERVED','BORROWED','INSPECTION')",
          [stock.item_id]
        )
      ).rows[0].quantity
    );

    assert.deepEqual(
      await call('student', 'policies', {
        commandId: command(),
        itemId: stock.item_id,
        policy: 'BOTH',
        hodId: users.admin,
      }),
      { status: 403, code: 'DENIED' }
    );
    assert.equal(
      (
        await call('admin', 'policies', {
          commandId: command(),
          itemId: stock.item_id,
          policy: 'BOTH',
          hodId: users.admin,
        })
      ).itemId,
      stock.item_id
    );
    const request = await call('student', 'requests', {
      commandId: command(),
      purpose: 'Synthetic end-to-end workflow',
      collectAt: new Date(Date.now() + 3600000).toISOString(),
      returnAt: new Date(Date.now() + 86400000).toISOString(),
      lecturerId: users.lecturer,
      lines: [
        { itemId: stock.item_id, labId: stock.lab_id, locationId: stock.location_id, quantity: 1 },
      ],
    });
    const line = (await db.query('SELECT * FROM lab.lend_lines WHERE request_id=$1', [request.id]))
      .rows[0];
    assert.equal(line.stage, 'LECTURER');
    assert.equal(
      (
        await call('student', 'decisions', {
          commandId: command(),
          lineId: line.id,
          decision: 'APPROVE',
          remarks: 'self',
        })
      ).code,
      'DENIED'
    );
    const lecturerApproval = await call('lecturer', 'decisions', {
      commandId: command(),
      lineId: line.id,
      decision: 'APPROVE',
      remarks: 'Lecturer approval',
    });
    assert.equal(lecturerApproval.stage, 'HOD', JSON.stringify(lecturerApproval));
    assert.equal(
      (
        await call('lecturer', 'decisions', {
          commandId: command(),
          lineId: line.id,
          decision: 'APPROVE',
          remarks: 'repeat stage',
        })
      ).code,
      'DENIED'
    );
    assert.equal(
      (
        await call('admin', 'decisions', {
          commandId: command(),
          lineId: line.id,
          decision: 'APPROVE',
          remarks: 'HOD approval',
        })
      ).stage,
      'APPROVED'
    );
    assert.equal(
      (
        await db.query(
          "SELECT quantity FROM lab.inv_cells WHERE item_id=$1 AND state='AVAILABLE' AND asset_id IS NULL ORDER BY quantity DESC LIMIT 1",
          [stock.item_id]
        )
      ).rows[0].quantity,
      stock.quantity,
      'approval cannot move inventory'
    );

    const reserved = await call('student', 'reserve', { commandId: command(), lineId: line.id });
    assert.ok(reserved.allocationId);
    assert.equal(
      (
        await call('student', 'issues', {
          commandId: command(),
          allocationId: reserved.allocationId,
          quantity: 1,
        })
      ).code,
      'DENIED'
    );
    const issueCommand = command(),
      issuePayload = {
        commandId: issueCommand,
        allocationId: reserved.allocationId,
        quantity: 1,
        serial: `SYN-${command()}`,
      };
    const issued = await call('officer', 'issues', issuePayload),
      issueReplay = await call('officer', 'issues', issuePayload);
    assert.deepEqual(issueReplay, issued);
    assert.ok(issued.loanId && issued.assetId);
    assert.equal(
      Number(
        (await db.query('SELECT count(*) count FROM lab.lend_loans WHERE id=$1', [issued.loanId]))
          .rows[0].count
      ),
      1,
      'replay cannot duplicate loan'
    );
    assert.equal(
      (
        await db.query(
          "SELECT quantity FROM lab.inv_cells WHERE asset_id=$1 AND state='BORROWED'",
          [issued.assetId]
        )
      ).rows[0].quantity,
      1
    );

    const returnCommand = command(),
      returnPayload = {
        commandId: returnCommand,
        loanId: issued.loanId,
        condition: 'Synthetic good condition',
      };
    const returned = await call('officer', 'returns', returnPayload),
      returnReplay = await call('officer', 'returns', returnPayload);
    assert.deepEqual(returnReplay, returned);
    assert.ok(returned.movementId);
    assert.equal(
      Number(
        (
          await db.query('SELECT count(*) count FROM lab.lend_returns WHERE loan_id=$1', [
            issued.loanId,
          ])
        ).rows[0].count
      ),
      1,
      'replay cannot duplicate receipt'
    );
    assert.equal(
      (
        await db.query(
          "SELECT quantity FROM lab.inv_cells WHERE asset_id=$1 AND state='INSPECTION'",
          [issued.assetId]
        )
      ).rows[0].quantity,
      1
    );
    const anonymous = Number(
      (
        await db.query(
          "SELECT coalesce(sum(quantity),0) quantity FROM lab.inv_cells WHERE item_id=$1 AND asset_id IS NULL AND state IN('AVAILABLE','RESERVED','BORROWED','INSPECTION')",
          [stock.item_id]
        )
      ).rows[0].quantity
    );
    const identified = Number(
      (
        await db.query(
          "SELECT coalesce(sum(quantity),0) quantity FROM lab.inv_cells WHERE item_id=$1 AND asset_id IS NOT NULL AND state IN('AVAILABLE','RESERVED','BORROWED','INSPECTION')",
          [stock.item_id]
        )
      ).rows[0].quantity
    );
    assert.equal(
      anonymous + identified,
      totalBefore,
      'materialization and return conserve tracked quantity'
    );
    assert.equal(
      (await db.query('SELECT returned FROM lab.lend_loans WHERE id=$1', [issued.loanId])).rows[0]
        .returned,
      1
    );
    const history = await call('officer', 'read_history');
    assert.ok(Array.isArray(history.items), JSON.stringify(history));
    assert.ok(
      history.items.some(
        (row) => row.action === 'LENDING_ISSUES' || row.action === 'LENDING_RETURNS'
      )
    );
    assert.ok(
      Number(
        (
          await db.query(
            "SELECT count(*) count FROM lab.audit WHERE action IN('LENDING_ISSUES','LENDING_RETURNS') AND target_id=$1",
            [issued.loanId]
          )
        ).rows[0].count
      ) >= 1
    );

    assert.equal(
      (
        await call('admin', 'policies', {
          commandId: command(),
          itemId: stock.item_id,
          policy: 'NONE',
        })
      ).itemId,
      stock.item_id
    );
    const selfRequest = await call('multi', 'requests', {
      commandId: command(),
      purpose: 'Self-handover denial check',
      collectAt: new Date(Date.now() + 3600000).toISOString(),
      returnAt: new Date(Date.now() + 86400000).toISOString(),
      lines: [
        { itemId: stock.item_id, labId: stock.lab_id, locationId: stock.location_id, quantity: 1 },
      ],
    });
    const selfLine = (
      await db.query('SELECT id FROM lab.lend_lines WHERE request_id=$1', [selfRequest.id])
    ).rows[0];
    const selfAllocation = await call('multi', 'reserve', {
      commandId: command(),
      lineId: selfLine.id,
    });
    assert.equal(
      (
        await call('multi', 'issues', {
          commandId: command(),
          allocationId: selfAllocation.allocationId,
          quantity: 1,
        })
      ).code,
      'DENIED',
      'technical officer cannot hand over to self'
    );
  } finally {
    await db.query('ROLLBACK');
    await db.end();
  }
});
