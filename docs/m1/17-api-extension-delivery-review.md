# API extension delivery review

2026-11-09. Backend assignment 48c1c1a0-5966-4db7-864f-3e736117b7bb returned a truncated OpenAPI extension ending inside Materialize schema. Zero teammate tool calls; no validation, writes or tests. The returned text is not a usable standalone specification and is not saved as JSON. Existing core draft remains unchanged.

Requested seven paths: POST /intents; GET /me, /catalogue, /requests/{requestId}, /approval-assignments, /collection, /loans/{loanLineId}. Visible portion contains paths and partial components only. Missing components/references cannot be inferred as delivered.

Rework: split into independently complete bounded artifacts, beginning with POST /intents and its six strict typed variants. Subsequent UI reads follow sequentially. Existing-asset issue must distinguish the current inventory guard version from a NEW loan custody generation created atomically by issue; an input must not require an already-existing future loan custody ID. Return must bind the original immutable loan custody generation. Exact reservation consumed quantity must be bound to intended effect where applicable.

Creation input excludes server-issued intent/slot IDs from its pre-creation payload hash. Define creation digest and execution binding separately to avoid self-referential hashing. Preserve original creation transport retry recovery, current authorization, policy gates and no physical-action authority from intent creation.

B04 remains incomplete. SEC findings open, policies deferred, tests NOT RUN, B05 permission-blocked. No operational implementation or M2 authorization.
