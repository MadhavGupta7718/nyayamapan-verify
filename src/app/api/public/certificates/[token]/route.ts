import { NextRequest, NextResponse } from "next/server";
import { verifyPublicToken } from "@/services/public-verification";
import { clientIp, rateLimit } from "@/server/rate-limit";

export async function GET(req: NextRequest, ctx: { params: Promise<{ token: string }> }) {
  const ip = clientIp(req.headers);
  const limit = rateLimit(`public-verify:${ip}`, 60, 60_000);
  if (!limit.ok) {
    return NextResponse.json({ error: "RATE_LIMITED" }, { status: 429, headers: { "Retry-After": String(limit.retryAfter) } });
  }
  const { token } = await ctx.params;
  const result = await verifyPublicToken(token, { ip, userAgent: req.headers.get("user-agent") });
  return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
}
