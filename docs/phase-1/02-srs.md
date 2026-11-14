# Software Requirements Specification

## Purpose, boundary and actors

One university department, multiple laboratories, responsive browser application. Four roles: HOD/Administrator, Lecturer, Technical Officer (TO), Student. Every active role can borrow using the same borrower workflow. Administrative authority never grants automatic approval or handover of one's own request. Support multiple role memberships but evaluate conflicts by immutable person/user ID, across all roles.

In scope: identity, catalogue, quantities/assets, per-line approval, reservations, physical issue/return, consumables, comments, audit, dashboards and reports. Future: QR labels, external notifications, procurement/finance, interdepartmental tenancy, offline mutations. No university integrations or live data during planning.

## Functional requirements

| ID      | Requirement and observable result                                                                                                                                                           |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AUTH-01 | Login/logout; disabled users cannot initiate protected operations; logout invalidates server session.                                                                                       |
| AUTH-02 | Server verifies role, lab assignment, relationship and current state for each read/mutation/export; default deny.                                                                           |
| AUTH-03 | HOD/Admin manages users, role memberships, academic batches, unique student registration numbers and effective lecturer/TO lab assignments; record changes audited.                         |
| AUTH-04 | Support institutional OIDC SSO when approved/available; authentication identity cannot grant administrative roles from untrusted claims.                                                    |
| INV-01  | Catalogue includes name, category, returnable/consumable kind, unit of measure, active flag, location balances and versioned item/category approval policy.                                 |
| INV-02  | Multiple physical units and unidentified initial stock are supported; optional serial captured during handover, permanent unique internal asset ID for each identified unit.                |
| INV-03  | Available, reserved, borrowed, overdue, maintenance, lost and retired are represented where applicable; consumables use issued/consumed accounting without fictional returns.               |
| INV-04  | Controlled stock receipt/adjustment/transfer/import with reason, actor, timestamp and immutable movement history; negative and duplicate stock prohibited.                                  |
| REQ-01  | Every role drafts and submits multi-line requests with quantity, laboratory, purpose, proposed collection/due dates and eligible selected lecturer where required.                          |
| REQ-02  | Snapshot item-over-category policy per line: none, lecturer, HOD, both; capture actors, decisions, remarks and timestamps.                                                                  |
| REQ-03  | No self-approval, self-handover or unauthorized proxy; conflicts do not disappear through role switching or assignment changes.                                                             |
| REQ-04  | Approval does not issue equipment. Authorized TO confirms physical quantity/assets and borrower identity at handover in a transaction.                                                      |
| REQ-05  | Per-line partial decisions/fulfilment supported; header summarizes mixed states without losing individual outcomes.                                                                         |
| LOAN-01 | Partial returns, inspection/damage, late returns, lost items, overdue views and immutable borrower/asset history; extensions are approved changes, not edits to historical due dates.       |
| COM-01  | Relevant participants can append plain-text comments and linked correction versions; no ordinary edit/delete; every version stores author ID, role snapshot, time, content and predecessor. |
| COM-02  | Scope reads to record access and comment visibility; sensitive staff notes use explicit restricted threads. Separate audit for sensitive changes.                                           |
| REP-01  | HOD dashboard: availability, active borrowers/loans, pending/rejected requests, overdue/outstanding items and date-range trends.                                                            |
| REP-02  | Batch-, lab-, category-, lecturer- and TO-wise reports with authorized scope, date filters, search, sorting and pagination.                                                                 |
| REP-03  | CSV/XLSX exports honor the same scope/filters, minimize personal data and neutralize spreadsheet formulas.                                                                                  |

## Data and validation

Integer quantities in the selected whole-unit measure; decimals require a future approved design change. Positive requested/movement quantities, bounded remarks, canonical registration numbers, normalized optional serials. All timestamps UTC, display in configured university timezone (proposed Sri Lanka time); date ranges use local start inclusive/end exclusive conversion. Borrower batch is snapshotted at issue so later cohort edits cannot rewrite historical batch reports. Deactivation preserves history; record merging requires an audited procedure, never overwrite foreign keys casually.

## Nonfunctional acceptance targets (proposed)

SEC: applicable ASVS 5.0.0 L1/L2 baseline with evidence, no unresolved critical/high findings for release. ACCESS: WCAG 2.2 AA target, keyboard/screen reader checks; 360 px viewport and ordinary desktop supported. PERF: at proposed dataset 10,000 users, 50,000 assets, 1 million movements and 100 concurrent active users, p95 common reads <=2 seconds and mutations <=3 seconds excluding network/SSO, error rate <1% excluding deliberate validation conflicts. Measure on agreed deployment hardware before sign-off. REL: atomic inventory writes, idempotent retry, transaction consistency; provisional 99.5% monthly service objective. Recovery: proposed RPO 24h, RTO 8h, verified restore. PRIV: minimum fields, access logs and approved retention; no retention period asserted as law. MAINT: strict TypeScript, reproducible build, reviewed migrations and dependency lock. Exact capacity/SLA must be approved.

Traceability: AUTH→M1/M2; INV→M3; REQ→M4; LOAN→M5; COM→M2/M5; REP→M6; security/accessibility/performance/recovery→every milestone and M7. See testing document for measurable scenarios.
