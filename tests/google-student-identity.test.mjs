import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
test('Google email and self-reported university email are separate, with canonical student identifiers', () => {
  const sql=readFileSync(new URL('../database/053_google_student_identity_uniqueness.sql',import.meta.url),'utf8');
  assert.ok(sql.includes('CREATE UNIQUE INDEX student_index_number_canonical_unique'));
  assert.ok(sql.includes('CREATE UNIQUE INDEX all_user_registration_number_canonical_unique'));
  assert.ok(sql.includes('google_email,university_email,personal_email'));
  assert.ok(sql.includes("'googleEmail'"));
  assert.ok(sql.includes("upper(btrim(p->>'registrationNumber'))"));
  assert.ok(sql.includes("upper(btrim(p->>'indexNumber'))"));
  assert.ok(sql.includes('WHEN unique_violation'));
});
