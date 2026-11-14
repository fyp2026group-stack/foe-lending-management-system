import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID, createHash } from 'node:crypto';
import pg from 'pg';
import { configuration } from './m2-guard.mjs';
test('catalogue protection, audit, versions, deactivation, and stock conservation', async () => {
  const db = new pg.Client({ connectionString: configuration(process.env).database });
  await db.connect();
  try {
    await db.query('BEGIN');
    const sessions = {};
    for (const name of ['admin', 'officer', 'student', 'lecturer']) {
      const user = (
        await db.query('SELECT id FROM lab.users WHERE email=$1', [name + '@example.invalid'])
      ).rows[0];
      assert.ok(user);
      const token = randomUUID(),
        csrf = randomUUID(),
        sha = (x) => createHash('sha256').update(x).digest('hex');
      await db.query(
        "INSERT INTO lab.sessions(token_hash,user_id,csrf_hash,expires_at,last_seen_at) VALUES($1,$2,$3,clock_timestamp()+interval '1 hour',clock_timestamp())",
        [sha(token), user.id, sha(csrf)]
      );
      sessions[name] = { token, csrf };
    }
    await db.query('SET LOCAL ROLE lab_runtime');
    const call = async (who, op, p) =>
      (
        await db.query('SELECT lab.inventory_call($1,$2,$3,$4) result', [
          sessions[who].token,
          sessions[who].csrf,
          op,
          p,
        ])
      ).rows[0].result;
    const write = (op, p, who = 'admin') => call(who, op, { commandId: randomUUID(), ...p });
    assert.equal(
      (await db.query('SELECT lab.inventory_call($1,$2,$3,$4) result', ['', '', 'read_items', {}]))
        .rows[0].result.code,
      'UNAUTHENTICATED'
    );
    assert.equal((await call('student', 'unknown_operation', {})).code, 'NOT_FOUND');
    const category = await write('categories', { name: 'CP1 ' + randomUUID() });
    assert.ok(category.id);
    const item = await write('items', {
      categoryId: category.id,
      name: 'CP1 instrument',
      kind: 'RETURNABLE',
      uom: 'unit',
      specifications: { range: '20 V' },
    });
    assert.ok(item.id, JSON.stringify(item));
    for (const who of ['student', 'lecturer', 'officer']) {
      assert.equal((await call(who, 'read_items', { itemId: item.id })).items[0].id, item.id);
      for (const [op, payload] of [
        ['categories', { name: 'Denied' }],
        ['items', { categoryId: category.id, name: 'Denied', kind: 'RETURNABLE', uom: 'unit' }],
        ['locations', { labId: '10000000-0000-4000-8000-000000000002', name: 'Denied' }],
        ['patch_categories', { id: category.id, expectedVersion: 0, name: 'Denied' }],
        ['patch_items', { id: item.id, expectedVersion: 0, name: 'Denied' }],
      ])
        assert.equal((await write(op, payload, who)).status, 403, who + ' ' + op);
    }
    const patch = {
      commandId: randomUUID(),
      id: item.id,
      expectedVersion: 0,
      name: 'Updated instrument',
      specifications: { range: '40 V' },
    };
    assert.equal((await call('officer', 'patch_items', patch)).status, 403);
    assert.equal(
      (await call('admin', 'patch_items', { ...patch, role: 'ADMIN' })).code,
      'UNSUPPORTED_FIELD'
    );
    assert.equal(
      (await call('admin', 'patch_items', { ...patch, expectedVersion: '0' })).status,
      422
    );
    const updated = await call('admin', 'patch_items', patch);
    assert.equal(updated.version, 1, JSON.stringify(updated));
    assert.deepEqual(await call('admin', 'patch_items', patch), updated);
    assert.equal(
      (await call('admin', 'patch_items', { ...patch, name: 'Different replay' })).code,
      'IDENTITY_CONFLICT'
    );
    assert.equal(
      (await call('admin', 'patch_items', { ...patch, name: 'Changed replay' })).code,
      'IDENTITY_CONFLICT'
    );
    assert.equal(
      (
        await db.query('SELECT lab.inventory_call($1,$2,$3,$4) result', [
          sessions.admin.token,
          'wrong-csrf',
          'patch_items',
          patch,
        ])
      ).rows[0].result.code,
      'CSRF_DENIED'
    );
    await db.query('RESET ROLE');
    const adminId = (await db.query("SELECT id FROM lab.users WHERE email='admin@example.invalid'"))
      .rows[0].id;
    await db.query("DELETE FROM lab.user_roles WHERE user_id=$1 AND role='ADMIN'", [adminId]);
    await db.query('SET LOCAL ROLE lab_runtime');
    assert.equal(
      (await call('admin', 'patch_items', patch)).code,
      'DENIED',
      'successful replay requires current ADMIN authority'
    );
    await db.query('RESET ROLE');
    await db.query("INSERT INTO lab.user_roles VALUES($1,'ADMIN')", [adminId]);
    await db.query('UPDATE lab.users SET disabled=true WHERE id=$1', [adminId]);
    await db.query('SET LOCAL ROLE lab_runtime');
    assert.equal((await call('admin', 'patch_items', patch)).code, 'UNAUTHENTICATED');
    await db.query('RESET ROLE');
    await db.query('UPDATE lab.users SET disabled=false WHERE id=$1', [adminId]);
    await db.query('SET LOCAL ROLE lab_runtime');
    assert.equal(
      (await write('patch_items', { ...patch, commandId: randomUUID(), name: 'Stale' })).code,
      'STALE_VERSION'
    );
    assert.equal(
      (
        await write('patch_items', {
          id: item.id,
          expectedVersion: 1,
          specifications: { bad: { nested: true } },
        })
      ).status,
      422
    );
    assert.equal(
      (await write('patch_categories', { id: category.id, expectedVersion: 0, active: false }))
        .code,
      'STATE_CONFLICT'
    );
    assert.equal(
      (await write('patch_items', { id: item.id, expectedVersion: 1, active: false })).version,
      2
    );
    assert.equal(
      (await write('patch_categories', { id: category.id, expectedVersion: 0, active: false }))
        .version,
      1
    );
    assert.equal(
      (await write('patch_items', { id: item.id, expectedVersion: 2, active: true })).code,
      'STATE_CONFLICT'
    );
    const inactive = (
      await call('student', 'read_items', { itemId: item.id, active: 'false', sort: 'name' })
    ).items[0];
    assert.equal(inactive.active, false);
    assert.equal(inactive.version, 2);
    assert.equal(inactive.specifications.range, '40 V');
    assert.equal((await call('student', 'read_items', { sort: 'injection' })).status, 422);
    assert.equal(
      (await write('patch_categories', { id: category.id, expectedVersion: 1, active: true }))
        .version,
      2
    );
    assert.equal(
      (await write('patch_items', { id: item.id, expectedVersion: 2, active: true })).version,
      3
    );
    const filtered = await call('lecturer', 'read_items', {
      categoryId: category.id,
      kind: 'RETURNABLE',
      active: 'true',
      sort: 'name',
      limit: 1,
      offset: 0,
    });
    assert.equal(filtered.items.length, 1);
    assert.equal(filtered.items[0].id, item.id);
    assert.equal(
      (await call('lecturer', 'read_items', { categoryId: category.id, limit: 1, offset: 1 })).items
        .length,
      0
    );
    assert.equal(
      (await call('lecturer', 'read_items', { categoryId: category.id, kind: 'CONSUMABLE' })).items
        .length,
      0
    );
    const lab = '10000000-0000-4000-8000-000000000002';
    const location = await write('locations', { labId: lab, name: 'CP1 store ' + randomUUID() });
    assert.ok(location.id);
    const emptyLocation = await write('locations', {
      labId: lab,
      name: 'CP1 inactive ' + randomUUID(),
    });
    for (const who of ['student', 'lecturer', 'officer'])
      assert.equal(
        (
          await write(
            'patch_locations',
            { id: emptyLocation.id, expectedVersion: 0, active: false },
            who
          )
        ).status,
        403
      );
    for (const who of ['student', 'lecturer'])
      for (const op of ['read_locations', 'read_stock', 'read_assets', 'read_movements'])
        assert.equal((await call(who, op, { itemId: item.id })).items.length, 0, who + ' ' + op);
    assert.equal(
      (await write('patch_locations', { id: emptyLocation.id, expectedVersion: 0, active: false }))
        .version,
      1
    );
    assert.equal(
      (
        await write(
          'receipts',
          {
            itemId: item.id,
            labId: lab,
            locationId: emptyLocation.id,
            quantity: 1,
            provenance: randomUUID(),
          },
          'officer'
        )
      ).code,
      'STATE_CONFLICT'
    );
    assert.equal(
      (await write('patch_locations', { id: emptyLocation.id, expectedVersion: 1, active: true }))
        .version,
      2
    );
    assert.equal(
      (
        await write('patch_locations', {
          id: emptyLocation.id,
          expectedVersion: 1,
          name: 'Stale location',
        })
      ).code,
      'STALE_VERSION'
    );
    const receipt = await write(
      'receipts',
      {
        itemId: item.id,
        labId: lab,
        locationId: location.id,
        quantity: 10,
        provenance: randomUUID(),
      },
      'officer'
    );
    assert.ok(receipt.movementId, JSON.stringify(receipt));
    let cells = (await call('officer', 'read_stock', { itemId: item.id })).items;
    const anon = cells.find((x) => x.state === 'AVAILABLE');
    const asset = await write(
      'assets',
      { itemId: item.id, labId: lab, locationId: location.id, expectedVersion: anon.version },
      'officer'
    );
    assert.ok(asset.assetId);
    cells = (await call('officer', 'read_stock', { itemId: item.id })).items;
    const identified = cells.find((x) => x.asset_id === asset.assetId && x.quantity === 1);
    assert.ok(
      (
        await write(
          'stock',
          {
            itemId: item.id,
            labId: lab,
            locationId: location.id,
            assetId: asset.assetId,
            expectedVersion: identified.version,
            fromState: 'AVAILABLE',
            toState: 'MAINTENANCE',
            quantity: 1,
          },
          'officer'
        )
      ).movementId
    );
    let totals = (await call('officer', 'read_items', { itemId: item.id })).items[0];
    assert.equal(totals.available, 9);
    assert.equal(totals.maintenance, 1);
    assert.equal(totals.reserved, 0);
    assert.equal(totals.borrowed, 0);
    assert.equal(totals.currently_borrowed, 0);
    assert.equal(
      (await write('patch_items', { id: item.id, expectedVersion: 3, active: false })).code,
      'STATE_CONFLICT'
    );
    assert.equal(
      (await write('patch_items', { id: item.id, expectedVersion: 3, kind: 'CONSUMABLE' })).code,
      'STATE_CONFLICT'
    );
    assert.equal(
      (await write('patch_items', { id: item.id, expectedVersion: 3, uom: 'box' })).code,
      'STATE_CONFLICT'
    );
    assert.equal(
      (await write('patch_locations', { id: location.id, expectedVersion: 0, active: false })).code,
      'STATE_CONFLICT'
    );
    assert.equal(
      (
        await write('patch_locations', {
          id: location.id,
          expectedVersion: 0,
          name: 'Renamed store',
        })
      ).version,
      1
    );
    await db.query('RESET ROLE');
    const audit = (
      await db.query(
        "SELECT details FROM lab.audit WHERE target_id=$1 AND action='INVENTORY_UPDATE_ITEMS' ORDER BY occurred_at",
        [item.id]
      )
    ).rows;
    assert.equal(audit.length, 3);
    assert.equal(audit[0].details.before.version, 0);
    assert.equal(audit[0].details.after.version, 1);
    assert.equal(
      Number(
        (await db.query('SELECT sum(quantity) q FROM lab.inv_cells WHERE item_id=$1', [item.id]))
          .rows[0].q
      ),
      10
    );
    const actor = (await db.query("SELECT id FROM lab.users WHERE email='officer@example.invalid'"))
      .rows[0].id;
    for (const [state, quantity] of [
      ['RESERVED', 2],
      ['BORROWED', 1],
      ['INSPECTION', 1],
      ['CONSUMED', 1],
    ])
      await db.query(
        "SELECT lab.inv_post($1,$2,$3,lab.inv_cell($2,$3,$4,NULL,'AVAILABLE'),lab.inv_cell($2,$3,$4,NULL,$5),$6,'CP1_FIXTURE','rollback state totals')",
        [actor, item.id, lab, location.id, state, quantity]
      );
    await db.query('SET LOCAL ROLE lab_runtime');
    totals = (await call('student', 'read_items', { itemId: item.id })).items[0];
    assert.deepEqual(
      Object.fromEntries(
        [
          'available',
          'reserved',
          'borrowed',
          'currently_borrowed',
          'inspection',
          'maintenance',
          'consumed',
        ].map((k) => [k, totals[k]])
      ),
      {
        available: 4,
        reserved: 2,
        borrowed: 1,
        currently_borrowed: 1,
        inspection: 1,
        maintenance: 1,
        consumed: 1,
      }
    );
    assert.equal('location_id' in totals, false);
    assert.equal('asset_id' in totals, false);
    await db.query('RESET ROLE');
    const other = randomUUID(),
      otherLoc = randomUUID();
    await db.query('INSERT INTO lab.laboratories VALUES($1,$2)', [
      other,
      'CP1 other ' + randomUUID(),
    ]);
    await db.query('INSERT INTO lab.inv_locations(id,lab_id,name) VALUES($1,$2,$3)', [
      otherLoc,
      other,
      'Other',
    ]);
    await db.query('SELECT lab.inv_receive($1,$2)', [
      (await db.query("SELECT id FROM lab.users WHERE email='officer@example.invalid'")).rows[0].id,
      {
        itemId: item.id,
        labId: lab,
        locationId: location.id,
        quantity: 1,
        provenance: randomUUID(),
      },
    ]);
    await db.query(
      "SELECT lab.inv_post($1,$2,$3,NULL,lab.inv_cell($2,$3,$4,NULL,'AVAILABLE'),7,'RECEIPT','scoping fixture')",
      [
        (await db.query("SELECT id FROM lab.users WHERE email='admin@example.invalid'")).rows[0].id,
        item.id,
        other,
        otherLoc,
      ]
    );
    await db.query('SET LOCAL ROLE lab_runtime');
    totals = (await call('officer', 'read_items', { itemId: item.id })).items[0];
    assert.equal(totals.available, 5);
    assert.equal(
      (await call('officer', 'read_items', { itemId: item.id, labId: other })).items[0].available,
      0
    );
    assert.equal((await call('admin', 'read_items', { itemId: item.id })).items[0].available, 12);
    await db.query('RESET ROLE');
    const denied = async (sql, args) => {
      await db.query('SAVEPOINT protected_write');
      await assert.rejects(db.query(sql, args));
      await db.query('ROLLBACK TO SAVEPOINT protected_write');
    };
    await denied('UPDATE lab.inv_items SET uom=$1 WHERE id=$2', ['forged', item.id]);
    await denied('UPDATE lab.inv_movements SET reason=reason WHERE item_id=$1', [item.id]);
    await denied('UPDATE lab.inv_entries SET delta=delta WHERE false');
    await db.query('SET LOCAL ROLE lab_runtime');
    await denied('SELECT * FROM lab.inv_items');
    await denied('UPDATE lab.inv_categories SET active=false WHERE id=$1', [category.id]);
    await denied('SELECT lab.inv_active_lending_guard()');
    await db.query('RESET ROLE');
    const runtime = (
      await db.query(
        "SELECT rolsuper,rolcreaterole,rolcreatedb,rolbypassrls FROM pg_roles WHERE rolname='lab_runtime'"
      )
    ).rows[0];
    assert.ok(
      Object.values(runtime).every((value) => value === false),
      'runtime has no elevated role attributes'
    );
    const executable = (
      await db.query(
        "SELECT p.proname FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='lab' AND p.proname LIKE 'lending_call%' AND has_function_privilege('lab_runtime',p.oid,'EXECUTE')"
      )
    ).rows.map((row) => row.proname);
    assert.deepEqual(
      executable,
      ['lending_call'],
      'older lending entry points cannot bypass the shared gate'
    );
    const entry = (
      await db.query(
        "SELECT pg_get_functiondef('lab.lending_call(text,text,text,jsonb)'::regprocedure) definition"
      )
    ).rows[0].definition;
    assert.ok(
      entry.includes(
        "IF op<>'read_operations-summary' THEN RETURN lab.lending_call_physical(token,csrf,op,p);END IF;"
      ),
      'all mutation paths delegate to the protected physical writer'
    );
    const definition = (
      await db.query(
        "SELECT pg_get_functiondef('lab.lending_call_physical(text,text,text,jsonb)'::regprocedure) definition"
      )
    ).rows[0].definition;
    assert.ok(
      definition.indexOf('pg_advisory_xact_lock_shared(731942)') <
        definition.indexOf('pg_advisory_xact_lock(731943)')
    );
    const delegated = definition.search(/lab\.lending_call_(?:cp1|cp2|v4)\(/);
    assert.ok(
      delegated >= 0 && definition.indexOf('pg_advisory_xact_lock(731943)') < delegated,
      'catalogue gate is acquired before delegated lending stock locks'
    );
  } finally {
    await db.query('ROLLBACK');
    await db.end();
  }
});
