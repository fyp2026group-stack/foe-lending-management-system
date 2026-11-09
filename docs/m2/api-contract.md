# Current M2 identity contract

Synthetic, single-department, loopback development only. ADMIN identity management confers no academic or stock authority. No production acceptance.

Writes require exact APP_ORIGIN, a closed JSON object, streaming 16 KiB maximum and, after login, X-CSRF-Token. Responses are private/no-store. Collection paths reject trailing IDs.

- POST /api/auth/login {email,password}: returns {csrfToken} and HttpOnly SameSite=Strict session cookie.
- GET /api/auth/me: {user:{id,displayName,email,roles},csrfToken}.
- POST /api/auth/logout: revokes session and clears cookie.
- GET /api/admin/{users,batches,laboratories}: {items}, capped100.
- POST batches/laboratories: {name}.
- POST users: {email,displayName,password,roles,batchId?,registrationNumber?,laboratoryIds?}. STUDENT requires batch and registration; laboratory assignments require staff membership. Password12-128 characters. Current ADMIN, session, CSRF and bounded person/session admission precede hashing; final mutation rechecks authority.
- PATCH /api/admin/users/{UUID}: {roles,disabled,laboratoryIds}, all required. Explicit assignment replacement; empty array clears intentionally. No name/email/password/profile edits. Self-change denied; target sessions revoked. Adding STUDENT requires an existing complete profile.

Role identifiers: STUDENT, LECTURER, TECHNICAL_OFFICER, ADMIN. Multiple memberships supported. User rows include batchId, registrationNumber, laboratoryIds.

Sessions use hashed opaque random tokens, absolute8h/idle30m expiry. Password work uses salted async scrypt N16384/r8/p1,64bytes, at most2 concurrent jobs/no queue. Known-account budgets are separate from shared unknown/disabled-account admission. Targeted lockout and timing remain residuals.

Runtime has no direct identity-table access. Narrow protected functions derive current actors from tokens and atomically couple governance with before/after audit. Fixed error codes; exception responses include correlation IDs. Caller-reported denials are not independently proven events; durable suppression counters have protected ADMIN access.

Applied checksum-tracked migrations001-009 to isolated PostgreSQL15; repeat migration/seed verified. Orbit executed HTTP/PostgreSQL suite16passed0failed0skipped. Evidence: qa-identity-evidence.md, protected-identity-evidence.md, final-admission-evidence.md. Browser/accessibility demonstration pending.

Residual: login verifier can obtain rate-limited account password hashes; offline guessing after runtime SQL credential compromise remains possible. No university SSO/MFA/production approval. Credentials stay in ignored local configuration, never printed/committed. Setup instructions and earlier evidence are historical where superseded by this contract and final-admission evidence.
