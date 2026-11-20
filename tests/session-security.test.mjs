import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { authorizePrismaSession } from '../src/lib/server/services/prisma-session.ts';

const token = 'a'.repeat(64);
const csrf = 'synthetic-csrf';
const sha = value => createHash('sha256').update(value).digest('hex');
function fixture(overrides = {}) {
  const calls = [];
  const session = {
    user_id: 'synthetic-user', csrf_hash: sha(csrf), revoked: false,
    expires_at: new Date(Date.now() + 60_000), last_seen_at: new Date(),
    ...overrides,
  };
  const tx = {
    $queryRaw: async strings => { calls.push(strings.join('')); },
    sessions: {
      findUnique: async args => { calls.push('session'); assert.equal(args.where.token_hash, sha(token)); return session; },
      updateMany: async () => { calls.push('touch'); return { count: 1 }; },
    },
    users: { findUnique: async () => ({ disabled: false }) },
    user_roles: { findMany: async () => [{ role: 'STUDENT' }] },
  };
  return { tx, calls };
}

test('identity lock precedes session reads and remains transaction scoped', async () => {
  const { tx, calls } = fixture();
  assert.deepEqual(await authorizePrismaSession(tx, token, { csrf }), {
    userId: 'synthetic-user', roles: ['STUDENT'],
  });
  assert.match(calls[0], /pg_advisory_xact_lock_shared\(731942\)/);
  assert.deepEqual(calls.slice(1), ['session', 'touch']);
});

test('invalid tokens never reach the database', async () => {
  const { tx, calls } = fixture();
  assert.equal((await authorizePrismaSession(tx, 'invalid')).status, 401);
  assert.deepEqual(calls, []);
});

test('expired, idle and revoked sessions fail closed without extending activity', async () => {
  for (const override of [
    { revoked: true }, { expires_at: new Date(0) },
    { last_seen_at: new Date(Date.now() - 31 * 60_000) },
  ]) {
    const { tx, calls } = fixture(override);
    assert.equal((await authorizePrismaSession(tx, token)).status, 401);
    assert.ok(!calls.includes('touch'));
  }
});

test('CSRF and role denials do not touch the session', async () => {
  for (const options of [{ csrf: 'wrong' }, { requiredRoles: ['ADMIN'] }]) {
    const { tx, calls } = fixture();
    assert.equal((await authorizePrismaSession(tx, token, options)).status, 403);
    assert.ok(!calls.includes('touch'));
  }
});

test('concurrent session revocation and disabled users fail closed', async () => {
  const { tx } = fixture();
  tx.sessions.updateMany = async () => ({ count: 0 });
  assert.equal((await authorizePrismaSession(tx, token)).status, 401);
  tx.users.findUnique = async () => ({ disabled: true });
  assert.equal((await authorizePrismaSession(tx, token)).status, 401);
});
