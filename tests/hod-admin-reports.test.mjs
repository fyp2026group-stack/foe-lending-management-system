import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
test('report route provides real CSV and XLSX with formula neutralization', () => {
  const source = readFileSync(new URL('../src/lib/server/reports.ts', import.meta.url), 'utf8');
  assert.ok(source.includes("format==='csv'?csv(rows):xlsx(rows)"));
  assert.ok(source.includes('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'));
  assert.ok(source.includes('/^\\s*[=+\\-@]/'));
  assert.ok(source.includes('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ'));
  assert.ok(source.includes('rows.length<100000'));
  const migration = readFileSync(
    new URL('../database/049_hod_admin_reporting_hardening.sql', import.meta.url),
    'utf8'
  );
  assert.ok(migration.includes("'REQUEST_DENIED','REPORT_VIEW'"));
  assert.ok(migration.includes("d.stage='LECTURER' AND d.actor_id"));
  assert.ok(migration.includes("direction_value='desc' THEN borrower END DESC"));
  assert.ok(migration.includes('GRANT SELECT ON lab.lend_loans'));
});
