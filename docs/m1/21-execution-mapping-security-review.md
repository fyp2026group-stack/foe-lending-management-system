# Execution mapping security review

2026-11-09. Security report cb8835c3-d6f9-4820-a36c-f7bbb6e28844: summary-only, zero tools, no file inspection, validation or tests. Both Orbit corrections in document 20 are coherent within the supplied subset. No SEC finding closed.

Stable caller fingerprint must recover original captured plan despite mutable state changes, without rebuilding plan or resetting outcome. Different caller expectations/content conflicts. Recovery always requires current authority. Return receipt may be independent of subsequent approval head changes but still requires current receiving authority, original loan/issue/asset/custody generation, outstanding quantity and current custody. PR22 unresolved.

## Finite conditions for consolidation

1. Intents belong to stable server-derived authenticated person IDs. Session renewal does not transfer ownership. Execution, rejection and recovery each require current capability/lab/record/field authority. No cross-person delegation is implied.
2. Specify per-operation version invalidation rather than a generic stock version that rejects unrelated legitimate reservations. Stale immutable intents cannot rebase; new intent creation still obeys cumulative entitlement/custody limits and physical reconciliation.
3. Freeze canonical comparator, integer range/encoding, duplicate-key rejection, map order and exact fingerprint/plan/execution digest envelopes. Hash equality grants no authority. Timestamp-bearing inputs unavailable until precision/normalization are fixed.
4. Common creation-key guard serializes lookup-or-create; recheck unique binding after lock. Pending intent, typed slot, captured plan and creation audit commit atomically. Lost response recovers original.
5. Reconcile JSON09/18 with document20: closed execution IDs, exact route assertions, bounded reservation-only issuance, safe status-specific errors and typed status/outcome DTOs. Add authorized UI reads. Earlier JSON remains draft-inconsistent until replaced and reviewed.

Backend owns API consolidation next. Independent review must assess the consolidated schemas. SEC01–09 OPEN, all tests NOT RUN, B04 incomplete, B05 permission-blocked, M2 unauthorized.
