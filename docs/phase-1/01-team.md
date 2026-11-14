# Team, ownership and independent review

## Actual setup

Sage is lead architect/project manager and author of this planning package. MausBot was asked to establish restricted specialists. Its report states: Codex engine `codex`, model `gpt-6.1-sol` is available; specialist creation inherits connected apps/default access; available controls cannot enforce document-only permissions, filesystem confinement, denied computer/integration/deployment access or a two-worker concurrency cap. It reports no bots created and no files changed. No specialist IDs or independent reviews exist. Do not treat this as an effective-permissions audit of the platform.

Least-privilege resolution: keep four specialist roles unprovisioned. Do not substitute broadly privileged helpers. Further provisioning requires verified enforceable restrictions or explicit user approval of a concrete alternative. Codex remains preferred where available.

## Responsibility matrix

| Area                                   | Responsible owner | Independent reviewer                              | Accountable                |
| -------------------------------------- | ----------------- | ------------------------------------------------- | -------------------------- |
| Requirements, ADRs, integration        | Lead              | Domain user + relevant specialist                 | Lead                       |
| API, transactions, migrations          | Backend/DB        | Security for protected changes; QA for invariants | Lead                       |
| Pages, forms, accessibility            | Frontend          | QA; Security for data exposure/auth flows         | Lead                       |
| Threat model, authorization assessment | Security          | Lead + QA, or external reviewer                   | Lead                       |
| Test harness, regression evidence      | QA                | Domain owner of tested module                     | Lead                       |
| Release readiness                      | Lead              | Security + QA + user                              | User authorizes deployment |

All specialist positions in this table are proposed, not staffed. User is authority for university policies. Lead does not invent institutional approvals.

## Ownership and operating limits

Backend owns `src/modules`, server adapters, `prisma`, API contracts. Frontend owns routes/components/styles; it consumes reviewed DTOs. QA owns `tests`; Security owns security verification records and findings. Lead owns docs, ADRs, integration configuration and shared contract arbitration. One active editor per file; shared contract changes are reviewed before dependent tasks begin. Owners may request edits but do not overwrite another worker's unmerged changes.

Target maximum: lead plus one active worker, sequential specialist passes. This is an operating rule, not a platform-enforced cap. No autonomous scheduling, integration access, package installation or production privileges. Future worker permissions should be scoped to project branches/files and synthetic fixtures; no real university credentials/data.

## Review process

Small branch per milestone/task; protected main; authored changes require another human or authorized specialist reviewer. Security-sensitive changes include auth, roles, record scopes, inventory transitions, SQL grants/functions, imports/exports and audit. Require Security plus QA evidence and backend review for database changes. Author cannot approve own change; an authoring Security specialist needs another qualified security reviewer. Without one, keep change blocked. Review includes migration/rollback compatibility, abuse cases, acceptance links and residual risks. Failed checks cannot be waived silently. Lead records exceptions and obtains explicit risk acceptance from user. No automatic merge/deploy.
