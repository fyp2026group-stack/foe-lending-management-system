# Supabase + Prisma deployment status (migration in progress)

**Not ready to deploy to a real Supabase project.** The TypeScript backend
still invokes legacy PostgreSQL functions for identity, inventory, lending,
OAuth registration, reporting, and admin governance.

## Intended runtime

- Next.js on a server-hosting platform (for example Vercel), with GitHub CI/CD.
- Supabase PostgreSQL as the data store.
- Prisma 7 / `@prisma/adapter-pg` for server-side transactions.
- A dedicated least-privilege `lab_orm` role for native services, distinct
  from the existing `lab_runtime` role.
- A separate direct or session-pooled admin connection for migrations.
- Secrets configured only as hosting-platform environment variables.

The Supabase pooler uses a username suffix (`role.project-ref`).
The runtime and ORM URLs must reference the same database endpoint.
Never put privileged credentials in `NEXT_PUBLIC_*` variables.

## Verification gates

Run on a fresh local verification database, never production:

```sh
npm ci
npm run prisma:generate
npm run prisma:validate
npm run prisma:readiness
npm run typecheck
npm test
```

`npm run prisma:readiness:enforce` fails while SQL RPC calls remain.
`npm run prisma:deploy` uses that gate intentionally.

The existing `database/001_*.sql` through `053_*.sql` include business
functions, triggers, grants, and advanced invariants not fully represented
in Prisma's baseline migrations. Do NOT apply the baseline migration to an
existing Supabase database without a verified, non-destructive reconciliation.
Do NOT remove the function layer before all equivalent Prisma services and
database invariants are independently tested.

## Release acceptance criteria

1. Full Prisma schema and migration drift analysis against disposable DB.
2. Native Prisma authentication, session management, OAuth and admin APIs.
3. Native Prisma inventory, importing, balances and mutation accounting.
4. Native Prisma request creation, request-wide approvals, reservation, issue,
   handover, return, inspection, cancellation, and idempotent command replay.
5. Role isolation, CSRF and self-approval/self-handover rejection.
6. Concurrency tests for stock conservation and uniqueness.
7. Integration and production builds; GitHub CI green.
8. Supabase staging smoke tests with least-privilege database roles.
9. Only then production migration and deployment.

No migrations have been applied to Supabase as part of these repository edits.
