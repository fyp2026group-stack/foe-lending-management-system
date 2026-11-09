# ADR: bounded M1 toolchain compatibility exception

Status: implemented temporary exception, independent QA pending. No institutional policy choice. Backend13eb39c0 reviewed Orbit-supplied evidence only; no independent execution.

Keep TypeScript6.0.3 rather than7.0.2: installed typescript-eslint8.72.1 declares >=4.8.4 <6.1.0 in its package metadata; TS7 produced an actual lint error. Node24.19.0 satisfies selected runtime engines.

Override ONLY minimatch versions >=7 <11.0.1 to11.0.1. The earlier global override was narrowed so unaffected version3 consumers retain their supported major. Advisory GHSA-g3hv-75wg-m249 affects >=7 <11.0.1. This does not prove all matching semantics are equivalent.

Resolved edges from exact lockfile:

- @eslint/config-array requests ^10.2.4; eslint requests ^10.2.6; @typescript-eslint/typescript-estree requests ^10.2.2. These cross the major boundary to11.0.1.
- eslint-plugin-import, eslint-plugin-jsx-a11y and eslint-plugin-react request ^3.1.2 and now resolve separate3.1.5 copies, not11.

Removal condition: replace affected consumers with compatible upstream releases declaring a patched supported minimatch range, recheck advisories and matching fixtures, then remove the temporary override. Do not remove the fix merely to eliminate an exception. No automatic force upgrades.

Added lint-boundary regression: invalid nested TypeScript path must trigger no-explicit-any; .next/.cache/coverage/next-env remain ignored; actual Panel source remains included. Uses ESLint programmatic API without creating an invalid on-disk fixture.

Clean root npm ci was attempted with approval and failed EPERM unlinking project-local lightningcss native binary. No forced deletion or unrelated process termination. Alternative clean verification uses new .verification under the project, copied exact package manifest/lock/.npmrc, npm ci with scripts disabled and cache in the project. Final results remain in isolated-clean-install.log; root recovery in workspace-install-recovery.log. Preserve the failed log clean-install.log.

This ADR and runtime checks are bounded foundation evidence; SEC01-09 remain open, no operational domain or PostgreSQL grants have been implemented or tested.
