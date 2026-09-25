import { NextRequest, NextResponse } from "next/server";
import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";

const intlMiddleware = createMiddleware(routing);

const TOKEN_RE = /^\/c\/([A-Za-z0-9_-]{16,64})\/?$/;
const PORTAL_RE =
  /^\/(?:(?:en|hi)\/)?(?:dashboard|applications|instruments|verification|scheduling|certificates|gatc|reports|notifications|rules|users|geography|audit|profile|settings)(?:\/|$)/;

export default function middleware(req: NextRequest) {
  const short = TOKEN_RE.exec(req.nextUrl.pathname);
  if (short) {
    const preferred = req.headers.get("accept-language")?.toLowerCase().startsWith("hi") ? "hi" : "en";
    const url = req.nextUrl.clone();
    url.pathname = `/${preferred}/c/${short[1]}`;
    return NextResponse.rewrite(url);
  }
  const res = intlMiddleware(req);
  res.headers.set("X-Request-Id", crypto.randomUUID());
  if (PORTAL_RE.test(req.nextUrl.pathname)) res.headers.set("Cache-Control", "private, no-store, max-age=0, must-revalidate");
  return res;
}

export const config = {
  matcher: ["/", "/(hi|en)/:path*", "/((?!api|_next|_vercel|.*\\..*).*)"],
};
