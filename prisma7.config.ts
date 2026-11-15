import { existsSync } from 'node:fs';
import { defineConfig } from 'prisma/config';

// The application uses a local-only, generated configuration by design.
// Prisma CLI commands may be run directly without changing that policy.
if (!process.env.DATABASE_URL && existsSync('.verification/m2.env')) {
  process.loadEnvFile('.verification/m2.env');
}

export default defineConfig({
  schema: 'prisma/schema.prisma',
  // Existing database/*.sql migrations remain authoritative. Do not run migrate
  // dev/deploy or db push against this database: protected SQL functions,
  // ownership, triggers and security policies are managed outside Prisma.
  ...(process.env.DATABASE_URL
    ? { datasource: { url: process.env.DATABASE_URL } }
    : {}),
});
