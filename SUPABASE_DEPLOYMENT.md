# Supabase + Prisma deployment

## Current implementation

The application's Next.js API handlers use Prisma model queries and transactional
service methods for authentication, Google sign-in, administration, reporting,
inventory, request-wide approvals, reservation, handover, returns, inspection,
maintenance, cancellations and extensions. **No application handler should
call the historical `lab.*` business stored procedures.** CI enforces this
using `npm run prisma:readiness:enforce`.

The historical SQL migration files remain in the repository for provenance and
local integration fixtures. They must not be deleted from an existing database
merely because the application no longer calls their functions. The new Prisma
migrations retain database-only integrity guards (stock ledger reconciliation,
double-entry balance, optimistic version triggers, immutable event history and
important CHECK constraints). These triggers are not the old business RPC API.

**Do not deploy to production until clean-schema migration, privileges,
integration tests, and a Supabase staging dry run are green.**

## Required environment

- `ORM_DATABASE_URL`: runtime restricted PostgreSQL connection as `lab_orm`.
  For Supabase transaction pooling the username may be `lab_orm.PROJECT_REF`.
- `MIGRATION_DATABASE_URL`: direct (or session-pooled) Supabase migration-owner
  connection. Never use `lab_orm` for schema migrations.
- `APP_ORIGIN`: canonical HTTPS Next.js deployment origin, for CSRF protection.
- `DATABASE_POOL_SIZE`: optional; defaults to 5.
- `DATABASE_URL`: optional for the historical local verification/provisioner
  and CLI fallback; it is no longer an application runtime dependency.

The Prisma migration `20261115000000_bootstrap_restricted_orm_role` creates
`lab_orm` without a login if missing. The deployment administrator must
securely enable a login and assign an independently generated password through
the Supabase administration interface. **Do not commit credentials or grant
schema ownership, SUPERUSER, BYPASSRLS or broad table permissions to that role.**

## Verify the branch

Run using Node.js 24, with environment variables set securely:

```sh
npm ci
npm run prisma:validate
npm run typecheck
npm run lint
npm run build
npm test
npm run prisma:readiness:enforce
npm run prisma:status
```

On a **disposable database**, use `npm run prisma:deploy` to validate clean
Prisma migration deployment. Run the same migration on a separate staging
database before any production migration. This command changes schema, not data
seed contents. It does not need the legacy `lab_runtime` account.

Existing databases with the original 53 migrations use a guarded
`scripts/prisma-migrations.mjs` local reconciliation process; `0_init`
is marked applied if the legacy schema exists. Never replay initial baseline
table creation on populated production data.

## Release acceptance

Verify all of the following on a Supabase staging project before merging:

1. Fresh baseline + migration deployment, repeatable status and schema drift
   review; no destructive migration against existing data.
2. Every user role: login, OAuth registration, CSRF, grant/role changes,
   self-change and self-approval restrictions.
3. Equipment catalogue and stock state transitions including imports,
   adjustments, commands and double-entry balance.
4. Multi-item request: lecturer then HOD approval, **whole-request** reservation,
   Technical Officer handover with serial tracking and physical return.
5. Mandatory inspection clearance, maintenance routing, extensions, revisions
   and cancellation with release of reserved stock.
6. Concurrent handovers/returns/reservations and replayed `commandId` values,
   audit immutability, zero negative stock and matching ledger projections.
7. Authenticated HTTP tests, production build and all GitHub Actions green.
8. Environment secrets configured outside GitHub source and Next.js public env.
9. Backup and rollback plan for existing production data.

The database remains empty after setup. Do not seed synthetic users/equipment
without a separately approved data plan.
