# Independent local QA and deployment baseline

Date: 2026-11-20, Sri Lanka time. Branch: `prisma`. Starting HEAD: `4e70818160654db311dd8c1d89cc8458b931c674`. Shared working tree changed during review; results describe the observed working tree, not a frozen release revision.

## Confirmed infrastructure defect fixed

`npm run prisma:readiness:enforce` rejected two raw-query documentation examples in ignored `src/generated/prisma/internal/class.ts`. This blocked the deployment precheck even though no application SQL invocation remained. The scanner now excludes only the generated Prisma client directory. Regression coverage creates an isolated temporary source tree and proves generated examples pass while an application unsafe query still fails.

QA-owned files: `scripts/prisma-readiness.mjs`, `tests/prisma-readiness.test.mjs`, and this report. No commits, installations, database writes, deployments or changes to other engineers' source files.

## Executed evidence

| Check | Observed result |
| --- | --- |
| Node runtime | v24.19.0, supported by package engines |
| Initial npm test | 131 passed after sandbox worker restrictions were resolved |
| Final npm test after fresh build and concurrent team fixes | 151 passed, zero failures/skips |
| Targeted readiness regression and password test | 2 passed |
| npm run typecheck | Exit 0 on earlier working tree; final production build also completed TypeScript checks |
| npm run lint | Exit 0, zero errors, 57 warnings on earlier working tree |
| npm run prisma:validate | Schema valid, exit 0 |
| npm run prisma:readiness:enforce | Zero legacy SQL invocation sites after fix |
| Final npm run build | Exit 0; compilation, TypeScript, page generation and optimization completed |
| docker ps | No running containers |

Initial restricted test/build attempts failed with spawn EPERM; those were environment failures, not application failures. Approved reruns executed successfully outside that restriction. One intermediate build found duplicate `movementId` declarations in the concurrently edited reservation service. The backend edit removed the duplicate before the final successful build; QA did not edit that file.

## Unverified release requirements

No database was proven disposable, so no database lifecycle, concurrency, migration execution, permission or ledger-conservation checks were executed. Database names alone do not prove data is disposable. Existing database configuration was not used to mutate data. The repository has isolated PostgreSQL CI workflow definitions, but their remote execution/results were not verified here.

Most default tests are source checks and pure behavior tests; the foundation tests additionally start a loopback production server and verify unauthenticated HTTP behavior. Passing this suite does not prove authenticated end-to-end correctness, real browser accessibility/responsiveness, stock races, backups, restoration, performance or production configuration.

Release recommendation remains withheld pending disposable PostgreSQL lifecycle/concurrency evidence and the independent security review. Lint warnings are unresolved low-priority cleanup, not build blockers. Run final release checks against the exact integrated commit after all team edits settle.
