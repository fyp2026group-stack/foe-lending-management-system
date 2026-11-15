import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('report route uses protected reads, hardened export formats and snapshot isolation', () => {
  const source = readFileSync(new URL('../src/lib/server/reports.ts', import.meta.url), 'utf8');
  const serializer = readFileSync(
    new URL('../src/lib/server/report-export.ts', import.meta.url),
    'utf8'
  );
  assert.ok(source.includes("format === 'xlsx' ? xlsx(rows) : null"));
  assert.ok(source.includes('csv(rows)'));
  assert.ok(source.includes('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'));
  assert.ok(serializer.includes('/^\\s*[=+\\-@]/'));
  assert.ok(source.includes('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ'));
  assert.ok(source.includes('rows.length < 100000'));
  const migration = readFileSync(
    new URL('../database/049_hod_admin_reporting_hardening.sql', import.meta.url),
    'utf8'
  );
  assert.ok(migration.includes("'REQUEST_DENIED','REPORT_VIEW'"));
  assert.ok(migration.includes("d.stage='LECTURER' AND d.actor_id"));
  assert.ok(migration.includes("direction_value='desc' THEN borrower END DESC"));
  assert.ok(migration.includes('GRANT SELECT ON lab.lend_loans'));
});
