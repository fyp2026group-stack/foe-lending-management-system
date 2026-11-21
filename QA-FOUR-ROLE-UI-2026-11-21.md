# Independent local role verification — 2026-11-21

Scope: mounted Browser at http://127.0.0.1:3000, existing synthetic accounts, sign-in and read-only navigation only. No borrowing, approvals, handovers, returns, seeds, resets, source edits, server restarts or test suite execution. Checks used rendered accessibility trees and visible page text; no screenshot/responsive visual proof was collected.

| Account | Destinations actually rendered | Result |
| --- | --- | --- |
| admin@example.invalid | Department Overview; Reports & Analytics; Inventory Oversight; HOD Approval Inbox; Administration / Users & Access; Audit & History; My Borrowing | Sign-in passed. Overview, Reports and Audit failed with GET /api/admin/reports HTTP 503. Other listed pages rendered records or empty states. |
| student@example.invalid | Dashboard; Browse Equipment; My Requests; Borrowed Equipment; New borrowing request, initial equipment step | Sign-in passed; all listed pages rendered, with 2 requests, 1 pending, 1 ready and 0 borrowed. Display defects below. |
| lecturer@example.invalid | Dashboard; Browse Equipment; My Requests; Borrowed Equipment; Approval Inbox | Sign-in passed; all listed pages rendered. One ready request, no assigned approvals, no current loans. Shared catalogue display defect below. |
| officer@example.invalid | Operations Dashboard; Equipment Handovers; Receive Returns; Inspections; Inventory Catalogue | Sign-in passed. Dashboard and Inventory Catalogue failed partially with GET /api/lending/operations-summary HTTP 503. Handovers showed 2 rows; returns and inspections rendered empty states. |

## Reproducible observations

1. High: sign in as Admin, open /workspace, /admin/reports or /admin/audit. GET /api/admin/reports returns 503. Reports/Audit show “Something needs attention”, generic retry guidance, “Return to sign in”, then “No report records” and 0 total records. The failed load is presented alongside an apparently empty result. Inventory separately loads three equipment types with available quantities 9, 9 and 19, but reserved/borrowed columns are dashes.
2. High: sign in as Technical Officer, open /workspace or /operations?view=inventory. GET /api/lending/operations-summary returns 503. Dashboard still shows 2 ready handovers but completed lending operations is a dash. Inventory loads three items but reserved/borrowed/inspection/maintenance quantities are dashes and the error banner remains.
3. Medium, possible shared presentation/data mapping issue: Student and Lecturer /inventory render one card as “Unnamed equipment”, “Uncategorized / M3 / Store”, 8 available. Student request builder separately renders Equipment 5c362a93-ea83-4f7f-97dc-12f29c9c0f07 with 8 available. Same-item correspondence inferred from displayed quantities/location, not established via item IDs.
4. Low: Student /borrowing?view=new says “Step 1 of 3” but shows 1 Equipment, 2 Request details, 3 Review, 4 Complete. No form input or submission performed.
5. Medium, data quality/presentation: officer account displays literal “null” as name and “Welcome, null.” Admin Users & Access also lists its name as null. Source of malformed name was not investigated.
6. Needs follow-up: Officer handover page lists 2 collection-ready requests but “Items reserved” and each row's Reserved column show 0. Dashboard rows show quantities 2 and 1. No underlying allocation inspection or operation was performed; cannot establish whether this is a valid empty allocation or display defect.
7. Needs clarification: Lecturer dashboard says no approvals waiting while Student has one lecturer-review request. Assignment identity was not inspected; this is not evidence of an authorization defect.

## Connectivity and limits

After Officer Inventory Catalogue, opening /operations?view=requests, stock and activity each failed with net::ERR_SOCKS_CONNECTION_FAILED. No rendered verification for those three destinations. Subsequent local shell request to /login failed with curl exit 7 / HTTP 000, connection refused. No restart attempted. This does not establish the cause of the browser failure.

No mobile/tablet/responsive, pixel layout, WCAG conformance, export, item-detail, additional administration tabs, mutation workflow or multi-role account verification completed. HTTP failures above were explicit 503 responses, not canceled obsolete fetches. Source changes by other team members were pending throughout; no claim that these observations describe a final fixed revision. No release recommendation.

## Post-fix rendered recheck — separate evidence

Reopened the mounted Browser after the reported retry/presentation changes and restored server. Read BACKEND-ROLE-RECONCILIATION-2026-11-21.md as teammate evidence; its HTTP results are not independent QA rendering proof.

| Role | Fresh rendered evidence | Result / limit |
| --- | --- | --- |
| Admin | Successful sign-in; initial Department Overview; Reports & Analytics; Audit & History; second Department Overview navigation | Initial Overview STILL produced GET /api/admin/reports HTTP 503, red error and borrowed/overdue dashes. Reports subsequently rendered a clean empty state. Audit rendered rows with 68 total records. Second Overview navigation rendered borrowed=0 and overdue=0 without the error. Thus the overview failure is intermittent and remains unresolved by rendered QA. |
| Technical Officer | Login page only | Sign-in rejected with “Sign-in unsuccessful / Too many sign-in attempts. Please wait and try again.” No fresh officer workspace proof. |
| Student | None in this post-fix pass | Not reverified after the sign-in throttle blocked continuation. Original observations above remain historical. |
| Lecturer | None in this post-fix pass | Not reverified after the sign-in throttle blocked continuation. Original observations above remain historical. |

The initial Admin Overview is an actual rendered concurrent dashboard load, not a sequential API simulation. Its 503 was explicitly reported by Browser alongside the visible error; canceled fetches were not counted. A second navigation succeeding does not invalidate the first failure. No additional synthetic stress requests were sent in this pass.

Reserved-quantity investigation: current src/components/technical-officer/workspace.tsx Handovers obtains allocations and requests independently, joins request lines by lineId, and calculates each displayed reserved quantity as max(0, min(allocation.quantity - allocation.issued, matchedLine.reservedQuantity ?? 0)). The total sums that expression. A missing matched request line therefore renders zero. This establishes the zero fallback path but not why matching failed previously. Backend's stated allocation quantities 2/1 and RESERVED stock 3 were not independently queried in this pass. No mapping patch was made without fresh payload/rendered evidence; do not consider reserved quantities verified or corrected.

The throttle was not reset, bypassed, or retried. No server restart, account modification, borrowing mutation, source change or test suite run was performed. Only this report was updated. Remaining work: after normal sign-in access is available, recheck officer overview/inventory/handovers (expected reserved 2 + 1 = 3 per Backend), requests/stock/activity; Student/Lecturer main pages; presentation fixes; repeat Admin concurrent overview with server-side error correlation. No release recommendation.

## Final rendered pass after structural correction — 11:04 onward, Sri Lanka time

This section supersedes the retry-only outcome for the final observed behavior; earlier evidence is retained. Read the backend report's 11:02 correction, then independently checked Browser rendering. Exactly one successful sign-in per role in this pass; no rate-limit reset or bypass. Used normal page navigations and the UI's own concurrent fetches, without additional stress traffic. Waited for transient loading placeholders to settle before reporting results.

| Role | Final destinations inspected | Observed result |
| --- | --- | --- |
| Admin | Overview first load plus two subsequent navigations; Reports; Audit | PASS for the reported HTTP/error failure: all three settled Overview loads show borrowed=0, overdue=0 and no error banner; Reports shows a clean empty result; Audit renders rows and 68 total. No 503 was reported during these observations. |
| Technical Officer | Overview; Inventory; Handovers; My Requests; Stock Operations including its automatically opened identify/correct panel; Activity & History | PASS for reported HTTP failure and handover quantities: dashboard ready=2, completed operations=0, no error banner; handovers reserved rows 2 and 1, total Items reserved=3. Requests renders a clean empty state; Activity shows five movement records. Stock panel shows Reserved=3 and Available cells 18 and 1; closed it without submitting anything. Officer identity now uses officer@example.invalid instead of null. Inventory columns limitation below remains. |
| Student | Settled Dashboard; Browse Equipment; My Requests; Borrowed Equipment; initial New Request step | PASS for checked rendering: dashboard pending=1, ready=1, borrowed=0; requests has two rows; loans empty. Catalogue preserves full equipment/category/lab names. Request form shows numbered stages 1,2,3 followed by unnumbered Complete, consistent with Step 1 of 3. No request created. |
| Lecturer | Settled Dashboard; Browse Equipment; Approval Inbox; My Requests; Borrowed Equipment | PASS for checked rendering: 0 assigned approvals, 1 submitted/ready request, 0 loans. Catalogue preserves full equipment/category/lab names. Inbox and loan empty states render; requests shows the existing ready row. |

Reserved handover display is now independently verified: Synthetic student / Synthetic Multimeter = 2; Synthetic lecturer / Synthetic Multimeter = 1; total = 3. The prior all-zero handover observation did not recur; no QA source patch needed.

Remaining concrete reporting discrepancy: Officer Inventory and settled Stock Operations catalogue list Available 19/9/9 but still show dashes for Reserved, Borrowed, Inspection and Maintenance. The same stock panel separately proves a Reserved cell of 3. Admin Overview stock state shows Available=37 and Reserved=0, despite the officer's visible Reserved=3. Department/laboratory scope equivalence was not established, so the Admin discrepancy is a follow-up rather than a proven conservation defect. The original HTTP failure is resolved in this finite rendered sample; completeness/correctness of every inventory state total is not signed off.

Limits: no pixel screenshots, responsive/mobile/tablet layouts, WCAG audit, exports, approval decisions, handover/return operations, new stock, corrections, seeds, resets, server restarts, source changes, commits or pushes. Officer returns/inspections were checked in the original pass, not repeated in this final pass. Additional Admin pages retain only original-pass evidence. Only this QA report was changed. Normal sign-ins and read requests may create the app's usual session/audit activity; no laboratory business data was mutated. Backend load-test results remain separately attributed to Backend and were not rerun by QA.
