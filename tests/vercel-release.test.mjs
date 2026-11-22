import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { verifyEnvironment, verifyTag } from '../scripts/vercel-release.mjs';

test('release policy accepts only exact version tags checked out on production history', () => {
  const cwd = mkdtempSync(join(tmpdir(), 'lab-release-'));
  const git = (...args) => execFileSync('git', args, { cwd, stdio: 'pipe', encoding: 'utf8' }).trim();
  try {
    git('init');
    git('config', 'user.name', 'Disposable release test');
    git('config', 'user.email', 'release@example.invalid');
    git('commit', '--allow-empty', '-m', 'production');
    git('tag', '-a', 'v1.2.3', '-m', 'release');
    git('update-ref', 'refs/remotes/origin/production', 'HEAD');
    const env = { GITHUB_EVENT_NAME: 'push', GITHUB_REF_TYPE: 'tag', GITHUB_REF: 'refs/tags/v1.2.3' };
    assert.equal(verifyTag(env, cwd), git('rev-parse', 'HEAD'));
    for (const tag of ['v01.2.3', 'v1.2', 'v1.2.3-rc.1', 'v1.2.3+meta', 'v1.2.3\n']) {
      assert.throws(() => verifyTag({ ...env, GITHUB_REF: `refs/tags/${tag}` }, cwd));
    }
    assert.throws(() => verifyTag({ ...env, GITHUB_EVENT_NAME: 'workflow_dispatch' }, cwd));
    git('commit', '--allow-empty', '-m', 'unmerged');
    assert.throws(() => verifyTag(env, cwd));
    git('tag', 'v2.0.0');
    assert.throws(() => verifyTag({ ...env, GITHUB_REF: 'refs/tags/v2.0.0' }, cwd));
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test('production config rejects owner credentials, fixtures, browser secrets and invalid runtime settings', () => {
  const env = { ORM_DATABASE_URL: 'postgresql://lab_orm.project:fake@db.example.invalid:6543/postgres?sslmode=verify-full', APP_ORIGIN: 'https://lab.example.invalid' };
  assert.doesNotThrow(() => verifyEnvironment(env));
  for (const key of ['MIGRATION_DATABASE_URL', 'DIRECT_URL', 'DATABASE_URL', 'M2_TEST_ENABLE', 'LOCAL_ORM_PASSWORD', 'NEXT_PUBLIC_DATABASE_URL']) {
    assert.throws(() => verifyEnvironment({ ...env, [key]: 'fake' }));
  }
  for (const value of ['postgresql://postgres:fake@db.example.invalid/postgres', 'postgresql://lab_orm:fake@127.0.0.1/lab']) {
    assert.throws(() => verifyEnvironment({ ...env, ORM_DATABASE_URL: value }));
  }
  for (const value of ['http://lab.example.invalid', 'https://lab.example.invalid/path', 'https://user:fake@lab.example.invalid', 'https://lab.example.invalid/', 'https://LAB.example.invalid', 'https://lab.example.invalid:443']) {
    assert.throws(() => verifyEnvironment({ ...env, APP_ORIGIN: value }));
  }
  assert.throws(() => verifyEnvironment({ ...env, GOOGLE_OAUTH_CLIENT_ID: 'fake' }));
  for (const query of ['', '?sslmode=disable', '?sslmode=no-verify', '?sslmode=verify-full&sslmode=disable', '?sslmode=verify-full&user=postgres', '?sslmode=verify-full&host=localhost']) {
    assert.throws(() => verifyEnvironment({ ...env,
      ORM_DATABASE_URL: 'postgresql://lab_orm.project:fake@db.example.invalid:6543/postgres' + query }));
  }
  assert.throws(() => verifyEnvironment({ ...env, NODE_TLS_REJECT_UNAUTHORIZED: '0' }));
});
