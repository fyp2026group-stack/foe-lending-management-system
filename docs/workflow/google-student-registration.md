# Google sign-in for students (any verified Google account)

The app now allows any **verified Google account**, including `@gmail.com`. The Google ID token must still pass Google's cryptographic verification, audience, state, nonce, PKCE and expiry checks. Personal Google accounts are permitted; `GOOGLE_STUDENT_DOMAINS` is **not required** and is ignored.

## Local setup
Register a Google Cloud OAuth Web client with callback `http://127.0.0.1:3000/api/google/callback`. In the ignored `.verification/m2.env`, set:
```dotenv
GOOGLE_OAUTH_CLIENT_ID=<Google web client ID>
GOOGLE_OAUTH_CLIENT_SECRET=<Google web client secret>
GOOGLE_OAUTH_COOKIE_SECRET=<random secret of 32+ characters>
APP_ORIGIN=http://127.0.0.1:3000
```
Never commit real credentials. Apply migrations 052 and 053 before testing. Continue existing staff password login unchanged; Prisma is postponed.

## Account and student identity
First time Google user provides index number, registration number, full name, active batch, department, phone, optional **unverified** university email, and optional personal email. Verified Google email comes from the OAuth token and is read-only. The immutable Google `sub` is the identity link, not a typed email. Returning Google users do not need to re-enroll.

The database rejects repeated index numbers and registration numbers even when case differs; registration numbers are unique across **all users**, not just Google students. A Google account does **not** prove that someone owns an index number, so uniqueness alone does not stop impersonation by first registration. Before real equipment handover, verify claimed student identity through an authorized officer, student card, or future registrar integration. Never treat a self-declared university email as verified. Admins must handle collisions through an identity-proof and recovery workflow, not create another account with the same student number.

`npm run db:migrate` and test `tests/google-student-registration.integration.mjs` with a synthetic local DB. A real Google callback must still be tested using owner-provided Google Cloud credentials. Do not merge the draft PR until the full identity and lending integration gates pass.
