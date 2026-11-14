# CP2 lending lifecycle contract

Base: `/api/lending`. GET and POST only. Existing operations and payload names remain available; the basic contract in `api-contract.md` continues to describe issue, return, policy, comments and legacy immediate request creation. These are protected PostgreSQL operations executed as `lab_runtime`; application clients have no direct table privileges.

Every POST requires the session cookie, matching Origin, JSON content type, X-CSRF-Token and a fresh UUID `commandId`. A successful replay returns the stored result without changing stock, versions or decisions. Reusing the actor/command identity with another payload or operation returns 409 `IDENTITY_CONFLICT`. Current authorization still applies to replay. Errors use `{code, correlationId}` with HTTP status; successful database results below have no status field. All route responses are no-store.

## Draft, save, submit and correction

`POST drafts {commandId, purpose?, collectAt?, returnAt?, lecturerId?, lines: [...]}` creates an owned draft: `{id, version:0, summary:"DRAFT"}`. Drafts can contain incomplete fields and an empty lines array, up to 20 lines and the bounded JSON body size. They have no approval, request-line, reservation or stock effects.

`POST drafts {commandId, draftId, expectedVersion, purpose?, collectAt?, returnAt?, lecturerId?, lines:[...]}` replaces the saved draft fields, increments its version and returns `{id, version, summary:"DRAFT"}`. This is replacement, not a field merge. Submitted or cancelled drafts cannot be saved again. Only the borrower can read or mutate a draft, including administrators and officers who are not its owner.

`GET drafts?requestId=<draft UUID>&limit=50&offset=0` returns `{items:[{id,payload,version,createdAt,updatedAt,submittedId,cancelled,predecessorId}],limit,offset}`. Omit requestId for the caller's drafts. Submitted and cancelled drafts remain in this list for traceability.

`POST submit {commandId,draftId,expectedVersion}` explicitly submits the current draft. Returns `{id:<submitted request UUID>,draftId,version:<new draft version>,requestVersion}`. Submit validates the complete current payload, current active catalogue, policy and eligible approvers atomically. Dates must be finite, return later than collection and later than database now. Purpose is 1–1000 trimmed characters. Lines are distinct item/lab/location triples; each is exactly `{itemId,labId,locationId,quantity}`, quantity an integer 1–1000 and at most 20 for returnable equipment. Missing policy blocks submission. Lecturer must be active, different from borrower and assigned to every submitted laboratory when supplied; HOD uses the existing explicitly configured active ADMIN academic approver. BOTH requires distinct lecturer/HOD/borrower identities. No production HOD role model is introduced by this checkpoint.

Submission snapshots policies into new request lines. NONE lines attempt reservation; insufficient stock leaves APPROVED/AWAITING_STOCK. Submission never physically issues. Any validation or stock-posting error rolls back the whole submission and leaves the draft usable.

`POST revisions {commandId,requestId,expectedVersion:<request version>}` requires an owned request with rejected lines and creates `{id:<draft UUID>,version:0,predecessorId,summary:"DRAFT"}`. The draft copies only rejected lines, purpose and dates. Save it to correct fields, then submit explicitly. Submit re-evaluates current policy and lecturer eligibility. The new request has `predecessorId` and `revision=predecessor.revision+1`; predecessor decisions, comments and original quantities remain untouched. There is one successor draft per predecessor; replay the original command or read drafts to recover it. Further corrections form a new chain after rejection of the successor.

## Cancellation and per-line approval

`POST cancel {commandId,draftId,expectedVersion,reason}` cancels an unsubmitted draft and returns `{id,version,summary:"CANCELLED"}`.

`POST cancel {commandId,lineId,expectedVersion:<line version>,quantity,reason}` closes a positive integer quantity of the caller's own pending or approved unissued remainder. Reason is 1–1000 trimmed characters. Rejected and already cancelled lines cannot be cancelled. Quantity cannot exceed original quantity minus prior cancellations minus handovers. The operation releases the corresponding RESERVED quantity to AVAILABLE with a balanced `CANCEL_RESERVATION` movement and records an audit event. It never changes issued quantities or existing loans. Returns `{lineId,version,cancelledQuantity,stage}`. Once all handover rights are closed, stage is terminal CANCELLED; any issued loan continues through the existing return operation.

`POST decisions {commandId,lineId,expectedVersion,decision:"APPROVE"|"REJECT",remarks}` operates on exactly one line. NONE has no academic decision; LECTURER and HOD have one stage; BOTH requires lecturer then HOD. Decisions append history and advance the line version; current role/lab assignment and borrower self-conflict rules apply before replay. The last versioned approval attempts reservation of the uncancelled remainder and returns `{lineId,stage,version}`. The same command cannot later reserve newly arriving stock: use an explicit reserve command. Rejected lines are immutable history; use a linked correction draft.

`POST reserve {commandId,lineId,expectedVersion}` retries reservation for a borrower or assigned officer. Reservation is all-or-nothing for the uncancelled line remainder. Existing allocation is reused. For a partially cancelled line without stock, `{awaitingStock:true}` means no allocation was made; retry later with a new commandId. Existing legacy reserve continues to return its existing insufficient-stock error. No reservation authorizes handover without the issue guard.

`POST issues` additionally accepts `expectedVersion` of its allocation's line and rejects cancelled reservation units. Versioned decisions, reserves and issues return the resulting line `version` on their normal delegated path. Fetch the request after a mutation to obtain the latest versions and allocation dimensions. For compatibility, these three pre-existing operations still accept legacy payloads without expectedVersion; new lifecycle clients should always supply it. New draft/save/submit/cancel/revisions require versions on existing entities. 409 `STALE_VERSION` means refresh, review and retry using a new command identity.

## Scoped request reads

`GET requests` returns `{items,limit,offset}`. Each request retains `id,purpose,borrowerId,borrower,batchId,collectAt,returnAt,createdAt,lines` and adds `version,updatedAt,revision,predecessorId,summary`. Each visible line includes `id,itemId,item,labId,lab,locationId,location,quantity,policy,stage,lecturerId,hodId,decisions,version,cancelledQuantity,allocatedQuantity,issuedQuantity,reservedQuantity`. Allocation quantity is historical reserved quantity; reservedQuantity subtracts handovers and allocation cancellations. Original requested quantities do not change.

Summary is derived from authorized visible lines: PENDING, MIXED, READY, AWAITING_STOCK, PARTIALLY_FULFILLED, FULFILLED, CANCELLED or REJECTED. Any combination of handover and cancellation is PARTIALLY_FULFILLED. FULFILLED describes handover completion, not resolution of outstanding custody; loan outstanding/return fields remain authoritative. Return receipts advance the request and line versions/timestamp.

Request visibility remains borrower, current eligible assigned lecturer, current ADMIN or assigned technical officer; filtered-out lines are never included merely because another line is visible. Request summaries use only those visible lines. Drafts are owner-only.

Closed GET field sets (unknown, duplicate, malformed or unsupported fields return 422 INVALID):

| Operation          | Supported filters                                                                                                            |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------- |
| requests           | requestId, labId, batchId, from, to, status (summary above), stage (LECTURER/HOD/APPROVED/REJECTED/CANCELLED), limit, offset |
| drafts             | requestId (draft UUID), limit, offset                                                                                        |
| loans              | requestId, labId, batchId, from, to, status (active/history/overdue), limit, offset                                          |
| ready, allocations | requestId, labId, batchId, from, to, limit, offset                                                                           |
| metrics            | labId, batchId, from, to, status (active/history/overdue)                                                                    |
| sources, lecturers | labId, limit, offset                                                                                                         |
| comments           | requestId, limit, offset                                                                                                     |
| policies, history  | limit, offset                                                                                                                |

Limit defaults to 50, range 1–100; offset defaults to 0, range 0–100000. UUID/date fields must parse; when both dates are supplied from must precede to. Request dates filter createdAt, loan dates filter issuedAt and ready/allocation dates filter collectAt, with inclusive from/exclusive to. Metrics retain their existing unpaginated scoped aggregate response. History retains the existing latest-100-event source window. Pagination is applied after scope and state filters; it does not include a total count.

## Validation evidence

Migrations 035–038 applied and re-run through the digest-protected runner. `tests/lending-lifecycle.integration.mjs` covers draft non-effects/ownership/save/stale submit, current lecturer eligibility, rollback, returnable quantity limit, all policies, self/multi-role conflicts, reserved and partially handed-over cancellation, partial pending cancellation, correction lineage/history, mixed summaries, paging/query rejection, approval replay after stock arrival and balanced stock entries. Existing application, authority, source, original workflow and catalogue integration suites also pass. Fixtures run under runtime role and roll back. Typecheck and full lint pass. HTTP/browser acceptance and concurrent identity revocation races were not exercised in this checkpoint.
