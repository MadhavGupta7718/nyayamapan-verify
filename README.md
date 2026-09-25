# NyayaMapan Verify — Legal Metrology Online Verification Platform

**Problem Statement ID:** 26036

A bilingual (Hindi + English) platform for online verification, digital certification and lifecycle management of weighing and measuring instruments under India's Legal Metrology framework.

It is independent software, not an official Government of India portal. The issuing authority shown on certificates is whatever the deploying authority configures in `NEXT_PUBLIC_ISSUING_AUTHORITY`.

## Architecture

The platform is a modular monolith: Next.js 15 App Router, Auth.js v5, Prisma 6 and PostgreSQL (Neon in production). File storage uses Vercel Blob, with a local-disk fallback. A versioned **LegalRuleEngine** holds all legal values.

See:
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
- [LEGAL_COMPLIANCE_MATRIX.md](LEGAL_COMPLIANCE_MATRIX.md)
- [docs/SECURITY.md](docs/SECURITY.md)
- [docs/API.md](docs/API.md)
- [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)

Audit reports:
- [UI_AUDIT.md](UI_AUDIT.md)
- [PERFORMANCE_AUDIT.md](PERFORMANCE_AUDIT.md)
- [SECURITY_AUDIT.md](SECURITY_AUDIT.md)
- [FUNCTIONALITY_AUDIT.md](FUNCTIONALITY_AUDIT.md)

## Run locally

Requirements: Node.js 20+ and Docker (for PostgreSQL).

```powershell
npm install
Copy-Item .env.example .env      # then set AUTH_SECRET, QR_SIGNING_SECRET, CRON_SECRET

docker compose up -d             # PostgreSQL on host port 5433
npx prisma db push               # create the schema
npm run db:seed                  # reference data + evaluation accounts
npm run dev                      # http://localhost:3000/en or /hi
```

`DATABASE_URL` for the bundled Docker database is `postgresql://postgres:postgres@127.0.0.1:5433/legal_metrology?schema=public`.

## Seeded accounts

All seeded accounts share the password in `SEED_USER_PASSWORD`, which defaults to `Verify@2026`. Set your own value before seeding any shared environment.

| Email | Role |
|-------|------|
| admin@nyayamapan.local | Super Admin |
| state@nyayamapan.local | State Admin (Delhi) |
| state.mh@nyayamapan.local | State Admin (Maharashtra) |
| lmo@nyayamapan.local … lmo7@nyayamapan.local | Legal Metrology Officers (DL, DL, MH, KA, GJ, WB, UP) |
| inspector@nyayamapan.local | Inspector |
| gatc.admin@nyayamapan.local | GATC Admin |
| gatc@nyayamapan.local | GATC Officer |
| business@nyayamapan.local (and business2…) | Business users |
| auditor@nyayamapan.local | Auditor |

Set `NEXT_PUBLIC_SHOW_QUICK_ACCESS="true"` to get one-click role sign-in buttons on the login page. This only works locally: it is ignored when `VERCEL_ENV=production`.

## Environment variables

See [.env.example](.env.example). All values there are placeholders.

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | PostgreSQL connection |
| `AUTH_SECRET`, `AUTH_URL` | Auth.js signing secret and the origin used for auth redirects |
| `NEXT_PUBLIC_APP_URL` | Origin used in QR codes and certificate links |
| `QR_SIGNING_SECRET` | HMAC key for the certificate integrity seal (required in production) |
| `CRON_SECRET` | Protects the expiry/alert cron endpoints (required in production) |
| `BLOB_READ_WRITE_TOKEN` | Vercel Blob; unset means files go to `.local-storage/` |
| `NEXT_PUBLIC_ISSUING_AUTHORITY` | Name printed as the issuing authority |
| `NEXT_PUBLIC_SHOW_QUICK_ACCESS` | Local one-click sign-in (default `false`) |
| `SEED_USER_PASSWORD` | Password given to seeded accounts |
| `EMAIL_API_KEY`, `SMS_API_KEY`, `AI_API_KEY` | Optional providers; messages are logged and AI stays off when unset |

`AUTH_URL` and `NEXT_PUBLIC_APP_URL` must match the origin you actually browse. If the app runs on another port, sign-out and QR links will point at the configured origin instead.

## Quality checks

```powershell
npm run typecheck        # TypeScript
npm test                 # unit tests (Vitest)
npm run i18n:check       # every key used in code exists in en.json and hi.json
npm run smoke            # all roles × all pages × both locales + API authorisation boundaries
```

`npm run smoke` needs a running server; it defaults to `http://localhost:3001`, or pass a URL. It fails on:
- wrong HTTP status;
- RBAC mismatches;
- untranslated keys;
- placeholder wording;
- record leaks across organisations;
- personal data in the public certificate API;
- a suspended user keeping their session.

To test a production build without disturbing a running `npm run dev`, build into a separate directory:

```powershell
$env:NEXT_DIST_DIR=".next-verify"; npx next build
$env:NEXT_DIST_DIR=".next-verify"; npx next start -p 3001
npm run smoke
```

## Roles and workflow

User hierarchy, enforced on the server:
- **Super Admin** creates and edits State Admins, GATC Admins, Auditors and Inspectors. They manage states and districts (**Geography**) and can see every user, with state and district filters. They do not review, assign or verify.
- **State Admin** creates LMOs for their state. They review applications and documents, and can reassign field work in their state.
- **GATC Admin** creates GATC Officers for their centre and assigns GATC-route applications to them.
- Only the officer assigned to an application (LMO, Inspector or GATC Officer) can carry out its field verification.

Assignment:
- When a State Admin approves an application, it is assigned automatically to the active LMO whose jurisdiction covers the instrument's district and who has the fewest open tasks. The visit goes on the applicant's preferred date, or the next working day (`OFFICER_AUTO_ASSIGNED`).
- If no LMO covers the district, the State Admins are notified and schedule it from **Scheduling**.
- If the applicant chose a Government Approved Test Centre when applying, the GATC Admins for that state are notified instead, and they assign one of the centre's officers.
- A State Admin (LMO route) or GATC Admin (GATC route) can reassign a scheduled or assigned visit, giving a reason (`OFFICER_REASSIGNED`). Both officers are notified.

Field verification:
- The officer must record an arrival GPS fix within 1 km of the instrument's registered location before any later step unlocks. The server enforces this on every step.
- If the site cannot be found, "Location not found" (with a photo and reason) returns the application to the applicant and notifies the State Admins. The applicant can then correct the instrument location and resubmit.

Sessions end on sign-out or when the browser is closed.

Additional audit events include `USER_UPDATED`, `STATE_*`, `DISTRICT_*`, `OFFICER_AUTO_ASSIGNED`, `OFFICER_REASSIGNED`, `VERIFICATION_DISMISSED` and `INSTRUMENT_LOCATION_UPDATED`.

## Legal rule configuration

- Super Admin → **Legal rules**. The lifecycle is draft → approve → activate → retire. History is never overwritten.
- Seeded: Rule 27(2)(a) 24-month validity (Legal Metrology (General) Seventh Amendment Rules, 2025) for the listed categories.
- Values the platform has no authoritative source for (many MPEs, fees and stamp formats) are shown as **Configuration required**. They are never guessed.

## Certificates and QR verification

- Certificates are PDFs generated with `pdf-lib`, carrying an HMAC integrity seal.
- Signing goes through a `CertificateSigner` interface; a DSC/HSM signer is the production swap-in.
- QR codes carry an opaque random token only. The public page shows VALID / EXPIRED / REVOKED / SUSPENDED / INVALID and non-personal certificate details.

## Deployment (Vercel + Neon)

1. Create a Neon database and a Vercel project.
2. Set the environment variables above, with real secrets.
3. Run `npx prisma migrate deploy`, then seed reference data. `npm run db:geo` adds any missing states, union territories and districts from `prisma/data/india-geography.ts` without deleting anything, so it is safe to re-run on a live database.
4. The cron routes are defined in `vercel.json`.

## Before production use

- Replace the certificate signer with a DSC/HSM-backed implementation. Also connect real payment, SMS, email and malware-scanning adapters, and DigiLocker if it is in scope.
- Host on infrastructure approved by the adopting authority.
- Configure the authoritative MPE, fee and stamp values in the rules engine.
- Review `VERIFICATION_DISMISSED` audit entries ("Location not found", each with a photo and the officer's reason) and the `INSTRUMENT_LOCATION_UPDATED` corrections that follow them (see SEC-05 in [SECURITY_AUDIT.md](SECURITY_AUDIT.md)).
- Instruments registered before coordinates became mandatory cannot be field-verified until the applicant adds their location.
- Re-seed (or backfill) existing databases. Seeds created before the FN-10 fix lack the model approval document, so those applications can't be approved until it is uploaded.

## Screenshots

[`docs/screenshots/`](docs/screenshots/) has desktop, tablet and mobile captures of the main journeys, in English and Hindi. Files named `*-before-fix` document defects listed in the audits.

## Principle

**The software adapts to the law; it does not invent the law.**
