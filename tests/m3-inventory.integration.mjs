import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import pg from 'pg';
import { randomUUID, randomBytes, createHash } from 'node:crypto';
import { hashPassword } from '../src/lib/server/password.mjs';
import { configuration } from './m2-guard.mjs';
import { zipSync, strToU8 } from 'fflate';

// Fail closed before fixture writes if Backend has not published the inventory contract.
test('M3 inventory PostgreSQL HTTP contract', async (t) => {
  const cfg = configuration(process.env);
  const contract = await readFile(new URL('../docs/m3/api-contract.md', import.meta.url), 'utf8');
  assert.ok(contract.trim(), 'Published inventory contract required before DB mutations');
  const db = new pg.Client({ connectionString: cfg.database, connectionTimeoutMillis: 3000 });
  await db.connect();
  try {
    assert.equal(
      (await db.query('SELECT current_database() AS name')).rows[0].name,
      cfg.databaseName
    );
    const functions = (
      await db.query(
        "SELECT proname FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='lab' AND proname LIKE '%inventory%'"
      )
    ).rows;
    assert.ok(
      functions.length,
      'Inventory protected functions not present; HTTP stock cases NOT RUN'
    );
    const run = randomUUID(),
      password = randomBytes(24).toString('hex'),
      lab = randomUUID();
    await db.query('INSERT INTO lab.laboratories VALUES($1,$2)', [lab, `M3 QA ${run}`]);
    const actors = {};
    for (const [name, roles] of Object.entries({
      admin: ['ADMIN'],
      officer: ['TECHNICAL_OFFICER'],
      lecturer: ['LECTURER'],
      student: ['STUDENT'],
      multi: ['ADMIN', 'TECHNICAL_OFFICER'],
    })) {
      const id = randomUUID(),
        email = `${name}.${run}@example.invalid`,
        batch = randomUUID();
      await db.query('BEGIN');
      try {
        await db.query('INSERT INTO lab.batches VALUES($1,$2)', [batch, `M3 batch ${id}`]);
        await db.query(
          'INSERT INTO lab.users(id,email,display_name,password_hash,batch_id,registration_number) VALUES($1,$2,$3,$4,$5,$6)',
          [id, email, `M3 QA ${name}`, hashPassword(password), batch, `M3-${id}`]
        );
        for (const role of roles)
          await db.query('INSERT INTO lab.user_roles VALUES($1,$2)', [id, role]);
        if (roles.includes('TECHNICAL_OFFICER'))
          await db.query('INSERT INTO lab.staff_labs VALUES($1,$2)', [id, lab]);
        await db.query('COMMIT');
      } catch (e) {
        await db.query('ROLLBACK');
        throw e;
      }
      const response = await fetch(`${cfg.origin}/api/auth/login`, {
        method: 'POST',
        headers: { Origin: cfg.origin, 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      assert.equal(response.status, 200);
      const data = await response.json(),
        cookie = response.headers.get('set-cookie').split(';')[0];
      const hash = createHash('sha256').update(cookie.slice(12)).digest('hex');
      assert.equal(
        (await db.query('SELECT user_id FROM lab.sessions WHERE token_hash=$1', [hash])).rows[0]
          ?.user_id,
        id
      );
      actors[name] = { cookie, csrf: data.csrfToken, id };
    }
    async function api(path, actor, body) {
      const response = await fetch(`${cfg.origin}/api/inventory/${path}`, {
        method: body ? 'POST' : 'GET',
        headers: {
          Cookie: actor.cookie,
          Origin: cfg.origin,
          'X-CSRF-Token': actor.csrf,
          'Content-Type': 'application/json',
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
        signal: AbortSignal.timeout(10000),
      });
      assert.match(response.headers.get('cache-control') || '', /no-store/);
      return { status: response.status, data: await response.json() };
    }
    const command = (body) => ({ ...body, commandId: randomUUID() });
    const success = (result) => {
      assert.ok([200, 201].includes(result.status), `Inventory mutation returned ${result.status}`);
      return result.data;
    };
    await t.test('all four roles read catalogue', async () => {
      for (const name of ['student', 'lecturer', 'officer', 'admin'])
        assert.equal((await api('items', actors[name])).status, 200);
    });
    const category = success(
      await api('categories', actors.admin, command({ name: `QA category ${run}` }))
    );
    await t.test('native Prisma category mutation retains replay, version and audit contracts', async () => {
      const patch = {
        commandId: randomUUID(), expectedVersion: 0,
        name: `QA native category ${run}`, active: true,
      };
      async function patchCategory(actor, body, includeCsrf = true) {
        const response = await fetch(`${cfg.origin}/api/inventory/categories/${category.id}`, {
          method: 'PATCH',
          signal: AbortSignal.timeout(10000),
          headers: {
            Cookie: actor.cookie,
            Origin: cfg.origin,
            ...(includeCsrf ? { 'X-CSRF-Token': actor.csrf } : {}),
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(body),
        });
        return { status: response.status, data: await response.json() };
      }
      const denial = await patchCategory(actors.student, patch);
      assert.equal(denial.status, 403);
      assert.equal((await patchCategory(actors.admin, patch, false)).status, 403);
      const first = await patchCategory(actors.admin, patch);
      assert.equal(first.status, 200, JSON.stringify(first));
      assert.equal(first.data.version, 1);
      assert.equal(first.data.active, true);
      const replay = await patchCategory(actors.admin, patch);
      assert.deepEqual(replay, first);
      assert.equal((await patchCategory(actors.admin, {
        ...patch, name: `different ${run}`,
      })).status, 409);
      assert.equal((await patchCategory(actors.admin, {
        commandId: randomUUID(), expectedVersion: 0, name: `stale ${run}`,
      })).status, 409);
      const stored = (await db.query(
        'SELECT name,version FROM lab.inv_categories WHERE id=$1', [category.id]
      )).rows[0];
      assert.equal(stored.name, patch.name);
      assert.equal(stored.version, 1);
      const commands = await db.query(
        "SELECT count(*)::int n FROM lab.inv_commands WHERE actor_id=$1 AND command_id=$2",
        [actors.admin.id, patch.commandId]
      );
      assert.equal(commands.rows[0].n, 1);
      const audits = await db.query(
        "SELECT count(*)::int n FROM lab.audit WHERE actor_id=$1 AND target_id=$2 AND action='INVENTORY_UPDATE_CATEGORIES'",
        [actors.admin.id, category.id]
      );
      assert.equal(audits.rows[0].n, 1);
    });
    const item = success(
      await api(
        'items',
        actors.admin,
        command({
          name: `QA returnable ${run}`,
          categoryId: category.id,
          kind: 'RETURNABLE',
          uom: 'each',
        })
      )
    );
    const consumable = success(
      await api(
        'items',
        actors.admin,
        command({
          name: `QA consumable ${run}`,
          categoryId: category.id,
          kind: 'CONSUMABLE',
          uom: 'each',
        })
      )
    );
    const location = success(
      await api('locations', actors.admin, command({ labId: lab, name: `QA location ${run}` }))
    );
    const receipt = command({
      itemId: item.id,
      labId: lab,
      locationId: location.id,
      quantity: 1,
      provenance: `QA receipt ${run}`,
    });
    const cells = async (id) =>
      (await db.query('SELECT * FROM lab.inv_cells WHERE item_id=$1 ORDER BY id', [id])).rows;
    const anonymous = async (id) =>
      (await cells(id)).find((c) => !c.asset_id && c.state === 'AVAILABLE');
    const total = async (id) => (await cells(id)).reduce((sum, c) => sum + c.quantity, 0);
    const binding = (id) => ({ itemId: id, labId: lab, locationId: location.id });
    await t.test(
      'admin alone cannot receive; assigned TO can; replay adds no movement',
      async () => {
        assert.equal((await api('receipts', actors.admin, receipt)).status, 403);
        const first = success(await api('receipts', actors.officer, receipt));
        const replay = success(await api('receipts', actors.officer, receipt));
        assert.deepEqual(replay, first);
        assert.equal(
          (await api('receipts', actors.officer, { ...receipt, quantity: 2 })).status,
          409
        );
        const duplicate = await api('receipts', actors.officer, {
          ...receipt,
          commandId: randomUUID(),
        });
        assert.ok(duplicate.status >= 400, 'New key cannot duplicate physical receipt');
      }
    );
    await t.test('invalid quantities and cross-lab location rejected', async () => {
      for (const quantity of [0, -1, 0.5, 1000001])
        assert.equal(
          (
            await api(
              'receipts',
              actors.officer,
              command({ ...receipt, quantity, provenance: randomUUID() })
            )
          ).status,
          422
        );
      const wrong = await api(
        'receipts',
        actors.officer,
        command({ ...receipt, labId: randomUUID(), provenance: randomUUID() })
      );
      assert.ok(wrong.status >= 400);
    });
    await t.test('consumable cannot materialize; no M4 state bypass', async () => {
      success(
        await api(
          'receipts',
          actors.officer,
          command({ ...receipt, itemId: consumable.id, provenance: randomUUID() })
        )
      );
      assert.equal(
        (
          await api(
            'assets',
            actors.officer,
            command({
              ...binding(consumable.id),
              expectedVersion: (await anonymous(consumable.id)).version,
            })
          )
        ).status,
        422
      );
      assert.equal(
        (
          await db.query('SELECT count(*)::int AS n FROM lab.inv_assets WHERE item_id=$1', [
            consumable.id,
          ])
        ).rows[0].n,
        0
      );
      for (const toState of ['BORROWED', 'RESERVED', 'TRANSIT', 'CONSUMED'])
        assert.equal(
          (
            await api(
              'stock',
              actors.officer,
              command({
                ...binding(item.id),
                expectedVersion: (await anonymous(item.id)).version,
                fromState: 'AVAILABLE',
                toState,
                quantity: 1,
              })
            )
          ).status,
          422
        );
    });
    await t.test(
      '12 contenders materialize final anonymous unit exactly once; replay conserves stock',
      async () => {
        const before = await anonymous(item.id),
          q = await total(item.id);
        const bodies = Array.from({ length: 12 }, () =>
          command({ ...binding(item.id), expectedVersion: before.version })
        );
        const results = await Promise.all(
          bodies.map((body) => api('assets', actors.officer, body))
        );
        const winners = results.map((r, i) => ({ r, i })).filter((x) => x.r.status === 200);
        assert.equal(winners.length, 1);
        for (const r of results) assert.ok([200, 409].includes(r.status));
        const winner = winners[0];
        assert.ok(winner.r.data.assetId);
        assert.deepEqual(
          success(await api('assets', actors.officer, bodies[winner.i])),
          winner.r.data
        );
        assert.equal((await anonymous(item.id)).quantity, 0);
        assert.equal(await total(item.id), q);
        const assets = (await db.query('SELECT * FROM lab.inv_assets WHERE item_id=$1', [item.id]))
          .rows;
        assert.equal(assets.length, 1);
        assert.match(assets[0].id, /^[a-f0-9-]{36}$/);
      }
    );
    await t.test('serial conflict rolls back conversion', async () => {
      success(
        await api(
          'receipts',
          actors.officer,
          command({ ...binding(item.id), quantity: 2, provenance: randomUUID() })
        )
      );
      success(
        await api(
          'assets',
          actors.officer,
          command({
            ...binding(item.id),
            expectedVersion: (await anonymous(item.id)).version,
            serial: ` qa-${run} `,
          })
        )
      );
      const before = await cells(item.id);
      assert.equal(
        (
          await api(
            'assets',
            actors.officer,
            command({
              ...binding(item.id),
              expectedVersion: (await anonymous(item.id)).version,
              serial: `QA-${run.toUpperCase()}`,
            })
          )
        ).status,
        409
      );
      assert.deepEqual(await cells(item.id), before);
    });
    await t.test('independent adjustment rejects multirole self and stale approval', async () => {
      const row = await anonymous(item.id);
      const p = success(
        await api(
          'adjustments',
          actors.multi,
          command({
            ...binding(item.id),
            quantity: 1,
            direction: 'ADD',
            reason: 'Synthetic count',
            expectedVersion: row.version,
          })
        )
      );
      assert.equal(
        (await api(`adjustments/${p.id}/approve`, actors.multi, command({}))).status,
        403
      );
      success(
        await api(
          'receipts',
          actors.officer,
          command({ ...binding(item.id), quantity: 1, provenance: randomUUID() })
        )
      );
      assert.equal(
        (await api(`adjustments/${p.id}/approve`, actors.admin, command({}))).status,
        409
      );
      const next = success(
        await api(
          'adjustments',
          actors.officer,
          command({
            ...binding(item.id),
            quantity: 1,
            direction: 'REMOVE',
            reason: 'Synthetic correction',
            expectedVersion: (await anonymous(item.id)).version,
          })
        )
      );
      const before = await total(item.id);
      success(await api(`adjustments/${next.id}/approve`, actors.admin, command({})));
      assert.equal(await total(item.id), before - 1);
    });
    function csv(rows) {
      return (
        'itemId,labId,locationId,quantity,provenance\n' +
        rows
          .map((r) => [item.id, lab, location.id, r.quantity ?? 1, r.provenance].join(','))
          .join('\n')
      );
    }
    async function preview(rows, actor = actors.officer) {
      return api('imports/preview', actor, command({ format: 'CSV', content: csv(rows) }));
    }
    await t.test('CSV commit replay, tampering and conflicting whole batch rollback', async () => {
      const p = success(await preview([{ provenance: `import-${run}` }])),
        commit = command({});
      const first = success(await api(`imports/${p.id}/commit`, actors.officer, commit));
      assert.deepEqual(success(await api(`imports/${p.id}/commit`, actors.officer, commit)), first);
      assert.equal(
        (await api(`imports/${p.id}/commit`, actors.officer, command({ rows: [] }))).status,
        422
      );
      const conflict = `conflict-${run}`,
        staged = success(
          await preview([{ provenance: `atomic-${run}` }, { provenance: conflict }])
        );
      success(
        await api(
          'receipts',
          actors.officer,
          command({ ...binding(item.id), quantity: 1, provenance: conflict })
        )
      );
      const before = await total(item.id);
      assert.equal(
        (await api(`imports/${staged.id}/commit`, actors.officer, command({}))).status,
        409
      );
      assert.equal(await total(item.id), before);
      assert.equal(
        (
          await db.query(
            'SELECT count(*)::int AS n FROM lab.inv_receipts WHERE item_id=$1 AND provenance=$2',
            [item.id, `atomic-${run}`]
          )
        ).rows[0].n,
        0
      );
    });
    await t.test('real XLSX preview and commit', async () => {
      const strings = [
        'itemId',
        'labId',
        'locationId',
        'quantity',
        'provenance',
        item.id,
        lab,
        location.id,
        `xlsx-${run}`,
      ];
      const ns = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
      const parts = {
        '[Content_Types].xml':
          '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/></Types>',
        'xl/workbook.xml': `<workbook xmlns="${ns}" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Stock" sheetId="1" r:id="rId1"/></sheets></workbook>`,
        'xl/_rels/workbook.xml.rels':
          '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>',
        'xl/sharedStrings.xml':
          `<sst xmlns="${ns}">` + strings.map((s) => `<si><t>${s}</t></si>`).join('') + '</sst>',
        'xl/worksheets/sheet1.xml':
          `<worksheet xmlns="${ns}"><sheetData><row r="1">` +
          ['A', 'B', 'C', 'D', 'E'].map((c, i) => `<c r="${c}1" t="s"><v>${i}</v></c>`).join('') +
          '</row><row r="2">' +
          ['A', 'B', 'C'].map((c, i) => `<c r="${c}2" t="s"><v>${i + 5}</v></c>`).join('') +
          '<c r="D2"><v>1</v></c><c r="E2" t="s"><v>8</v></c></row></sheetData></worksheet>',
      };
      const content = Buffer.from(
        zipSync(Object.fromEntries(Object.entries(parts).map(([k, v]) => [k, strToU8(v)])))
      ).toString('base64');
      const p = success(
        await api('imports/preview', actors.multi, command({ format: 'XLSX', content }))
      );
      const before = await total(item.id);
      success(await api(`imports/${p.id}/commit`, actors.multi, command({})));
      assert.equal(await total(item.id), before + 1);
    });
    await t.test(
      'inventory audit failure rolls back receipt ledger projection and dedupe',
      async () => {
        const constraint = `m3qa_${run.replaceAll('-', '')}`,
          before = await cells(item.id);
        await db.query(
          `ALTER TABLE lab.audit ADD CONSTRAINT ${constraint} CHECK(NOT(action='INVENTORY_RECEIPT' AND actor_id='${actors.officer.id}'::uuid)) NOT VALID`
        );
        try {
          assert.ok(
            (
              await api(
                'receipts',
                actors.officer,
                command({ ...binding(item.id), quantity: 1, provenance: `audit-${run}` })
              )
            ).status >= 400
          );
          assert.deepEqual(await cells(item.id), before);
        } finally {
          await db.query(`ALTER TABLE lab.audit DROP CONSTRAINT ${constraint}`);
        }
      }
    );
    await t.test(
      'all movements balanced two entries; each cell equals ledger projection; immutable history',
      async () => {
        assert.equal(
          (
            await db.query(
              'SELECT count(*)::int AS n FROM (SELECT movement_id FROM lab.inv_entries e JOIN lab.inv_movements m ON m.id=e.movement_id WHERE m.item_id=$1 GROUP BY movement_id HAVING sum(delta)<>0 OR count(*)<>2)x',
              [item.id]
            )
          ).rows[0].n,
          0
        );
        const mismatch = await db.query(
          'SELECT c.id FROM lab.inv_cells c LEFT JOIN lab.inv_entries e ON e.cell_id=c.id WHERE c.item_id=$1 GROUP BY c.id HAVING c.quantity<>coalesce(sum(e.delta),0)',
          [item.id]
        );
        assert.equal(mismatch.rows.length, 0);
        await assert.rejects(
          db.query(
            'UPDATE lab.inv_entries SET delta=delta WHERE movement_id IN(SELECT id FROM lab.inv_movements WHERE item_id=$1)',
            [item.id]
          )
        );
      }
    );
    await t.test('revoked TO cannot replay receipt or commit staged import', async () => {
      const p = success(await preview([{ provenance: `revoke-${run}` }], actors.multi));
      await db.query('DELETE FROM lab.staff_labs WHERE user_id=$1 AND laboratory_id=$2', [
        actors.multi.id,
        lab,
      ]);
      try {
        assert.equal((await api(`imports/${p.id}/commit`, actors.multi, command({}))).status, 403);
      } finally {
        await db.query('INSERT INTO lab.staff_labs VALUES($1,$2)', [actors.multi.id, lab]);
      }
      await db.query('DELETE FROM lab.staff_labs WHERE user_id=$1 AND laboratory_id=$2', [
        actors.officer.id,
        lab,
      ]);
      try {
        assert.equal((await api('receipts', actors.officer, receipt)).status, 403);
      } finally {
        await db.query('INSERT INTO lab.staff_labs VALUES($1,$2)', [actors.officer.id, lab]);
      }
    });
  } finally {
    await db.end();
  }
});
