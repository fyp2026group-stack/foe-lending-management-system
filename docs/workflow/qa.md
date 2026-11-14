# Basic lending QA increment

2026-11-09 17:08. Read AGENTS and installed Next CLI guide. At both inspections this turn docs/workflow/api-contract.md was absent; migrations ended022 and no lending/workflow server or scripts were present. Do not invent route or schema names.

Created tests/workflow-oracles.mjs and executable oracle check: configured NONE/LECTURER/HOD/BOTH stage order, person-level self-conflict, approval leaves stock unchanged, partial return issued=received+lossResolved+outstanding and receipt delta enters inspection. One pure test passed, zero failed/skipped. These are oracle checks only, not implementation proof.

Created tests/workflow-run.integration.mjs from existing foreground runner; sequential M2/M3 regression plus workflow readiness entry. Syntax and scoped ESLint produced no diagnostics. Runner NOT RUN because workflow contract/backend absent; no DB/HTTP calls or mutations this turn. Workflow entry deliberately cannot green-pass a readiness placeholder. Essential all-role borrower/approval/issue/return executable HTTP cases are NOT COMPLETE and must be wired to the delivered contract before running.

Remaining required cases: four borrower roles, configured decision chains and mixed lines, eligible assigned actor/current revocation, multirole self-denial, approval without issue, TO!=borrower, stock competition, partial returns/inspection, audit rollback. No browser/UAT/performance/security acceptance. Only tests/workflow* and docs/workflow/qa.md edited.
