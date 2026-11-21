# Independent Browse Equipment acceptance evidence — 2026-11-21

Scope: Orbit assignment d3fedf86-3f4c-4266-85a1-223e67402fe3, working tree on prisma. Work owned by QA is this report and tests/browse-equipment-acceptance.test.mjs only. Existing pending changes were preserved. Implementation was evolving during this pass; this is not final UI acceptance.

Read the approved local reference docs/ui-reference/equipment-browse/equipment_browse_redesign.html directly. Its principal acceptance targets are a table catalogue, prominent sticky selection, centered keyboard search, details sheet, filters and responsive selection access. Read the installed Next client directive guide before adding test code.

## Executed regression evidence

Command: `node --test tests/browse-equipment-acceptance.test.mjs tests/equipment-selection.test.mjs tests/student-ui.test.mjs tests/request-wizard-ui.test.mjs tests/role-policy.test.mjs tests/page-role-access.test.mjs`

Final execution: exit 0; 23 tests passed, zero failed/skipped. Node 24.19.0. Synthetic in-memory data only; no database access. Default sandbox execution could not spawn Node workers (EPERM); the successful run used approved execution outside that sandbox. An initial new-test import-resolution failure was corrected using the existing repository TypeScript transpilation pattern; final command above ran after that correction.

Five new behavioral tests verify:

- Same equipment in different exact sources can be updated/removed independently without mutating the previous selection.
- Repeated selection storage round trips preserve exact identities and quantities; clearing one user's selection preserves another user's entry.
- Storage exceptions propagate, allowing the UI to handle failure rather than silently declaring persistence.
- Equipment capacity uses the maximum satisfiable individual source rather than pooling locations, and respects returnable/consumable ceilings.
- Source resolution selects an eligible laboratory, carries its exact identifiers, rejects fractional quantities and excludes borrower self approval.

The companion existing tests verify selection limits, malformed storage rejection, source resolution, static protected-page access and table model sorting/filtering/paging. Their generic table-model evidence is not rendered Browse Equipment paging/filter/search evidence. Storage round trips do not prove UI synchronization across search/details/table/mobile or browser tabs. Client self-approval exclusion does not replace server authorization verification.

## Rendered verification blocker

Mounted Browser navigation to http://127.0.0.1:3000/inventory returned `net::ERR_SOCKS_CONNECTION_FAILED`. A separate local curl request to /login failed with exit 7, HTTP 000, connection refused. No login attempted; no credentials accessed. No competing build/server started and no restart attempted.

No desktop/mobile screenshots or role-specific rendered proof collected. No final visual defects inferred from the interim implementation. At inspection, StudentBrowse still contained the preceding implementation and /inventory role dispatch still differed by role; this is a timing observation, not a final defect against the ongoing frontend work.

## Still required before UI acceptance

After the implementation is ready and local app available: verify all four role entry points use the intended shared browse experience without changing management/approval access; compare desktop and narrow mobile rendering to the reference; test Ctrl/Cmd+K, focus, Enter/Escape and scroll containment in centered search; details sheet and mobile selection sheet; quantity synchronization and storage-error feedback; filter/search composition, empty/loading/error states and pagination reset/bounds; continue/back persistence without submitting a request. Backend bounded-catalogue behavior was not independently tested in this pass.

No business mutations, seeds, resets, dependency installation, production tests, commits or pushes performed. No release recommendation. Return this limited result to Orbit so the rendered follow-up can run against the completed implementation.

## Authenticated rendered follow-up — approximately 11:34–11:38 Sri Lanka time

Assignment 921b273d-778d-41b9-bbcb-5f72aa087de5. This section adds actual browser evidence and supersedes the earlier statement that no screenshots/rendered proof were available. Opened the same 127.0.0.1 Browser surface; its existing Lecturer session was retained. No fresh login, password access or HTTP login simulation was needed. Settled /inventory rendered Lecturer navigation and the new shared equipment table with two sources. Viewport measured from the page: 1280 by 720, devicePixelRatio 1, document horizontal overflow false.

Actually executed:

- Ctrl+K opened the search dialog. Measured rectangle x=315, y=240.25, width=650, height=239.5: horizontal and vertical center error both exactly 0 pixels. Accessibility tree exposed a combobox, Suggestions listbox, and selected first option. This proves desktop viewport centering in this observed state.
- ArrowDown followed by Enter opened Synthetic Multimeter details (the second result), with laboratory, location, availability 18 units, borrowing type and approval policy visible in page output. This exercised actual keyboard result selection, not a callback substitute.
- Clicking + Add in details updated both details and the underlying table/selection panel to quantity 1. Escape dismissed the sheet and revealed the selected table stepper and request-panel stepper. Continue became enabled.
- Clicked Consumables. After loading settled, catalogue showed No equipment matches, disabled Previous/Next and zero results; request panel retained Synthetic Multimeter quantity 1 with its exact laboratory/store metadata. Selection persisted across that filter transition.
- Clicked Continue to request using its current accessibility reference. The app reported failure fetching the RSC payload for /borrowing?view=new, fell back to navigation, and Browser rendered This site can't be reached. A subsequent local curl /login failed exit 7 / HTTP 000 / connection refused. Therefore continue/back persistence could not be verified. This is a live connectivity blocker, not evidence that the button's intended navigation or persistence implementation is defective. One earlier CSS text-selector click found no element and had no effect; the subsequent accessibility-reference click did execute.

Screenshots saved inside this repository:

- docs/qa/browse-2026-11-21/lecturer-search-desktop.png
- docs/qa/browse-2026-11-21/lecturer-filter-selection-desktop.png

Both were visually inspected. Desktop layout follows the reference's table/toolbar, burgundy accents and right request-panel structure. The empty table has internal horizontal scrolling at this width; page itself does not overflow horizontally. This is structural comparison only, not pixel-exact signoff. Search is visibly centered over a dimmed page. Reference fonts/spacing and every item state were not exhaustively compared.

Limits: only Lecturer /inventory rendered in this follow-up. Student /inventory, Admin/Officer /equipment, request-step shared browser, mobile dimensions/sheet, Cmd+K, search text/filter combination, populated pagination transitions, quantity cap boundary/remove, reload/back persistence, focused accessibility/scroll containment remain unverified. No mobile viewport was fabricated by shrinking a DOM container or counting SSR as browser rendering. No final source integration or four-role authorization claim is made. Server was not restarted and no competing build started; normal navigation/read activity only, plus client-side selection storage. Return to Orbit with the stopped-server blocker and retained screenshots; final UI acceptance remains pending.
