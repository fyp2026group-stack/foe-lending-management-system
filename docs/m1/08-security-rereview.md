# Independent remediation re-review

Lab Security Reviewer, 2026-11-09; supplied-summary review only, no file inspection/tools/tests. SEC03/04/06/07 remain OPEN. This addendum supersedes conflicting lock/revocation proposals in02/07; not an executed PostgreSQL guarantee.

## AC-03A authorization epoch proposal

Stable pre-existing global authorization epoch row. Every mutation of authorization dependencies (roles, grants, lab memberships, account disablement, session revocation) atomically updates epoch through the controlled DB pathway. Protected command starts new SERIALIZABLE transaction, acquires shared transaction advisory barrier then locks epoch FOR SHARE BEFORE any transport/inventory/custody guards. If snapshot predates an epoch update, locking the changed row must abort with serialization failure; retry whole transaction/new snapshot and discard cached authorization. After successful row lock evaluate session/current grants from snapshot, keep locks through commit. Governance begins with exclusive barrier, updates epoch+authority atomically, then commits; never downstream locks first.

Intended guarantee: no command commits with pre-revocation authority after revocation commit. Previously admitted command may finish before revoker commits. Not instant cancellation when revocation requested. Full epoch coverage, selected PostgreSQL lock semantics, clock expiry, external IdP visibility and pool behavior require later proof. Never claim advisory waiting alone refreshes SERIALIZABLE snapshot.

## AC-03B total order

Authorization barrier -> epoch -> transport/event guards -> item/lab/asset guards -> request/shipment/loan/allocation/custody guards -> remaining concrete rows. Stable category/key encoding required for ALL writers. This restores retained inventory-first design;07 aggregate-first proposal rejected pending separate ADR if reconsidered. Discover dependencies without downstream locks, acquire full set in order, revalidate, rollback/rediscover if changed; never add backwards locks. Complete category inventory, retry/deadline values and linearization examples outstanding.

## AC-06A replay

Server intent binds actor/scope/operation/target/revision/allowed effect slots. New intent cannot bypass custody/business bounds. Define state transition owner/permissions; distinguish attempt denial from permanent event rejection. Choose transaction-held claim or separately committed lease, not ambiguous hybrid. Fence current token atomically with event/ledger/projection/audit commit, not preflight check. No-effect retry requires durable proof; initial status absence is insufficient. Status query current scope/minimal disclosure, no mutation. Canonical encoding must define timestamp precision, integer range, Unicode/default/null/set ordering and duplicate JSON rejection before parser discards duplicates. Exponent lexical rejection is optional schema choice, not a security necessity. Retention/takeover/intent authority remain unresolved.

## AC-04A privileges / AC-07A audit

Every function requires owner, audience, object/sequence rights and trusted context source. Verify effective inherited/PUBLIC/default/schema/database ownership privileges later. DEFINER owner privileges narrow; audit INSERT-only does not protect against owner/superuser, residual explicit. Reporting/backup scope no bypass.

Denied spool needs process/host durability, capacity/full behavior, access/integrity, replay/deduplication/recovery/alert contract. Both sink+spool failure keeps denial and safe operational signal; acknowledge gap on recovery, never call missing event durably audited. Infrastructure failure cannot cause mutation or unsafe replay.

All SEC01–09 remain open; designs improve coverage without closing acceptance. No institutional policy, provider, implementation or ASVS passes accepted. B05 blocked by unverified execution restrictions.
