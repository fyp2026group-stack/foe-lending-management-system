import { randomBytes } from 'node:crypto';
import { mkdir, writeFile, access } from 'node:fs/promises';
await mkdir('.verification', { recursive: true });
try {
  await access('.verification/m2.env');
  throw Error('Configuration already exists; preserve it');
} catch (e) {
  if (e.code !== 'ENOENT') throw e;
}
const migration = randomBytes(24).toString('hex'),
  runtime = randomBytes(24).toString('hex'),
  orm = randomBytes(24).toString('hex'),
  seed = randomBytes(24).toString('hex');
await writeFile(
  '.verification/m2.env',
  `LOCAL_MIGRATION_PASSWORD=${migration}\nLOCAL_RUNTIME_PASSWORD=${runtime}\nLOCAL_ORM_PASSWORD=${orm}\nSYNTHETIC_ADMIN_PASSWORD=${seed}\nMIGRATION_DATABASE_URL=postgresql://lab_migration:${migration}@127.0.0.1:55239/lab_m2_test_identity\nDATABASE_URL=postgresql://lab_runtime:${runtime}@127.0.0.1:55239/lab_m2_test_identity\nORM_DATABASE_URL=postgresql://lab_orm:${orm}@127.0.0.1:55239/lab_m2_test_identity\nAPP_ORIGIN=http://127.0.0.1:3000\nM2_TEST_ENABLE=synthetic-only\nM2_TEST_DATABASE_URL=postgresql://lab_migration:${migration}@127.0.0.1:55239/lab_m2_test_identity\nM2_TEST_APP_ORIGIN=http://127.0.0.1:3000\n`,
  { mode: 0o600, flag: 'wx' }
);
