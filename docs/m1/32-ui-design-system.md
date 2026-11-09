# M1 synthetic enterprise UI

## Implemented scope

Owned source: src/app/page.tsx, src/app/preview/[flow]/page.tsx, src/app/globals.css, src/components/workspace.tsx, src/app/design-system/page.tsx. Existing four preview paths remain defined; root is inventory with overview breadcrumb. Query-based entry supports additional synthetic views. Role navigation is explicitly preview navigation, never authentication.

Inventory, requests, borrowing, approval queue, collection, return/inspection, HOD/Admin oversight, cohorts, reports, audit and directory use six invented records each. Lecturer own work uses My requests. All operations are disabled with a nearby explanation. Local search, lab filter, four-row pagination, read-only detail dialogs and navigation work with in-memory examples only. No network calls, persistence, real data, workflow integration or custody mutations.

## Visual system and reuse

Actual installed shadcn Button, Input, Table, Badge, Dialog, Skeleton and Separator are reused, without primitive/dependency changes. CSS @theme inline maps background/foreground, primary, secondary, muted, accent, destructive, border/input/ring and radius tokens. White/slate surfaces and restrained institutional blue #234f86; Arial system stack; 14px records, 16px headings, 24px page titles. Thin separators, 4-6px radii, spacing in 4/8px multiples. No KPI wall, gradients or decorative icons.

Desktop navigation is 216px (190px at intermediate widths). Below 768px, a labelled modal navigation drawer replaces it; selecting a local view closes it. All table columns remain available in a labelled focusable horizontal scroll region. Search and filter labels, caption, scoped headings, aria-current, result status, skip-link/main target and explicit focus styles are included. Controls target 44px minimum. Rendered accessibility remains unverified.

## State examples

/design-system illustrates typography/colour/spacing, buttons, read-only input, status and loading skeleton/empty/error/success/denied/offline/conflict/unknown states. It links to working local table/filter/pagination/detail-dialog examples; drawer is available at mobile width. Filtered-empty is functional. Other workflow states are illustrative, not execution-engine output.

## Domain boundaries

Stock lot is not academic cohort. Submission does not allocate stock; approval is not handover. TO must differ from borrower. Collection uses fixed reservation source with no substitution. Consumables have no asset/due/return. Receipt enters inspection, not clearance, and binds original custody independently of later approvals. Pending/absent/denied handover results never authorize repeated physical action. Institutional policies remain unresolved; no durations/admin bypass invented.

## Checks and remaining verification

Local npm run typecheck (tsc --noEmit) and npm run lint (eslint .) passed after initial implementation; rerun results after final navigation corrections are recorded in handoff. No install, package/lock/primitive/test/Git edits. No browser, build, server, HTTP or render check was performed by this agent.

Remaining: Orbit integration and Security/QA review; 360/768/1280px render, zoom 200%/reflow 400%, body overflow and table scroll, keyboard/screen-reader semantics, dialog focus containment/restoration, contrast and target measurements. No accessibility conformance or operational acceptance claim. All institutional policy and contract gates remain open as previously documented.
