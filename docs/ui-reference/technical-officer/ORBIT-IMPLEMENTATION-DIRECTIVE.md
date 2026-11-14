# ORBIT — MANDATORY TECHNICAL OFFICER UI IMPLEMENTATION DIRECTIVE

## Authority and deliverable

The attached `index.html` is the **authoritative interaction/layout reference** for the Technical Officer user experience. The user supplied five screenshots of the existing technical-officer application; the current interface is too fragmented, filter-heavy, and oriented around backend objects rather than operational tasks. The HTML is an intentional redesign. **Open it and follow it closely** rather than independently choosing another visual style. Preserve the existing official Faculty logo and public homepage/login, and apply the same app-shell design language as the accepted student UI. Do not copy the prototype's illustrative numbers, names, badge states, faux crest, CSS-only controls, or client-side commands into production. Exact implementation in official React shadcn/ui primitives is required, not just “shadcn-style.”

## Ownership and token efficiency

Orbit: one concise task assignment to the existing Frontend Engineer, one coordinated integration review. Frontend Engineer owns design fidelity and complete UI functionality. Backend Engineer only when an API contract is missing; Security reviews authorization, stock changes, handover/return/inspection; QA performs focused checks at milestones. Do not generate planning-only reports, repeated multi-agent conversations or duplicate code investigations.

## The final Technical Officer navigation

1. **Operations:** Operations Dashboard; Equipment Handovers; Receive Returns; Inspections.
2. **Inventory:** Inventory Catalogue; Stock Operations; Receipt Imports.
3. **My Borrowing:** My Requests; Borrowed Equipment (officers have normal borrowing rights, but cannot self-handover or self-approve).
4. **Reference:** Activity & History.

Do not combine all these tasks into a single tab jungle under "Borrowed Equipment." An officer needs immediate access to today's handovers and returns. HOD-wide reports, user/batch administration, and academic approval inboxes are not visible to someone who has only the Technical Officer role. Multi-role users can have additional properly authorized navigation, but account identity and conflict-of-interest checks are global.

## Screen fidelity and functionality

**1. Operations Dashboard (`#dashboard`)**

- Desktop: professional shell, sidebar, compact Faculty masthead/top bar, breadcrumb, authenticated profile, one clean title/action row.
- Compact actionable metrics: ready for handover, due/overdue returns, pending inspection, stock alerts, today's completed operations. Metrics should deep-link to queue filters. Do not surface LOGIN/LOGOUT events as laboratory operations.
- Priority work queue, ready-for-handover table, upcoming/overdue returns, inventory snapshot, concise quick actions. No enormous date-filter form at the top of the dashboard.

**2. Equipment Handovers (`#handovers`)**

- Assigned-laboratory, permission-scoped collection queue. Toolbar search; laboratory/status filters; useful compact data table.
- Row actions open a coherent verification workflow. Display borrower and identity verification, item, approved quantity, relevant policy and approval completion, assigned lab, expected return date, existing asset identity or safe materialization from anonymous stock, optional manufacturer serial, and factual remarks. One clearly labeled final confirmation.
- Approval ≠ handover. No self-handover. Revalidate on server; never trust client quantities, stage or role. Respect idempotency.

**3. Receive Returns (`#returns`)**

- Search by borrower, item, borrowing reference and internal asset ID, with overdue/due-status filters.
- Show outstanding quantity, due date and physical asset identification. Permit authorized partial returns where backend rules allow.
- Receipt captures condition and officer identity; returned returnable stock enters INSPECTION, not Available. Consumables do not create returns.

**4. Inspections (`#inspections`)**

- Dedicated queue after physical receipt, with item, asset, former borrower, received date, receipt notes and inspection action.
- Inspection requires current authority, named inspector, structured condition outcome, remarks and history. Pass → Available; damaged → Maintenance; unresolved remains unavailable. No hidden direct-release shortcut.

**5. Inventory Catalogue (`#inventory`)**

- Role-authorized catalogue for assigned labs only. Compact real-data table with item, category, lab, available, reserved, borrowed, inspection, maintenance and contextual actions.
- Integrated search, lab/category filters and honest quantities; no UUID-based equipment names in user-facing rows. Create/edit/deactivate in permitted scope; item details, locations, item policies, assets and movement history where authorized.
- Returnable anonymous quantities can become identified asset IDs without increasing totals; serial optional. Consumables counted separately. Do not expose restricted stock or unauthorized data.

**6. Stock Operations (`#stock`) and Receipt Imports (`#imports`)**

- Receipt, controlled stock movement, asset identification and adjustment proposals. Independent authorization for adjustments. Import supports CSV/XLSX staging, validation, preview, atomic commit and clear error feedback using existing APIs. UI must distinguish proposals and approved commits.

**7. My Borrowing**

- Technical Officer has their own normal borrowing experience (request creation, statuses, borrowed equipment, history) following item-specific academic approval policy, with independent substitute actors where conflicts exist. Can reuse actual student components where the user task is the same; avoid duplicating implementation.

**8. Activity & History**

- Laboratory operation/movement activity only. Security/session events must go to a distinct authorized audit interface.

## Exact component selection

Implement the source with **official shadcn/ui** and compositional app components:

- Shell: `SidebarProvider`, `Sidebar`, `SidebarHeader`, `SidebarContent`, `SidebarGroup`, `SidebarGroupLabel`, `SidebarMenu`, `SidebarMenuButton`, `SidebarInset`, `SidebarTrigger`, `Breadcrumb`, `DropdownMenu`, `Avatar`, `Separator`, `Tooltip`.
- Dashboard: `Card`/`CardHeader`/`CardContent`, `Badge`, `Button`, `Table`, `Skeleton`, `Alert`, `Tooltip`.
- Queues/tables: shadcn `Table` + `@tanstack/react-table` for filtering/sorting/pagination; `Input`, `Select`, `Popover` + `Command` for searchable equipment/borrower pickers, `DropdownMenu` for row actions; `Pagination` patterns.
- Handover/return detail: `Sheet`/`SheetContent` for quick verification and details, **dedicated full pages or roomy `Dialog`** for complex multi-line transactions. `AlertDialog` for consequential confirm; `Field`/`FieldLabel`/`FieldError`, `Input`, `Select`, `Textarea`, `Calendar`/Date Picker patterns where required; `Sonner` for outcomes and contextual inline errors.
- Inspection: dedicated accessible structured form via `Field`, `RadioGroup` or `Select`, `Textarea`, `Button` and clear record detail.
- Inventory: `Tabs` for Stock/Catalogue/Imports only if not redundantly mirrored in sidebar; use compact `Card`, `Table`, `Badge`, `DropdownMenu`, `Dialog`, `Sheet`.
- Responsive: true mobile Sidebar behavior, mobile-appropriate `Drawer` or full page for detailed work, touch-friendly targets, prioritised columns/scrollable tables, no page overflow.

Use Lucide icons purposefully, not for decoration. Keep maroon accent, neutral surfaces, subtle dividers, ~6–10px radius, compact row density, crisp headings. The screenshot mockups may differ slightly from the HTML where business logic necessitates it; retain the HTML's overall composition and interactions.

## API, data and security

Use the current Next.js/React/TypeScript/PostgreSQL application; preserve real APIs, protected SQL functions, transactional stock accounting, role/record/lab-scoped authorization, immutability and idempotency. Do not replace working data with the static `requests`, `borrowed`, `stock`, or `inspections` arrays in the prototype. The HTML is intentionally a **visual prototype only**; it does not perform API writes. Do not introduce routes with fake functionality or label them complete. If required API features are not implemented, identify concise backend work items and integrate only once working.

**No institutional policy inventions:** example return dates, stock thresholds, counts, lab names and approval choices in the HTML are illustrative. The real UI reads configured policies, assignments, dates and data. Preserve the confirmed decisions: borrower-selected eligible lecturer, receipt followed by independent inspection clearance, item-specific staff borrowing with independent substitutes when required.

## Required implementation sequence

1. Inspect `index.html` at desktop/mobile widths; identify existing student shared shell and official Faculty branding; establish consistent technical officer navigation and component tokens.
2. Implement Operations Dashboard and Equipment Handovers with real APIs and inspect rendered pages.
3. Implement Receive Returns and Inspections as separate workflows; maintain state/integrity checks.
4. Implement Inventory Catalogue, Stock Operations, Receipt Imports and consistent data tables.
5. Integrate My Borrowing via reusable student UI and operational Activity & History.
6. Run focused typecheck, lint, key API/authorization/integrity tests. Capture rendered desktop and mobile screenshots when local browser permission is available; visual acceptance remains pending otherwise.

**Do not independently redesign the reference or replace it with a generic AI-generated dashboard.** Only change a UI detail where needed for actual authorization, accessibility, responsive behavior or factual business rules, and briefly flag that deviation.

Report milestone outcomes in six concise lines: `DONE`, `FILES`, `SHADCN COMPONENTS`, `API INTEGRATION`, `CHECKS / VISUAL REVIEW`, `BLOCKERS / NEXT`. Do not work on HOD/Admin or Lecturer UI redesign until this Technical Officer UI has been reviewed.
