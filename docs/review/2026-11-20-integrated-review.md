# Integrated application hardening review

Branch: prisma. Date: 2026-11-20.

## Completed fixes

- Reservations now consume both anonymous and identified available stock, preserving allocation-specific asset claims so inspected equipment can be lent again.
- Handover checks allocation ownership, prevents consuming another allocation's named stock, and releases issued asset claims.
- Common session authorization holds the shared identity advisory lock throughout its transaction. Independent integration review confirmed administrative identity writers acquire the exclusive counterpart before authorization, preserving lock ordering.
- Login displays allowlisted recovery messages for Google redirect failures. Inventory writes redirect expired sessions to sign-in while retaining typed validation diagnostics.
- Deployment readiness scanning excludes generated Prisma examples while continuing to reject application legacy SQL invocations.
- Added focused behavioral and regression coverage. Existing request-wide approval gating remains enforced before reservation and handover.

## Verification

Integration lead reran the settled working tree: npm test passed 154 tests, zero failures; npm run typecheck passed; npm run lint passed with zero errors and 57 warnings; prisma:validate and prisma:readiness:enforce passed. git diff --check passed. Initial restricted test execution failed to spawn workers; the approved rerun passed.

QA separately reported a successful production build before handoff. The lead's final build rerun was declined and did not execute; no fresh final-build claim is made. Generated next-env.d.ts build-path churn was excluded from the commit.

Security reviewer reported npm audit with zero known vulnerabilities. Offline OAuth tests do not establish successful live Google authentication.

## Unresolved release requirements

- High / release-blocking evidence gap: no running local PostgreSQL container was available. The new restricted grant migration, real permission enforcement, transaction rollback, inventory conservation, contention, and complete authenticated lifecycle remain unverified against PostgreSQL. Mock-based service tests do not prove these properties.
- Medium policy risk: verified Google ownership plus self-reported student identifiers does not prove institutional enrollment. No eligibility policy was changed without a decision.
- Unverified: live Google exchange, browser cookie behavior, rendered role workflows and mobile responsiveness, production configuration and recovery procedures.
- Low: 57 existing lint warnings remain.

Deployment readiness is withheld pending disposable-database integration checks and release environment verification. No production deployment, user-data deletion, or merge to main was performed. Migration application remains a release step, not a completed action.

Specialist evidence: 2026-11-20-backend-review.md, 2026-11-20-qa-baseline.md, and ../security-auth-review-2026-11-20.md.
