# B04 — API and capability draft

Status: proposed future-feature contracts, NOT an implemented API or a complete OpenAPI specification. Backend provided a route matrix; Orbit corrected policy mappings. Independent Security and QA review, complete per-operation request/response schemas and machine-readable OpenAPI remain outstanding.

Base: `/api/v1`. Every operation authenticates server-derived actor, current capability, lab/record relationship and transition state; client identity/role fields never grant authority. Lists, details, counts, nested relations, comments, metrics and exports use the same scope. No universal admin bypass or delegated borrower request. PR26 gates grant governance; PR27 gates catalogue policy fallback only, not every authority definition.

## Proposed POST command matrix

All named capabilities below are proposed checks, not granted institutional powers. Deferred policies block activation. Existing explicit SRS invariants remain mandatory regardless of pending policy choices.

| Resource/action                                                                         | Current authority and guards                                                                                                     | Principal policy dependencies |
| --------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- | ----------------------------- |
| requests/{id}/submissions                                                               | Active own borrower; immutable revision; valid explicit policy/eligible lecturer/terms                                           | P04/P07/P09/PR27              |
| approval-assignments/{id}/decisions                                                     | Current assigned academic capability, correct stage/revision; actor != borrower; proposed distinct stage people                  | P01/P02/P03/P04/P09           |
| reservations                                                                            | Authorized allocator; final approval, eligible unissued remainder, stock under lock                                              | P05/P06/P21                   |
| request-lines/{id}/cancellations                                                        | Own or explicitly authorized cancellation; unissued only; atomic hold release                                                    | P04/P05/P06                   |
| handovers                                                                               | Different assigned lab TO, active borrower, approved terms/live hold, identity evidence/internal assets, academic batch snapshot | P07/P10/P11/P12/PR25          |
| return-receipts                                                                         | Receiving lab TO != borrower under proposed rule; physical outstanding quantity -> inspection                                    | P20/PR22/PR25                 |
| issues/{id}/extensions; extensions/{id}/decisions                                       | Borrower proposes; independently authorized academic actor decides immutable old/new terms                                       | P07/PR23                      |
| inspections/{id}/decisions                                                              | Explicit clearance/disposition capability; valid unavailable pool, clearance independence unresolved                             | P20                           |
| maintenance-orders; maintenance-orders/{id}/completions                                 | Assigned maintenance/disposition capability; valid source/destination pool                                                       | P20                           |
| loss-cases; loss-cases/{id}/resolutions; loss-cases/{id}/recoveries                     | Evidence/current custody; different approved loss authority; once-only closure/recovery bounds                                   | P16/P20/PR25                  |
| retirements                                                                             | Explicit inventory/disposition authority and approved decision                                                                   | P16/P20                       |
| transfers; transfers/{id}/decisions; shipments/{id}/dispatches; shipments/{id}/receipts | Source proposer, independent approver, source dispatcher, destination receiving TO; exact line/quantity bounds                   | P16/PR24/PR25                 |
| adjustments; adjustments/{id}/decisions; adjustments/{id}/postings                      | Lab-scoped proposer, different approved controller, unique authorized posting                                                    | P16                           |
| imports; imports/{id}/validations; imports/{id}/commits                                 | Bounded staged parse/preview followed by explicit authorized commit; no upload auto-posting                                      | P16/P19                       |
| reconciliations; reconciliations/{id}/decisions; reconciliations/{id}/postings          | Scoped evidence; independent approval for adjustments; unique posting                                                            | P16                           |
| exports                                                                                 | Current record/field/history scope; bounded filters; formula-neutralized CSV/XLSX                                                | P14/P18/P19                   |
| stock-openings; stock-receipts; asset-identifications                                   | Explicit inventory authority/provenance; opening not receipt twice; paired identity conversion                                   | P11/P12/P16                   |
| threads/{id}/messages; messages/{id}/versions                                           | Current context/thread visibility; only original message author corrects own latest head                                         | P13/P14/P18                   |

Consumption is the consumable handover posting, not a second independently callable posting of already issued stock. Session/link/bootstrap/MFA design depends on P15/PR26 (not P12); no login implementation is authorized. Scoped GET contracts require concrete DTOs, allowlisted sorts/filters and bounded pagination, with exact configurable limits still unresolved. Business-event recovery/status reads must authorize both record and result disclosure.

## Common request/result design

Mutation envelope: opaque stable commandId/businessEventId, expectedVersion for existing aggregates, command-specific target/revision/terms/positive integer quantities. Idempotency-Key is a separate actor+command transport key. Asset line quantity is exactly one; no consumable dueAt. Server rejects unknown or client-authority fields. Canonical hashing covers semantically relevant normalized fields; algorithm/version/schema, namespace and tombstone retention require explicit completion before acceptance.

Success result contains event/command identifier, resulting aggregate version and minimal authorized DTO plus correlation ID. Standard errors: 401 invalid session; consistent 403 or concealed404 for scope denial; 409 state/version/stock/conflicting key; 422 safe field validation; 429 bounded retry hint. No SQL, tokens or stack traces. Privileged mutations fail closed if required success audit cannot commit. No protected browser/service-worker caching.

Same durable identity/same hash cannot repost after transport-cache expiry; changed payload gives409. In-progress duplicate never executes independently; precise status/retry contract remains a review issue. Unknown commit is resolved through authorized durable event lookup before another physical confirmation. Current read permission is checked before returning saved results. Approvals never issue; UI timeout never instructs duplicate physical handover.

## Completion blockers

Before B04 acceptance: complete OpenAPI operation IDs, all request/response/error schemas, read/query routes, DTO visibility, concrete FK/enum/null rules, header/security definitions, policy dependency links, invalid-transition examples and synthetic examples; decide canonical hashing/response replay details, audit-failure behavior and resource bounds; independent Security and QA review. No request has been executed and no API validation/test passes are claimed.
