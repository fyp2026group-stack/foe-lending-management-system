# M1 UI source QA corrections

## Changes

- Navigation now uses normal Next links: inventory /; requests/approvals/collection/returns use existing /preview paths; other views use /?view=. No React state-only view switching. WorkspaceContent is keyed by initialView so a route-driven view change resets search, lab, pagination and selection even when the framework retains the outer component. Existing root query parsing remains unchanged.
- Shared inventory, requests and borrowing are labelled Shared workspace and occur once in each navigation instance; role-specific groups no longer duplicate current-page targets. Preview labels do not imply authorization.
- workspace-fixtures.ts exports deterministic equipment-only syntheticLoans and syntheticLoanRows. Borrowing/returns use identical loan, asset, laboratory, issued/received/outstanding and inspection data. Six loans; no consumables. Outstanding is derived from issued minus received. Damage is explicitly after receipt. Original due date is historical context, not a new policy duration. Removed superseded per-view custody status arrays.
- Detail buttons capture their actual originating element. Dialog onCloseAutoFocus prevents default restoration and focuses that connected, enabled origin; if removed, it focuses the search input. Mobile drawer retains its registered Radix DialogTrigger and normal close behavior; selecting a link closes the drawer.

## Evidence and limits

Inspected current source and primitive Input ref forwarding. Local npm run typecheck and npm run lint passed before obsolete-status cleanup; final rerun results are in handoff. One initial PowerShell edit command had a parser error and performed no changes; corrected command succeeded.

No package, lock, primitive, test or Git edits; no operational functions added. Synthetic notices, disabled actions and conflict-policy-pending wording retained. No browser, server, HTTP, build, visual or accessibility acceptance. Remaining independent QA: URL/refresh/back-forward navigation, view-state reset, shared fixture display, dialog origin/fallback focus and drawer focus restoration at mobile width.
