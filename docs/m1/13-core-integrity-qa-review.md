# Core integrity QA review and remaining closure points

Date: 2026-11-09. Status: design review only; M1 acceptance blocked.

Evidence: QA assignment e33eae98-a388-4fd4-8c86-1655c9dfdcb5 reviewed supplied CORE01–06 excerpts, with zero tool calls and no tests. Orbit read the saved `12-core-integrity-corrections.md` and authorization record using a read-only shell command. This is document inspection, not schema, database, permission or runtime verification. No build, installation or test ran.

The saved corrections address the direction of the proposals, but do not yet specify all enforcement details. Do not close CORE01–06 or SEC01–09.

| Closure point | Required contract detail |
|---|---|
| Durable lifecycle | Intent and immutable slots commit as pending before execution; define creation failure, crash recovery and controlled retry. A rolled-back execution cannot erase the original identity. |
| Terminal serialization | Execution and rejection use a common intent-row lock and pending conditional transition. Define atomic event/outcome writes, terminal committed/rejected states, and behavior for multiple slots without making a group an atomic business result. |
| Binding enforcement | Enumerate each operation variant and map operation, revision-line, assignment, terms, item and lab relationships to concrete composite keys, immutability rules or named guarded function checks. |
| Quantity eligibility | Define approved eligible unissued quantity from the effective immutable terms/decision chain; count each committed issue once across all intents and groups. Explain cancellation, rejection, reservation and prior issuance without double subtraction. |
| Conversion accounting | Internal anonymous-to-identified conversion is excluded from opening, external receipts and net adjustments. Consume the original allocation atomically so anonymous stock and its materialized asset cannot both remain issuable. |
| Bounded recovery | Define exact loss-to-inspection movement and cumulative recoverable balance under common loss/inventory guards. Unique recovery event identity alone cannot prevent over-credit through a fresh intent. |

Backend owns a compact replacement/addendum with these explicit rules. Security-sensitive changes require independent Security re-review before acceptance; QA's coherence assessment is not enforcement proof.

Future abstract cases, all NOT RUN: rejection versus successful execution in both winner orders; changed rejection reason and infrastructure failures; allowance-one overlapping groups; anonymous conversion failure at every atomic write and replay under a new transport key; receipt versus loss and two recoveries of the same loss. Preserve the T01/T05/T06/T09/T10/T11 and A03/A04/A05/A06/A07/A09 trace links supplied by QA.

B04 full API/read models, exact grants, policy-dependent contracts and B05 execution restrictions remain outstanding. No operational implementation or M2 work is authorized by this review.
