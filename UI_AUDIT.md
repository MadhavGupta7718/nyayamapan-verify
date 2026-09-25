# UI Audit

Scope: every portal and public route in English and Hindi, at desktop (1920×1080), tablet (820×1180) and mobile (390×844, DPR 3), on a production build (`NEXT_DIST_DIR=.next-verify next build && next start -p 3001`).

Each issue lists severity, where it appeared, why it happened, what changed and how the fix was checked. Screenshots live in [`docs/screenshots/`](docs/screenshots/); files named `*-before-fix` show the defect.

**Current state.** A scripted pass over 27 routes at all three viewports (en + hi) reports no horizontal overflow, an `h1` on every page, no untranslated keys and no console errors. `npm run smoke` checks 289 requests across all 8 roles for banned placeholder wording, raw i18n keys and the correct allow/deny page per role. `npm run i18n:check` verifies 967 static keys and 44 dynamic prefixes against both catalogues (1400 messages each).

| ID | Severity | Issue | Status |
|----|----------|-------|--------|
| UI-01 | HIGH | Demo / prototype wording in the product | Fixed |
| UI-02 | HIGH | Mobile field-verification page rendered 857 px wide | Fixed |
| UI-03 | HIGH | Raw i18n keys shown in toasts; checker missed them | Fixed |
| UI-04 | MEDIUM | Application stepper overflowed on mobile, current step unnamed | Fixed |
| UI-05 | MEDIUM | Arrival footer buttons overflowed the card on mobile | Fixed |
| UI-06 | MEDIUM | Field step button said "Next visit" | Fixed |
| UI-07 | MEDIUM | Tests without a configured MPE showed "Pending" | Fixed |
| UI-08 | MEDIUM | Hindi pages showed English checklist items | Fixed |
| UI-09 | MEDIUM | Status descriptions read out in the wrong context | Fixed |
| UI-10 | MEDIUM | System-generated English text in the status timeline | Fixed (new entries) |
| UI-11 | LOW | Checklist radio group stretched full width on mobile | Fixed |
| UI-12 | LOW | Record IDs wrapped at hyphens on tablet (Hindi) | Fixed |
| UI-13 | LOW | Top-bar search trigger wrapped its label | Fixed |
| UI-14 | LOW | Status filter options in arbitrary order | Fixed |
| UI-15 | LOW | Issuing-authority name is not translated | Open (configuration) |

---

### UI-01 · Demo / prototype wording in the product
- **Severity:** HIGH
- **Page:** Global banner, landing, login, footer, certificate page and PDF, seed-visible labels
- **Root cause:** The initial build shipped with a demonstration banner and placeholder wording throughout the message catalogues and UI.
- **Fix:** The banner was removed and every user-facing string rewritten in both catalogues. The login page's one-click role buttons are shown only when `NEXT_PUBLIC_SHOW_QUICK_ACCESS=true`, and their label is "Sign in as any role with the seeded reference data". The issuing authority now comes from `NEXT_PUBLIC_ISSUING_AUTHORITY`, and the product never claims to be a government portal.
- **Verification:** `npm run smoke` fails on `demo|demonstration|prototype|sample data|mock|fake|lorem ipsum|dummy` in the visible text of every page, for every role and both locales, and it passes. Internal identifiers such as the DigiLocker adapter stub and `isDemo` columns are not user-visible.

### UI-02 · Mobile field-verification page rendered 857 px wide
- **Severity:** HIGH
- **Page:** `/[locale]/verification/[id]` at 390 px (see `13`–`18-mobile-field-*-before-fix.png`)
- **Root cause:** There were two causes.
  1. The badges' `sr-only` description spans are `position: absolute`. They sat inside `overflow-x-auto` wrappers that were not positioned, so their containing block was `<body>` and they widened the page instead of being clipped by the scroller.
  2. CSS grids without explicit columns create implicit `auto` tracks. Those grow to fit long content (test tables, file names) instead of shrinking to the viewport.
- **Fix:**
  - Added `relative` to every horizontal scroller: `DataTable`, the table-toolbar tabs, the tests table, the application detail documents and stepper.
  - The step layout is now `grid-cols-1 lg:grid-cols-[15rem_minmax(0,1fr)]`.
  - Added a global `.grid { grid-auto-columns: minmax(0, 1fr) }` in `globals.css`.
- **Verification:** `document.documentElement.scrollWidth` equals the viewport on all 27 routes at 390, 820 and 1920 px. The field flow was re-run end to end on mobile (`19-mobile-field-complete-after-fix.png`).

### UI-03 · Raw i18n keys shown in toasts; checker missed them
- **Severity:** HIGH
- **Page:** Field verification result toast (`field.result.passRecorded`)
- **Root cause:** Keys used inside a ternary such as `t(x === "PASS" ? "a" : "b")` weren't extracted, because the checker's regex refused quoted strings in the condition. The keys were therefore missing from both catalogues without anything failing.
- **Fix:** Added `passRecorded`, `failRecorded`, `recordedTitle` and `recordedDesc` in both languages. The ternary pattern in `scripts/check-i18n.mjs` now accepts quoted strings in the condition.
- **Verification:** `npm run i18n:check` reports "967 static keys and 44 dynamic prefixes verified". Recording a result in the browser shows the translated toast.

### UI-04 · Application stepper overflowed on mobile, current step unnamed
- **Severity:** MEDIUM
- **Page:** Application wizard and application detail, 390 px
- **Root cause:** The last step used `flex-none`, so the connectors pushed the row 9 px past the card. Step labels are hidden below `sm`, which left mobile users with numbered dots only. `aria-current` sat on a hidden element.
- **Fix:** Rewrote `Stepper`:
  - every `li` is `flex-1`;
  - `aria-current` is on the `li`;
  - a mobile-only caption shows "3/8 · Scheduled";
  - the detail page wraps the stepper in a positioned scroller with `sm:min-w-[560px]`.
- **Verification:** `20-mobile-application-wizard-after-fix.png`; no overflow on the 390 px route scan.

### UI-05 · Arrival footer buttons overflowed the card on mobile
- **Severity:** MEDIUM
- **Page:** Field verification → Arrival (`13-…before-fix.png`)
- **Root cause:** `CardFooter` was `flex` without wrapping, and three buttons don't fit in 358 px.
- **Fix:** `CardFooter` is now `flex flex-wrap items-center justify-end gap-2`, and the arrival action group is `ml-auto flex flex-wrap justify-end gap-2`.
- **Verification:** Mobile field flow re-run; buttons wrap onto a second line inside the card.

### UI-06 · Field step button said "Next visit"
- **Severity:** MEDIUM
- **Page:** Every field-verification step
- **Root cause:** `field.next` was reused from the scheduling namespace's wording.
- **Fix:** `field.next` is now "Next step" / "अगला चरण".
- **Verification:** Visible on every step in `22-desktop-field-lmo6-start.png`.

### UI-07 · Tests without a configured MPE showed "Pending"
- **Severity:** MEDIUM
- **Page:** Field verification → Tests; application detail → Inspection
- **Root cause:** When the rules engine has no permissible error for the instrument category, the test is stored as `PENDING` with `permissibleError = CONFIGURATION_REQUIRED`. The badge rendered the raw result, which contradicted the note above the table saying such tests are marked "Configuration required".
- **Fix:** Both tables render the `CONFIGURATION_REQUIRED` status in that case. No value is guessed.
- **Verification:** Adding "Accuracy at 10 kg" on `LMA-2026-000039` shows the "Configuration required" badge.

### UI-08 · Hindi pages showed English checklist items
- **Severity:** MEDIUM
- **Page:** Field verification → Checklist; application detail and verification detail (hi)
- **Root cause:** Checklist rows store the English label from the rule version. The pages rendered `itemLabel` directly.
- **Fix:** Added `field.checklistItems.<itemKey>` translations for the seeded items. Pages select `itemKey` and use the translation when the locale isn't English and a key exists. Otherwise they fall back to the stored label, so rule-authored items still display.
- **Verification:** `/hi/applications/f7469404-…` lists "डिस्प्ले / संकेतक पठनीय", "पहचान और अनिवार्य चिह्न" and the other seeded items in Hindi.

### UI-09 · Status descriptions read out in the wrong context
- **Severity:** MEDIUM
- **Page:** Application detail (documents, checklist, tests), users list
- **Root cause:** `StatusBadge` looks descriptions up by status key alone. Those descriptions are written for applications and certificates, so screen readers and tooltips got the wrong meaning elsewhere:
  - a verified purchase invoice read "Holds a valid verification certificate";
  - each checklist item read "The instrument passed verification";
  - an active user read "In force".
  - `withTooltip={false}` removed the tooltip but still rendered the `sr-only` text.
- **Fix:** `withTooltip={false}` now suppresses the description entirely. Document, checklist-item, test-row and user badges pass it. Application and certificate badges keep their descriptions.
- **Verification:** On the Hindi application page, the certificate wording ("वैध सत्यापन प्रमाणपत्र है") appears 0 times. "The instrument passed" appears once, on the overall inspection result, where it is correct.

### UI-10 · System-generated English text in the status timeline
- **Severity:** MEDIUM
- **Page:** Application detail → Timeline (hi)
- **Root cause:** The stamping and scheduling APIs wrote English sentences ("Stamp …", "Assigned to …") into `remarks`. These are then shown verbatim in either language.
- **Fix:** Remarks now store language-neutral values: the stamp identifier and the officer's name. Stamp types are stored as codes (`LEAD_WIRE_SEAL` etc.) and translated at render time.
- **Verification:** The Hindi timeline for `LMA-2026-000039` shows "मुद्रांकन … WB-KOL-SEAL-0912". Status history is immutable, so one entry written before the fix still reads "Stamp DL-NW-SEAL-0457" and was deliberately left as recorded.

### UI-11 · Checklist radio group stretched full width on mobile
- **Severity:** LOW
- **Page:** Field verification → Checklist, 390 px (`15-…before-fix.png`)
- **Root cause:** In the column layout the `inline-flex` group was stretched by `align-items: stretch`, which left an empty ring after the N/A button.
- **Fix:** Added `self-start sm:self-auto`.
- **Verification:** Mobile checklist re-checked; the segmented control hugs its buttons.

### UI-12 · Record IDs wrapped at hyphens on tablet (Hindi)
- **Severity:** LOW
- **Page:** Applications, certificates and instruments lists at 820 px (`09-tablet-applications-hi-before-fix.png`)
- **Root cause:** Hindi column headers are wider, which squeezes the ID column. The browser then breaks `LMA-2026-000037` at hyphens.
- **Fix:** Added `whitespace-nowrap` on ID cells; the table scrolls horizontally inside its positioned wrapper instead.
- **Verification:** Tablet route scan (hi) shows single-line IDs and no page overflow.

### UI-13 · Top-bar search trigger wrapped its label
- **Severity:** LOW
- **Page:** All portal pages, tablet (hi)
- **Root cause:** Nothing in the trigger could shrink, so "खोजें या किसी पृष्ठ पर जाएँ…" wrapped and pushed the kbd hint.
- **Fix:** The icon and kbd are `shrink-0`, and the label is `min-w-0 flex-1 truncate`.
- **Verification:** `08-tablet-reports-hi.png`.

### UI-14 · Status filter options in arbitrary order
- **Severity:** LOW
- **Page:** Applications list → Status filter
- **Root cause:** Options were built from the `groupBy` result order returned by the database.
- **Fix:** Options follow the `ApplicationStatus` enum order (the workflow order), filtered to statuses present in scope.
- **Verification:** For `lmo6` the filter reads Stamping, Active, Expired.

### UI-15 · Issuing-authority name is not translated
- **Severity:** LOW
- **Page:** Public certificate page, certificate detail, footer (hi)
- **Root cause:** The name comes from `NEXT_PUBLIC_ISSUING_AUTHORITY`, which is a single string.
- **Fix:** Not changed. The name is legal text chosen by the adopting authority, so it isn't machine-translated. If the authority provides an official Hindi name, a second variable (`NEXT_PUBLIC_ISSUING_AUTHORITY_HI`) is the intended extension.
- **Verification:** —

## Design system notes

- **Tokens.** Colour (brand, ink, success, warning, danger, surface, line), type scale (`text-caption` … `text-display`), radius and shadow live in `tailwind.config.ts` and `globals.css`. Pages use tokens, not raw hex.
- **Statuses.** They go through `StatusBadge` (`src/lib/status.ts`), so each status has one icon, one tone and one label. Colour is never the only signal; every badge carries an icon and a text label.
- **Loading states.** A portal-level `loading.tsx` covers all list pages, and the dashboard, detail and form routes have their own skeletons. All of them carry `aria-busy`, so navigation paints immediately.
- **Empty and error states.** These use `EmptyState` and the shared error boundary. No page renders a blank area.
