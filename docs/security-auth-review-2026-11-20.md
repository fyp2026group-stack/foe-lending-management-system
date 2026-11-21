# Authentication security review — 2026-11-20

Scope: identity API dispatch, password login/session services, Google OAuth and student registration, admission, page access, and dependency audit. Local branch: prisma. No commit or deployment performed.

## Change requiring independent review

**Medium: inconsistent transaction protection against concurrent identity changes.** `authorizePrismaSession` previously relied on each caller to acquire the shared identity advisory lock. Several reads (including identity, admin reports and inventory directories) did not acquire it. At Read Committed isolation, role or membership changes could interleave between authorization and the protected read. Most mutation services already acquired the lock themselves.

The common verifier now acquires `pg_advisory_xact_lock_shared(731942)` before reading the session. The transaction retains this lock through the protected operation; administrative identity changes use the exclusive counterpart. Invalid token syntax still returns before database access. The author of this change does not independently approve it.

Changed implementation: `src/lib/server/services/prisma-session.ts`.

Added tests: `tests/session-security.test.mjs` and `tests/google-oauth-security.test.mjs`.

## Verification

- Focused suite: 22 tests passed, zero failed. Command: `node --test tests/session-security.test.mjs tests/google-oauth-security.test.mjs tests/google-student-identity.test.mjs tests/google-student-registration.test.mjs tests/page-role-access.test.mjs tests/session-redirect.test.mjs scripts/password.test.mjs scripts/work.test.mjs`.
- New session tests execute the actual TypeScript verifier with synthetic transaction mocks. They cover lock order, invalid syntax, revoked/expired/idle sessions, disabled users, CSRF, role denial and a failed atomic session touch.
- New OAuth tests transpile the actual module while substituting only its database service import. They exercise authenticated encryption, ticket tampering, oversize rejection, flow/signup purpose separation, PKCE setup, state mismatch, origin enforcement and ticket expiry. No Google or database requests are made.
- ESLint passed for all three files owned by this change.
- `node node_modules/typescript/bin/tsc --noEmit` passed on the final shared working tree.
- Online `npm audit --json` exited 0: zero known vulnerabilities, 663 total dependencies in its metadata. This is advisory coverage, not proof dependencies are vulnerability-free.
- Full suite at an intermediate shared-tree snapshot: 138/143 passed. Three foundation HTTP checks failed with connection reset/refused. Two lending tests failed during another developer's transient duplicate-variable edit. After that edit was corrected, all four tests in `tests/prisma-identified-reservations.test.mjs` passed; no full-suite green result is claimed.
- `scripts/admission.test.mjs` stopped at its dedicated-local-database guard. No database configuration was changed to bypass it.

## Remaining limits and requirements

- Real PostgreSQL lock contention, role-revocation races, and live login/logout require a dedicated synthetic database integration run. Unit mocks establish call ordering but do not prove database scheduling.
- Live Google token exchange, signature verification with Google keys, and browser cookie behavior were inspected in source but not exercised end to end.
- Student enrollment accepts any verified Google account and self-reported student identifiers. Source explicitly documents this behavior. Google account ownership does not establish university enrollment; retain as a policy risk for Orbit/project-owner review if lending eligibility requires institutional verification. No enrollment policy was changed.
- Failed foundation HTTP checks remain unresolved in this review. Changes from other developers were preserved.
