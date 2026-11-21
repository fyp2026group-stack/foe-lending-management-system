# Prisma ORM migration architecture

This branch uses Prisma 7 and `@prisma/adapter-pg` for all Next.js runtime
application database access. The TypeScript services in
`src/lib/server/services/` own the domain logic. All endpoints now use the
restricted `nativeOrmTransaction()` helper; the former dynamic
`client.query()` compatibility adapter has been removed.

## Runtime security model

- `ORM_DATABASE_URL` authenticates as the dedicated `lab_orm` role.
- `MIGRATION_DATABASE_URL` is used for Prisma CLI and protected schema changes.
- Application credentials are not exposed to clients or `NEXT_PUBLIC_*`.
- Session, current roles and CSRF are verified server-side within the same
  database transaction as the protected operation.
- Every request checks its current user, role and laboratory assignment; no
  controller trusts client-supplied authorization scopes.
- Inventory and lending mutations acquire advisory locks in the established
  order (identity, stock, lending) to serialize competing writers and support
  current local migration fixtures.
- Inventory moves update stock cells and append balanced ledger entries in
  one transaction. Post-return equipment goes to INSPECTION, not AVAILABLE.
- A multi-line request is only reservable/issuable when **every active line**
  has its required approvals.
- Mutations retain per-actor `commandId` idempotency, optimistic version
  checks and append-only audit/decision/return history.
- Reports and operational summaries use repeatable-read snapshots.

## Service coverage

| Area | Native Prisma service |
| --- | --- |
| Password/OAuth/session/audits | `identity-login`, `google-students`, `identity-session`, `denial-audit` |
| HOD user governance, batches, labs | `admin-user-mutations`, `admin-reference-mutations`, `admin-users` |
| Inventory catalogue, assets, receipts, stock/imports | `inventory-*`, `stock-ledger` |
| Request submission, drafts, revisions and cancellation | `lending-request-mutations`, `lending-draft-mutations`, `lending-cancellations` |
| Lecturer/HOD decisions, reserve/issue/return | `lending-decisions`, `lending-reservations`, `lending-handovers`, `lending-returns` |
| Inspection, maintenance, extension | `lending-inspection-mutations`, `lending-extension-mutations` |
| Lending list, history, sources and operational dashboard | `lending-request-reads`, `lending-loan-reads`, `lending-physical-reads`, `lending-source-reads`, `lending-operations-summary` |
| HOD reports/exports | `admin-reports` and `report-export.ts` |

`npm run prisma:readiness:enforce` walks the protected server source and
fails on remaining `lab.*()` stored-function invocations or unsafe raw query
calls (excluding the connection module).

## Schema and migration status

`prisma/schema.prisma` describes all 43 historical tables and supported
relations. `prisma/migrations/0_init` represents the table/FK/index baseline.
The later numbered Prisma migrations implement application-specific column
grants, scoped role provisioning and critical integrity safeguards.
`20261119009000_native_integrity_guards` restores deferred balanced ledger
entries, cell reconciliation, optimistic version increments, immutable records
and CHECK constraints on fresh schemas. These small PostgreSQL triggers are
integrity safeguards, **not** the old business stored-procedure API.

The repository intentionally retains `database/001_*.sql` through
`database/053_*.sql` as auditable migration history and a compatibility
fixture for isolated local tests. Do not delete them or drop legacy functions
from an existing database as part of an application release. The local
`npm run db:setup` bootstraps legacy fixtures, marks Prisma `0_init`
applied, and deploys later Prisma migrations; `npm run prisma:deploy`
runs the native Prisma migration chain.

## Verification and deployment

```powershell
npm ci
npm run local:config
npm run db:setup
npm run prisma:validate
npm run typecheck
npm run lint
npm run build
npm test
npm run prisma:readiness:enforce
```

Run the additional authenticated PostgreSQL integration suites using the
existing `.github/workflows/verify.yml` or `prisma-verify.yml` workflows.
For a fresh cloud database, use the migration owner's direct URL and test
`npm run prisma:deploy` on a disposable/staging Supabase project first.
Read `SUPABASE_DEPLOYMENT.md` for credentials, staging release gates,
data-preserving rollout and rollback. Neither branch edits nor CI tests
have migrated an actual user Supabase database.
