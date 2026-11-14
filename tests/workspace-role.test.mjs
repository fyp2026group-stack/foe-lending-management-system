import { test } from 'node:test';
import assert from 'node:assert/strict';
import { selectWorkspaceRole } from '../src/components/identity/workspace-role.ts';

test('default workspace is deterministic for multi-role identities', () => {
  assert.equal(selectWorkspaceRole(['LECTURER', 'TECHNICAL_OFFICER'], null), 'TECHNICAL_OFFICER');
  assert.equal(selectWorkspaceRole(['STUDENT', 'LECTURER'], null), 'LECTURER');
});
test('switching can select only roles actually assigned by the server', () => {
  assert.equal(selectWorkspaceRole(['LECTURER','TECHNICAL_OFFICER'], 'LECTURER'), 'LECTURER');
  assert.equal(selectWorkspaceRole(['LECTURER','TECHNICAL_OFFICER'], 'ADMIN'), 'TECHNICAL_OFFICER');
  assert.equal(selectWorkspaceRole(['STUDENT'], 'ADMIN'), 'STUDENT');
  assert.equal(selectWorkspaceRole(['STUDENT'], 'GUEST'), 'STUDENT');
});
