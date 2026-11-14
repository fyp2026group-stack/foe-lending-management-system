# Reviewable implementation roadmap

No milestone authorizes work by itself. M0 is this planning phase; M1 onward requires explicit user approval of SRS, architecture, database and development plan. Estimates are indicative active engineering weeks, excluding institutional decisions/review availability; revise after M1, not a delivery commitment.

| Milestone                               | Scope / owner                   | Reviewable output / exit gate                                                                                                  | Estimate          |
| --------------------------------------- | ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ | ----------------- |
| M0 Planning                             | Lead                            | 14 documents, policy register, ER/workflows, ASVS register; user accepts/changes decisions                                     | Current phase     |
| M1 Foundation                           | Backend + Lead                  | Version/security ADR, Git workflow, strict TS, migrations/grants design, synthetic fixtures, API contracts, UI wireframes      | 1–2 weeks         |
| M2 Identity and append-only foundations | Backend                         | Sessions, roles/scopes, assignments/batches, comments/audit, negative permission tests; independent security review            | 1–2 weeks         |
| M3 Inventory integrity                  | Backend                         | Receipts/assets/anonymous conversion, ledger, controlled transfers/adjustments/import; concurrency and reconciliation evidence | 2–3 weeks         |
| M4 Requests and approvals               | Backend + Frontend sequentially | Mixed policy lines, substitutes/conflicts, reservations/expiry/cancellation, mobile request/approval screens                   | 2 weeks           |
| M5 Handover and returns                 | Backend + Frontend sequentially | Actual issue, partial return, inspection/loss/overdue, history; independent security/QA retest                                 | 2 weeks           |
| M6 Reporting and interface completion   | Frontend                        | All role pages, scoped dashboard/reports/CSV/XLSX, accessibility and performance evidence                                      | 1–2 weeks         |
| M7 Hardening and release candidate      | QA + Security sequentially      | Full acceptance evidence, resolved findings, restore rehearsal, runbooks/SBOM/config review                                    | 1–2 weeks         |
| M8 Authorized deployment/handover       | Operator + Lead                 | User separately approves environment and deployment; staging UAT then controlled production rollout                            | Separate decision |

Dependencies: M2 before protected workflows; M3 before reservations/issue; M4 before M5; report projections depend on stable ledger; security testing starts early and repeats on changes. Test design occurs alongside contracts, not only M7. Security/QA reviewers currently unprovisioned: independent gates cannot pass until authorized qualified reviewer exists.

Per milestone: scope/task IDs → contract/ADR review → small owned branches → tests → independent review → integration checkpoint → demonstration with synthetic data → acceptance record. Lead resolves technical tradeoffs and requests institutional decisions only where necessary. No package install, repo scaffolding, external SSO/mail, CI service integration or deployment until authorized for the milestone. No scheduled automations.

Release rollback: compatible expand/contract migrations, backup/restore proof, feature disable plan and reconciliation of in-flight custody; never blindly roll back ledger records. Production incident response names operator, escalation and pause-lending procedure before release. Documentation deliverables include API, data dictionary, user/admin guide, security findings and operations runbook.
