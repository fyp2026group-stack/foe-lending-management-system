# CP2 frontend verification — 2026-11-10

Implementation: `src/components/lending/request-builder.tsx`, `request-workspace.tsx`, `lifecycle-model.ts`, `request-options.ts`, `api.ts`, `shared.tsx`, `workflow.tsx`, `metrics.tsx`, `workspace-summary.tsx`; authenticated styles in `src/app/workspace.css`; focused checks in `tests/lending-ui.test.mjs`.

- Full-page multi-item editor saves incomplete drafts, reopens owned drafts, reviews saved state and submits explicitly with expectedVersion. Changes invalidate review. Current sources/lecturers load all pages, self lecturers are excluded and every laboratory must be covered. Current policy quantity limits permit awaiting-stock requests. Unknown save/submit outcomes retain exact command identities and block changed payloads; explicit recovery is available for uncertain submission.
- My requests separates editable drafts, awaiting approval, reserved collection, handed-over/completed and closed requests. Contextual details retain list context, original quantities, per-line stages/versions, reservation/handover/cancellation quantities, dates, revision lineage, predecessor navigation, decision actors/remarks/timestamps and existing append-only discussion.
- Versioned cancellation dialog bounds quantity by original minus cancelled minus handed over, and excludes rejected/cancelled lines. Correction creates a linked draft from rejected lines and preserves predecessor history. Versioned approval/reservation and handover use current line versions; collection displays current reserved remainder.
- Server summary/stage/created-date filters and server pagination are integrated. Because requests has no search or multi-summary-group filter, search and the friendly request-group classification apply to the current server page; the UI states this limitation explicitly. Approval inbox uses current eligible line assignments within each fetched page. Next page is available when the server returned a full page; no fabricated total is shown.
- Borrowing terminology replaces user-visible loan/custody/issue labels in owned screens. Existing return, policy and discussion operations remain connected. No database/server migrations or public homepage/login/public.css/logo edits were made for this assignment.

## Checks

- Relevant local Next 16.4.5 client-boundary and page/searchParams docs read before editing.
- Final typecheck, full lint (without diagnostics), and production build passed.
- Sequential UI/oracles: 18/18 passed (`lending-ui`, `inventory-ui`, `workflow-oracles`, `m3-oracles`), including 7 new CP2 checks.
- Sequential database regressions: 6/6 passed (`lending-lifecycle`, `application-lending`, `lending-authority`, `lending-sources`, `workflow-basic`, `catalogue`), using the configured synthetic database and rollback fixtures.
- Full `npm test`: 22 passed, 3 failed in existing `foundation.test.mjs`: expects the old synthetic homepage, unavailable operational API behavior and synthetic preview markup. Those files/assertions are outside this bounded frontend assignment and were not rewritten. This is not a fully green repository suite.
- Sandbox worker creation initially returned EPERM. Required build/test commands were re-run with approved execution and fresh results above.

## Visual acceptance and remaining limits

Browser navigated to http://127.0.0.1:3000/borrowing; the authentication check returned 401. Authenticated desktop/360px screenshots, keyboard/dialog interaction and real HTTP mutations were not accepted in this task. An initial file-encoding parse error during implementation was corrected; subsequent production builds pass. No related temporary automations exist.

Next: run authenticated borrower/lecturer/HOD/officer desktop and 360px acceptance, including stale and unknown-result recovery; reconcile obsolete foundation tests with the current application requirements. Database regressions validate backend behavior but do not substitute for browser action coverage.
