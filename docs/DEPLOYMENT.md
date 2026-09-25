# Deployment

## Prototype (Vercel)

1. Create Neon project → copy `DATABASE_URL`.
2. Create Vercel project from this repo.
3. Set env vars from `.env.example` (`AUTH_SECRET`, `DATABASE_URL`, `BLOB_READ_WRITE_TOKEN`, `QR_SIGNING_SECRET`, optional `AI_API_KEY`, `EMAIL_API_KEY`).
4. Run `npx prisma migrate deploy` and `npx prisma db seed` (or use Vercel build hook).
5. Configure Vercel Cron for `/api/cron/expiry` and `/api/cron/notifications`.

## Local

```bash
npm install
cp .env.example .env
# set DATABASE_URL (Neon or local Postgres)
npx prisma migrate dev
npx prisma db seed
npm run dev
```

Open `http://localhost:3000/en` or `/hi`.

## Production hardening (government infra later)

- Replace MockCertificateSigner with DSC HSM integration.
- Replace mock payment/SMS with approved gateways.
- Move Blob to approved object storage.
- Harden CSP, WAF, SOC2/ISO controls as required.
- Do not claim official GoI portal status without competent authority authorisation.
