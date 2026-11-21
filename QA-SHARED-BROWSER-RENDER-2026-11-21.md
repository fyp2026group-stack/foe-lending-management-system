# Shared equipment browser QA — 2026-11-21

Added `tests/equipment-browser-render.test.mjs`, preserving existing acceptance tests and application files.

The real EquipmentBrowser TSX is transpiled and rendered with React server rendering. Synthetic API hooks and UI primitive replacements isolate component rendering and callback contracts without new dependencies.

Four new tests verify catalogue content and Add dispatch; off-page selection hydration, removal and continuation; stock limits, twenty-type cap and disabled controls; empty and API-error states.

Validation completed:

- `node --test tests/equipment-browser-render.test.mjs tests/browse-equipment-acceptance.test.mjs tests/equipment-selection.test.mjs tests/lending-source-query.test.mjs`: 12 passed, zero failed. Initial sandbox attempt could not spawn Node workers; approved retry completed successfully.
- `npx tsc --noEmit`: exit 0.

Limits: no authenticated browser run, real primitive/portal integration, keyboard interaction, effect/debounce behavior, network lifecycle, responsive layout or WCAG conformance verification. Callback invocations do not simulate browser events or subsequent state renders. These results alone do not establish all-four-role acceptance or release readiness.
