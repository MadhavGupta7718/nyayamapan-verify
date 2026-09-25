import { NextResponse } from "next/server";
import { auth } from "@/server/auth";
import { jsonError } from "@/server/api";
import { BROWSER_SESSION_COOKIE, browserSessionCookieOptions, browserSessionValue } from "@/server/browser-session";

/** Called by the login form right after a successful sign-in to start the browser-session marker. */
export async function POST() {
  const session = await auth();
  const id = session?.user?.id;
  if (!id) return jsonError(401, "UNAUTHORIZED");
  const res = new NextResponse(null, { status: 204 });
  res.cookies.set(BROWSER_SESSION_COOKIE, browserSessionValue(id), browserSessionCookieOptions);
  return res;
}
