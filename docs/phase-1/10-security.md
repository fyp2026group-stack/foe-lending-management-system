# Threat model and verification plan

Baseline: OWASP ASVS **5.0.0**, applicable L1 and L2 requirements, with selected L3 controls considered by risk. This is a target, not a certification. `asvs-applicability.csv` inventories official requirement IDs and provisional applicability. Conditional requirements need feature-specific resolution; no unresolved applicability decision at release. Each applicable row needs implementation reference, test evidence, reviewer and result. No controls have passed implementation testing.

## Trust boundaries and protected assets

Untrusted browser → TLS edge → server identity/authorization → domain service → PostgreSQL; optional institution IdP → app identity mapping; authorized operator → migrations/backups; import file → constrained parser; authorized report → downloadable spreadsheet. Protect student registration/batch/identity, staff roles, custody/asset integrity, approval evidence, comments, sessions, audit and backup contents. Threat actors include anonymous attackers, malicious/compromised borrowers/staff, mistaken officers and privileged operators. Server compromise and DB superuser abuse remain material residual risks.

| Threat | Mitigation design | Required verification | Residual risk |
|---|---|---|---|
| IDOR/BOLA, hidden-route access | Service and query record scopes, deny default, minimal DTOs | Every role × own/other/lab relation across reads/actions/exports | Missing new entry point until regression catches it |
| Role escalation/self dealing | Explicit capabilities, no client roles; identity conflict guards; audited grants | Mass assignment, multi-role self approval, sole TO scenarios | Legitimately authorized collusion |
| Session theft/login abuse | TLS, Secure/HttpOnly/SameSite cookies, rotation/revocation, MFA for privilege, rate limits | Logout/revocation, fixation, brute force, replay, OIDC state/nonce/PKCE | Compromised device/IdP |
| Injection/XSS | Bound parameters, schemas, text encoding, CSP, no raw HTML | SQL/sort/filter injection, stored comment and CSV payloads | Vulnerable dependency/runtime |
| CSRF | SameSite plus anti-CSRF/origin checks for every cookie-auth mutation | Cross-origin form/action, missing/invalid token, state-changing GET | Same-origin script compromise |
| SSRF | No user URLs/import fetch; future outbound allowlist + network egress policy | Redirect/DNS/private address abuse if enabled | Operator-approved outbound changes |
| Double lending/stock corruption | Atomic ledger, locks, constraints, idempotency and conflict handling | Concurrent final-unit issue, duplicate return, expiry race | Manual out-of-system custody |
| Audit/comment tampering | Separate owner/runtime grants, append functions/triggers, no cascades | Direct runtime SQL update/delete/truncate denied; version race | Superuser/backup manipulation |
| Import/export exploitation | Size/row limits, file signature/type checks, no macros/formulas, safe cells | Zip-bomb/XLSX resource limits, formula injection, malformed row rollback | Human reuse of exported data |
| Data exposure | Field minimization, scoped aggregates, no private caching, safe logs | SSR payloads, browser cache/logout, backup/log access | Authorized recipient redistribution |
| DoS/resource exhaustion | Per-identity and edge rate limits, query/file bounds, timeouts | Expensive filters, login flood, exhausted DB pool | Volumetric attack beyond host capacity |
| Supply chain/configuration | Lockfiles, supported versions, dependency/container scan, no secrets in image, non-root | Reproducible build, secret scan, TLS/header/config review | Undisclosed vulnerabilities |
| Backup loss/ransomware | Encrypted off-host copies, restricted credentials, recovery exercises | Restore into isolated staging and reconcile ledger | Recovery interval data loss |

Local authentication, if selected, needs vetted password hashing (Argon2id), breached-password screening policy, secure single-use expiring recovery, enumeration-safe replies and no default credentials. SSO is not permission management. Privilege revocation and session refresh semantics must be tested with the selected auth library. Proposed privileged MFA cannot be declared delivered until institution IdP or local implementation is verified.

## Independent assessment and release gate

Security reviewer cannot approve their own sensitive implementation. QA executes authorization/concurrency regression; separate security reviewer performs manual abuse testing plus SAST/dependency/secret scanning and scoped dynamic testing in synthetic staging. Findings record severity, exploit preconditions, affected requirement, fix owner, evidence and independent retest. Release requires no unresolved critical/high findings; lower findings need documented owner, mitigation and explicit risk acceptance. No production penetration testing or external scanner connection without authorization. If independent reviewer unavailable, security gate remains blocked.

## ASVS register interpretation

L1/L2 rows default candidate-applicable, not blindly asserted applicable. Chapter-level optional feature flags identify file/OAuth/API token/WebRTC cases needing precise review. WebRTC absent → provisional not applicable with rationale; optional local credentials/SSO/file operations remain conditional until chosen. Every N/A requires independently approved rationale. Higher-level rows marked additional risk review. The register intentionally uses identifiers/section labels and project-specific rationale instead of copying the standard's requirement text; consult the official version when reviewing each row.

Sources: [ASVS 5.0.0 official releases](https://github.com/OWASP/ASVS/releases), [ASVS project](https://asvs.owasp.org/). Source metadata in `asvs-source.json` records the pinned official v5.0.0 release URL and SHA-256. All 345 requirement IDs were checked against that tagged source. Applicability and implementation evidence still require independent review.
