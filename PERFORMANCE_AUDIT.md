# Performance Audit

All "after" measurements were taken on a production build served locally:

```powershell
$env:NEXT_DIST_DIR=".next-verify"; npx next build; npx next start -p 3001
```

The database was the seeded local PostgreSQL (Docker, port 5433) and the browser was Chromium with the cache warm after the first visit. Local numbers exclude real network latency and a cold Neon connection, so treat them as relative, not as production SLOs.

## Headline numbers

| Measure | Result |
|---------|--------|
| Server response, 289 page and API requests across 8 roles × 2 locales (`npm run smoke`) | median **103–108 ms**; slowest public landing/register 556–767 ms (first render of static pages after start) |
| Soft navigation: click to URL change | **17–52 ms** |
| Soft navigation: click to content ready (`h1` present, no `aria-busy`) across 27 routes | **~320–485 ms**, most routes 410–440 ms |
| Duplicate requests per navigation | **none** found on any route |
| Console errors during all scans | **0** |
| Shared first-load JS | **103 kB** |

At the start of the overhaul, the audit notes recorded warm navigations of roughly 560–1415 ms and cold first navigations of about 4 s, with the page frozen on the old content until the server render finished. Those notes don't record the build mode, so the table above is the authoritative measurement.

## Network waterfall per navigation (mobile 390×844, signed in as Super Admin)

| Route | Requests | Navigation RSC payload / time | Duplicates |
|-------|---------:|-------------------------------|-----------|
| Dashboard | 12 | 46 KB / 360 ms | none |
| Applications | 15 | 20 KB / 239 ms | none |
| Application detail | 6 | 19 KB / 283 ms | none |
| Certificates | 10 | 18 KB / 146 ms | none |
| Certificate detail | 2 | 7 KB / 151 ms | none |
| Scheduling | 8 | 7 KB / 128 ms | none |
| Reports | 1 | 11 KB / 119 ms | none |
| Rules | 4 | 14 KB / 141 ms | none |
| Audit log | 3 | 39 KB / 148 ms | none |
| Register (public) | 3 | 23 KB / 20 ms (prerendered; now rendered per request, see PERF-07) | none |
| Verify (public) | 1 | 23 KB / 22 ms (prerendered) | none |

Requests beyond the navigation RSC are first-visit JS chunks, CSS and one font file, plus viewport prefetches for links. The scheduling map loads 24 OpenStreetMap tiles on demand, and only when the Map tab is opened; Leaflet is dynamically imported and never enters the server bundle.

## Issues

### PERF-01 · Navigation felt frozen; no immediate feedback
- **Severity:** HIGH
- **Page:** All portal routes
- **Root cause:** Most routes had no `loading.tsx` boundary. With dynamic server rendering, the App Router keeps the old page on screen until the new server payload arrives, so a click produced no visible change for several hundred milliseconds or more.
- **Fix:** Every route now paints a skeleton immediately, and each skeleton carries `aria-busy`.
  - A portal-level `loading.tsx` covers all list pages.
  - The dashboard, the detail pages (applications, instruments, certificates, verification) and the "new" forms each have their own skeleton matching the final layout: `DashboardSkeleton`, `DetailSkeleton` and `FormSkeleton`. Session lookup is wrapped in React `cache()`, so layouts and pages share a single user read per request.
- **Verification:** The URL and skeleton change within 17–52 ms of a click, and content is ready in about 410–440 ms on 27 routes. See the table above.

### PERF-02 · Certificate list → detail navigation never committed
- **Severity:** HIGH
- **Page:** `/[locale]/certificates` → `/[locale]/certificates/[id]`
- **Root cause:** Clicking a certificate row from the list worked the first time, then silently stayed on the list. The detail RSC request returned 200 and other routes navigated normally. The exact point inside Next.js' router where the transition was dropped wasn't isolated, but it only happened for this segment, which had no loading boundary of its own.
- **Fix:** Added `certificates/[id]/loading.tsx`, and `verification/[id]/loading.tsx` as the same guard.
- **Verification:** After the fix 6 of 6 repeated list → detail navigations committed; before it, only the first did. The full route scan also covers the certificate detail in both locales.

### PERF-03 · Table search could re-apply a stale query and fight navigation
- **Severity:** MEDIUM
- **Page:** All server-side tables (applications, instruments, certificates, users, audit, rules, scheduling queue)
- **Root cause:** The toolbar's debounce effect depended on the `update` callback, whose identity changes on every URL change. Any navigation therefore re-armed the timer, which could `router.replace` the old `?q=` back onto the URL after the user had moved on or pressed Back.
- **Fix:** The debounce only runs after the user actually types (`typed` ref). The latest `update` is read through a ref. Local input state re-syncs from the URL when it changes externally.
- **Verification:** In the browser, typing "Hooghly" updates the URL to `?q=Hooghly`. Typing again and clicking Certificates within 50 ms leaves the user on `/en/certificates`, with no bounce back.

### PERF-04 · Sort headers were prefetched on every list view
- **Severity:** LOW
- **Page:** All `DataTable` lists
- **Root cause:** Sortable column headers are `<Link>`s. Next.js prefetches visible links, so each list issued a background request per sortable column (`?sort=…`) that users rarely need.
- **Fix:** Sort header links use `prefetch={false}`. Pagination links keep prefetch because "next page" is a likely action.
- **Verification:** The rebuild passes the full smoke test and route scan; sorting still works and the URL updates on click.

### PERF-05 · Dashboard carries the largest payload
- **Severity:** LOW (monitor)
- **Page:** `/[locale]/dashboard` (Super Admin)
- **Root cause:** The command-centre dashboard aggregates KPIs, queues, charts and a map in one render, giving 46 KB of RSC in 360 ms locally.
- **Fix:** Not changed; it is within budget. If it grows, the next step is to stream the lower sections behind their own `<Suspense>` boundaries.
- **Verification:** Measured in the waterfall table.

### PERF-06 · Benign "transformAlgorithm is not a function" in the server log
- **Severity:** LOW
- **Page:** Server log, once, during rapid navigation
- **Root cause:** A known Node.js/Next.js stream error raised when the browser aborts an in-flight RSC stream, for example when a user clicks away mid-load. No request failed and nothing reached the client.
- **Fix:** None needed in application code.
- **Verification:** No console or HTTP errors in any browser scan.

### PERF-07 · Production build failed when the database was unreachable
- **Severity:** MEDIUM
- **Page:** `/[locale]/register` (build time)
- **Root cause:** The register page reads the state and district list with Prisma, but it had no dynamic API use, so Next.js prerendered it during `next build`. The build therefore needed a live database, and failed with `PrismaClientInitializationError` when Postgres was down. When the build did succeed, the page served the state list as it was at build time, so states or districts added later didn't appear.
- **Fix:** `export const dynamic = "force-dynamic"` on the register page. It is the only public page that queries the database.
- **Verification:** The failure was seen when Docker Desktop was not running. After the fix, the build (run with the database up) completes and the page is no longer prerendered, and the smoke test passes. A build with the database down has not been re-run.

## How to reproduce

```powershell
npm run typecheck; npm test; npm run i18n:check
$env:NEXT_DIST_DIR=".next-verify"; npx next build
$env:NEXT_DIST_DIR=".next-verify"; npx next start -p 3001   # in a second terminal
npm run smoke                                                 # defaults to http://localhost:3001
```
