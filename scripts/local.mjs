import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const root = resolve(import.meta.dirname, '..');
const envFile = resolve(root, '.verification', 'm2.env');
const nextBin = resolve(root, 'node_modules', 'next', 'dist', 'bin', 'next');
const compose = ['compose', '--env-file', envFile, '-f', resolve(root, 'database', 'compose.yaml')];

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: root,
    env: process.env,
    stdio: 'inherit',
    shell: false,
    ...options,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}
function requireConfig() {
  if (!existsSync(envFile))
    throw new Error('Local configuration is missing. Run: npm run local:config');
  process.loadEnvFile(envFile);
  // Older local configurations predate the dedicated ORM role. Upgrade
  // in place without changing their existing credentials.
  node('scripts/upgrade-orm-config.mjs');
  process.loadEnvFile(envFile);
}
function node(script, ...args) {
  run(process.execPath, [resolve(root, script), ...args]);
}
function docker(...args) {
  run('docker', [...compose, ...args]);
}

const command = process.argv[2];
switch (command) {
  case 'config':
    node('scripts/local-config.mjs');
    break;
  case 'db:up':
    requireConfig();
    docker('up', '-d', '--wait');
    break;
  case 'db:down':
    requireConfig();
    docker('down');
    break;
  case 'db:setup':
    requireConfig();
    docker('up', '-d', '--wait');
    node('scripts/provision-runtime.mjs');
    node('scripts/database.mjs', 'migrate');
    node('scripts/prisma-migrations.mjs');
    node('scripts/provision-verifier.mjs');
    // Intentionally leave the database empty. Seed data is opt-in and will be designed separately.
    break;
  case 'db:reset-empty':
    requireConfig();
    if (process.env.CONFIRM_LOCAL_DB_RESET !== 'DELETE_LOCAL_DATA') {
      throw new Error('Set CONFIRM_LOCAL_DB_RESET=DELETE_LOCAL_DATA to explicitly erase the local Docker database');
    }
    docker('down', '--volumes');
    docker('up', '-d', '--wait');
    node('scripts/provision-runtime.mjs');
    node('scripts/database.mjs', 'migrate');
    node('scripts/prisma-migrations.mjs');
    node('scripts/provision-verifier.mjs');
    break;
  case 'db:migrate':
    requireConfig();
    node('scripts/provision-runtime.mjs');
    node('scripts/database.mjs', 'migrate');
    node('scripts/prisma-migrations.mjs');
    break;
  case 'prisma:deploy':
    requireConfig();
    node('scripts/provision-runtime.mjs');
    node('scripts/prisma-migrations.mjs');
    break;
  case 'db:seed':
    requireConfig();
    node('scripts/database.mjs', 'seed');
    break;
  case 'db:verify':
    requireConfig();
    node('scripts/verify-local.mjs');
    break;
  case 'db:shell':
    requireConfig();
    docker('exec', 'postgres', 'psql', '-U', 'lab_migration', '-d', 'lab_m2_test_identity');
    break;
  case 'dev':
    requireConfig();
    run(process.execPath, [nextBin, 'dev', '--hostname', '127.0.0.1']);
    break;
  case 'build':
    requireConfig();
    run(process.execPath, [nextBin, 'build']);
    break;
  case 'start':
    requireConfig();
    run(process.execPath, [nextBin, 'start', '--hostname', '127.0.0.1']);
    break;
  default:
    console.error(
      'Use config, db:up, db:down, db:setup, db:reset-empty, db:migrate, db:seed, db:verify, db:shell, prisma:deploy, dev, build, or start.'
    );
    process.exit(2);
}
