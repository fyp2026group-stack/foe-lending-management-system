import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { verifyEnvironment, verifyTag, restoreSensitiveOrm } from '../scripts/vercel-release.mjs';
import { parseEnv } from 'node:util';

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

test('sensitive ORM replacement preserves multiline CA bytes and validates the protected URL', () => {
  const secret = 'postgresql://lab_orm.project:fake%24value@db.example.invalid:6543/postgres?sslmode=verify-full';
  const ca = 'DATABASE_CA_CERT="-----BEGIN CERTIFICATE-----\nsynthetic\n-----END CERTIFICATE-----"\r\n';
  const original = '# pulled production settings\r\nORM_DATABASE_URL="[SENSITIVE]"\r\nAPP_ORIGIN="https://lab.example.invalid"\r\n' + ca;
  const updated = restoreSensitiveOrm(original, secret);
  assert.equal(parseEnv(updated).ORM_DATABASE_URL, secret);
  assert.equal(parseEnv(updated).DATABASE_CA_CERT, parseEnv(original).DATABASE_CA_CERT);
  assert.ok(updated.endsWith(ca));
  assert.equal(updated, original.replace('"[SENSITIVE]"', `"${secret}"`));
  assert.equal(restoreSensitiveOrm(updated, secret), updated);
  for (const bad of [undefined, '', '[SENSITIVE]', secret.replace('lab_orm', 'postgres'), secret.replace('verify-full', 'disable'), secret + '\nAPP_ORIGIN=https://other.invalid', secret + '$EXPAND']) {
    assert.throws(() => restoreSensitiveOrm(original, bad));
  }
  assert.throws(() => restoreSensitiveOrm(updated, secret.replace('fake', 'other')));
  assert.throws(() => restoreSensitiveOrm(original + 'ORM_DATABASE_URL="[SENSITIVE]"\r\n', secret));
  assert.throws(() => restoreSensitiveOrm(original.replace('ORM_DATABASE_URL', 'OTHER_URL'), secret));
  assert.throws(() => restoreSensitiveOrm(original + 'GOOGLE_OAUTH_CLIENT_SECRET="[SENSITIVE]"\r\n', secret));
});

test('restore command writes only validated configuration and never logs secret-bearing errors', () => {
  const cwd = mkdtempSync(join(tmpdir(), 'lab-sensitive-'));
  const path = join(cwd, '.vercel', '.env.production.local');
  const script = fileURLToPath(new URL('../scripts/vercel-release.mjs', import.meta.url));
  const original = 'ORM_DATABASE_URL="[SENSITIVE]"\nAPP_ORIGIN="https://lab.example.invalid"\n';
  const secret = 'postgresql://lab_orm.project:unique-test-value@db.example.invalid/postgres?sslmode=verify-full';
  const run = value => spawnSync(process.execPath, [script, 'restore-sensitive'], {
    cwd, env: { ...process.env, RELEASE_ORM_DATABASE_URL: value }, encoding: 'utf8',
  });
  try {
    mkdirSync(join(cwd, '.vercel'));
    writeFileSync(path, original);
    for (const value of ['', 'invalid-unique-test-value']) {
      const result = run(value);
      assert.equal(result.status, 1);
      assert.doesNotMatch(result.stdout + result.stderr, /unique-test-value|postgresql:\/\//);
      assert.equal(readFileSync(path, 'utf8'), original);
    }
    const result = run(secret);
    assert.equal(result.status, 0);
    assert.doesNotMatch(result.stdout + result.stderr, /unique-test-value|postgresql:\/\//);
    assert.equal(parseEnv(readFileSync(path, 'utf8')).ORM_DATABASE_URL, secret);
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
