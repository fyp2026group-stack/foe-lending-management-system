# B07 — Synthetic test design and QA findings

Status: NOT RUN. Lab QA Engineer performed a supplied-summary-only design pass; original files not inspected, no tools/files/commands/tests/network used. Orbit curated and corrected T04 (anonymous stock conversion, not anonymous web access) and the returnable custody equation (not transfer reconciliation). No design or implementation acceptance claimed. C01–C17 technical baseline accepted subject validation; all P01–P21/PR22–PR27 deferred; affected behavior blocked. B05 execution remains blocked.

## Fixtures and oracle

Deterministic invented IDs/seed, labs A/B, two academic cohorts, four roles plus multi-role person, selected/assigned/actual approvers, substitute grants, active/expired/revoked/cross-lab assignments and disabled borrowers. No real identities. Stock fixtures include10 anonymous returnables, identified assets qty1, consumables/stock lots distinct from academic cohorts, every disjoint pool, zero/final stock, NULL bucket dimensions, valid integer boundaries and invalid zero/negative/fractional inputs.

Requests cover immutable revisions/terms, none/lecturer/HOD/both policies as explicitly conditional fixture branches; partial issue/return/cancel; expiry boundaries; damaged/lost transit; inspection/loss/recovery/extensions; independent message authors/restricted versions; durable event IDs distinct from transport keys/cache lifetime. Fixture policy branches are invented test inputs, not accepted institutional configuration.

Per-item/ownership-lab oracle:

`opening + external receipts + net approved adjustments + received inbound ownership - received outbound ownership = available + reserved + borrowed + inspection + maintenance + source-owned transit + lost + retired + consumed`

Available excludes reserved, all pools disjoint/nonnegative. Source owns transit until receipt. Identity conversion debits anonymous and credits identified within same pool with zero receipt/adjustment. Department transfers net zero; dispatch alone credits no destination ownership.

Request oracle: `submitted = issued cumulative + cancelled unissued + rejected + remaining eligible/pending`; reservations subset eligible unissued. Returnable loan custody oracle: `issued = physically received + loss-resolved + outstanding`. This loan equation is NOT a shipment receipt equation. Shipment receipts+unresolved transit+approved transit-resolution dispositions must reconcile dispatch under the accepted PR24 design.

Verify ledger/projection agreement, single asset custody, composite FKs/null-safe buckets, immutable history, issue academic-cohort snapshot, atomic success audit and separate durable denial logging. Receipt is inspection/unavailable, not availability. Later inventory execution requires real PostgreSQL under production-equivalent grants; SQLite/mocks cannot prove locks/grants/transactions.

## Capability matrix

For every operation and response field vary role combinations, current/historical lab assignments, own/other borrower, selected/assigned/actual actor, person conflicts, revision/stage/terms, stock/custody/inspection state, active/disabled account, session/grant revocation, and read/write/decision/issue/return/report/export/replay/direct SQL entry point. Record allow/deny, redaction, effects and audit. No admin bypass. Handover requires current relevant-lab TO != borrower; self-return/disabled receipt remains PR22-blocked. No delegated borrowing/public catalogue.

## Traceability

All rows: M1 design only; later feature execution NOT RUN. SEC references are open design dependencies. Policy-dependent expected results stay BLOCKED until their branch is accepted.

| ID  | Expected scenario/oracle                                                                               | SEC dependency / later milestone |
| --- | ------------------------------------------------------------------------------------------------------ | -------------------------------- |
| T01 | Invalid/revoked/disabled session cannot initiate protected actions; logout revokes                     | 02/06; M2                        |
| T02 | Every protected action/field has role x own/other x lab x revoked allow/deny cases                     | 01/04; M2+                       |
| T03 | If OIDC chosen, invalid/replayed issuer/audience/state/nonce/PKCE denied; no role elevation            | 02; M2                           |
| T04 | 10 anonymous units -> identify/issue2 -> return1: total10, stable IDs/optional serial/history          | 03/04/05; M3/M5                  |
| T05 | 1 final unit/20 contenders: exactly1 winning allocation, no negative/duplicate custody                 | 03/04; M3/M4                     |
| T06 | Transfer/partial receipt/import crash+retry balances both labs, no early destination credit            | 03–07; M3                        |
| T07 | Mixed none/lecturer/HOD/both lines snapshot correct explicit policy/revision/stages                    | 01/05/08; M4                     |
| T08 | Multi-role borrower cannot self-approve/issue or bypass missing substitute                             | 01/05; M4/M5                     |
| T09 | Approval creates0 loans; independent physical handover posts exactly once                              | 01/03/05/06; M5                  |
| T10 | Partial issue/cancel/expiry affects only eligible unissued remainder and conserves totals              | 03/05/06; M4/M5                  |
| T11 | Partial/damaged/duplicate receipt/loss/recovery/extension preserves custody/terms                      | 03/05/07; M5                     |
| T12 | Author-only append correction; spoofed predecessor/direct runtime UPDATE/DELETE/TRUNCATE denied        | 01/04/09; M2                     |
| T13 | Restricted body/history/count/export denied; separate durable privileged audit                         | 01/07/09; M2+                    |
| T14 | Scoped filters/cohort snapshots/actor attribution/pagination/export totals match oracle; formulas safe | 01/08/09; M6                     |
| T15 | Injection/XSS/CSRF/SSRF/mass assignment/rate boundaries and ASVS evidence                              | 01–09; M2–M7                     |
| T16 | Four core flows responsive/keyboard/screen reader with equivalent authorized actions                   | 01/08/09; M4–M7                  |
| T17 | Agreed workload/hardware thresholds, latency/error denominator and invariant checks                    | 03/08; M7                        |
| T18 | Isolated backup restore reconciles ledger/identity/grants against approved RPO/RTO                     | 04/07; M7                        |
| T19 | No protected SW cache, offline mutations refused, logout/revocation privacy                            | 02/06/09; M2–M7                  |
| A01 | Proposed distinct dual-stage actor rule denies same second actor, valid substitute branch              | 01/05; M4                        |
| A02 | Quantity/date revision after approval retains old decisions, invalidates their reuse                   | 03/05; M4                        |
| A03 | Partial/damaged/lost transit reconciles ownership/dispositions                                         | 03–07; M3                        |
| A04 | New transport key/cache expiry/lost commit response cannot duplicate same event                        | 02/06; M3–M5                     |
| A05 | At expiry issue loses; simultaneous partial issue/cancel conserves remainder                           | 03/05/06; M4/M5                  |
| A06 | NULL bucket/cross-table custody/direct SQL cannot bypass invariants                                    | 03/04/05; M3                     |
| A07 | Revoked grants deny new decisions; PR22 disabled-borrower recovery/substitute branch explicit          | 01/02/05; M2/M5                  |
| A08 | Separate authors reply; cannot correct others; counts/history/export visibility preserved              | 01/09; M2                        |
| A09 | No self-extension; immutable old/new dates; loss/recovery closes once                                  | 01/03/05; M5                     |
| A10 | Selected/assigned/actual lecturer, issue/return TO and historic cohort/scope distinguished             | 01/05/07; M6                     |
| A11 | Trusted bootstrap/linking/recovery, no self-elevation or client-role grants                            | 01/02/04; M2                     |
| A12 | Revoked download/cache, audit outages and bounded XLSX/parser expansion fail safely                    | 06–09; M3/M6/M7                  |

## Later authorized procedures

Record initial state/seed, versions, isolation/grants, actors/session, lock order and deterministic barriers. Race final-unit contenders and issue/expiry/cancel; race revision/approval/revocation/handover. Inject faults before and between ledger/projection/audit writes, at commit and postcommit/pre-response. Retry original event with same/new transport keys, changed payload and expired response cache; recheck replay access. Recover unknown outcome via original durable event, never second physical handover. Exercise transfer partial receipt/loss/import duplication and restore across both labs. Audit/inspection-service failure semantics require agreed contracts; no implicit bypass.

UI planned checks:360/768/1280,200%zoom/400%reflow, keyboard/screen reader, logical focus/dialog restore, linked field errors, status text/icons/contrast and44px design target. Every flow covers loading/empty/filtered/denied/validation409/session/offline/unknown/success. Optional serial/permanent internal ID, consumables no due/return, restricted notes omitted. WCAG2.2AA assessment pending; a design target does not prove conformance.

## Evidence record and QA gaps

Evidence ID; T/A and exact requirement/ASVS version; contract revision/policy branch; commit/environment/PostgreSQL/grants; fixture seed; actor/scope/session; preconditions; steps/barriers/fault; expected oracle; actual sanitized output/artifact; request/business-event/transport IDs; outcome; defect/severity/owner; independent reviewer/time. Outcomes NOT RUN/BLOCKED/PASS/FAIL/INCONCLUSIVE. PASS requires execution, not text inspection. Exclude credentials/real data.

QA acceptance blockers: SEC01–07 access/revocation/locks/grants/terms/replay/audit contracts incomplete; full OpenAPI missing; SEC08–09 bounds/DTO/cache/CSP incomplete. ASVS5.0.0 per-control assessment pending, V1.2.10 required additionalL3. Capacity/latency/recovery numbers remain proposals until approved. B05 requires verified restricted execution plus actual checks. No release recommendation or M1 completion supported yet.
