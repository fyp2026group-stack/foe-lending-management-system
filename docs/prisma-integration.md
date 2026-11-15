# Prisma ORM integration

Prisma ORM 7 uses the PostgreSQL driver adapter in
`src/lib/server/db.ts`. All application identity, inventory, lending,
reporting and Google-registration database access continues through
`transaction()`, now backed by Prisma interactive transactions.

## Database authority

This is an **existing database** with audit triggers, protected
security-definer functions, role grants, composite foreign keys,
stock-state conservation checks, and domain-specific rules.

- `database/*.sql` remains the authoritative migration sequence.
- `prisma/schema.prisma` initially maps selected existing tables. It is **not**
  a replacement for the full SQL schema or database ERD.
- Do **not** run `prisma migrate dev`, `prisma migrate deploy`, or
  `prisma db push` against this database.
- The runtime role must continue to have no direct table privileges.
  All user-facing operations call protected `lab.*` functions through
  parameterized Prisma raw SQL (not direct model writes).
- The original `pg` dependency remains for the isolated provisioning and
  integration-test scripts and as a driver dependency of `@prisma/adapter-pg`.

## Local workflow

Use Node.js 24 and Docker. The existing local configuration generator is
still the canonical configuration mechanism:

```powershell
npm ci
npm run local:config
npm run db:setup
npm run prisma:validate
npm run prisma:generate
npm run typecheck
npm run lint
npm run build
npm test
```

The isolated PostgreSQL integration workflows require the generated
`.verification/m2.env` and can be run with the same commands defined in
`.github/workflows/prisma-verify.yml`.

`npm run prisma:introspect` is reserved for a temporary, isolated database.
Never run introspection against a live production database when also running
automatic Prisma schema migrations. Review the resulting model changes
against the SQL constraints and protected functions.

## Database client

The Prisma Client is generated into `src/generated/prisma` and is not
committed. Generation happens after `npm ci` and before builds.
`prisma7.config.ts` loads the same local-only verification configuration.

The exported `transaction()` wrapper preserves the existing
`client.query(sql, params)` contract for the application. SQL function
parameters that accept JSONB are explicitly cast using `::jsonb`. No
client-supplied SQL text is interpolated into queries.

## Release gate

Only deploy after the Prisma branch passes CI checks for Prisma validation,
TypeScript, ESLint, Next.js production build, static tests, and all isolated
PostgreSQL integration cases. Pay particular attention to login/roles,
inventory adjustments, request submission, lecturer/HOD decisions,
reservation, handover, return/inspection, report exports and revision history.

The database is still restricted to localhost by default. A remote database
requires a separate deliberate deployment/security design.
