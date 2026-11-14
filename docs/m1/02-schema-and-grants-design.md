# B03 — Schema, invariants and privilege design

Status: design draft; Security/QA review pending. Provenance: Backend excerpt-based design, curated by Orbit against previously read specifications. No executable schema/migration/database setup. Physical column dictionary, precise SQL enforcement and global lock order remain acceptance deliverables, not verified facts.

## Records and constraints

| Domain                 | Proposed records and design constraints                                                                                                                                                                                                                                                                                                                        |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Identity and scope     | Immutable person/user identity across roles and linked accounts; provider+subject unique; revocable hashed opaque sessions; scoped capabilities/assignments and append-only grant/revocation provenance. No admin self-conflict bypass. Separate person/account tables require reviewed justification; existing immutable user identity remains authoritative. |
| Academic cohorts       | Batch and membership history distinct from stock lot. Loan issue stores immutable borrower academic-batch snapshot.                                                                                                                                                                                                                                            |
| Catalogue and identity | Item kind/UOM immutable after ledger use; optional stock lot; permanent unique asset code for returnables by issue; optional manufacturer serial, deferred P11 normalization/collision semantics. Consumables have no per-unit asset, loan due date, return custody or overdue.                                                                                |
| Requests and approvals | RequestRevision and revision lines with predecessor and composite parent references; immutable policy snapshot, selected lecturer, assignments/decisions and approved terms bound to exact submission revision. Reassignment appends history; no stale approval reuse. Explicit policy required; missing policy never means none.                              |
| Inventory and custody  | Durable event and ledger entries; disjoint stock pools/projections; null-safe bucket uniqueness over item/lab/pool/lot/identity dimensions. One authoritative locked asset guard prevents conflicting allocations/loans across tables. Asset-backed line quantity one; anonymous identification debits and credits one unit in same pool.                      |
| Transfers              | Approved transfer proposal, shipment/dispatch, receipt lines referencing exact shipment lines; source ownership until actual destination receipt; cumulative receipt <= dispatch. Partial/damaged/lost-transit policy deferred.                                                                                                                                |
| Return and disposition | Receipt resolves custody directly into unavailable inspection; explicit inspection/maintenance transitions; extension decisions retain original and new terms; loss resolves outstanding once; recovery enters inspection without reopening original custody.                                                                                                  |
| Other history          | Independently approved adjustments, staged import rows and unique commit identities; reconciliation results; typed record contexts; independent messages within threads with author-owned append-only versions. No cross-message predecessor references.                                                                                                       |
| Reliability/audit      | Permanent physical-event identity and canonical payload hash separate from expiring transport response cache. Success audit commits atomically; denied-action audit uses separate durable channel. No unscoped reporting credential bypass.                                                                                                                    |

Whole-unit integer quantities only: positive command quantities, nonnegative balance projections and asset-backed quantity=1. Decimal quantities require a future approved design change. Use positive movement magnitude plus direction; negative adjustment effect is not a negative input magnitude. Integer width, upper bounds and parser budgets remain explicit validation tasks.

Specify PK/NOT NULL/XOR/unique/composite FK/delete-RESTRICT constraints per entity before design acceptance. Cross-row totals are not ordinary row CHECK constraints: controlled locking/procedures, appropriate deferred enforcement and reconciliation are required. Partial indexes in separate tables do not establish cross-table custody exclusivity.

## Conservation

Per item and ownership lab:

`opening + external receipts + net approved adjustments + received inbound ownership - received outbound ownership = available + reserved + borrowed + inspection + maintenance + source-owned transit + lost + retired + consumed`

Every right-hand pool is disjoint; available excludes reserved. Opening is either an opening balance or a receipt, never both. Department transfers net zero. Lost/retired/consumed are historical accounting pools, not lendable stock. Compensations/write-offs must not duplicate the same loss in adjustments and terminal pools.

A opening10/B0: dispatch3 gives A available7+transit3, B0. Receipt2 gives A available7+transit1 with received outbound2 and B received inbound2/stock2. Damaged destination receipt is inspection; ordinary receipt disposition still requires its accepted policy.

`submitted = issued cumulative + cancelled unissued + rejected + remaining eligible/pending`

Active reserved request quantity is a subset of eligible remaining, not extra submitted quantity. Whole-line academic decisions are a P04 proposal; within-line approval reductions are not silently enabled.

`returnable issued = physically received + loss-resolved + outstanding`

Overdue is a borrowed-outstanding subset, never an extra stock pool. Identity conversion creates no receipt or adjustment.

## Transaction and privilege boundary

Proposed command sequence: derive current actor/session; check policy gates; serialize command/event identity; lock shared item/lab aggregates in stable sorted order, then affected allocation/asset/revision guards in a single globally reviewed order; recheck current scoped authority, person conflicts, versions, terms and DB-time expiry; append events/ledger/audit and projections atomically; commit. Exact lock order and revocation ordering still need review. Missing-row races require unique guards or equivalent serialization. Issue is denied at exact expiry; GET never performs allocation. Retry bounds/isolation/errors remain unverified until later database evidence.

Separate migration owner, non-owning runtime, scoped reporting and backup principals. Runtime cannot own schema, perform DDL, create roles/grants, bypass RLS or write protected ledger/custody/audit tables directly. Reviewed mutation functions have fixed trusted search_path, qualified object names, PUBLIC execute revoked and narrow execute grants; runtime cannot create objects in trusted schemas. Function ownership/security-definer use and minimal read grants must be enumerated before acceptance. Transaction-local actor context cannot independently authenticate an end user: the server is a trusted boundary, client context is never trusted, and pooled-context leakage must be tested. Server compromise/superuser abuse remain residual risks.

Audit failure handling, denial logging durability, scoped reporting views, private/no-store responses, export revocation and parser/rate/resource limits require explicit contracts. Secrets/real data/production are excluded.

Traceability: C01 transit/conservation; C02 partial semantics; C03 person independence; C04 terms/extensions; C05 revisions; C06 custody/identity; C07 full capability matrix; C08 permanent event identity; C09 inspection/loss; C10 expiry; C11 explicit histories; C12 session/governance; C13 metrics; C14 message history; C15 ASVS; C16 bounds/cache/audit; C17 milestone UI. These are design mappings, not passed controls.
