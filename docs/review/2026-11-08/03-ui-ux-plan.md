# Desktop and mobile UI/UX design plan

This expands Phase 1 document 11 without changing its functional scope. It is a design specification with low-fidelity wireframes, not implemented screens. All examples are synthetic. Light theme first; dark theme and decorative animation are not part of the proposed initial scope.

## Design direction and navigation

Professional university operations: neutral slate surfaces, white content panels, one restrained blue accent; green/amber/red communicate status only alongside readable text and icons. Proposed tokens: 4/8px spacing scale, 16px body, 14px table text, 24–32px page titles, 8px panel radius, clear borders, minimal shadows. Final colors must pass contrast checks before acceptance. Use system fonts and reviewed shadcn primitives, not a large bespoke component library.

Desktop (1280px reference): 240px sidebar, compact top bar showing current lab and signed-in identity, page heading/primary action, contextual filters, content region with readable max width. Tables have sticky headers where useful, explicit row actions, pagination and column labels. Never expose student identifiers in global navigation/search beyond authorized need.

Mobile (360px reference): one column, compact header and labelled navigation drawer. My overview, Catalogue, Requests, Borrowing and relevant staff workspaces are directly reachable. Staff queue filters become a labelled sheet; cards replace action-heavy tables. Keep the record identity and lab visible during review. Sticky bottom primary action must not cover content, keyboard, errors or focused elements. At 768px adapt to content; avoid assuming every tablet supports hover.

| Workspace | Pages / actions | Important distinction |
|---|---|---|
| My work (all roles) | Overview, catalogue, request builder/history, borrowing, extension request | Staff still borrow through the same personal workflow |
| Approvals (eligible actors) | Lecturer/HOD queue, line detail, reasoned decision | Show stage and acting capability; never a handover action |
| Laboratory operations | Collection, returns, inspection, assets, movements/imports/transfers | Current lab, physical event and actual quantity always visible |
| Oversight | Scoped dashboard/reports, audit, administration | Academic approval, inventory control and user administration capabilities remain separate |

Role/workspace selection is a navigation aid; it cannot change immutable identity or bypass person-conflict rules. Hide irrelevant navigation while showing safe explanations when a previously valid action becomes unavailable.

## Core wireframe specifications

### Request builder and detail

Desktop: heading and saved-draft indicator → item/lab search and availability timestamp → line table (item, kind, lab, quantity, policy stages, lecturer if needed, collection/due terms) → purpose → review summary and Submit request. Side panel summarizes lines and validation issues. Keep review separate from final submission; draft edits do not imply stock reservation.

Mobile wireframe:

```text
☰  New request                 Lab A
1 Items  >  2 Details  >  3 Review
[Search catalogue______________]
Equipment A · returnable
Quantity [ 2 ]   Available now: 4
Approval: Lecturer → HOD
Lecturer [Select eligible person]
[Add another item]
Collection [date/time]
Requested due [date/time]
Purpose [_____________________]
No stock held until final approval
[Review request]
```

Detail shows header “2 ready · 1 awaiting HOD” and each line's separate approval, reservation/expiry, issued and cancelled quantities. Consumables omit return date controls. Show approved dates alongside requested dates. Policy or quantity changes after submission require a new linked revision with confirmation of renewed approvals. Expiry uses explicit Sri Lanka date/time plus relative text; do not imply guaranteed future booking.

### Lecturer/HOD approval

Desktop: scoped queue at left; detail panel with borrower, purpose, lab, submitted revision and requested/approved terms; line policy/previous decisions; Approve line and Reject line actions with reason field. Mobile: queue cards → full-page detail → review decision. Default no bulk academic decision until safe semantics are approved. Disable decisions on stale revisions and explain reassignment/self-conflict without exposing unrelated people. HOD sees lecturer evidence for sequential “both” lines. Preserve entered reason after 409 and require review of refreshed facts.

### Physical collection desk

Desktop: search authorized ready request → borrower identity confirmation → actual line quantities/asset selection → review pane with actor, lab, each permanent asset code, optional serial, dueAt and remaining quantity → **Confirm physical handover**. Use a distinct label from **Approve line**. Mobile breaks this into Identify borrower → Select units → Review handover; show progress and a final summary with no hidden defaults.

```text
Collection · Request DEMO-014
Borrower: Demo Borrower · Lab A
[ ] Identity checked by officer
Equipment A   Ready 2 / Issue [1]
Asset [A-001]   Serial [optional]
Due: 12 Nov 2026, 4:00 PM Sri Lanka
After issue: 1 remains reserved
[Review physical handover]
```

Newly materialized permanent asset IDs are displayed in the reviewed outcome; identity creation cannot add stock. Missing optional serial is not an error. If confirmation times out, show “Checking handover result” and recover the original event result before permitting another physical confirmation. Never tell an officer to hand over twice because a response was lost.

### Return and inspection

Find authorized outstanding loan → select physically received assets/quantity → record condition and receiving officer → confirm receipt into inspection. Show original due date, approved extension history and outstanding custody. Separate inspection screen clears to available, places in maintenance or proposes governed loss/retirement. Return success says “Received into inspection”; it must not claim the asset is available. Mobile uses labelled asset cards with visible outstanding/received counts and a final receipt summary. Lost recovery is a separate action linked to the loss record.

### Secondary operations

Inventory detail exposes available/reserved/borrowed/inspection/maintenance/transit separately; overdue is a borrowed subset, never added to stock totals. Movement history includes identity materialization and compensations. Transfer screen distinguishes approval, dispatch and destination receipt, including partial/damaged receipt. Import wizard: choose file → bounded validation → row-level preview/issues → authorized commit → immutable result. No automatic commit from upload. Dashboards provide equivalent tables and common filters; report export shows scope, date range and minimized fields before download. Administration distinguishes academic approval from administrative grant authority; audit and staff-note visibility are explicit.

## Component and interaction contract

Define AppShell, LabContext, ScopeSummary, FilterBar, DataTable/MobileRecordCard, QuantityField, StageIndicator, StatusBadge, CommentMessage/VersionHistory, AuditTimeline, ErrorSummary, ConfirmationReview and ConflictPanel. Public DTOs provide only authorized fields/actions; the server still validates every action. Tables and cards must provide equivalent information, filters and actions.

Every page designs loading, no records, filtered-empty, denied/not-found, validation, conflict, expired session, offline, timeout/unknown result and success states. No queued offline mutations. Preserve harmless input through validation/reauthentication where policy allows; never persist protected pages or comment bodies indefinitely in local storage. Restricted notes are labelled and absent from borrower counts/previews. Correction history clearly shows original author, version and date, while replies remain independent messages.

Accessibility: semantic landmarks/skip link; visible focus; keyboard navigation; labelled fields with instructions; error summary links; dialogs restore focus; status changes announced without excessive live-region output. Status never relies on color. Aim for at least 44px touch targets. Verify 360/768/1280px, 200% zoom and 400% reflow, screen reader flow, contrast, long names/text and no horizontal body scroll. Narrow table scrolling uses a labelled region; prefer cards for action-heavy workflows.

## Design deliverables and acceptance

M1 deliverables: annotated desktop/mobile wireframes for the four critical flows; navigation/capability map; tokens/component inventory; state/error specimens; synthetic usability script and QA checklist. User reviews workflow meaning; Frontend produces the design when staffed, Backend checks DTO/state compatibility, Security reviews identity/data exposure and QA checks accessibility. If roles remain unstaffed, independent acceptance remains pending.

Usability tasks: submit mixed-policy request; decide one eligible line; attempt self-approval and understand the block; issue one of two ready units; recover a timed-out confirmation; receive a damaged unit; find why it is unavailable; view overdue quantity and export the same filtered authorized report. Acceptance requires correct task completion without hidden hover actions, understandable stock/approval distinction, keyboard/screen-reader operability and no privacy leakage. Actual prototype/browser evidence is required later; none is claimed by these textual wireframes.
