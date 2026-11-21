# Approved equipment browser implementation

Branch: prisma. Reference: ../ui-reference/equipment-browse/equipment_browse_redesign.html.

The shared EquipmentBrowser implements a table catalogue, centered shadcn Dialog/Command search, keyboard shortcut and results navigation, details Sheet, inline selection controls, sticky desktop request panel and mobile selection Sheet. Student/Lecturer borrowing catalogues and the new authenticated /equipment entry for Officer/Admin use the shared implementation; administrative inventory screens remain separate. The request equipment step reuses it. Previous cards were removed.

Sources are fetched in bounded server pages with validated query/filter parameters. Selected equipment hydrates only its item identifiers. Exact browse laboratory/location identity is retained across filtering and pagination; alternate sources are identified explicitly. Request summaries use the existing approval-compatible source resolver. Existing server-side approval, stock and role constraints remain authoritative. Source availability currently includes eligible positive anonymous bulk stock; unavailable catalogue discovery and future-date guarantees were not added. No synthetic prototype records are used by the application.

## Final integrated checks

- npm run typecheck: passed.
- npm run lint: passed, zero errors and 56 warnings.
- npm test: 180 passed, zero failed, one skipped opt-in live login-transport check (origin not configured in this run).
- npm run build: passed after the final source-selection fix.
- git diff --check: passed.

QA exercised the Lecturer interface at 1280 x 720: centered Ctrl+K search, arrow/Enter details, Add synchronization, Escape dismissal, and selection retention through an empty filter. The lead inspected the saved desktop screenshots. Continue encountered a stopped local development server. Full four-role authenticated desktop/mobile comparison, mobile sheet behavior and continue/back remain unverified. The shared-role policy, selection and SSR tests do not replace browser proof. No complete visual acceptance or deployment readiness is claimed.

Screenshots: ../qa/browse-2026-11-21/lecturer-search-desktop.png and lecturer-filter-selection-desktop.png. Detailed evidence is retained in QA-BROWSE-ACCEPTANCE-2026-11-21.md, QA-SHARED-BROWSER-RENDER-2026-11-21.md and FRONTEND-EQUIPMENT-BROWSE-2026-11-21.md at repository root.

## Related completed work preserved in the integrated tree

The tree also contains the previously authorized local login/schema-selection repair, credential transport safeguards, snapshot session contention correction, role presentation and authorized stock mapping fixes, and lifecycle/concurrency regression runner. Their reports retain separate evidence and limits. No production deployment, main merge, database reset or seed was performed for the browse implementation. Historical credential exposure has not been disproven or remedied by password rotation. Regenerable next-env.d.ts build-path changes were excluded.
