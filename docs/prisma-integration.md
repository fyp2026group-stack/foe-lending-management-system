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
  inventory stock or audit tables**. Typed Prisma services now read
  administrative batch and laboratory reference data, lending equipment
  policies, and inventory categories after checking the protected session
  authority. Migrations grant SELECT only to the required reference tables
  and specific catalogue columns. Other operations continue to call
  protected `lab.*` functions through parameterized Prisma raw SQL.
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
4. **Partly complete:** Implemented typed Prisma ORM transaction services for
   `GET /api/admin/batches`, `GET /api/admin/laboratories`,
   `GET /api/lending/policies`, and `GET /api/inventory/categories`.
   They retain authentication checks, narrow SELECT grants, pagination,
   and HTTP regression tests. Still implement secure Prisma services for
   sessions/roles,
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

## Latest verified integration results (2026-11-15)

GitHub Actions run 43725328846 passed all source and integration jobs:

- Prisma validation, TypeScript, linting, production build, source tests
- Isolated PostgreSQL migration baseline, repeatable Prisma deployment, and
  sensitive-table privilege checks
- **11/11 SQL lifecycle and security integration tests**
- **34/34 authenticated HTTP integration tests**, including the new typed
  catalogue and policy endpoints
- Lecturer approval, HOD approval, borrowing, stock reservations,
  handover/return and authorization behaviors exercised by existing suites

The inherited SQLSTATE 42P01 approval defect was corrected via two
versioned Prisma SQL migrations. The final replay update binds its values
with `EXECUTE ... USING`, independent of PostgreSQL function rename
behavior. Legacy migrations are retained unchanged.

**This is not yet a fully Prisma-only application.** Core lending,
inventory mutations, authentication, returns, inspection, reporting,
and audit still rely on protected database functions. Moving those
write paths into TypeScript requires secure transactional equivalents,
least-privilege grants or RLS, concurrent stock conservation tests,
idempotency checks, and a reversible deployment plan. Do not delete
the legacy SQL functions or migration runner yet.

## Request-wide approval and custody invariants

The original line-by-line reservation behavior permitted the `NONE`-policy
item of a multi-equipment request to reserve stock while a different item
awaited lecturer or HOD approval. The new versioned Prisma migrations
`20261115180500_request_wide_approval_guard` and
`20261115181000_request_wide_allocation_guard` enforce the desired
whole-order policy across legacy callers:

- Every *active* request line must be `APPROVED` before any allocation.
  A fully cancelled line does not block other lines.
- The legacy explicit reservation route is covered by a database
  `BEFORE INSERT` guard on `lend_allocations`.
- Physical handover is independently guarded on `lend_loans`.
- The final versioned approval attempts reservations for **all** approved
  lines, including items not requiring separate academic approval.
- An approval for one item never represents approval of a different item.
  The TypeScript domain gate uses `lineId` + role as the approval key.
- Existing audit records, stock movement history, and command idempotency
  behavior are retained.

Regression tests: `tests/prisma-request-gate.test.mjs` and
`tests/request-wide-approval.integration.mjs`. These test multi-item
lecturer/HOD sequencing, mixed `NONE`/approval policies, prohibition of
early reservation, and automatic reservation after the last required
approval. Existing single-item lifecycle tests remain mandatory.

**Still needed before retiring DB functions:** migrate each write operation
to authenticated Prisma transactions with a non-forgeable authorization
context, row-level access controls, request/stock locking, and parity tests
for command replay, concurrency, cancellations, returns, inspection,
maintenance, immutable audit and history. Current SQL triggers deliberately
protect direct Prisma writes once that transition occurs.

## Native Prisma services (2026-11-16)

A new `lab_orm` database role enables *actual* Prisma model operations
without granting the old `lab_runtime` role arbitrary access to protected
tables. Its password is generated separately; existing loopback
`.verification/m2.env` files receive only the new `LOCAL_ORM_PASSWORD`
and `ORM_DATABASE_URL` entries on first use. Existing credentials are
preserved. Provisioning this role precedes Prisma's guarded migration
deployment.

The native service implementation is limited to:

- Inventory category **POST/PATCH** (ORM transactions for catalogue
  changes, idempotent `inv_commands`, audit insertion, optimistic versions
  and current ADMIN / session / CSRF validation).
- Lending lecturer directory **GET** (ORM session verification, live
  lecturer role and laboratory membership, self-exclusion and narrow DTO).
- Previously migrated ORM reads of inventory categories, equipment
  policies and administrative reference data remain available.

Prisma migration SQL deliberately keeps database constraints, advisory
locks, protected triggers and field-level grants. The category-update
guard allows `lab_orm` updates **only** on categories with a checked
version increment and active-item safety. `lab_orm` has no read access
to stock, loans, password hashes or audit contents; no update/delete
access to audit or command ledgers. Tests in
`tests/m3-inventory.integration.mjs`,
`tests/m2-identity.integration.mjs`, and
`tests/prisma-native-category.test.mjs` cover these services.

**Status: still a hybrid backend.** The following are still protected
SQL-function operations and are NOT certified as native Prisma services:
sessions/login and governance, equipment items and locations mutation,
receipts/stock movements/imports/adjustments, borrowing submissions,
approval decisions, reservation, issue/return/inspection/maintenance,
reports and audit history. Removing those functions or broadening
`lab_orm` privileges before independent parity and concurrency
verification would be unsafe. The legacy 53-file SQL initialization
sequence and its guarded Prisma baseline remain necessary for clean
database builds.

## Release gate

Only deploy after the Prisma branch passes CI checks for Prisma validation,
TypeScript, ESLint, Next.js production build, static tests, and all isolated
PostgreSQL integration cases. Pay particular attention to login/roles,
inventory adjustments, request submission, lecturer/HOD decisions,
reservation, handover, return/inspection, report exports and revision history.

The database is still restricted to localhost by default. A remote database
requires a separate deliberate deployment/security design.
