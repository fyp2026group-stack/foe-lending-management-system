# Proposed project directory (not created)

```text
lab-lending/
  src/
    app/                    # route/page adapters; Frontend owns UI
      (auth)/
      (workspace)/
      api/v1/               # thin HTTP adapters; Backend owns
    components/             # shared accessible UI; Frontend
    modules/                # Backend-owned domain boundaries
      identity/
      catalogue/
      inventory/
      requests/
      lending/
      comments/
      reporting/
      audit/
        domain/             # entities/policies/state transitions
        application/        # authorized use cases, DTO contracts
        infrastructure/     # DB adapter and controlled SQL calls
    server/                 # session, DB, rate limit, safe logging
    shared/                 # reviewed public types/utilities only
  prisma/
    schema.prisma
    migrations/             # generated + handwritten reviewed SQL
    synthetic-seed/
  tests/
    unit/
    integration/
    authorization/
    concurrency/
    e2e/
    accessibility/
    performance/
  docs/
    phase-1/
    adr/
    api/
    security/
    operations/
  public/                   # public static assets, no private uploads
  deploy/                   # reviewed Docker/config templates, no secrets
  package.json
  lockfile                  # actual manager chosen at M1
  README.md
```

Each domain module follows domain/application/infrastructure shape (illustrated under audit); UI components cannot import infrastructure. Shared types are data contracts, never a route to server secrets. QA owns tests; Security owns findings/verification records; Lead owns ADR/integration decisions. No application directories, package manifest or migration has been generated during Phase 1. Existing planning documents remain at their designated paths until an approved repository organization is selected; do not move unrelated files.
