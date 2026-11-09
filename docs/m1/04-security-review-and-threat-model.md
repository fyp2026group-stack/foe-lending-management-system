# B07 — Independent summary-based Security review

Reviewer: Lab Security Reviewer, bot 3f682400-4f1a-4729-b8df-d7ce09e136b8. Received 2026-11-09. Recorded by Orbit.

Evidence: reviewer assessed Orbit's curated summary only; no direct reader was available and the four draft files were not inspected by the reviewer. No tools, commands, implementation tests, network access or changes occurred. Findings concern potential design impact, not confirmed exploitable vulnerabilities. Security acceptance remains blocked; no ASVS compliance verdict or implementation pass exists.

## Findings and closure criteria

All findings OPEN. Backend owns contract remediation; Orbit owns integration. Independent Security re-review is required. QA supplies future test design/evidence, not automatic security approval.

| ID / severity | Gap and required remediation | Acceptance criterion |
|---|---|---|
| SEC-01 High | Authorization coverage incomplete across command/query/export/report/comment operations and fields | AC-01: each operation names capability, lab, record/person predicates, visible fields, denial behavior and deferred policy guards; negative cross-lab/borrower/revoked/missing-policy cases; no blanket admin bypass |
| SEC-02 High | Identity/session/revocation flow incomplete | AC-02: reviewed issuer/client/callback/linking, session creation/rotation/idle and absolute expiry, cookie/CSRF defenses and in-flight revocation ordering; provider choice required before operational login, not before alternatives-only M1 design; fixtures never become login bypass |
| SEC-03 High | Global locks/isolation/competing transitions incomplete | AC-03: one global order across item/lab/allocation/asset/custody/revision/transfer/event guards; linearization points, DB-time boundary and bounded retry/deadlock handling; invariant reasoning for reserve/issue/cancel/expire/return/loss/recover/transfer/adjust/identify |
| SEC-04 High | Function/grant boundary and trusted actor context incomplete | AC-04: explicit principal/function matrix, owner, fixed search_path/qualified names, PUBLIC execute revocation, runtime no DDL/ownership/grant changes/direct protected writes, temporary-object exposure and pool reset; scoped reporting/backup separation; server-compromise residual risk |
| SEC-05 High | Approval/terms/custody transition binding incomplete | AC-05: each transition binds immutable revision/terms, person predicates and valid states; reject stale decisions, enforce cross-table custody/null-safe buckets; different-TO handover fixed; additional independence policy deferred; no delegated borrowing |
| SEC-06 High | Canonicalization, replay scope/retention and uncertain commit underspecified | AC-06: key scope, canonical payload/version/size, event relationship, durable tombstone retention, in-progress/recovery semantics and current disclosure authorization; changed reuse409 and no second event |
| SEC-07 High | Audit failure/durability/tamper/privacy rules incomplete | AC-07: atomic required success audit or rollback; independent denial durability/failure response; append/read grants and retention; actor/scope/event/revision/outcome/DB-time fields with sensitive-data minimization |
| SEC-08 Medium | OpenAPI/DTO/input and bulk-processing limits incomplete | AC-08: complete request/response/read schemas, unknown-field rejection, identifiers/integer/date/page/file/row/time/rate limits, staged import binding and scoped formula-neutralized export; parameterized queries/output encoding |
| SEC-09 Medium | Browser/cache/comment privacy incomplete | AC-09: explicit public-static service-worker allowlist, private no-store/logout/storage rules, CSP/encoding; independent authored messages/version chains; no foreign-author correction or visibility leakage |

All are contract acceptance blockers for their affected scope. They do not authorize operational feature implementation. Institutional parameter values and authority choices remain deferred; M1 may specify explicit alternatives/required configuration without inventing policy.

## Threat model

Protected assets: student identity/history, academic authority, custody and stock ownership/balances, sessions, immutable approvals/comments/audit. Academic cohorts and stock lots remain distinct.

| Actor / trust boundary | Abuse case | Required design response |
|---|---|---|
| Unauthenticated browser -> app | Forged requests/login confusion/private access | Reviewed auth flow, CSRF, private authorization; no assumption of anonymous catalogue access (SRS catalogue is active-user scope) |
| Student/staff -> other lab/record | BOLA/IDOR, escalation/self-dealing/data leak | Current capability + lab/record/person checks on all reads/writes |
| Authorized operator -> ledger/workflow | Duplicate issue, stale approval, repeated loss, transfer duplication | Immutable bindings, disjoint pools, single custody guard, serialized atomic events |
| Retrying/concurrent clients -> transaction | Replay/unknown commit/expiry races | Durable identity, defined hashes, consistent locks/isolation/DB-time predicates |
| Runtime -> DB | Actor spoofing, pool leakage, direct stock edits | Narrow grants/functions and explicit trusted-server limits |
| Reporting/export/cache -> recipient | Excess fields, cross-lab data, private offline copies | Scoped minimal DTOs/exports, cache restrictions; already seen bytes cannot be retroactively revoked |
| Privileged operator -> audit | Accountability suppression/tampering | Separate principals/durable append-only audit, restricted read/retention; superuser risk retained |

Reviewer mentioned a public-catalogue boundary; Orbit reconciliation: no new public catalogue is approved. Existing SRS grants catalogue to active users. Anonymous stock identity is an inventory representation, never an unauthenticated principal.

## ASVS and evidence plan

Pinned baseline ASVS 5.0.0, per-control applicability to selected features; exact requirement mappings were not verified in this review. Original CSV is provisional and untested. Spreadsheet V1.2.10 is required additional L3 by SRS/export requirements; verify exact standard wording and evidence before assigning a result. OIDC client is not an OAuth authorization server. No WebRTC is present; provisional exclusions require independent rationale. Local-password controls remain conditional on an explicit choice.

| Area | Design evidence | Later authorized proof |
|---|---|---|
| Auth/session | AC-02 lifecycle/flows | Synthetic issuer/callback, fixation, expiry/logout/revocation |
| Access control | AC-01/05 operation/field matrix | Role x lab x relationship allow/deny, replay/export |
| Validation/browser | AC-08/09 schemas/CSRF/cache | Injection/XSS/mass assignment/private-cache checks |
| Business integrity | AC-03/05/06 transaction/state contracts | Real PostgreSQL grants, adversarial interleavings, retries/uncertain commit |
| Protection/crypto | Secret/session lifecycle, minimum data | Safe config/secret-handling review without exposing values |
| Audit/errors | AC-07 failure matrix/schema | Rollback/durability/access/redaction/error tests |
| Configuration | Grant model/version inventory when authorized | Dependency/runtime/deployment/grant evidence |

Evidence record requires requirement/version, feature rationale, implementation reference, test/environment/seed/command/output, reviewer/result and finding disposition. Missing evidence remains pending. Review did not inspect dependencies, deployment, database grants or effective execution permissions. B05 permission gate remains blocked.
