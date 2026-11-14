import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID, createHash } from 'node:crypto';
import pg from 'pg';
import { configuration } from './m2-guard.mjs';
const sha = (x) => createHash('sha256').update(x).digest('hex');
test('officer completed-operation counts and lab names use current assignments and finite explicit periods', async () => {
  const db = new pg.Client({ connectionString: configuration(process.env).database });
  await db.connect();
  try {
    await db.query('BEGIN');
    const users = Object.fromEntries(
      (
        await db.query(
          "SELECT id,split_part(email,'@',1) name FROM lab.users WHERE email IN('officer@example.invalid','student@example.invalid','admin@example.invalid')"
        )
      ).rows.map((x) => [x.name, x.id])
    );
    const sessions = {};
    for (const name of Object.keys(users)) {
      const token = randomUUID();
      sessions[name] = token;
      await db.query(
        "INSERT INTO lab.sessions(token_hash,user_id,csrf_hash,expires_at,last_seen_at) VALUES($1,$2,$1,clock_timestamp()+interval '1 hour',clock_timestamp())",
        [sha(token), users[name]]
      );
    }
    const lab = (
      await db.query(
        'SELECT l.* FROM lab.laboratories l JOIN lab.staff_labs s ON s.laboratory_id=l.id WHERE s.user_id=$1 LIMIT 1',
        [users.officer]
      )
    ).rows[0];
    const p = {
      from: new Date(Date.now() - 86400000).toISOString(),
      to: new Date(Date.now() + 86400000).toISOString(),
    };
    await db.query('SET LOCAL ROLE lab_runtime');
    const call = async (name, payload = p) =>
      (
        await db.query("SELECT lab.lending_call($1,'','read_operations-summary',$2) result", [
          sessions[name] ?? 'invalid',
          payload,
        ])
      ).rows[0].result;
    assert.equal((await call('student')).code, 'DENIED');
    assert.equal((await call('admin')).code, 'DENIED');
    assert.equal((await call('unknown')).code, 'UNAUTHENTICATED');
    const summary = await call('officer');
    assert.ok(!summary.status, JSON.stringify(summary));
    assert.ok(summary.laboratories.some((x) => x.id === lab.id && x.name === lab.name));
    for (const bad of [
      {},
      { ...p, from: 'infinity' },
      { ...p, to: p.from },
      { ...p, from: '2020-01-01T00:00:00Z' },
      { ...p, limit: '1' },
      { ...p, labId: null },
    ])
      assert.equal((await call('officer', bad)).code, 'INVALID');
    const hidden = await call('officer', { ...p, labId: randomUUID() });
    assert.deepEqual(hidden.laboratories, []);
    assert.equal(hidden.completed.total, 0);
    await db.query('RESET ROLE');
    const count = (
      await db.query(
        `WITH events AS (
   SELECT l.lab_id,n.issued_at occurred FROM lab.lend_loans n JOIN lab.lend_allocations a ON a.id=n.allocation_id JOIN lab.lend_lines l ON l.id=a.line_id
   UNION ALL SELECT l.lab_id,r.created_at FROM lab.lend_returns r JOIN lab.lend_loans n ON n.id=r.loan_id JOIN lab.lend_allocations a ON a.id=n.allocation_id JOIN lab.lend_lines l ON l.id=a.line_id
   UNION ALL SELECT ia.lab_id,e.created_at FROM lab.lend_inspection_events e JOIN lab.lend_inspections i ON i.id=e.inspection_id JOIN lab.inv_assets ia ON ia.id=i.asset_id WHERE e.outcome IN('CLEAR_AVAILABLE','ROUTE_MAINTENANCE')
   UNION ALL SELECT ia.lab_id,e.created_at FROM lab.lend_maintenance_events e JOIN lab.lend_maintenance m ON m.id=e.maintenance_id JOIN lab.lend_inspections i ON i.id=m.inspection_id JOIN lab.inv_assets ia ON ia.id=i.asset_id WHERE e.status IN('RESOLVED_AVAILABLE','RETIRED')
  ) SELECT count(*)::integer n FROM events e WHERE occurred>=$1 AND occurred<$2 AND EXISTS(SELECT 1 FROM lab.staff_labs s WHERE s.user_id=$3 AND s.laboratory_id=e.lab_id)`,
        [p.from, p.to, users.officer]
      )
    ).rows[0].n;
    assert.equal(summary.completed.total, count);
    await db.query('DELETE FROM lab.staff_labs WHERE user_id=$1', [users.officer]);
    await db.query('SET LOCAL ROLE lab_runtime');
    const revoked = await call('officer');
    assert.equal(revoked.completed.total, 0);
    assert.deepEqual(revoked.laboratories, []);
    await assert.rejects(db.query('SELECT * FROM lab.lend_handovers'), /permission denied/);
  } finally {
    await db.query('ROLLBACK');
    await db.end();
  }
});
