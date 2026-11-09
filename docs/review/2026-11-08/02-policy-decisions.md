# Policy approval register

All P01–P21 from Phase 1 document 03 remain unresolved proposals unless the user records acceptance. This review does not turn a recommendation into policy. Deadlines below identify the latest affected design/implementation gate, not authorization to proceed now. Technical corrections C01–C17 are in the companion review.

| Existing ID | Decision requiring user approval | Recommendation retained / clarified | Needed by |
|---|---|---|---|
| P01 | Substitute authority for staff/HOD borrowing | Independently authorized substitute, scoped and time-bounded; block without one | M2 capability design, M4 workflow |
| P02 | Academic HOD versus administrative power | Explicit separate capabilities; user administration never implies academic authority | M2 |
| P03 | Both-stage ordering and actor independence | Lecturer then HOD; recommend two distinct nonborrowers | M4 contract |
| P04 | Meaning of partial academic decisions | Whole-line decisions; mixed lines and partial fulfilment retained; within-line reduction needs approved revision model | M4 contract |
| P05 | Hold timing and partial allocation | After final approval; none-policy eligible immediately; decide whether available subset may be held | M4 |
| P06 | Hold duration and collection windows | Proposed 48 elapsed hours, lazily expired; reconcile with requested future collection date and nonworking days | M4 |
| P07 | Loan duration, limits and due-date authority | Approved due date for returnables, configured limits; institution supplies actual values and none-policy authority | M4/M5 |
| P08 | Overdue sanctions | Visibility only; no automatic fines or bans | M5 |
| P09 | Lecturer eligibility for each borrower type | Active lab assignment; explicitly decide eligible selector for staff borrowers as well as students | M4 |
| P10 | Sole TO borrowing and substitute coverage | Different assigned TO, no implicit HOD handover privilege | M2 design/M5 |
| P11 | Manufacturer/serial normalization and collisions | Manufacturer-scoped uniqueness where known; unknown-manufacturer collision reviewed; internal ID authoritative | M3 |
| P12 | Anonymous returnables | Permanent identity by issue; optional manufacturer serial; no fictional asset placeholders | M3 |
| P13 | Correction authority and restricted-thread visibility | Original message author only; replies separate; governed redaction remains independent | M2 |
| P14 | Privacy, history visibility and retention | Institution names privacy owner and retention/erasure/anonymization rules for live DB, logs, exports and backups | Before real data/release; design M2 |
| P15 | Identity provider/local fallback/MFA/bootstrap | OIDC preferred, privileged MFA verified; no local-password fallback without separate approval | M1 auth ADR/M2 |
| P16 | Independent adjustment/loss/transfer approval | Different inventory controller; set capability holders and any thresholds | M3/M5 |
| P17 | Hosting, operation and service/recovery targets | Retain proposed Docker/PostgreSQL and encrypted off-host backup design; approve operator, budget, capacity, 99.5%, RPO 24h/RTO 8h separately | M1 constraints, M7/M8 sign-off |
| P18 | Reports, staff notes and historical access | Own/assigned-lab/assigned-approval scope; clarify access after assignment expiry and minimal catalogue availability fields | M2/M6 |
| P19 | Import/export formats and resource limits | Staged bounded CSV/XLSX; approve exact bytes/rows and sensitive export fields; no macros/URL fetching | M3/M6 |
| P20 | Return inspection, maintenance and loss resolution | Physical receipt into unavailable inspection; decide clearing independence and loss/recovery actors | M5 |
| P21 | Fairness and future collection | Current stock, first atomic allocation; no future-slot booking/implicit queue. Disclose expiry limitations in request UI | M4 |

## Additional decisions not fully captured in P01–P21

| New ID | Decision | Proposed resolution / impact |
|---|---|---|
| PR22 | Self-return and disabled borrower receipt | Different assigned receiving TO; permit officer receipt of existing loans for disabled borrowers. Prevents custody becoming unrecoverable (C07/C12). |
| PR23 | Extensions and approved-decision rescission | Independent authority follows academic policy; preserve completed approvals after assignment revocation unless explicitly rescinded. Rescission affects unissued remainder only; extension records old/new dates (C04). |
| PR24 | In-transit ownership and partial/short receipt | Source owns until actual receipt. Permit partial receipts with outstanding transit; damaged receipts quarantine; shortage/loss requires independent resolution. Define who can cancel unshipped quantities (C01). |
| PR25 | Identity evidence at handover/return | Authorized officer confirms institutional identity using approved method. Do not store ID images or add QR/biometric integrations. Define acceptable manual evidence before M5. |
| PR26 | Capability grant governance | No self-elevation; bootstrap and emergency recovery are documented operator procedures. Decide second-person grant approval and last-admin protection before M2. |
| PR27 | Catalogue policy fallback | Explicit policy required; recommend direct category fallback only, no implied ancestor inheritance or default none. Institution approves before M4. |

For each accepted decision record ID, chosen value, approving person, date, affected revision and rationale/exception. Deferred decisions retain a blocking dependency in the backlog. M1 may design alternatives without inventing values; M2+ cannot implement affected behavior before acceptance. No credentials or real student details are needed to make these choices.
