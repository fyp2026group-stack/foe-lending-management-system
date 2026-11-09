# Test strategy, evidence and measurable acceptance

Planned tests only; no implementation exists and no pass results are claimed. Synthetic fixtures for four roles, multi-role person, two labs, two batches, substitute approvers, unidentified and identified equipment, consumables and disabled users. Test DB uses real PostgreSQL and production-equivalent grants; SQLite mocks cannot prove locks or permissions. Suggested tools after approval: unit runner, PostgreSQL integration harness, browser E2E runner and accessibility analyzer. Final tool/dependency selection at M1.

| Test ID / requirements | Scenario | Measurable acceptance |
|---|---|---|
| T01 AUTH-01 | Login/logout/session revocation/disabled user | All protected operations deny invalid/revoked sessions; no session token in logs |
| T02 AUTH-02/03 | Each action × four roles × own/other/lab/revoked relationships | 100% registered protected entry points have allow and deny cases; URL/body ID swaps reveal no unauthorized data/effect |
| T03 AUTH-04 | SSO issuer/audience/state/nonce/PKCE and role mapping | Invalid/replayed assertions denied; IdP role text cannot elevate app privileges; conditional on selected SSO |
| T04 INV-01/02 | 10 anonymous units, identify/issue 2, return 1 | Total remains 10 through conversion; IDs unique/stable; serial-less issue supported; history preserved |
| T05 INV-03/04 | Final-stock reserve/issue and transfer races | With 1 unit and 20 simultaneous contenders, exactly 1 successful custody allocation; balances nonnegative; no active duplicate asset loan |
| T06 INV-04 | Two-phase transfer, approval, crash/retry and import | No credit before physical destination receipt; retry creates no duplicate; failed transaction leaves no partial posting |
| T07 REQ-01/02 | Multi-line none/lecturer/HOD/both request | Correct per-line stages, captured policy versions, lecturer chosen only from eligible set |
| T08 REQ-03 | Borrower holds all roles, self-approves/issues, missing substitute | All self actions denied, no bypass by role switch; workflow remains blocked with safe explanation |
| T09 REQ-04 | Approve only, then actual TO handover | Approval creates zero loans; handover creates correct loan once, exact actor/time/asset/due date |
| T10 REQ-05 | Mixed reject/approve, partial issue, expiry vs issue, cancellation | Only eligible unissued remainder can be allocated/cancelled; all ledger and line quantities reconcile |
| T11 LOAN-01 | Partial/damaged/duplicate return, loss/recovery, extension | Received <= outstanding; duplicate retry harmless; damage unavailable until cleared; overdue excludes consumed/resolved quantity |
| T12 COM-01 | Append correction, race, predecessor spoof, direct runtime SQL | Original preserved; author/role/time retained; UPDATE/DELETE/TRUNCATE denied; cross-thread chain rejected; one winning correction |
| T13 COM-02 | Restricted comments/audit access | Unauthorized body/history/count/export denies; privileged changes have separate durable audit |
| T14 REP-01/02/03 | Filters, cohort changes, pagination and exports | Totals equal direct scoped SQL; historic issue batch remains unchanged; CSV/XLSX matches filters and escapes dangerous cells |
| T15 Security | XSS/SQLi/CSRF/SSRF/rate limit/mass assignment | Applicable ASVS rows supported by evidence; no unresolved critical/high finding, independent retest recorded |
| T16 Accessibility | Core tasks at 360px, zoom, keyboard and screen reader | All critical actions operable; no critical/serious automated issues; manual WCAG exceptions resolved/documented |
| T17 Performance | Agreed dataset/hardware and 100 active users | Proposed p95 reads <=2s/mutations <=3s, <1% unexpected errors; no invariant failures under load |
| T18 Recovery | Restore encrypted backup in isolated staging | Proposed RPO <=24h/RTO <=8h, complete restored ledger reconciliation and authorized access |
| T19 PWA/privacy | Offline/reload/logout/cache inspection | No protected record/export cached by service worker; offline mutation refused; revoked session cannot retrieve protected content |

Unit tests target policy evaluation, state guards, quantities, safe DTO/CSV transformations. Integration tests verify database constraints, transactions/grants and API auth. E2E covers borrower-to-approver-to-TO journey across distinct users and mobile viewport. Property-based generated movement sequences assert conservation and nonnegative pools. Failure injection targets rollback between identity materialization, issue and audit; expired hold races, deadlocks and bounded serialization retry must be observed. Regression suites rerun after fixes and migrations; broaden testing only when new risks warrant it.

Test evidence: commit ID, environment/config, synthetic seed, command, timestamp, actual result, artifact link and reviewer. Coverage percentages are diagnostic, not proof of security. Independent reviewer maps ASVS IDs to cases/results and signs findings; authored tests alone cannot certify author's security change. User UAT confirms institutional workflow and reporting semantics before release. Acceptance criteria changes require tracked decision approval.
