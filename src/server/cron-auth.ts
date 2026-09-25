import { timingSafeEqual } from "crypto";

/** Cron endpoints fail closed: without a configured CRON_SECRET they refuse every call in production. */
export function isAuthorizedCron(headers: Headers) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return process.env.NODE_ENV !== "production";
  const given = headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  const a = Buffer.from(given);
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}
