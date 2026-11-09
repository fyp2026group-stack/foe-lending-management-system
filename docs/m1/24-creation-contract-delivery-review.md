# Replacement creation contract: incomplete delivery

Backend assignment 100ff633-adec-4261-9fde-0595e67d11b5 returned version 0.0.4-draft on 2026-11-09. Observed specialist tool calls: zero. Summary-only design; no file inspection, validation, implementation or tests.

The delivered text ends inside ExistingIssue.properties.binding at an incomplete $ref. MaterializeIssue, Consume, Return, Created and Error definitions and closing structure were not delivered. It is not a complete JSON artifact and does not supersede document18 as a usable specification.

## Reviewable proposals received

- Separate original caller requestFingerprint from immutable capturedPlanDigest. Creation retry looks up the existing actor/create-intent/key binding before checking mutable expectations and recovers its original plan under current authorization.
- Creation guard serializes lookup-or-create and rechecks unique transport binding. Intent, typed slot, captured plan and creation audit commit together.
- Named request/head/allocation/asset/source versions replace ambiguous expectedVersion. Source eligibility versions explicitly exclude unrelated balance changes; guarded current quantity checks remain required.
- Genuine reservation-only issuance, fixed source, original-custody return and atomic persisted inspection entry match the current proposed execution subset.
- Proposed canonicalization specifies unsigned UTF-8 key order, integer range 0..2147483647, duplicate/unknown/null rejection and lowercase UUIDs. Exact captured-plan schema is explicitly still unfrozen, and execution digest envelope remains insufficiently enumerated. No canonicalization closure is claimed.

## Required completion and review

Obtain the missing tail starting with the complete ExistingIssue schema through final closures, without repeating the already delivered prefix. Assemble as a separately versioned draft only after the complete content is available. Review exact fingerprint/digest envelopes, numeric/string escaping interoperability, typed bindings, scoped version invalidation and status consistency independently. Automated schema validation and runtime checks have NOT RUN.

SEC-01–09 remain OPEN. P01–P21/PR22–PR27 remain deferred and block affected behavior. B04 is incomplete; B05 remains blocked pending verified execution restrictions. This delivery does not authorize operational features or policy defaults.
