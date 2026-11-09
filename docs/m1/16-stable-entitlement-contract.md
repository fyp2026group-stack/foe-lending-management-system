# Stable entitlement contract

2026-11-09. Proposed design, curated from Backend report 123b3316-0b0a-45b6-be7d-e651aa245bf4. Backend used supplied excerpts only, zero tools; no source inspection, implementation or tests. SEC findings remain OPEN; policy decisions deferred; B05 blocked. Supplements documents 14–15; independent review pending.

## Identity and replacement

Entitlement has UUID entitlementId and immutable requestLineageId, server-controlled lineageSlotId, borrowerPersonId, itemId, ownershipLabId, kind and uomId. UNIQUE(requestLineageId,lineageSlotId) distinguishes legitimate separate lines. Server-controlled predecessor linkage preserves entitlement across replacement line IDs; unresolved duplicate-line identity blocks creation. Changing scope is unsupported absent a separately reviewed mapping protocol. This must not silently disable required substitute design: affected substitution contracts remain explicitly outstanding.

RevisionLine carries entitlementId/revisionId/lineId with matching composite UNIQUE key. ApprovalVersion records entitlement, exact revision/line/decision chain, versionNo, predecessor, approvedCeiling and DB time. UNIQUE(entitlementId,versionNo), UNIQUE(entitlementId,approvalId); predecessor composite FK remains within entitlement. Immutable terms bind exact approval version/revision/entitlement. EntitlementHead(entitlementId PK,currentApprovalId?,version) has a same-entitlement composite FK and conditional version update under the common entitlement guard. Only one current approved version; concurrent successors cannot both win.

Submitted replacement awaiting approval blocks new issues; historical facts remain. Existing reservations continue to count but cannot be consumed until explicitly rebound to valid replacement terms through a guarded transition or released. No implicit eligibility renewal. A replacement cannot revive superseded terms.

## Quantity

For one entitlement: A=current cumulative approved ceiling, never summed approval versions; I=sum distinct committed fulfilment facts across all revisions/intents/groups; Ca=sum distinct committed approved-cancellation facts; R=outstanding reservation quantity; E=A-I-Ca. Require nonnegative quantities, A>=I+Ca and 0<=R<=E. Reject replacement below I+Ca, or leaving R>E until explicit authorized release. Never clamp negative entitlement or reset facts.

FulfilmentFact(eventId PK/FK,entitlementId,quantity) and ApprovedCancellation(eventId PK/FK,entitlementId,quantity) are append-only, positive whole-unit events. Projections reconcile to distinct committed facts; historical facts cannot be relabelled by replacement.

For issue q, let c be the EXACT reservation quantity consumed in this effect, not the reservation's full outstanding balance. Require q>0, 0<=c<=q, c no greater than the actor/effect's compatible owned reservation balance, and c<=R. Without accepted unreserved authority require q=c. With that authority require q-c<=E-R and adequate unreserved physical stock. Atomically set I'=I+q and R'=R-c, consume c from the matching allocation, and debit corresponding reserved/unreserved pools. Then R'<=E'=E-q. This explicit c clarification avoids subtracting an entire reservation when only part is issued.

Approved cancellation increments Ca once and atomically releases affected reservation quantity sufficiently to preserve R<=E; authority and selection rules remain policy-gated. Rejection is not subtracted again from A. Earlier S=I+C+J+M is excluded from replacement-lineage enforcement pending separately scoped revision accounting; submitted quantities remain immutable revision facts. No partial academic decision policy is approved by these formulas.

## Allocation, custody and typed structure

Allocation binds entitlement/revision/approval/terms/item/lab by composite FKs to matching parent UNIQUE tuples. Guarded execution additionally checks active head and complete valid decision chain; FK linkage alone establishes no current authority.

CustodyGeneration has immutable UUID, assetId,generationNo,issueEventId,entitlementId,loanLineId; UNIQUE(assetId,generationNo), UNIQUE(issueEventId). AssetGuard references exact asset/generation tuple. Return/loss slots bind that immutable generation; a later loan of the same asset cannot satisfy an old command.

Each intent has one immutable slot and exactly one matching typed child. Slot UNIQUE(intentId); each child UNIQUE(slotId), composite FK(slotId,operation) to slot. Deferred checks on parent and every child enforce total child count exactly one and discriminator match. Structural creation uses common intent guard; deletion/mutation forbidden after creation. Runtime has no direct structural writes. Guarded interfaces and deferred integrity enforcement remain proposed, unverified mechanisms.

## Transaction lifecycle

Order: shared auth barrier → epoch → transport/event/intent → inventory → entitlement/request/loan/allocation/custody/loss → remaining rows. Canonical type/ID order within tiers; shared entitlement/loss guards serialize DIFFERENT intents. Discover predecessors, inventory, custody generations and all labs, then lock/revalidate; changed dependencies restart whole transaction. Governance exclusive barrier+epoch/authority update; stale snapshot handling remains unproven.

Creation atomically commits pending intent+slot/child+audit+unique actor/operation/transport binding before execution. Identical retry recovers original authorized intent; changed content conflicts. Execution and semantic rejection share intent lock and conditional pending transition. Committed effect/event/audit/outcome atomic; final rejection requires currently valid reason and atomic rejection audit. Lost authority denies without state change; missing policy/infra/unknown commit never terminal rejection. No reset, lease or status-read mutation; uncertain physical actions require reconciliation.

## Conversion and recovery

Conversion(slotId PK/FK,resultAssetId UNIQUE FK,sourceBucketId,quantity=1) permanently binds materialization to asset. Preserve source pool dimensions, entitlement, allocation, terms, lab,item,kind,UOM and provenance. Paired zero-net conversion+allocation consumption+issue+custody generation+audit atomic; no external receipt/adjustment, no leftover anonymous issuable copy. Replay returns original authorized asset/event.

For original loss L: remainingRecoverable=resolvedQty(L)-sum distinct committed recovery quantities linked to L. Common inventory/loss guards enforce nonnegative bounded recovery across every new intent and attributable remaining lost stock; lost→inspection only. No decrement of historical lossResolved, increase of loan received, or reopened borrowing/return capacity.

## Abstract cases — NOT RUN

## QA review qualification and technical clarifications

QA report d174df75-04bd-4f23-923d-341e425fe118 found no definite contradiction in the supplied arithmetic/lineage summary. Zero tools or tests; this is limited static coherence, not acceptance. The following address its three remaining specification points and require independent re-review with the consolidated contract:

- Ca contains only cancellation of UNISSUED approved quantity, disjoint from I, deduplicated by committed cancellation event identity across every version. Replacement A is a gross cumulative ceiling including all historical I and Ca; neither is reset or subtracted twice. Example I=4,Ca=1,A=7 gives E=2 irrespective of predecessor ceiling. Reversing cancellation is unsupported absent a separately reviewed correction contract.
- Replacement line predecessor is a same-entitlement FK to an earlier immutable revision sequence. Strictly increasing sequence prevents cycles; one active head and conditional expected-head update prevent independently spendable successors. Multiple historical proposals cannot create independent heads or allowance. A new entitlement slot requires server-authorized genuine new-request-line creation; replacement APIs cannot allocate a new slot. Ambiguous duplicate/new-line classification remains blocked, not guessed. Legitimate new requests remain separate requests subject to applicable policy, not silently deduplicated by item alone.
- Replacement submission records an explicit issue block against the entitlement head generation. Approval does not clear it automatically. A proposed guarded reconcile_replacement transition discovers and locks all affected inventory/allocation/entitlement dependencies in global order, checks current approved head, policy authority, expiry and complete decision chain, then explicitly rebinds each retained compatible allocation to the exact new approval/terms or releases it through an authorized release. It preserves quantity and stock provenance, never renews expiry implicitly, verifies R<=E and that no outstanding allocation retains stale bindings, and conditionally clears the block for that exact head generation in the same audited transaction. Changed head/dependencies roll back and restart; missing policy prevents transition. Issues require both matching current head and cleared generation-specific block. No operational implementation is authorized.

QA abstract expected cases, all NOT RUN: (A=10,I=2,Ca=1,R=4,q=5,c=2) yields I'=7,R'=2,E'=2 only with authorized unreserved stock; c=1 rejects; replacement I=4,Ca=1,R=2 requires A>=7 plus reconciliation; cancellation racing issue recomputes under shared entitlement guard; execute/reject has one terminal winner; old custody generation cannot receive a later loan and recovery remains bounded.

Replacement A=3 when I=3,Ca=1 rejected; two intents against E=1 cannot both issue; later custody generation rejects old return; loss2/recover1/recover2 rejects excess. Additional review cases: partial reservation consumption; replacement retaining reservations; new line identity bypass; concurrent approval successors. Full source consistency, schema/privilege enforcement, OpenAPI, substitution contracts and runtime evidence remain outstanding.
