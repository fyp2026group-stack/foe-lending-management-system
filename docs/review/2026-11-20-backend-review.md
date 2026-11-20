# Backend review — 20 November 2026

Scope: native lending reservations, physical handover, inventory ledger, and associated Prisma migration privileges. No commit, production connection, deployment, package installation, or data deletion performed.

## Confirmed fixes

- High: native reservation selected only anonymous AVAILABLE stock. Returned/inspected equipment retains an asset identity, so it could never be reserved for another request. Reservation now combines anonymous and identified stock, prefers anonymous units, and records specific reservation claims atomically with allocations and balanced movements.
- High: native handover did not consume identified reservation claims. It now selects only its allocation's named RESERVED cells, releases the claim on issue, and prevents an allocation holding exclusively named stock from exchanging another allocation's pooled reservation for an AVAILABLE asset.
- Added migration `20261120010000_native_identified_reservations` grants only INSERT on the four claim columns. Existing SELECT and UPDATE(released) privileges remain sufficient for handover/cancellation. Apply through the normal migration process before exercising identified native reservations.

## Files

- `src/lib/server/services/lending-reservations.ts`
- `src/lib/server/services/lending-handovers.ts`
- `prisma/migrations/20261120010000_native_identified_reservations/migration.sql`
- `tests/prisma-identified-reservations.test.mjs`

All paths are relative to `C:\Projects\LabInventorySystem`.

## Verification

- `node --test tests/prisma-identified-reservations.test.mjs tests/prisma-request-gate.test.mjs`: 13 passed, 0 failed. Real service functions execute with injected transaction dependencies. Covers identified and mixed stock, pending approvals, claim ownership/release, insufficient combined stock, command replay/payload conflicts, and approval policy validation.
- `node node_modules/typescript/bin/tsc --noEmit`: passed.
- Focused ESLint on the two changed services and new test: passed.
- Focused diff whitespace check: passed.
- Configured disposable loopback test database connection failed, including an approved check outside the sandbox. No live database tests or migrations were run.

## Review findings and remaining limits

Existing reservation and handover both check the complete request's line-level immutable approval decisions before stock writes. Existing stock writers serialize using the same inventory/lending advisory locks, and ledger debits additionally require sufficient quantity in the UPDATE predicate. Command replay and result recording occur inside the write transaction. Cancellation already releases named claims before pooled units.

PostgreSQL migration application, restricted-role INSERT permission, deferred ledger triggers, cancellation after mixed reservation, and concurrent competing requests remain unverified in a real database. The dependency-injected tests do not prove PostgreSQL transaction rollback, privilege enforcement, or concurrency. Run the guarded database/HTTP lifecycle suite against a disposable database when available.

Other teammates have concurrent edits in the shared tree; those files were preserved and are outside this report's ownership.
