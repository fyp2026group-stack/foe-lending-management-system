# APPROVED HOD / ADMIN UI REFERENCE — Mandatory Implementation Directive

## To: Orbit (Technical Lead), Frontend Engineer, Backend Engineer

The attached `index.html` is the **authoritative HOD/Admin layout and interaction reference**. It supersedes the current generic HOD/Admin dashboard arrangement shown in the eight user-provided screenshots. **You MUST follow the attached HTML closely**; do not improvise a new interface, discard its information architecture, reintroduce the old oversized filter panels, or implement pages as unrelated cards.

The user has already established visual references for Student, Lecturer, and Technical Officer roles. The HOD/Admin design must share their faculty branding, navigation structure, visual tokens, restrained maroon accents, typography, control density, status treatment, and responsive conventions. HOD/Admin is a distinct **departmental oversight + administrative management** workspace, not a generic student borrowing screen.

### 1. Files, priority and reference hierarchy

1. `index.html`: **primary visual and interaction authority**. Open it and inspect all 11 views.
2. `screenshots/`: rendered visual comparisons for principal screens and mobile.
3. This directive: functional, security, shadcn/ui and integration requirements.
4. Existing verified Phase 1 product requirements and approved operational policies: authoritative where demo simplifications differ.

The HTML's example records, quantities, names, statistics, dates, permission notices and sample CSV are _synthetic illustrative data_, **not production API responses or university policy**. Replace with actual authorized database-backed data. The prototype includes demo-only local state and no working server authentication, stock mutation, or database access. Do not copy its mutation logic into the real system.

### 2. Implementation technologies

Use the existing Next.js App Router, React, strict TypeScript, Tailwind CSS, official **shadcn/ui** component implementations, Lucide React, PostgreSQL-backed authenticated APIs and existing form validation strategy. Use `@tanstack/react-table` for advanced operational/report tables.

Inspect what is installed. Follow the shadcn/ui documentation for current import paths and composition APIs. Implement reusable compositions using official primitives; do not merely name homemade UI components `shadcn-style`. Do not migrate the database ORM or rewrite the existing protected SQL-functions architecture just for UI work.

**shadcn/ui component mapping**

| Interface area            | Official components/patterns                                                                                                                                                                                                                     |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Shared shell              | `SidebarProvider`, `Sidebar`, `SidebarHeader`, `SidebarContent`, `SidebarGroup`, `SidebarGroupLabel`, `SidebarMenu`, `SidebarMenuButton`, `SidebarFooter`, `SidebarInset`, `SidebarTrigger`, `Breadcrumb`, `Separator`, `DropdownMenu`, `Avatar` |
| Metric and content panels | `Card`, `CardHeader`, `CardTitle`, `CardDescription`, `CardContent`, `Badge`, `Button`, `Tooltip`, `Skeleton`                                                                                                                                    |
| Data tables               | `Table`, `TableHeader`, `TableBody`, `TableRow`, `TableHead`, `TableCell`, TanStack Table sorting/filter/pagination, `DropdownMenu` row actions, `Pagination`                                                                                    |
| Inline filtering          | `Input`, `Select`, `Popover`, `Command` (searchable large choice lists), `Calendar`/date-range picker pattern, `Button`, filter chips                                                                                                            |
| Tabs and records          | `Tabs`, `TabsList`, `TabsTrigger`, `TabsContent`, `Sheet`/`Drawer` for short record details; full-page route for complex work                                                                                                                    |
| Create/edit forms         | `Field`/current shadcn form pattern, `Input`, `Textarea`, `Select`, `Checkbox`, `Combobox`, `Dialog`, `AlertDialog` for dangerous changes, inline validation                                                                                     |
| Feedback                  | `Sonner` for noncritical notifications, inline `Alert`, `Skeleton`, clear empty/error/success states                                                                                                                                             |
| Reports/charts            | compact responsive bars or appropriate accessible chart library using theme tokens; charts must use real server-derived metrics and not invent statistical relationships                                                                         |

Use native semantic elements and accessible behavior. The HTML prototype's visual CSS/JS is a specification of intended appearance, **not a substitute** for the official React components.

### 3. HOD/Admin navigation and scope (implement all)

**Department:**

- Overview
- Reports & Analytics
- Inventory Oversight

**Workflow & Control:**

- HOD Approval Inbox
- Stock Adjustments

**Administration:**

- Users & Access
- Academic Batches
- Laboratories
- Approval Policies

**Governance & Personal:**

- Audit & History
- My Borrowing

Do not expose staff-only Physical Handover or Return Receipt functions to the HOD merely because they are an administrator. Such actions require separate technical-officer assignment and must prohibit self-handover. Staff users with multiple legitimate roles should see permission-aware consolidated navigation with no duplicate conflicting menus.

The existing public homepage and login design, real faculty logo/masthead and branding must be preserved; replace the prototype's `USJ` placeholder logo with the authentic asset already in the project.

### 4. Screen-specific functional acceptance criteria

#### 4.1 Overview / Department dashboard

Follow the HTML layout: page title, small scope selector, four compact KPI cards, prioritized work queue, returnable-stock state visualization, batch borrowing breakdown, and recent **operational** activity.

Show real metrics for currently borrowed returnable units, overdue borrowing records, HOD decisions currently assigned, returns awaiting inspection, and relevant stock alerts. Distinguish units, records, transactions and consumables. Do **not** add consumable quantities to returnable-unit totals or mix items with different units of measure.

Avoid the previous oversized all-purpose laboratory/batch/date filter form on the dashboard. Advanced filtering belongs in **Reports & Analytics**. Never display LOGIN/LOGOUT events under "Recent lending activity"; route identity/security events to Audit & History.

#### 4.2 Reports & Analytics — essential, not optional

Implement report tabs for borrowing, overdue equipment, inventory position and approval analysis. Provide meaningful counts, drill-down records and reusable filters, including:

- Academic batch, including students with multiple memberships
- Laboratory and storage location where applicable
- Equipment, category and returnable/consumable type
- Borrower/registration reference
- Lecturer and issuing Technical Officer
- Date range, due date, status, approval stage

Support server-side pagination, stable sorting and accurate totals; define whether each result counts units, assets, loan/borrowed records, items or transactions. Apply _all filters_ in the API and in exports. Export both **CSV and real XLSX** from authenticated, permission-scoped server endpoints; neutralize spreadsheet formulas and minimize exposed personal data. Never relabel a CSV as XLSX. The static demo CSV is not an implementation of production exports.

#### 4.3 Inventory Oversight

Use a compact, sortable table showing useful item names, categories, laboratories, type, available/reserved/borrowed/inspection/maintenance balances and item policies. Detail selection opens a contextual record view with per-asset identity and movement history where authorized.

Keep initial anonymous quantity stock separate from identified assets without double counting; the system always assigns a permanent internal asset identifier when an individual returnable unit is materialized, while the manufacturer's serial number is optional. Consumables must not get fictional return obligations. Catalogue mutation, asset changes and quantity adjustments must use their corresponding authorized backend capabilities, not blanket HOD bypass.

Unconfigured approval policies must be represented distinctly from "No academic approval"; fail closed where the required policy is unknown.

#### 4.4 HOD Approval Inbox

Only list HOD-stage decisions currently assigned to the logged-in authorized HOD actor. Show borrower, batch, laboratory, purpose, collection/return dates, requested items and quantities, lecturer stage, prior decisions, comments and every item line's actual approval path.

Support valid HOD-stage approve/reject with remarks and immutable history. Do not flatten mixed-policy multi-item requests into one fake whole-request approval. In the HTML prototype, only the **HOD-eligible line** must be decided; independently approved lecturer-only lines must not receive an unrelated HOD decision.

**No self-approval**, including for an HOD/Admin who borrows equipment; route conflicts only to a truly independent authorized substitute, otherwise block the affected action. Approval never means handover: physical issue is separately performed by authorized Technical Officer staff.

#### 4.5 Stock Adjustments

Offer an independent review queue for stock discrepancy proposals. Show the inventory item, lab/location, before/after or delta, proposer, reason, evidence reference and decision history. Proposer may not approve own adjustment. Stock conservation, ledger writes, audit records and idempotency must be transactional and authoritative server-side.

#### 4.6 Users & Access

Support create, search, filter, view, edit and disable user accounts with multiple roles per person, multiple student batch memberships, student registration numbers and laboratory assignments for lecturers/technical officers. Preserve role-grant history, disable/logout/session revocation behavior and server-side enforcement. Do not infer role from only a display badge. Support validated synthetic/batch imports if authorized; do not bring actual institutional accounts in without permission.

#### 4.7 Academic Batches

Create/edit/activate/deactivate academic batch entries where allowed. A student can belong to multiple batches. Show membership counts and authorized membership details; maintain immutable historical associations. Do not confuse academic batches with inventory lots.

#### 4.8 Laboratories

Create/edit/deactivate laboratory metadata, review assigned staff and locations, check lab-level availability, and link to stock/history. Do not treat renaming or disabling a lab as permission to rewrite stock location, transfer custody or silently change existing transactions.

#### 4.9 Approval Policies

Manage an explicit per-item policy with exactly the current supported options: none, lecturer, HOD, lecturer then HOD. Student/borrower selects an eligible lecturer when lecturer stage is required; server validates current eligibility. Retain the frozen policy snapshot and approved due-date rules for already submitted requests. Display unconfigured policy prominently and do not grant no-approval implicitly. Prevent self-approval for everyone.

#### 4.10 Audit & History

Use separate **Operations & Inventory** and **Identity & Security** views with role/record-sensitive access. Offer useful event-type, actor, object, date and laboratory filters; preserve append-only records. Comments and corrections are separate from approval decisions and security events. Display enough linkage for a reviewer to understand who did what and why, without disclosing unrestricted private data. Real exports must be permission-scoped.

#### 4.11 My Borrowing

HOD/Admin is also an ordinary borrower: browse equipment, create personal requests, monitor approval stages, currently borrowed items, due dates and history. **No special self-approval or self-handover exception**. Reuse the student/lecturer borrowing patterns and backend contracts rather than building a second inconsistent borrowing engine.

### 5. Exact visual direction — must follow HTML

- Light neutral workspace; small faculty maroon institutional band.
- Fixed well-grouped sidebar; compact header and breadcrumb; realistic professional text sizing and spacing.
- Four restrained overview metrics, not oversized colored cards.
- Compact work queue with immediately actionable row buttons.
- Cohesive reports page with tabs, filter toolbar, expandable advanced filters and disciplined tables.
- Information-dense management grids and purposeful detail sheets/dialogs.
- Meaningful status badges in restrained tones and visible loading/empty/error states.
- Consistent interaction placement, action priority and content alignment.
- Desktop, tablet and mobile adaptations; tables must not cause whole-page horizontal overflow. Keyboard navigation and readable accessible focus states required.

Do **not** bring back disconnected blocks, massive empty areas, wide multi-row filters on ordinary dashboard screens, UUID-derived item names, fake record links, or decorative charts without meaning.

The prototype's "USJ" circular seal is **only a placeholder**. Keep the actual current official faculty logo when implementing.

### 6. Engineering/team process — optimize tokens

1. Orbit gives the Frontend Engineer **one focused assignment** with this directive, the HTML file, screenshot paths and the existing authorized routes/API contracts.
2. Frontend Engineer owns full visual recreation, shared shell and responsive behavior. Reuse existing Student/Lecturer/Technical Officer design primitives where possible.
3. Backend Engineer handles only missing or incompatible authenticated endpoints, transaction-safe queries, report and administration contracts.
4. Security Reviewer checks meaningful authorization, privacy, approval, export and inventory-integrity boundaries at checkpoints, not every CSS change.
5. QA Engineer executes focused workflow checks and compares actual rendered pages to reference screenshots when browser access is authorized.
6. Do not repeatedly discuss settled architecture, create duplicate agent investigations or paste full specifications between agents.
7. Use the existing task ledger, milestone-sized changes, and short evidence-based completion notes.

**Start functional UI implementation**, not another planning or component-count report.

### 7. Required verification and acceptance

- Existing role-based APIs, per-record scope and PostgreSQL transaction safeguards remain intact.
- All enabled controls perform permitted actions against authenticated APIs; no dummy states on accepted production screens.
- Report filters and exports return accurate authorized results.
- Multi-item mixed-policy approvals are shown correctly and independent HOD decisions work.
- Self-approval and own-adjustment approval are rejected on server.
- Data table filtering, pagination, sorting, editing and empty states work.
- Compare actual desktop and mobile renderings to the attached HTML and screenshot references.
- Preserve accepted public homepage/login and faculty branding.
- Run TypeScript/lint and focused integration tests; do not treat their passing as proof of visual quality.
- Keep real university records, production credentials, external integrations and deployment out of this scope.

Report milestones concisely:

```
DONE: Functional screens implemented and connected
FILES: Changed source paths
SHADCN COMPONENTS: Actual imports/components used
API INTEGRATION: Real endpoints/authorization scopes
CHECKS: Tests actually run and results
VISUAL REVIEW: Rendered screen fidelity; mobile checks
BLOCKERS: Only genuine blockers
NEXT: Next incomplete functional slice
```

**MANDATORY: Follow the attached `index.html` reference closely. Do not redesign HOD/Admin independently. Build the real application from the existing backend, preserve the confirmed university workflow rules, and make every accepted screen operational.**
