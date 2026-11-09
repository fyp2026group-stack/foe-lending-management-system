# M2 independent identity QA

## Orbit successful run and independent evidence review, 2026-11-09 16:28

Orbit reports fresh `node tests/m2-run.integration.mjs` exit0,15subtests plus parent=16passed/0failed/0skipped,duration4602ms, owned server27520. This is Orbit-observed execution, not a third independent QA suite run; retain earlier QA failure history above. Orbit reports verifying and stopping exact-project stale processes20416/27124/26988 before its run. QA did not perform those process stops.

QA independently inspected current runner and counter snapshot/restore implementation. Read-only Get-NetTCPConnection on3000 and Get-Process27520 returned no entries; command exit0. No source changes or suite rerun in this evidence task.

Counter integrity scope: outer finally restores attempts and until_at for rows present in initial login-unknown/global snapshot; nested limiter test restores its own prior login-unknown values. Newly created shared rows when absent initially are retained, as are randomized account limiter/fixture rows. Thus this is restoration of existing shared values, not complete database restoration. Exclusive disposable database use remains mandatory. Restore failures propagate; no independent DB before/after snapshot captured for Orbit's run.

Finite remaining gaps: runner awaits taskkill exit but does not assert cleanup exit status; point-in-time process/port checks are bounded cleanup evidence. Concurrent read/logout accepts either valid serialization, not deterministic lock schedule coverage. No browser, keyboard/screen-reader, responsive or accessibility verification. No complete protected-function abuse/concurrency/security acceptance; Security008/009 review pending. Successful suite establishes only its explicit identity HTTP/PostgreSQL assertions, not operational inventory acceptance.

## Foreground lifecycle runner, 2026-11-09 16:19

Read AGENTS.md and installed Next CLI guide before adding tests/m2-run.integration.mjs. Runner loads ignored config, clears NODE_OPTIONS, guards matching origin, owns server child, waits bounded Ready event, executes test child in foreground, propagates exit and taskkills only its own still-live PID tree in finally. No app request logs forwarded; DB URLs/verifier secret redacted from test output. Initial sandbox spawn EPERM; approved elevated execution completed actual tests.

First fresh run exit1: 15 subtests,13passed/2failed; Node totals16tests/13passed/3failed include failed parent. Passed authorization matrix, CSRF/origin, parser/arity, profiles/labs, chunked bytes, omitted labs, expiry, revocation/logout, FK rollback, concurrent logout/read, injected success-audit rollback and runtime privilege denial. Audit failure constraint restored; server31148 cleaned up. Two limiter failures reflected outdated global/raw-hash key assumptions. Migration008 uses login-unknown and login-account-prefixed keys; corrected tests accordingly.

Second fresh run exit1:13subtests passed/2failed, parent failed (Node totals13pass/3fail/0skip). Shared limiter saturation test passed. Denial and disabled-login expected401 received429, indicating retained shared unknown limiter contamination between test runs. Added guarded snapshot/reset/restore of pre-existing shared counters to isolate fixtures; authorization/privilege expectations unchanged. Next rerun exit1 before tests: Port/project already in use; no unrelated process stopped. Isolation fix remains runtime-unverified. Owned server31420 cleanup was attempted by runner; cleanup outcome is not independently proven, and this collision prevents a clean lifecycle verdict. No universal acceptance.

Remaining: successful clean rerun after shared-counter isolation, identify occupied project server, update stale contract global100 wording to deployed limiter semantics, verify runner cleanup fully releases project dev lock. No confirmed application authorization failure from executed suite; limiter/test-environment issues require resolution before green suite.

## Repaired-server attempt 2026-11-09 16:17

Did not start another server. Loaded ignored config in-process, removed NODE_OPTIONS for this command, derived missing M2_TEST_RUNTIME_DATABASE_URL from DATABASE_URL without output. Fresh integration exit1: parent1failed,0passed,0skipped; first login fetch failed ECONNREFUSED127.0.0.1:3000. PostgreSQL guard/connection/fixture insertion completed first; no authorization subtest ran. Prior readiness reported by Orbit did not establish server availability at this attempt. No polling or process changes performed.

Inspected migrations005-007. Updated success audit action oracle POST_USER->CREATE_USER to match protected interface. Added concurrent logout/read test (overlapping read may200/401, postlogout must401) and targeted success-audit CHECK constraint fault injection. Injection asserts disabled/roles/session revocation and success audit rollback, then drops the fixture-specific constraint in finally. This needs schema-owner privilege on dedicated test DB; no injection executed on this failed run. Exact lock scheduling remains unproven by the overlap test. Syntax exit0 and scoped ESLint exit0 after changes. All new integration cases NOT RUN until server is reachable.

## Actual integration attempt 2026-11-09 16:10

Loaded ignored .verification/m2.env without printing it. Added migration004 details.before/after assertions for PATCH roles/disabled/labs. Normal server launch failed spawn EPERM. Approved elevated launch encountered invalid NODE_OPTIONS (--env-file option); command-local loadEnvFile with NODE_OPTIONS excluded then reached EADDRINUSE on3000. No config files changed.

Ran `node -e` loading the environment, excluding invalid NODE_OPTIONS and importing tests/m2-identity.integration.mjs. Fresh exit1: parent1failed/0passed/0skipped. Guard, real PostgreSQL connection, current_database verification and transactional fixture inserts completed. First HTTP synthetic admin login returned503 rather than200; no session-to-database binding established, no administrative HTTP mutations or later subtests executed. This is a setup/login blocker, not a passing authorization suite. Synthetic fixture rows remain in the dedicated database.

Attempted isolated app3001 with command-local APP_ORIGIN override: fresh exit1, Next detected existing same-project dev server3000 PID10816 and refused second instance. Did not stop that process or remove locks. No QA-owned live server/session remains. Backend/Orbit must repair/restart the existing project dev server with the supplied test DB config before rerunning. Existing process ownership/configuration not independently established. Avoid retrying the suite until then; no polling performed.

## Extension 2026-11-09 16:05

Added executable integration assertions for streamed/chunked UTF8 >16KiB with no Content-Length, omitted laboratoryIds preservation-or-422 without silent assignment loss, idle expiry and fixed absolute expiry, login-denial audit/counter persistence, global limiter saturation across rotating accounts without new limiter rows, PATCH actor/target/action provenance and actual lab_runtime credential forbidden direct DML. Runtime credential is M2_TEST_RUNTIME_DATABASE_URL and must identify the same guarded database; missing credentials fail that prerequisite, never skip. Forbidden SQL uses WHERE false inside rollback transactions, avoiding real row mutations even if grants are excessive.

Limiter test sets the dedicated database global limiter to its documented threshold and restores its previous values in finally. Requires exclusive dedicated app/database use. It proves observable throttling and bounded account-row creation, NOT absence of password hashing; hashing order needs code/instrumentation evidence. No response-time timing assertion is used.

New local checks: integration syntax exit0; pure guard1passed/0failed/0skipped; scoped ESLint exit0. No M2_TEST_* configuration was exposed, so PostgreSQL/HTTP integration remains NOT RUN. No Docker/provisioning attempted.

Current inspected migrations add last_seen_at, compatible with explicit named fixture columns. Source now checks null/arrays/extra fields and route arity, addressing previous static observations; HTTP fixes remain unverified. Source still checks text.length after r.text rather than bounded streaming UTF8 bytes, and PATCH deletes staff_labs when laboratoryIds is absent; new tests target these concrete gaps. Protected functions are not yet in inspected migration grants, so direct-DML denial assertions are intentionally ahead of that remediation.

Audit before/after data is not yet in the inspected audit schema (id,actor_id,action,target_id,occurred_at). Harness checks actual state transition and corresponding actor/target/action; it does NOT claim stored before/after provenance. Backend must provide the finalized snapshot columns/interface before exact provenance assertions can be added. Audit-failure injection remains unimplemented.

Source inspected on 2026-11-09; HEAD 50591f1 (identity implementation is concurrent, uncommitted work, not covered by that commit). Inspected API contract, identity handler/route, DB adapter, both SQL migrations, seed/password code and client login/API adapter. QA edits only tests/m2* and this evidence file.

## Executable artifacts

- tests/m2-guard.mjs: opt-in and loopback/dedicated database guard.
- tests/m2-guard.test.mjs: executable pure configuration rejection cases.
- tests/m2-identity.integration.mjs: real PostgreSQL fixture creation, HTTP role matrix and database oracles. Excluded intentionally from default test glob. Missing configuration fails; no green integration skip.

Provision a disposable **local synthetic** database named lab_m2_test_<suffix>, apply the current migrations with the migration owner and start an isolated app using that database as lab_runtime. No other tests/users should share this app/database. Supply M2_TEST_ENABLE=synthetic-only, M2_TEST_DATABASE_URL (fixture owner connection), M2_TEST_APP_ORIGIN (plain HTTP loopback origin matching APP_ORIGIN). Supply credentials through the local environment, never logs or chat. Then run `node tests/m2-identity.integration.mjs`. This harness does not provision, migrate, launch a server, install, delete or reset a database. Fixtures are retained for inspection; dispose of the dedicated database separately when authorized.

The harness checks current_database before inserting fixtures, uses randomized example.invalid identities and passwords, and verifies the HTTP session hash exists in the guarded DB before administrative HTTP mutations. App startup configuration remains an explicit operator precondition. It asserts role-level privileges from PostgreSQL metadata; it does not independently prove the app connection uses that role.

Integration cases: anonymous/student/lecturer/technical officer/multirole/admin; no-store and session cookie attributes; origin/CSRF rejection without write; invalid JSON/null/array/extra fields; route arity; student profile/lab assignment validation; grant replacement/session revocation; disabled account/login; logout; success audit presence; FK failure rollback; runtime audit/schema privileges.

## Actual checks

- `node --check tests/m2-identity.integration.mjs`: no syntax diagnostics.
- `node tests/m2-guard.test.mjs`: 1 passed, 0 failed, 0 skipped.
- scoped ESLint on the three QA modules: no diagnostics.
- Combined inspection/check command exit 0. Integration NOT RUN: no M2_TEST_* environment configuration was present. No DB connection, HTTP request, install or server launch attempted.

## Finite findings / limits

At inspection time identity.ts parsed JSON into an assumed object without null/array checks; closed-object checks and GET/POST collection arity checks were absent despite published contract. These are source observations awaiting concurrent Backend corrections, not executed HTTP failures. Tests preserve the intended 422/404 contract. Fixture generation uses owner DML only on the guarded disposable DB; runtime API remains responsible for authorization.

Not covered yet: concurrent revocation interleavings, injected audit-write failure, login-rate-limit concurrency, direct SQL attempts as actual runtime credentials, accessible browser flows and inventory/domain operations. FK rollback plus success-audit presence is bounded evidence, not a complete audit-failure proof. A failing subtest may stop the remainder of that subtest; other sibling subtests remain independently reported. No production/security/full-M2 acceptance.
