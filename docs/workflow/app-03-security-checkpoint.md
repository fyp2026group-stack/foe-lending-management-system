# APP-03 security checkpoint

2026-11-09. Verdict: MUST FIX before lending security acceptance. Local integrated source and guarded loopback synthetic PostgreSQL only. No application code edits.

## Must fix

1. **High — removed approver authority remains effective.** `database/027_application_lending.sql:14` grants visibility by snapshotted lecturer/HOD ID without requiring current role or lecturer lab membership. Decision guards in `database/024_lending_authorization_order.sql:10` and `database/023_basic_lending.sql:43` likewise compare ID/stage without current academic authority. A rollback fixture created an assigned pending lecturer line, removed all lecturer lab assignments and the LECTURER role, retained only STUDENT, then called the public protected function as lab_runtime with a valid session. `read_requests` returned the request and `decisions` returned stage APPROVED. This also affects the shared visibility boundary for loans, comments and metrics. Require current role and relevant lab scope for assigned approver access/actions; preserve immutable historical attribution separately. Verify role removal, lab removal and HOD ADMIN removal independently, including existing sessions and replay.

2. **Medium — handover accepts a disabled borrower.** Issue guards in `database/024_lending_authorization_order.sql:11` and `database/023_basic_lending.sql:49` check the officer and self-handover but never borrower activation. A rollback fixture created and reserved a student's request, disabled the student, then issued as the assigned officer through lab_runtime. The function returned loanId, assetId and movementId. This violates `docs/workflow/api-contract.md:11` (borrower active). Recheck borrower activation atomically before new handover; deny without allocation, asset or ledger changes. Preserve legitimate receipt of already outstanding equipment.

## Checks and limits

- Inspected migrations 023–029, lending server adapter/API route, DTOs, request builder/options, workflow/actions, discussion and metrics components; read database adapter and inventory reconciliation migration.
- Database catalogue confirmed lending_call and v1/v2/v3 functions. Ran existing application-lending and lending-sources integration tests: 2 passed, 0 failed, 0 skipped, fresh exit 0. These cover narrow source DTO keys, lecturer eligibility at request creation, exact replay after lab reassignment, comments/corrections, unauthorized comment/reserve denial, loan status and selected metric filters. Both tests use rollback.
- Both additional exploit checks ran as lab_runtime for the protected calls, with owner-only synthetic fixture setup and confirmed ROLLBACK in finally. No credentials printed.
- Source supports parameterized DB calls, current actor session/role resolution, Origin/CSRF on writes, no-store API responses, assigned TO lab checks for issue/return, self approval/handover denial, append-only correction insertion with author/request checks and unique correction parent, serialized command replay, allocation bounds and ledger-backed moves. This is bounded evidence, not full acceptance.
- Backlog/contract reconciliation: returnable request cap 20 is frontend-only (DB allows 1000); history endpoint returns actor/admin audit across modules rather than lending-only; requestId is accepted by adapter but ignored by some read operations. Confirm intended ADMIN/global and historical approver scopes, request-level discussion visibility across multi-lab lines, and broader read DTO fields before production acceptance.
- No HTTP/browser, concurrent race suite, full inventory conservation suite, dependency/deployment review or production verification performed. No external systems, Git, dependency installs or delegation used. No comprehensive ASVS 5.0.0 compliance claim.

Next: fix the two authorization defects and add focused rollback regressions; independently re-review current-role/lab revocation and disabled-borrower handover.
