# Laboratory Inventory System

M1 local foundation. Phase 1 planning is preserved in docs/phase-1.

The initial source contains a responsive, non-operational workspace overview and a reusable panel. All displayed content is synthetic. No authentication, database connection or workflow mutation is implemented.

Dependencies are pinned in package.json and package-lock.json. Lifecycle scripts are disabled by .npmrc. Use Node24 and the project-local npm cache.

Local commands: npm run dev (127.0.0.1), npm run lint, npm run typecheck, npm run build, then npm test. The HTTP tests launch a temporary loopback-only production server and stop it afterward. Set NEXT_TELEMETRY_DISABLED=1 for Next commands. No browser automation is required by these checks.

The overview links to four synthetic, non-operational page layouts. Build and HTTP checks do not establish visual, keyboard, screen-reader or accessibility conformance. See docs/m1 for exact evidence and unresolved findings.
