import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Companion cookie to the Auth.js JWT. It has no Expires/Max-Age, so the browser drops it when it
 * closes; a JWT that outlives it is treated as signed out. The value is bound to the user id so a
 * marker from one account can't revive another account's token.
 */
export const BROWSER_SESSION_COOKIE = "nm_bs";

function secret() {
  const s = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET;
  if (!s) throw new Error("AUTH_SECRET is not configured");
  return s;
}

export function browserSessionValue(userId: string) {
  return createHmac("sha256", secret()).update(`browser-session:${userId}`).digest("base64url");
}

export function isValidBrowserSession(userId: string, value: string | undefined) {
  if (!value) return false;
  const expected = Buffer.from(browserSessionValue(userId));
  const actual = Buffer.from(value);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export const browserSessionCookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
};
