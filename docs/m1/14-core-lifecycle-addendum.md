# Core lifecycle addendum — proposed design

2026-11-09. Source: Backend report 4073c5d4-a3e7-45d2-89cc-2eb335093adb, based on supplied excerpts with zero tool calls. Curated by Orbit; no implementation, validator or tests run. CORE01–06 and SEC01–09 remain open. Policies deferred; B05 permission gate unresolved.

## Durable identity and terminal states

Choose one intent per effect, exactly one immutable slot. Groups contain presentation links and independent outcomes only; they confer no authority or atomicity.

Authorized creation atomically commits pending intent, immutable typed slot, canonical version/hash, actor/operation-scoped transport binding and required creation audit. Return only after commit. A lost creation response is recovered with the original transport identity under current authorization; changed payload conflicts. Creation does not direct physical handover. Failed creation leaves no usable partial intent.

Execution and final semantic rejection share the same intent-row lock in the identity tier. Total order: authorization barrier → persistent epoch → transport/event/intent guards → item/lab/asset → request/shipment/loan/allocation/custody/loss → remaining rows. Stable sort within tiers; discover dependencies, lock, revalidate; rollback rather than acquire an earlier lock late. Governance uses exclusive barrier and atomic epoch/authority updates. Snapshot behavior remains unproven.

Both execution and rejection require a conditional pending transition under that lock. Execution commits unique event, effect, projections, required success audit and pending→committed atomically. Rejection rechecks a currently valid semantic reason under required downstream locks and atomically commits rejection/audit and pending→rejected. Exactly one transition must succeed. Committed/rejected are terminal; replay requires current field/record authorization. Infrastructure failures, unavailable authorization, unknown commit and unresolved policy do not create terminal semantic rejection.

No separate lease or committed executing claim. Execution rollback leaves the original durable pending intent. Recovery reacquires guards and establishes outcome before controlled retry; pending/absent GET never proves rollback or permits repeating a physical act. Slot terminality equals intent terminality.

## Binding enforcement

Each slot has exactly one typed child, checked at creation commit; discriminator, target and effect bindings are immutable. Parent tuples require matching composite UNIQUE keys. Runtime cannot directly write protected intent/slot/event records. Proposed guarded interfaces: create_intent, execute_intent, reject_intent.

| Variant              | Required binding                                                                                                            |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| SUBMIT               | Composite request/revision FK; guarded owner and submit-eligible revision checks; authorization for every affected line lab |
| DECIDE               | Assignment/revision/line/stage/lab composite FK; guarded current assignee, stage and person-conflict checks                 |
| HANDOVER_EXISTING    | Line/item/lab and terms/revision/line/item/lab FKs; asset/item FK; matching allocation tuple                                |
| HANDOVER_MATERIALIZE | Same line/terms/allocation binding; anonymous source bucket/item/lab FK; quantity one                                       |
| CONSUME              | Same line/terms/allocation binding; consumable kind; no asset, due date or return                                           |
| RETURN               | Loan line/asset/item/lab composite FK; quantity one; exact current custody instance                                         |
| LOSS_RESOLVE         | Exact loan/custody/item/lab tuple and bounded quantity                                                                      |
| LOSS_RECOVER         | Exact loss resolution/item/lab tuple and identified asset where applicable                                                  |

Terms must bind the complete valid approval chain; a single approving-decision FK is insufficient. Guards enforce current revision, operation compatibility, immutable slot hash and all cross-table relationships. Event identity is unique per intent/slot. Each line/effect retains its own lab; a group cannot broaden scope.

## Quantity proposal and review qualification

For a line, disjoint committed totals satisfy S = I + C + J + M: submitted, issued/consumed, cancelled unissued, rejected, remaining. Count fulfilment once per committed effect across all groups/intents. Proposed A is cumulative approved quantity including fulfilled quantity; Ca is approved-attributed cancellation. E = A − I − Ca, with 0 ≤ E ≤ M. J is outside A and is not subtracted again. Reservation R satisfies 0 ≤ R ≤ E and is not itself fulfilment. For an effect owning reservation r, issueQty ≤ r + (E − R); unreserved issue remains policy-blocked and stock availability must also hold.

**Orbit review requirement:** define the stable entitlement/line lineage across replacement revisions and terms. Historical I and Ca must follow that lineage, while stale chains cannot authorize issuance. The above equation alone does not establish this mapping or authorize partial academic decisions. Reservation ownership, quantity and availability must be checked independently. No acceptance until independently reviewed.

## Internal identity conversion

Materialization atomically validates original allocation and source bucket; debits anonymous one and credits identified one in the same ownership/pool/item/kind/UOM; creates permanent asset/guard and conversion linkage; consumes allocation/reservation and moves identified unit into borrowed custody; commits issue/event/projections/audit. Conversion contributes zero to external receipts and adjustments. It creates no additional issuable stock. Any failure rolls back the complete operation. Replay returns original asset/event; a new intent still faces cumulative quantity, stock and custody bounds. Serial policy remains deferred.

## Bounded recovery

Loan accounting: issued = received + lossResolved + outstanding. Per original loss resolution: recoverable = resolved quantity − cumulative committed recovered quantity across all intents. Recoveries are nonnegative and bounded by that resolution. Common item/lab/asset/loss guards protect checks and writes.

Recovery atomically debits lost and credits inspection, links the original resolution and increments recovered. Historical lossResolved and received remain unchanged; outstanding capacity never reopens. Resolved assets presented later use recovery, not ordinary return. Fresh intent IDs cannot bypass recoverable balance or asset state.

## Review cases — NOT RUN

Crash after creation commit; executor/rejector in both winner orders; changed operation/line/lab/terms; overlapping groups with allowance one; replacement revision after partial issue; anonymous conversion rollback at each write and replay with original asset; loss two/recover one/new recovery two denied; recovered asset presented as ordinary return denied. Static and later runtime evidence are separate.

Outstanding beyond this addendum: full OpenAPI/read models, exact object/function grants, denial-spool contract, policy mapping and verified execution restrictions. No M2 authorization.
