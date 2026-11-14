# Local prototype verification (11 November 2026)

The following checks were executed in local Chromium using Playwright `page.set_content` with the bundled self-contained HTML. Direct `file://` navigation was blocked in the sandbox, but the same HTML rendered and ran successfully when injected as page content.

- JavaScript parsed successfully using `node --check`.
- 11 top-level sections loaded and rendered without JavaScript exceptions.
- Desktop screenshots generated for overview, reports, inventory, HOD approvals, stock adjustments, users, batches, labs, policies, audit and personal borrowing.
- Advanced report filters opened and reduced the sample result set when filtering by borrower.
- Create User example showed multiple role and multiple batch checkboxes, and accepted one synthetic user locally.
- A sample approval policy was changed in temporary browser state.
- Self-approval was rejected in the demonstration.
- Approving the current user's own stock-adjustment proposal was rejected in the demonstration.
- Dashboard laboratory-scope selection changed illustrative metric values.
- Mobile screenshots generated for overview, reports, users and HOD approvals at 390px; document overflow was 0px for these views.
- Mobile sidebar opened successfully.
- No page JavaScript exceptions occurred in these checks.

**Not tested or claimed:** real shadcn/ui React integration; live PostgreSQL/API behavior; production account provisioning; real protected exports; server-side safety; full accessibility; institutional acceptance. These are requirements for the actual Next.js implementation.
