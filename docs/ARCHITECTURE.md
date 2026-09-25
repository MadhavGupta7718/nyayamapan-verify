# Architecture

## Overview

Modular monolith: **Next.js App Router** (TypeScript) serving UI + API routes, **Neon PostgreSQL** via Prisma, **Vercel Blob** for documents/photos/PDFs, **Auth.js** for sessions, **next-intl** for Hindi/English.

```text
LAW → versioned legal_rules → LegalRuleEngine → workflow → authorized human → audit → certificate → public QR
```

## Layers

| Layer | Responsibility |
|-------|----------------|
| `src/app` | Routes (`/[locale]/…`), API handlers |
| `src/components` | Design system |
| `src/features` | Domain UI (applications, verification, certificates, …) |
| `src/services` | LegalRuleEngine, CertificateSigner, PaymentProvider, AI, storage, notifications |
| `src/server` | Auth, RBAC, audit |
| `src/db` | Prisma schema, seed |

## Key services

- **LegalRuleEngine** — applicable rules, checklists, validity, measurement validation, GATC eligibility (never invents values).
- **CertificateSigner** — `MockCertificateSigner` (demo) / `ProductionDSCSigner` (interface).
- **PaymentProvider** — mock unless fee rule configured.
- **StorageService** — Vercel Blob + signed URLs.
- **AiAssistService** — advisory only; hard blocks on legal decisions.
- **ExpiryJob** — Vercel cron; validity from pinned rule versions.

## Deployment topology

Vercel (app + cron) → Neon (DB) → Vercel Blob (objects). Portable to government infrastructure later.

## Offline field mode

PWA + IndexedDB queue; sync with explicit conflict resolution (no silent overwrite).
