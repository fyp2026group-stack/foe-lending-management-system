# Laboratory Inventory and Lending System

## Prisma migration status

This branch is a **work in progress**, not yet safe to deploy to a new Supabase database. It includes Prisma 7 models and native services, but parts of lending, inventory, identity, and administration still invoke legacy PostgreSQL functions. The current migration chain also requires the legacy SQL baseline. **Do not run `prisma migrate deploy` against an empty production database until the native baseline has been completed and verified.**

## Development setup (empty data)

Prerequisites: Node.js 24, npm, Git and Docker Desktop.

```powershell
npm ci
npm run local:config
npm run db:setup
npm run dev
```

`db:setup` creates the local schema and provisions its verifier but **does not insert synthetic users, stock, laboratories, or equipment**. An empty database has no login accounts. Seed and admin bootstrap functionality will be designed separately after completing the native Prisma conversion.

## Intentionally reset the local development database

The following destroys **all data in the dedicated local Docker database volume** and recreates an empty schema. Back up anything you need first. Do **not** use these commands against a shared, staging, or production environment.

```powershell
$env:CONFIRM_LOCAL_DB_RESET = "DELETE_LOCAL_DATA"
npm run db:reset-empty
Remove-Item Env:CONFIRM_LOCAL_DB_RESET
```

The reset command operates through the local Docker Compose configuration, not Supabase. It requires a generated local environment file. The reset uses `docker compose down --volumes` and is irreversible without a backup.

## Current architecture and checks

- UI: Next.js 16 / React 19 / TypeScript.
- Database: PostgreSQL with Prisma 7 and an interim legacy SQL/RPC compatibility layer.
- Production connection: runtime role `lab_runtime` for legacy handlers and dedicated restricted `lab_orm` for native Prisma services.
- Database migrations: historical 001–053 SQL migrations plus a Prisma baseline meant for an already installed legacy schema.
- Security: do not change or drop the legacy functions until native replacements retain authorization, CSRF validation, atomic stock movements, row locking, idempotency, and audit history.

```powershell
npm run prisma:validate
npm run typecheck
npm run lint
npm test
npm run build
npm run prisma:readiness:enforce
```

The final readiness command must pass before claiming the application is fully native Prisma. Existing database integration tests need separate local credentials and must be revalidated against the eventual native schema.

## Intended deployment architecture

- Use Supabase PostgreSQL as the database, with a direct migration connection and a separate least-privileged runtime connection.
- Host the Next.js application on a compatible Node.js provider; storing the source code on GitHub does **not** itself deploy the application.
- Set secure, server-only environment variables for database connections, the application's public origin and login verifier. Keep secrets in the hosting provider's environment manager, never in Git.
- Apply Prisma-managed schema migrations through CI/CD or an operator-controlled release step; do not run automatic destructive schema resets.
- Bootstrap the first administrator via a protected, audited process when the seed/admin-bootstrap implementation is ready.

## Important

The application should be treated as **not production-ready** until the remaining native Prisma services, fresh-database schema migrations, end-to-end role workflows, access controls, and deployment checks are implemented and have passed.
