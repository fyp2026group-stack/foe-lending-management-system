# Phase 1 architecture review

Date: 2026-11-08. Status: proposals for user approval; no development authorization inferred.

Reviewed all 14 numbered documents, README.md, asvs-source.json and all 345 rows of asvs-applicability.csv in `docs/phase-1`. The source package remains authoritative and unchanged. This folder is an additive review, not a replacement SRS or an approval record.

## Verdict

Retain the proposed modular monolith, Next.js/TypeScript, PostgreSQL ledger, conditional Prisma use, Tailwind/shadcn/ui, per-line policy snapshots, independent physical handover and synthetic-data-only development. The architecture is a credible starting point, but the logical schema and transitions are not yet precise enough to implement lending safely. No architectural rewrite is warranted.

The principal blockers are: ambiguous transfer ownership in the conservation equation; missing approved-date/extension and request-revision structures; undefined same-person dual-stage approvals; unspecified actor capabilities for several inventory transitions; and retry protection that needs a durable business-event identity beyond a client idempotency key. Resolve these before their affected workflows are built.

## Read the review

| File | Purpose |
|---|---|
| [Corrections](01-corrections.md) | Prioritized findings, precise amendments, source references and acceptance checks |
| [Policy decisions](02-policy-decisions.md) | All existing P01–P21 decisions retained; additional decisions and approval timing |
| [Desktop/mobile design plan](03-ui-ux-plan.md) | Information architecture, critical wireframes, interaction and accessibility acceptance |
| [Backlog and M1 proposal](04-backlog-and-m1.md) | Ordered work, dependencies, ownership, exit gates and bounded approval scope |
| [Security and evidence](05-security-and-evidence.md) | ASVS validation, verification gaps and additional test scenarios |
| [source-manifest.json](source-manifest.json) | SHA-256 and byte lengths for the 17 original files |
| [asvs-validation.json](asvs-validation.json) | Official pinned-source count, ID/level comparison and hash verification |

## Recommended first milestone

Approve **M1 Foundation and contract validation only**, estimated 1–2 active engineering weeks, subject to reviewer availability. Deliver version compatibility ADR, local scaffold/checks, logical/physical schema and grants design, transition/API contracts, synthetic fixture plan, and reviewed desktop/mobile wireframes. Production business workflows remain M2–M5; no live SSO, external integrations, real student data, deployment, automatic merge or bot provisioning is included.

M1 approval must explicitly accept the retained architecture/SRS as amended by this review, identify policy choices accepted versus deferred, and identify a qualified independent reviewer or leave the integration gate blocked. Deferred policy prevents its affected feature, rather than being silently treated as accepted. The proposed approval wording and detailed gates are in the milestone document.

## Evidence limits

This is the lead's document review, not an independent Security/QA assessment. No application exists, no application tests ran, and no control is certified. The pinned official ASVS source was checked on 2026-11-08: 345 unique register IDs, matching levels, matching recorded UTF-8 SHA-256. Applicability remains provisional. Future specialist briefs are prepared, not assigned; the restrictions in Phase 1 document 01 remain in effect. No related project automation exists; the unrelated standing day-summary automation was left unchanged.
