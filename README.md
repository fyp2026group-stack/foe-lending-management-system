# Laboratory Inventory and Lending System

## Prisma-native backend

The `prisma` branch uses Next.js 16, TypeScript, Prisma 7 and PostgreSQL. Runtime authentication and Google OAuth, administrative user/batch/laboratory management, reports, inventory receipt/movement/import/adjustment operations, approvals, reservation, handover, return, inspection, maintenance, extension, cancellation, revisions and lending reads are implemented as native Prisma transactions. Historical PostgreSQL business functions are not invoked by the current Next.js runtime.

Database-level foreign keys, uniqueness, CHECK constraints, restricted SQL permissions, defensive triggers and ledger reconciliation remain intentional. **Prisma does not replace SQL database integrity constraints.**

## Empty local development database

Prerequisites: Node.js 24, Docker Desktop and npm.

```powershell
npm ci
npm run local:config
npm run db:setup
npm run prisma:readiness:enforce
npm run dev
```

`npm run dev` and `npm start` validate the restricted `ORM_DATABASE_URL` before starting Next.js. In a local shell without an injected connection they load `.verification/m2.env` (loopback database only). They never provision accounts, change credentials or migrate data. Missing or invalid configuration stops startup with a sanitized error. Existing environment values take precedence. With `NODE_ENV=production`, local files are never used: inject `ORM_DATABASE_URL` through the hosting environment. `npm run build` retains Prisma client generation.

`db:setup` provisions the restricted database login and applies the complete Prisma migration chain against an empty Docker PostgreSQL database. It does **not** create administrators, students, laboratories, items, stocks, or example records. The first administrator needs a protected bootstrap process before real usage.

To apply subsequent migrations without clearing data:

```powershell
npm run db:migrate
```

The historical SQL schema and its compatibility tests have separate explicit commands, `node scripts/local.mjs db:setup:legacy` and `node scripts/local.mjs db:migrate:legacy`. These are only for existing-data compatibility and regression testing. **Do not run the legacy bootstrap against a fresh production database.**

### Destructive local reset (explicit opt-in only)

```powershell
$env:CONFIRM_LOCAL_DB_RESET = "DELETE_LOCAL_DATA"
npm run db:reset-empty
Remove-Item Env:CONFIRM_LOCAL_DB_RESET
```

This destroys the configured local Docker volume and all its contents, including data created after installation. It never targets Supabase. Make a backup first.

## PostgreSQL / Supabase deployment

The source code can live on GitHub, but GitHub repository hosting does not deploy the Next.js application. Use a supported Node.js hosting provider for the Next.js server.

Provide two **server-only** PostgreSQL connections:

- `MIGRATION_DATABASE_URL` (or `DIRECT_URL`): direct migration-owner connection with schema-change privileges. Use it only during releases.
- `ORM_DATABASE_URL`: restricted `lab_orm` role, with a strong separately provisioned password and only application-granted table/column privileges.

For Supabase, create/configure the `lab_orm` login using an approved privileged SQL administration method; Prisma schema migrations create the least-privileged role without login credentials. Keep database passwords, Google OAuth credentials, and other secrets in the deployment environment. For regular application use, pass only the restricted ORM connection to the server.

After provisioning the database and credentials, apply migrations:

```powershell
npm ci
npm run prisma:validate
npm run prisma:readiness:enforce
npm run prisma:deploy
npm run prisma:status
npm run build
```

`prisma:deploy` uses `prisma migrate deploy`, not `db push`. Never use `prisma migrate reset` or `db:reset-empty` against a shared or live Supabase project. Back up data and validate migrations in staging before promotion.

## Validation

```powershell
npm run prisma:validate
npm run typecheck
npm run lint
npm test
npm run build
npm run prisma:readiness:enforce
```

GitHub Actions also checks clean Prisma migrations against isolated PostgreSQL, and historical compatibility suites use dedicated disposable local databases. Check the latest `prisma` branch workflow results before deployment.

### Production readiness boundaries

A successful Prisma migration and synthetic HTTP workflow do not constitute a production security audit. Confirm deployment-specific role grants, TLS and Supabase connection settings, first-admin initialization, Google OAuth configuration, multi-user concurrency, backups, recovery and monitoring before release.

**The database stays unseeded by default.** Real batches, laboratories, equipment, stock and student accounts must be created through authorized workflows.
