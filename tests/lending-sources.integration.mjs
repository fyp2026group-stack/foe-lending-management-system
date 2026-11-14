import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID, createHash } from 'node:crypto';
import pg from 'pg';
import { configuration } from './m2-guard.mjs';
const sha = (x) => createHash('sha256').update(x).digest('hex');
test('borrower sources expose only safe DTOs and lecturer eligibility covers every lab', async () => {
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
    const itemId = randomUUID(),
      categoryId = randomUUID(),
      labId = randomUUID(),
      locationId = randomUUID();
    await db.query('INSERT INTO lab.inv_categories VALUES($1,$2)', [
      categoryId,
      'APP-01 source fixture ' + categoryId,
    ]);
    await db.query("INSERT INTO lab.inv_items VALUES($1,$2,'Source fixture','RETURNABLE','unit')", [
      itemId,
      categoryId,
    ]);
    await db.query("INSERT INTO lab.laboratories VALUES($1,'APP-01 second lab')", [labId]);
    await db.query("INSERT INTO lab.inv_locations VALUES($1,$2,'Source store')", [
      locationId,
      labId,
    ]);
    await db.query('INSERT INTO lab.staff_labs VALUES($1,$2)', [users.officer, labId]);
    await db.query('SELECT lab.inv_receive($1,$2)', [
      users.officer,
      { itemId, labId, locationId, quantity: 5, provenance: 'APP-01 sources rollback fixture' },
    ]);
    const stock = (
      await db.query(
        "SELECT * FROM lab.inv_cells WHERE item_id='20000000-0000-4000-8000-000000000002' AND state='AVAILABLE' AND asset_id IS NULL LIMIT 1"
      )
    ).rows[0];
    assert.ok(stock);
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
    assert.equal(
      (await db.query("SELECT lab.lending_call('invalid','','read_sources','{}') result")).rows[0]
        .result.code,
      'UNAUTHENTICATED'
    );
    assert.ok(
      !(await call('student', 'read_sources')).items.some((x) => x.itemId === itemId),
      'unconfigured sources excluded'
    );
    assert.ok((await write('admin', 'policies', { itemId, policy: 'NONE' })).itemId);
    assert.ok(
      (await write('admin', 'policies', { itemId: stock.item_id, policy: 'LECTURER' })).itemId
    );
    const sources = await call('student', 'read_sources', { labId });
    assert.equal(sources.items.length, 1);
    assert.deepEqual(sources.items[0], {
      itemId,
      item: 'Source fixture',
      kind: 'RETURNABLE',
      uom: 'unit',
      labId,
      lab: 'APP-01 second lab',
      locationId,
      location: 'Source store',
      availableQuantity: 5,
      policy: 'NONE',
    });
    const allowedKeys = [
      'itemId',
      'item',
      'kind',
      'uom',
      'labId',
      'lab',
      'locationId',
      'location',
      'availableQuantity',
      'policy',
    ].sort();
    for (const name of ['student', 'lecturer'])
      for (const source of (await call(name, 'read_sources')).items)
        assert.deepEqual(
          Object.keys(source).sort(),
          allowedKeys,
          'no cell/asset/state/version/serial/ledger fields'
        );
    const lecturers = (await call('student', 'read_lecturers')).items;
    assert.ok(lecturers.find((x) => x.id === users.lecturer).labIds.includes(stock.lab_id));
    assert.ok(!lecturers.find((x) => x.id === users.lecturer).labIds.includes(labId));
    assert.equal((await call('student', 'read_lecturers', { labId })).items.length, 0);
    assert.ok(
      !(await call('lecturer', 'read_lecturers')).items.some((x) => x.id === users.lecturer),
      'self excluded'
    );
    const line = {
      itemId: stock.item_id,
      labId: stock.lab_id,
      locationId: stock.location_id,
      quantity: 1,
    };
    const payload = {
      commandId: randomUUID(),
      purpose: 'Eligible lab fixture',
      collectAt: new Date().toISOString(),
      returnAt: new Date(Date.now() + 86400000).toISOString(),
      lecturerId: users.lecturer,
      lines: [line],
    };
    const valid = await call('student', 'requests', payload);
    assert.ok(valid.id, JSON.stringify(valid));
    assert.equal(
      (
        await write('student', 'requests', {
          ...payload,
          commandId: randomUUID(),
          lecturerId: users.officer,
        })
      ).code,
      'INVALID'
    );
    assert.equal(
      (
        await write('student', 'requests', {
          ...payload,
          commandId: randomUUID(),
          lines: [line, { itemId, labId, locationId, quantity: 1 }],
        })
      ).code,
      'INVALID',
      'lecturer must cover even NONE policy second lab'
    );
    await db.query('RESET ROLE');
    await db.query('DELETE FROM lab.staff_labs WHERE user_id=$1 AND laboratory_id=$2', [
      users.lecturer,
      stock.lab_id,
    ]);
    await db.query('SET LOCAL ROLE lab_runtime');
    assert.deepEqual(
      await call('student', 'requests', payload),
      valid,
      'exact command replay survives reassignment'
    );
    assert.equal(
      (await write('student', 'requests', { ...payload, commandId: randomUUID() })).code,
      'INVALID',
      'new request respects reassignment'
    );
    assert.ok(
      !(await call('student', 'read_lecturers')).items.some((x) => x.id === users.lecturer)
    );
  } finally {
    await db.query('ROLLBACK');
    await db.end();
  }
});
