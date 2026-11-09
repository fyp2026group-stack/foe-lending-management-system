# Core integrity corrections and proposed contracts

Independent Lab Security Reviewer summary review received2026-11-09; no files/tools/tests. Orbit adopts the following technical corrections as DESIGN PROPOSALS pending independent acceptance. CORE01–06 and SEC01–09 remain OPEN; this document is remediation, not proof. Institutional choices unchanged/deferred. Supersedes conflicting draft semantics in09/11.

## CORE01 bindings

Decision: immutable id/revisionId/lineId/stageId/assignmentId/actorPersonId/outcome/occurredAt; UNIQUE(id,revisionId,lineId,stageId), FK exact submitted line and stage assignment. Effective approved terms bind the complete required decision chain, not one convenient approving stage. Line includes item/lab/kind/UOM; verify every affected lab in a multi-lab submission. No whole-request lab permission shortcut.

IntentTarget uses concrete FK alternatives requestRevisionId/approvalAssignmentId/requestLineId/loanLineId/shipmentLineId with exactly-one-parent and operation-target compatibility. No free targetId without enforceable typed FK. EffectSlot key(intentId,slotId), UNIQUE global slotId, operation, exact revision/line/item/lab/terms references where applicable, positive integer quantity, optional asset/sourceBucket and effect-kind XOR rules. Return slots bind exact loan/custody; decision slots bind assignment/revision; not every operation requires unrelated terms. Dictionary must enumerate those operation variants rather than optional untyped fields. Submitted revisions immutable, borrower follows original identity.

## CORE02 rejection race

Business rollback does not finalize rejection. Fresh rejection transaction acquires shared auth barrier/epoch then same event/transport/slot identity guards in prescribed total order, rechecks authorization/binding and any state dependencies using required downstream locks. Conditional pending->rejected requires no committed event and a currently valid semantic reason or immutable binding error. Execution also requires pending under same slot guard. If success won preserve committed; if rejection won deny execution. Stale reason leaves pending, no permanent rejection claim. Serialization/deadlock/timeout are attempt failures not final semantic rejects. Rejection result only after rejection commit; denied audit independent. No status GET mutation or missing/pending outcome implying repeat physical act.

## CORE03 groups

Group is presentation/correlation record only, derived per-slot status never all-success without all committed. Under shared line/stock guards, sum committed and proposed effects across ALL groups/intents cannot exceed eligible approved unissued quantity. Slot UUID/operation immutable; allocation release/cancel/revision cannot duplicate capacity. Retry addresses original uncommitted slot identities only after server outcome reconciliation; committed slots preserved. New intents still subject cumulative line and custody bounds. Actual uncertain physical movement requires evidence reconciliation; no database protocol establishes physical-world exactlyonce.

## CORE04 materialization

AssetIdentityEvent UNIQUE(intentId,slotId) for materialization, original resulting asset ID retained in event outcome. Under inventory-first total locks, verify source bucket item/lab/kind/UOM/pool and availability, debit anonymous1/credit identified1 SAME pool, create permanent Asset+Guard, consume valid allocation and issue atomically with audit. No opening/receipt/adjustment. Issue failure rolls back asset/conversion. Replay returns original authorized asset reference. Optional serial absence never removes permanent identity; serial collisions follow deferred P11 policy, no silent merge.

## CORE05 custody

Loan counters are cumulative received and cumulative lossResolved, nonnegative and sum<=issued. Inspection/clearance/recovery never decrement these to reopen return capacity. Receipt binds exact loan/custody instance/borrower/asset/item/ownership lab via composite references and protected guarded checks. Resolve custody+inspection atomically. Loss resolves outstanding once; recovery references exact loss quantity/event and posts inspection without a second return or reopened original custody. Transfer loss accounting remains a separate transit contract. No consumable return.

## CORE06 subtype/disclosure

Exclusive input/output variants: returnable one permanent asset per LoanLine, valid approved returnable terms; consumable positive quantity Consumption, no asset/dueAt/return. Anonymous-returnable materialization is explicit input variant, produces identified returnable outcome. Allowed actor/cohort/reference fields are individually filtered; event lookup does not grant linked-record access. Current scoped session/capability/record/field checks on replay and status; minimal public errors and no-store.

Future proof (NOT RUN): rejection vs commit race, overlapping group quantity, anonymous conversion rollback/replay, return/loss/recovery contention, cross-lab tuple substitution, restricted receipt fields. These tests belong later business milestones; M1 requires complete independently reviewed design and authorized scaffold evidence, not implementation of business workflows.
