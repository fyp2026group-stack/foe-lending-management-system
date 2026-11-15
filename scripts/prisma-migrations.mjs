import pg from 'pg';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

const ownerUrl = process.env.MIGRATION_DATABASE_URL;
if (!ownerUrl) throw new Error('MIGRATION_DATABASE_URL is required');
const url = new URL(ownerUrl);
if (!['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname) ||
    !/^\/(lab_inventory|lab_m2_test_[a-z0-9_]+)$/.test(url.pathname)) {
  throw new Error('Prisma migrations require the configured local migration database');
}
url.searchParams.set('schema', 'lab');
const prismaUrl = url.toString();
const root = resolve(import.meta.dirname, '..');
const client = new pg.Client({ connectionString: ownerUrl });
await client.connect();
let initialized;
try {
  const baseline = await client.query(
    "SELECT count(*)::int AS n FROM public.lab_migrations"
  );
  if (baseline.rows[0].n < 53) {
    throw new Error('Legacy schema has not been fully initialized');
  }
  const existing = await client.query(
    "SELECT to_regclass('lab._prisma_migrations') IS NOT NULL AS has_history"
  );
  initialized = existing.rows[0].has_history;
} finally {
  await client.end();
}

function prisma(...args) {
  const result = spawnSync(process.execPath, [
    resolve(root, 'node_modules/prisma/build/index.js'), ...args,
    '--config', 'prisma7.config.ts',
  ], {
    cwd: root,
    env: { ...process.env, DATABASE_URL: prismaUrl },
    stdio: 'inherit',
    shell: false,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error('Prisma migration command failed');
}

// The baseline is a historical snapshot of the *already installed* legacy
// schema. It must never be executed on top of preexisting legacy tables.
if (!initialized) prisma('migrate', 'resolve', '--applied', '0_init');
prisma('migrate', 'deploy');
