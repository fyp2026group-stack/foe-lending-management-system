# B03/B04 dictionary and core semantics

Backend excerpt-based design, curated by Orbit; no file inspection by author, commands, tests or implementation. All institutional policy deferred, SEC01–09 OPEN, B05 blocked. This supplements rather than completes schema/OpenAPI acceptance.

Conventions: UUID keys; UTC timestamptz; NOT NULL unless marked optional; positive whole-unit movement magnitudes/nonnegative projections; historical FK deletion RESTRICT, no cascades; composite referenced tuples need matching UNIQUE constraints. Exact physical types/enums/index definitions remain reviewable design, not executable migration. Item kind/UOM immutable after ledger use.

Orbit correction: RequestRevision has NO single authoritative lab. A request may contain multiple labs; RevisionLine owns labId and scope indexes. ApprovedTerms/intent/event/loan/receipt bind that exact line lab. Stock lot distinct academic cohort. Borrower immutable across parent/revision, no delegated requesting.

| Record | Proposed columns and key/integrity design |
|---|---|
| RequestRevision | idPK, requestIdFK, revisionNo>0, borrowerPersonIdFK, createdAt, submittedAt optional, predecessorId optional; UNIQUE(requestId,revisionNo)/(requestId,id); predecessor same request; immutable submitted; borrower consistent parent |
| RevisionLine | idPK, requestId,revisionId,itemId,labId,kind,uomId,submittedQty>0,stockLotId optional; composite FK(requestId,revisionId), UNIQUE(revisionId,id)/(revisionId,id,itemId,labId); lot matches item; item kind/UOM match; index(labId,revisionId,id) |
| ApprovedTerms | idPK,revisionId,lineId,itemId,labId,decisionId,stageId,kind,approvedQty>0,dueAt optional,createdAt,predecessorTermsId optional; FK exact revision-line-item-lab and decision-stage tuple; UNIQUE(id,revisionId,lineId,itemId,labId); immutable; consumable due NULL; returnable approved due rule policy-blocked; required effective stage chain checked transactionally |
| AssetGuard | assetIdPK/FK,itemId,ownershipLabId,state,custodyId optional,version,updatedAt; UNIQUE(assetId,itemId); single authoritative custody; index(ownershipLabId,itemId,state,assetId); typed custody refs/state consistency require explicit enforcement |
| StockBucket | idPK,labId,itemId,pool,locationId optional,stockLotId optional,assetId optional,quantity>=0,version; asset-item composite FK; null-safe UNIQUE(labId,itemId,pool,locationId,stockLotId,assetId); identified quantity<=1; one unit cannot occupy multiple pools; source ownership distinct physical location |
| BusinessIntent | idPK,actorPersonId,operation,scope/typed target,revisionId optional,expectedVersion,canonicalVersion,payloadHash,state,createdAt,rejectionCode optional; enforced concrete target FK alternatives (no unchecked polymorphic IDs); TransportBinding UNIQUE(actor,family,key)->intent/hash; EffectSlot PK(intentId,slotId) binds exact line/lab/item/asset/terms/qty |
| BusinessEvent | idPK,intentId,slotId,operation,labId,typed target,occurredAt,actorPersonId,payloadHash; FK(intentId,slotId), UNIQUE(intentId,slotId); bindings agree with intent; ledger/projection/audit atomic; index(labId,occurredAt,id) |
| LoanLine | idPK,eventId UNIQUE FK,revisionId,lineId,itemId,labId,termsId,borrowerPersonId,academicSnapshotId,assetId,issuedQty=1,receivedQty>=0,lossResolvedQty>=0; returnables only; composite terms/revision/line/item/lab and asset/item FKs; received+lost<=issued; UNIQUE(id,assetId,itemId); consumables separate Consumption record |
| ReceiptLine | idPK,eventId UNIQUE FK,loanLineId,assetId,itemId,quantity=1,conditionText,inspectionId UNIQUE FK; composite loan-line/asset/item FK; custody/outstanding guard; cumulative receipt+loss<=issued; physical receipt creates unavailable inspection atomically |
| MessageVersion | idPK,messageIdFK,versionNo,authorPersonId,body,createdAt,supersedesId optional; UNIQUE(messageId,versionNo)/(messageId,id); predecessor same message, original author only; one successor/head, version ordering enforced under message lock; append only; current thread visibility applies |

Supporting Decision tuple uniqueness, immutable AcademicSnapshot, typed target tables, Consumption, EffectSlot, transport binding and custody-reference constraints must be expanded before full design acceptance. Scoped indexes never replace authorization. Individual table CHECKs cannot enforce cross-table conservation.

## Intent/grouping/materialization proposals

POST /api/v1/intents contract: session+CSRF, operation/target/revision/version/effect plan; actor/lab derived and scoped by server, reject client authority. Server issues intent/effect slots bound to canonical payload, immutable target and actor scope. No permission for physical action until execution rechecks. Cross-operation/target/revision reuse409. New intents cannot bypass custody/quantity bounds; manual duplicate physical act residual remains.

Core command commits one line/effect: identified returnable qty1 or positive consumable quantity. Physical group has server-created groupId, permanent effect slots/events, per-effect status. No implicit multi-line atomic promise. Partial completion preserves committed effects; reconcile original uncertain slots/evidence, never instruct repeat handover. A future grouped atomic command needs a separate complete contract.

Stock union: existingAsset(assetId,qty1); anonymousReturnablePool(item/pool,qty1,optional manufacturer serial) debits anonymous, creates permanent Asset+Guard and issues atomically; consumable(item/lot,positiveqty,approved consumable terms,NO dueAt/asset/return). Materialization rollback leaves neither asset nor issue. P11/P12/PR25 remain deferred policy dependencies.09-core-openapi lacks anonymousPool union and full grouping DTO; it remains incomplete.

Return binds exact loanLine+asset+item/current custody/outstanding. Same intent replay returns original authorized receipt. New intent cannot exceed issued bounds; manual disputes need evidence review. PR22 self/disabled-return unresolved, no service-failure bypass. No consumable return endpoint.

## Durable status and HTTP

Intent committed before business execution starts as pending. Transaction-held claim/event insertion/effect/audit one transaction, no separately committed lease. Pending can mean unstarted, executing uncommitted or rolled back; it is not execution permission. Server retry only under identity guards with confirmed rollback/no committed effect and reconciled physical uncertainty. GET absence/inaccessibility/pending never proof. Committed event immutable. Proposed final semantic rejection recorded after rollback requires conditional state transition under same identity guards; cannot overwrite a concurrent committed event. This race needs independent review.

Authorized result DTO: intent/state/correlation, committed event/version/group/slot, optional receipt, DB timestamp, authorized actor reference/lab/line/item/asset/qty/custody/terms, returnable due only, minimal academic snapshot label/reference where scoped. No raw student dumps. Redaction/current scope may omit optional fields.09 minimal Result not sufficient for full UI receipt acceptance.

401 UNAUTHENTICATED reauthenticate/reconcile;403 DENIED or concealed404 NOT_FOUND no disclosure;409 IDENTITY_CONFLICT or STALE_VERSION requires review not blind retry;409 IN_PROGRESS status check;409 POLICY_UNRESOLVED blocks;422 INVALID corrected controlled intent;429 LIMITED bounded technical retry only after physical reconciliation;503 UNAVAILABLE/COMMIT_UNKNOWN outcome uncertain, original durable identity recovery not second physical event. All private outcomes no-store/safe correlation. Explicit status entries/COMMIT_UNKNOWN schema still need09 update.

Lock protocol follows08: auth shared barrier -> persistent epoch FOR SHARE -> transport/event -> item/lab/asset -> request/shipment/loan/allocation/custody -> remaining rows; governance exclusive+epoch+grants atomic, stale SERIALIZABLE snapshot must abort whole transaction/new retry. Proposed unproven; exact keys/function rights/parameters remain outstanding.
