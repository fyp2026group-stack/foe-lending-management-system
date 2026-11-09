# Security architecture and test review

## Assessment

Retain default-deny service/query authorization, revocable server sessions with current grants, plain-text comments, separate immutable audit, controlled SQL writes, migration/runtime/reporting/backup role separation, public-static-only PWA caching and synthetic staging tests. Phase 1 documents 04/09/10/13 consistently describe a target design, not implemented assurance.

Remaining design gaps: session expiry/bootstrap and account linking; races with privilege revocation; controlled actor identity passed to SQL; restricted report connections/views; direct runtime writes around protected functions; denied-action log durability and failure behavior; export revocation/cache behavior; parser/resource budgets; and privacy erasure versus historical evidence. Address C06–C08/C12/C15/C16 and the policy register before affected features.

The runtime role must not be able to change stock, custody, immutable records or grants outside the reviewed command pathway. Specify SQL function owner, fixed search_path, PUBLIC execute revocation, non-owning app role and transaction-local actor context validation. App compromise remains a trust-boundary risk even with these protections. Reporting credentials alone must not become an unscoped bypass; select scoped queries/views and audit exports. Verify authorization in a transaction with a documented revocation ordering rule, not only at the start of an HTTP request.

Successful business audit belongs in the same transaction as the mutation. Denied attempts use a separate safe durable channel; define how audit-write failure affects protected mutations (recommend fail closed) and logging outages/DoS protection. Do not log raw tokens, comments, export contents or sensitive query parameters. Authenticated responses/exports need an explicit private/no-store policy where appropriate; test browser history/back navigation, service-worker caches and sign-out. Offline UI cannot revoke bytes already seen by an authorized user; minimize retained data rather than promise retroactive secrecy.

## ASVS supporting-file validation

The entire CSV was parsed and structurally inspected. On 2026-11-08 the pinned [official ASVS 5.0.0 JSON](https://raw.githubusercontent.com/OWASP/ASVS/v5.0.0/5.0/docs_en/OWASP_Application_Security_Verification_Standard_5.0.0_en.json) was retrieved and compared to every register ID and level. Results are recorded in asvs-validation.json; this verifies register provenance/structure, not individual applicability or implementation.

| Check | Observed result |
|---|---|
| Original package | 14 numbered Markdown documents + README + 2 ASVS files = 17 files |
| Official requirements / CSV rows | 345 / 345 |
| Duplicate register IDs / ID set differences / level differences | 0 / 0 / 0 |
| Official UTF-8 source hash | bcdbec214d70abcfad9284a31d4f9e5134305831d628aad3aa85d7e26626cb35; matches supplied metadata |
| Candidate applicable | 201 (57 L1, 144 L2) |
| Conditional | 56 (13 L1, 32 L2, 11 L3) |
| Additional risk review | 76 (L3) |
| Provisional N/A | 12 WebRTC (7 L2, 5 L3) |
| Evidence state | All 345 Not tested; implementation/test Pending; reviewer Unassigned |

Keep the pinned 5.0.0 baseline unless an approved ADR changes it. The register's chapter-wide feature flags are an inventory, not a completed applicability assessment. Imports are already in scope, so evaluate file-upload/parser controls individually. OIDC client use does not imply operating an OAuth authorization server. Opaque app sessions do not automatically require self-contained token controls, though IdP tokens still require validation. No WebRTC supports provisional N/A, subject to independent confirmation. Plain-text-only input may justify excluding rich-text controls, with explicit rationale rather than blanket acceptance.

Select V1.2.10 (spreadsheet formula protection) as applicable project-required additional L3: REP-03 and T14/T15 already require it. Its current “Additional risk review” classification must not postpone an existing SRS obligation. Other L3 requirements need documented risk choices, not automatic exclusion or automatic adoption. Each eventual applicable row needs exact requirement/version, feature rationale, implementation location, test evidence and independent reviewer/result. This review has not changed or marked passed any original row.

## Additional acceptance scenarios

| Proposed scenario | Requirement / finding | Expected evidence |
|---|---|---|
| A01 Dual-capability nonborrower approves both stages | REQ-03, C03, T08 | Second stage denied if distinct-person rule accepted; valid substitute succeeds |
| A02 Quantity/date revision after lecturer approval | REQ-02/05, C02/C04/C05, T07/T10 | New revision, retained old decisions, no stale-stage reuse |
| A03 Partial transfer/damaged receipt/lost transit | INV-04, C01/C07, T06 | Both lab equations + department ledger reconcile; no destination credit before receipt |
| A04 New transport key, cache expiry, lost response after commit | REQ-04/LOAN-01, C08, T06/T09/T11 | Same business-event ID yields one physical posting; conflicting reuse denied |
| A05 Reservation issue exactly at expiry and partial issue+cancel race | REQ-05, C10, T05/T10 | DB-time boundary deterministic; issued+cancelled+remainder conserved |
| A06 NULL bucket keys/cross-table asset allocation/direct SQL abuse | INV-02/04, C06, T04/T05/T15 | No duplicate bucket, double custody or runtime bypass |
| A07 Revoked grants/disabled borrower receipt/missing substitute | AUTH-01/02, C07/C12, T01/T02/T08 | New decisions denied; officer can recover existing custody under accepted policy |
| A08 Two authors reply/correct, restricted count/history/export | COM-01/02, C14, T12/T13 | Independent message chains, no impersonation or visibility leak |
| A09 Extension/self-approval/loss then recovery | LOAN-01, C04/C09, T11 | Immutable approved terms, no double resolution, recovered unit enters inspection |
| A10 Selected/assigned/actual lecturer; batch/lab assignment changes | REP-01/02, C13, T14 | Agreed metric definitions and historical scope reconcile across UI/export |
| A11 Privilege-grant escalation and bootstrap/recovery | AUTH-03/04, C12, T02/T03 | No self elevation, account link hijack or unreviewed administrator creation |
| A12 Private response/download cache, audit failure and parser limits | SEC/PRIV, C16, T15/T19 | No protected SW cache; fail-safe audit; bounded ZIP expansion/memory/rows/time |

Use existing T01–T19 plus these additions in traceability, not a replacement test strategy. Inventory tests use real PostgreSQL under production-equivalent grants, generated movement sequences, concurrency and crash injection. Distinguish response replay from two legitimate physical returns; event identity cannot be inferred only from equal quantities or timestamps. Performance results need approved hardware, workload mix, latency boundary and denominator; restore needs actor/ledger and access reconciliation. No test execution is claimed at planning time.

## Approval and assurance gates

M1: classify selected features, write testable contracts and establish reviewer independence. M2–M5: run authorization, DB-integrity and workflow evidence as features land. M6: scoped report/export and accessibility evidence. M7: complete applicable ASVS evidence, independent abuse/retest, load and restore rehearsal, UAT and risk acceptance. No unresolved critical/high findings at release; lower findings have owners/mitigations and explicit acceptance. No external scanner, live SSO, production penetration test or deployment is authorized by this review.
