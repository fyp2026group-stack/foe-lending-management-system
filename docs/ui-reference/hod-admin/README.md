# HOD/Admin Interface — Interactive UI Reference

A locally runnable **HTML/CSS/JavaScript** demonstration of a professional HOD/Admin workspace for the University Laboratory Inventory and Equipment Lending Management System.

## Main files

- `index.html` — **single self-contained file**, includes all CSS and JS; open in Chrome or Edge
- `styles.css`, `app.js` — readable source copies
- `ORBIT-IMPLEMENTATION-DIRECTIVE.md` — mandatory role-specific implementation guidance
- `screenshots/` — browser-rendered screen references

## Navigation / screens

1. **Overview** — departmental KPIs, HOD work queue, stock states, batch activity, operational history
2. **Reports & Analytics** — reports, filters, drill-down structure, demo CSV
3. **Inventory Oversight** — stock table, policy and item details
4. **HOD Approval Inbox** — HOD-stage decisions, per-line detail, conflict rejection
5. **Stock Adjustments** — independent stock correction review
6. **Users & Access** — multiple roles, batches, staff laboratory assignments, account management
7. **Academic Batches** — cohort management and membership drill-down
8. **Laboratories** — facility management and assigned personnel
9. **Approval Policies** — explicit per-item none / lecturer / HOD / both policies
10. **Audit & History** — operations separated from identity/security events
11. **My Borrowing** — HOD/Admin as ordinary borrower

## How to use

1. Extract the ZIP on Windows.
2. Open `index.html` locally in Chrome/Edge. No server, dependencies or internet required.
3. Click sidebar pages, filters, rows, detail panels, example approvals and account forms.
4. Inspect the screenshot set; it illustrates the intended professional layout.
5. Give Orbit `index.html`, the directive and the screenshots. Require the Frontend Engineer to recreate this layout with **official shadcn/ui React components** and actual server-backed APIs.

## What it is NOT

- This is **not** real shadcn/ui code: the HTML is a framework-free _visual/interaction specification_. React implementation must import actual shadcn/ui components.
- All account names, equipment, counts, dates, university codes, report output and interactions are **sample synthetic demonstrations**.
- Example create/edit/approval actions affect only temporary in-browser state, not a database.
- CSV export is explicitly a **sample**; XLSX is not implemented here.
- The circular `USJ` logo is illustrative, not a replacement for the official university/faculty logo. Reuse the real asset from the existing application.
- Some advanced production functions, including multi-item request composer, permission-scoped export, authenticated audit browsing and full accessibility validation, require the actual application.

### Product rules that must survive translation

- All four roles may borrow under item-specific policies.
- HOD decisions apply only to eligible HOD-stage lines; lecturer stage is separate.
- Nobody may approve their own request, including the administrator.
- HOD/Admin may not independently hand themselves equipment.
- Stock adjustment proposer cannot approve their own proposal.
- Physical return enters Inspection; separate authorized clearance releases the item.
- Initial quantities do not require serial numbers; permanent internal asset identity is created when an asset is materialized.
- Consumables and returnable equipment must not be summed into a misleading common unit count.
- Comments and corrections are append-only; audit and approval records remain distinct.
- Detailed batch-, lab-, lecturer-, officer-, borrower-, category-, status- and date-filtered reports are core requirements.
