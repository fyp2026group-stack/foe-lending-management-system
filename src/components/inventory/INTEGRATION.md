# M3 inventory UI - current integration

## Contract and source

Implemented against docs/m3/api-contract.md, actual inventory route/parser, migrations010-022 and docs/m3/security-parser-scope-evidence.md. Read AGENTS.md and installed Next use-client guidance before changes. Owned source under src/app/inventory and src/components/inventory; prior minimal Inventory links in identity session/workspace. No backend/package/global CSS/Git changes.

Read adapter normalizes DB snake_case. Stock uses id,item_id,lab_id,location_id,asset_id,state,quantity,version; assets use permanent UUID id and optional serial; adjustments proposer/state. Movement entries {cell_id,account,delta} display signed quantities per ledger account, not invented net amounts.

## Catalogue, lookup and management

Search/kind/category/lab filters; limit20/offset catalogue pagination with maximum offset10000. Sequential limit100 lookup pages exhaust supported category/location/item/stock/adjustment/detail history windows; overflow/error is explicit rather than presenting partial options as complete. Receipt item search/pagination is independent from the catalogue page. Location-based labels identify authorized TO laboratories. ADMIN first-location creation uses existing /api/admin/laboratories names; its unpaged100-record cap remains documented backlog, not a local synthetic blocker.

ADMIN definitions; assigned TO receipt/materialization/state movement and adjustment proposal; separate current ADMIN independent approval. Current lab/record authorization stays server-side. Asset state movement binds selected cell.assetId without manual UUID entry. Materialization offered only for loaded RETURNABLE AVAILABLE anonymous cells. Consumables have no asset/due/return; no M4 actions. Unknown mutation payload changes are blocked; approval retries retain command IDs by proposal; same command is reused for unresolved import commit.

## Import validation, reopening and commit

CSV/XLSX uploads go to server preview; server errors[{row,column,code}] display structured row/column codes, row0 file-level. Limits: XLSX512000 bytes, conservative CSV700000 bytes and server100-row validation. Parser capabilities are backend responsibility. No client parsing result is presented as persisted success.

Persisted summaries use GET imports. Every summary has Reopen preview: GET /api/inventory/imports/{id}, no query parameters. Response {id,committed,rowCount,rows} is checked for matching ID, committed boolean and row-count consistency before rendering. Server requires original owner/current TO/all stored lab assignments; concealed404 produces an unavailable message and no cached rows/commit action. Reopen creates no replacement stage. Preview heading receives focus after loading.

Uncommitted saved rows require explicit Commit reviewed receipt rows against that same stage ID. Committed stages render read-only rows with no commit button. Unknown commit retains command ID/stage binding; switching to a different stage or uploading a replacement is blocked until reconciliation. Reopening that same stage retains the retry command; a server-confirmed committed response resolves the uncertainty. Full-page recovery reopens original persisted stage; server stage deduplication protects against repeating effects. No protected local storage is introduced.

## Evidence and remaining limits

Final local typecheck and scoped lint results reported in handoff. No HTTP/network/database/browser/rendered accessibility tests performed by this frontend agent. Remaining: admin laboratory lookup beyond100; runtime mobile/keyboard/focus/contrast and end-to-end import recovery verification. These are not claims of functional or accessibility acceptance. No stale persisted-preview DTO gap remains.
