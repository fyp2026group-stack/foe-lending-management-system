# Role and record authorization

All cells require an active account, current capability, relevant lab/record scope, valid transition and conflict checks. Role names alone never permit everything. Deny by default. HOD/Admin administrative access is separate from academic approval capability (P02).

| Operation                            | Student              | Lecturer                                     | Technical Officer                                | HOD/Admin                                              |
| ------------------------------------ | -------------------- | -------------------------------------------- | ------------------------------------------------ | ------------------------------------------------------ |
| Browse availability                  | Active catalogue     | Same                                         | Same                                             | Same                                                   |
| Request / view own loans             | Own                  | Own                                          | Own                                              | Own                                                    |
| Cancel own pending/unissued quantity | Own                  | Own                                          | Own                                              | Own                                                    |
| Lecturer decision                    | No                   | Assigned eligible, others' lines             | Only if separately lecturer-capable and eligible | Only if separately lecturer-capable and eligible       |
| HOD decision                         | No                   | No unless explicit substitute capability     | No unless explicit substitute capability         | Academic approver, others' lines                       |
| Reserve / physical handover          | No                   | No                                           | Assigned lab, different borrower                 | Only separately assigned TO, different borrower        |
| Receive / inspect returns            | No                   | No                                           | Assigned lab, different borrower proposed        | Only separately assigned TO                            |
| Register asset/serial                | No                   | No                                           | Assigned lab, controlled identity operation      | Inventory capability; audited                          |
| Propose adjustment/transfer/import   | No                   | No                                           | Assigned lab                                     | Inventory controller                                   |
| Approve stock adjustment/loss        | No                   | No unless separately granted                 | No own proposal                                  | Explicit inventory controller, independent of proposer |
| Users/batches/assignments/policies   | No                   | No                                           | No                                               | Admin capability; all changes audited                  |
| Operational reports                  | Own                  | Own + assigned approvals, minimal identities | Assigned labs                                    | Department scope                                       |
| Export                               | Own permitted data   | Authorized scope                             | Authorized lab scope                             | Authorized department scope                            |
| Comments                             | Own relevant records | Assigned relevant records                    | Assigned lab operations                          | Relevant administrative records                        |
| Audit access                         | No general access    | No general access                            | Narrow operational history                       | Explicit audit capability, access logged               |

Borrowers see relevant decision remarks and public workflow comments, not restricted staff investigations or unrelated student details. Author identity can be role/display name where privacy policy requires minimization; complete author identity remains stored for authorized auditors. A student in a batch cannot see all batch loans. Aggregates must not leak unauthorized small groups; apply scope before grouping.

Prevent assignment escalation: clients cannot supply trusted borrower/actor/role/lab scope; server derives actor and verifies any requested borrower. Delegated requesting is out of scope. No request approval if actor userId equals borrower, across any roles. No TO issues to self. A second stage may require distinct approvers under proposed separation of duties; P01/P03 must confirm substitutes and whether same eligible nonborrower can fill both stages (recommended prohibit). No universal administrator bypass. Emergency support access, if later required, is separately authorized, time-limited and audited.

Query-level scoping applies to list/detail/search/export, nested relations, counts, comments, SSR payloads, server actions and direct APIs. Unavailable IDs return consistent safe errors. Revoked assignments invalidate action eligibility immediately. Permission policy tests enumerate every route/action and every role/record relationship.
