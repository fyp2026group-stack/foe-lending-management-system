# Laboratory Inventory and Equipment Lending — Phase 1

Status: DRAFT FOR USER REVIEW · 2026-11-08 · planning only.

No architecture, institutional policy, implementation, security certification or deployment is approved by these documents. No application code, dependency installation or deployment is included. Only synthetic data may be used in subsequent development unless separately authorized.

## Review package

1. [Team and review governance](01-team.md)
2. [Software Requirements Specification](02-srs.md)
3. [Assumptions and policy decisions](03-decisions.md)
4. [Architecture and technology](04-architecture.md)
5. [Database and ER design](05-database.md)
6. [Role and record permissions](06-permissions.md)
7. [Request and approval state machines](07-workflows.md)
8. [Inventory and physical identity](08-inventory.md)
9. [Comments and audit](09-comments-audit.md)
10. [Security and verification](10-security.md), with [ASVS applicability register](asvs-applicability.csv)
11. [UI/UX and page inventory](11-ui-ux.md)
12. [Milestones and approval gates](12-roadmap.md)
13. [Test strategy and acceptance](13-testing.md)
14. [Proposed source structure](14-directory.md)

## Approval checkpoint

Review the SRS, policy register, architecture, ER design and roadmap together. Record accepted decisions and exceptions by ID. Phase 2 requires the user's explicit approval; silence and document delivery are not approval. Independent technical/security review has NOT occurred. Provisioning specialist bots is blocked by reported missing enforceable access restrictions; written role instructions do not solve that restriction.

The current working directory was inspected and was empty before document creation. Environment permissions permit file writes. All project output remains in this designated directory. No repository has been initialized.

## Evidence and limits

These are design specifications, not verified application behavior. Test cases and performance targets are proposals; no application tests have run. Team setup facts are attributed to MausBot's report, rather than independently confirmed effective permissions. ASVS source metadata and document structure are checked during preparation; every implementation evidence field remains pending.

Sources checked 2026-11-08: [OWASP ASVS](https://asvs.owasp.org/), [official ASVS releases](https://github.com/OWASP/ASVS/releases), [Next.js authentication](https://nextjs.org/docs/app/guides/authentication), [Next.js data security](https://nextjs.org/docs/app/guides/data-security), [PostgreSQL transaction isolation](https://www.postgresql.org/docs/current/transaction-iso.html), [Prisma transactions](https://www.prisma.io/docs/orm/fundamentals/transactions). Version compatibility, supported runtime versions and security advisories must be rechecked before dependency selection. No library version is locked by this draft.
