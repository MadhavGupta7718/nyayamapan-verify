# Security Audit

Scope: authentication and session lifetime, server-side authorisation (RBAC and record scoping), public certificate verification, HTTP security headers, secrets handling, and the advisory-only AI boundary. Tested against the production build on `http://localhost:3001` with the seeded database. `.env` was **not** opened during the audit; only `.env.example` (placeholders) was read.

`npm run smoke` is the regression suite for everything below. It signs in as all 8 roles and asserts the results listed in the tables. It currently passes.

## Authorisation boundaries verified by `npm run smoke`

| Check | Expected | Result |
|-------|----------|--------|
| Anonymous `GET` on applications, certificates, instruments, audit, reports, search, GATC, rules APIs | 401 | ✅ |
| Anonymous `POST/PATCH` on users, notifications, settings, profile | 401 | ✅ |
| Anonymous cron (`/api/cron/expiry`) without `CRON_SECRET` | 401 | ✅ |
| Anonymous portal page | 307 → `/login` | ✅ |
| Every role × 15 modules × 2 locales renders the module or the "no access" page exactly as the RBAC matrix says | per matrix | ✅ |
| Business user → audit API, create user, change settings, create rule, create schedule | 403 | ✅ |
| Inspector → create rule; Auditor → create schedule | 403 | ✅ |
| Business user → record a verification result; Auditor → start a verification | 403/404 | ✅ |
| Auditor → revoke a certificate | 403 | ✅ |
| Business user → another organisation's application API / certificate PDF | 404/403 | ✅ |
| Business user → another organisation's application / certificate *page*: record number absent from HTML, not-found rendered | no leak | ✅ |
| Business user application list contains no foreign records | none | ✅ |
| Suspending a signed-in user ends the session on the next request (API 401, page → `/login`) | immediate | ✅ |
| Public certificate API contains no `email`, `mobile`, `phone`, `address`, `gstin`, holder, organisation, applicant or coordinates | none | ✅ |
| Unknown public token | `INVALID` | ✅ |

## Issues

| ID | Severity | Issue | Status |
|----|----------|-------|--------|
| SEC-01 | HIGH | Deleted or suspended users kept access until their JWT expired | Fixed |
| SEC-02 | HIGH | Foreign record numbers leaked through page `<title>` metadata | Fixed |
| SEC-03 | MEDIUM | Administrators could submit or cancel another user's draft | Fixed |
| SEC-04 | MEDIUM | No Content-Security-Policy | Fixed |
| SEC-05 | MEDIUM | A result can be recorded without GPS arrival or required photos | Fixed (evidence required, with an audited exception) |
| SEC-06 | LOW | CSP still permits inline scripts | Accepted for now |
| SEC-07 | LOW | Quick-access sign-in exposes the seeded password to the browser when enabled | Mitigated by configuration |
| SEC-08 | LOW | Sign-out and some redirects use `AUTH_URL`'s host | Configuration |

### SEC-01 · Deleted or suspended users kept access until their JWT expired
- **Severity:** HIGH
- **Page:** Every portal page and API
- **Root cause:** Sessions are stateless JWTs, and `getSessionUser` trusted the token's claims. A user who was suspended, deactivated, deleted or re-roled kept their old access until the token expired. A deleted account still produced "Good evening, <name>".
- **Fix:** `getSessionUser` (`src/server/session.ts`, wrapped in React `cache()`) re-reads the user from the database once per request. It returns `null` unless the user exists and is `ACTIVE`, and role and jurisdiction always come from the database, not the token.
- **Verification:** Smoke test: the auditor reads `/api/audit` (200), is suspended by the Super Admin, and the same cookie then gets 401 from the API and a redirect to `/login` for the dashboard. The account is restored afterwards.

### SEC-02 · Foreign record numbers leaked through page `<title>` metadata
- **Severity:** HIGH
- **Page:** `/applications/[id]`, `/certificates/[id]`, `/instruments/[id]`, `/verification/[id]`
- **Root cause:** `generateMetadata` loaded the record by id without the user's scope. The page body correctly rendered not-found, but the `<title>` still contained another organisation's application or certificate number.
- **Fix:** `generateMetadata` uses the same scope helpers as the page (`applicationScope`, `certificateScope`, `instrumentScope`) and calls `notFound()` for out-of-scope ids. The verification detail page uses a fixed, generic title.
- **Verification:** Smoke test fetches another organisation's application and certificate pages as a business user. It asserts that the number is absent from the HTML and that the not-found fallback rendered.

### SEC-03 · Administrators could submit or cancel another user's draft
- **Severity:** MEDIUM
- **Page:** Application detail actions; `PATCH /api/applications/[id]`
- **Root cause:** `submit` and `cancel` were bound to the applicant roles, which include `SUPER_ADMIN` and `STATE_ADMIN`. An administrator could therefore submit or withdraw a business's draft on its behalf.
- **Fix:** Those actions are marked `ownerOnly`. `availableActions(status, role, isOwner)` filters them for non-owners, and the API route calls the same function and returns 403 `ACTION_NOT_ALLOWED`.
- **Verification:** `src/services/__tests__/workflow.test.ts` asserts that a Super Admin gets no actions on another user's `DRAFT` and a State Admin none on another user's `RETURNED`. The owner still gets `submit` and `cancel`.

### SEC-04 · No Content-Security-Policy
- **Severity:** MEDIUM
- **Page:** All
- **Root cause:** `next.config.ts` set `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, HSTS and `Permissions-Policy`, but no CSP. That left no defence-in-depth against injected script, foreign form targets or `<base>` hijacking.
- **Fix:** Added a CSP header on every response:
  ```
  default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline';
  img-src 'self' data: blob: https://*.tile.openstreetmap.org https://*.public.blob.vercel-storage.com;
  font-src 'self' data:; connect-src 'self'; worker-src 'self' blob:; manifest-src 'self';
  object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'
  ```
  `'unsafe-eval'` is added only in development, for React Refresh.
- **Verification:** On the rebuilt production server:
  - A `securitypolicyviolation` listener recorded **0 violations** across a scan of all 27 portal routes, the scheduling map (24/24 OSM tiles loaded) and the public QR page (hydrated, verify call succeeded).
  - The landing-page certificate lookup (lookup API, then client navigation, then VALID) worked.
  - Registration (state → district fetch) and credential sign-in through the login form both worked.

### SEC-05 · A result can be recorded without GPS arrival or required photos
- **Severity:** MEDIUM (evidence integrity)
- **Page:** Field verification → Result; `POST /api/verifications/[id]/result`
- **Root cause:** Both the UI and the API require serial-number confirmation and a complete checklist, and they refuse PASS while any item or test failed. Neither checks that an arrival GPS fix or the rule-required photo categories exist. An officer can therefore record a legal determination with no location or photo evidence.
- **Fix:** The project owner chose "require the evidence, but allow a written exception". A hard block would stop officers whose device denies GPS, or whose photos are still in the offline queue.
  - `src/lib/evidence.ts` defines what is required: an `ARRIVAL` GPS record plus every category in the instrument type's `requiredPhotos`, falling back to `instrument_front` if none are configured. The client and the server share this definition.
  - `POST /api/verifications/[id]/result` computes what is missing from the database, not from the request. If anything is missing and `evidenceExceptionReason` is shorter than 10 characters after trimming, it returns `400 EVIDENCE_REASON_REQUIRED` with the missing list.
  - With a valid reason, it writes an `EVIDENCE_EXCEPTION` audit entry (actor, inspection, missing items, result and reason) *before* the inspection is changed. `RESULT_RECORDED` also carries `evidenceException`.
  - Staff see "Result recorded without all required evidence", with the missing items and the reason, on the application page. Business users do not.
- **Verification:** On `LMA-2026-000038` as `lmo3`:
  - A direct API call with no reason returned 400 with `["arrival","photo:instrument_front","photo:serial_plate","photo:display","photo:seal"]`.
  - A reason of `"   short   "` was trimmed to 5 characters and also got 400. Neither call wrote anything.
  - Through the UI, with a reason, PASS was recorded. The database then held one `EVIDENCE_EXCEPTION` entry with that reason and missing list, followed by `RESULT_RECORDED` with `evidenceException`.

### SEC-06 · CSP still permits inline scripts
- **Severity:** LOW
- **Page:** All
- **Root cause:** Next.js App Router injects inline bootstrap and flight-data scripts. A strict `script-src` needs a per-request nonce, which makes every page dynamic and disables static prerendering of the public pages.
- **Fix:** Accepted for now. Exposure is low for three reasons:
  - React escapes all rendered text.
  - The only `dangerouslySetInnerHTML` renders the QR SVG, which the server generates from the platform's own verify URL.
  - Leaflet map popups HTML-escape every field. Moving to nonce-based CSP in `middleware.ts` is the upgrade path.
- **Verification:** —

### SEC-07 · Quick-access sign-in exposes the seeded password to the browser when enabled
- **Severity:** LOW
- **Page:** `/login`
- **Root cause:** The one-click role buttons need the shared seed password client-side.
- **Fix:** `quickAccessPassword()` returns `null` unless `NEXT_PUBLIC_SHOW_QUICK_ACCESS=true` **and** `VERCEL_ENV` is not `production`. `.env.example` ships it as `"false"`. Shared environments should also set `SEED_USER_PASSWORD` rather than rely on the default.
- **Verification:** Code review of `src/server/config.ts`.

### SEC-08 · Sign-out and some redirects use `AUTH_URL`'s host
- **Severity:** LOW
- **Page:** Sign-out, sign-in redirect
- **Root cause:** Auth.js builds absolute redirect URLs from `AUTH_URL`. When the app runs on a port other than `AUTH_URL`'s (as the verification build on 3001 does), sign-out lands on port 3000.
- **Fix:** Configuration only: set `AUTH_URL` and `NEXT_PUBLIC_APP_URL` to the deployed origin. QR codes and certificate links use `NEXT_PUBLIC_APP_URL`.
- **Verification:** Observed on the 3001 verification server; not present when origins match.

## Controls confirmed in place

- **Headers:**
  - `X-Frame-Options: DENY` plus CSP `frame-ancestors 'none'`: embedding the portal in an iframe is refused.
  - `X-Content-Type-Options: nosniff` and `Referrer-Policy: strict-origin-when-cross-origin`.
  - HSTS: `max-age=63072000; includeSubDomains`.
  - `Permissions-Policy: camera=(self), geolocation=(self), microphone=()`.
  - Portal pages send `Cache-Control: private, no-store`.
- **QR tokens:** these are random opaque identifiers. The public page and API show only certificate number, instrument, make/model, serial, dates, issuing authority, status and integrity-seal state, with no personal or business data.
- **Integrity seal:** certificates carry an HMAC keyed by `QR_SIGNING_SECRET`, and the public page reports whether the seal is intact.
- **AI boundary:** automated checks and suggestions are labelled advisory. Only an authorised officer's explicit action records PASS/FAIL, issues or revokes certificates, or changes rules. Audit records are append-only.
- **Secrets:** `.env.example` contains placeholders only, and nothing secret is exposed via `NEXT_PUBLIC_*`: those variables are the app URL, issuing-authority name and quick-access flag.
- **Audit trail:** state-changing actions (workflow transitions, results, stamping, issuance, user changes, rule lifecycle) call `writeAudit`.
