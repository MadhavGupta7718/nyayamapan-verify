# API Documentation

Base: `/api/*` (JSON). All authenticated routes require session cookie unless marked Public.

## Auth

| Method | Path | Notes |
|--------|------|-------|
| POST | `/api/auth/[...nextauth]` | Auth.js |
| GET | `/api/health` | Public health |

## Applications

| Method | Path | RBAC |
|--------|------|------|
| GET | `/api/applications` | Role-scoped list |
| POST | `/api/applications` | BUSINESS_USER |
| GET | `/api/applications/:id` | Owner / assigned / admin |
| PATCH | `/api/applications/:id/status` | Authorized transition |

## Verifications

| Method | Path | RBAC |
|--------|------|------|
| POST | `/api/verifications/:id/start` | LMO / GATC / INSPECTOR |
| POST | `/api/verifications/:id/tests` | Assigned officer |
| POST | `/api/verifications/:id/result` | Assigned officer |
| POST | `/api/verifications/:id/gps` | Assigned officer |
| POST | `/api/verifications/:id/photos` | Assigned officer |

## Certificates

| Method | Path | RBAC |
|--------|------|------|
| POST | `/api/certificates/generate` | Authorized after PASS |
| GET | `/api/certificates/:id` | Scoped |
| POST | `/api/certificates/:id/revoke` | Admin / authorized |
| GET | `/api/public/certificates/:token` | Public |

## Rules

| Method | Path | RBAC |
|--------|------|------|
| GET | `/api/rules/applicable` | Authenticated |
| GET/POST | `/api/rules` | SUPER_ADMIN lifecycle |

## Instruments / Scheduling / GATC / Reports / Search / Notifications

See route handlers under `src/app/api/**`. All enforce RBAC helpers in `src/server/rbac.ts`.
