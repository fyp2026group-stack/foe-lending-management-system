# Approved equipment browser implementation — 2026-11-21

Implemented in C:\Projects\LabInventorySystem on the existing working tree; no commit or push.

- Shared typed EquipmentBrowser replaces competing cards in StudentBrowse and RequestBuilder.
- Real shadcn Table, centered Dialog + official Command (cmdk), official Checkbox, Sheet, Popover, Badge, Button, Separator, ScrollArea, Tooltip, Skeleton.
- Ctrl/Cmd+K, autofocus search, cmdk arrow-key/Enter details selection, Escape through Radix dialogs; details sheet reads source metadata and specifications.
- 20-row server pagination and bounded q/kind/policy/availableOnly queries; source DTO category and total consumed directly.
- Selected equipment hydration fetches only up to 20 selected item IDs, using server itemId filters. It never loads the complete catalogue. Existing deterministic source resolution, whole-request lecturer coverage, draft versions and submit replay remain in use.
- Desktop sticky request panel with bounded steppers, remove, maximum, type/unit counts, Continue; narrow layout summary and selection Sheet.
- /equipment is an authenticated borrower destination for Officer/Admin navigation; inventory management remains separate. Existing Student/Lecturer destinations also use the same browser.
- Removed unused equipment-choice.tsx and its obsolete CSS block; preserved pending unrelated changes.

Validation: npx tsc --noEmit passed; scoped ESLint passed; 20 focused selection, persistence, authorization, request workflow, source-query and QA acceptance checks passed. git diff --check passed (line-ending notices only).

Visual limit: attempted http://localhost:3000/equipment in mounted Browser; /api/auth/me returned 401. No authenticated desktop/mobile, keyboard interaction or pixel comparison is claimed. No competing local server was launched. QA was informed of implementation and this limit.

Current backend sources endpoint exposes only positive eligible bulk availability; Available-only toggle therefore does not reveal unavailable stock. Description fallback is explicit when the DTO provides no description. Identifiers shown are real UUID item identifiers; no invented equipment code.

## Source identity correction — 11:34 follow-up

- Exact browse basket labId/locationId now control summary labels, quantity limits and selected table rows independently of the visible page. Another source for the same equipment is disabled as Selected elsewhere; no silent substitution.
- Missing exact sources show an explicit unavailable message and remain removable.
- Equipment-only RequestBuilder passes resolved lines as the assigned source and explains that availability/approval checks assign the laboratory. Summary shows assigned laboratory/location/approval.
- Removed the redundant Available-only checkbox; filters explain that only available equipment with eligible approval paths is listed. Fixed literal question mark before Max.
- Added real-component synthetic render regressions for two laboratories across visible/filtered pages, exact-source absence and deterministic assigned-source capacity. Focused suite: 13 passed. TypeScript and scoped ESLint passed.
- Browser login navigation attempt failed with ERR_SOCKS_CONNECTION_FAILED before reaching a login page. No sign-in submission or authenticated visual acceptance is claimed.
