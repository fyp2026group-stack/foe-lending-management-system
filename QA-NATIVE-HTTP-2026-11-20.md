# Isolated native HTTP lifecycle QA — 20 November 2026

Final execution: **3 tests passed, 0 failed, 0 skipped**. These are three integration tests with many assertions. No production database or existing user database was accessed. No service code changed, commit, push, or deployment performed.

## Reproduce

Run `node scripts/qa-disposable-http.mjs` from `C:\Projects\LabInventorySystem` with Docker available. Requires installed project dependencies. The runner creates a unique PostgreSQL 16 container with randomly generated private credentials, an automatically assigned loopback database port, a uniquely named `lab_m2_test_*` database, and tmpfs storage. It deploys all Prisma migrations, provisions `lab_orm` login, generates Prisma Client, builds the production application, starts a loopback HTTP server on port 3000, and executes all three native HTTP tests. Port 3000 must be free. It stops its own HTTP server and container in cleanup; stopped containers are retained, with ephemeral database contents discarded on stop. It never removes existing containers or volumes.

## Evidence

Final evidence directory: `C:\Projects\LabInventorySystem\.verification\lab-qa-1795166540529`.

- `commands.json`: exact commands with credentials redacted and exit codes, all zero.
- `2.log`: migration deployment, including `20261120010000_native_identified_reservations`.
- `3.log`: migration status confirms database up to date.
- `roles.json`: `lab_orm` and `lab_runtime` have no superuser, create-database, or create-role privileges.
- `5.log`: production application build.
- `6.log`: real HTTP results, 3 passed, 0 failed.
- `server.log`: owned application server log.

Application requests use the separate `ORM_DATABASE_URL` with `lab_orm`, while fixture setup and independent assertions use the disposable administrator connection. Grants come from the full migration chain, with only login/password provisioned separately. Successful runtime mutations demonstrate the migrated grants permit the exercised operations; this is not an exhaustive privilege audit.

Executed commands are recorded in the manifest. Principal commands:

```text
node node_modules/prisma/build/index.js migrate deploy --config prisma7.config.ts
node node_modules/prisma/build/index.js migrate status --config prisma7.config.ts
node node_modules/prisma/build/index.js generate --config prisma7.config.ts
node node_modules/next/dist/bin/next build
node --test --test-concurrency=1 tests/prisma-native-lifecycle-http.integration.mjs tests/prisma-native-admin-report-http.integration.mjs tests/prisma-native-reuse-http.integration.mjs
```

## Verified against real PostgreSQL and authenticated HTTP

| Area | Evidence/assertions |
| --- | --- |
| Request | Synthetic student submits two-line request; database contains both lines. All four roles authenticate. |
| Approval | Assigned lecturer then designated HOD/Admin approve. Student decision denied. NONE-policy line cannot bypass approval of the complete request. |
| Reservation | Approved request reserves both lines. Two competing approved requests race for one released unit: exactly one succeeds (200), one conflicts (409), reserved quantity remains one. |
| Handover | Assigned officer creates a physical loan; student, lecturer, and admin handover denied. Officer cannot issue their own approved/reserved request to themselves. |
| Return | Officer returns the physical item; repeating the identical command returns the identical result. Stock is in INSPECTION before clearance. |
| Inspection and clearance | Student, lecturer, admin denied inspection clearance. Officer clears inspection; database status is CLEAR_AVAILABLE and equipment returns to AVAILABLE. Clearance is an inspection outcome, not a separate endpoint. |
| Conservation | Each lifecycle movement for the physical item has two balanced ledger entries; final available quantity is one. Competing stock remains one. Independent approved adjustment increases the second item's total from one to three. |
| Cancellation | Borrower cancels an existing reservation, releasing stock for contention. Identical cancellation replay returns identical result. |
| Revisions | Lecturer rejects request; borrower creates revision draft and resubmits successfully; original line remains REJECTED. |
| Extensions | Borrower proposes extension and HOD/Admin approves. |
| Independent adjustments | Officer proposes ADD adjustment; officer approval denied; separate Admin approval succeeds. Dual-role officer/Admin cannot approve own proposal (403 SELF_APPROVAL). |
| Self approval | Lecturer cannot designate themselves as approving lecturer; HOD/Admin cannot submit a request naming themselves as required HOD (422). |
| Administration | Admin creates batch, lab, category, equipment; report JSON, CSV, XLSX succeed. Student administration and reporting denied. |
| Identified asset reuse | Approved competing request cannot reserve returned equipment while quarantined. After clearance exactly one racing request reserves the same identified asset. Handover preserves asset identity and releases named claim; replay creates only one loan. Second return and clearance conserve exactly one available unit; clearance replay preserves domain result. Losing request then reserves that asset and cancels: named claim releases and exactly one unit is available. All associated ledger movements remain balanced. |

## Three-test follow-up and CI integration

All 57 migrations applied successfully on the final fresh database, including identified reservations; migration status reports up to date. Initial three-test run (`.verification/lab-qa-1795165938331`) had 2 passes and 1 failure: clearance replay compared request-specific `correlationId` values. Corrected only the test to exclude that HTTP metadata while retaining HTTP 200 and full domain-result comparison. Final fresh run passed all three tests. No service fix was required.

Both the local runner and `.github/workflows/prisma-clean-http.yml` now explicitly run all three test files. Workflow push filters include each test file, the shared guard, and the local runner, in addition to existing source/migration/workflow paths. CI was updated locally; no remote CI execution or push occurred. Targeted ESLint completed with zero errors and two unused-variable warnings for the deliberately excluded correlation ID bindings. `git diff --check` passed.

## Limits

No failures observed in executed scenarios. This does not certify every endpoint/role combination. No exhaustive cross-laboratory access matrix, multi-role lending approval fixture bypassing submission validation, stale-version matrix, changed-payload replay matrix, concurrent adjustment/reservation race, partial-quantity lifecycle, rejected extension, overdue workflow, maintenance branch, browser accessibility, or performance testing was executed in this assignment. The competing reservation fixture uses the same borrower with separate approved requests. The complete physical lifecycle uses one item, while a second request line remains reserved. No claim is made that all lines of that request reached clearance.

Regression edits: `tests/prisma-native-lifecycle-http.integration.mjs` and `tests/prisma-native-reuse-http.integration.mjs`. Reproduction infrastructure: `scripts/qa-disposable-http.mjs` and `.github/workflows/prisma-clean-http.yml`. All saved without commit.
