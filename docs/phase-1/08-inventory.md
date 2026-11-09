# Quantity conservation and asset identity

## Accounting model

For each item/lab, stock is partitioned into available, reserved, borrowed, inspection, maintenance, transit, lost and retired pools. Anonymous and identified representations are disjoint within pools. Overdue is an attribute of borrowed custody, never an extra counted pool. Consumable issuance moves stock to a consumed account. External receipts and authorized corrections are explicit ledger sources/sinks; transfers balance across labs and transit. Historical gross stock is not the same as lendable on-hand stock.

Invariant: opening + receipts + net approved adjustments + inbound transfers − outbound transfers = available + reserved + borrowed + inspection + maintenance + transit-held + lost + retired + consumed, using consistent ownership attribution and no double counting of transit between labs. Department ledger treats transfer entries as internal and net zero. Every movement has paired entries in its chosen accounting boundary. All quantities nonnegative integers. Current projections reconcile with ledger; discrepancies block affected issue and trigger operator investigation.

Example (synthetic): receipt 10 anonymous returnables → available anonymous=10. Reserve 2 → available=8, reserved anonymous=2. Handover materializes IDs A/B from those reserved units and issues them → available anonymous=8, borrowed identified=2, total remains 10. Return A → inspection=1, borrowed=1; clear inspection → available identified=1. No serial/ID operation adds another stock receipt.

## Identity rules

Before physical issue every returnable unit has permanent internal asset ID; manufacturer serial is optional and can first be recorded by TO at handover. IDs never recycled or changed after issue. Anonymous pools are counts, not fictitious assets with duplicate IDs. Identifying a reserved/available unit consumes exactly one anonymous unit and creates exactly one identified unit in the same state, atomically. Existing assets are selected by identity and cannot be re-created from stock counts.

Serials normalized with documented manufacturer-aware rules; avoid over-normalizing meaningful characters. Duplicate/collision blocks automatic registration and opens reconciliation, not silent merge. Corrections append identity event and preserve original serial history. Internal ID remains stable through transfer, repair, return and retirement. Serial optional for unidentified/serial-less equipment; no handover blocked solely for missing manufacturer serial if internal identity is assigned. Consumables identified by item/lot, not one asset per consumed unit.

## Concurrency protocol

Each mutation authenticates and validates, begins transaction, locks shared item/lab aggregate rows in stable sorted order then relevant allocation/asset rows, expires stale holds, rechecks quantities/permissions/versions, posts movements and projections, appends audit and commits. Use conditional updates and unique active-asset constraints as additional defenses. Selected PostgreSQL isolation level and retry behavior must be proven in M3; prefer SERIALIZABLE for allocation commands with bounded deadlock/serialization retry (e.g. 3 attempts with jitter) and idempotency. Locks and conditional constraints remain necessary; do not rely on read-then-write outside a transaction.

Final-stock competition: one available unit and 20 simultaneous valid requests result in exactly one reserved/issued unit, no negative balance; all others get a safe conflict/awaiting-stock outcome. Crash rollback leaves no partial identity or loan. Same idempotency key+payload returns original result, never a second handover. Cross-lab transfer consumes source state, holds in transit and credits destination once upon receipt; unavailable pools cannot be transferred as available.

## Controlled operations

Imports stage and validate before commit: preview counts, duplicates, item/lab references and authorization; use batch+row idempotency. Never import operational statuses that bypass approvals/custody. Initial stock receipts specify provenance; identified imported assets subtract from anonymous quantities only when explicit identification, not additional receipt. Adjustments need reason, independent approval (P16), immutable ledger and audit. No delete/edit of posted movements; corrections post compensating entries. Maintenance, loss and retirement preserve physical identity and all historical loan references.
