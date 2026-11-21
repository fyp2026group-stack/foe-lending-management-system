# University Laboratory Inventory and Equipment Lending

A university laboratory application for equipment catalogues, stock custody, borrowing, approvals, handover, returns, inspection and operational reporting. This README is the single setup and deployment guide, including the former Supabase deployment guidance.

## Architecture and responsibilities

The application uses Node.js 24, Next.js 16 App Router, React 19, TypeScript, Tailwind CSS, Prisma 7 with the PostgreSQL driver adapter, and PostgreSQL. Exact dependency versions are pinned in package.json and package-lock.json. The server requires a Node.js runtime; GitHub Pages/static export cannot serve its authenticated APIs.

| Role | Main workflows |
| --- | --- |
| HOD/Admin | User, batch and laboratory governance; HOD decisions; inventory oversight and reports |
| Lecturer | Review student requests, lecturer decisions, catalogue and borrowing workflows |
| Technical Officer | Inventory receipts, movements, imports, adjustments, reservations, handover, returns, inspection and maintenance |
| Student | Browse equipment, submit and revise requests, track decisions and loans, request extensions |

Passwords use salted scrypt hashes. Session cookies are HttpOnly and SameSite, with Secure enabled in production; protected writes validate the canonical origin and CSRF credentials. Request validation and admission limits reject invalid or excessive submissions. Authorization is enforced on the server, including scope and session checks. A visible control is not permission to perform its action. Users cannot approve their own requests or issue equipment to themselves.

A typical loan progresses through request submission, lecturer review where required, HOD approval, whole-request reservation, officer handover, physical return and inspection clearance. Requests may be rejected, revised, cancelled or extended through authorized transitions. Approval is request-wide: approval of an individual line must not bypass the remaining request decisions. Returned stock requiring inspection stays unavailable until cleared; damaged equipment follows maintenance routing. Identified assets retain serial identity through reuse.

Prisma service transactions implement business operations. Historical lab.* SQL business procedures are not used by application handlers. PostgreSQL foreign keys, uniqueness, CHECK constraints, defensive triggers, immutable decisions/comment versions/audit history, optimistic versions and stock ledger reconciliation remain intentional. Inventory movements conserve quantity with balanced entries and matching stock projections; concurrent reservation and handover must not create negative or duplicate available stock. Command identifiers support safe replay of applicable mutations.

## Repository layout

| Path | Purpose |
| --- | --- |
| src/app | Pages, layouts and API route handlers |
| src/components | Shared UI and role workspaces |
| src/lib/server | Session, validation, authorization, database and transactional services |
| prisma/schema.prisma | ORM model definitions |
| prisma/migrations | Authoritative ordered Prisma migration history |
| prisma7.config.ts | CLI schema, migration path and owner connection selection |
| database | Docker database configuration and historical SQL migration/test provenance |
| scripts | Required local operations, integrity checks and explicit regression tooling |
| tests | Unit, source-contract, database and HTTP regression suites |
| public | Static assets |
| .github/workflows | CI verification on isolated databases |
| .env.example | Placeholder configuration; contains no usable credentials |

Generated node_modules, .next, coverage, .cache, .verification and TypeScript build metadata are ignored. Local evidence and credentials do not belong in commits. Preserve migration history and authoritative agent instructions during cleanup. Historical integration tooling is retained where it provides compatibility evidence, rather than treated as application bootstrap.

## Prerequisites

Use Node.js **24.x** (the package declares >=24 <25), npm, Git and Docker Desktop/Engine with Compose for local database operations. PostgreSQL **16** is the CI and production validation target. The checked-in database/compose.yaml currently uses postgres:15-alpine for local development; CI uses PostgreSQL 16. Never upgrade a populated volume by merely changing its image tag; back up and restore into a separately provisioned compatible instance. PostgreSQL client utilities matching the server version are needed for external backup/restore.

Run all commands from the repository root. The checked-in .npmrc sets ignore-scripts=true, so npm ci does not run postinstall automatically. Run npm run prisma:generate explicitly after installing; typecheck and build also generate the client. Dependency installation does not create application accounts or equipment.

## Fresh local setup

```powershell
npm ci
npm run prisma:generate
npm run local:config
npm run db:setup
npm run db:verify
npm run prisma:readiness:enforce
npm run dev
```

Open http://127.0.0.1:3000. Use that exact hostname consistently. local:config creates ignored .verification/m2.env with randomly generated local credentials and refuses to overwrite an existing file. db:setup starts the loopback Docker database, provisions restricted runtime access and applies Prisma migrations. The default database is lab_m2_test_identity on port 55239; consult the generated configuration and Compose file for overrides.

Fresh setup is **unseeded**: there are no users, laboratories, batches, items or stock. Startup does not bootstrap accounts or reset passwords. The requested cleaned working database is intended to retain only four designated role accounts (HOD/Admin, lecturer, technical officer, student); that is a separately performed cleanup, not a seed reproduced by these commands. Do not assume those accounts exist on a fresh installation. Initial administrator provisioning requires a protected, reviewed administration process; this repository does not document a general production bootstrap command. Never reuse test fixture scripts as production account provisioning. Share credentials privately, never in this README or committed configuration. After bootstrap, use authorized administration screens for further account/reference changes.

### Daily operation and updates

```powershell
npm run db:up
npm run dev
```

Stop the application with Ctrl+C; stop the local database with npm run db:down. Database shutdown preserves its volume. Do not remove Docker volumes to stop work.

After pulling changes, run npm ci when dependencies changed, then npm run db:migrate to apply pending local migrations without clearing data. Regenerate the client with npm run prisma:generate after model changes. Do not edit already-applied migrations; create and review a new migration including required SQL integrity guards, validate on disposable and staging databases, then deploy it. prisma:introspect reads the live database into the schema file: review its diff before accepting it. prisma:format formats the schema; neither command substitutes for migration review.

npm run db:shell opens local psql using the migration owner. Use it for deliberate administrative inspection only; application requests always use lab_orm. Example read-only checks:

```sql
SELECT current_database(), current_user;
SELECT count(*) FROM lab.users;
SELECT migration_name, finished_at FROM lab._prisma_migrations ORDER BY started_at;
```

Never copy real user records, session tokens or password hashes into issue reports. Ordinary application operations belong in the UI, not ad hoc owner SQL.

## Configuration and secrets

| Variable | Use and handling |
| --- | --- |
| ORM_DATABASE_URL | Required server-only runtime connection as restricted lab_orm; Supabase pooler usernames can include .PROJECT_REF |
| MIGRATION_DATABASE_URL | Preferred server-only direct/session-pooled migration-owner connection; release process only |
| DIRECT_URL | Server-only CLI fallback when MIGRATION_DATABASE_URL is absent |
| DATABASE_URL | Last CLI fallback and historical verification connection; not required by application requests |
| APP_ORIGIN | Canonical origin used for write-origin validation and OAuth callbacks; local default http://127.0.0.1:3000, production must use HTTPS |
| DATABASE_POOL_SIZE | Server connection pool size, default 5; budget across all application instances |
| GOOGLE_OAUTH_CLIENT_ID | Server configuration for Google student sign-in |
| GOOGLE_OAUTH_CLIENT_SECRET | Server-only Google credential |
| GOOGLE_OAUTH_COOKIE_SECRET | Server-only high-entropy secret of at least 32 characters, protects short-lived OAuth cookies |
| NODE_ENV | Set production explicitly in the hosting environment before npm start |
| PORT | Hosting server port where supported by Next.js |
| NEXT_TELEMETRY_DISABLED | Optional value 1 disables Next.js telemetry |
| LOCAL_MIGRATION_PASSWORD, LOCAL_ORM_PASSWORD, LOCAL_RUNTIME_PASSWORD | Generated local Docker/provisioning secrets; never production configuration |
| M2_TEST_ENABLE, M2_TEST_DATABASE_URL, M2_TEST_APP_ORIGIN | Explicit disposable integration-test opt-in, database and HTTP origin; never point at real data |
| SYNTHETIC_ADMIN_PASSWORD | Local historical fixture secret, not an application default password |

No application configuration here needs NEXT_PUBLIC_ variables. Prefixing a value with NEXT_PUBLIC_ makes it browser-visible and freezes it into the client build; never expose database URLs, passwords, cookie secrets or Google client secrets that way. APP_ORIGIN and the Google client ID are not confidential, but are read by server code.

The dev/start wrapper validates ORM_DATABASE_URL **before** Next.js starts. Existing process environment values win. Only when the runtime URL is absent and NODE_ENV is not production does the wrapper load missing values from .verification/m2.env, and that file must point at a loopback database. An invalid injected URL is rejected rather than silently replaced. With NODE_ENV=production the wrapper never consults that local file: inject configuration through the host's environment/secret manager before starting. Merely creating .env.local may not satisfy wrapper validation.

The Prisma CLI has separate behavior: prisma7.config.ts loads .verification/m2.env if DATABASE_URL is missing and the file exists, preserving existing environment values. Its connection precedence is MIGRATION_DATABASE_URL, DIRECT_URL, DATABASE_URL. Clean deployment workspaces must exclude local .verification files. The CLI adds schema=lab to loopback migration URLs without an explicit schema. Check the target and schema before every migration; the runtime connection is not the migration owner.

### Google student registration

Create a Google OAuth web client for the intended environment. Register APP_ORIGIN/api/google/callback as the exact redirect URI, including scheme, hostname and port. Inject all three GOOGLE_OAUTH_* values and restart the server. Keep development and production credentials separate. The flow uses state, PKCE, nonce and verified ID-token checks. Google verifies account ownership; it does not prove university enrollment. New students must complete the application's registration/reference requirements. Do not grant staff privileges from Google claims. End-to-end sign-in still requires verification against the actual configured Google project.

## Production and Supabase

Deploy the Next.js server to a Node.js 24 capable host, with PostgreSQL 16 or a separately validated managed PostgreSQL service. GitHub source hosting alone does not deploy the application. Use HTTPS, a canonical APP_ORIGIN and a reverse proxy that preserves the intended origin and cookies.

1. Create separate staging and production databases. Verify network access, provider-required TLS, schema selection and connection limits.
2. Configure the migration-owner direct or session-pooled URL in the release environment. A transaction pooler is for application queries, not schema migration.
3. Migrations create lab_orm without login credentials if missing. A database administrator must securely enable its login and assign an independently generated password. Do not grant SUPERUSER, BYPASSRLS, ownership or broad table privileges. Supabase transaction pooling may require the lab_orm.PROJECT_REF username; use the project's actual connection settings.
4. Validate clean migration deployment and existing-data upgrade in staging, including grants and integrity triggers. Preserve historical SQL migrations and existing functions; runtime removal of business RPC calls does not authorize destructive database cleanup.
5. Back up existing data and prove restore works before release. Provide runtime secrets separately from release-owner credentials.

```powershell
npm ci
npm run prisma:validate
npm run typecheck
npm run lint
npm test
npm run prisma:readiness:enforce
npm run prisma:deploy
npm run prisma:status
npm run build
npm start
```

Run migration commands only in the authorized release environment against the checked target. prisma:deploy enforces native-service readiness and runs prisma migrate deploy; it does not seed users or apply db push. Build generates the client and compiles Next.js. Inject NODE_ENV=production and ORM_DATABASE_URL before npm start. Do not give the running web server owner credentials.

For existing legacy installations, scripts/prisma-migrations.mjs contains guarded baseline reconciliation; it is not a general cloud upgrade command. Marking 0_init applied is valid only after checking that the existing schema matches the baseline. Never replay baseline table creation onto populated production data. Obtain a reviewed migration plan for that installation.

Never use migrate reset, Docker volume removal, local reset helpers, legacy bootstrap or synthetic fixtures on shared/staging/production data. A failed migration needs diagnosis and an explicit recovery plan, not a blind reset. Roll back application artifacts only when the prior version is compatible with the new schema; database rollback requires a reviewed forward correction or restore plan.

## Backup, recovery and operations

Use managed backups/point-in-time recovery where available, with retention, encryption and access controls owned by the operator. Take a logical custom-format backup with pg_dump using a secure libpq service/password file or provider facility; do not paste passwords into URLs or command history. Example, after configuring secure local libpq service entries outside the repository:

```powershell
pg_dump --dbname="service=lab_backup" --format=custom --file="lab-backup.dump"
pg_restore --list "lab-backup.dump"
pg_restore --dbname="service=lab_restore_disposable" --no-owner --exit-on-error "lab-backup.dump"
```

The restore target must be a new isolated database, never the live database. Restrict and encrypt backups; store them outside the repository. Logical dumps do not provision cluster roles/passwords: restore required roles and grants through a reviewed administration procedure. Check row counts, migration state, ledger balance, role permissions and representative workflows on the restored copy. Restoring a local Docker backup does not prove Supabase point-in-time recovery works. Record recovery time and recovery point objectives and rehearse the provider-specific procedure.

Monitor sanitized server errors, DB_TRANSACTION_FAILED metadata, connection saturation, 5xx rates, login denials, rate limits, overdue loans and backup failures. Never log credentials, session cookies, password hashes or full sensitive request bodies. Reconcile inventory ledger/projections and audit retention through approved operational checks. Stopping the web process does not stop PostgreSQL or remove stored data.

## Verification

Fast repository checks do not require account provisioning or database writes:

```powershell
npm run prisma:validate
npm run typecheck
npm run lint
npm test
npm run prisma:readiness:enforce
```

npm test uses Node's built-in test runner on tests/*.test.mjs. It does not automatically run *.integration.mjs. Some .test.mjs HTTP checks are explicitly gated and may skip without integration configuration; inspect pass/skip totals. Current tooling is Node test, not a configured Vitest or Playwright suite. npm run build is a separate production compilation check; do not run it concurrently with a dev server sharing .next.

npm run db:verify checks native migrations, schema and restricted grants against the configured local database. It is not a substitute for functional integration testing. Explicit legacy commands db:setup:legacy, db:migrate:legacy and db:verify:legacy exist for isolated compatibility testing only, not new production provisioning.

For approved disposable HTTP regression, inspect and run:

```powershell
node scripts/qa-disposable-http.mjs
```

This creates its own synthetic PostgreSQL 16 Docker instance, deploys migrations, provisions an ephemeral ORM password, builds and starts its own app on port 3000, then runs native lifecycle, admin/report and identified-asset reuse HTTP suites. Stop existing application processes first; never stop someone else's process automatically. It writes ignored .verification evidence and stops its owned container; inspect Docker resources afterward. It requires explicit authorization for Docker/database writes and must never be retargeted to existing data.

Other integration suites require M2_TEST_ENABLE=synthetic-only, a loopback M2_TEST_DATABASE_URL named lab_m2_test_*, and a loopback M2_TEST_APP_ORIGIN. Each suite's setup requirements differ; read its guard and CI workflow before running it. Tests mutate synthetic data. Never use real student identities or production credentials.

CI workflows under .github/workflows cover migration/schema baselines, Prisma readiness, native grants and clean HTTP lifecycle on disposable databases. Check each workflow's branch/path filters: several currently target prisma, so a new production branch does not automatically inherit every push check. Review the actual run results for the release commit.

### Release acceptance checklist

- Clean install, schema validation, typecheck, lint, unit/contract tests, readiness scan and production build pass.
- Fresh migration deployment, existing-data upgrade, migration status and schema drift review pass in staging.
- Restricted role privileges, TLS/pooling and canonical HTTPS origin verified on the actual host.
- All four roles pass login/session expiry/logout, permission denials and self-approval/self-handover restrictions.
- Whole-request approval, stock reservation, concurrent commands/replays, serial custody, return/inspection, maintenance, extension and cancellation pass.
- Ledger balances, quantities and immutable history remain correct; no synthetic business records remain in the intended release database.
- Google sign-in/registration, responsive keyboard workflows and accessibility reviewed in the target deployment.
- Backup restore, rollback compatibility, monitoring and responsible operators confirmed.

Passing local tests is not a production security audit. Actual Supabase staging, external Google sign-in, production hosting, load/concurrency limits, accessibility conformance and disaster recovery remain unverified until tested in their intended environments. The README itself does not certify a database's current four-account state.

## Troubleshooting

| Symptom | Checks and resolution |
| --- | --- |
| Startup rejects database configuration | Inject a valid lab_orm ORM_DATABASE_URL before invoking start; check NODE_ENV and local config existence. Never substitute an owner URL. |
| 503 / DB_TRANSACTION_FAILED | Check sanitized server error code, database availability, migration status, role/column privileges and pool saturation. A loaded login page alone does not prove authenticated DB reads work. |
| 303 after login or protected navigation | Inspect Location and session cookie. Redirects can be normal authentication routing; repeated redirects suggest missing/expired cookie or role access. Use one hostname throughout. |
| Origin denied / localhost versus 127.0.0.1 | Match browser URL and APP_ORIGIN exactly, including port. Re-login after changing host; cookies belong to their original host. |
| Session cookie absent in production | Confirm HTTPS and Secure-cookie delivery through the proxy. Do not disable Secure flags to work around an HTTP deployment. |
| Google configuration or callback failure | Check three OAuth variables, minimum cookie-secret length, exact registered redirect URI, HTTPS in production and expiry of flow cookies. |
| Hydration warning | Inspect the browser error and component, reproduce without extensions, and check server/client rendering differences. Stop the owning dev server before rebuilding stale .next output; do not suppress warnings globally. |
| 429 / admission denied | Respect the response and allow the configured admission window to recover; investigate repeated submissions. Do not disable rate limits or replay requests rapidly. |
| Migration permission/history error | Confirm the owner connection and schema; inspect prisma:status. Do not run reset or mark migrations applied without validating their effects. |
| Port 3000 or 55239 occupied | Identify the owning process/container and coordinate its shutdown or configure a consistent alternative port/origin. Do not kill unrelated work. |
| local:config says configuration exists | Preserve existing credentials. Check the ignored file locally; do not print or commit its contents. |

## Command reference

package.json is authoritative. Runtime/local commands: local:config, db:up, db:down, db:setup, db:migrate, db:verify, db:shell, dev, build, start. Quality commands: lint, typecheck, test. Prisma commands: prisma:generate, prisma:validate, prisma:introspect, prisma:format, prisma:deploy, prisma:status, prisma:diff, prisma:readiness, prisma:readiness:enforce. Legacy commands are for dedicated compatibility fixtures only. There is no assumed npm reset or production seed command. Preserve the lockfile and use npm ci for reproducible installations.
