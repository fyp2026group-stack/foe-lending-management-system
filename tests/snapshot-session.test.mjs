import { test } from 'node:test';
import assert from 'node:assert/strict';
import { authorizePrismaSession } from '../src/lib/server/services/prisma-session.ts';

function fixture() {
  const state = { writes: 0, session: {
    user_id: 'user', csrf_hash: 'a'.repeat(64), revoked: false,
    expires_at: new Date(Date.now() + 3600000), last_seen_at: new Date(),
  }, disabled: false, roles: [{ role: 'ADMIN' }] };
  const tx = {
    $queryRaw: async () => [],
    sessions: {
      findUnique: async () => state.session,
      updateMany: async () => { state.writes++; return { count: 1 }; },
    },
    users: { findUnique: async () => ({ disabled: state.disabled }) },
    user_roles: { findMany: async () => state.roles },
  };
  return { state, tx };
}

test('snapshot revalidation checks authorization without rewriting session activity', async () => {
  const { state, tx } = fixture();
  const token = 'b'.repeat(64);
  assert.equal((await authorizePrismaSession(tx, token)).userId, 'user');
  assert.equal(state.writes, 1);
  const options = { requiredRoles: ['ADMIN'], activityAlreadyTouched: true };
  assert.equal((await authorizePrismaSession(tx, token, options)).userId, 'user');
  assert.equal(state.writes, 1);
  state.session.revoked = true;
  assert.equal((await authorizePrismaSession(tx, token, options)).status, 401);
  state.session.revoked = false; state.disabled = true;
  assert.equal((await authorizePrismaSession(tx, token, options)).status, 401);
  state.disabled = false; state.roles = [{ role: 'STUDENT' }];
  assert.equal((await authorizePrismaSession(tx, token, options)).status, 403);
  state.roles = [{ role: 'ADMIN' }]; state.session.last_seen_at = new Date(0);
  assert.equal((await authorizePrismaSession(tx, token, options)).status, 401);
  state.session.last_seen_at = new Date(); state.session.expires_at = new Date(0);
  assert.equal((await authorizePrismaSession(tx, token, options)).status, 401);
  assert.equal(state.writes, 1);
});
