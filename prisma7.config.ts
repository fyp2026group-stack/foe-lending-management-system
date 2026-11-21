import { existsSync } from 'node:fs';
import { defineConfig } from 'prisma/config';

// Local Docker verification is optional; cloud builds use injected env vars.
if (!process.env.DATABASE_URL && existsSync('.verification/m2.env')) {
  process.loadEnvFile('.verification/m2.env');
}

// Always apply schema migrations through a direct/admin connection when
// available; use the transaction pooler URL only for application queries.
const migrationUrl = process.env.MIGRATION_DATABASE_URL
  ?? process.env.DIRECT_URL
  ?? process.env.DATABASE_URL;
// Older local URLs predate the schema parameter; their migration history
// lives in lab. Preserve explicit schemas and remote connection behavior.
const scopedMigrationUrl = migrationUrl ? new URL(migrationUrl) : undefined;
if (scopedMigrationUrl &&
    ['localhost', '127.0.0.1', '[::1]'].includes(scopedMigrationUrl.hostname) &&
    !scopedMigrationUrl.searchParams.has('schema')) {
  scopedMigrationUrl.searchParams.set('schema', 'lab');
}

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations' },
  ...(scopedMigrationUrl ? { datasource: { url: scopedMigrationUrl.href } } : {}),
});
