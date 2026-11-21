import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runtimeConfig } from '../scripts/runtime-config.mjs';

test('canonical startup loads local config, preserves injected deployments and fails closed', () => {
  const dir = mkdtempSync(join(tmpdir(), 'lab-runtime-'));
  const file = join(dir, 'local.env');
  const local = 'postgresql://lab_orm:fixture@127.0.0.1/lab_m2_test_config';
  const remote = 'postgresql://lab_orm:fixture@deployment.invalid/lab';
  try {
    assert.throws(() => runtimeConfig({}, file), /requires ORM_DATABASE_URL/);
    writeFileSync(file, `ORM_DATABASE_URL=${local}\nAUTH_MARKER=local\n`);
    assert.equal(runtimeConfig({}, file).ORM_DATABASE_URL, local);
    assert.equal(runtimeConfig({ AUTH_MARKER: 'injected' }, file).AUTH_MARKER, 'injected');
    assert.equal(runtimeConfig({ ORM_DATABASE_URL: remote, NODE_ENV: 'production' }, file).ORM_DATABASE_URL, remote);
    assert.throws(() => runtimeConfig({ NODE_ENV: 'production' }, file), /requires ORM_DATABASE_URL/);
    assert.throws(() => runtimeConfig({ ORM_DATABASE_URL: 'invalid-secret-fixture' }, file), error =>
      !error.message.includes('invalid-secret-fixture') && /requires ORM_DATABASE_URL/.test(error.message));
    writeFileSync(file, `ORM_DATABASE_URL=${remote}\n`);
    assert.throws(() => runtimeConfig({}, file), /loopback database/);
    const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url)));
    assert.equal(pkg.scripts.dev, 'node scripts/local.mjs dev');
    assert.equal(pkg.scripts.start, 'node scripts/local.mjs start');
    assert.match(pkg.scripts.build, /prisma generate/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
