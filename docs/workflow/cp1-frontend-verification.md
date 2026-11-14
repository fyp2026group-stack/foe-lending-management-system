# Checkpoint 1 frontend verification

Implemented 2026-11-10 in `C:\Projects\LabInventorySystem`.

The inventory workspace reuses the existing official shadcn sidebar, tabs, table, dialog, button, input and badge components. No dependencies were added. Authenticated styling remains in `src/app/workspace.css`; public CSS and login sources were not edited.

## Delivered

- Integrated search, laboratory/category/type/stock-state/catalogue-status filters, active-filter indicators and reset.
- Numeric state sorting, natural name sorting, accessible sort direction and 10/20/50-row pagination across the complete filtered catalogue.
- Available/reserved/borrowed balances from CP1 item DTOs; scope and unit context, loading/empty/error states and persistent item review.
- Category/item/location creation, versioned changed-field PATCH editing, deactivation/reactivation and item specifications in generous dialogs. Location laboratory is immutable. Zero is a valid version.
- CSRF and durable command IDs retained. Unknown outcomes retry the original payload and ID; stale versions require reopening current data; linked-stock conflicts explain the restriction.
- Receipt laboratory controls eligible active locations. Receipt item selection excludes inactive catalogue items. Adjustment proposals require anonymous AVAILABLE cells; condition changes require returnable equipment and supported states.
- Permanent asset references, location/state movement context, aggregate detail balances and operational Handover/Borrowed Equipment terminology.
- Layout rules for 360px viewports, wrapped controls, horizontally scrollable tables and stacked editing forms.

## Executed checks

`npm run typecheck`, `npm run lint` and `npm run build` passed on the final implementation. Build required permission to start Next.js worker processes outside the sandbox after an initial `spawn EPERM`.

The following command passed **14/14** checks:

```text
node --test tests/inventory-ui.test.mjs tests/m2-guard.test.mjs tests/m3-import-boundaries.test.mjs tests/m3-oracles.test.mjs tests/workflow-oracles.test.mjs
```

Seven inventory checks exercise server totals, undisclosed states, physical reconciliation, state filtering/natural and numeric sorting, changed-field PATCH payloads, immutable location lab, CSRF/credentials/command identity, conflict handling and DTO/specification normalization. Seven existing regressions cover synthetic-environment guards, import boundaries and stock/workflow oracles. The full `npm test` suite was not rerun in this task.

Implementation checked against `docs/workflow/catalogue-api-contract.md`, the inventory route/handler and catalogue migration source. Database migrations and server business logic were not edited in this frontend task. Backend database execution evidence is recorded separately in APP-05; frontend checks do not establish HTTP or database mutation acceptance.

## Public source preservation

SHA256 values match the initial task baseline:

| File                                | SHA256                                                             |
| ----------------------------------- | ------------------------------------------------------------------ |
| `src/app/page.tsx`                  | `F2A867B6BA9A8D9F903A9539590F69A026D7DE837370276F94CB4F0C08538220` |
| `src/app/public.css`                | `ABF5A22B4764FC2C3EABB1CFB21BE870D502FC8E3040B27632AA0D49639AA10A` |
| `src/app/login/page.tsx`            | `905104A51DDD9A7E1E1707C4515C52616EF402E0DDE682CD109CBB9BBF1B8785` |
| `src/components/identity/login.tsx` | `5B323400CAD3B09C1F1D20BEF5A82B17346AABBABF5A609F8ADDEDB93D5FECAF` |
| `public/foe-logo.png`               | `4912CB53F1389DEDF974574ABAFA14A304B4CA4EA74C719829C43A2F8574B046` |

## Acceptance pending

Opened `http://127.0.0.1:3000/inventory` in the mounted Browser tab. The page reported `GET /api/auth/me → 401` and displayed the session-error/sign-in recovery state. No authenticated inventory appeared. Desktop/mobile screenshots, keyboard interactions, dialog/focus behavior and role-specific create/edit/deactivate/stock actions remain **unverified**. Responsive CSS and successful compilation are not visual acceptance.

Sorting, state filtering and displayed row counts operate over complete bounded catalogue reads. Existing lookup pagination stops with an explicit error beyond its supported offset, preventing partial catalogue data from appearing as complete totals. A dedicated server-side data-table endpoint can replace this bounded strategy if inventory grows beyond that limit.

Next: authenticated desktop and 360px browser acceptance, including successful create/edit/deactivate, stale version and unsafe deactivation scenarios, followed by independent QA/Security review.
