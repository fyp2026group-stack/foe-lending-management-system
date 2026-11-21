# Stock presentation verification ? 2026-11-21

Confirmed client mapping defects: catalogue-workspace hardcoded cells=undefined; Officer InventoryArea read only availability-only item fields; Admin Overview converted absent item fields into zero. Native inventory/items returns available only. Native inventory/stock already authorizes ADMIN globally and TECHNICAL_OFFICER against staff_labs; borrower roles receive no physical cells.

Fix: paginated stock lookups feed shared itemBalances in physical catalogue and Officer Inventory/Stock Operations. Admin Overview aggregates complete authorized stock cells for returnable catalogue items. Missing undisclosed fields remain undefined and display a dash; stock failures retain their error notices. Physical catalogue availability stays unavailable until authorized cells load. Borrower catalogue does not request stock (lookup now accepts null to skip requests). No backend authorization or grants changed.

Fresh actual HTTP verification using scripts/verify-stock-presentation.mjs with existing synthetic configuration, one successful login each and paginated GET items/stock only:

| Role | Catalogue items | Stock cells | Labs represented | Returnable available | Reserved | Borrowed | Inspection | Maintenance |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Admin | 3 | 11 | 3 | 37 | 3 | 0 | 0 | 2 |
| Officer | 3 | 3 | 1 | 19 | 3 | 0 | 0 | 0 |

Neither items payload disclosed reserved. Both authorized stock payloads independently sum to reserved 3. Admin and Officer scopes differ: global versus assigned lab. Their available totals need not match. Officer stock states AVAILABLE18, AVAILABLE1 and RESERVED3 match the prior QA panel observation.

Checks: TypeScript passed. Scoped ESLint zero errors, two existing unused-variable warnings in Admin workspace. 19 focused inventory/presentation/officer tests passed, including omitted-state versus complete-empty-cell handling and item-specific aggregation. Normal sign-ins update session activity; no stock/account/business mutation, restart, seed, reset, commit or push.

Rendered limits: Browser reopened after idle with no saved session; /workspace redirected to sign-in. No saved login was available. No additional Browser login attempted; HTTP logins used the designated synthetic configuration without exposing credentials. Post-fix authenticated rendering, pixel layout and responsive proof remain unverified. Prior QA rendered evidence is historical, not evidence of this latest patch.
