# M2 interface contract integration

Aligned against docs/m2/api-contract.md and the supplied confirmed contract. Routes /login, /workspace and /admin/{users,batches,laboratories} use same-origin no-store fetch; no client storage, offline queue or invented persistence.

- Login POST {email,password}, followed by GET me {user:{id,displayName,email,roles},csrfToken}; logout POST with X-CSRF-Token. Server origin/session/authorization enforcement remains authority.
- Roles STUDENT, LECTURER, TECHNICAL_OFFICER, ADMIN are displayed as human labels. Controlled checkboxes send exact identifiers. Navigation hides admin links for non-ADMIN as presentation only; direct API authorization stays server-side. No HOD role inferred.
- GET admin lists require {items}, capped 100; no fabricated pagination. Name-only batch/laboratory creation sends exactly {name}; no code columns or input.
- User creation sends email,displayName,password,roles,laboratoryIds and, for students, batchId and registrationNumber. No disabled flag at creation. Student batch selector is populated from GET batches; laboratory checkboxes use GET laboratories. Password guidance and browser bounds are 12–128 characters.
- User PATCH sends only roles,disabled,laboratoryIds. Email/displayName are read-only context. Self-change control is disabled; backend independently rejects it. Existing laboratory IDs are copied from the selected row, including unknown IDs outside the 100-item lookup cap, and preserved unless explicitly removed. Changing role checkboxes does not clear assignments.
- Non-secret form controls remain mounted and preserve values after errors. Password cleared after each attempt. Successful writes trigger server reload; uncertain saves advise reload before retry. Error summary receives focus; 401/403 blocks management controls. Errors are generic rather than arbitrary server markup; field-error DTO is not supplied.
- Workspace shows all active human-labelled roles, links only implemented destinations, and explicitly identifies unimplemented role workflows without suggesting they exist.

No backend/network/browser execution by this agent. Typecheck/lint results reported in handoff. Runtime persistence, CSRF rotation behavior, password policy enforcement, server validation and keyboard/render acceptance require integration verification. Lookup caps may omit valid batches/labs; existing lab assignments remain visible by ID rather than silently removed.
