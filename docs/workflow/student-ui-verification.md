# Student visual-quality rework - 2026-11-10

Latest source/check result: compact, context-specific zero-data UI implemented; authenticated visual acceptance remains blocked. Earlier shadcn-refinement evidence is retained below as history.

## Before / after and exact files

| File                                                   | Before                                                                              | After                                                                                                                                                                                                                                                                       |
| ------------------------------------------------------ | ----------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/components/lending/student-empty-model.ts` (new)  | No shared context/action vocabulary                                                 | First-use content/actions for equipment, requests, drafts, borrowed, history, attention, activity, policies, details, decisions, comments and unavailable requests; separate filtered-result copy                                                                           |
| `src/components/lending/student-empty-state.tsx` (new) | Bare paragraphs and empty table cells                                               | Reusable compact CardContent composition, restrained Lucide icon, labelled status/title, helpful copy, one keyboard-accessible link/button; supports reset and contextual actions                                                                                           |
| `src/components/lending/student-data-table.tsx`        | Full table headings, a No records cell, sort/result bar and pagination at zero rows | Early empty-state rendering; no table/header/body/result/sort/page-size/paging chrome at zero filtered rows; nonempty TanStack behavior retained                                                                                                                            |
| `src/components/lending/student-workspace.tsx`         | Empty borrowed tbody and loose attention/activity/policy paragraphs                 | Actual-data guards around the table and contextual empty panels; no duplicate View all policies link when empty; panel-local read errors remain errors                                                                                                                      |
| `src/components/lending/student-browse.tsx`            | Generic table-zero row and loose detail prompt                                      | Equipment vs filtered-empty contexts; all-filter reset action; full-width zero-results layout; purposeful View first item detail action                                                                                                                                     |
| `src/components/lending/student-borrowed.tsx`          | Empty borrowed table/paging; generic history/policy emptiness                       | No borrowed table/paging at zero; reset broadens to all borrowing; history/policies use contextual shared table empty states; student-only read-only policy composition                                                                                                     |
| `src/components/lending/request-workspace.tsx`         | Loose draft/request paragraphs plus empty table/detail grid and server paging       | Draft/request contexts, complete filter reset, no student-zero server paging, full-width zero-list layout, purposeful View first request prompt, compact decision emptiness                                                                                                 |
| `src/components/lending/request-discussion.tsx`        | Loose empty decision/comment/unavailable paragraphs                                 | Student-only contextual states; Add a comment focuses the real comment textarea only for an available request                                                                                                                                                               |
| `src/components/lending/request-builder.tsx`           | Loose no-source paragraph                                                           | Student-only equipment-empty composition; existing draft/save/submit behavior retained                                                                                                                                                                                      |
| `src/components/lending/workflow.tsx`                  | Students reused the generic policy grid                                             | Student policy view uses the new read-only contextual composition; staff branch unchanged                                                                                                                                                                                   |
| `src/app/workspace.css`                                | Default component spacing mixed with prototype values                               | Compact 36px controls/31px small buttons, 11-12px dense table/filter typography, 9px neutral panels, 14px empty-state titles, restrained icons, consistent content padding and detail hierarchy; hidden eyebrow clutter; deliberate zero-grid/full-width and mobile layouts |
| `tests/student-empty-ui.test.mjs` (new)                | No rendered empty-state/paging coverage                                             | Five SSR tests of actual React/shadcn/Radix/Lucide/TanStack compositions, context actions and zero-row chrome suppression                                                                                                                                                   |
| `docs/workflow/student-ui-verification.md`             | Previous refinement report                                                          | This current rework evidence plus retained historical report                                                                                                                                                                                                                |

Typography/spacing were compared directly with the read-only prototype. Desktop grid proportions remain dashboard `1:1.12` then `1:.97:.94`, browse `2.4:.94`, requests `1.55:.85`. At tablet/mobile widths these deliberately stack. Maroon/neutral palette, minimal shadow and low-radius borders are retained. This is source-level comparison, not screenshot acceptance.

No changes to backend, login, accepted public pages, public.css, logo assets, dependencies, prototype records or other-role presentation in this pass. No supplied password or authentication artifact was written into source/tests/notes.

## Fresh checks

- `npm run typecheck`: exit 0.
- `npm run lint`: exit 0; no diagnostics.
- `node --test --test-isolation=none tests/student-empty-ui.test.mjs tests/student-ui.test.mjs tests/lending-ui.test.mjs tests/inventory-ui.test.mjs tests/workflow-oracles.test.mjs tests/m3-oracles.test.mjs`: exit 0; **31 passed, 0 failed**.
- Five new render tests verify all 13 first-use contexts/actions, query-filtered zero rows, domain-filtered zero rows, true first-use zero rows, and retained nonempty table/pagination behavior. These execute actual component dependencies with local TypeScript transpilation and normal Next Link module interop, rather than component mocks.
- `npm run build`: fresh exit 0; Next 16.4.5 compilation, TypeScript, page data, static generation and finalization passed.
- `git diff --check` on implementation paths: exit 0.
- UTF-8 scan of 12 implementation/test files: no mojibake markers found.
- Full repository suite was not rerun for this bounded pass; the earlier full-suite result below remains historical, not a fresh result.

## Visual/access limits

Orbit reports the supplied student login was rejected with HTTP 403. No new authentication attempt, authenticated screenshot or live lifecycle mutation was made in this rework. Desktop/360px appearance, keyboard interaction, reset-button clicks and visual fidelity remain unaccepted. SSR checks establish rendered semantics and zero-row structure, not browser appearance or interactions. No visual acceptance is claimed.

Next: restore an authorized student session, then review real empty/filtered/nonempty states and reset/detail actions at desktop and 360px against the prototype.

---

## Earlier shadcn refinement evidence (historical)

# Final Student UI refinement verification - 2026-11-10

Source/check implementation complete; authenticated visual and live lifecycle acceptance blocked. This supersedes the earlier implementation note and does not replace QA's independent report.

## Reference and scope

Read AGENTS.md, installed Next 16.4.5 client-component guidance, dependencies, existing contracts and dirty repository state before edits. The supplied prototype at `C:\Users\laksh\Downloads\index.html` was read without changes; SHA256: `f5b1059b2d7ec9f879ed1696b9183f3cb55f21b0b74f7a70dcf501d642c25f96`. Its illustrative identity, records, equipment models, dates, policy examples and encoding errors were not copied. Original screenshots were not accessible as files; prototype plus Orbit's transcription guided proportions, without pixel acceptance.

Delivered: 260px branded student sidebar, maroon strip, breadcrumb/account dropdown; compact dashboard icon KPIs and prototype 1:1.12 upper / 1:.97:.94 lower panels; browse 2.4:.94 table/detail and requests 1.55:.85 table/detail; compact filters, neutral low-radius cards, real status and equipment content, official mobile Drawer and desktop Sheet. Explicitly assigned staff roles retain the staff workspace. No server/RBAC changes.

New Borrowing Request at `/borrowing?view=new` is a full page outside narrow panels and module tabs. It retains source/item/lab/location/quantity choices, purpose, dates, conditional eligible lecturer, inline review guidance, draft save and explicit versioned submission. Student cancellation uses AlertDialog with pending/uncertain-command closure locking. Browse details restore focus on close/filter removal; dashboard/request tables have labelled focusable scroll regions. Student history resolves all authorized pages, excluding LOGIN/LOGOUT.

## Official composition provenance

Consulted official current Radix patterns:

- [Sidebar](https://ui.shadcn.com/docs/components/radix/sidebar)
- [TanStack v9 Data Table](https://ui.shadcn.com/docs/components/radix/data-table)
- [Sonner](https://ui.shadcn.com/docs/components/radix/sonner)
- [AlertDialog](https://ui.shadcn.com/docs/components/radix/alert-dialog)

Nine missing component sources came from `https://ui.shadcn.com/r/styles/new-york-v4/<component>.json`: Avatar, DropdownMenu, Alert, AlertDialog, ScrollArea, Drawer, Sonner, Select and Textarea. Local utility/UI imports were mapped to the existing project. Sonner uses the required fixed light theme instead of adding an unused theme dependency. Existing official primitives were reused.

Actual compositions use SidebarProvider/Sidebar/Header/Content/Group/Menu/Footer/Inset/Trigger, Breadcrumb, DropdownMenu, Avatar, Separator, Tooltip, Button, Card/Header/Title/Description/Content/Footer, Badge, Skeleton, Alert, ScrollArea, Sonner, Table, Tabs, Sheet, Drawer, AlertDialog, Select, Textarea and Lucide. Handwritten SVG icon paths were replaced with Lucide components. Sonner is used only for noncritical selection notifications; validation/errors remain inline.

Added minimal dependencies: `@tanstack/react-table@9.3.1`, `sonner@2.0.8`, `vaul@1.1.2`, plus resolved transitive dependencies. Install audit reported zero vulnerabilities; this is not an application security review.

## QA corrections

- **QA-STU-01 fixed:** selection edits and Start reconcile user-specific browser storage, explicitly removing empty baskets. Regression covers select -> unsaved -> empty restart; remove-all -> start; other-user isolation.
- **QA-STU-02 fixed:** rejected/reserved line states drive attention, independent of summary. MIXED rejected/pending requests with no reservations remain actionable. Regression passes.
- **QA-STU-03 fixed:** stable external clock snapshots advance every 30 seconds, on window focus and on subscription/data refresh. Metrics, borrowed status/filter and extension date constraints use that clock. Deterministic mocked Date/interval/focus regression crosses a due date and verifies refreshed overdue metrics.

Focus restoration, labelled scroll regions and mobile overflow handling are implemented; authenticated keyboard/viewport acceptance remains unverified.

## API integration and limits

Existing auth, inventory catalogue/category and lending APIs remain authoritative. Owned drafts/requests/loans, sources, lecturers, policies, history, borrower-history and extensions use authorized real data. Existing CSRF, Origin checks, command replay, expected versions, approval snapshots, lecturer/source/quantity revalidation and transactions remain unchanged. No new server operation or contract.

Source DTOs lack images/descriptions/bespoke restriction metadata; missing content is not invented. Category/specifications come from authorized catalogue reads. Request search/type/group filters apply to its labelled server page; status/stage/date/offset go to the server. TanStack adds meaningful sorting/filtering/pagination within that page. Source/metric/history lookups load all authorized pages within existing bounded readers and surface excess/errors.

Borrower-history does not join inspection outcomes. Returned rows explicitly separate recorded receipt from inspection; no clearance is inferred. No direct staff-route denial or database/HTTP mutation suite was executed in this refinement.

## Exact files in this refinement pass

Added:

- `src/components/lending/student-controls.tsx`
- `src/components/lending/student-clock.ts`
- `src/components/lending/student-data-table.tsx`
- `src/components/lending/student-table-features.ts`
- `src/components/ui/avatar.tsx`
- `src/components/ui/dropdown-menu.tsx`
- `src/components/ui/alert.tsx`
- `src/components/ui/alert-dialog.tsx`
- `src/components/ui/scroll-area.tsx`
- `src/components/ui/drawer.tsx`
- `src/components/ui/sonner.tsx`
- `src/components/ui/select.tsx`
- `src/components/ui/textarea.tsx`

Updated:

- `package.json`
- `package-lock.json`
- `src/components/identity/session.tsx`
- `src/app/workspace.css`
- `src/components/lending/student-model.ts`
- `src/components/lending/student-workspace.tsx`
- `src/components/lending/student-browse.tsx`
- `src/components/lending/student-borrowed.tsx`
- `src/components/lending/request-builder.tsx`
- `src/components/lending/request-workspace.tsx`
- `src/components/lending/workflow.tsx`
- `src/components/ui/review-sheet.tsx`
- `tests/student-ui.test.mjs`
- `docs/workflow/student-ui-verification.md`

No edits to accepted homepage, login, public.css, logo assets or backend/database files were made by this refinement. The read-only prototype and independent QA report were not edited. Existing unrelated/user changes were retained.

## Final checks

| Exact command/inspection                                                                                                                                                      | Fresh result                                                                                                                                |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run typecheck`                                                                                                                                                           | Exit 0                                                                                                                                      |
| `npm run lint`                                                                                                                                                                | Exit 0; no diagnostics                                                                                                                      |
| `node --test --test-isolation=none tests/student-ui.test.mjs tests/lending-ui.test.mjs tests/inventory-ui.test.mjs tests/workflow-oracles.test.mjs tests/m3-oracles.test.mjs` | Exit 0; 26 passed, 0 failed, including three QA witnesses and actual TanStack numeric sorting/filter-before-pagination/page-change behavior |
| `npm run build`                                                                                                                                                               | Exit 0; Next 16.4.5 compilation, TypeScript, page data, static generation and optimization passed                                           |
| Final `npm test`                                                                                                                                                              | Exit 1; 33 tests, 30 passed, 3 foundation failures (details below)                                                                          |
| UTF-8 source/test scan                                                                                                                                                        | No suspicious mojibake markers in scanned student source/tests; BOTH remains ASCII `Lecturer -> HOD`                                        |
| `git diff --check` on implementation paths                                                                                                                                    | Exit 0; Git line-ending advisory messages only                                                                                              |
| Related automations                                                                                                                                                           | None for this bot                                                                                                                           |

Fresh full-suite failures: `foundation.test.mjs:39` expects `/Synthetic demonstration/`; `:54` expects 404/405 but `/api/v1/handovers` returns 403; `:63` expects `/Synthetic layout preview/`. These are assertion failures in this run, distinct from connection failures in QA's earlier independent run. Tests were not rewritten to conceal failures.

Network retrieval initially failed in the sandbox and succeeded with approved execution. Required process-worker build/tests used approved execution. Focused tests also run without worker isolation.

## Visual review / next acceptance

The Browser tab opened `http://localhost:3000/workspace` during this pass. `/api/auth/me` returned 401; a subsequent snapshot showed Return to sign in. No authenticated desktop/360px screenshots, live actions, keyboard/overflow/contrast review or screenshot comparison were possible. Source/check completion is not visual or end-to-end acceptance.

Next: authenticated student desktop/360px review of dashboard, browse/details, full-page request save/submit, cancellation/corrections, borrowed/history/extensions; independent replay/stale-version and direct staff-route denial checks; reconcile foundation assertions with current product requirements.
