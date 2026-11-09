# M3 parser and scope corrections

Read AGENTS.md and installed Next route-handler guide. No server/network/dependency/commit operations. Applied new migration022 on existing local PostgreSQL15, repeated migration runner successfully; migrations010–021 unchanged.

M3SEC01: explicit package-part allowlist: content types, root/workbook relationships, core/app properties, workbook, sheet1, styles, shared strings, theme1. Unexpected parts rejected before decompression. MIME declarations allow only supported standard nonmacro workbook/XML types; declarations with entities/unexpected extensions or part names rejected. Relationship type and target allowlists restrict internal known parts; external URI/TargetMode/entity targets rejected. VBA, OLE, externalLinks, comments and arbitrary extras unsupported. This intentionally conservative import subset may reject richer otherwise legitimate workbooks; no claim to accept every Excel file.

M3SEC02: every ZIP file's actual decompressed bytes pass fatal UTF-8 decoding before policy scans. Reject NUL, UTF16/32 signatures, malformed UTF8, unsupported XML encoding declarations or inconsistent UTF8 bytes/declaration. UTF8 BOM with UTF-8 declaration accepted. DTD/entities/formulas rejected after decoding; alternate encoding cannot bypass scans. No comments/styles execution. Library ZIP reader/rebuilder retained; no custom ZIP implementation.

M3SEC03: new inventory_call definition excludes ignored assetId from items creation schema; unsupported field now422 before any insert. GET movement assetId filter remains supported.

M3SEC04: locations administrative metadata visible to ADMIN, or assigned TECHNICAL_OFFICER; assigned lecturer alone sees no locations. Active roles retain non-sensitive catalogue browsing; no physical write authority added.

Preview reopening: GET /api/inventory/imports/{id} -> {id,committed,rowCount,rows}. Requires original owner, current TO and current assignment for every stored row lab. Other ADMIN/nonowner or lost lab scope concealed404. No query parameters; immutable bounded100 rows, no new metadata disclosure. Contract updated before return.

Executed scripts/m3-import.test.mjs: supported synthetic XLSX fixture, UTF8 BOM positive; UTF16/32 formula payloads, UTF16 DTD, UTF8 bytes declaring UTF16, malformed UTF8, VBA/OLE/externalLinks/comments/unexpected part, unknown MIME, direct/entity remote relationships rejected. No network requested. Existing CSV/quantity/formula/ZIP bounds tests still pass.

Executed scripts/m3-inventory.test.mjs against022: item assetId rejected; lecturer assigned to actual test lab still receives no locations; own committed preview rows reopen identically; other ADMIN/lecturer and revoked-lab owner receive404. Core idempotency/conservation/race/import tests pass. Typecheck/lint pass. No full build/HTTP/browser acceptance or independent Security closure claimed.
