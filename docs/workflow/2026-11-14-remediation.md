# Reviewed corrections / acceptance boundary

This branch corrects confirmed UI data and export defects and introduces stronger UI verification.

## Verified by static inspection
- HOD borrowing counts are fetched from the ADMIN-scoped reporting API, not `borrower-history` which is scoped to the current borrower.
- The HOD overdue queue uses server filtered department records.
- Report dates are displayed by explicit timestamp keys; status, category and location remain text.
- The Technical Officer dashboard no longer displays an unconfigured stock-alert metric.
- CSV/XLSX body typing uses a safe ArrayBuffer conversion.

## Verification still required
Run the GitHub Actions checks and local PostgreSQL integration tests. Review real authenticated screens on desktop and mobile for each role. No production data, deployment or merge is included.

Remaining known risks include dynamic report reference filters, multiple batch attribution, role switching and the end-to-end physical custody lifecycle.
