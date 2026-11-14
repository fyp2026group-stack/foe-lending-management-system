# Remediation verification status — 14 November 2026

Branch: `fix/report-exports-and-workflow-tests-20261114` (Draft PR #1).

## Verified in GitHub Actions
- Node.js 24 install and deterministic `npm ci`.
- TypeScript `npm run typecheck` succeeds.
- ESLint `npm run lint` completes with non-blocking warnings.
- Next.js production `npm run build` succeeds.
- Unit/source `npm test` succeeds.
- Temporary PostgreSQL provisioning, migration through 051, synthetic seed and runtime guard pass.

## PostgreSQL integration: NOT PASSED
Synthetic SQL test failures observed after isolating transaction-only tests from HTTP runners:
1. `tests/application-lending.integration.mjs:194`: lecturer approval response missing expected `stage: "APPROVED"`.
2. `tests/lending-authority.integration.mjs:112`: lecturer approval response missing expected `stage: "HOD"`.
3. `tests/lending-lifecycle.integration.mjs:209`: versioned approval returns `{status:422,code:"INVALID"}`.
4. `tests/physical-lifecycle.integration.mjs:647`: versioned lecturer decision returns `{status:422,code:"INVALID"}`.
5. `tests/workflow-basic.integration.mjs:119`: legacy decision response missing expected `stage: "HOD"`.

Those may reflect superseded test payload contracts or actual backend authorization defects. The current evidence does not establish which. Do **not** delete tests, weaken authorization, loosen stock checks, or mark complete before reproducing and resolving each.

## Remaining acceptance
- Run real authenticated browser workflows under each role (and multi-role) at desktop and mobile widths; compare against approved student, officer, lecturer and HOD design references.
- Verify multi-item mixed approvals, physical handover identification, return-to-inspection, inspection-to-available/maintenance, cancellation and extension replay.
- Historical multi-batch report attribution needs a defined per-event cohort policy before altering stored reports; current primary-batch filtering is not enough for comprehensive multi-membership analytics.
- HOD adjustment review still links to Inventory Oversight for final action; may benefit from in-place review with the existing transaction-safe backend.
- Public homepage and login branding must remain unchanged.

## Release gate
Keep this PR **draft** and do not merge to main unless the synthetic database integration and authenticated browser acceptance checks pass or reviewers explicitly record accepted exceptions.
