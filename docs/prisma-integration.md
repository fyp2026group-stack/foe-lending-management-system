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
- `prisma/schema.prisma` now includes the **43 introspected tables** and
  their supported relations; `prisma/migrations/0_init/migration.sql` is a
  non-destructive baseline *marked applied* on an existing database.
  The migration file does **not** recreate all 53 legacy SQL migrations:
  functions, triggers, check constraints, grants and unsupported expression
  indexes remain separately managed and must be preserved.
- Use only the guarded `npm run db:migrate` or `npm run prisma:deploy`
  command for this branch's migration operations; both enforce the local
  migration-role boundary. Never use `prisma migrate dev` or `prisma db push`
  against an existing environment. The complete migration history is not
  yet a standalone replacement for the legacy initialization sequence.
- The runtime role retains **no access to credentials, sessions, lending,
  inventory stock or audit tables**. One narrowly scoped TypeScript Prisma
  service reads administrative batch and laboratory reference data, after
  verifying the existing protected session authority. A dedicated migration
  grants SELECT only on these reference tables and their count relations.
  Other operations continue to call protected `lab.*` functions through
  parameterized Prisma raw SQL.
- The original `pg` dependency remains for the isolated provisioning and
  integration-test scripts and as a driver dependency of `@prisma/adapter-pg`.

## Local workflow

Use Node.js 24 and Docker. The existing local configuration generator is
still the canonical configuration mechanism:

```powershell
npm ci
npm run local:config
npm run db:setup
npm run db:migrate   # safely repeatable; legacy migration then Prisma deploy
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

The Prisma Client is temporarily generated through the `prisma-client-js`
compatibility generator into `node_modules` and is not committed. Next.js
Turbopack did not resolve the TypeScript-source generator's ignored output at
runtime. Generation happens after `npm ci` and before builds.
`prisma7.config.ts` loads the same local-only verification configuration.

The exported `transaction()` wrapper preserves the existing
`client.query(sql, params)` contract for the application. SQL function
parameters that accept JSONB are explicitly cast using `::jsonb`. No
client-supplied SQL text is interpolated into queries.


## Migration roadmap and current progress

1. **Completed:** Migrate the connection adapter to Prisma 7; keep existing
   transaction semantics and secured PostgreSQL functions.
2. **Completed:** Introspect all 43 tables using the migration role in an
   isolated Docker test database; generate the initial Prisma baseline
   (43 tables, 82 foreign keys). Repair the composite asset-stock cardinality
   without adding a false unique constraint.
3. **Started:** Extract approval and stock rules into tested TypeScript
   domain services. The new `request-approval-gate.ts` defines an atomic
   whole-request approval prerequisite, but it is not active in production.
4. **Partly complete:** Implemented and routed `admin/batches` and
   `admin/laboratories` reads through typed Prisma ORM transactions, with
   authorization, narrow SELECT grants and HTTP regression checks.
   Implement secure Prisma services for sessions/roles,
   inventory state changes, requests/approvals, reservation, issue, returns,
   inspections, reports, and audit; grant the new runtime role only required
   privileges and verify concurrent operations.
5. **Not complete:** Replace all API function calls and write comprehensive
   parity, authorization, race-condition, and data-integrity tests.
6. **Not complete:** Create and validate custom Prisma SQL migrations for all
   triggers, check constraints, special indexes, grants, and remaining
   PostgreSQL features before retiring SQL function migrations.

All steps must be tested with isolated PostgreSQL. **Never delete the existing
SQL functions until the feature-equivalent TypeScript services and authorization
boundary pass every role-specific and concurrency test.** Preserve the original
branch and ensure reliable rollback.

### Introspection and baseline reproducibility

The baseline job is `.github/workflows/prisma-schema-baseline.yml`.
It uses the **migration** database role for introspection and history management,
not the restricted `lab_runtime` account. The runtime account must not be given
schema-level CREATE rights merely to make introspection or Prisma Migrate work.
`scripts/prisma-repair-introspection.mjs` corrects Prisma's inferred asset-stock
cardinality, which would otherwise create a false one-to-one requirement.

`scripts/prisma-migrations.mjs` verifies the legacy migration ledger before
marking the Prisma baseline applied and deploying later migrations, and
`npm run db:migrate` repeats this sequence safely. `scripts/verify-local.mjs`
asserts the Prisma migration ledger and rejects unauthorized access to
sensitive tables.

The baseline generated by Prisma's schema diff is appropriate for marking
a **populated existing database** as already initialized, not for reconstructing
the complete database from empty by itself. New test instances still use the
legacy provisioning sequence until the custom migrations have been completed.

## Release gate

Only deploy after the Prisma branch passes CI checks for Prisma validation,
TypeScript, ESLint, Next.js production build, static tests, and all isolated
PostgreSQL integration cases. Pay particular attention to login/roles,
inventory adjustments, request submission, lecturer/HOD decisions,
reservation, handover, return/inspection, report exports and revision history.

The database is still restricted to localhost by default. A remote database
requires a separate deliberate deployment/security design.
