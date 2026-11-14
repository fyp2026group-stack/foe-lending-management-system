# Intent execution mapping — review proposal

2026-11-09. Curated from Backend report d9f2243b-1e4a-491d-960b-73efee782bb3, supplied-brief-only, zero tools/tests. SEC findings OPEN; policies deferred; B05 blocked. Supersedes conflicting prose body semantics; JSON drafts 09/18 still require reconciliation and cannot be treated as compatible or accepted.

## Stored input and routes

Execution body exactly {intentId,slotId}, closed to additional properties; session, CSRF and execution transport key required. Stored immutable semantic input is authoritative. Submission route /requests/{requestId}/submissions asserts exact stored request; decision /approval-assignments/{assignmentId}/decisions asserts exact assignment; /handovers accepts stored existingIssue, materializeIssue or consume only; /return-receipts accepts stored return only. Slot must belong to intent. Wrong operation/target yields safe conflict without effect. One intent/slot/effect; groups presentation only.

This bounded subset requires genuine current reservation allocations for issue/materialize/consume, with 0<reservationConsumed=quantity<=allocationOutstanding. Unreserved branch unavailable pending its own policy/schema review; no dummy IDs. This selects no permanent university policy. Source bucket, allocation, entitlement, item/lab and asset or anonymous pool are fixed at creation; execution cannot substitute available stock elsewhere. Stock movement, fulfilment, reservation consumption, conversion where needed and audit are atomic.

## Versions

Replace ambiguous expectedVersion with explicit stored expectations:

| Operation      | Version vector                                                              |
| -------------- | --------------------------------------------------------------------------- |
| Submission     | Request and every affected entitlement head                                 |
| Decision       | Request, assignment, entitlement head                                       |
| Existing issue | Request, entitlement head, allocation, asset inventory guard, source bucket |
| Materialize    | Request, entitlement head, allocation, pool guard, source bucket            |
| Consume        | Request, entitlement head, allocation, bucket guard, source bucket          |
| Return         | Original loan line and custody guard                                        |

Creation checks applicable expectations; execution checks them again under ordered guards plus current authority, policies, terms, expiry and integrity. Mismatch gives attempt-level STALE_VERSION, no silent rebase or permanent rejection. Immutable revision/approval/terms/generation IDs are separate bindings.

**Orbit correction:** Return excludes entitlement-head version unless a specific reviewed return rule establishes that dependency. Subsequent approval/replacement must not itself block receipt of an outstanding original loan. Exact loanLine→originalIssueEvent→asset/custodyGeneration binding and present outstanding custody remain mandatory. PR22 behavior remains blocked; no exception to authorization or atomic inspection entry.

## Retry and digests

Creation namespace (authenticatedPersonId,create-intent,key); execution namespace (authenticatedPersonId,execute,operation,canonicalTarget,key). Keys excluded from hashes. Define TWO creation records: a request fingerprint over immutable caller semantic input and caller-supplied expectations, plus the persisted resolved plan digest including server-derived scope and captured vector. The original transport binding stores both.

**Orbit correction:** On an existing creation binding, compare original request fingerprint and recover original intent under current authorization; do not recapture current versions into the fingerprint. Current state changes may prevent execution, not mint another intent or incorrectly conflict with identical creation input. First creation resolves plan and commits it once. Concurrent first creation serialized by key guard and unique binding.

Proposed canonical version intent-json-v1: UTF-8 closed JSON, object keys sorted by an explicitly fixed comparator (exact byte/Unicode comparator still requires consolidated review), no insignificant whitespace, schema integer decimal encoding, lowercase UUIDs, reject duplicates/unknown fields/unsupported nulls, no implicit text trimming or Unicode normalization. Omitted optional fields remain absent. Arrays preserve order except explicitly defined lineage version maps sorted by ID. Timestamp precision must be specified before any timestamp-bearing variant is accepted.

Execution digest binds version, actor/operation/target namespace, persisted plan digest, intent and slot IDs; excludes itself and transport keys. Stored semantic input is never rebuilt from execution body. Canonical interoperability vectors remain outstanding.

## Lifecycle and results

Creation commits pending intent/slot/binding/creation audit before response. Lost response uses same key/input. Pending proves no terminal result to caller, not rollback. Execute and final semantic reject share intent lock and conditional transition; success effect/event/result/audit atomic, rejection reason rechecked with atomic rejection audit. Lost authority, stale versions, missing policy and infrastructure failure are attempt denials, not permanent rejection. No reset or lease. Unknown physical outcome requires original-identity and physical reconciliation, never blind repetition.

Typed committed outcome references: submission revision; decision; issue event/asset/new custody generation; consumption event/quantity; return receipt/inspection. Schema details and status DTO reconciliation outstanding. Replay requires current field/record authority, may conceal existence, and returns original outcome rather than current state masquerading as original result.

Locks: auth barrier→epoch→transport/event/intent→inventory→entitlement/request/loan/allocation/custody/loss→remaining rows, canonical within tiers; whole-transaction restart on changed dependencies. Revocation snapshot behavior unproven.

Abstract cases NOT RUN: same creation retry after stock/head version changes recovers original intent but execution can be stale; changed source/quantity/operation cannot execute stored intent; return retains generation1 after asset generation2; approval head change alone does not invalidate original outstanding-return eligibility. Full OpenAPI, UI reads, grants, audit spool, source traceability and independent review remain required.
