# B06 read contracts and wireframe reconciliation

Status: proposed design, not integration acceptance. Source: Frontend report eb87e1cd-acf7-4607-8667-3bdfe9ca2fe8, based solely on Orbit's brief. Specialist observed tool calls: zero. Neither wireframes nor execution JSON independently inspected by the specialist. Tests NOT RUN. SEC-01–09 OPEN; B05 blocked by unverified execution restrictions. C01–C17 proposed baseline; P01–P21/PR22–PR27 deferred and blocking affected behavior.

## Read-contract requirements

All reads require current operation, record, per-line ownership-lab and field authority. Counts, previews and history cannot reveal excluded records. GET has no side effects; private responses use no-store. Capability displays do not authorize execution. No public catalogue, delegation, protected persistent client cache or offline mutation queue.

| Read                  | Required authorized content                                                                                                                                                                          | Creation dependencies                                                                                        |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| /me                   | Own stable person reference, minimal display identity, active/session state, scoped operations and lab contexts                                                                                      | Stable owner; individual operation reads supply versions                                                     |
| /catalogue            | Item/kind/UOM/lab, permitted requestability, bounds and unresolved policy status; qualified availability only when authorized                                                                        | Item/lab references; any catalogue/requestability invalidation dependency must be separately justified       |
| /requests/{requestId} | Immutable revision, per-line item/lab/kind, requested/approved terms, stages, stable entitlement and historical fulfilment/cancellation, authorized discussion/history, minimal actor/cohort context | requestVersion; affected entitlementHeadVersions; exact line/revision/entitlement references                 |
| /approval-assignments | Assignment, request/revision/line/lab/stage, eligible actions, minimal requester/evidence, safe conflict explanation, cursor                                                                         | requestVersion, assignmentVersion, entitlementHeadVersion; detail before capture where list is insufficient  |
| /collection           | Entitlement, eligible quantity, mode existingIssue/materializeIssue/consume, genuine reservation and exact source allocation/bucket/asset/pool, minimal borrower/cohort, authorized equipment terms  | requestVersion, entitlementHeadVersion, allocationVersion and precisely scoped inventory/source dependencies |
| /loans/{loanLineId}   | Original issue/loan/asset/custody generation, outstanding/received/loss facts, inspection status, minimal borrower/terms, independent receive/inspect capabilities                                   | loanLineVersion, custodyGuardVersion and original immutable bindings; no later approval-head dependency      |

Named version semantics and invalidation scope remain to be finalized. Generic counters cannot replace explicit dependency rules. Read-only projections do not reserve stock or guarantee bookings. Empty, filtered-empty, denied and unavailable states differ; header totals never disclose hidden lines.

## Missing bounded contracts

- My requests list and scope-filtered status counts; eligible lecturer lookup; policy/bounds projection; paginated revisions, authored discussion and audit history.
- Assignment detail and authorized evidence lookup, filter vocabulary and pagination.
- Collectible detail and exact reservation/source lookup; asset identification. No substitute-stock picker in this subset.
- Outstanding-loan list, original-custody lookup, receipt and inspection/disposition history.
- Creation recovery and committed-result disclosure consistent with execution/status schemas.

Cursor/page bounds are proposed engineering limits requiring review, not institutional policy. Each page rechecks current authority. Partial pages cannot establish absence.

## Four-flow corrections

1. Request: editable semantics precede capture. Review immutable revision and affected lines, create intent, execute IDs only. Recover the same creation key without refreshing the captured plan. New revisions preserve stable entitlement and prior fulfilment/cancellation. Submission implies no stock guarantee or accepted hold duration.
2. Approval: detail supplies assignment/route target, evidence, conflict explanation and named versions. Captured action/reason/line remain server-stored. Conflicts require renewed authorized review; never silently rebuild the old intent. No administrator or role-switch bypass.
3. Collection: TO differs from borrower, not assigned TO. Review fixed genuine reserved allocation/source and explicit mode; quantity equals reservationConsumed and is positive. No source substitution. Materialization and zero-net conversion commit with issue. Consumables have no asset/due/return. Unknown outcome displays Checking handover result; recover original intent/slot/event. Pending, absent or denied never permits another physical handover. POST 200 is committed only.
4. Return: bind original issue/loan/asset/custody generation and outstanding quantity; later approvals do not control receipt of the old loan. Show condition and server-derived receiving actor. IDs-only execution; uncertainty requires reconciliation. PR22 remains unresolved.

## Orbit clarification: inspection availability

Later inspection assessment being unavailable does not by itself prevent an authorized receipt. However, receipt custody closure AND durable inspection entry must commit atomically. If required inspection-entry persistence or success audit cannot commit, the receipt cannot succeed. The specialist's statement about inspection unavailability must not be read as permission to bypass that atomic transition. Display actors as server-derived context, never caller-selectable authority.

## Acceptance evidence still required

Finalize closed read/creation schemas and exact named versions; reconcile older JSON09/18 with documents20/22; verify route bindings and field authorization; freeze canonical fingerprints/digests and creation concurrency; demonstrate stable lineage, fixed reservations and original custody. Independent review remains required. Later authorized checks must cover retries/crashes/concurrency, four flows at 360/768/1280px, keyboard/screen reader, zoom/reflow, errors, focus and contrast. These are planned checks, not passes.
