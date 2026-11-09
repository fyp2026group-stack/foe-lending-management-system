# Core OpenAPI QA review

Reviewer Lab QA Engineer;2026-11-09; supplied-structure review only. No file read, parser/reference validator, commands or tests. No syntax/schema/runtime passes. All SEC01–09 OPEN. Acceptance BLOCKED.

| Priority | Gap | Required completion |
|---|---|---|
| High | Five-path subset | Read/list/catalogue/intent issuance and remaining workflow contracts, explicit operation-to-test traceability |
| High | Replay identity | Intent ownership/operation/target binding, canonical payload/retention, cross-operation conflict, unknown-commit/crash semantics |
| High | Authorization timing | Atomic session/epoch/assignment/borrower/revision/terms/hold/expiry predicates, current replay disclosure |
| High | Handover/receipt | Anonymous materialization/serial capture, consumable terms, receipt fields, issue/asset consistency, duplicate receipt, one-line grouping/partial failure |
| Medium | Default HTTP errors | Explicit status entries, code mapping/retryability/concealed404/retry headers, UNAVAILABLE never permission for physical reissue |
| Medium | Schema evidence | Closed nested objects/oneOf/discriminator/refs/nulls/integers/strings, configured UUID-format enforcement, request/parser budgets |
| High | Audit/privacy | Required atomic success vs denial durability/gaps, safe minimal result/cookie/CSRF/no-store on all outcomes |

Reported independent command objects and closed status variants avoid earlier composition/state ambiguity in principle only. Later authorized evidence: OpenAPI3.1 validator and positive/negative instances; operation/field role+lab+record cases; real PostgreSQL concurrent/fault/expiry/audit tests; status recovery never interpreting absent/pending/inaccessible results as another handover permission.

All policies deferred. This review provides design feedback, not source-file or feature acceptance.
