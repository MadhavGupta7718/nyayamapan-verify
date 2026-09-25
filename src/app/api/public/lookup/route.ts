import { NextRequest, NextResponse } from "next/server";
import { tokenForCertificateNumber } from "@/services/public-verification";
import { clientIp, rateLimit } from "@/server/rate-limit";

/** Resolves a printed certificate number to its public verification link (rate limited). */
export async function GET(req: NextRequest) {
  const limit = rateLimit(`public-lookup:${clientIp(req.headers)}`, 20, 60_000);
  if (!limit.ok) {
    return NextResponse.json({ error: "RATE_LIMITED" }, { status: 429, headers: { "Retry-After": String(limit.retryAfter) } });
  }
  const number = new URL(req.url).searchParams.get("number") ?? "";
  const token = await tokenForCertificateNumber(number);
  if (!token) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  return NextResponse.json({ token });
}
