import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';

test('Google student enrollment has server identity verification and protected profile submission', () => {
  const oauth = readFileSync(new URL('../src/lib/server/google-oauth.ts', import.meta.url),'utf8');
  const profile = readFileSync(new URL('../src/app/api/google/profile/route.ts', import.meta.url),'utf8');
  const sql = readFileSync(new URL('../database/052_google_student_registration.sql', import.meta.url),'utf8');
  const manifest = readFileSync(new URL('../scripts/database.mjs', import.meta.url),'utf8');
  for (const p of ["code_challenge_method: 'S256'",'claims.email_verified !== true','GOOGLE_VERIFIED_ACCOUNT_REQUIRED','payload.aud !== clientId','equal(payload.nonce,expectedNonce)']) {
    assert.ok(oauth.includes(p),p);
  }
  assert.ok(profile.includes('expectedOrigin(request)'));
  assert.ok(profile.includes('signupIdentity(request)'));
  assert.ok(sql.includes("VALUES(id_value,'STUDENT')"));
  assert.ok(sql.includes('EXISTING_ACCOUNT_CONTACT_ADMIN'));
  assert.ok(manifest.includes("'052_google_student_registration.sql'"));
});
test('new signup does not expose Google bearer tokens in its form', () => {
  const ui = readFileSync(new URL('../src/components/identity/student-registration.tsx', import.meta.url),'utf8');
  assert.ok(ui.includes('googleEmail: ready.email'));
  assert.ok(ui.includes("fetch('/api/google/profile'"));
  assert.ok(!ui.includes('id_token') && !ui.includes('client_secret'));
});
