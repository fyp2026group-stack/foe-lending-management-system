# CP3 physical operations and borrowed equipment

Technical Officer additions: [handover remarks, laboratory names, completed-operation summary and explicit policy blockers](technical-officer-api-contract.md).

Base: `/api/lending`. GET/POST, protected PostgreSQL entry point, session cookie, matching Origin, JSON and `X-CSRF-Token` for POST. Every mutation requires a UUID `commandId`. Unknown or null fields fail closed. Responses are never cached. Numeric `status` is reserved for errors; successful workflow mutations use `workflowStatus`.

Replay returns the stored result without effects, after checking current authorization. Changed operation/payload for an existing command returns 409 `IDENTITY_CONFLICT`. Stale versions return 409 `STALE_VERSION`; refresh before issuing a new command. Invalid transitions, duplicate serials/asset claims and exhausted allocations return 409 `STATE_CONFLICT`. Scope/identity conflicts return 403 `DENIED`. Malformed fields return 422 `INVALID`. HTTP errors include `code,correlationId`.

## Handover and receipt

`POST issues {commandId,allocationId,quantity,expectedVersion,assetId?,serial?}` uses the **request line version**, available from `GET requests`. Returnables issue exactly one unit per command. The actual issuing officer must currently have TECHNICAL_OFFICER and the lab assignment, differ from the borrower, and the borrower must be enabled with an allowed role. The line must remain approved with unissued, uncancelled allocation quantity and a future return date. Result: `{loanId,assetId,movementId,version:<line>,loanVersion:0}`.

An identified unit RESERVED for this allocation can be selected directly. An AVAILABLE identified unit of the same item/lab/location can replace one of this allocation's anonymous reservations: the anonymous reservation is released and the existing identity is issued. Other allocations' reserved identities cannot be selected. Without an assetId, an owned anonymous reserved unit is materialized with an optional serial; if this allocation has only identified units left, an owned reserved identity is selected automatically. A selected existing identity cannot receive a new serial through this operation. Permanent ID, original serial and all movements remain intact. Serial uniqueness is per item, matching the inventory constraint. A quantity claim never permits borrowing another allocation's anonymous pool.

`GET handover-assets?allocationId=<uuid>&limit=50&offset=0` is restricted to a currently assigned different officer. Returns `{items:[{assetId,serial,state,version}],limit,offset}`. It lists AVAILABLE identities and RESERVED identities owned by that allocation. Item/lab/location must match. The cell version is informational; POST uses the line version.

Reservations now combine anonymous and identified AVAILABLE stock atomically. `POST reserve` reuses an existing allocation or returns `{allocationId,movementId}` / `{awaitingStock:true}`. Cancellation releases actual reserved identities and anonymous units independently. `GET sources` counts both eligible forms without exposing serials. Existing Ready for Collection reads (`GET ready`, `GET allocations`) retain CP2 scoping, filters and pagination.

Consumable handover remains quantity-based, disallows assetId/serial and posts RESERVED -> CONSUMED. It creates no outstanding custody, due date, extension eligibility or physical return obligation.

`POST returns {commandId,loanId,expectedVersion,quantity:1,condition}` uses the **loan version**. The actual receiving officer must currently be assigned, hold TECHNICAL_OFFICER and differ from the borrower. Result: `{loanId,returnId,inspectionId,movementId,version:<loan>,inspectionVersion:0}`. The receipt permanently stores actual receiver, condition, quantity and database timestamp. Its asset moves BORROWED -> INSPECTION; receipt never clears equipment. Each identified loan holds one unit; partial return of a multi-unit request receives individual loan IDs independently. Other outstanding loans remain borrowed. `quantity` defaults to 1 for legacy callers. Legacy issues/returns may omit expectedVersion; new clients must supply it.

`GET loans` remains compatible and additionally supplies `version,originalDueAt`.

## Inspection and maintenance

`POST inspections {commandId,inspectionId,expectedVersion,outcome,condition,notes}` requires the inspection version and a currently assigned different officer. Nonempty condition/notes are at most 1000 trimmed characters. Outcomes:

| outcome             | Physical effect                                                                           |
| ------------------- | ----------------------------------------------------------------------------------------- |
| `UNRESOLVED`        | Remains INSPECTION; append event and increment version                                    |
| `CLEAR_AVAILABLE`   | INSPECTION -> AVAILABLE; inspection becomes terminal                                      |
| `ROUTE_MAINTENANCE` | INSPECTION -> MAINTENANCE; terminal inspection creates OPEN maintenance and initial event |

Result: `{inspectionId,version,workflowStatus,maintenanceId,maintenanceVersion}` (maintenance fields are null unless routed). Every inspection outcome is append-only with actor, condition, notes, version and timestamp.

`POST maintenance {commandId,maintenanceId,expectedVersion,status,notes}` requires the maintenance version and the same current officer/borrower separation. OPEN may move to IN_PROGRESS, RESOLVED_AVAILABLE or RETIRED. IN_PROGRESS may move to RESOLVED_AVAILABLE or RETIRED. Repeated IN_PROGRESS with a new command and all transitions from terminal statuses are rejected. Notes are required, 1–1000 trimmed characters. Resolution posts MAINTENANCE -> AVAILABLE; retirement posts MAINTENANCE -> RETIRED. Identity/history remain intact. There is no procurement or financial effect. Result: `{maintenanceId,version,workflowStatus}`. Events include the OPEN event and every transition's actor, notes, version and timestamp. Generic inventory movement/adjustment paths cannot bypass active lending inspections or maintenance.

## Due-date extensions

`POST extensions {commandId,loanId,expectedVersion,proposedDueAt,reason}` requires the current loan version and its borrower. Loan must be an outstanding returnable. Proposed date must be finite and later than current due date and database now. One pending extension per loan. Reason: 1–1000 trimmed characters. Result: `{extensionId,version:0,workflowStatus:"PENDING"}`.

`POST extension-decisions {commandId,extensionId,expectedVersion,decision,remarks}` requires the extension version, a PENDING request, unchanged previous due date, outstanding custody and a proposed date still in the future. Decision is APPROVE or REJECT; remarks are 1–1000 trimmed characters. Independent current authority follows the original line policy:

| Original policy | Eligible extension approver                                                  |
| --------------- | ---------------------------------------------------------------------------- |
| LECTURER        | Original designated lecturer, currently LECTURER and assigned to this lab    |
| HOD / BOTH      | Original designated HOD, currently ADMIN (the project's HOD authority model) |
| NONE            | Any currently assigned LECTURER for this lab                                 |

Borrower identity is always excluded, including identities holding multiple roles. Enabled session/user and current authority are rechecked on replay. Result: `{extensionId,version,workflowStatus,loanVersion,dueAt,originalDueAt}`. Approval changes current `dueAt` and increments loan version; original due date and request/decision history remain unchanged. Rejection leaves the loan due date/version intact. No administrative override or automatic extension is introduced.

## Scoped queues and history

All new reads return `{items,limit,offset}` with limit 1–100 (default 50), offset 0–10000 (default 0). Filters: optional `requestId,loanId,labId,limit,offset`. Only the queues below with listed statuses accept `status`. Unknown, null, unsupported status and allocationId filters are rejected. `handover-assets` instead accepts only allocationId/limit/offset.

| GET operation      | Meaning / status filter                                                                  |
| ------------------ | ---------------------------------------------------------------------------------------- |
| `borrowed`         | Returnables with outstanding quantity                                                    |
| `expected`         | Expected returns: outstanding returnables with their current due dates                   |
| `overdue`          | Outstanding returnables whose current due date is before database now                    |
| `inspections`      | Default UNRESOLVED; optional UNRESOLVED / CLEAR_AVAILABLE / ROUTE_MAINTENANCE            |
| `maintenance`      | Default OPEN and IN_PROGRESS; optional OPEN / IN_PROGRESS / RESOLVED_AVAILABLE / RETIRED |
| `extensions`       | All extension requests; optional PENDING / APPROVE / REJECT                              |
| `borrower-history` | Caller's own loans, including returned equipment and consumed supplies                   |

Operational reads include only the borrower, current assigned different officers, or current administrators. Extension reads additionally permit the current independent academic approver. Borrower history is always the caller's own. Former officers lose scope immediately. Reads are ordered by issue time descending and stable loan/inspection/extension IDs before pagination.

Each item includes `{id,loanId,requestId,allocationId,borrowerId,item,labId,assetId,serial,quantity,returned,outstandingQuantity,dueAt,originalDueAt,version,overdue,issuedAt,inspection,maintenance,extension}`. Overdue is derived, never a physical state; consumed or fully received loans cannot be overdue. `version` is the loan version. Inspection/maintenance/extension subobjects are null unless relevant to the queue. These nested records use database snake_case keys (including `id,version,status,created_at`), plus inspection `receipt,events`, maintenance `events`, extension `decision`. Receipt has `actor_id,quantity,condition,created_at`; event arrays retain all ordered versions. The nested record's version is used for its own mutation. Extension history is never overwritten.

## Verification

`tests/physical-lifecycle.integration.mjs` executes as lab_runtime inside a rollback-only synthetic transaction. It checks anonymous and identified handover, serial/asset duplicates, self-conflicts including multiple roles, reuse without new identity, partial return, receipt/inspection separation, unresolved and terminal outcomes, repair/retirement, stale/replayed approvals, revoked authority, overdue derivation, scoped queues, pagination, reservation ownership and balanced movements/cell reconciliation. Existing CP1/CP2/application/authority/sources/workflow DB suites and the inventory SQL suite are rerun. HTTP/browser acceptance and independent QA/security review remain separate.
