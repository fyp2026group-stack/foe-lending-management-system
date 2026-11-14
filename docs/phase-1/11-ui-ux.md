# Responsive UI/UX specification and page inventory

Minimal university operations interface: neutral surfaces, one accent, system font, readable labels and status text plus icon (never color alone). Shared header, role-aware navigation and explicit current lab context; switching role does not change identity/conflict rules. Desktop tables and compact mobile record cards expose equivalent actions. No decorative animation; honor reduced motion. This document is a specification, not an implemented mock-up.

## Pages

| Page                           | Primary content/actions                                                                               | Scope                                  |
| ------------------------------ | ----------------------------------------------------------------------------------------------------- | -------------------------------------- |
| Login/session expired          | SSO/local chosen path, safe recovery/error                                                            | Public; no internal account disclosure |
| My overview                    | Own pending actions, upcoming returns, overdue                                                        | Every borrower                         |
| Catalogue/item detail          | Search, category/lab availability, add quantity                                                       | Active users                           |
| Request builder                | Multi-line cart, dates/purpose, line approval labels, eligible lecturer                               | Own draft                              |
| Request detail/history         | Per-line decisions, quantities, comments/version history, cancellation                                | Relevant participants                  |
| My borrowing/loan detail       | Due dates, assets, partial returns, extension request                                                 | Own                                    |
| Approval inbox/detail          | Scoped queues; reasoned approve/reject, conflict notice                                               | Assigned academic approvers            |
| TO collection desk             | Ready lines, identity scan/search future, actual quantities, asset/serial capture, final confirmation | Assigned TO                            |
| Return/inspection desk         | Outstanding assets, physical receipt, condition, maintenance clearing                                 | Assigned TO                            |
| Inventory/assets               | Item/lab balances, asset history, serial corrections                                                  | Inventory operators                    |
| Movement/import/transfer       | Staged preview, validation, separate approval and receipt                                             | Authorized operators                   |
| HOD dashboard                  | Stock and lending KPIs, overdue, approval backlog, charts                                             | Admin/academic scope                   |
| Reports                        | Batch/lab/category/date filters, borrower/activity views, CSV/XLSX                                    | Authorized scope                       |
| Administration                 | Users, batches, role/assignment grants, policy revisions                                              | Admin                                  |
| Audit/history                  | Structured events, filters, access history                                                            | Audit capability                       |
| Access denied/not found/errors | Safe message, correlation ID, recovery navigation                                                     | All                                    |

## Layout and accessibility

At 360px one-column forms and stacked actions; no horizontal body scroll. Wide tables scroll inside labelled region with accessible headers and keyboard control, or switch to equivalent cards. At tablet/desktop use sidebar and content maximum width; primary operations reachable without hover. Touch targets aim >=44px, visible focus, semantic landmarks, skip link, labelled inputs/descriptions, error summary linked to fields, accessible dialog focus trap/return, screen-reader status announcements. Target WCAG 2.2 AA contrast and keyboard operation; components alone do not establish compliance.

Forms preserve drafts on validation failure but do not store sensitive records indefinitely in local storage. Handover review lists actual borrower, lab, each asset/quantity and due date; explicit officer confirmation records physical event. Approval button never resembles issue button. Concurrency conflict refreshes availability and explains which action failed without losing unrelated entries. Disable double submission visually but rely on server idempotency. Serial field clearly optional, internal ID preview permanent.

Mixed policies show a line-level stage indicator; request header says e.g. '2 ready, 1 awaiting HOD' rather than misleading 'approved'. Distinct empty (no data), filtered-empty, loading, offline and permission/error states. Offline banner prevents mutation; no queued loan/return operations. Dashboard charts limited to meaningful bars/lines with equivalent tables, accessible labels and date/source notes. All filters apply to KPI, table and export alike.

Design review before implementation: approve mobile/desktop wireframes for request, approvals, handover and return. QA checks 360/768/1280px, 200% zoom and 400% reflow where applicable, keyboard-only and at least one screen reader; light/dark only if both are intentionally supported. No HTML dashboard or package installation needed in Phase 1.
