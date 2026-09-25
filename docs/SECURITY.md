# Security Framework

## Authentication

- Auth.js (Credentials) with hashed passwords (bcrypt).
- HTTP-only secure session cookies.
- `AUTH_SECRET` from environment only.

## Authorization (RBAC)

Roles: SUPER_ADMIN, STATE_ADMIN, LMO, GATC_ADMIN, GATC_OFFICER, BUSINESS_USER, INSPECTOR, PUBLIC, AUDITOR.

Every sensitive API performs server-side checks (ownership, assignment, state jurisdiction, GATC eligibility). Frontend role checks are UX only.

## Data protection

- Private files via signed URLs (never public permanent links).
- QR tokens are opaque; no PII in QR payload.
- Public verify exposes minimal certificate fields only.
- Secrets never in Git; use `.env.example` placeholders.
- Audit logs immutable for normal users.

## Application security

- Zod input validation on all mutations.
- Upload: MIME allow-list (PDF/JPG/PNG/WEBP), size limits, malware scanner interface (mock in prototype).
- Rate limiting on auth and public verify endpoints.
- Security headers / CSP via Next.js middleware.
- SQL injection mitigated by Prisma parameterized queries.
- XSS mitigated by React escaping + CSP.

## Legal decision safety

AI cannot issue/revoke certificates, activate rules, or decide PASS/FAIL. Officer + rule engine only.
