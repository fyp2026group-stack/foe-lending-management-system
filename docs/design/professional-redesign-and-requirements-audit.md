# Application redesign and original-requirements reconciliation
Date: 2026-11-14
Status: Implementation brief; NOT a completed feature or verified UI.

## Design direction
This is a Faculty of Engineering operations system, not a generic analytics dashboard.
Visual references:
- https://linear.app/ : navigation hierarchy, dense lists, responsive interaction
- https://ui.shadcn.com/blocks/dashboard : **actual** shadcn components, shared sidebar and data table
- https://ui.shadcn.com/docs/figma : Figma community component libraries
- Approved student dashboard, equipment-browser and requests HTML/screenshots supplied by owner.

Design tokens: university-maroon accent reserved for brand and primary action; neutral gray surfaces; 12–14px operational metadata and 14–16px body where appropriate; purposeful whitespace, restrained borders, no decorative gradients or icon-heavy generic KPI tiles. Follow approved university logo/masthead.

Use actual shadcn `Sidebar`, `DataTable` (TanStack), `Table`, `Card` when useful, `Sheet` for concise detail, `Dialog`/`AlertDialog`, `Field`, `Input`, `Textarea`, `Select`, `Popover`, `Command`, `Calendar`, `Tabs`, `Sonner`. Compose role-specific workflows rather than repeating a generic dashboard across all roles. Motion: CSS transitions only for hover/focus, content arrival <=200ms; respect prefers-reduced-motion. Do not animate numerical totals or show fake data.

## Original policies: preserve, do not redesign
- Student, Lecturer, Technical Officer, HOD/Admin can borrow. Roles and lab assignment checked server-side, including multi-role users; no self-approval or self-handover.
- Item policy = NONE / LECTURER / HOD / BOTH (lecturer then HOD), individually for a multi-item request.
- Student chooses *eligible* lecturer when required, not a free text name.
- Inventory catalog starts as item + available unit counts/lab/location; no QR code or manufacturer serial required at catalog creation. Identify a physical returnable asset at handover when needed, and preserve original internal ID.
- Consumables are quantity-based, not subject to physical return.
- Request -> individual approvals -> reservation -> physical handover -> borrowed -> physical receipt -> inspection -> available or maintenance. Return receipt must not silently increase available stock.
- Append-only comments, separate audit and security events. HOD can filter by batch/lab/borrower/item/approver/technical officer and export; multiple academic batch memberships should not be silently reduced to one primary batch.
- Students must not see staff-only stock operations or the inventory administration listing.
- All roles can borrow on their own behalf, without bypassing their approval conflicts.

## Current gaps verified by source inspection
1. Session expired: full-page `ErrorNotice` previously rendered; initial 401 redirect patch is committed. Still verify login and expiry in real browser, including deep links.
2. Navigation: every top-level route wraps its own `Authenticated` shell; changing routes re-mounts the shell, while `key={initialView}` forces view re-mount. Next.js `Link` is already used but the implementation still makes sidebar/content flash. Consolidate one persistent authenticated layout for all protected routes and keep the header/sidebar mounted. Change only route content; use `loading.tsx`/`Suspense` for content fetch; no `window.location` navigation except crossing login boundary. Remove view-level `key` forced remounts, and preserve form data intentionally.
3. Request builder: the staff flow still uses native HTML selects, and an unstructured vertical per-line fieldset. Replace with multi-item cart, explicit purpose/schedule, policy-aware lecturer chooser, editable line list, review summary, draft/submit actions, safe conflict recovery. Verify draft/command replay semantics first.
4. Equipment creation: `DefinitionEditor` creates *catalogue item metadata* (name, category, returnable/consumable kind, UOM, specs), while `StockOperations` separately receives stock. Expose plain-language action **Add Items to Inventory**, with two intentional stages: (A) choose/create equipment type, category, UOM, optional description/specs; (B) record received quantity, laboratory/location, receipt/reference and evidence. Never create physical quantity implicitly by merely defining an item; ask serial/internal asset identity only when applicable, not for every unit.
5. Student self-registration is absent. Existing users/admin import and password login are not equivalent to verified university student OAuth enrollment.
6. DB currently uses `pg` and protected Postgres routines. Prisma is not currently in the execution path. Do NOT swap direct Prisma writes onto protected lending/stock tables: that would break authorization/transaction/replay guarantees.
7. CI: source checks passed; integration findings in docs/workflow/2026-11-14-integration-findings.md remain release blockers.

## Role-specific design
Student: approved dashboard/catalogue/requests; "New request" prominent; no admin inventory actions.
Technical Officer: handovers ready, returns received, inspections pending, stock activities, genuinely actionable task counts, short handover and return fact panels.
Lecturer: pending lecturer decisions, individual item review (borrower/purpose/lab/term/policy) with approve/reject and remarks; separate personal requests/borrowed.
HOD: department-level overview and overdue counts (reporting API), approval inbox, exception review, reports & filters, administration and policy controls; clear actions without fake charts.

## Student OAuth onboarding (proposed contract, not yet implemented)
- Identity provider: verified university Microsoft Entra ID or Google Workspace based on actual university configuration. Never trust a user-entered email domain or identity role assignment.
- Only eligible authenticated student identity can begin onboarding. Link external provider subject (issuer+subject) uniquely to local user; avoid account takeover through email equality alone. Confirm school email is verified and approved by university policy.
- First login: require index number, registration number, full name, department, academic batch (server-populated e.g. 21ENG/22ENG/23ENG; not hardcoded), university email from verified provider (read-only unless verified change), phone number; optional personal email.
- Store profile completion status and explicit verification state separately; user-supplied batch/index cannot grant privileged role.
- Duplicate index/registration protections, validated department/batch mapping, rate limits, profile update audit and consent/privacy statement; do not expose student records to unauthorized roles.
- Existing synthetic users and lecturer/TO/HOD account paths must remain available until a tested controlled migration to federation is approved. Never create an admin from OAuth claims by default.

## Prisma adoption
- Keep PostgreSQL and existing SQL migrations/functions intact.
- Prototype Prisma for *authorized metadata read models* in isolated branch/synthetic database; use `prisma db pull` against existing DB; inspect generated schema and private tables; avoid direct ORM table access from request handlers until server RBAC boundary remains enforceable.
- Maintain the protected transaction/state-machine SQL calls for lending, custody, approvals and inventory conservation, possibly through parameterized `prisma.$queryRaw` with the same restricted database role after testing (Prisma is not inherently more secure).
- Pin Prisma version compatible with Node 24, capture schema and generation, benchmark pool/concurrency and transaction replay before retiring `pg`. Do not introduce Prisma Migrate as a second authoritative migrator.
- Add tests that verify forbidden direct updates remain forbidden, no accidental per-unit inventory creation and no privilege escalation.

## Acceptance gates
1. Capture screenshots at desktop 1440/1280 and mobile 390/375 for each role. Compare layout and interactions with approved references; accessible forms and keyboard workflows.
2. Expired session redirects without dead-end or redirect loop. Unauthorized server mutation still rejected. 403 displays a permission message but never redirects as an expired session.
3. Sidebar/header stay mounted while pages change using client transitions; selected tab and scroll state behave predictably.
4. New student account: successful OAuth -> profile completion -> verified Student role -> protected catalogue. Wrong/duplicate/privileged claims rejected.
5. Add inventory item: explicit metadata + quantities/receipt; list + stock conservation and independent adjustment checks.
6. Multi-item request with differing approval policies, correct eligible lecturer selection, no self approval, reliable drafts/submit/retry, physical receipt then inspection.
7. Full lint, typecheck, build, unit, PostgreSQL and authenticated HTTP tests all pass before PR is approved/merged.
