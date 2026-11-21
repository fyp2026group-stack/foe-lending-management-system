import { test } from 'node:test';
import assert from 'node:assert/strict';
import { canOpenRoute } from '../src/lib/role-policy.ts';

test('direct protected pages are inaccessible to unauthorised roles', () => {
  assert.equal(canOpenRoute('/admin/users',null,['STUDENT']),false);
  assert.equal(canOpenRoute('/admin/reports',null,['LECTURER']),false);
  assert.equal(canOpenRoute('/admin/users',null,['ADMIN']),true);
  assert.equal(canOpenRoute('/operations','handovers',['STUDENT']),false);
  assert.equal(canOpenRoute('/operations','returns',['TECHNICAL_OFFICER']),true);
  assert.equal(canOpenRoute('/borrowing','approvals',['STUDENT']),false);
  assert.equal(canOpenRoute('/borrowing','approvals',['LECTURER']),true);
  assert.equal(canOpenRoute('/borrowing','collection',['ADMIN']),false);
  assert.equal(canOpenRoute('/borrowing','collection',['TECHNICAL_OFFICER']),true);
  assert.equal(canOpenRoute('/inventory',null,['STUDENT']),true);
  assert.equal(canOpenRoute('/workspace',null,[]),false);
  assert.equal(canOpenRoute('/borrowing','unknown',['ADMIN']),false);
});
