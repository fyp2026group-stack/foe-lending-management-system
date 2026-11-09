# Transaction/security remediation proposal

Backend design-only response, curated by Orbit, 2026-11-09. Summary-based sources; no commands/tests/DB proof. SEC03/04/06/07 remain OPEN pending independent review. All institutional policies deferred. B05 blocked. Full OpenAPI still incomplete.

## Lock/revocation proposal

Backend proposes SERIALIZABLE transactions plus transaction-scoped guards, ordered: global authorization barrier (shared business/exclusive governance), sorted transport/event guards, sorted request/shipment/loan/inspection/loss/maintenance/reconciliation aggregates, sorted ownership-lab/item/inventory/asset guards, then sorted concrete rows. Canonical tag/key ordering shared by every writer. Advisory collisions may add serialization but cannot replace uniqueness. Guards cover absent rows; unique constraints prevent duplicate inserts. Pre-discover dependencies, acquire complete ordered set, revalidate, rollback/restart if dependencies expand; never acquire backwards or upgrade shared barrier.

After guards recheck current session/grants, policy, immutable revision/terms, quantities and custody. Handover current relevant-lab TO != borrower. Conditional transition is logical linearization point contingent on commit. DB wall-clock sampled at protected transition; expiry equality denies. Atomic event/ledger/projection/success audit. No network while locks held. Proposed three total serialization/deadlock attempts with bounded jitter/deadline; semantic denials not retried. Exact jitter/deadline values pending.

Race expectations: reserve/issue share aggregate+stock guard; dispatch/receipt share shipment and both lab guards; receipts cannot exceed transit; governance exclusive waits for already-shared commands, later commands deny after revocation; absent identity inserts serialized. Unknown commit recovered by original identity, never blind physical retry.

OPEN REVIEW QUESTION: a SERIALIZABLE snapshot may be established before waiting for authorization barrier, so later reads need not see just-committed revocation. Backend's statement that barrier alone guarantees current grants is NOT accepted. Reviewer must specify a fresh-snapshot/locking protocol with proof, and assess whether aggregate-before-inventory matches the retained shared-item/lab-before-allocation rule and every writer. No closure claimed.

## Replay proposal

Transport key=(authenticated person, server-selected command family, Idempotency-Key), not session. Permanent event=(kind, server-issued authorized intent, bounded effect-slot), independent transport/cache/actor. Intent binds target/revision/evidence. Same physical effect should reuse intent; new intents for same physical act remain manual residual risk mitigated by custody/quantity bounds and duplicate review. No physical-world exactly-once claim.

Hash envelope includes canonicalization version/family/intent/slot/targets/expectedVersion/semantic body. Reject duplicate JSON keys/unknown fields; sort object keys; preserve arrays unless schema defines set; null differs omission except explicit default; IDs exact/no undocumented Unicode or case normalization; timezone-required timestamps normalize UTC at fixed precision; positive whole-unit quantities. Backend proposed rejecting exponent lexical quantity forms; interoperability/schema support requires review. SHA-256 canonical UTF8; preserve historical canonicalizers.

States: absent -> authorized claim; in-progress same hash409 COMMAND_IN_PROGRESS/different409 IDENTITY_CONFLICT; committed same hash authorized result replay/different409; retryable-no-effect bounded retry; final-rejected no effect replay/new controlled intent for correction. Unknown caller outcome uses authorized status lookup; initial absence does not prove no active commit. Durable attempt token fenced on takeover; every effect commit validates current token. Takeover timing and proof pending. GET cannot claim/retry/allocate/repair. Replay current authentication/capability/disclosure checks. Permanent dedupe tombstones survive response redaction, subject to approved privacy/retention design; no guarantee beyond it.

## Audit failure proposal

Success fields: audit/event/intent IDs, DB timestamp, actor/person/account, capability/scope refs, aggregate/version/action/outcome/correlation, canonical hash version/digest and minimal change refs. Denial fields: safe actor reference/action/reason/channel time/correlation. No tokens/credentials/full comments/raw student dumps.

Required success audit failure rolls back whole transaction. Failed transaction produces no success audit; separate bounded denied/failure channel survives rollback. Sink unavailable -> bounded durable spool; sink+spool unavailable -> keep access denied, safe minimal operational signal, explicit audit gap, never execute. Audit read outage fails read, no mutation. Safe infrastructure503 alongside401/403 or concealed404/409/422/429. Spool retention/capacity/alert/deadline parameters pending, no new external integration authorized.

## Principal/function proposal

Migration owner controls reviewed table/schema DDL/grants, not application login. Nonlogin function owner owns DEFINER functions not tables; explicit SELECT/INSERT/UPDATE per required business/projection family, audit INSERT only; no grant option/role management/schema CREATE. Runtime CONNECT/API schema USAGE/allowlisted EXECUTE only, no base-table reads/writes/DDL/ownership/TEMP. Reporting scoped function EXECUTE only. Backup controlled necessary read path, no business writes/commands/DDL/role changes; restore separately reviewed. Exact per-function object list still outstanding.

DEFINER bridges narrow granted access; INVOKER cannot bridge absent caller rights. Fixed trusted search_path with pg_catalog/trusted schemas/pg_temp last and fully qualified objects. Revoke PUBLIC execute/public schema CREATE/database TEMP effectively including inherited/PUBLIC grants; apply default privileges for EACH creator. Explicit schema/sequence privileges. Context derives from trusted server, not caller-chosen person arguments; transaction-local only, reject pool residual context. Server compromise/superuser/migration-owner misuse remain residuals.

Audit append via protected mutation; separate isolated denial writer INSERT-only; authorized scoped audit query functions; no normal UPDATE/DELETE/TRUNCATE. Exceptional retention requires approved mechanism.

Security re-review must assess design logic, not assert deployed grants or tests. No findings closed by this proposal.
