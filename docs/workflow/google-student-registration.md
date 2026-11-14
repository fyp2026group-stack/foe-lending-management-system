# Google OAuth student registration

Google sign-in is for STUDENT accounts only. Existing staff password logins and PostgreSQL protected functions remain unchanged. Prisma is postponed.

## Configure Google Cloud
Create a Web application OAuth 2.0 client in a university-controlled Google Workspace project. Authorize exact callback `http://127.0.0.1:3000/api/google/callback` for local testing. Add these secrets to the ignored `.verification/m2.env`, never Git:
- `GOOGLE_OAUTH_CLIENT_ID` — Google web client ID
- `GOOGLE_OAUTH_CLIENT_SECRET` — Google web client secret
- `GOOGLE_OAUTH_COOKIE_SECRET` — unique random >=32-character value
- `GOOGLE_STUDENT_DOMAINS` — approved *Google Workspace hosted* domain(s), comma-separated
- `APP_ORIGIN=http://127.0.0.1:3000`

Verify actual university Google Workspace hosted domains before using `sjp.ac.lk`. If student emails are not hosted by Google Workspace, an extra independent university-email verification step or university SSO is required. **Do not add gmail.com to allowed student domains** to work around this.

Run `npm run db:migrate` to apply migration 052 and `npm run dev`; visit `/login` -> Continue with Google. If new, complete index number, registration number, full name, active batch, department, phone and optional personal email. The verified university email comes from Google and is not editable. Existing linked students go straight to `/workspace`.

## Security model
Server exchanges authorization code with PKCE, state and nonce, then verifies Google's RS256 ID-token signature via JWKS, issuer, audience, expiration, verified email and hosted-domain claim. AES-GCM flow/signup cookies expire. Signup POST is origin restricted; SQL prevents duplicate subject, registration/index and email, never links an existing account by email, grants only STUDENT and audits enrollment. No account creation is attempted until a verified Google callback and completed profile.

A university email verified by Google is identity evidence, **not proof the index number or batch are correct**. Administrative or registrar verification may still be needed. Only active batches pre-created by admin are selectable. Real Google OAuth cannot be exercised by CI without institution-owned credentials.

## Verification and open issues
`npm run typecheck && npm run lint && npm run build && npm test`
`node --env-file=.verification/m2.env --test tests/google-student-registration.integration.mjs`

Manual real-provider acceptance: first signup, repeat login, expired state, wrong domain, duplicate index/registration, existing account collision, user role isolation and privacy. Existing lending integration failures in draft PR #1 remain unresolved and block merge.

No production university data or secrets should be used for local demo tests.