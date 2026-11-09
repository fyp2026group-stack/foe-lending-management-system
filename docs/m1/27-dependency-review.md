# Initial direct dependency review

2026-11-09, npm registry metadata/advisory queries approved through development command approval. No packages installed. Cache requested inside .cache/npm (Git ignored).

Observed installed runtime: Node24.19.0, npm11.17.0.

| Candidate | Registry version |
|---|---|
| next / eslint-config-next | 16.4.5 |
| react / react-dom | 19.3.1 |
| typescript | 7.0.2 |
| tailwindcss / @tailwindcss/postcss | 4.3.5 |
| postcss | 8.5.32 |
| eslint | 10.14.0 |
| @types/react / @types/react-dom | 19.3.0 |
| @types/node | 24.19.2 candidate matching runtime major |

Commands: npm view <package> version engines peerDependencies dist.integrity --json --cache .cache/npm (one package per query; all exit0). Initial multi-package npm view syntax returned Next metadata only; subsequent individual queries corrected coverage. npm view @types/node@24 version --json --cache .cache/npm returned major24 versions through24.19.2, exit0; latest-major26 types are not selected.

Next declares Node>=20.9.0 and React/DOM ^19 supported. ReactDOM19.3.1 requires React^19.3.1. ESLint10 declares Node^20.19/^22.13/>=24; eslint-config-next16.4.5 declares ESLint>=9 and TypeScript>=3.3.1. Package metadata compatibility is not full runtime proof or support-lifecycle review. Exact integrity strings were returned for queried latest packages; lockfile will retain resolved integrity after approved download.

Advisory query: PowerShell Invoke-RestMethod POST https://registry.npmjs.org/-/npm/v1/security/advisories/bulk with the eleven exact direct package/version pairs above except @types/node. Result empty JSON object {}; exit0. This means no matching advisories returned for that queried set at this time, not a clean transitive graph or comprehensive security certification. @types/node and resolved transitives need coverage before acceptance.

Proposed install uses exact pins, project-local npm cache, --ignore-scripts and no application/network integrations. Native optional binaries and any necessary build scripts require explicit review before enabling. No browser binaries, fonts or telemetry downloads authorized. Use built-in Node test runner where suitable rather than a large test dependency initially.

Remaining: independent source/dependency review, exact manifest/lockfile, full graph audit, lifecycle-script/native-binary review, build/lint/typecheck/test evidence. No dependency or toolchain pass claimed.
