import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

test('deployment readiness ignores generated client examples but rejects application SQL calls', () => {
  const root = mkdtempSync(join(tmpdir(), 'lab-readiness-'));
  try {
    mkdirSync(join(root, 'src', 'generated', 'prisma'), { recursive: true });
    writeFileSync(join(root, 'src', 'generated', 'prisma', 'client.ts'),
      '// prisma.$queryRawUnsafe("example")\n');
    const run = () => spawnSync(process.execPath,
      [resolve('scripts/prisma-readiness.mjs'), '--enforce'],
      { cwd: root, encoding: 'utf8', windowsHide: true });
    const clean = run();
    assert.equal(clean.status, 0, clean.stderr);
    assert.match(clean.stdout, /0 legacy SQL invocation sites/);
    writeFileSync(join(root, 'src', 'service.ts'),
      'prisma.$queryRawUnsafe("SELECT 1");\n');
    const unsafe = run();
    assert.equal(unsafe.status, 1, unsafe.stderr);
    assert.match(unsafe.stdout, /service\.ts:1/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
