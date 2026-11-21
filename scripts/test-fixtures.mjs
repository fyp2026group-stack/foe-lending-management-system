/** Synthetic fixtures for disposable test databases ONLY. Never use for deployment. */
import pg from 'pg';
import { randomUUID } from 'node:crypto';
import { hashPassword } from '../src/lib/server/password.mjs';
const raw = process.env.MIGRATION_DATABASE_URL;
if (!raw) throw Error('MIGRATION_DATABASE_URL required');
const url = new URL(raw);
if (!['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
  || !/^\/(lab_inventory|lab_m2_test_[a-z0-9_]+)$/.test(url.pathname)
  || process.env.M2_TEST_ENABLE !== 'synthetic-only') {
  throw Error('Refusing test fixtures outside explicitly configured local test database');
}
const c = new pg.Client({ connectionString: raw, connectionTimeoutMillis: 4000 });
await c.connect();
try {
    const password = process.env.SYNTHETIC_ADMIN_PASSWORD;
    if (!password)
      throw Error(
        'SYNTHETIC_ADMIN_PASSWORD is required for disposable test fixtures'
      );
    await c.query('BEGIN');
    const batch = '10000000-0000-4000-8000-000000000001',
      lab = '10000000-0000-4000-8000-000000000002';
    await c.query(
      "INSERT INTO lab.batches VALUES($1,'Synthetic Cohort') ON CONFLICT(id) DO NOTHING",
      [batch]
    );
    await c.query(
      "INSERT INTO lab.laboratories VALUES($1,'Synthetic Laboratory') ON CONFLICT(id) DO NOTHING",
      [lab]
    );
    for (const [name, roles] of [
      ['admin', ['ADMIN']],
      ['student', ['STUDENT']],
      ['lecturer', ['LECTURER']],
      ['officer', ['TECHNICAL_OFFICER']],
      ['multi', ['LECTURER', 'TECHNICAL_OFFICER']],
    ]) {
      const email = name + '@example.invalid';
      if ((await c.query('SELECT id FROM lab.users WHERE email=$1', [email])).rows.length) continue;
      const id = randomUUID();
      await c.query(
        'INSERT INTO lab.users(id,email,display_name,password_hash,batch_id,registration_number) VALUES($1,$2,$3,$4,$5,$6)',
        [
          id,
          email,
          'Synthetic ' + name,
          hashPassword(password),
          roles.includes('STUDENT') ? batch : null,
          roles.includes('STUDENT') ? 'SYNTHETIC-001' : null,
        ]
      );
      for (const role of roles)
        await c.query('INSERT INTO lab.user_roles VALUES($1,$2)', [id, role]);
      if (roles.includes('LECTURER') || roles.includes('TECHNICAL_OFFICER'))
        await c.query('INSERT INTO lab.staff_labs VALUES($1,$2)', [id, lab]);
      await c.query(
        "INSERT INTO lab.audit(id,actor_id,action,target_id) VALUES($1,$2,'SYNTHETIC_BOOTSTRAP',$2)",
        [randomUUID(), id]
      );
    }
    const category = '20000000-0000-4000-8000-000000000001',
      item = '20000000-0000-4000-8000-000000000002',
      location = '20000000-0000-4000-8000-000000000003';
    await c.query(
      "INSERT INTO lab.inv_categories VALUES($1,'Synthetic Instruments') ON CONFLICT(id) DO NOTHING",
      [category]
    );
    await c.query(
      "INSERT INTO lab.inv_items VALUES($1,$2,'Synthetic Multimeter','RETURNABLE','unit') ON CONFLICT(id) DO NOTHING",
      [item, category]
    );
    await c.query(
      "INSERT INTO lab.inv_locations VALUES($1,$2,'Synthetic Store') ON CONFLICT(id) DO NOTHING",
      [location, lab]
    );
    if (
      !(
        await c.query(
          "SELECT 1 FROM lab.inv_receipts WHERE item_id=$1 AND lab_id=$2 AND provenance='Synthetic opening receipt M3'",
          [item, lab]
        )
      ).rows.length
    ) {
      const officer = (
        await c.query("SELECT id FROM lab.users WHERE email='officer@example.invalid'")
      ).rows[0];
      await c.query('SELECT lab.inv_receive($1,$2)', [
        officer.id,
        {
          itemId: item,
          labId: lab,
          locationId: location,
          quantity: 10,
          provenance: 'Synthetic opening receipt M3',
        },
      ]);
    }
    await c.query('COMMIT');
} catch (error) {
  await c.query('ROLLBACK');
  throw error;
} finally {
  await c.end();
}
