# University Laboratory Inventory and Equipment Lending System

Local development stack:

- Next.js 16 and React 19
- TypeScript
- PostgreSQL 15 in Docker
- Synthetic development accounts and records

This setup is local-only. Never connect it to real university data or reuse its generated credentials elsewhere.

## Prerequisites

Install:

- Node.js 24.x
- npm
- Docker Desktop
- Git

Open Command Prompt or PowerShell in the project folder:

```bat
cd C:\Projects\LabInventorySystem
```

## First-time setup — run in this order

### 1. Install dependencies

```bat
npm ci
```

### 2. Generate local credentials and configuration

```bat
npm run local:config
```

This creates `.verification/m2.env`. It contains local passwords and is ignored by Git. Do not share, print, or commit it.

Run this command only once. If it reports that configuration already exists, keep the existing file.

### 3. Start and completely prepare the database

Start Docker Desktop first, then run:

```bat
npm run db:setup
```

This single command performs the required database work in the correct order:

1. Starts PostgreSQL and waits until it is healthy.
2. Creates the restricted `lab_runtime` application role.
3. Applies every numbered migration.
4. Provisions the login verifier.
5. Seeds the synthetic users, laboratory, equipment, location, and stock.
6. Verifies connectivity and restricted runtime permissions.

It is safe to run `npm run db:setup` again. Applied migrations and existing seed records are preserved.

### 4. Start the web application

```bat
npm run dev
```

Open:

```text
http://127.0.0.1:3000/login
```

Keep the terminal running. Stop the web application with `Ctrl+C`.

## Synthetic login accounts

| Email                      | Role                           |
| -------------------------- | ------------------------------ |
| `admin@example.invalid`    | Administrator                  |
| `student@example.invalid`  | Student                        |
| `lecturer@example.invalid` | Lecturer                       |
| `officer@example.invalid`  | Technical Officer              |
| `multi@example.invalid`    | Lecturer and Technical Officer |

All synthetic accounts use `SYNTHETIC_ADMIN_PASSWORD` from `.verification/m2.env`. Read it only on your computer and never paste it into source control, documentation, screenshots, or chat.

## Normal daily startup

After the first-time setup, use:

```bat
npm run db:up
npm run dev
```

When finished:

1. Stop Next.js with `Ctrl+C`.
2. Stop PostgreSQL:

```bat
npm run db:down
```

The database volume is preserved, so the next start retains local data.

## Database commands

### Start PostgreSQL

```bat
npm run db:up
```

### Stop PostgreSQL without deleting data

```bat
npm run db:down
```

### Apply new migrations

```bat
npm run db:migrate
```

### Add any missing synthetic seed records

```bat
npm run db:seed
```

### Verify the local database and runtime restrictions

```bat
npm run db:verify
```

Expected result:

```text
Runtime verification passed: five fixtures, four roles, protected-table/DDL/audit access denied
```

### Open the PostgreSQL command line

```bat
npm run db:shell
```

Useful read-only commands inside `psql`:

```sql
\conninfo
\dn
\dt lab.*
SELECT name, digest FROM public.lab_migrations ORDER BY name;
SELECT email, display_name, disabled FROM lab.users ORDER BY email;
SELECT id, name FROM lab.laboratories ORDER BY name;
```

Exit with:

```text
\q
```

Do not manually insert, update, or delete operational records. Use migrations and application operations so authorization, stock accounting, version checks, idempotency, and immutable history remain valid.

## Connect using pgAdmin or DBeaver

| Setting                   | Value                                                |
| ------------------------- | ---------------------------------------------------- |
| Host                      | `127.0.0.1`                                          |
| Port                      | `55239`                                              |
| Database                  | `lab_m2_test_identity`                               |
| Application user          | `lab_runtime`                                        |
| Migration/inspection user | `lab_migration`                                      |
| Password                  | Matching local value in `.verification/m2.env`       |
| SSL                       | Disabled for this loopback-only development database |

Use `lab_runtime` to inspect the same restricted access used by the web application. Use `lab_migration` only for migrations and controlled local inspection.

## Verification commands

Run source checks:

```bat
npm run typecheck
npm run lint
npm test
```

Run database-backed integration groups:

```bat
node --env-file=.verification/m2.env --test tests/m2-run.integration.mjs
node --env-file=.verification/m2.env --test tests/m3-run.integration.mjs
node --env-file=.verification/m2.env --test tests/workflow-run.integration.mjs
```

Create a production build:

```bat
npm run build
```

Passing automated checks does not replace authenticated desktop/mobile visual, keyboard, and accessibility review.

## Run the production build locally

```bat
npm run build
npm run start
```

Open `http://127.0.0.1:3000`.

## Completely reset the synthetic database

This permanently deletes the local PostgreSQL volume and all local synthetic records. Preserve `.verification/m2.env` unless credentials also need to be replaced.

```bat
docker compose --env-file .verification/m2.env -f database/compose.yaml down --volumes
npm run db:setup
```

## Remove generated application files

These paths are generated and safe to recreate:

```bat
rmdir /s /q .next
rmdir /s /q .cache
del /q tsconfig.tsbuildinfo
```

Then reinstall or rebuild as needed:

```bat
npm ci
npm run build
```

Do not delete `.verification`, `database`, `docs`, `public`, `scripts`, `src`, or `tests` as cleanup.

## Troubleshooting

### Docker is not ready

Start Docker Desktop and wait for its engine before running `npm run db:setup` or `npm run db:up`.

### Port 55239 is already in use

Stop the conflicting service. The Docker port and every URL in `.verification/m2.env` must always match.

### Login returns `UNAVAILABLE`

Confirm `npm run db:setup` passed, stop any old Next.js process, and restart with `npm run dev`.

### Login says the email or password is incorrect

Use a seeded email and the `SYNTHETIC_ADMIN_PASSWORD` from the same `.verification/m2.env` that created the current database volume. Seeding does not overwrite existing users' passwords.

### `Applied migration changed`

Restore the edited applied migration. Put new schema work in a new numbered migration.

### `--env-file is not allowed in NODE_OPTIONS`

The repository commands no longer require a command-line `--env-file` flag for Next.js. Use `npm run dev`, `npm run build`, or `npm run start`.

## Project locations

- Phase 1 specifications: `docs/phase-1`
- Database/API evidence: `docs/m2`, `docs/m3`, and `docs/workflow`
- UI references: `docs/ui-reference`
- Migrations and Docker Compose: `database`
- Local command runner and utilities: `scripts`
- Application source: `src`
- Automated checks: `tests`
