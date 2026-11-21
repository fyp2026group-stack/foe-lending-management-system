# Login credential transport review — 2026-11-21

Scope: independent review of login transport and related error/logging code. Existing frontend, QA, Prisma and workflow changes were preserved. No real credentials, secret files, historical sensitive URLs or production logs were read or reproduced. Tests used a synthetic sentinel on loopback only.

## Findings and remediation

- High: the previously reported form without an explicit method could submit email/password in a GET query before hydration or with JavaScript disabled. The backend engineer's pending `method="post"` fix was independently confirmed. Added an explicit same-origin `/login` action. Native POST now receives a 303 redirect to clean login; it intentionally does not authenticate without JavaScript.
- Medium: arbitrary login query values could remain in navigation and Next page input. Proxy now redirects before rendering, discarding all query fields except an allowlisted Google failure code. Unknown Google values are discarded. Clean login responses and redirects have `Cache-Control: no-store` and `Referrer-Policy: no-referrer`.
- Defense in depth: global `Referrer-Policy: no-referrer`; login API rejects every non-POST request (405) and every POST query string (400) before authentication/database access. JSON-body login remains subject to existing origin, size, validation and rate limits. CSRF, cookie and role controls were not weakened.
- Reviewed login client, API helper, identity handler, login service and denial audit: passwords travel in JSON POST bodies; UI errors are generic; login audit records actions/IDs rather than passwords; denial audit uses allowlisted codes. No external scripts or analytics found in reviewed login/layout sources or rendered login script sources. This is not a site-wide outbound traffic audit.

## Verification evidence

- `LOGIN_TRANSPORT_ORIGIN=http://127.0.0.1:3000 node --test --test-isolation=none tests/login-transport.http.test.mjs tests/login-errors.test.mjs`: 2 passed, 0 failed, 0 skipped. HTTP case checks actual SSR form method/action/password field, native POST redirect, removal of sensitive/unknown query values before rendering, absence of sentinel reflection/cookies, security headers, query-only GET refusal and POST-with-query refusal. No valid login or DB writes required.
- `node node_modules/typescript/bin/tsc --noEmit`: exit 0.
- Targeted ESLint: exit 0, no errors; one pre-existing relative `window.location.assign` warning in Google button.
- Mounted Browser opened clean local `/login` and showed email/password inputs and sign-in buttons. No real credentials entered. Browser JS-disabled interaction, hydrated submission/network capture, autofill/history, external egress, and production TLS/logging were not verified. Native fallback was exercised by HTTP rather than a JS-disabled browser.
- Default Node test process isolation was unavailable (`spawn EPERM`); same tests passed with Node's supported in-process test mode.

## Exposure assessment and remaining action

The reported credential-in-URL incident is a disclosure risk. Neither redirects nor response headers erase the initial request, browser history, developer output, reverse-proxy logs, or prior captures. No evidence establishes whether the real exposed URL left the local environment; no claim of zero external exposure is justified. This review did not inspect historical logs containing real values or send credentials to third parties. Recommend rotating the affected password through the authorized account procedure and invalidating affected sessions; neither was performed. Review relevant historical logging/capture retention through an authorized redacted process. Production must serve credentials only over HTTPS; local loopback HTTP tests do not prove deployment transport security.

The new security-sensitive changes require another reviewer before acceptance; this reviewer does not approve their own changes. No commit, push, deployment, dependency installation, reset, seed, deletion or rotation performed.
