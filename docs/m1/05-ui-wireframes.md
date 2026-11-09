# B06 — Annotated responsive wireframes

Status: design only; no rendered prototype, accessibility/usability execution or integration acceptance. Frontend Engineer supplied summary-based wireframes without reading files or executing tools. Orbit curated the received content and corrected the TO predicate: issuing officer must be currently assigned to the relevant lab AND have a different immutable person ID from the borrower. There is no requirement to differ from a different 'assigned TO'. No new receipt exception is approved by these designs.

C01–C17 technical baseline accepted subject review. P01–P21/PR22–PR27 deferred; SEC-01–09 open; complete OpenAPI outstanding. Conditional UI previews never imply policy acceptance or granted authority.

## Foundation and navigation

Light-first slate/white with restrained blue, system font, 4/8px spacing, body16/table14/title24–32px; status text+icons. Desktop1280: sidebar240, explicit lab/identity header, flexible content. Tablet768 collapses navigation/stacks detail. Mobile360: labelled drawer, one column, record cards/full-width primary actions. No hover dependence or horizontal body scroll.

Catalogue/My requests require active own borrower; no public catalogue/delegated requesting. Approval queue requires current academic capability/assignment/record scope/person guards. Collection requires relevant lab TO assignment and officer != borrower. Returns/inspection use distinct receive/clear/disposition capabilities; self-return/disabled-user receipt PR22 remains unresolved. History/comments require current record/field visibility; staff-note counts/previews never leak. Navigation hiding never authorizes an operation.

## 1 Request builder/detail

Desktop:
```text
[Sidebar] [Lab context]                             [Identity]
New request                   [Save draft] [Review request]
[Purpose]             Borrower: signed-in person
Kind | Item | Lab | Qty/UOM | Policy stages | Eligible lecturer
Returnable A | Lab A | [2] | [policy pending decision] | [select]
Consumable B | Lab B | [5] | [policy pending decision] | [select]
[Add line]    [Requested collection / return terms where applicable]
[Linked error summary] -> [Review] -> [Submit]
Detail: mixed counts / each line decisions, held, issued, cancelled
        requested vs approved terms / linked revisions / messages
```

Mobile:
```text
[Menu] [Lab] [Identity]
New request: Items > Details > Review
[Item card: kind/lab/qty/UOM/policy/eligible lecturer]
[Add line] [Purpose] [Requested terms]
[Error summary] [Review request] -> [Submit]
Detail: mixed status header -> per-line cards -> revision history
```

Annotation: submission does not reserve stock or guarantee future booking. Whole-line academic decisions, final-approval reservation and proposed48h duration are visibly unresolved P04/P05/P06/P21, not defaults. Partial fulfilment is separate from academic decision. Consumables omit due controls. Changing submitted quantity/terms requires new immutable linked revision/renewed decisions; harmless draft errors preserve input. Academic cohort context is not stock lot selection.

## 2 Academic approval

Desktop:
```text
[Sidebar] Approval queue [Lab/stage/filter scope] [Identity]
Request | Revision | Borrower | Lab | Stage | Updated
[Selected record] -> current revision, requested/approved terms
                    prior stage evidence + visible messages
[Approve line] [Reject line] -> [Reason] -> [Review decision]
```

Mobile:
```text
[Menu] Approval queue [Scope] [Filters]
[Request/revision/lab/stage card] -> Detail
[Revision banner] [Line/evidence] [Reason]
[Self-conflict explanation if applicable]
[Review decision] -> [Confirm permitted decision]
```

Annotation: actor cannot approve own borrowing through any role. Distinct two-stage nonborrower actors and reason requirements remain policy-dependent; UI identifies acting capability/stage without inventing grants. No bulk decisions until contract accepted. Stale409 refreshes authorized current facts, retains harmless reason text and requires fresh review; never auto-resubmit. Previous lecturer evidence appears to scoped HOD when accepted sequential policy applies.

## 3 Physical collection

Desktop:
```text
[Sidebar] Collection [Request/revision] [Lab] [Issuing officer]
1 Identify borrower -> 2 Select actual units -> 3 Review
[Identity checked by officer: approved method pending PR25]
Borrower / academic cohort snapshot / approved due terms
Line | Ready | Previously issued | Issue now | Remaining
Asset [permanent internal ID] Serial [optional]
[Review borrower/units/due/event] [Confirm physical handover]
```

Mobile:
```text
[Menu] Collection [Lab/issuing officer]
1/3 Borrower identity -> 2/3 Unit cards -> 3/3 Review
[Actual borrower] [Asset IDs/quantities] [Approved terms]
[Confirm physical handover]
-> Checking handover result / original durable event receipt
```

Annotation: current relevant lab TO != borrower. Approval is not handover. Permanent asset identity exists by issue; manufacturer serial optional; consumables no dueAt or per-unit asset. Display actual partial issue and retained hold/remaining quantities without claiming reservation policy accepted. Unknown commit uses original durable event lookup; do not offer another physical handover/new event to clear uncertainty. Current read permission governs recovered receipt disclosure. Backend derives actor/cohort; UI fields cannot override them.

## 4 Physical return/inspection

Desktop:
```text
[Sidebar] Return [Loan/event] [Lab] [Receiving officer]
Asset/line | Issued | Received | Loss resolved | Outstanding
[Actual receive quantity] [Condition] [Review receipt]
[Confirm physical receipt] -> Received into inspection (unavailable)
Authorized timeline: original due / extensions / receipt / inspection
Separate action: clearance / maintenance / governed loss or recovery
```

Mobile:
```text
[Menu] Return [Loan reference/outstanding]
[Unit card: receive now / condition]
[Officer/lab] [Review actual receipt] [Confirm receipt]
-> Receipt / inspection pending, not available
[Authorized history] [Separate disposition when permitted]
```

Annotation: physical receipt resolves outstanding into unavailable inspection atomically. No UI claim that stock is lendable. Whether missing inspection-service availability affects receipt is an unresolved failure contract; this wireframe grants no exception. Self-return and disabled borrower receipt require PR22 policy; different receiving TO is proposal until accepted. Loss closes once; recovery enters inspection without reopening historical loan. Extensions retain original/approved dates. Counts cannot exceed outstanding.

## Shared components/states and DTO needs

Components: AppShell, LabContext, ScopeSummary, FilterBar, equivalent DataTable/MobileRecordCard, QuantityField, StageIndicator, StatusBadge, CommentMessage/VersionHistory, scoped AuditTimeline, linked ErrorSummary, ConfirmationReview and ConflictPanel.

Every flow designs loading, no records, filtered-empty, denied/not-found, field validation,409 conflict, expired session, offline, unknown result and success. No mutation until current facts loaded. No offline queue, protected local storage or private service-worker caching. Authentication recovery rechecks original event outcome before retry; expired session does not prove rollback. Denied view removes protected content; no existence leak. Retained harmless memory input is cleared when authorization makes retention inappropriate.

DTO requirements: current actor/lab/capabilities/allowed actions/field visibility; catalogue item/kind/UOM/availability timestamp/eligible lecturers; revision/version/line policy and separate approval/allocation/custody counts; requested/approved terms; actual asset IDs and optional serial; immutable server-derived academic snapshot; receiving/issuing actor; original event ID/reconciliation status; safe field errors/conflict/correlation; separately authored message versions with restricted counts filtered. Backend remains authority; grant checks cannot be replaced by buttons. SEC01/02 govern access/session,03/05 state/terms,06 replay,07 audit,08 schemas/limits,09 cache/comments; SEC04 grants remains a backend prerequisite.

## Planned accessibility/usability acceptance

Verify360/768/1280,200% zoom/400% reflow, keyboard/screen reader, headings/landmarks/skip link, logical focus, dialog focus containment/restore, labelled fields/linked errors, announced async results, contrast/text+icon status, target44px controls, no body scroll. Tables use labelled scroll regions or equivalent cards. No pass claimed.

Synthetic scripts: submit mixed-policy returnable/consumable request and explain no stock guarantee; attempt own approval and understand denial; issue1 of2 ready units using different lab TO; recover timed-out handover via original event; receive damaged unit into inspection and explain unavailable status; inspect extension/loss/recovery history; compare scoped report/table/export only once those contracts are designed. Missing policy branches are reviewed as blocked previews, never activated defaults.

Acceptance pending: user workflow review, Backend DTO alignment, independent Security exposure review and QA accessibility/state coverage. This text is an annotated wireframe artifact, not a tested UI.
