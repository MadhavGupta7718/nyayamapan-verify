# Functionality Audit

Scope: the end-to-end journeys each role depends on, exercised in a real browser against the production build on `http://localhost:3001`, plus the automated checks.

| Check | Result |
|-------|--------|
| `npm run typecheck` | clean |
| `npm test` | 45 / 45 passing |
| `npm run i18n:check` | 974 static keys + 45 dynamic prefixes, en/hi in sync (1409 each) |
| `npm run smoke` | 289 requests, 8 roles, both locales — pass |
| Browser route scan (27 routes × desktop/tablet/mobile, en + hi) | no console errors, no HTTP ≥ 400, no overflow |

## Journeys verified in the browser

| Journey | Role | Evidence |
|---------|------|----------|
| Sign in through the login form, redirect to the requested page | LMO (`lmo6`) | Landed on `/en/verification/f7469404-…` |
| Field verification: arrival → identity → photos → checklist → tests → result → stamping → certificate | LMO | Mobile run on `LMA-2026-000037`, `12`–`19-mobile-field-*.png`. Desktop run on `LMA-2026-000039` up to "Issue certificate". |
| GPS arrival with geofence distance warning | LMO | `13-mobile-field-arrival-geofence-before-fix.png` |
| Photo capture and upload per required category | LMO | `14-mobile-field-photos-before-fix.png`; uploads returned 200 |
| Checklist autosave | LMO | Five rapid answers were all persisted server-side; Hindi detail page lists all five as passed |
| Certificate issue, then public QR page | LMO → public | `18`, `19`, `21-mobile-public-qr-hi.png`: VALID, valid until 24 Sept 2028 |
| Public lookup by certificate number from the landing page | public | `LMVC-DL-2026-VBCE8M` → `/en/verify/<token>` → VALID |
| Public "check another certificate" | public | `/verify` form → `/verify/[token]` works |
| Business registration: state → district cascade | public | Selecting Gujarat loads Ahmedabad |
| Command palette (Ctrl/⌘+K): open, focus, Hindi results, Enter navigates | Super Admin | `06-desktop-command-palette-hi.png` |
| Server-side table search, filters, pagination | LMO, Super Admin | `?q=Hooghly` applied; status filter lists workflow order |
| Scheduling map | Super Admin | 10 pins, 24/24 tiles |
| Role-filtered navigation | all 8 roles | Smoke matrix: each module renders or shows "no access" exactly per role |

## Issues

| ID | Severity | Issue | Status |
|----|----------|-------|--------|
| FN-01 | HIGH | Visit schedule never marked completed | Fixed |
| FN-02 | HIGH | Certificate list → detail click did nothing after the first time | Fixed |
| FN-03 | MEDIUM | Field flow stayed on the Result/Stamping step after saving | Fixed |
| FN-04 | MEDIUM | Table search re-applied stale queries during navigation | Fixed |
| FN-05 | MEDIUM | Tests without a configured MPE looked unfinished | Fixed |
| FN-06 | MEDIUM | Result accepted without GPS or photo evidence | Fixed |
| FN-07 | LOW | i18n checker silently skipped some keys | Fixed |
| FN-08 | LOW | Stale init migration (certificate default `DEMO`) | Fixed |
| FN-09 | HIGH | Checklist showed "0 of 0" right after starting a verification | Fixed |
| FN-10 | MEDIUM | An application could be approved with a required document missing or rejected | Fixed |

### FN-01 · Visit schedule never marked completed
- **Severity:** HIGH
- **Page:** Application detail → Verification visit; scheduling "Next 14 days"; reports
- **Root cause:** Recording a result closed the inspection and advanced the application, but never updated `VerificationSchedule`. Completed visits therefore stayed "Scheduled" forever. They kept occupying the officer's calendar (conflict detection) and were missing from completed-visit counts.
- **Fix:** `POST /api/verifications/[id]/result` now marks the application's open `SCHEDULED`/`RESCHEDULED` schedules as `COMPLETED`. The one record completed before the fix (`LMA-2026-000037`) was repaired with a single targeted `updateMany`.
- **Verification:** After recording PASS on `LMA-2026-000039`, the Hindi detail page shows "दौरे की स्थिति: पूर्ण — दौरा पूरा हो गया है" (visit status: completed).

### FN-02 · Certificate list → detail click did nothing after the first time
- **Severity:** HIGH
- **Page:** `/certificates` → `/certificates/[id]`
- **Root cause:** The soft navigation was dropped by the router even though the RSC request succeeded. Only this segment lacked a loading boundary. See PERF-02 in [PERFORMANCE_AUDIT.md](PERFORMANCE_AUDIT.md).
- **Fix:** Added `certificates/[id]/loading.tsx`, and `verification/[id]/loading.tsx` as the same guard.
- **Verification:** 6/6 repeated navigations committed, compared with 1/6 before.

### FN-03 · Field flow stayed on the Result/Stamping step after saving
- **Severity:** MEDIUM
- **Page:** Field verification
- **Root cause:** The active step was initial `useState` derived from the server stage. After `router.refresh()` delivered the new stage, the component kept showing the step just completed, with its button still enabled, and the officer had to find the next step manually.
- **Fix:** An effect moves to Stamping when the stage becomes `stamping`, and to Certificate when it becomes `certificate` or `done`.
- **Verification:** On `LMA-2026-000039`, recording PASS moved straight to "7. Stamping". Recording stamp `WB-KOL-SEAL-0912` moved straight to "8. Certificate / Issue certificate".

### FN-04 · Table search re-applied stale queries during navigation
- **Severity:** MEDIUM
- **Page:** All server-side tables
- **Root cause and fix:** See PERF-03.
- **Verification:** Typing and then leaving mid-debounce keeps the user on the destination page.

### FN-05 · Tests without a configured MPE looked unfinished
- **Severity:** MEDIUM
- **Page:** Field verification → Tests; application detail → Inspection
- **Root cause and fix:** See UI-07. The platform never invents a permissible error: the test stays undecided and is shown as "Configuration required", and the officer's determination remains the legal result.
- **Verification:** "Accuracy at 10 kg" (10 → 10.002 kg) shows error 0.002 and the "Configuration required" badge.

### FN-06 · Result accepted without GPS or photo evidence
- **Severity:** MEDIUM
- **Page:** Field verification → Result
- **Root cause:** See SEC-05 in [SECURITY_AUDIT.md](SECURITY_AUDIT.md). The result gate checks serial confirmation, checklist completeness and failed items, but not arrival GPS or required photo categories.
- **Fix:** Evidence is required, with a recorded exception (the policy chosen by the project owner). See SEC-05 for details. The Result step lists what is missing, and "Record result" stays disabled until the officer gives a reason of at least 10 characters. Staff see the exception and reason on the application page; the applicant does not.
- **Verification:** On `LMA-2026-000038`, with no arrival GPS and none of the 4 required photos, the Result step listed all 5 items and blocked recording. `23-desktop-field-evidence-exception.png` shows it after a reason was entered. With a reason, PASS was recorded and the flow moved to Stamping. The application page showed the alert in English and Hindi to the officer, and not to the applicant (`business6`).

### FN-09 · Checklist showed "0 of 0" right after starting a verification
- **Severity:** HIGH
- **Page:** Field verification
- **Root cause:** `FieldVerification` seeds its checklist, tests, photos, arrival and serial state from props with `useState`, which reads the initial value only once. Before the start, there is no inspection, so the state was empty. After "Start verification", `router.refresh()` delivered the new inspection with its checklist, but the state stayed empty. The officer saw "0 of 0 answered" with nothing to fill in until they reloaded the page.
- **Fix:** The page renders `<FieldVerification key={inspection id}>`, so a new inspection remounts the component with fresh state from the server.
- **Verification:** Before the fix, on `LMA-2026-000038`, the database held 5 pending items while the screen showed "0 of 0". After the fix, on `LMA-2026-000035`, the checklist showed "0 of 5 answered" immediately after starting, with no reload.

### FN-10 · An application could be approved with a required document missing or rejected
- **Severity:** MEDIUM
- **Page:** Application detail → Approve; `PATCH /api/applications/[id]`
- **Root cause:** Required documents were checked only at `submit`. A reviewer can reject a required document during review, and the application could still be approved. The seed made this visible: every seeded application past draft had only 2 of the 3 required documents (no `model_approval`).
- **Fix:** `approve` runs the same `missingRequiredDocuments` check and returns `APPROVAL_DOCUMENTS_MISSING`, with the message "A required document is missing or was rejected. Return the application to the applicant instead of approving it." (in English and Hindi). The seed now creates all three required documents.
- **Verification:** As the State Admin, approving `LMA-2026-000025` (model approval certificate missing) showed that message, and the application stayed "Under review". The existing seeded data keeps its 2-document sets until the database is re-seeded.

### FN-07 · i18n checker silently skipped some keys
- **Severity:** LOW
- **Page:** Tooling (`scripts/check-i18n.mjs`)
- **Root cause and fix:** See UI-03.
- **Verification:** The checker now finds the result-toast keys, and the catalogues contain them.

### FN-08 · Stale init migration (certificate default `DEMO`)
- **Severity:** LOW
- **Page:** Deployment (`prisma/migrations/20250924000000_init/migration.sql`)
- **Root cause:** The schema moved on (for example `Certificate.status` now defaults to `ACTIVE`, and the `DEMO` enum values were removed), but local setup used `db push`, so the committed migration was never regenerated. A fresh production database built with `prisma migrate deploy` would have had the old schema.
- **Fix:** The migration was regenerated from `schema.prisma` with `prisma migrate diff --from-empty --to-schema-datamodel`. No database was touched.
- **Verification:** The migration contains no `DEMO` enum value or default. The only case-insensitive "demo" matches are the internal `isDemo` columns that are also in the schema.

## Not covered

- **Offline queue under a real network drop.** The IndexedDB queue and sync path (`enqueue`, then replay on reconnect) has been reviewed in code only. Neither a browser offline test nor a unit test covers it yet; it is the next gap to close.
- **Email, SMS and payment delivery.** These are not configured locally and messages are logged instead.
- **Cron expiry run against a real clock.** The endpoint is checked for authorisation (401 without `CRON_SECRET`).
